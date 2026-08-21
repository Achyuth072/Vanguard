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
  X,
  Plus,
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
  const [newSkillInput, setNewSkillInput] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);

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

  function handleRemoveSkill(skillToRemove: string) {
    if (!tailoredResume.matchingSkills) return;
    const updatedSkills = tailoredResume.matchingSkills.filter((s) => s !== skillToRemove);
    const updated = {
      ...tailoredResume,
      matchingSkills: updatedSkills,
    };
    if (onUpdated) onUpdated(updated);
  }

  function handleAddSkill() {
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    const current = tailoredResume.matchingSkills || [];
    if (!current.includes(trimmed)) {
      const updated = {
        ...tailoredResume,
        matchingSkills: [...current, trimmed],
      };
      if (onUpdated) onUpdated(updated);
    }
    setNewSkillInput("");
    setIsAddingSkill(false);
  }

  const isDirty = markdownText !== (tailoredResume.markdownContent || "");

  return (
    <div className="space-y-4">
      {/* Action Toolbar & View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#15171d] p-2.5 rounded-[3px] border border-[#2a2e38]">
        <div className="flex rounded-[2px] bg-[#0d0e12] p-0.5 border border-[#2a2e38] text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveView("highlights")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]",
              activeView === "highlights"
                ? "bg-[#1f222a] text-[#f4f2ec] font-semibold border border-[#3d4352]"
                : "text-[#a6abbd] hover:text-[#f4f2ec]"
            )}
          >
            <List className="w-3.5 h-3.5 text-[#d4a745]" />
            <span>01 · Structured Highlights</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("markdown")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]",
              activeView === "markdown"
                ? "bg-[#1f222a] text-[#f4f2ec] font-semibold border border-[#3d4352]"
                : "text-[#a6abbd] hover:text-[#f4f2ec]"
            )}
          >
            <FileText className="w-3.5 h-3.5 text-[#d4a745]" />
            <span>02 · Markdown Editor</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#d4a745]" />}
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
                "font-bold text-xs rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]",
                isDirty
                  ? "bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12]"
                  : "bg-[#1f222a] text-[#a6abbd] border border-[#2a2e38] opacity-60"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#8ab384]" />
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
            className="text-xs font-mono rounded-[2px] border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] hover:bg-[#1f222a] hover:text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#8ab384]" />
                <span className="text-[#8ab384]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#a6abbd]" />
                <span>Copy Markdown</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs font-mono rounded-[2px] border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] hover:bg-[#1f222a] hover:text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
            title="Download .md file"
          >
            <Download className="w-3.5 h-3.5 text-[#d4a745]" />
            <span>Export PDF/MD</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeView === "highlights" ? (
        <div className="space-y-4">
          {/* Executive Summary Card */}
          <div className="p-4 rounded-[3px] bg-[#15171d] border border-[#2a2e38] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider text-[#d4a745]">
                <Sparkles className="w-3.5 h-3.5 text-[#d4a745]" />
                <span>01 · TAILORED EXECUTIVE SUMMARY</span>
              </div>
              <span className="text-[11px] font-mono text-[#a6abbd] tabular-nums">
                {tailoredResume.summary?.length || 0} characters
              </span>
            </div>
            <p className="text-sm text-[#f4f2ec] leading-relaxed font-sans bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
              {tailoredResume.summary}
            </p>
          </div>

          {/* Matching Skills */}
          <div className="p-4 rounded-[3px] bg-[#15171d] border border-[#2a2e38] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-bold tracking-wider text-[#8ab384] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#8ab384]" />
                <span>02 · PRIORITIZED MATCHING SKILLS</span>
                <span className="text-[11px] text-[#a6abbd] font-normal">
                  ({tailoredResume.matchingSkills?.length || 0})
                </span>
              </div>

              {!isAddingSkill ? (
                <button
                  type="button"
                  onClick={() => setIsAddingSkill(true)}
                  className="text-xs font-mono text-[#d4a745] hover:text-[#e8bd59] flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Skill</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkill();
                      }
                      if (e.key === "Escape") {
                        setIsAddingSkill(false);
                      }
                    }}
                    placeholder="Skill name..."
                    autoFocus
                    className="h-7 px-2 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddSkill}
                    className="h-7 px-2 text-xs font-bold bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px]"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingSkill(false)}
                    className="h-7 px-1.5 text-xs text-[#a6abbd] hover:text-[#f4f2ec]"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tailoredResume.matchingSkills && tailoredResume.matchingSkills.length > 0 ? (
                tailoredResume.matchingSkills.map((skill, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] text-[#f4f2ec] px-2.5 py-1 text-xs font-mono font-medium hover:border-[#3d4352] transition-colors"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-[#a6abbd] hover:text-[#c4634e] transition-colors focus-visible:outline-1 focus-visible:outline-[#d4a745]"
                      title={`Remove ${skill}`}
                      aria-label={`Remove skill ${skill}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-xs text-[#a6abbd] font-mono">No matching skills added.</span>
              )}
            </div>
          </div>

          {/* Selected Projects */}
          <div className="p-4 rounded-[3px] bg-[#15171d] border border-[#2a2e38] space-y-3">
            <div className="text-xs font-mono font-bold tracking-wider text-[#d4a745] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#d4a745]" />
              <span>03 · SELECTED MASTER PROJECTS ({tailoredResume.selectedProjects?.length || 0})</span>
            </div>

            <div className="space-y-3">
              {tailoredResume.selectedProjects?.map((proj) => (
                <div
                  key={proj.id}
                  className="p-3.5 rounded-[3px] bg-[#0d0e12] border border-[#2a2e38] space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#f4f2ec]">
                      {proj.title}
                    </h4>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#d4a745]">
                      ID: {proj.id}
                    </span>
                  </div>

                  <div className="text-sm text-[#f4f2ec] leading-relaxed bg-[#15171d] p-3 rounded-[2px] border border-[#2a2e38]">
                    <span className="font-semibold text-[#d4a745] font-mono text-xs block mb-1">
                      AI RELEVANCE RATIONALE:
                    </span>
                    <span className="text-xs text-[#f4f2ec] leading-relaxed font-sans">
                      {proj.relevanceRationale}
                    </span>
                  </div>

                  {proj.bulletPoints && proj.bulletPoints.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-[#f4f2ec] space-y-1.5 pl-1">
                      {proj.bulletPoints.map((bp, bpIdx) => (
                        <li key={bpIdx} className="leading-relaxed text-[#f4f2ec]">
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
            <div className="p-4 rounded-[3px] bg-[#15171d] border border-[#2a2e38] space-y-3">
              <div className="text-xs font-mono font-bold tracking-wider text-[#a6abbd] flex items-center gap-1.5">
                <List className="w-3.5 h-3.5 text-[#d4a745]" />
                <span>04 · TARGETED EXPERIENCE HIGHLIGHTS</span>
              </div>

              <div className="space-y-2.5">
                {tailoredResume.experienceHighlights.map((exp, idx) => (
                  <div key={idx} className="p-3.5 rounded-[3px] bg-[#0d0e12] border border-[#2a2e38] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#f4f2ec]">
                      <span className="text-sm font-semibold text-[#f4f2ec]">{exp.company}</span>
                      <span className="text-[#a6abbd] font-mono text-xs">{exp.role}</span>
                    </div>
                    {exp.bulletPoints && exp.bulletPoints.length > 0 && (
                      <ul className="list-disc list-inside text-xs text-[#f4f2ec] space-y-1.5 pl-1">
                        {exp.bulletPoints.map((bp, bpIdx) => (
                          <li key={bpIdx} className="leading-relaxed text-[#f4f2ec]">
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
          <div className="flex items-center justify-between text-xs text-[#a6abbd]">
            <span className="font-mono">Direct Markdown Editor (Live-editable text)</span>
            <span className="font-mono text-xs text-[#a6abbd] tabular-nums">
              {markdownText.length} characters • {markdownText.split("\n").length} lines
            </span>
          </div>

          <div className="relative">
            <Textarea
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              rows={18}
              className="font-mono text-xs leading-relaxed resize-y min-h-[380px] bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] placeholder:text-[#a6abbd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
              placeholder="# Resume Title..."
            />
          </div>

          {isDirty && (
            <div className="flex items-center justify-between p-3 rounded-[3px] bg-[#15171d] border border-[#d4a745]/60 text-[#f4f2ec] text-xs">
              <span className="flex items-center gap-1.5 font-mono text-[#d4a745]">
                <AlertCircle className="w-4 h-4 text-[#d4a745] shrink-0" />
                You have unsaved changes to this Markdown resume.
              </span>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] font-bold text-xs rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-[#d4a745]"
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
