"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  Copy,
  Play,
  Square,
  FileText,
  MessageSquare,
  Bot,
  Workflow,
  ShieldAlert,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { EnrichedJob } from "@/lib/data";
import type { TailoredResume, ApplicationAnswer } from "@/types/tailoring";
import { prepareApplication, getApplicationData } from "@/app/actions/tailoring";
import { updateJobStatusAction, recordRejectionAction } from "@/app/actions";
import type {
  FormFieldMapping,
  NormalizedFormField,
  RunnerProgressEvent,
  RunnerState,
} from "@/lib/automation/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import TailoredResumeEditor from "./TailoredResumeEditor";
import QuestionAnswersList from "./QuestionAnswersList";
import SubDimensionScores from "./SubDimensionScores";

interface ApplicationPreparationDrawerProps {
  job: EnrichedJob | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: () => void;
  onUpdate?: () => void;
}

type DrawerTab = "resume" | "answers" | "automate" | "status";

const REJECTION_STAGE_OPTIONS = [
  { value: "RESUME_SCREEN", label: "Resume Screen (Pre-contact)" },
  { value: "ASSESSMENT", label: "Online Assessment / Take-home" },
  { value: "PHONE_SCREEN", label: "Recruiter / Phone Screen" },
  { value: "TECHNICAL_INTERVIEW", label: "Technical / Live Coding Round" },
  { value: "FINAL_ROUND", label: "Final Round / Panel" },
  { value: "OFFER_STAGE", label: "Offer Stage / Negotiation" },
  { value: "POSITION_CANCELLED", label: "Position Cancelled / Closed" },
];

const REJECTION_REASON_OPTIONS = [
  { value: "SKILLS_GAP", label: "Skills Gap (Missing required tech)" },
  { value: "EXPERIENCE_MISMATCH", label: "Experience / Seniority Mismatch" },
  { value: "LOCATION_POLICY", label: "Location / Relocation / Remote Policy" },
  { value: "COMPENSATION_MISMATCH", label: "Compensation / Budget Mismatch" },
  { value: "VISA_RESTRICTION", label: "Visa / Work Authorization Restriction" },
  { value: "CANDIDATE_WITHDREW", label: "Candidate Withdrew" },
  { value: "UNKNOWN", label: "Unknown / General Feedback" },
];

const RUNNER_STEPS: { state: RunnerState; label: string; description: string }[] = [
  { state: "STARTING_BROWSER", label: "Browser Launch", description: "Dedicated Chrome session" },
  { state: "NAVIGATING", label: "Navigate", description: "Loading ATS portal" },
  { state: "SCANNING_DOM", label: "DOM Extraction", description: "Identifying inputs" },
  { state: "FILLING_FIELDS", label: "Form Population", description: "Human cadence typing" },
  { state: "HIGHLIGHTING_INSPECTION", label: "Visual Badges", description: "In-DOM outlines" },
  { state: "AWAITING_HUMAN_REVIEW", label: "Candidate Review", description: "Ready for review" },
];

