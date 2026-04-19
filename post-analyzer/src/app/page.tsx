"use client";

import { useState } from "react";
import type {
  AnalyzeResponse,
  ApiError,
  ImageResponse,
  Length,
  Tone,
} from "@/lib/types";

type InputType = "text" | "url";

const TONE_OPTIONS: { value: Tone; title: string; desc: string }[] = [
  {
    value: "serious",
    title: "A · სერიოზული",
    desc: "ობიექტური, გაწონასწორებული ანალიზი",
  },
  {
    value: "sarcastic",
    title: "B · სარკასტული",
    desc: "დახვეწილი ინტელექტუალური სარკაზმი",
  },
  {
    value: "humorous",
    title: "C · ხუმრობითი",
    desc: "იუმორისტული, დამცინავი კრიტიკა",
  },
];

const LENGTH_OPTIONS: { value: Length; label: string; desc: string }[] = [
  { value: "short", label: "მოკლე", desc: "≈ 200–300 სიტყვა" },
  { value: "medium", label: "საშუალო", desc: "≈ 400–700 სიტყვა" },
  { value: "long", label: "ვრცელი", desc: "≈ 800–1200 სიტყვა" },
];

function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export default function Home() {
  const [inputType, setInputType] = useState<InputType>("text");
  const [input, setInput] = useState("");
  const [tone, setTone] = useState<Tone>("serious");
  const [length, setLength] = useState<Length>("medium");
  const [wantImage, setWantImage] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const [editPrompt, setEditPrompt] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function handleAnalyze() {
    setError(null);
    setResult(null);
    if (!input.trim()) {
      setError("გთხოვთ შეიყვანოთ ტექსტი ან ბმული.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: input.trim(),
          inputType,
          tone,
          length,
          generateImage: wantImage,
        }),
      });
      const data = (await res.json()) as AnalyzeResponse | ApiError;
      if (!res.ok || "error" in data) {
        const msg = "error" in data ? data.error : `Error ${res.status}`;
        setError(msg);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerateImage() {
    if (!result?.imagePromptSuggestion) return;
    setEditError(null);
    setEditLoading(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: result.imagePromptSuggestion }),
      });
      const data = (await res.json()) as ImageResponse | ApiError;
      if (!res.ok || "error" in data) {
        setEditError("error" in data ? data.error : `Error ${res.status}`);
        return;
      }
      setResult({
        ...result,
        imageBase64: data.imageBase64,
        imageMimeType: data.mimeType,
      });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleEditImage() {
    if (!result?.imageBase64 || !result.imageMimeType) return;
    if (!editPrompt.trim()) {
      setEditError("შეიყვანეთ რედაქტირების პრომპტი.");
      return;
    }
    setEditError(null);
    setEditLoading(true);
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: editPrompt.trim(),
          imageBase64: result.imageBase64,
          mimeType: result.imageMimeType,
        }),
      });
      const data = (await res.json()) as ImageResponse | ApiError;
      if (!res.ok || "error" in data) {
        setEditError("error" in data ? data.error : `Error ${res.status}`);
        return;
      }
      setResult({
        ...result,
        imageBase64: data.imageBase64,
        imageMimeType: data.mimeType,
      });
      setEditPrompt("");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setEditLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Post-Analyzer
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            გააანალიზე ტექსტი ან ბმული და მიიღე Facebook-ისთვის მზა პოსტი —
            სერიოზული, სარკასტული ან ხუმრობითი ტონით.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setInputType("text")}
              className={classNames(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                inputType === "text"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
              )}
            >
              ტექსტი
            </button>
            <button
              type="button"
              onClick={() => setInputType("url")}
              className={classNames(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                inputType === "url"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
              )}
            >
              ბმული (URL / YouTube)
            </button>
          </div>

          {inputType === "text" ? (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ჩასვით სტატიის, სიახლის ან სხვა პოსტის ტექსტი..."
              rows={8}
              className="w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-[inherit] text-sm leading-6 text-zinc-900 placeholder-zinc-400 shadow-inner focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:ring-zinc-800"
            />
          ) : (
            <input
              type="url"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://example.com/article ან YouTube ვიდეოს ბმული"
              className="w-full rounded-md border border-zinc-300 bg-white p-3 text-sm text-zinc-900 placeholder-zinc-400 shadow-inner focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:ring-zinc-800"
            />
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">პოსტის ტონი</h3>
              <div className="space-y-2">
                {TONE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={classNames(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
                      tone === opt.value
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700",
                    )}
                  >
                    <input
                      type="radio"
                      name="tone"
                      className="mt-1"
                      checked={tone === opt.value}
                      onChange={() => setTone(opt.value)}
                    />
                    <div>
                      <div className="text-sm font-medium">{opt.title}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">პოსტის მოცულობა</h3>
              <div className="space-y-2">
                {LENGTH_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={classNames(
                      "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
                      length === opt.value
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700",
                    )}
                  >
                    <input
                      type="radio"
                      name="length"
                      className="mt-1"
                      checked={length === opt.value}
                      onChange={() => setLength(opt.value)}
                    />
                    <div>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {opt.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={wantImage}
                  onChange={(e) => setWantImage(e.target.checked)}
                />
                შექმენი რეალისტური სურათიც პოსტისთვის
              </label>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "მიმდინარეობს..." : "გაანალიზე და დამიწერე პოსტი"}
            </button>
            {error && (
              <span className="text-sm text-red-600 dark:text-red-400">
                {error}
              </span>
            )}
          </div>
        </section>

        {result && (
          <section className="space-y-6">
            <ResultCard
              title="წყაროს შეჯამება"
              body={result.sourceSummary}
              hint={
                result.fetchedFrom
                  ? `ამოღებულია: ${result.fetchedFrom}`
                  : undefined
              }
            />
            <ResultCard title="მოკლე ანალიზი" body={result.analysis} />

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Facebook პოსტი</h3>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.post)}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  კოპირება
                </button>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-7">
                {result.post}
              </div>
              {result.detectedLanguage && (
                <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  ენა: {result.detectedLanguage}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">სურათი</h3>
                <button
                  type="button"
                  onClick={handleRegenerateImage}
                  disabled={editLoading || !result.imagePromptSuggestion}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {result.imageBase64 ? "ხელახლა გენერაცია" : "სურათის გენერაცია"}
                </button>
              </div>
              {result.imageBase64 && result.imageMimeType ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${result.imageMimeType};base64,${result.imageBase64}`}
                    alt="generated"
                    className="max-h-[480px] w-auto rounded-md border border-zinc-200 dark:border-zinc-800"
                  />
                  <div className="mt-4 space-y-2">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      რედაქტირების პრომპტი
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="მაგ. 'დაამატე თბილი მზის შუქი ფონზე'"
                        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <button
                        type="button"
                        onClick={handleEditImage}
                        disabled={editLoading}
                        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        {editLoading ? "..." : "რედაქტირება"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {result.imagePromptSuggestion
                    ? "სურათი ჯერ არ არის დაგენერირებული. დააჭირეთ ღილაკს ზემოთ."
                    : "სურათის პრომპტი ვერ შეიქმნა."}
                </p>
              )}
              {result.imagePromptSuggestion && (
                <details className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <summary className="cursor-pointer">
                    სურათის პრომპტი (ინგლისურად)
                  </summary>
                  <div className="mt-2 whitespace-pre-wrap">
                    {result.imagePromptSuggestion}
                  </div>
                </details>
              )}
              {editError && (
                <div className="mt-3 text-xs text-red-600 dark:text-red-400">
                  {editError}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        Post-Analyzer · OpenAI GPT-4o + Google Gemini (Imagen)
      </footer>
    </div>
  );
}

function ResultCard({
  title,
  body,
  hint,
}: {
  title: string;
  body: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-800 dark:text-zinc-200">
        {body}
      </div>
      {hint && (
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </div>
      )}
    </div>
  );
}
