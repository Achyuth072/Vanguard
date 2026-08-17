"use client";

import { useState } from "react";
import type { ApplicationAnswer } from "@/types/tailoring";
import { askCustomApplicationQuestion } from "@/app/actions/tailoring";

interface QuestionAnswersListProps {
  jobId: string;
  answers: ApplicationAnswer[];
  onAnswersUpdated?: (updatedAnswers: ApplicationAnswer[]) => void;
}

export default function QuestionAnswersList({
  jobId,
  answers,
  onAnswersUpdated,
}: QuestionAnswersListProps) {
  const [customQuestion, setCustomQuestion] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  async function handleAskCustom(e: React.FormEvent) {
    e.preventDefault();
    const prompt = customQuestion.trim();
    if (!prompt) return;

    setIsGenerating(true);
    setError(null);

    try {
      const res = await askCustomApplicationQuestion(jobId, prompt);
      if (res.success) {
        setCustomQuestion("");
        if (onAnswersUpdated) {
          onAnswersUpdated(res.questionAnswers);
        }
      }
    } catch (err: unknown) {
      console.error("Custom answer error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate answer");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Interactive Custom Question Prompt Box */}
      <div className="bg-[#111111] p-4 rounded-xl border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Ask Custom Application Portal Question
            </h3>
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">Grounded in Candidate Facts</span>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAskCustom} className="space-y-3">
          <textarea
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Paste any screening question from the job application portal (e.g. 'Describe a challenging system you architected...')"
            rows={2}
            required
            className="w-full bg-[#181818] border border-neutral-800 rounded-lg p-3 text-xs text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isGenerating || !customQuestion.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Generating Grounded Answer...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Solve Question</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* List of Answers */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold px-1">
          <span>Prepared Application Answers ({answers.length})</span>
          <span className="text-[11px] text-neutral-500 font-mono">1-Click Copy Ready</span>
        </div>

        {answers.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#0D0D0D] border border-neutral-900 text-center space-y-2">
            <p className="text-xs text-neutral-400 font-medium">No answers generated yet.</p>
            <p className="text-[11px] text-neutral-600">
              Prepare the application or ask a custom question above to generate responses.
            </p>
          </div>
        ) : (
          answers.map((item, idx) => {
            const isCopied = copiedId === item.id;

            return (
              <div
                key={item.id || idx}
                className="p-4 rounded-xl bg-[#0D0D0D] border border-neutral-800 space-y-3 transition-all hover:border-neutral-700 group"
              >
                {/* Question Header & Copy Button */}
                <div className="flex items-start justify-between gap-3 border-b border-neutral-900 pb-2.5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/60">
                      Question {idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-white tracking-tight">
                      {item.question}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(item.id || String(idx), item.answer)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-[#161616] hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all text-xs font-semibold shrink-0"
                    title="Copy Answer to Clipboard"
                  >
                    {isCopied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-400 text-[11px]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 text-neutral-400 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        <span className="text-[11px]">Copy Answer</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Answer Content */}
                <div className="bg-[#141414] p-3.5 rounded-lg border border-neutral-800/80 text-xs text-neutral-200 leading-relaxed font-sans select-all">
                  {item.answer}
                </div>

                {/* Key Facts Used Badges */}
                {item.keyPointsUsed && item.keyPointsUsed.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-neutral-500 font-mono">Facts Cited:</span>
                    {item.keyPointsUsed.map((point, ptIdx) => (
                      <span
                        key={ptIdx}
                        className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] font-mono"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
