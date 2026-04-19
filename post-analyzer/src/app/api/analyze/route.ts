import { NextRequest } from "next/server";
import {
  AnalyzeRequest,
  AnalyzeResponse,
  Length,
  Tone,
} from "@/lib/types";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
} from "@/lib/prompts";
import { fetchSourceFromUrl } from "@/lib/fetchSource";
import { getOpenAI, TEXT_MODEL } from "@/lib/openai";
import { generateImage } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TONES: Tone[] = ["serious", "sarcastic", "humorous"];
const VALID_LENGTHS: Length[] = ["short", "medium", "long"];

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRequest(body: any): AnalyzeRequest | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const { input, inputType, tone, length, generateImage: gi } = body;
  if (typeof input !== "string" || !input.trim()) {
    return "`input` is required.";
  }
  if (inputType !== "text" && inputType !== "url") {
    return "`inputType` must be 'text' or 'url'.";
  }
  if (!VALID_TONES.includes(tone)) {
    return "`tone` must be 'serious', 'sarcastic', or 'humorous'.";
  }
  if (!VALID_LENGTHS.includes(length)) {
    return "`length` must be 'short', 'medium', or 'long'.";
  }
  return {
    input: input.trim(),
    inputType,
    tone,
    length,
    generateImage: Boolean(gi),
  };
}

interface LLMJson {
  detectedLanguage?: string;
  sourceSummary?: string;
  analysis?: string;
  post?: string;
  imagePromptSuggestion?: string;
}

function coerceLLMJson(raw: string): LLMJson {
  const trimmed = raw.trim();
  // strip markdown fences if present
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const content = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(content) as LLMJson;
  } catch {
    throw new Error(
      "Model did not return valid JSON. Try again or adjust the input.",
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = parseRequest(body);
  if (typeof parsed === "string") return jsonError(parsed, 400);

  let sourceText = parsed.input;
  let fetchedFrom: string | null = null;
  if (parsed.inputType === "url") {
    try {
      const result = await fetchSourceFromUrl(parsed.input);
      sourceText = result.text;
      fetchedFrom = parsed.input;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to fetch or parse the URL.";
      return jsonError(msg, 400);
    }
  }

  let llmJson: LLMJson;
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildAnalysisSystemPrompt(parsed.tone, parsed.length),
        },
        {
          role: "user",
          content: buildAnalysisUserPrompt(sourceText, fetchedFrom),
        },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content ?? "";
    llmJson = coerceLLMJson(raw);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Text generation failed.";
    return jsonError(msg, 502);
  }

  const responsePayload: AnalyzeResponse = {
    sourceSummary: llmJson.sourceSummary ?? "",
    analysis: llmJson.analysis ?? "",
    post: llmJson.post ?? "",
    imagePromptSuggestion: llmJson.imagePromptSuggestion ?? "",
    detectedLanguage: llmJson.detectedLanguage ?? "",
    fetchedFrom,
    imageBase64: null,
    imageMimeType: null,
  };

  if (parsed.generateImage && responsePayload.imagePromptSuggestion) {
    try {
      const image = await generateImage(responsePayload.imagePromptSuggestion);
      responsePayload.imageBase64 = image.imageBase64;
      responsePayload.imageMimeType = image.mimeType;
    } catch (err) {
      // Image failure should not fail the whole request.
      console.error("Image generation failed:", err);
    }
  }

  return Response.json(responsePayload);
}
