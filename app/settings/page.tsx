"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getCandidateProfile, updateCandidateProfile } from "@/app/actions/candidate";
import ProfileDrawer from "@/app/components/ProfileDrawer";
import ScoringFeedbackLoopSettings from "@/app/components/ScoringFeedbackLoopSettings";
import FeedSourcesManager from "@/components/settings/FeedSourcesManager";
import VanguardIcon from "@/app/components/VanguardIcon";
import type { CandidateProfile } from "@/types/candidate";
import {
  Rss,
  User,
  Sliders,
  Database,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Layers,
} from "lucide-react";

type SettingsTab = "feeds" | "profile" | "scoring" | "export";

interface TabDef {
  id: SettingsTab;
  code: string;
  label: string;
  subtitle: string;
  icon: typeof Rss;
  accentColor: string;
}

const TABS: TabDef[] = [
  {
    id: "feeds",
    code: "01",
    label: "Job Feeds & ATS",
    subtitle: "Deterministic ATS Sources",
    icon: Rss,
    accentColor: "#d4a745",
  },
  {
    id: "profile",
    code: "02",
    label: "Master Facts & Bio",
    subtitle: "Candidate Grounding Repo",
    icon: User,
    accentColor: "#8ab384",
  },
  {
    id: "scoring",
    code: "03",
    label: "Adaptive Scoring",
    subtitle: "Bayesian Feedback Weights",
    icon: Sliders,
    accentColor: "#d4a745",
  },
  {
    id: "export",
    code: "04",
    label: "Data Sovereignty",
    subtitle: "Local SQLite & Backups",
    icon: Database,
    accentColor: "#a6abbd",
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("feeds");
  const [status, setStatus] = useState("Idle");
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const mobileTabRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileTabRailRef.current) return;
    const activeEl = mobileTabRailRef.current.querySelector<HTMLElement>('[aria-selected="true"]');
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeTab]);

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
    <main className="h-screen bg-[#0d0e12] text-[#f4f2ec] p-3 sm:p-4 lg:p-5 font-sans overflow-hidden flex flex-col">
      <div className="w-full max-w-[1800px] mx-auto flex flex-col flex-1 min-h-0 space-y-3">
        {/* HEADER: Minimalist & Clean Tactical Command Header matching Cockpit */}
        <header className="shrink-0 flex items-center justify-between gap-3 pb-2.5 border-b border-[#2a2e38]">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5 mb-0.5">
              <VanguardIcon size={24} className="shrink-0" />
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[#f4f2ec] font-sans">
                Vanguard
              </h1>
              <span className="px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-mono font-bold tracking-widest bg-[#1f222a] border border-[#2a2e38] text-[#a6abbd]">
                SETTINGS
              </span>
            </div>
            <p className="hidden sm:flex text-[#a6abbd] text-xs items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#8ab384] animate-pulse" />
              Operational Configuration &amp; Telemetry Calibration
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Back to Cockpit"
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 min-h-[36px] min-w-[36px] rounded-[2px] border border-[#2a2e38] bg-[#15171d] hover:bg-[#1f222a] hover:border-[#3d4352] text-[#a6abbd] hover:text-[#f4f2ec] transition-colors text-xs font-mono font-semibold group focus-visible:outline-2 focus-visible:outline-[#d4a745]"
            >
              <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5 group-hover:-translate-x-0.5 transition-transform text-[#d4a745] shrink-0" />
              <span className="sr-only sm:not-sr-only sm:inline">Back to Cockpit</span>
            </Link>
          </div>
        </header>

        {/* Mobile Horizontal Tab Rail (<md) */}
        <div
          ref={mobileTabRailRef}
          role="tablist"
          aria-label="Settings Sections"
          className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar p-1.5 bg-[#15171d] border border-[#2a2e38] rounded-[3px] select-none text-xs font-mono shrink-0"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 min-h-10 px-3 py-1.5 rounded-[2px] flex items-center gap-2 transition-colors border focus-visible:outline-2 focus-visible:outline-[#d4a745] ${
                  isActive
                    ? "bg-[#1f222a] text-[#f4f2ec] border-[#d4a745] font-bold"
                    : "bg-[#0d0e12] text-[#a6abbd] border-[#2a2e38] hover:text-[#f4f2ec]"
                }`}
              >
                <Icon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: isActive ? tab.accentColor : "#a6abbd" }}
                />
                <span className="whitespace-nowrap font-mono text-xs">{tab.code} · {tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2-COLUMN TACTICAL COCKPIT LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[300px_1fr] gap-4 items-stretch flex-1 min-h-0">
          {/* LEFT SIDEBAR: Navigation Rail & System Telemetry (Desktop only) */}
          <aside className="hidden md:flex space-y-3 shrink-0 flex-col min-h-0 overflow-y-auto pr-1">
            {/* Navigation Tabs */}
            <div
              role="tablist"
              aria-label="Settings Sections"
              className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-2 space-y-1 font-mono text-xs select-none"
            >
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#c5c9d6] border-b border-[#2a2e38] mb-1 flex items-center justify-between">
                <span>Config Directory</span>
                <span className="text-[11px] text-[#8ab384] font-bold">ONLINE</span>
              </div>

              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full p-2.5 rounded-[2px] text-left transition-all relative flex items-start gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#d4a745] ${
                      isActive
                        ? "bg-[#1f222a] text-[#f4f2ec] border-l-2 border-l-[#d4a745]"
                        : "text-[#c5c9d6] hover:text-[#f4f2ec] hover:bg-[#191b22] border-l-2 border-l-transparent"
                    }`}
                  >
                    <Icon
                      className="w-4 h-4 mt-0.5 shrink-0"
                      style={{ color: isActive ? tab.accentColor : "#c5c9d6" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold tracking-tight truncate text-xs sm:text-sm">
                          {tab.code} · {tab.label}
                        </span>
                      </div>
                      <div className="text-xs text-[#c5c9d6] truncate mt-0.5">
                        {tab.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick System Telemetry Card */}
            <div className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-3.5 space-y-3 font-mono text-xs hidden md:block">
              <div className="flex items-center justify-between pb-2 border-b border-[#2a2e38]">
                <div className="flex items-center gap-1.5 text-[#f4f2ec] font-bold text-xs">
                  <Cpu className="w-3.5 h-3.5 text-[#d4a745]" />
                  <span>Node Telemetry</span>
                </div>
                <span className="text-xs text-[#8ab384] font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified</span>
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#c5c9d6]">Database:</span>
                  <span className="text-[#f4f2ec] font-bold">pulse.db (SQLite)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#c5c9d6]">Inference Cost:</span>
                  <span className="text-[#8ab384] font-bold">₹0/mo Local Cascade</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#c5c9d6]">Target Role:</span>
                  <span className="text-[#f4f2ec] font-medium truncate max-w-[140px]">
                    {profile?.targetRole || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#c5c9d6]">Master Skills:</span>
                  <span className="text-[#d4a745] font-bold">
                    {profile?.skills.length ?? 0} Cataloged
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT WORKSPACE: Full-Width Active Configuration Panel with smooth internal scroll */}
          <section className="w-full min-w-0 flex-1 min-h-0 overflow-y-auto pr-1">
            {/* Tab 1: Feed Sources & Ingestion Management */}
            <div
              role="tabpanel"
              id="panel-feeds"
              aria-labelledby="tab-feeds"
              className={`space-y-4 w-full min-w-0 ${activeTab === "feeds" ? "animate-in fade-in" : "hidden"}`}
            >
              <FeedSourcesManager />
            </div>

            {/* Tab 2: Candidate Master Profile & Resume Context */}
            <div
              role="tabpanel"
              id="panel-profile"
              aria-labelledby="tab-profile"
              className={`space-y-4 w-full min-w-0 ${activeTab === "profile" ? "animate-in fade-in" : "hidden"}`}
            >
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start w-full min-w-0">
                {/* Master Facts Summary (Left on XL) */}
                {profile && (
                  <div className="xl:col-span-5 bg-[#15171d] p-5 sm:p-6 rounded-[3px] border border-[#2a2e38] space-y-4 min-w-0">
                    <div className="flex items-center justify-between pb-3 border-b border-[#2a2e38]">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#8ab384]" />
                        <h2 className="text-sm sm:text-base font-bold text-[#f4f2ec] tracking-tight">
                          Master Facts Repository
                        </h2>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 font-mono">
                      <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
                        <div className="text-xs text-[#c5c9d6] uppercase font-semibold">Target Role</div>
                        <div className="text-xs sm:text-sm font-bold text-[#f4f2ec] truncate mt-0.5">
                          {profile.targetRole || "Not configured"}
                        </div>
                      </div>

                      <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
                        <div className="text-xs text-[#c5c9d6] uppercase font-semibold">Master Projects</div>
                        <div className="text-xs sm:text-sm font-bold text-[#f4f2ec] mt-0.5">{profile.projects.length} verified</div>
                      </div>

                      <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
                        <div className="text-xs text-[#c5c9d6] uppercase font-semibold">Skills Catalog</div>
                        <div className="text-xs sm:text-sm font-bold text-[#f4f2ec] mt-0.5">{profile.skills.length} skills</div>
                      </div>

                      <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
                        <div className="text-xs text-[#c5c9d6] uppercase font-semibold">Experience</div>
                        <div className="text-xs sm:text-sm font-bold text-[#f4f2ec] mt-0.5">{profile.experiences.length} roles</div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsDrawerOpen(true)}
                        className="w-full py-2.5 bg-[#1f222a] hover:bg-[#2a2e38] border border-[#2a2e38] hover:border-[#3d4352] text-[#f4f2ec] text-xs font-mono rounded-[2px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-bold focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                      >
                        <span>Edit Master Profile &rarr;</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Raw Resume Text Editor (Right on XL) */}
                <div className={`${profile ? "xl:col-span-7" : "xl:col-span-12"} bg-[#15171d] p-5 sm:p-6 rounded-[3px] border border-[#2a2e38] space-y-4 min-w-0`}>
                  <div className="flex items-center justify-between pb-3 border-b border-[#2a2e38]">
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-[#f4f2ec] tracking-tight">Raw Resume / Bio Text</h2>
                      <p className="text-xs text-[#c5c9d6] mt-0.5 font-mono">
                        Paste your Markdown bio or raw resume. Grounding engines use this for holistic synthesis.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[#c5c9d6]">
                      {resumeText.length.toLocaleString()} chars
                    </span>
                  </div>

                  <form onSubmit={handleSaveResume} className="space-y-4">
                    <div>
                      <label htmlFor="settings-raw-resume" className="sr-only">
                        Raw Resume and Bio Markdown
                      </label>
                      <textarea
                        id="settings-raw-resume"
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        rows={14}
                        className="w-full bg-[#0d0e12] border border-[#2a2e38] focus:border-[#d4a745] rounded-[2px] p-4 text-xs sm:text-sm text-[#f4f2ec] placeholder-[#797f94] outline-none resize-none font-mono leading-relaxed"
                        placeholder="Paste your full bio, resume, or master bullet points here..."
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 font-mono">
                      <button
                        type="submit"
                        disabled={status === "Saving..."}
                        className="bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] px-5 py-2.5 rounded-[2px] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                      >
                        {status === "Idle" ? "Save Resume Context" : status}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Tab 3: Adaptive Scoring Settings */}
            <div
              role="tabpanel"
              id="panel-scoring"
              aria-labelledby="tab-scoring"
              className={`space-y-4 w-full min-w-0 ${activeTab === "scoring" ? "animate-in fade-in" : "hidden"}`}
            >
              <ScoringFeedbackLoopSettings />
            </div>

            {/* Tab 4: Data Sovereignty & Backups */}
            <div
              role="tabpanel"
              id="panel-export"
              aria-labelledby="tab-export"
              className={`space-y-4 w-full min-w-0 ${activeTab === "export" ? "animate-in fade-in" : "hidden"}`}
            >
              <div className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-5 sm:p-6 space-y-5 w-full min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#2a2e38]">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#f4f2ec] flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#d4a745]" />
                      <span>Data Sovereignty &amp; Local Backups</span>
                    </h2>
                    <p className="text-xs text-[#c5c9d6] mt-1 font-mono">
                      Export your local SQLite database for offline backups, archiving, and spreadsheet interoperability.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#c5c9d6] font-semibold">
                    LOCAL-FIRST SQLITE
                  </span>
                </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                    <a
                      href="/api/export?format=json"
                      download
                      className="flex flex-col justify-between p-4 rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] hover:bg-[#1f222a] hover:border-[#3d4352] transition-all group focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#d4a745]"></span>
                          <span className="font-bold text-xs sm:text-sm text-[#f4f2ec]">JSON Snapshot</span>
                        </div>
                        <p className="text-xs text-[#c5c9d6] leading-relaxed">
                          Full structured dump of Candidate, Job, FitScore, Application, and Event records.
                        </p>
                      </div>
                      <div className="pt-3 mt-3 border-t border-[#2a2e38] flex items-center justify-between text-xs font-semibold text-[#d4a745] group-hover:underline">
                        <span>Download JSON</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </a>

                    <a
                      href="/api/export?format=applications"
                      download
                      className="flex flex-col justify-between p-4 rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] hover:bg-[#1f222a] hover:border-[#3d4352] transition-all group focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#8ab384]"></span>
                          <span className="font-bold text-xs sm:text-sm text-[#f4f2ec]">Applications CSV</span>
                        </div>
                        <p className="text-xs text-[#c5c9d6] leading-relaxed">
                          Flattened spreadsheet of tracked jobs, submission dates, and tailored notes.
                        </p>
                      </div>
                      <div className="pt-3 mt-3 border-t border-[#2a2e38] flex items-center justify-between text-xs font-semibold text-[#8ab384] group-hover:underline">
                        <span>Download CSV</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </a>

                    <a
                      href="/api/export?format=jobs"
                      download
                      className="flex flex-col justify-between p-4 rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] hover:bg-[#1f222a] hover:border-[#3d4352] transition-all group focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#8ab384]"></span>
                          <span className="font-bold text-xs sm:text-sm text-[#f4f2ec]">All Jobs CSV</span>
                        </div>
                        <p className="text-xs text-[#c5c9d6] leading-relaxed">
                          Discovered opportunities, fit scores, strengths, gaps, and status.
                        </p>
                      </div>
                      <div className="pt-3 mt-3 border-t border-[#2a2e38] flex items-center justify-between text-xs font-semibold text-[#8ab384] group-hover:underline">
                        <span>Download CSV</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                    </a>
                  </div>
                </div>
              </div>
          </section>
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