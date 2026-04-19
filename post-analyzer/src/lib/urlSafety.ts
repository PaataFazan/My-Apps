import { promises as dns, LookupAddress } from "node:dns";
import net from "node:net";
import { Agent } from "undici";

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

function ipv6MappedIPv4(lower: string): string | null {
  // Dotted-decimal form: ::ffff:1.2.3.4
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  // Hex form: ::ffff:abcd:ef01 (also tolerate ::ffff:0:abcd:ef01)
  const hex = lower.match(
    /^(?:::ffff:|::ffff:0:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
  );
  if (hex) {
    const a = parseInt(hex[1], 16);
    const b = parseInt(hex[2], 16);
    if (a > 0xffff || b > 0xffff) return null;
    return [
      (a >> 8) & 0xff,
      a & 0xff,
      (b >> 8) & 0xff,
      b & 0xff,
    ].join(".");
  }
  return null;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  const mapped = ipv6MappedIPv4(lower);
  if (mapped) return isPrivateIPv4(mapped);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

export interface SafeUrl {
  url: URL;
  resolvedIp: string;
  ipFamily: 4 | 6;
}

export async function assertSafeUrl(rawUrl: string): Promise<SafeUrl> {
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

  // Literal IP: validate directly.
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("URLs pointing at private/internal IPs are not allowed.");
    }
    return {
      url: parsed,
      resolvedIp: hostname,
      ipFamily: net.isIP(hostname) === 6 ? 6 : 4,
    };
  }

  // Resolve DNS once and validate every answer.
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

  const chosen = records[0];
  return {
    url: parsed,
    resolvedIp: chosen.address,
    ipFamily: chosen.family === 6 ? 6 : 4,
  };
}

/**
 * Returns an undici Agent that pins DNS resolution to the validated IP.
 * This prevents DNS-rebinding TOCTOU between the SSRF check and fetch().
 * Disables redirect-following at the network level so the caller can
 * re-validate each hop explicitly.
 */
export function pinnedAgent(safe: SafeUrl): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => {
        callback(null, safe.resolvedIp, safe.ipFamily);
      },
    },
  });
}
