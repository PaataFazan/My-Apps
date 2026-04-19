import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to your environment (.env.local or hosting platform).",
    );
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

export const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

export interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
}

function extractImageFromResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any,
): GeneratedImage | null {
  const candidates = response?.candidates;
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inline = part?.inlineData;
      if (inline?.data && typeof inline.data === "string") {
        return {
          imageBase64: inline.data,
          mimeType: inline.mimeType || "image/png",
        };
      }
    }
  }
  return null;
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });
  const img = extractImageFromResponse(response);
  if (!img) {
    throw new Error("Image generation did not return an image.");
  }
  return img;
}

export async function editImage(
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Promise<GeneratedImage> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompt },
        ],
      },
    ],
  });
  const img = extractImageFromResponse(response);
  if (!img) {
    throw new Error("Image edit did not return an image.");
  }
  return img;
}
