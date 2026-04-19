import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it to your environment (.env.local or hosting platform).",
    );
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o";
