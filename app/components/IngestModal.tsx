"use client";

import { useState, useMemo } from "react";
import { ingestJob } from "../actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Sparkles,
  Building2,
  MapPin,
  DollarSign,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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
  const [currency, setCurrency] = useState("USD");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

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
    if (minNum !== null && maxNum !== null) {
      compStr = `${currency} ${minNum.toLocaleString()} - ${maxNum.toLocaleString()}`;
    } else if (minNum !== null) {
      compStr = `From ${currency} ${minNum.toLocaleString()}`;
    } else if (maxNum !== null) {
      compStr = `Up to ${currency} ${maxNum.toLocaleString()}`;
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResultMessage(null);

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
        ...(currency ? { currency } : {}),
      };

      const res = await ingestJob(payload);
      if (res && res.job) {
        const scoreText = res.fitScore ? `Fit Score: ${res.fitScore.score}/100 (${res.fitScore.recommendation})` : "Ingested & Staged";
        setResultMessage(`✓ Successfully ingested "${res.job.title}" at ${res.job.company}. ${scoreText}`);
        setTimeout(() => {
          setRawText("");
          setUrl("");
          setSource("MANUAL");
          setCompany("");
          setTitle("");
          setLocation("");
          setRemoteStatus("AUTO");
          setSalaryMin("");
          setSalaryMax("");
          setCurrency("USD");
          setShowAdvanced(false);
          setResultMessage(null);
          onClose();
          if (onSuccess) onSuccess();
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] p-6 max-h-[90vh] overflow-y-auto rounded-[3px] shadow-none gap-5">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-[#2a2e38] text-left">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#d4a745]">
              JOB INGESTION CONSOLE
            </span>
          </div>
          <DialogTitle className="text-lg font-bold tracking-tight text-[#f4f2ec]">
            Ingest Target Opportunity
          </DialogTitle>
          <DialogDescription className="text-xs text-[#a6abbd]">
            Extract role metadata, normalize telemetry, and trigger AI fit scoring into your priority inbox.
          </DialogDescription>
        </DialogHeader>

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

          <DialogFooter className="pt-2 border-t border-[#2a2e38]">
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