export default function ApplicationPreparationDrawer({
  job,
  isOpen,
  onClose,
  onStatusUpdated,
  onUpdate,
}: ApplicationPreparationDrawerProps) {
  const notifyUpdated = onUpdate || onStatusUpdated;
  const [activeTab, setActiveTab] = useState<DrawerTab>("resume");
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<ApplicationAnswer[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<string>(job?.status || "SHORTLISTED");
  const [applicationId, setApplicationId] = useState<string>(job?.application?.id || "");

  // Automation / Browser Stream State
  const [isAutomating, setIsAutomating] = useState(false);
  const [lastAutomationEvent, setLastAutomationEvent] = useState<RunnerProgressEvent | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [mappedFields, setMappedFields] = useState<FormFieldMapping[]>([]);
  const [unmappedFields, setUnmappedFields] = useState<NormalizedFormField[]>([]);
  const [checklistFilter, setChecklistFilter] = useState<"all" | "filled" | "review" | "missing">("all");
  const [copiedChipId, setCopiedChipId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Rejection Dialog State
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [selectedRejectionStage, setSelectedRejectionStage] = useState<string>("RESUME_SCREEN");
  const [selectedRejectionReason, setSelectedRejectionReason] = useState<string>("SKILLS_GAP");
  const [rejectionNotes, setRejectionNotes] = useState<string>("");
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);

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
      if (data.application?.rejectionStage) {
        setSelectedRejectionStage(data.application.rejectionStage);
      }
      if (data.application?.rejectionReason) {
        setSelectedRejectionReason(data.application.rejectionReason);
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

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!job) return null;

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
        if (notifyUpdated) notifyUpdated();
      }
    } catch (err: unknown) {
      console.error("Preparation error:", err);
      setError(err instanceof Error ? err.message : "Failed to prepare application");
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleStatusChange(newStatus: string, payload?: Record<string, unknown>) {
    if (!job) return;
    if (newStatus === "REJECTED" && !payload) {
      setShowRejectionModal(true);
      return;
    }

    try {
      await updateJobStatusAction(job.id, newStatus, payload);
      setApplicationStatus(newStatus);
      if (notifyUpdated) notifyUpdated();
    } catch (err: unknown) {
      console.error("Status update error:", err);
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleConfirmRejection() {
    if (!job) return;
    setIsSubmittingRejection(true);
    try {
      await recordRejectionAction(job.id, {
        rejectionStage: selectedRejectionStage,
        rejectionReason: selectedRejectionReason,
        note: rejectionNotes || undefined,
      });
      setApplicationStatus("REJECTED");
      setShowRejectionModal(false);
      if (notifyUpdated) notifyUpdated();
    } catch (err: unknown) {
      console.error("Failed to record rejection:", err);
      setError(err instanceof Error ? err.message : "Failed to record rejection");
    } finally {
      setIsSubmittingRejection(false);
    }
  }

  async function startBrowserAutomation() {
    if (!job) return;
    setActiveTab("automate");
    setIsAutomating(true);
    setAutomationError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/automation/stream?jobId=${encodeURIComponent(job.id)}&headless=false`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({ error: "Failed to connect to automation stream" }));
        throw new Error(errorJson.error || "Automation stream connection failed");
      }

      if (!response.body) {
        throw new Error("No response body returned from stream endpoint");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.startsWith("data:")) {
            try {
              const rawData = trimmed.slice(5).trim();
              const event = JSON.parse(rawData) as RunnerProgressEvent;
              setLastAutomationEvent(event);

              if (event.payload?.mappedFields && Array.isArray(event.payload.mappedFields)) {
                setMappedFields(event.payload.mappedFields);
              }
              if (event.payload?.unmappedFields && Array.isArray(event.payload.unmappedFields)) {
                setUnmappedFields(event.payload.unmappedFields);
              }
              if (event.state === "SUBMITTED") {
                setApplicationStatus("APPLIED");
                if (notifyUpdated) notifyUpdated();
              }
            } catch (jsonErr) {
              console.error("Error parsing SSE event:", jsonErr);
            }
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setAutomationError(err instanceof Error ? err.message : "Automation stream encountered an error");
      }
    } finally {
      setIsAutomating(false);
      abortControllerRef.current = null;
    }
  }

  function handleAbortAutomation() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAutomating(false);
  }

  function copyToClipboard(text: string, chipId: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedChipId(chipId);
    setTimeout(() => {
      setCopiedChipId((current) => (current === chipId ? null : current));
    }, 2000);
  }

  const isPrepared = tailoredResume !== null || questionAnswers.length > 0;
  const currentRunnerState = lastAutomationEvent?.state;

  const currentStepIndex = RUNNER_STEPS.findIndex((s) => s.state === currentRunnerState);
  const activeStepNumber = currentStepIndex >= 0 ? currentStepIndex + 1 : currentRunnerState === "SUBMITTED" ? 6 : 0;

  // Filtered Checklist Fields
  const filteredMapped = mappedFields.filter((f) => {
    if (checklistFilter === "all") return true;
    if (checklistFilter === "filled") return f.tier === 1;
    if (checklistFilter === "review") return f.tier === 2;
    return false;
  });

  const filteredUnmapped = unmappedFields.filter(() => {
    return checklistFilter === "all" || checklistFilter === "missing";
  });

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col h-full bg-zinc-900 border-l border-zinc-800 text-zinc-100 shadow-none gap-0 overflow-hidden"
        >
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as DrawerTab)}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <SheetHeader className="p-6 border-b border-zinc-800 bg-zinc-900 shrink-0 space-y-4 text-left">
            <div className="flex items-start justify-between gap-4 pr-6">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="violet" className="font-mono uppercase tracking-wider text-[10px]">
                    Application Preparation
                  </Badge>
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                    {applicationStatus}
                  </Badge>
                  {job.fitScore && (
                    <Badge variant="emerald" className="font-mono text-[10px] font-bold">
                      Score: {job.fitScore.score}/100
                    </Badge>
                  )}
                </div>

                <SheetTitle className="text-xl font-bold tracking-tight text-zinc-100">
                  {job.title}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">{job.company}</span>
                  {job.location && (
                    <>
                      <span>•</span>
                      <span>{job.location}</span>
                    </>
                  )}
                  {job.remoteStatus && job.remoteStatus !== "UNKNOWN" && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-zinc-400 uppercase">{job.remoteStatus}</span>
                    </>
                  )}
                </SheetDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Fill Application in Browser Action */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startBrowserAutomation}
                  disabled={isAutomating}
                  className="gap-1.5 font-semibold text-xs border-violet-800/60 bg-violet-950/30 text-violet-300 hover:bg-violet-900/40 hover:text-zinc-100"
                  title="Open dedicated Chrome session and auto-fill fields"
                >
                  {isAutomating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Running Automation...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5 text-violet-400" />
                      <span>Fill in Browser</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handlePrepare}
                  disabled={isPreparing}
                  className="gap-1.5 font-semibold text-xs"
                >
                  {isPreparing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Tailoring...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      <span>{isPrepared ? "Re-tailor" : "Prepare"}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Error Message */}
            {(error || automationError) && (
              <div className="p-3 rounded-md bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error || automationError}</span>
                </div>
                {automationError && (
                  <button
                    type="button"
                    onClick={() => setAutomationError(null)}
                    className="text-red-400 hover:text-red-200 text-xs font-mono"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Sub-Dimension Score Visual Breakdown */}
            {job.fitScore && (
              <div className="pt-2 border-t border-zinc-800">
                <SubDimensionScores
                  skillsFit={job.fitScore.skillsFit}
                  experienceFit={job.fitScore.experienceFit}
                  domainFit={job.fitScore.domainFit}
                  trajectoryFit={job.fitScore.trajectoryFit}
                />
              </div>
            )}

            {/* Tab Navigation */}
            <TabsList className="w-full flex h-auto p-1 bg-zinc-950 border border-zinc-800">
              <TabsTrigger
                value="resume"
                className="flex-1 py-1.5 text-xs font-semibold gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Tailored Resume</span>
                {tailoredResume && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </TabsTrigger>

              <TabsTrigger
                value="answers"
                className="flex-1 py-1.5 text-xs font-semibold gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Screening Answers</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px]">
                  {questionAnswers.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="automate"
                className="flex-1 py-1.5 text-xs font-semibold gap-1.5"
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>Browser Assist</span>
                {isAutomating && <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />}
                {mappedFields.length > 0 && !isAutomating && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </TabsTrigger>

              <TabsTrigger
                value="status"
                className="flex-1 py-1.5 text-xs font-semibold gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pipeline Stage</span>
              </TabsTrigger>
            </TabsList>
          </SheetHeader>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-900">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-zinc-500 text-xs">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  <span>Loading application materials...</span>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Resume Tab */}
                <TabsContent value="resume" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
                  {!isPrepared ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-violet-400">
                        <Sparkles className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5 max-w-sm">
                        <h3 className="text-base font-semibold text-zinc-100 tracking-tight">
                          Application Not Prepared Yet
                        </h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Generate role-specific tailored resume and screening answers grounded strictly in your verified profile facts.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handlePrepare}
                        disabled={isPreparing}
                        className="font-semibold text-xs gap-2"
                      >
                        {isPreparing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating Tailored Materials...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                            <span>Prepare Application with AI</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    tailoredResume && (
                      <TailoredResumeEditor
                        applicationId={applicationId || job.id}
                        jobTitle={job.title}
                        company={job.company}
                        tailoredResume={tailoredResume}
                        onUpdated={(updated) => setTailoredResume(updated)}
                      />
                    )
                  )}
                </TabsContent>

                {/* 2. Answers Tab */}
                <TabsContent value="answers" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
                  <QuestionAnswersList
                    jobId={job.id}
                    answers={questionAnswers}
                    onAnswersUpdated={(updated) => setQuestionAnswers(updated)}
                  />
                </TabsContent>

                {/* 3. Browser Assist Tab */}
                <TabsContent value="automate" className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:outline-none">
                  {/* Bot Challenge Banner */}
                  {currentRunnerState === "BOT_CHECK_PAUSED" && (
                    <div className="p-4 rounded-lg bg-amber-950/50 border border-amber-800 text-amber-200 text-xs flex items-start gap-3">
                      <div className="p-2 rounded-md bg-amber-900/60 text-amber-400 shrink-0 text-base">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-amber-300 text-sm">
                          Anti-Bot Verification Challenge Detected
                        </h4>
                        <p className="text-amber-200/90 leading-relaxed">
                          Cloudflare Turnstile or CAPTCHA challenge is currently active in the opened Google Chrome window. Please complete the verification in your browser — Pulse is monitoring and will continue automatically.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submitted Success Banner */}
                  {(currentRunnerState === "SUBMITTED" || applicationStatus === "APPLIED") && (
                    <div className="p-4 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs flex items-start gap-3">
                      <div className="p-2 rounded-md bg-emerald-900/60 text-emerald-400 shrink-0 text-base">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-emerald-300 text-sm">
                          Application Successfully Submitted!
                        </h4>
                        <p className="text-emerald-200/90 leading-relaxed">
                          Automated post-submission confirmation detected on ATS portal. Application lifecycle state has been updated to <strong className="font-mono text-zinc-100">APPLIED</strong> and audit event recorded.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Real-time Runner Progress Stepper */}
                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                          <Bot className="w-4 h-4 text-violet-400" />
                          <span>Browser Automation Runner</span>
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {lastAutomationEvent?.message || "Launches persistent Chrome session, matches fields, and injects visual inspection highlights."}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isAutomating ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleAbortAutomation}
                            className="font-semibold text-xs gap-1.5"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>Abort Run</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={startBrowserAutomation}
                            className="font-semibold text-xs gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 text-violet-400" />
                            <span>{mappedFields.length > 0 ? "Re-run in Browser" : "Launch & Auto-fill"}</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Stepper Progress Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
                      {RUNNER_STEPS.map((step, idx) => {
                        const stepNum = idx + 1;
                        const isDone = activeStepNumber > stepNum || currentRunnerState === "SUBMITTED";
                        const isCurrent = activeStepNumber === stepNum && isAutomating;

                        return (
                          <div
                            key={step.state}
                            className={cn(
                              "p-2.5 rounded-md border text-left flex flex-col justify-between transition-all",
                              isCurrent
                                ? "bg-zinc-900 border-violet-500 shadow-none ring-1 ring-violet-500"
                                : isDone
                                ? "bg-emerald-950/30 border-emerald-900 text-zinc-300"
                                : "bg-zinc-900 border-zinc-800 text-zinc-500"
                            )}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span>0{stepNum}</span>
                              {isDone && <Check className="w-3 h-3 text-emerald-400" />}
                              {isCurrent && (
                                <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                              )}
                            </div>
                            <div className="mt-1">
                              <span className={cn(
                                "text-[11px] font-semibold block",
                                isCurrent ? "text-violet-300" : isDone ? "text-zinc-200" : "text-zinc-400"
                              )}>
                                {step.label}
                              </span>
                              <span className="text-[9px] text-zinc-500 line-clamp-1 block">
                                {step.description}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive Inspection Checklist */}
                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-violet-400" />
                          <span>In-Drawer Inspection Checklist</span>
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Visual audit breakdown of auto-filled inputs, confidence scores, and unmapped fields.
                        </p>
                      </div>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-md border border-zinc-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setChecklistFilter("all")}
                          className={cn(
                            "px-2.5 py-0.5 rounded font-semibold transition-all",
                            checklistFilter === "all" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                          )}
                        >
                          All ({mappedFields.length + unmappedFields.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setChecklistFilter("filled")}
                          className={cn(
                            "px-2.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1",
                            checklistFilter === "filled" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "text-zinc-400 hover:text-zinc-200"
                          )}
                        >
                          <span>Filled</span>
                          <span className="font-mono text-[10px] text-emerald-400">
                            ({mappedFields.filter((f) => f.tier === 1).length})
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setChecklistFilter("review")}
                          className={cn(
                            "px-2.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1",
                            checklistFilter === "review" ? "bg-amber-950 text-amber-300 border border-amber-800" : "text-zinc-400 hover:text-zinc-200"
                          )}
                        >
                          <span>Review</span>
                          <span className="font-mono text-[10px] text-amber-400">
                            ({mappedFields.filter((f) => f.tier === 2).length})
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setChecklistFilter("missing")}
                          className={cn(
                            "px-2.5 py-0.5 rounded font-semibold transition-all flex items-center gap-1",
                            checklistFilter === "missing" ? "bg-red-950 text-red-300 border border-red-800" : "text-zinc-400 hover:text-zinc-200"
                          )}
                        >
                          <span>Unmapped</span>
                          <span className="font-mono text-[10px] text-red-400">
                            ({unmappedFields.length})
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Checklist Item Cards */}
                    {mappedFields.length === 0 && unmappedFields.length === 0 ? (
                      <div className="p-6 rounded-md bg-zinc-900 border border-zinc-800 text-center space-y-2">
                        <p className="text-xs text-zinc-400">
                          No active inspection scan yet. Launch browser automation to scan live ATS form fields.
                        </p>
                        <button
                          type="button"
                          onClick={startBrowserAutomation}
                          className="text-xs text-violet-400 hover:text-violet-300 font-semibold underline"
                        >
                          Start Browser Assisted Fill
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {/* Mapped Fields */}
                        {filteredMapped.map((mapping, idx) => {
                          const isReview = mapping.tier === 2;
                          return (
                            <div
                              key={`mapped-${idx}-${mapping.selector}`}
                              className={cn(
                                "p-3 rounded-md border text-xs flex items-start justify-between gap-3",
                                isReview
                                  ? "bg-amber-950/20 border-amber-800/50 text-amber-100"
                                  : "bg-emerald-950/20 border-emerald-800/50 text-emerald-100"
                              )}
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={isReview ? "amber" : "emerald"}
                                    className="font-mono text-[10px] font-bold uppercase tracking-wider"
                                  >
                                    {isReview ? "Tier 2 Semantic" : "Tier 1 Exact"}
                                  </Badge>
                                  <span className="font-semibold text-zinc-100 truncate">{mapping.field}</span>
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    ({Math.round(mapping.confidence * 100)}% confidence)
                                  </span>
                                </div>

                                <div className="font-mono text-[11px] text-zinc-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 truncate">
                                  {mapping.value ? String(mapping.value) : `[Action: ${mapping.action || "fill"}]`}
                                </div>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => copyToClipboard(String(mapping.value || ""), `mapped-${idx}`)}
                                className="text-zinc-400 hover:text-zinc-100 shrink-0"
                                title="Copy value"
                              >
                                {copiedChipId === `mapped-${idx}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          );
                        })}

                        {/* Unmapped Fields */}
                        {filteredUnmapped.map((field, idx) => (
                          <div
                            key={`unmapped-${idx}-${field.selector}`}
                            className="p-3 rounded-md border bg-red-950/20 border-red-800/50 text-red-100 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge
                                  variant="destructive"
                                  className="font-mono text-[10px] font-bold uppercase tracking-wider"
                                >
                                  {field.required ? "Required Unmapped" : "Optional Unmapped"}
                                </Badge>
                                <span className="font-semibold text-zinc-100 truncate">
                                  {field.label || field.name || field.id || "Custom Question"}
                                </span>
                              </div>
                              <span className="text-[10px] text-red-400 font-mono shrink-0">
                                Manual Paste
                              </span>
                            </div>

                            {/* Quick Fact Copy Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] text-zinc-500 font-mono">Copy Fact:</span>
                              {[
                                { label: "Role", val: job.title },
                                { label: "Company", val: job.company },
                                { label: "Location", val: job.location || "Remote" },
                              ].map((fact, fIdx) => (
                                <button
                                  key={fIdx}
                                  type="button"
                                  onClick={() => copyToClipboard(fact.val, `fact-${idx}-${fIdx}`)}
                                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 hover:text-zinc-100 flex items-center gap-1 transition-all"
                                >
                                  <span>{fact.label}</span>
                                  {copiedChipId === `fact-${idx}-${fIdx}` && (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Persistent Manual Reconciliation Controls */}
                  <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-100 tracking-tight">
                        Manual State Reconciliation
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Directly confirm application submission or maintain draft state.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange("PREPARED")}
                        className="font-semibold text-xs"
                      >
                        Keep Draft
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleStatusChange("APPLIED")}
                        className="font-semibold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Applied</span>
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* 4. Pipeline Stage Tab */}
                <TabsContent value="status" className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:outline-none">
                  {/* Lifecycle Telemetry / Latency Card */}
                  {(job.application?.appliedAt || job.application?.firstResponseAt || job.application?.rejectionStage) && (
                    <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-violet-400" />
                          <span>Application Lifecycle Telemetry</span>
                        </h4>
                        {job.application?.responseTimeDays !== null && job.application?.responseTimeDays !== undefined && (
                          <Badge variant="emerald" className="font-mono text-[11px] font-bold">
                            ⚡ {job.application.responseTimeDays} days response latency
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="bg-zinc-900 p-2.5 rounded-md border border-zinc-800">
                          <span className="text-[10px] text-zinc-500 font-mono block">Applied Date</span>
                          <span className="text-zinc-200 font-semibold font-mono text-[11px]">
                            {job.application.appliedAt
                              ? new Date(job.application.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "—"}
                          </span>
                        </div>

                        <div className="bg-zinc-900 p-2.5 rounded-md border border-zinc-800">
                          <span className="text-[10px] text-zinc-500 font-mono block">First Response</span>
                          <span className="text-zinc-200 font-semibold font-mono text-[11px]">
                            {job.application.firstResponseAt
                              ? new Date(job.application.firstResponseAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "Awaiting response"}
                          </span>
                        </div>

                        <div className="bg-zinc-900 p-2.5 rounded-md border border-zinc-800">
                          <span className="text-[10px] text-zinc-500 font-mono block">Rejection Stage</span>
                          <span className="text-red-400 font-semibold font-mono text-[11px] truncate block">
                            {job.application.rejectionStage ? job.application.rejectionStage.replace(/_/g, " ") : "N/A"}
                          </span>
                        </div>

                        <div className="bg-zinc-900 p-2.5 rounded-md border border-zinc-800">
                          <span className="text-[10px] text-zinc-500 font-mono block">Rejection Reason</span>
                          <span className="text-amber-400 font-semibold font-mono text-[11px] truncate block">
                            {job.application.rejectionReason ? job.application.rejectionReason.replace(/_/g, " ") : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                        Update Pipeline Stage
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Transition the job across tracking stages. Status changes automatically record audit events.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "SHORTLISTED", label: "Shortlisted" },
                        { id: "PREPARED", label: "Prepared" },
                        { id: "APPLIED", label: "Mark Applied" },
                        { id: "SCREENING", label: "Screening" },
                        { id: "ASSESSMENT", label: "Take-home / OA" },
                        { id: "INTERVIEW", label: "Interviewing" },
                        { id: "OFFER", label: "Offer Received" },
                        { id: "REJECTED", label: "Rejected" },
                        { id: "GHOSTED", label: "Ghosted" },
                        { id: "WITHDRAWN", label: "Withdrawn" },
                      ].map((stage) => {
                        const isActive = applicationStatus.toUpperCase() === stage.id;
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => handleStatusChange(stage.id)}
                            className={cn(
                              "p-3 rounded-lg border text-xs font-semibold transition-all text-left flex flex-col justify-between",
                              isActive
                                ? "bg-zinc-800 border-zinc-700 text-zinc-100 shadow-none ring-1 ring-violet-400/50"
                                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                            )}
                          >
                            <span>{stage.label}</span>
                            {isActive && (
                              <span className="text-[10px] text-violet-400 mt-1 font-mono">Current Stage</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Job Details Reference */}
                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 space-y-3 text-xs">
                    <h4 className="font-semibold text-zinc-100 tracking-tight">Job Posting Description</h4>
                    <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto bg-zinc-900 p-3 rounded-md border border-zinc-800 font-mono text-[11px]">
                      {job.description}
                    </p>
                  </div>
                </TabsContent>
              </>
            )}
          </div>

          {/* Footer */}
          <SheetFooter className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between shrink-0 text-xs text-zinc-500 font-mono">
            <span>Job ID: {job.id.slice(0, 8)}...</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Done
            </Button>
          </SheetFooter>
        </Tabs>
      </SheetContent>
    </Sheet>

      {/* Rejection Modal Dialog */}
      <Dialog open={showRejectionModal} onOpenChange={setShowRejectionModal}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>Record Application Rejection</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 mt-0.5">
              Capture structured outcome signals to calibrate ranking weights and improve future job matches.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            {/* Rejection Stage Dropdown */}
            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-300">
                Rejection Stage <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedRejectionStage}
                onChange={(e) => setSelectedRejectionStage(e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                {REJECTION_STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rejection Reason Dropdown */}
            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-300">
                Primary Rejection Reason <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedRejectionReason}
                onChange={(e) => setSelectedRejectionReason(e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              >
                {REJECTION_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rejection Notes */}
            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-300">
                Recruiter Feedback / Notes (Optional)
              </label>
              <Textarea
                rows={3}
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="e.g. Requires 5+ years with Golang; team restructured."
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRejectionModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmRejection}
              disabled={isSubmittingRejection}
              className="gap-1.5 font-semibold text-xs"
            >
              {isSubmittingRejection ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Confirm &amp; Save Rejection</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
