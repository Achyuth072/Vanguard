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
  ExternalLink,
  Download,
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

  function handleExportResume() {
    if (!tailoredResume?.markdownContent) return;
    const slug = `${job?.company?.replace(/\s+/g, "-")}-${job?.title?.replace(/\s+/g, "-")}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    const filename = `${slug || "tailored"}-resume.md`;
    const blob = new Blob([tailoredResume.markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col h-full bg-[#0d0e12] border-l border-[#2a2e38] text-[#f4f2ec] shadow-none gap-0 overflow-hidden"
        >
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as DrawerTab)}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <SheetHeader className="p-6 border-b border-[#2a2e38] bg-[#15171d] shrink-0 space-y-4 text-left">
              <div className="flex items-start justify-between gap-4 pr-6">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#d4a745]">
                      APPLICATION PREPARATION
                    </span>
                    <span className="font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#a6abbd]">
                      {applicationStatus}
                    </span>
                    {job.fitScore && (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[2px] border border-[#d4a745]/60 bg-[#d4a745]/10 text-[#d4a745]">
                        Score: {job.fitScore.score}/100
                      </span>
                    )}
                  </div>

                  <SheetTitle className="text-xl font-bold tracking-tight text-[#f4f2ec]">
                    {job.title}
                  </SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-2 text-xs text-[#a6abbd]">
                    <span className="font-semibold text-[#d4a745]">{job.company}</span>
                    {job.location && (
                      <>
                        <span>·</span>
                        <span>{job.location}</span>
                      </>
                    )}
                    {job.remoteStatus && job.remoteStatus !== "UNKNOWN" && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-xs text-[#a6abbd] uppercase">{job.remoteStatus}</span>
                      </>
                    )}
                    {job.source && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-xs text-[#a6abbd] uppercase">{job.source}</span>
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
                    className="gap-1.5 font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] hover:bg-[#1f222a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
                    title="Open dedicated Chrome session and auto-fill fields"
                  >
                    {isAutomating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-[#d4a745]" />
                        <span>Fill in Browser</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePrepare}
                    disabled={isPreparing}
                    className="gap-1.5 font-bold text-xs bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
                  >
                    {isPreparing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Tailoring...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isPrepared ? "Re-tailor" : "Prepare Application"}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Error Message */}
              {(error || automationError) && (
                <div className="p-3 rounded-[2px] bg-[#15171d] border border-[#c4634e] text-[#c4634e] text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#c4634e]" />
                    <span>{error || automationError}</span>
                  </div>
                  {automationError && (
                    <button
                      type="button"
                      onClick={() => setAutomationError(null)}
                      className="text-[#c4634e] hover:text-[#f4f2ec] text-xs font-mono"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Sub-Dimension Score Visual Breakdown */}
              {job.fitScore && (
                <div className="pt-2 border-t border-[#2a2e38]">
                  <SubDimensionScores
                    skillsFit={job.fitScore.skillsFit}
                    experienceFit={job.fitScore.experienceFit}
                    domainFit={job.fitScore.domainFit}
                    trajectoryFit={job.fitScore.trajectoryFit}
                  />
                </div>
              )}

              {/* Tab Navigation with 12px mono indicators */}
              <TabsList className="w-full flex h-auto p-1 bg-[#0d0e12] border border-[#2a2e38] rounded-[2px]">
                <TabsTrigger
                  value="resume"
                  className="flex-1 py-1.5 text-xs font-mono font-semibold gap-1.5 rounded-[2px] border border-transparent text-[#a6abbd] transition-colors data-[state=active]:bg-[#1f222a] data-[state=active]:text-[#f4f2ec] data-[state=active]:border-[#3d4352] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                >
                  <FileText className="w-3.5 h-3.5 text-[#d4a745]" />
                  <span>01 · TAILORED RESUME</span>
                  {tailoredResume && <span className="w-1.5 h-1.5 rounded-full bg-[#8ab384]" />}
                </TabsTrigger>

                <TabsTrigger
                  value="answers"
                  className="flex-1 py-1.5 text-xs font-mono font-semibold gap-1.5 rounded-[2px] border border-transparent text-[#a6abbd] transition-colors data-[state=active]:bg-[#1f222a] data-[state=active]:text-[#f4f2ec] data-[state=active]:border-[#3d4352] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#d4a745]" />
                  <span>02 · CITED Q&amp;A</span>
                  <span className="px-1.5 py-0.2 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#a6abbd] font-mono text-[10px]">
                    {questionAnswers.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="automate"
                  className="flex-1 py-1.5 text-xs font-mono font-semibold gap-1.5 rounded-[2px] border border-transparent text-[#a6abbd] transition-colors data-[state=active]:bg-[#1f222a] data-[state=active]:text-[#f4f2ec] data-[state=active]:border-[#3d4352] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                >
                  <Workflow className="w-3.5 h-3.5 text-[#d4a745]" />
                  <span>03 · AUTOMATION</span>
                  {isAutomating && <span className="w-2 h-2 rounded-full bg-[#d4a745] animate-ping" />}
                  {mappedFields.length > 0 && !isAutomating && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8ab384]" />
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="status"
                  className="flex-1 py-1.5 text-xs font-mono font-semibold gap-1.5 rounded-[2px] border border-transparent text-[#a6abbd] transition-colors data-[state=active]:bg-[#1f222a] data-[state=active]:text-[#f4f2ec] data-[state=active]:border-[#3d4352] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#d4a745]" />
                  <span>04 · AUDIT &amp; STAGE</span>
                </TabsTrigger>
              </TabsList>
            </SheetHeader>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0d0e12]">
              {isLoading ? (
                <div className="h-64 flex items-center justify-center text-[#a6abbd] text-xs">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#d4a745]" />
                    <span className="font-mono">Loading application materials...</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* 1. Resume Tab */}
                  <TabsContent value="resume" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
                    {!isPrepared ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                        <div className="w-16 h-16 rounded-[3px] bg-[#15171d] border border-[#2a2e38] flex items-center justify-center text-[#d4a745]">
                          <Sparkles className="w-8 h-8" />
                        </div>
                        <div className="space-y-1.5 max-w-sm">
                          <h3 className="text-base font-semibold text-[#f4f2ec] tracking-tight">
                            Application Not Prepared Yet
                          </h3>
                          <p className="text-xs text-[#a6abbd] leading-relaxed">
                            Generate role-specific tailored resume and screening answers grounded strictly in your verified profile facts.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handlePrepare}
                          disabled={isPreparing}
                          className="font-bold text-xs gap-2 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                        >
                          {isPreparing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating Tailored Materials...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
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
                      <div className="p-4 rounded-[3px] bg-[#15171d] border border-[#d4a745] text-[#f4f2ec] text-xs flex items-start gap-3">
                        <div className="p-2 rounded-[2px] bg-[#1f222a] text-[#d4a745] shrink-0 text-base">
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-[#d4a745] text-sm">
                            Anti-Bot Verification Challenge Detected
                          </h4>
                          <p className="text-[#a6abbd] leading-relaxed">
                            Cloudflare Turnstile or CAPTCHA challenge is currently active in the opened Google Chrome window. Please complete the verification in your browser — Vanguard is monitoring and will continue automatically.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Submitted Success Banner */}
                    {(currentRunnerState === "SUBMITTED" || applicationStatus === "APPLIED") && (
                      <div className="p-4 rounded-[3px] bg-[#15171d] border border-[#8ab384] text-[#f4f2ec] text-xs flex items-start gap-3">
                        <div className="p-2 rounded-[2px] bg-[#1f222a] text-[#8ab384] shrink-0 text-base">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-[#8ab384] text-sm">
                            Application Successfully Submitted
                          </h4>
                          <p className="text-[#a6abbd] leading-relaxed">
                            Automated post-submission confirmation detected on ATS portal. Application lifecycle state has been updated to <strong className="font-mono text-[#f4f2ec]">APPLIED</strong> and audit event recorded.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Real-time Runner Progress Stepper */}
                    <div className="bg-[#15171d] p-5 rounded-[3px] border border-[#2a2e38] space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-[#f4f2ec] tracking-tight flex items-center gap-2 font-mono">
                            <Bot className="w-4 h-4 text-[#d4a745]" />
                            <span>BROWSER AUTOMATION RUNNER</span>
                          </h3>
                          <p className="text-xs text-[#a6abbd] mt-0.5">
                            {lastAutomationEvent?.message || "Launches persistent Chrome session, matches fields, and injects visual inspection highlights."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] text-[#f4f2ec] hover:bg-[#1f222a]"
                            >
                              <ExternalLink className="w-3 h-3 text-[#d4a745]" />
                              <span>Portal Link ↗</span>
                            </a>
                          )}

                          {isAutomating ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={handleAbortAutomation}
                              className="font-mono text-xs gap-1.5 rounded-[2px]"
                            >
                              <Square className="w-3.5 h-3.5" />
                              <span>Abort Run</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={startBrowserAutomation}
                              className="font-bold text-xs gap-1.5 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                            >
                              <Play className="w-3.5 h-3.5" />
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
                                "p-2.5 rounded-[2px] border text-left flex flex-col justify-between transition-colors",
                                isCurrent
                                  ? "bg-[#1f222a] border-[#d4a745] ring-1 ring-[#d4a745]"
                                  : isDone
                                  ? "bg-[#15171d] border-[#8ab384]/60 text-[#f4f2ec]"
                                  : "bg-[#0d0e12] border-[#2a2e38] text-[#a6abbd]"
                              )}
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span>0{stepNum}</span>
                                {isDone && <Check className="w-3 h-3 text-[#8ab384]" />}
                                {isCurrent && (
                                  <span className="w-2 h-2 rounded-full bg-[#d4a745] animate-ping" />
                                )}
                              </div>
                              <div className="mt-1">
                                <span className={cn(
                                  "text-xs font-semibold block",
                                  isCurrent ? "text-[#d4a745]" : isDone ? "text-[#f4f2ec]" : "text-[#a6abbd]"
                                )}>
                                  {step.label}
                                </span>
                                <span className="text-[10px] text-[#a6abbd] line-clamp-1 block">
                                  {step.description}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Interactive Inspection Checklist */}
                    <div className="bg-[#15171d] p-5 rounded-[3px] border border-[#2a2e38] space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-mono font-bold text-[#f4f2ec] tracking-tight flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-[#d4a745]" />
                            <span>IN-DRAWER INSPECTION CHECKLIST</span>
                          </h4>
                          <p className="text-xs text-[#a6abbd] mt-0.5">
                            Visual audit breakdown of auto-filled inputs, confidence scores, and unmapped fields.
                          </p>
                        </div>

                        {/* Filter Pills */}
                        <div className="flex items-center gap-1 bg-[#0d0e12] p-1 rounded-[2px] border border-[#2a2e38] text-xs font-mono">
                          <button
                            type="button"
                            onClick={() => setChecklistFilter("all")}
                            className={cn(
                              "px-2.5 py-0.5 rounded-[2px] font-semibold transition-colors focus-visible:outline-1 focus-visible:outline-[#d4a745]",
                              checklistFilter === "all" ? "bg-[#1f222a] text-[#f4f2ec]" : "text-[#a6abbd] hover:text-[#f4f2ec]"
                            )}
                          >
                            All ({mappedFields.length + unmappedFields.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setChecklistFilter("filled")}
                            className={cn(
                              "px-2.5 py-0.5 rounded-[2px] font-semibold transition-colors flex items-center gap-1 focus-visible:outline-1 focus-visible:outline-[#d4a745]",
                              checklistFilter === "filled" ? "bg-[#1f222a] text-[#8ab384] border border-[#8ab384]/60" : "text-[#a6abbd] hover:text-[#f4f2ec]"
                            )}
                          >
                            <span>Filled</span>
                            <span className="text-[10px] text-[#8ab384]">
                              ({mappedFields.filter((f) => f.tier === 1).length})
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setChecklistFilter("review")}
                            className={cn(
                              "px-2.5 py-0.5 rounded-[2px] font-semibold transition-colors flex items-center gap-1 focus-visible:outline-1 focus-visible:outline-[#d4a745]",
                              checklistFilter === "review" ? "bg-[#1f222a] text-[#d4a745] border border-[#d4a745]/60" : "text-[#a6abbd] hover:text-[#f4f2ec]"
                            )}
                          >
                            <span>Review</span>
                            <span className="text-[10px] text-[#d4a745]">
                              ({mappedFields.filter((f) => f.tier === 2).length})
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setChecklistFilter("missing")}
                            className={cn(
                              "px-2.5 py-0.5 rounded-[2px] font-semibold transition-colors flex items-center gap-1 focus-visible:outline-1 focus-visible:outline-[#d4a745]",
                              checklistFilter === "missing" ? "bg-[#1f222a] text-[#c4634e] border border-[#c4634e]/60" : "text-[#a6abbd] hover:text-[#f4f2ec]"
                            )}
                          >
                            <span>Unmapped</span>
                            <span className="text-[10px] text-[#c4634e]">
                              ({unmappedFields.length})
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Checklist Item Cards */}
                      {mappedFields.length === 0 && unmappedFields.length === 0 ? (
                        <div className="p-6 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-center space-y-2">
                          <p className="text-xs text-[#a6abbd]">
                            No active inspection scan yet. Launch browser automation to scan live ATS form fields.
                          </p>
                          <button
                            type="button"
                            onClick={startBrowserAutomation}
                            className="text-xs text-[#d4a745] hover:text-[#e8bd59] font-mono font-semibold underline focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                          >
                            Start Browser Assisted Fill
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {/* Mapped Fields */}
                          {filteredMapped.map((mapping, idx) => {
                            const isReview = mapping.tier === 2;
                            return (
                              <div
                                key={`mapped-${idx}-${mapping.selector}`}
                                className={cn(
                                  "p-3 rounded-[2px] border text-xs flex items-start justify-between gap-3",
                                  isReview
                                    ? "bg-[#0d0e12] border-[#d4a745]/40 text-[#f4f2ec]"
                                    : "bg-[#0d0e12] border-[#8ab384]/40 text-[#f4f2ec]"
                                )}
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[2px] border",
                                        isReview
                                          ? "border-[#d4a745]/60 bg-[#15171d] text-[#d4a745]"
                                          : "border-[#8ab384]/60 bg-[#15171d] text-[#8ab384]"
                                      )}
                                    >
                                      {isReview ? "Tier 2 Semantic" : "Tier 1 Exact"}
                                    </span>
                                    <span className="font-semibold text-[#f4f2ec] truncate">{mapping.field}</span>
                                    <span className="text-[10px] text-[#a6abbd] font-mono">
                                      ({Math.round(mapping.confidence * 100)}% confidence)
                                    </span>
                                  </div>

                                  <div className="font-mono text-xs text-[#f4f2ec] bg-[#15171d] px-2 py-1 rounded-[2px] border border-[#2a2e38] truncate">
                                    {mapping.value ? String(mapping.value) : `[Action: ${mapping.action || "fill"}]`}
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => copyToClipboard(String(mapping.value || ""), `mapped-${idx}`)}
                                  className="text-[#a6abbd] hover:text-[#f4f2ec] shrink-0 rounded-[2px] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                                  title="Copy value"
                                >
                                  {copiedChipId === `mapped-${idx}` ? (
                                    <Check className="w-3.5 h-3.5 text-[#8ab384]" />
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
                              className="p-3 rounded-[2px] border bg-[#0d0e12] border-[#c4634e]/40 text-[#f4f2ec] text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[2px] border border-[#c4634e]/60 bg-[#15171d] text-[#c4634e]">
                                    {field.required ? "Required Unmapped" : "Optional Unmapped"}
                                  </span>
                                  <span className="font-semibold text-[#f4f2ec] truncate">
                                    {field.label || field.name || field.id || "Custom Question"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-[#c4634e] font-mono shrink-0">
                                  Manual Paste
                                </span>
                              </div>

                              {/* Quick Fact Copy Chips */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] text-[#a6abbd] font-mono">Copy Fact:</span>
                                {[
                                  { label: "Role", val: job.title },
                                  { label: "Company", val: job.company },
                                  { label: "Location", val: job.location || "Remote" },
                                ].map((fact, fIdx) => (
                                  <button
                                    key={fIdx}
                                    type="button"
                                    onClick={() => copyToClipboard(fact.val, `fact-${idx}-${fIdx}`)}
                                    className="px-2 py-0.5 rounded-[2px] bg-[#15171d] hover:bg-[#1f222a] border border-[#2a2e38] text-[10px] font-mono text-[#f4f2ec] flex items-center gap-1 transition-colors focus-visible:outline-1 focus-visible:outline-[#d4a745]"
                                  >
                                    <span>{fact.label}</span>
                                    {copiedChipId === `fact-${idx}-${fIdx}` && (
                                      <Check className="w-3 h-3 text-[#8ab384]" />
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
                    <div className="p-4 rounded-[3px] bg-[#15171d] border border-[#2a2e38] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-mono font-bold text-[#f4f2ec] tracking-tight">
                          MANUAL STATE RECONCILIATION
                        </h4>
                        <p className="text-xs text-[#a6abbd] mt-0.5">
                          Directly confirm application submission or maintain draft state.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange("PREPARED")}
                          className="font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#0d0e12] text-[#f4f2ec] hover:bg-[#1f222a]"
                        >
                          Keep Draft
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleStatusChange("APPLIED")}
                          className="font-bold text-xs gap-1.5 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark as Applied</span>
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  {/* 4. Pipeline Stage Tab */}
                  <TabsContent value="status" className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:outline-none">
                    {/* Lifecycle Telemetry / Latency Card */}
                    {(job.application?.appliedAt || job.application?.firstResponseAt || job.application?.rejectionStage) && (
                      <div className="bg-[#15171d] p-4 rounded-[3px] border border-[#2a2e38] space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-mono font-bold text-[#f4f2ec] tracking-tight flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-[#d4a745]" />
                            <span>APPLICATION LIFECYCLE TELEMETRY</span>
                          </h4>
                          {job.application?.responseTimeDays !== null && job.application?.responseTimeDays !== undefined && (
                            <span className="font-mono text-xs font-bold text-[#8ab384] px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38]">
                              ⚡ {job.application.responseTimeDays} days response latency
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          <div className="bg-[#0d0e12] p-2.5 rounded-[2px] border border-[#2a2e38]">
                            <span className="text-[10px] text-[#a6abbd] font-mono block">Applied Date</span>
                            <span className="text-[#f4f2ec] font-semibold font-mono text-xs">
                              {job.application.appliedAt
                                ? new Date(job.application.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : "—"}
                            </span>
                          </div>

                          <div className="bg-[#0d0e12] p-2.5 rounded-[2px] border border-[#2a2e38]">
                            <span className="text-[10px] text-[#a6abbd] font-mono block">First Response</span>
                            <span className="text-[#f4f2ec] font-semibold font-mono text-xs">
                              {job.application.firstResponseAt
                                ? new Date(job.application.firstResponseAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : "Awaiting response"}
                            </span>
                          </div>

                          <div className="bg-[#0d0e12] p-2.5 rounded-[2px] border border-[#2a2e38]">
                            <span className="text-[10px] text-[#a6abbd] font-mono block">Rejection Stage</span>
                            <span className="text-[#c4634e] font-semibold font-mono text-xs truncate block">
                              {job.application.rejectionStage ? job.application.rejectionStage.replace(/_/g, " ") : "N/A"}
                            </span>
                          </div>

                          <div className="bg-[#0d0e12] p-2.5 rounded-[2px] border border-[#2a2e38]">
                            <span className="text-[10px] text-[#a6abbd] font-mono block">Rejection Reason</span>
                            <span className="text-[#d4a745] font-semibold font-mono text-xs truncate block">
                              {job.application.rejectionReason ? job.application.rejectionReason.replace(/_/g, " ") : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-[#15171d] p-5 rounded-[3px] border border-[#2a2e38] space-y-4">
                      <div>
                        <h3 className="text-xs font-mono font-bold text-[#f4f2ec] tracking-tight">
                          TRANSITION PIPELINE STAGE
                        </h3>
                        <p className="text-xs text-[#a6abbd] mt-0.5">
                          Transition the job across tracking stages. Status changes automatically record audit events.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                "p-3 rounded-[2px] border text-xs font-semibold transition-colors text-left flex flex-col justify-between focus-visible:outline-2 focus-visible:outline-[#d4a745]",
                                isActive
                                  ? "bg-[#1f222a] border-[#d4a745] text-[#f4f2ec]"
                                  : "bg-[#0d0e12] border-[#2a2e38] text-[#a6abbd] hover:border-[#3d4352] hover:text-[#f4f2ec]"
                              )}
                            >
                              <span>{stage.label}</span>
                              {isActive && (
                                <span className="text-[10px] text-[#d4a745] mt-1 font-mono">ACTIVE STAGE</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Job Details Reference */}
                    <div className="bg-[#15171d] p-5 rounded-[3px] border border-[#2a2e38] space-y-3 text-xs">
                      <h4 className="font-mono font-bold text-[#f4f2ec] tracking-tight">JOB POSTING DESCRIPTION</h4>
                      <p className="text-[#f4f2ec] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38] font-mono text-xs">
                        {job.description}
                      </p>
                    </div>
                  </TabsContent>
                </>
              )}
            </div>

            {/* Action Footer */}
            <SheetFooter className="p-4 border-t border-[#2a2e38] bg-[#15171d] flex flex-wrap items-center justify-between shrink-0 text-xs font-mono gap-3">
              <div className="flex items-center gap-2 text-[#a6abbd]">
                <span>JOB // {job.id.slice(0, 8)}</span>
                <span>·</span>
                <span className="text-[#d4a745]">STAGE // {applicationStatus}</span>
              </div>

              <div className="flex items-center gap-2">
                {tailoredResume?.markdownContent && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportResume}
                    className="font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#0d0e12] text-[#f4f2ec] hover:bg-[#1f222a] flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                    title="Export Tailored Resume"
                  >
                    <Download className="w-3.5 h-3.5 text-[#d4a745]" />
                    <span>Export PDF/MD</span>
                  </Button>
                )}

                {applicationStatus !== "APPLIED" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleStatusChange("APPLIED")}
                    className="font-bold text-xs gap-1.5 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark as Applied</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#0d0e12] text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#1f222a]"
                >
                  Close
                </Button>
              </div>
            </SheetFooter>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Rejection Modal Dialog */}
      <Dialog open={showRejectionModal} onOpenChange={setShowRejectionModal}>
        <DialogContent className="max-w-md bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[3px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#c4634e] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#c4634e]" />
              <span>Record Application Rejection</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#a6abbd] mt-0.5">
              Capture structured outcome signals to calibrate ranking weights and improve future job matches.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            {/* Rejection Stage Dropdown */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[#f4f2ec]">
                Rejection Stage <span className="text-[#c4634e]">*</span>
              </label>
              <select
                value={selectedRejectionStage}
                onChange={(e) => setSelectedRejectionStage(e.target.value)}
                className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] px-3 py-1 text-xs text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
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
              <label className="font-semibold text-[#f4f2ec]">
                Primary Rejection Reason <span className="text-[#c4634e]">*</span>
              </label>
              <select
                value={selectedRejectionReason}
                onChange={(e) => setSelectedRejectionReason(e.target.value)}
                className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] px-3 py-1 text-xs text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
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
              <label className="font-semibold text-[#f4f2ec]">
                Recruiter Feedback / Notes (Optional)
              </label>
              <Textarea
                rows={3}
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="e.g. Requires 5+ years with Golang; team restructured."
                className="font-mono text-xs bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] placeholder:text-[#a6abbd] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRejectionModal(false)}
              className="rounded-[2px] border-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmRejection}
              disabled={isSubmittingRejection}
              className="gap-1.5 font-bold text-xs rounded-[2px] bg-[#c4634e] hover:bg-[#b0523e] text-white"
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
