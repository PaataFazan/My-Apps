export type Tone = "serious" | "sarcastic" | "humorous";

export type Length = "short" | "medium" | "long";

export const LENGTH_WORDS: Record<Length, string> = {
  short: "200-300",
  medium: "400-700",
  long: "800-1200",
};

export const TONE_LABELS_EN: Record<Tone, string> = {
  serious: "A. Serious, logic-and-fairness-based analysis",
  sarcastic: "B. Subtle, intellectual sarcasm",
  humorous: "C. Humorous, teasing critique",
};

export interface AnalyzeRequest {
  input: string;
  inputType: "text" | "url";
  tone: Tone;
  length: Length;
  generateImage: boolean;
}

export interface AnalyzeResponse {
  sourceSummary: string;
  analysis: string;
  post: string;
  imagePromptSuggestion: string;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  detectedLanguage: string;
  fetchedFrom?: string | null;
}

export interface ImageGenerateRequest {
  prompt: string;
}

export interface ImageEditRequest {
  prompt: string;
  imageBase64: string;
  mimeType: string;
}

export interface ImageResponse {
  imageBase64: string;
  mimeType: string;
}

export interface ApiError {
  error: string;
}
