"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCandidateProfile, updateCandidateProfile } from "@/app/actions/candidate";
import ProfileDrawer from "@/app/components/ProfileDrawer";
import ScoringFeedbackLoopSettings from "@/app/components/ScoringFeedbackLoopSettings";
import FeedSourcesManager from "@/components/settings/FeedSourcesManager";
import type { CandidateProfile } from "@/types/candidate";
import {
  Rss,
  User,
  Sliders,
  Database,
  ArrowLeft,
  Sparkles,
  ExternalLink,
} from "lucide-react";

type SettingsTab = "feeds" | "profile" | "scoring" | "export";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("feeds");
  const [status, setStatus] = useState("Idle");
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCandidateProfile("candidate-default");
        setProfile(data);
        setResumeText(data.resumeText || "");
      } catch (e) {
        console.error("Failed to load profile", e);
      }
    }
    load();
  }, []);

  async function handleSaveResume(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Saving...");
    try {
      if (profile) {
        const updated = await updateCandidateProfile({
          ...profile,
          resumeText,
        });
        setProfile(updated.profile);
      } else {
        const updated = await updateCandidateProfile({
          id: "candidate-default",
          resumeText,
        });
        setProfile(updated.profile);
      }
      setStatus("Saved!");
      setTimeout(() => setStatus("Idle"), 2000);
    } catch (err) {
      console.error(err);
      setStatus("Save failed");
      setTimeout(() => setStatus("Idle"), 2000);
    }
  }

  return (
    <main className="min-h-screen bg-[#0d0e12] text-[#f4f2ec] p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back Button & Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2a2e38]">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#15171d] hover:bg-[#1f222a] hover:border-[#3d4352] text-[#a6abbd] hover:text-[#f4f2ec] transition-colors text-xs font-mono group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Cockpit Dashboard</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-[2px] bg-[#d4a745]/15 border border-[#d4a745]/40 text-[#d4a745] hover:bg-[#d4a745]/25 text-xs font-mono transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discovery Staging Buffer &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Page Title & Mission Brief */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f4f2ec]">
              System &amp; Candidate Settings
            </h1>
            <p className="text-xs font-mono text-[#a6abbd] mt-1">
              Configure deterministic ATS job feeds, master facts profile, adaptive AI scoring weights, and backups.
            </p>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div
          role="tablist"
          aria-label="Settings Sections"
          className="grid grid-cols-2 sm:grid-cols-4 bg-[#15171d] border border-[#2a2e38] rounded-[3px] divide-x divide-[#2a2e38] font-mono text-xs select-none"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "feeds"}
            onClick={() => setActiveTab("feeds")}
            className={`p-3 text-left transition-colors relative flex items-center gap-2 ${
              activeTab === "feeds"
                ? "bg-[#1f222a] text-[#f4f2ec] font-bold"
                : "text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#191b22]"
            }`}
          >
            {activeTab === "feeds" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
            )}
            <Rss className="w-3.5 h-3.5 text-[#d4a745]" />
            <span>01 · Job Feeds</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
            className={`p-3 text-left transition-colors relative flex items-center gap-2 ${
              activeTab === "profile"
                ? "bg-[#1f222a] text-[#f4f2ec] font-bold"
                : "text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#191b22]"
            }`}
          >
            {activeTab === "profile" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
            )}
            <User className="w-3.5 h-3.5 text-[#8ab384]" />
            <span>02 · Master Profile</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "scoring"}
            onClick={() => setActiveTab("scoring")}
            className={`p-3 text-left transition-colors relative flex items-center gap-2 ${
              activeTab === "scoring"
                ? "bg-[#1f222a] text-[#f4f2ec] font-bold"
                : "text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#191b22]"
            }`}
          >
            {activeTab === "scoring" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
            )}
            <Sliders className="w-3.5 h-3.5 text-[#a6abbd]" />
            <span>03 · Adaptive Scoring</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "export"}
            onClick={() => setActiveTab("export")}
            className={`p-3 text-left transition-colors relative flex items-center gap-2 ${
              activeTab === "export"
                ? "bg-[#1f222a] text-[#f4f2ec] font-bold"
                : "text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#191b22]"
            }`}
          >
            {activeTab === "export" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#d4a745]" />
            )}
            <Database className="w-3.5 h-3.5 text-[#a6abbd]" />
            <span>04 · Data Sovereignty</span>
          </button>
        </div>

        {/* Tab 1: Feed Sources & Ingestion Management */}
        {activeTab === "feeds" && (
          <div className="space-y-6 animate-in fade-in">
            <FeedSourcesManager />
          </div>
        )}

        {/* Tab 2: Candidate Master Profile & Resume Context */}
        {activeTab === "profile" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Master Facts Summary Card */}
            {profile && (
              <div className="bg-[#15171d] p-5 rounded-[3px] border border-[#2a2e38] space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#f4f2ec] tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#8ab384]"></span>
                    Active Master Facts Repository
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    className="text-xs text-[#d4a745] hover:underline font-mono font-semibold"
                  >
                    Manage Facts &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 font-mono">
                  <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
                    <div className="text-[10px] text-[#a6abbd] uppercase font-semibold">Target Role</div>
                    <div className="text-xs font-bold text-[#f4f2ec] truncate mt-0.5">
                      {profile.targetRole || "Not set"}
                    </div>
                  </div>

                  <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
                    <div className="text-[10px] text-[#a6abbd] uppercase font-semibold">Master Projects</div>
                    <div className="text-xs font-bold text-[#f4f2ec] mt-0.5">{profile.projects.length} recorded</div>
                  </div>

                  <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
                    <div className="text-[10px] text-[#a6abbd] uppercase font-semibold">Skills Catalog</div>
                    <div className="text-xs font-bold text-[#f4f2ec] mt-0.5">{profile.skills.length} skills</div>
                  </div>

                  <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
                    <div className="text-[10px] text-[#a6abbd] uppercase font-semibold">Experience</div>
                    <div className="text-xs font-bold text-[#f4f2ec] mt-0.5">{profile.experiences.length} roles</div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    className="px-3.5 py-1.5 bg-[#1f222a] hover:bg-[#2a2e38] border border-[#2a2e38] text-[#f4f2ec] text-xs font-mono rounded-[2px] transition-colors flex items-center gap-1.5"
                  >
                    <span>Edit Full Master Profile Drawer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Raw Resume Text Editor */}
            <div className="bg-[#15171d] p-6 rounded-[3px] border border-[#2a2e38] space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[#f4f2ec] tracking-tight">Raw Resume / Bio Text</h2>
                <p className="text-xs text-[#a6abbd] mt-0.5 font-mono">
                  Paste your unformatted bio or Markdown resume. Grounding engines use this for holistic context.
                </p>
              </div>

              <form onSubmit={handleSaveResume} className="space-y-4">
                <div>
                  <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    rows={12}
                    className="w-full bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] p-4 text-xs text-[#f4f2ec] focus:border-[#d4a745] outline-none resize-none font-mono"
                    placeholder="Paste your full resume content here..."
                  />
                </div>

                <div className="flex items-center justify-between font-mono">
                  <span className="text-[11px] text-[#a6abbd]">
                    {resumeText.length.toLocaleString()} characters
                  </span>
                  <button
                    type="submit"
                    disabled={status === "Saving..."}
                    className="bg-[#d4a745] text-[#0d0e12] px-5 py-2 rounded-[2px] font-bold text-xs hover:bg-[#e8bd59] transition-colors cursor-pointer disabled:opacity-50 uppercase tracking-wider"
                  >
                    {status === "Idle" ? "Save Resume Context" : status}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab 3: Adaptive Scoring Settings */}
        {activeTab === "scoring" && (
          <div className="space-y-6 animate-in fade-in">
            <ScoringFeedbackLoopSettings />
          </div>
        )}

        {/* Tab 4: Data Sovereignty & Backups */}
        {activeTab === "export" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-5">
              <div className="mb-4">
                <h2 className="text-lg font-bold tracking-tight text-[#f4f2ec]">Data Sovereignty &amp; Backups</h2>
                <p className="text-xs text-[#a6abbd] mt-1 font-mono">
                  Export your local SQLite database for offline backups, archiving, and spreadsheet interoperability.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                <a
                  href="/api/export?format=json"
                  download
                  className="flex flex-col justify-between p-4 rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] hover:bg-[#1f222a] hover:border-[#3d4352] transition-all group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#d4a745]"></span>
                      <span className="font-semibold text-xs text-[#f4f2ec]">JSON Snapshot</span>
                    </div>
                    <p className="text-[11px] text-[#a6abbd] leading-relaxed">
                      Full dump of Candidate, Job, FitScore, Application, and Event records.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#2a2e38] flex items-center justify-between text-[11px] font-semibold text-[#d4a745] group-hover:underline">
                    <span>Download JSON</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </a>

                <a
                  href="/api/export?format=applications"
                  download
                  className="flex flex-col justify-between p-4 rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] hover:bg-[#1f222a] hover:border-[#3d4352] transition-all group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#8ab384]"></span>
                      <span className="font-semibold text-xs text-[#f4f2ec]">Applications CSV</span>
                    </div>
                    <p className="text-[11px] text-[#a6abbd] leading-relaxed">
                      Flattened spreadsheet of tracked jobs, submission dates, and tailored notes.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#2a2e38] flex items-center justify-between text-[11px] font-semibold text-[#8ab384] group-hover:underline">
                    <span>Download CSV</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </a>

                <a
                  href="/api/export?format=jobs"
                  download
                  className="flex flex-col justify-between p-4 rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] hover:bg-[#1f222a] hover:border-[#3d4352] transition-all group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#8ab384]"></span>
                      <span className="font-semibold text-xs text-[#f4f2ec]">All Jobs CSV</span>
                    </div>
                    <p className="text-[11px] text-[#a6abbd] leading-relaxed">
                      Discovered opportunities, fit scores, strengths, gaps, and status.
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#2a2e38] flex items-center justify-between text-[11px] font-semibold text-[#8ab384] group-hover:underline">
                    <span>Download CSV</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Profile Drawer Modal */}
        <ProfileDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            setResumeText(updated.resumeText || "");
          }}
        />
      </div>
    </main>
  );
}