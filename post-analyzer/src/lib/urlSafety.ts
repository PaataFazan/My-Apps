import { promises as dns, LookupAddress } from "node:dns";
import net from "node:net";

const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "metadata",
  "metadata.goog",
]);

function ipv4ToBytes(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

function isPrivateIPv4(ip: string): boolean {
  const b = ipv4ToBytes(ip);
  if (!b) return true;
  const [a, c] = b;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && c === 254) return true; // link-local + AWS/GCP metadata
  if (a === 172 && b[1] >= 16 && b[1] <= 31) return true;
  if (a === 192 && b[1] === 168) return true;
  if (a === 192 && b[1] === 0 && b[2] === 0) return true;
  if (a === 198 && (b[1] === 18 || b[1] === 19)) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped IPv6: ::ffff:a.b.c.d
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // unknown → treat as unsafe
}

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) {
    throw new Error("URL is missing a hostname.");
  }
  if (BLOCKED_HOSTS.has(hostname)) {
    throw new Error("This host is not allowed.");
  }

  // If the host is already a literal IP, check it directly.
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("URLs pointing at private/internal IPs are not allowed.");
    }
    return parsed;
  }

  // Otherwise, resolve DNS and ensure no resolved address is private.
  let records: LookupAddress[];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve URL hostname.");
  }

  if (records.length === 0) {
    throw new Error("Could not resolve URL hostname.");
  }

  for (const r of records) {
    if (isPrivateAddress(r.address)) {
      throw new Error(
        "URLs that resolve to private/internal IPs are not allowed.",
      );
    }
  }

  return parsed;
}
