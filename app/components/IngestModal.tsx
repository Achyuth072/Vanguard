"use client";

import { useState } from "react";
import { ingestJob } from "../actions";

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function IngestModal({ isOpen, onClose, onSuccess }: IngestModalProps) {
  const [mode, setMode] = useState<"paste" | "url">("paste");
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResultMessage(null);

    try {
      const payload = {
        source: mode === "url" ? "URL" : "PASTE",
        ...(mode === "url" ? { url: url.trim() } : { rawText: rawText.trim() }),
        ...(company.trim() ? { company: company.trim() } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
      };

      const res = await ingestJob(payload);
      if (res && res.job) {
        const scoreText = res.fitScore ? `Fit Score: ${res.fitScore.score}/100 (${res.fitScore.recommendation})` : "Ingested & Staged";
        setResultMessage(`✓ Successfully ingested "${res.job.title}" at ${res.job.company}. ${scoreText}`);
        setTimeout(() => {
          setRawText("");
          setUrl("");
          setCompany("");
          setTitle("");
          setResultMessage(null);
          onClose();
          if (onSuccess) onSuccess();
        }, 1500);
      } else {
        setError("Job ingestion did not return a valid record.");
      }
    } catch (err: unknown) {
      console.error("Ingestion error:", err);
      setError(err instanceof Error ? err.message : "Failed to ingest job.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#0D0D0D] border border-neutral-800 rounded-xl p-6 shadow-2xl space-y-5 text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ingest-modal-title"
      >
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
          <div>
            <h2 id="ingest-modal-title" className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Ingest Target Job
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Paste JD text or enter a URL. AI extracts details & scores candidate fit automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex rounded-lg bg-[#161616] p-1 border border-neutral-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              mode === "paste"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Paste Job Description
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              mode === "url"
                ? "bg-neutral-800 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Job Listing URL
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {resultMessage && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{resultMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "paste" ? (
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-neutral-400 mb-1.5">
                Job Description Text *
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the full job posting, requirements, and responsibilities here..."
                rows={7}
                required
                className="w-full bg-[#141414] border border-neutral-800 rounded-lg p-3 text-xs text-neutral-200 placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-neutral-400 mb-1.5">
                Job Posting URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://jobs.example.com/roles/ai-engineer"
                required
                className="w-full bg-[#141414] border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1">
                Company (Optional override)
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Anthropic"
                className="w-full bg-[#141414] border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1">
                Role Title (Optional override)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI Systems Engineer"
                className="w-full bg-[#141414] border border-neutral-800 rounded-lg p-2 text-xs text-neutral-200 placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Scoring with AI...</span>
                </>
              ) : (
                <span>Ingest & Evaluate</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
