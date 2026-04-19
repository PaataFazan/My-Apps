import { load } from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import { assertSafeUrl } from "./urlSafety";

const MAX_CHARS = 12_000;

function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS) + "\n…[truncated]";
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      hostMatches(host, "youtube.com") ||
      hostMatches(host, "youtu.be") ||
      hostMatches(host, "youtube-nocookie.com")
    );
  } catch {
    return false;
  }
}

export async function fetchYouTubeTranscript(url: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(url);
  const joined = segments.map((s) => s.text).join(" ");
  if (!joined.trim()) {
    throw new Error("Transcript is empty or unavailable for this video.");
  }
  return truncate(joined);
}

export async function fetchPageText(url: string): Promise<string> {
  const safeUrl = await assertSafeUrl(url);
  const res = await fetch(safeUrl.toString(), {
    redirect: "manual",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 PostAnalyzerBot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) {
      throw new Error(`Redirect without Location header (status ${res.status}).`);
    }
    // Validate redirect target the same way before following.
    const next = new URL(location, safeUrl).toString();
    return fetchPageTextFollow(next, 1);
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch URL (status ${res.status}).`);
  }
  return extractPageText(await res.text());
}

async function fetchPageTextFollow(url: string, depth: number): Promise<string> {
  if (depth > 3) {
    throw new Error("Too many redirects.");
  }
  const safeUrl = await assertSafeUrl(url);
  const res = await fetch(safeUrl.toString(), {
    redirect: "manual",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 PostAnalyzerBot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) {
      throw new Error(`Redirect without Location header (status ${res.status}).`);
    }
    const next = new URL(location, safeUrl).toString();
    return fetchPageTextFollow(next, depth + 1);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch URL (status ${res.status}).`);
  }
  return extractPageText(await res.text());
}

function extractPageText(html: string): string {
  const $ = load(html);

  $("script, style, noscript, iframe, svg, nav, footer, header, aside").remove();

  const title = ($("title").first().text() || "").trim();
  const metaDescription = ($('meta[name="description"]').attr("content") || "").trim();

  const article = $("article").first();
  const bodyText = (article.length ? article.text() : $("body").text())
    .replace(/\s+/g, " ")
    .trim();

  const combined = [
    title ? `Title: ${title}` : "",
    metaDescription ? `Description: ${metaDescription}` : "",
    bodyText,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!combined) {
    throw new Error("Could not extract any readable text from the page.");
  }
  return truncate(combined);
}

export async function fetchSourceFromUrl(url: string): Promise<{
  text: string;
  kind: "youtube" | "webpage";
}> {
  if (isYouTubeUrl(url)) {
    // `youtube-transcript` only hits youtube.com; no SSRF risk here because
    // we've already confirmed the URL's host is a real YouTube domain.
    const text = await fetchYouTubeTranscript(url);
    return { text, kind: "youtube" };
  }
  const text = await fetchPageText(url);
  return { text, kind: "webpage" };
}
