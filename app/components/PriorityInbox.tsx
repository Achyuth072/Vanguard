"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EnrichedJob } from "@/lib/data";
import JobCard from "./JobCard";
import ApplicationTracker from "./ApplicationTracker";
import IngestModal from "./IngestModal";
import ApplicationPreparationDrawer from "./ApplicationPreparationDrawer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    if (s === "ARCHIVED" || s === "IGNORED" || s === "FILTERED_OUT") return false;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              activeTab === "inbox"
                ? "bg-zinc-800 border border-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Priority Inbox</span>
            <Badge variant="emerald" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
              {inboxJobs.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("review")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              activeTab === "review"
                ? "bg-zinc-800 border border-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Review</span>
            <Badge variant="amber" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
              {reviewJobs.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("applications")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              activeTab === "applications"
                ? "bg-zinc-800 border border-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span>Applications</span>
            <Badge variant="violet" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
              {applicationJobs.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              activeTab === "all"
                ? "bg-zinc-800 border border-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
            }`}
          >
            <span>All Jobs</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono tabular-nums">
              {allJobs.length}
            </Badge>
          </button>
        </div>

        {/* Search & Ingest Action Button */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, title..."
              className="h-8 w-48 sm:w-56 pl-8 text-xs bg-zinc-950 border-zinc-800 placeholder:text-zinc-500"
            />
            <svg className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <Button
            onClick={() => setIsIngestOpen(true)}
            size="sm"
            className="h-8 gap-1.5 font-semibold shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Ingest Job</span>
          </Button>
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
            <Card className="p-12 text-center space-y-3 bg-zinc-900/50 border-zinc-800">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-100">No jobs found</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {activeTab === "inbox"
                  ? "No high-priority jobs (Score ≥ 80) in the inbox yet. Ingest job descriptions or URLs to evaluate."
                  : activeTab === "review"
                  ? "No jobs currently in the 60–79 review bracket."
                  : "No job postings matching the current filter."}
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsIngestOpen(true)}
                  className="font-semibold"
                >
                  Ingest New Job
                </Button>
              </div>
            </Card>
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
