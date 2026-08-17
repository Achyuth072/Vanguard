"use client";
import { saveResumeContext } from "./actions";
import { useState } from "react";
import Link from "next/link"; // 1. Import Link

export default function SettingsPage() {
  const [status, setStatus] = useState("Idle");

  async function handleSave(formData: FormData) {
    setStatus("Saving...");
    await saveResumeContext(formData);
    setStatus("Context Updated!");
    setTimeout(() => setStatus("Idle"), 2000);
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        
        {/* 2. NEW: Back Button Row */}
        <div className="mb-8">
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

        <h1 className="text-3xl font-bold mb-2 tracking-tight">Agent Context</h1>
        <p className="text-neutral-500 mb-8">
          Paste your resume text here. The AI Agent uses this to personalize your emails.
        </p>
        
        <div className="bg-[#111] p-6 rounded-xl border border-neutral-800">
          <form action={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Resume / Bio Text
              </label>
              <textarea 
                name="resumeText"
                rows={15}
                className="w-full bg-black border border-neutral-800 rounded-lg p-4 text-sm text-neutral-300 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none font-mono"
                placeholder="Paste your full resume content here..."
                required
              />
            </div>
            
            <div className="flex justify-end">
              <button 
                type="submit" 
                className="bg-white text-black px-6 py-2.5 rounded-md font-bold text-sm hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                {status === "Idle" ? "Save Context" : status}
              </button>
            </div>
          </form>
        </div>

        {/* Data Export & Backup Utilities */}
        <div className="mt-10 pt-8 border-t border-neutral-900">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-white">Data Sovereignty & Backups</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Export your local database for offline backups, archiving, and spreadsheet interoperability.
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
      </div>
    </main>
  );
}