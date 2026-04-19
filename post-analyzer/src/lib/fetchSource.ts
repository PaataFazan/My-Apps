import { load } from "cheerio";
import { YoutubeTranscript } from "youtube-transcript";

const MAX_CHARS = 12_000;

function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS) + "\n…[truncated]";
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("youtube.com") ||
      u.hostname.includes("youtu.be") ||
      u.hostname.includes("youtube-nocookie.com")
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
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 PostAnalyzerBot/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch URL (status ${res.status}).`);
  }
  const html = await res.text();
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
    const text = await fetchYouTubeTranscript(url);
    return { text, kind: "youtube" };
  }
  const text = await fetchPageText(url);
  return { text, kind: "webpage" };
}
