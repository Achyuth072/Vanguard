"use client";

import { useState, useEffect } from "react";
import type { TailoredResume } from "@/types/tailoring";
import { updateTailoredResume } from "@/app/actions/tailoring";

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
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#111111] p-2.5 rounded-xl border border-neutral-800">
        <div className="flex rounded-lg bg-[#181818] p-1 border border-neutral-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveView("highlights")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeView === "highlights"
                ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Structured Highlights</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("markdown")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              activeView === "markdown"
                ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Markdown Resume Editor</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeView === "markdown" && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isDirty
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
                  : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span>Save Edits</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-[#161616] hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all text-xs font-semibold"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>Copy Markdown</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-[#161616] hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all text-xs font-semibold"
            title="Download .md file"
          >
            <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download .md</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeView === "highlights" ? (
        <div className="space-y-4">
          {/* Executive Summary Card */}
          <div className="p-4 rounded-xl bg-[#0D0D0D] border border-neutral-800 space-y-2">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Tailored Executive Summary</span>
            </div>
            <p className="text-xs text-neutral-200 leading-relaxed font-sans">
              {tailoredResume.summary}
            </p>
          </div>

          {/* Matching Skills */}
          {tailoredResume.matchingSkills && tailoredResume.matchingSkills.length > 0 && (
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-neutral-800 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Prioritized Matching Skills</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tailoredResume.matchingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 text-xs font-mono"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Selected Projects */}
          <div className="p-4 rounded-xl bg-[#0D0D0D] border border-neutral-800 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Selected Master Projects ({tailoredResume.selectedProjects.length})</span>
            </div>

            <div className="space-y-3">
              {tailoredResume.selectedProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-3.5 rounded-lg bg-[#141414] border border-neutral-800/90 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white tracking-tight">
                      {proj.title}
                    </h4>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-900">
                      ID: {proj.id}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-400 bg-[#0c0c0c] p-2.5 rounded border border-neutral-900">
                    <span className="font-semibold text-neutral-300">Why Selected: </span>
                    <span>{proj.relevanceRationale}</span>
                  </div>

                  {proj.bulletPoints && proj.bulletPoints.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-neutral-300 space-y-1 pl-1">
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
            <div className="p-4 rounded-xl bg-[#0D0D0D] border border-neutral-800 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Targeted Experience Highlights</span>
              </div>

              <div className="space-y-2.5">
                {tailoredResume.experienceHighlights.map((exp, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-[#141414] border border-neutral-800/90 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                      <span>{exp.company}</span>
                      <span className="text-neutral-400 font-normal">{exp.role}</span>
                    </div>
                    {exp.bulletPoints && exp.bulletPoints.length > 0 && (
                      <ul className="list-disc list-inside text-xs text-neutral-300 space-y-1 pl-1">
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
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Direct Markdown Editor (Live-editable text)</span>
            <span className="font-mono text-[11px] text-neutral-500">
              {markdownText.length} characters • {markdownText.split("\n").length} lines
            </span>
          </div>

          <div className="relative">
            <textarea
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              rows={18}
              className="w-full bg-[#0D0D0D] border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none leading-relaxed resize-y"
              placeholder="# Resume Title..."
            />
          </div>

          {isDirty && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-950/30 border border-amber-900/60 text-amber-300 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                You have unsaved changes to this Markdown resume.
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded text-xs transition-colors"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
