"use client";

import { useState, useEffect, useCallback } from "react";
import type { EnrichedJob } from "@/lib/data";
import type { TailoredResume, ApplicationAnswer } from "@/types/tailoring";
import { prepareApplication, getApplicationData } from "@/app/actions/tailoring";
import { updateJobStatusAction } from "@/app/actions";
import TailoredResumeEditor from "./TailoredResumeEditor";
import QuestionAnswersList from "./QuestionAnswersList";
import SubDimensionScores from "./SubDimensionScores";

interface ApplicationPreparationDrawerProps {
  job: EnrichedJob | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

type DrawerTab = "resume" | "answers" | "status";

export default function ApplicationPreparationDrawer({
  job,
  isOpen,
  onClose,
  onStatusUpdated,
}: ApplicationPreparationDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("resume");
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<ApplicationAnswer[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<string>(job?.status || "SHORTLISTED");
  const [applicationId, setApplicationId] = useState<string>(job?.application?.id || "");

  const loadData = useCallback(async () => {
    if (!job) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getApplicationData(job.id);
      if (data.tailoredResume) {
        setTailoredResume(data.tailoredResume);
      } else {
        setTailoredResume(null);
      }
      setQuestionAnswers(data.questionAnswers || []);
      setApplicationStatus(data.application?.status || job.status);
      if (data.application?.id) {
        setApplicationId(data.application.id);
      }
    } catch (err: unknown) {
      console.error("Failed to load application data:", err);
      setError(err instanceof Error ? err.message : "Failed to load application details");
    } finally {
      setIsLoading(false);
    }
  }, [job]);

  useEffect(() => {
    if (isOpen && job) {
      loadData();
    }
  }, [isOpen, job, loadData]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !job) return null;

  async function handlePrepare() {
    if (!job) return;
    setIsPreparing(true);
    setError(null);
    try {
      const res = await prepareApplication(job.id);
      if (res.success) {
        setTailoredResume(res.tailoredResume);
        setQuestionAnswers(res.questionAnswers);
        setApplicationStatus("PREPARED");
        setApplicationId(res.application.id);
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err: unknown) {
      console.error("Preparation error:", err);
      setError(err instanceof Error ? err.message : "Failed to prepare application");
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!job) return;
    try {
      await updateJobStatusAction(job.id, newStatus);
      setApplicationStatus(newStatus);
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: unknown) {
      console.error("Status update error:", err);
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  const isPrepared = tailoredResume !== null || questionAnswers.length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-3xl bg-[#0A0A0A] border-l border-neutral-800 text-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-6 border-b border-neutral-800 bg-[#0E0E0E] shrink-0 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800 text-purple-400 font-bold">
                    Application Preparation
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-neutral-900 text-neutral-400 border-neutral-800 uppercase tracking-wider">
                    {applicationStatus}
                  </span>
                  {job.fitScore && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                      Score: {job.fitScore.score}/100
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-white tracking-tight">
                  {job.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                  <span className="font-semibold text-neutral-200">{job.company}</span>
                  {job.location && (
                    <>
                      <span>•</span>
                      <span>{job.location}</span>
                    </>
                  )}
                  {job.remoteStatus && job.remoteStatus !== "UNKNOWN" && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-neutral-400 uppercase">{job.remoteStatus}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrepare}
                  disabled={isPreparing}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-all text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isPreparing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Tailoring with AI...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{isPrepared ? "Re-tailor Materials" : "Prepare Application"}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  aria-label="Close panel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Sub-Dimension Score Visual Breakdown */}
            {job.fitScore && (
              <div className="pt-2 border-t border-neutral-900">
                <SubDimensionScores
                  skillsFit={job.fitScore.skillsFit}
                  experienceFit={job.fitScore.experienceFit}
                  domainFit={job.fitScore.domainFit}
                  trajectoryFit={job.fitScore.trajectoryFit}
                />
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex rounded-lg bg-[#141414] p-1 border border-neutral-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("resume")}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "resume"
                    ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Tailored Resume</span>
                {tailoredResume && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("answers")}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "answers"
                    ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>Application Answers</span>
                <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-400 font-mono text-[10px]">
                  {questionAnswers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("status")}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "status"
                    ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Pipeline Stage</span>
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-neutral-500 text-xs">
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading tailored materials...</span>
                </div>
              </div>
            ) : !isPrepared ? (
              /* Hero Empty State */
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-800/60 flex items-center justify-center text-purple-400 shadow-inner">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Application Not Prepared Yet
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Generate a role-specific tailored resume and screening answers grounded strictly in your verified profile facts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrepare}
                  disabled={isPreparing}
                  className="px-6 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 transition-all text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {isPreparing ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Generating Tailored Materials...</span>
                    </>
                  ) : (
                    <span>Prepare Application with AI</span>
                  )}
                </button>
              </div>
            ) : (
              <div>
                {activeTab === "resume" && tailoredResume && (
                  <TailoredResumeEditor
                    applicationId={applicationId || job.id}
                    jobTitle={job.title}
                    company={job.company}
                    tailoredResume={tailoredResume}
                    onUpdated={(updated) => setTailoredResume(updated)}
                  />
                )}

                {activeTab === "answers" && (
                  <QuestionAnswersList
                    jobId={job.id}
                    answers={questionAnswers}
                    onAnswersUpdated={(updated) => setQuestionAnswers(updated)}
                  />
                )}

                {activeTab === "status" && (
                  <div className="space-y-6">
                    <div className="bg-[#111] p-5 rounded-xl border border-neutral-800 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          Update Pipeline Stage
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Transition the job across tracking stages. Status changes automatically record audit events.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {[
                          { id: "SHORTLISTED", label: "Shortlisted", color: "hover:border-indigo-700" },
                          { id: "PREPARED", label: "Prepared", color: "hover:border-cyan-700" },
                          { id: "APPLIED", label: "Mark Applied", color: "hover:border-blue-700 font-bold" },
                          { id: "INTERVIEW", label: "Interviewing", color: "hover:border-purple-700" },
                          { id: "OFFER", label: "Offer Received", color: "hover:border-emerald-700" },
                          { id: "REJECTED", label: "Rejected", color: "hover:border-rose-900" },
                        ].map((stage) => {
                          const isActive = applicationStatus.toUpperCase() === stage.id;
                          return (
                            <button
                              key={stage.id}
                              type="button"
                              onClick={() => handleStatusChange(stage.id)}
                              className={`p-3 rounded-lg border text-xs font-semibold transition-all text-left flex flex-col justify-between ${
                                isActive
                                  ? "bg-purple-950/60 border-purple-600 text-purple-300 shadow-sm"
                                  : `bg-[#161616] border-neutral-800 text-neutral-300 ${stage.color} hover:text-white`
                              }`}
                            >
                              <span>{stage.label}</span>
                              {isActive && (
                                <span className="text-[10px] text-purple-400 mt-1 font-mono">Current Stage</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Job Details Reference */}
                    <div className="bg-[#111] p-5 rounded-xl border border-neutral-800 space-y-3 text-xs">
                      <h4 className="font-bold text-white tracking-tight">Job Posting Description</h4>
                      <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto bg-[#0a0a0a] p-3 rounded-lg border border-neutral-900 font-mono text-[11px]">
                        {job.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-800 bg-[#0E0E0E] flex items-center justify-between shrink-0 text-xs text-neutral-500 font-mono">
            <span>Job ID: {job.id.slice(0, 8)}...</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
