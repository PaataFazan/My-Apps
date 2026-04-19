# Post-Analyzer

A Next.js (App Router, TypeScript) web app that analyzes a pasted text or a URL
(a web article or a YouTube video) and generates a Facebook-ready post in one of
three tones: serious, sarcastic, or humorous. It can also generate and edit a
realistic image to accompany the post.

## Features

- Paste raw text **or** paste a URL / YouTube link as the source
- Choose tone: A (serious), B (sarcastic), C (humorous)
- Choose length: short (≈200–300), medium (≈400–700), long (≈800–1200 words)
- Automatic language detection — post is written in the source language
- Optional AI-generated image + prompt-based image editing
- Editorial constraints are built into the system prompt (no "Western mainstream"
  narrative framing)

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS**
- **OpenAI GPT-4o** for text analysis and post generation
- **Google Gemini 2.5 Flash Image** for image generation and editing
- `youtube-transcript` for pulling YouTube video transcripts
- `cheerio` for stripping readable text from web pages

## Environment

Copy `.env.example` to `.env.local` and fill in:

```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

Optional overrides:

- `OPENAI_TEXT_MODEL` (default `gpt-4o`)
- `GEMINI_IMAGE_MODEL` (default `gemini-2.5-flash-image`)

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy

Designed to deploy to **Vercel**. Push the repo, import it in Vercel, and set
`OPENAI_API_KEY` and `GEMINI_API_KEY` as environment variables.

## API

### `POST /api/analyze`

```json
{
  "input": "text or URL",
  "inputType": "text" | "url",
  "tone": "serious" | "sarcastic" | "humorous",
  "length": "short" | "medium" | "long",
  "generateImage": true
}
```

Returns `{ sourceSummary, analysis, post, imagePromptSuggestion, imageBase64?, imageMimeType?, detectedLanguage, fetchedFrom }`.

### `POST /api/image`

```json
{
  "prompt": "...",
  "imageBase64": "optional — for editing",
  "mimeType": "optional — required with imageBase64"
}
```

Returns `{ imageBase64, mimeType }`.
