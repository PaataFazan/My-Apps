import { load } from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";
import { assertSafeUrl, pinnedAgent, type SafeUrl } from "./urlSafety";

const MAX_CHARS = 12_000;
const MAX_REDIRECTS = 3;

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

async function safeFetchOnce(safe: SafeUrl): Promise<Response> {
  const agent = pinnedAgent(safe);
  // `dispatcher` is an undici-specific option that Node's global `fetch`
  // forwards through, pinning DNS to the pre-validated IP. It is not on the
  // standard RequestInit type so we cast.
  const init = {
    redirect: "manual",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 PostAnalyzerBot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    dispatcher: agent,
  } as unknown as RequestInit;
  try {
    return await fetch(safe.url.toString(), init);
  } finally {
    agent.close().catch(() => {});
  }
}

export async function fetchPageText(url: string): Promise<string> {
  let safe = await assertSafeUrl(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await safeFetchOnce(safe);
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error(
          `Redirect without Location header (status ${res.status}).`,
        );
      }
      const next = new URL(location, safe.url).toString();
      safe = await assertSafeUrl(next);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch URL (status ${res.status}).`);
    }
    return extractPageText(await res.text());
  }
  throw new Error("Too many redirects.");
}

function extractPageText(html: string): string {
  const $ = load(html);

  $("script, style, noscript, iframe, svg, nav, footer, header, aside").remove();

  const title = ($("title").first().text() || "").trim();
  const metaDescription = (
    $('meta[name="description"]').attr("content") || ""
  ).trim();

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
    // `youtube-transcript` only hits youtube.com; host check above confirms that.
    const text = await fetchYouTubeTranscript(url);
    return { text, kind: "youtube" };
  }
  const text = await fetchPageText(url);
  return { text, kind: "webpage" };
}
