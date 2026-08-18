"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCandidateProfile, updateCandidateProfile } from "@/app/actions/candidate";
import ProfileDrawer from "@/app/components/ProfileDrawer";
import ScoringFeedbackLoopSettings from "@/app/components/ScoringFeedbackLoopSettings";
import type { CandidateProfile } from "@/types/candidate";

export default function SettingsPage() {
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
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Back Button Row */}
        <div>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm font-medium group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Header with Master Facts Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-900">
          <div>
            <h1 className="text-3xl font-bold mb-1 tracking-tight">Candidate Settings</h1>
            <p className="text-neutral-500 text-sm">
              Manage your verified facts repository, raw resume context, and data backups.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-950/70 border border-purple-800 hover:bg-purple-900 text-purple-300 text-xs font-bold transition-all shadow-sm shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit Full Master Profile</span>
          </button>
        </div>

        {/* Master Facts Summary Card */}
        {profile && (
          <div className="bg-[#111] p-5 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Active Master Facts Summary
              </h2>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
              >
                Manage &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-[#161616] p-3 rounded-lg border border-neutral-800/80">
                <div className="text-[10px] text-neutral-500 uppercase font-semibold">Target Role</div>
                <div className="text-xs font-bold text-neutral-200 truncate">{profile.targetRole || "Not set"}</div>
              </div>

              <div className="bg-[#161616] p-3 rounded-lg border border-neutral-800/80">
                <div className="text-[10px] text-neutral-500 uppercase font-semibold">Master Projects</div>
                <div className="text-xs font-bold text-neutral-200">{profile.projects.length} recorded</div>
              </div>

              <div className="bg-[#161616] p-3 rounded-lg border border-neutral-800/80">
                <div className="text-[10px] text-neutral-500 uppercase font-semibold">Skills Catalog</div>
                <div className="text-xs font-bold text-neutral-200">{profile.skills.length} skills</div>
              </div>

              <div className="bg-[#161616] p-3 rounded-lg border border-neutral-800/80">
                <div className="text-[10px] text-neutral-500 uppercase font-semibold">Experience</div>
                <div className="text-xs font-bold text-neutral-200">{profile.experiences.length} roles</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Raw Resume Text Editor */}
        <div className="bg-[#111] p-6 rounded-xl border border-neutral-800 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Raw Resume / Bio Text</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Paste your unformatted bio or Markdown resume. Grounding engines use this for holistic context.
            </p>
          </div>

          <form onSubmit={handleSaveResume} className="space-y-4">
            <div>
              <textarea 
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={12}
                className="w-full bg-black border border-neutral-800 rounded-lg p-4 text-xs text-neutral-300 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none font-mono"
                placeholder="Paste your full resume content here..."
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-neutral-500">
                {resumeText.length} characters
              </span>
              <button 
                type="submit" 
                disabled={status === "Saving..."}
                className="bg-white text-black px-5 py-2 rounded-lg font-bold text-xs hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {status === "Idle" ? "Save Resume Context" : status}
              </button>
            </div>
          </form>
        </div>

        {/* Adaptive Scoring & Outcome Feedback Loop */}
        <ScoringFeedbackLoopSettings />

        {/* Data Export & Backup Utilities */}
        <div className="pt-2">
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight text-white">Data Sovereignty & Backups</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Export your local SQLite database for offline backups, archiving, and spreadsheet interoperability.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href="/api/export?format=json"
              download
              className="flex flex-col justify-between p-4 rounded-xl border border-neutral-800 bg-[#0D0D0D] hover:bg-neutral-900/60 hover:border-neutral-700 transition-all group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span className="font-semibold text-xs text-white">JSON Snapshot</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Full dump of Candidate, Job, FitScore, Application, and Event records.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-neutral-900 flex items-center justify-between text-[11px] font-semibold text-purple-400 group-hover:text-purple-300">
                <span>Download JSON</span>
                <svg className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </a>

            <a
              href="/api/export?format=applications"
              download
              className="flex flex-col justify-between p-4 rounded-xl border border-neutral-800 bg-[#0D0D0D] hover:bg-neutral-900/60 hover:border-neutral-700 transition-all group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span className="font-semibold text-xs text-white">Applications CSV</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Flattened spreadsheet of tracked jobs, submission dates, and tailored notes.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-neutral-900 flex items-center justify-between text-[11px] font-semibold text-blue-400 group-hover:text-blue-300">
                <span>Download CSV</span>
                <svg className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </a>

            <a
              href="/api/export?format=jobs"
              download
              className="flex flex-col justify-between p-4 rounded-xl border border-neutral-800 bg-[#0D0D0D] hover:bg-neutral-900/60 hover:border-neutral-700 transition-all group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="font-semibold text-xs text-white">All Jobs CSV</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Discovered opportunities, fit scores, strengths, gaps, and status.
                </p>
              </div>
              <div className="pt-3 mt-3 border-t border-neutral-900 flex items-center justify-between text-[11px] font-semibold text-emerald-400 group-hover:text-emerald-300">
                <span>Download CSV</span>
                <svg className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </a>
          </div>
        </div>

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