"use client";

import { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import type { ApplicationAnswer } from "@/types/tailoring";
import { askCustomApplicationQuestion } from "@/app/actions/tailoring";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
      <div className="bg-[#15171d] p-4 rounded-[3px] border border-[#2a2e38] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-[#d4a745]">
            <Sparkles className="w-3.5 h-3.5 text-[#d4a745]" />
            <span>GENERATE CUSTOM APPLICATION ANSWER</span>
          </div>
          <span className="font-mono text-xs text-[#8ab384] px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#8ab384]" />
            <span>GROUNDED IN FACTS</span>
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-[2px] bg-[#15171d] border border-[#c4634e] text-[#c4634e] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#c4634e]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAskCustom} className="space-y-3">
          <Textarea
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Paste screening question from employer portal (e.g. 'Describe a challenging distributed system you designed and led...')"
            rows={2}
            required
            className="text-xs bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] placeholder:text-[#a6abbd] resize-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isGenerating || !customQuestion.trim()}
              className="gap-2 text-xs font-bold bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Answer...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Draft Grounded Answer</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* List of Answers */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-xs text-[#a6abbd] font-mono px-1">
          <span>PREPARED APPLICATION ANSWERS ({answers.length})</span>
          <span className="text-[11px] text-[#a6abbd]">1-CLICK COPY READY</span>
        </div>

        {answers.length === 0 ? (
          <div className="p-8 rounded-[3px] bg-[#15171d] border border-[#2a2e38] text-center space-y-2">
            <div className="flex justify-center text-[#a6abbd]">
              <MessageSquare className="w-8 h-8 opacity-40 text-[#a6abbd]" />
            </div>
            <p className="text-xs text-[#f4f2ec] font-semibold">No answers generated yet.</p>
            <p className="text-[11px] text-[#a6abbd] font-mono">
              Click &apos;Prepare Application&apos; or paste a custom question above.
            </p>
          </div>
        ) : (
          answers.map((item, idx) => {
            const isCopied = copiedId === (item.id || String(idx));
            const questionNum = idx < 9 ? `0${idx + 1}` : `${idx + 1}`;

            return (
              <div
                key={item.id || idx}
                className="p-4 rounded-[3px] bg-[#15171d] border border-[#2a2e38] space-y-3 transition-colors hover:border-[#3d4352]"
              >
                {/* Question Header & Copy Button */}
                <div className="flex items-start justify-between gap-3 border-b border-[#2a2e38] pb-2.5">
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-[#d4a745] uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] inline-block font-semibold">
                      QUESTION {questionNum}
                    </span>
                    <h4 className="text-sm font-semibold text-[#f4f2ec] tracking-tight">
                      {item.question}
                    </h4>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(item.id || String(idx), item.answer)}
                    className="text-xs shrink-0 gap-1.5 font-mono rounded-[2px] border-[#2a2e38] bg-[#0d0e12] text-[#f4f2ec] hover:bg-[#1f222a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
                    title="Copy Answer to Clipboard"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#8ab384]" />
                        <span className="text-[#8ab384] text-[11px]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#a6abbd]" />
                        <span className="text-[11px]">Copy Answer</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Answer Content */}
                <div className="bg-[#0d0e12] p-3.5 rounded-[2px] border border-[#2a2e38] text-sm text-[#f4f2ec] leading-relaxed font-sans select-all">
                  {item.answer}
                </div>

                {/* Key Facts Used Badges */}
                {item.keyPointsUsed && item.keyPointsUsed.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[#a6abbd] font-mono font-semibold">FACTS CITED:</span>
                    {item.keyPointsUsed.map((point, ptIdx) => (
                      <span
                        key={ptIdx}
                        className="font-mono text-xs px-2 py-0.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] text-[#8ab384]"
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
