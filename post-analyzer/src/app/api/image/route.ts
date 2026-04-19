import { NextRequest } from "next/server";
import { editImage, generateImage } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }

  const {
    prompt,
    imageBase64,
    mimeType,
  }: {
    prompt?: unknown;
    imageBase64?: unknown;
    mimeType?: unknown;
  } = body as Record<string, unknown>;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return jsonError("`prompt` is required.", 400);
  }

  try {
    if (
      typeof imageBase64 === "string" &&
      imageBase64.length > 0 &&
      typeof mimeType === "string" &&
      mimeType.length > 0
    ) {
      const img = await editImage(prompt, imageBase64, mimeType);
      return Response.json(img);
    }
    const img = await generateImage(prompt);
    return Response.json(img);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image request failed.";
    return jsonError(msg, 502);
  }
}
