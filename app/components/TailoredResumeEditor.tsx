"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  List,
  Copy,
  Check,
  Download,
  Save,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { TailoredResume } from "@/types/tailoring";
import { updateTailoredResume } from "@/app/actions/tailoring";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TailoredResumeEditorProps {
  applicationId: string;
  jobTitle: string;
  company: string;
  tailoredResume: TailoredResume;
  onUpdated?: (updated: TailoredResume) => void;
}

export default function TailoredResumeEditor({
  applicationId,
  jobTitle,
  company,
  tailoredResume,
  onUpdated,
}: TailoredResumeEditorProps) {
  const [activeView, setActiveView] = useState<"highlights" | "markdown">("highlights");
  const [markdownText, setMarkdownText] = useState(tailoredResume.markdownContent || "");
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    setMarkdownText(tailoredResume.markdownContent || "");
  }, [tailoredResume.markdownContent]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdownText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }

  function handleDownload() {
    const slug = `${company.replace(/\s+/g, "-")}-${jobTitle.replace(/\s+/g, "-")}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    const filename = `${slug || "tailored"}-resume.md`;
    const blob = new Blob([markdownText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const res = await updateTailoredResume(applicationId, markdownText);
      if (res.success) {
        setSaveStatus("saved");
        if (onUpdated) onUpdated(res.tailoredResume);
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }

  const isDirty = markdownText !== (tailoredResume.markdownContent || "");

  return (
    <div className="space-y-4">
      {/* Action Toolbar & View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
        <div className="flex rounded-md bg-zinc-900 p-1 border border-zinc-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveView("highlights")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all",
              activeView === "highlights"
                ? "bg-zinc-800 text-zinc-100 font-semibold shadow-none"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <List className="w-3.5 h-3.5" />
            <span>Structured Highlights</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("markdown")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all",
              activeView === "markdown"
                ? "bg-zinc-800 text-zinc-100 font-semibold shadow-none"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Markdown Resume Editor</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeView === "markdown" && (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={cn(
                "font-semibold text-xs",
                isDirty
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "opacity-50"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Edits</span>
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs font-semibold"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy Markdown</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs font-semibold"
            title="Download .md file"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Download .md</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeView === "highlights" ? (
        <div className="space-y-4">
          {/* Executive Summary Card */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Tailored Executive Summary</span>
            </div>
            <p className="text-xs text-zinc-200 leading-relaxed font-sans">
              {tailoredResume.summary}
            </p>
          </div>

          {/* Matching Skills */}
          {tailoredResume.matchingSkills && tailoredResume.matchingSkills.length > 0 && (
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Prioritized Matching Skills</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tailoredResume.matchingSkills.map((skill, idx) => (
                  <Badge
                    key={idx}
                    variant="emerald"
                    className="font-mono text-xs"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Selected Projects */}
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Selected Master Projects ({tailoredResume.selectedProjects.length})</span>
            </div>

            <div className="space-y-3">
              {tailoredResume.selectedProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-100">
                      {proj.title}
                    </h4>
                    <Badge variant="violet" className="font-mono text-[10px]">
                      ID: {proj.id}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-zinc-400 bg-zinc-950 p-2.5 rounded border border-zinc-800">
                    <span className="font-semibold text-zinc-300">Why Selected: </span>
                    <span>{proj.relevanceRationale}</span>
                  </div>

                  {proj.bulletPoints && proj.bulletPoints.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1 pl-1">
                      {proj.bulletPoints.map((bp, bpIdx) => (
                        <li key={bpIdx} className="leading-relaxed">
                          {bp}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Experience Highlights */}
          {tailoredResume.experienceHighlights && tailoredResume.experienceHighlights.length > 0 && (
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <List className="w-3.5 h-3.5 text-blue-400" />
                <span>Targeted Experience Highlights</span>
              </div>

              <div className="space-y-2.5">
                {tailoredResume.experienceHighlights.map((exp, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                      <span>{exp.company}</span>
                      <span className="text-zinc-400 font-normal">{exp.role}</span>
                    </div>
                    {exp.bulletPoints && exp.bulletPoints.length > 0 && (
                      <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1 pl-1">
                        {exp.bulletPoints.map((bp, bpIdx) => (
                          <li key={bpIdx} className="leading-relaxed">
                            {bp}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Markdown Editor View */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Direct Markdown Editor (Live-editable text)</span>
            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
              {markdownText.length} characters • {markdownText.split("\n").length} lines
            </span>
          </div>

          <div className="relative">
            <Textarea
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              rows={18}
              className="font-mono text-xs leading-relaxed resize-y min-h-[380px]"
              placeholder="# Resume Title..."
            />
          </div>

          {isDirty && (
            <div className="flex items-center justify-between p-3 rounded-md bg-amber-950/40 border border-amber-800 text-amber-300 text-xs">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                You have unsaved changes to this Markdown resume.
              </span>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
