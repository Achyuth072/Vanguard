"use client";

import { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import type { ApplicationAnswer } from "@/types/tailoring";
import { askCustomApplicationQuestion } from "@/app/actions/tailoring";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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
      <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
              Ask Custom Application Portal Question
            </h3>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            Grounded in Candidate Facts
          </Badge>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAskCustom} className="space-y-3">
          <Textarea
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Paste any screening question from the job application portal (e.g. 'Describe a challenging system you architected...')"
            rows={2}
            required
            className="text-xs resize-none"
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isGenerating || !customQuestion.trim()}
              className="gap-2 text-xs font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Grounded Answer...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>Solve Question</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* List of Answers */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-medium px-1">
          <span>Prepared Application Answers ({answers.length})</span>
          <span className="text-[11px] text-zinc-500 font-mono">1-Click Copy Ready</span>
        </div>

        {answers.length === 0 ? (
          <div className="p-8 rounded-lg bg-zinc-950 border border-zinc-800 text-center space-y-2">
            <div className="flex justify-center text-zinc-500">
              <MessageSquare className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-xs text-zinc-400 font-medium">No answers generated yet.</p>
            <p className="text-[11px] text-zinc-500">
              Prepare the application or ask a custom question above to generate responses.
            </p>
          </div>
        ) : (
          answers.map((item, idx) => {
            const isCopied = copiedId === (item.id || String(idx));

            return (
              <div
                key={item.id || idx}
                className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3 transition-colors hover:border-zinc-700"
              >
                {/* Question Header & Copy Button */}
                <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-2.5">
                  <div className="space-y-1">
                    <Badge variant="violet" className="font-mono text-[10px] uppercase tracking-wider">
                      Question {idx + 1}
                    </Badge>
                    <h4 className="text-xs font-semibold text-zinc-100 tracking-tight">
                      {item.question}
                    </h4>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(item.id || String(idx), item.answer)}
                    className="text-xs shrink-0 gap-1.5"
                    title="Copy Answer to Clipboard"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-[11px]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="text-[11px]">Copy Answer</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Answer Content */}
                <div className="bg-zinc-900 p-3.5 rounded-md border border-zinc-800 text-xs text-zinc-200 leading-relaxed font-sans select-all">
                  {item.answer}
                </div>

                {/* Key Facts Used Badges */}
                {item.keyPointsUsed && item.keyPointsUsed.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-zinc-500 font-mono">Facts Cited:</span>
                    {item.keyPointsUsed.map((point, ptIdx) => (
                      <Badge
                        key={ptIdx}
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {point}
                      </Badge>
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
