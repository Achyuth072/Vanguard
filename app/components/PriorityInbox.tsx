"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EnrichedJob } from "@/lib/data";
import JobCard from "./JobCard";
import ApplicationTracker from "./ApplicationTracker";
import IngestModal from "./IngestModal";
import ApplicationPreparationDrawer from "./ApplicationPreparationDrawer";

interface PriorityInboxProps {
  initialJobs: EnrichedJob[];
}

type TabType = "inbox" | "review" | "all" | "applications";

export default function PriorityInbox({ initialJobs }: PriorityInboxProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [selectedPrepJob, setSelectedPrepJob] = useState<EnrichedJob | null>(null);
  const [isPrepDrawerOpen, setIsPrepDrawerOpen] = useState(false);

  // Categorize jobs for tabs
  const inboxJobs = initialJobs.filter((job) => {
    const s = job.status.toUpperCase();
    if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
    const score = job.fitScore?.score;
    return score !== undefined && score !== null && score >= 80;
  });

  const reviewJobs = initialJobs.filter((job) => {
    const s = job.status.toUpperCase();
    if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
    const score = job.fitScore?.score;
    return score !== undefined && score !== null && score >= 60 && score < 80;
  });

  const applicationJobs = initialJobs.filter((job) => {
    const s = job.status.toUpperCase();
    return (
      s === "SHORTLISTED" ||
      s === "PREPARED" ||
      s === "APPLIED" ||
      s === "INTERVIEW" ||
      s === "INTERVIEWING" ||
      s === "OFFER" ||
      s === "REJECTED" ||
      job.application !== null
    );
  });

  const allJobs = initialJobs;

  // Filter jobs based on active tab and search query
  const getTabJobs = () => {
    let list: EnrichedJob[] = [];
    if (activeTab === "inbox") list = inboxJobs;
    else if (activeTab === "review") list = reviewJobs;
    else if (activeTab === "all") list = allJobs;
    else if (activeTab === "applications") list = applicationJobs;

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter((job) => {
      const titleMatch = job.title.toLowerCase().includes(query);
      const companyMatch = job.company.toLowerCase().includes(query);
      const locationMatch = job.location.toLowerCase().includes(query);
      const reasoningMatch = job.fitScore?.reasoning.toLowerCase().includes(query);
      return titleMatch || companyMatch || locationMatch || reasoningMatch;
    });
  };

  const displayedJobs = getTabJobs();

  function handleDataRefreshed() {
    router.refresh();
  }

  function handleOpenPreparation(job: EnrichedJob) {
    setSelectedPrepJob(job);
    setIsPrepDrawerOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Action Header / Search & Ingest Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0D0D0D] border border-neutral-900 rounded-xl p-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "inbox"
                ? "bg-emerald-950/70 border border-emerald-800 text-emerald-300 shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Priority Inbox</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-900/60 text-emerald-300 font-mono text-[10px]">
              {inboxJobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("review")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "review"
                ? "bg-amber-950/70 border border-amber-800 text-amber-300 shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Review</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-900/60 text-amber-300 font-mono text-[10px]">
              {reviewJobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("applications")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "applications"
                ? "bg-purple-950/70 border border-purple-800 text-purple-300 shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            <span>Applications</span>
            <span className="px-1.5 py-0.2 rounded-full bg-purple-900/60 text-purple-300 font-mono text-[10px]">
              {applicationJobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-neutral-800 border border-neutral-700 text-white shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent"
            }`}
          >
            <span>All Jobs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-neutral-900 text-neutral-400 font-mono text-[10px]">
              {allJobs.length}
            </span>
          </button>
        </div>

        {/* Search & Ingest Action Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, title..."
              className="bg-[#141414] border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none w-48 sm:w-56 transition-all"
            />
            <svg className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button
            onClick={() => setIsIngestOpen(true)}
            className="flex items-center gap-1.5 bg-white text-black hover:bg-neutral-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Ingest Job</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "applications" ? (
        <ApplicationTracker
          jobs={initialJobs}
          onStatusUpdated={handleDataRefreshed}
          onOpenPreparation={handleOpenPreparation}
        />
      ) : (
        <div className="space-y-4">
          {displayedJobs.length === 0 ? (
            <div className="bg-[#0A0A0A] border border-neutral-900 rounded-xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mx-auto text-neutral-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">No jobs found</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {activeTab === "inbox"
                  ? "No high-priority jobs (Score ≥ 80) in the inbox yet. Ingest job descriptions or URLs to evaluate."
                  : activeTab === "review"
                  ? "No jobs currently in the 60–79 review bracket."
                  : "No job postings matching the current filter."}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsIngestOpen(true)}
                  className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-all"
                >
                  Ingest New Job
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {displayedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onStatusUpdated={handleDataRefreshed}
                  onOpenPreparation={handleOpenPreparation}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ingestion Modal Dialog */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={handleDataRefreshed}
      />

      {/* Application Preparation Drawer */}
      <ApplicationPreparationDrawer
        job={selectedPrepJob}
        isOpen={isPrepDrawerOpen}
        onClose={() => {
          setIsPrepDrawerOpen(false);
          setSelectedPrepJob(null);
        }}
        onStatusUpdated={handleDataRefreshed}
      />
    </div>
  );
}
