"use client";

import { useState } from "react";
import { ingestJob } from "../actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg border-zinc-800 bg-zinc-900 text-zinc-100 p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-zinc-800/80">
          <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            Ingest Target Job
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Paste JD text or enter a URL. AI extracts details & scores candidate fit automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector */}
        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              mode === "paste"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Paste Job Description
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              mode === "url"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
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
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Job Description Text *
              </label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the full job posting, requirements, and responsibilities here..."
                rows={7}
                required
                className="font-mono text-xs resize-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Job Posting URL *
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://jobs.example.com/roles/ai-engineer"
                required
                className="font-mono text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                Company (Optional override)
              </label>
              <Input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Anthropic"
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                Role Title (Optional override)
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI Systems Engineer"
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="gap-2 font-semibold"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-zinc-900" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Scoring with AI...</span>
                </>
              ) : (
                <span>Ingest & Evaluate</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

