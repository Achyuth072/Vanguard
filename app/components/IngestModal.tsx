"use client";

import { useState, useMemo } from "react";
import { ingestJob, overrideJobFilterAction } from "../actions";
import BottomSheet from "@/components/ui/bottom-sheet";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SUPPORTED_CURRENCIES } from "@/lib/utils/currency";
import { SUPPORTED_SOURCES, normalizeSource, detectSourceFromUrl } from "@/lib/utils/source";
import {
  FileText,
  Link2,
  PlusCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Building2,
  MapPin,
  DollarSign,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface IngestSuccessTarget {
  id: string;
  fitScore?: { score?: number | null } | null;
  status?: string;
  isRescue?: boolean;
}

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (target?: IngestSuccessTarget) => void;
  initialMode?: "paste" | "url" | "manual";
}

export default function IngestModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "paste",
}: IngestModalProps) {
  const [mode, setMode] = useState<"paste" | "url" | "manual">(initialMode);
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("MANUAL");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [remoteStatus, setRemoteStatus] = useState<"AUTO" | "REMOTE" | "HYBRID" | "ONSITE">("AUTO");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [currency, setCurrency] = useState("AUTO");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isRescuing, setIsRescuing] = useState(false);
  const [droppedJobInfo, setDroppedJobInfo] = useState<{
    job: { id: string; title: string; company: string };
    status: string;
    reasons: string[];
    recommendation?: string;
  } | null>(null);

  // Derived effective source
  const effectiveSource = useMemo(() => {
    if (source && source !== "MANUAL") return source;
    if (mode === "url") return detectSourceFromUrl(url) || "URL";
    if (mode === "manual") return "MANUAL";
    return "PASTE";
  }, [source, mode, url]);

  // Derived normalized preview data
  const previewData = useMemo(() => {
    const minNum = salaryMin.trim() ? Number(salaryMin.trim()) : null;
    const maxNum = salaryMax.trim() ? Number(salaryMax.trim()) : null;
    let compStr = "Unspecified";
    const currPrefix = currency === "AUTO" ? "" : `${currency} `;
    const currSuffix = currency === "AUTO" ? " (Auto-detect)" : "";
    if (minNum !== null && maxNum !== null) {
      compStr = `${currPrefix}${minNum.toLocaleString()} - ${maxNum.toLocaleString()}${currSuffix}`;
    } else if (minNum !== null) {
      compStr = `From ${currPrefix}${minNum.toLocaleString()}${currSuffix}`;
    } else if (maxNum !== null) {
      compStr = `Up to ${currPrefix}${maxNum.toLocaleString()}${currSuffix}`;
    }

    const effectiveTitle = title.trim() || (mode === "paste" && rawText.trim() ? "AI Extracted Role" : "Role Title Required");
    const effectiveCompany = company.trim() || (mode === "paste" && rawText.trim() ? "AI Extracted Company" : "Company Required");

    return {
      title: effectiveTitle,
      company: effectiveCompany,
      source: effectiveSource,
      location: location.trim() || (remoteStatus === "REMOTE" ? "Remote" : "Unspecified"),
      remoteStatus: remoteStatus !== "AUTO" ? remoteStatus : "AUTO-DETECT",
      compensation: compStr,
    };
  }, [title, company, mode, rawText, effectiveSource, location, remoteStatus, salaryMin, salaryMax, currency]);

  const resetFormAndClose = (target?: IngestSuccessTarget) => {
    setRawText("");
    setUrl("");
    setSource("MANUAL");
    setCompany("");
    setTitle("");
    setLocation("");
    setRemoteStatus("AUTO");
    setSalaryMin("");
    setSalaryMax("");
    setCurrency("AUTO");
    setShowAdvanced(false);
    setResultMessage(null);
    setDroppedJobInfo(null);
    setError(null);
    onClose();
    onSuccess?.(target);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResultMessage(null);
    setDroppedJobInfo(null);

    try {
      const parsedSalaryMin = salaryMin.trim() ? Number(salaryMin.trim()) : null;
      const parsedSalaryMax = salaryMax.trim() ? Number(salaryMax.trim()) : null;

      if (mode === "manual") {
        if (!company.trim() || !title.trim()) {
          setError("Company and Role Title are required for manual entry.");
          setIsLoading(false);
          return;
        }
      } else if (mode === "paste") {
        if (!rawText.trim()) {
          setError("Please paste the job description text.");
          setIsLoading(false);
          return;
        }
      } else if (mode === "url") {
        if (!url.trim()) {
          setError("Please enter a valid job URL.");
          setIsLoading(false);
          return;
        }
      }

      const payload = {
        source: effectiveSource,
        ...(mode === "url" ? { url: url.trim() } : {}),
        ...(mode === "paste" ? { rawText: rawText.trim() } : {}),
        ...(mode === "manual" && rawText.trim() ? { description: rawText.trim(), rawText: rawText.trim() } : {}),
        ...(company.trim() ? { company: company.trim() } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(remoteStatus !== "AUTO" ? { remoteStatus } : {}),
        ...(parsedSalaryMin !== null && !isNaN(parsedSalaryMin) ? { salaryMin: parsedSalaryMin } : {}),
        ...(parsedSalaryMax !== null && !isNaN(parsedSalaryMax) ? { salaryMax: parsedSalaryMax } : {}),
        ...(currency && currency !== "AUTO" ? { currency } : {}),
      };

      const res = await ingestJob(payload);
      if (res && res.job) {
        const isFilteredOut = res.status === "FILTERED_OUT" || res.filterResult?.passed === false;
        const isIgnored = res.fitScore?.recommendation === "IGNORE";

        if (isFilteredOut || isIgnored) {
          const reasons: string[] = [];
          if (res.filterResult?.reasons && res.filterResult.reasons.length > 0) {
            reasons.push(...res.filterResult.reasons);
          }
          if (isIgnored && res.fitScore?.reasoning) {
            reasons.push(`AI Fit Recommendation is IGNORE: ${res.fitScore.reasoning}`);
          }
          if (reasons.length === 0) {
            reasons.push("Job failed candidate targeting constraints and was dropped.");
          }

          setDroppedJobInfo({
            job: res.job,
            status: res.status,
            reasons,
            recommendation: res.fitScore?.recommendation,
          });
          return;
        }

        const scoreText = res.fitScore ? `Fit Score: ${res.fitScore.score}/100 (${res.fitScore.recommendation})` : "Ingested & Staged";
        setResultMessage(`✓ Successfully ingested "${res.job.title}" at ${res.job.company}. ${scoreText}`);
        setTimeout(() => {
          resetFormAndClose({
            id: res.job.id,
            fitScore: res.fitScore,
            status: res.status,
          });
        }, 1500);
      } else {
        setError("Job ingestion did not return a valid record.");
      }
    } catch (err: unknown) {
      console.error("Ingestion error:", err);
      setError(err instanceof Error ? err.message : "Failed to ingest job.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <BottomSheet
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      desktopClassName="sm:max-w-2xl border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] p-6 gap-5"
      mobileClassName="bg-[#15171d] px-4 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
        <SheetHeader className="shrink-0 space-y-1.5 pb-3 pr-8 border-b border-[#2a2e38] text-left">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#d4a745]">
              JOB INGESTION CONSOLE
            </span>
          </div>
          <SheetTitle className="text-lg font-bold tracking-tight text-[#f4f2ec]">
            Ingest Target Opportunity
          </SheetTitle>
          <SheetDescription className="text-xs text-[#a6abbd]">
            Extract role metadata, normalize telemetry, and trigger AI fit scoring into your priority inbox.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {/* Tabbed Mode Selector */}
        <div className="flex rounded-[2px] bg-[#0d0e12] p-1 border border-[#2a2e38] text-xs font-mono font-semibold gap-1">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-[2px] flex items-center justify-center gap-1.5 transition-all text-xs focus-visible:outline-2 focus-visible:outline-[#d4a745]",
              mode === "paste"
                ? "bg-[#1f222a] text-[#f4f2ec] border border-[#3d4352]"
                : "text-[#a6abbd] hover:text-[#f4f2ec]"
            )}
          >
            <FileText className="w-3.5 h-3.5 text-[#d4a745]" />
            <span>01 · PASTE TEXT</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-[2px] flex items-center justify-center gap-1.5 transition-all text-xs focus-visible:outline-2 focus-visible:outline-[#d4a745]",
              mode === "url"
                ? "bg-[#1f222a] text-[#f4f2ec] border border-[#3d4352]"
                : "text-[#a6abbd] hover:text-[#f4f2ec]"
            )}
          >
            <Link2 className="w-3.5 h-3.5 text-[#d4a745]" />
            <span>02 · DIRECT URL</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-[2px] flex items-center justify-center gap-1.5 transition-all text-xs focus-visible:outline-2 focus-visible:outline-[#d4a745]",
              mode === "manual"
                ? "bg-[#1f222a] text-[#f4f2ec] border border-[#3d4352]"
                : "text-[#a6abbd] hover:text-[#f4f2ec]"
            )}
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#d4a745]" />
            <span>03 · MANUAL ENTRY</span>
          </button>
        </div>

        {/* Real-time Extraction Preview Card */}
        <div className="bg-[#0d0e12] border border-[#2a2e38] p-3.5 rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
            <span className="text-[#a6abbd] flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-[#d4a745] animate-pulse" />
              <span>REAL-TIME EXTRACTION PREVIEW</span>
            </span>
            <span className="text-[#d4a745] uppercase">{previewData.source}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="font-semibold text-xs text-[#f4f2ec]">
              {previewData.title}
            </span>
            <span className="text-xs text-[#d4a745] font-semibold">
              @ {previewData.company}
            </span>
            <span className="text-xs text-[#a6abbd]">·</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#a6abbd]">
              {previewData.location}
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#a6abbd]">
              {previewData.remoteStatus}
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#8ab384]">
              {previewData.compensation}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-[2px] bg-[#0d0e12] border border-[#c4634e] text-[#c4634e] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#c4634e]" />
            <span>{error}</span>
          </div>
        )}

        {resultMessage && (
          <div className="p-3 rounded-[2px] bg-[#0d0e12] border border-[#8ab384] text-[#8ab384] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#8ab384]" />
            <span>{resultMessage}</span>
          </div>
        )}

        {droppedJobInfo && (
          <div className="p-3.5 rounded-[2px] bg-[#d4a745]/10 border border-[#d4a745]/40 text-xs font-mono space-y-3">
            <div className="flex items-start gap-2.5 text-[#d4a745]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-[#f4f2ec]">
                  Target Opportunity Filtered Out &amp; Dropped
                </p>
                <p className="text-xs text-[#d4a745] mt-0.5">
                  &ldquo;{droppedJobInfo.job.title}&rdquo; at {droppedJobInfo.job.company} failed your candidate constraints and will not appear in the Priority Inbox.
                </p>
              </div>
            </div>

            <div className="bg-[#0d0e12] p-2.5 rounded-[2px] border border-[#2a2e38] space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#a6abbd]">
                Detection Rationale / Filter Reasons:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[#f4f2ec]">
                {droppedJobInfo.reasons.map((reason, idx) => (
                  <li key={idx} className="text-xs leading-relaxed">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#2a2e38]">
              <button
                type="button"
                onClick={() => resetFormAndClose()}
                className="px-3 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#15171d] text-[#a6abbd] hover:text-[#f4f2ec] hover:border-[#3d4352] text-xs font-mono transition-colors"
              >
                Keep Filtered
              </button>
              <button
                type="button"
                disabled={isRescuing}
                onClick={async () => {
                  setIsRescuing(true);
                  setError(null);
                  try {
                    const rescuedJobId = droppedJobInfo.job.id;
                    const rescuedJobTitle = droppedJobInfo.job.title;
                    await overrideJobFilterAction(
                      rescuedJobId,
                      "SHORTLISTED",
                      "Candidate manual rescue from Ingest Console"
                    );
                    setDroppedJobInfo(null);
                    setResultMessage(`✓ Successfully rescued "${rescuedJobTitle}" into Priority Inbox!`);
                    setTimeout(() => {
                      resetFormAndClose({
                        id: rescuedJobId,
                        fitScore: { score: 85 },
                        status: "SHORTLISTED",
                        isRescue: true,
                      });
                    }, 1200);
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : "Failed to override filter");
                  } finally {
                    setIsRescuing(false);
                  }
                }}
                className="px-3 py-1.5 rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] font-bold text-xs font-mono transition-all flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#d4a745]"
              >
                {isRescuing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rescuing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Rescue &amp; Move to Inbox</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "paste" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#a6abbd]">
                Job Description Text *
              </label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the full job posting, requirements, and responsibilities here..."
                rows={6}
                required
                className="font-mono text-xs resize-none bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] rounded-[2px]"
              />
            </div>
          )}

          {mode === "url" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#a6abbd]">
                  Job Posting URL *
                </label>
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    const newUrl = e.target.value;
                    setUrl(newUrl);
                    const detected = detectSourceFromUrl(newUrl);
                    if (detected) {
                      setSource(detected);
                    }
                  }}
                  placeholder="https://jobs.example.com/roles/ai-engineer"
                  required
                  className="font-mono text-xs bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] rounded-[2px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#a6abbd]">
                  Source Platform
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full h-9 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#f4f2ec] font-mono text-xs px-2.5 outline-none focus:border-[#d4a745] cursor-pointer"
                >
                  {SUPPORTED_SOURCES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Primary Fields: Company & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Company {mode === "manual" ? "*" : "(Optional override)"}
              </label>
              <Input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Anthropic"
                required={mode === "manual"}
                className="text-xs bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Role Title {mode === "manual" ? "*" : "(Optional override)"}
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI Systems Engineer"
                required={mode === "manual"}
                className="text-xs bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
              />
            </div>
            {mode !== "url" && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#a6abbd]">
                  Source
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full h-9 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#f4f2ec] font-mono text-xs px-2.5 outline-none focus:border-[#d4a745] cursor-pointer"
                >
                  {SUPPORTED_SOURCES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Details / Overrides Section: Always expanded for Manual mode, Collapsible for Paste/URL */}
          {mode === "manual" ? (
            <div className="border border-[#2a2e38] rounded-[2px] p-3.5 bg-[#0d0e12] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#a6abbd]">
                    Location (Optional)
                  </label>
                  <Input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. San Francisco, CA"
                    className="text-xs bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#a6abbd]">
                    Work Mode
                  </label>
                  <select
                    value={remoteStatus}
                    onChange={(e) => setRemoteStatus(e.target.value as "AUTO" | "REMOTE" | "HYBRID" | "ONSITE")}
                    className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#15171d] px-2 py-1 text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                  >
                    <option value="AUTO">Auto / Unspecified</option>
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ONSITE">Onsite</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#a6abbd]">
                    Min Salary
                  </label>
                  <Input
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="e.g. 120000"
                    className="text-xs font-mono bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#a6abbd]">
                    Max Salary
                  </label>
                  <Input
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="e.g. 160000"
                    className="text-xs font-mono bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#a6abbd]">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#15171d] px-2 py-1 text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                  >
                    <option value="AUTO">Auto-detect from JD</option>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#a6abbd]">
                  Description / Notes (Optional)
                </label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Key responsibilities, team details, or notes about this opportunity..."
                  rows={3}
                  className="font-mono text-xs resize-none bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                />
              </div>
            </div>
          ) : (
            <div className="border border-[#2a2e38] rounded-[2px] p-3 bg-[#0d0e12]">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-xs font-mono font-semibold text-[#a6abbd] hover:text-[#f4f2ec] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[#d4a745]">⚡</span>
                  Manual Overrides (Location, Work Mode, Salary)
                </span>
                <span className="text-[11px] text-[#a6abbd] font-mono">
                  {showAdvanced ? "Hide ▲" : "Show ▼"}
                </span>
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 pt-3 border-t border-[#2a2e38]">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#a6abbd]">
                        Location
                      </label>
                      <Input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. San Francisco, CA"
                        className="text-xs bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#a6abbd]">
                        Work Mode
                      </label>
                      <select
                        value={remoteStatus}
                        onChange={(e) => setRemoteStatus(e.target.value as "AUTO" | "REMOTE" | "HYBRID" | "ONSITE")}
                        className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#15171d] px-2 py-1 text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                      >
                        <option value="AUTO">Auto-detect from JD</option>
                        <option value="REMOTE">Remote</option>
                        <option value="HYBRID">Hybrid</option>
                        <option value="ONSITE">Onsite</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#a6abbd]">
                        Min Salary
                      </label>
                      <Input
                        type="number"
                        value={salaryMin}
                        onChange={(e) => setSalaryMin(e.target.value)}
                        placeholder="e.g. 120000"
                        className="text-xs font-mono bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#a6abbd]">
                        Max Salary
                      </label>
                      <Input
                        type="number"
                        value={salaryMax}
                        onChange={(e) => setSalaryMax(e.target.value)}
                        placeholder="e.g. 160000"
                        className="text-xs font-mono bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#a6abbd]">
                        Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#15171d] px-2 py-1 text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                      >
                        <option value="AUTO">Auto-detect from JD</option>
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <SheetFooter className="pt-2 border-t border-[#2a2e38]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#0d0e12] text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#1f222a]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="gap-2 font-bold text-xs bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin h-3.5 w-3.5 text-[#0d0e12]" />
                  <span>Extracting &amp; Scoring with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ingest &amp; Evaluate</span>
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
        </div>
    </BottomSheet>
  );
}
