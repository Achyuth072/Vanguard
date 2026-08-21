"use client";

import { useState, useEffect, useMemo } from "react";
import type { EnrichedJob } from "@/lib/data";
import { updateJobDetailsAction } from "../actions";
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
  Edit3,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Radio,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditJobModalProps {
  job: EnrichedJob | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditJobModal({
  job,
  isOpen,
  onClose,
  onSuccess,
}: EditJobModalProps) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [remoteStatus, setRemoteStatus] = useState("UNKNOWN");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [currency, setCurrency] = useState("INR");
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("MANUAL");
  const [description, setDescription] = useState("");
  const [rerunAI, setRerunAI] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (job && isOpen) {
      setTitle(job.title || "");
      setCompany(job.company || "");
      setLocation(job.location || "");
      setRemoteStatus(job.remoteStatus || "UNKNOWN");
      setEmploymentType(job.employmentType || "FULL_TIME");
      setCurrency(job.currency || "INR");
      setSalaryMin(job.salaryMin !== null && job.salaryMin !== undefined ? String(job.salaryMin) : "");
      setSalaryMax(job.salaryMax !== null && job.salaryMax !== undefined ? String(job.salaryMax) : "");
      setUrl(job.url || "");
      setSource(job.source ? normalizeSource(job.source, job.url) : "MANUAL");
      setDescription(job.description || "");
      setRerunAI(false);
      setError(null);
      setSuccessMessage(null);
    }
  }, [job, isOpen]);

  // Derived normalized preview data
  const previewData = useMemo(() => {
    const minNum = salaryMin.trim() ? Number(salaryMin.replace(/[^0-9]/g, "")) : null;
    const maxNum = salaryMax.trim() ? Number(salaryMax.replace(/[^0-9]/g, "")) : null;
    let compStr = "Unspecified";
    if (minNum !== null && maxNum !== null) {
      compStr = `${currency} ${minNum.toLocaleString()} - ${maxNum.toLocaleString()}`;
    } else if (minNum !== null) {
      compStr = `From ${currency} ${minNum.toLocaleString()}`;
    } else if (maxNum !== null) {
      compStr = `Up to ${currency} ${maxNum.toLocaleString()}`;
    }

    return {
      title: title.trim() || "Role Title Required",
      company: company.trim() || "Company Required",
      source: source || "MANUAL",
      location: location.trim() || (remoteStatus === "REMOTE" ? "Remote" : "Unspecified"),
      remoteStatus: remoteStatus !== "UNKNOWN" ? remoteStatus : "UNSPECIFIED",
      compensation: compStr,
    };
  }, [title, company, source, location, remoteStatus, salaryMin, salaryMax, currency]);

  if (!job) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const parsedMin = salaryMin.trim() ? parseInt(salaryMin.replace(/[^0-9]/g, ""), 10) : null;
      const parsedMax = salaryMax.trim() ? parseInt(salaryMax.replace(/[^0-9]/g, ""), 10) : null;

      const payload = {
        title: title.trim(),
        company: company.trim(),
        location: location.trim(),
        remoteStatus,
        employmentType,
        currency,
        salaryMin: isNaN(parsedMin as number) ? null : parsedMin,
        salaryMax: isNaN(parsedMax as number) ? null : parsedMax,
        url: url.trim(),
        source: source.trim(),
        description: description.trim(),
      };

      const result = await updateJobDetailsAction(job.id, payload, { rescore: rerunAI });

      if (result.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError("Failed to update job details.");
      }
    } catch (err: unknown) {
      console.error("Job update error:", err);
      setError(err instanceof Error ? err.message : "Failed to update job.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] p-6 rounded-[3px] shadow-none gap-5">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-[#2a2e38] text-left">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#d4a745]">
              JOB RECORD EDITOR
            </span>
          </div>
          <DialogTitle className="text-lg font-bold tracking-tight text-[#f4f2ec] flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#d4a745]" />
            <span>Edit Target Opportunity</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#a6abbd]">
            Tweak title, company, compensation, location, or raw description with optional AI re-scoring.
          </DialogDescription>
        </DialogHeader>

        {/* Real-time Normalized Preview Card */}
        <div className="bg-[#0d0e12] border border-[#2a2e38] p-3.5 rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
            <span className="text-[#a6abbd] flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-[#d4a745] animate-pulse" />
              <span>NORMALIZED PREVIEW</span>
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

        {successMessage && (
          <div className="p-3 rounded-[2px] bg-[#0d0e12] border border-[#8ab384] text-[#8ab384] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#8ab384]" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Title & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Role Title *
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                required
                className="text-xs bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Company *
              </label>
              <Input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Cloud"
                required
                className="text-xs bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
              />
            </div>
          </div>

          {/* Row 2: Location, Remote Status & Employment Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Location
              </label>
              <Input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA"
                className="text-xs bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Remote Status
              </label>
              <select
                value={remoteStatus}
                onChange={(e) => setRemoteStatus(e.target.value)}
                className="w-full h-9 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#f4f2ec] font-mono text-xs px-2.5 outline-none focus:border-[#d4a745] cursor-pointer"
              >
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ONSITE">On-site</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full h-9 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#f4f2ec] font-mono text-xs px-2.5 outline-none focus:border-[#d4a745] cursor-pointer"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="PART_TIME">Part Time</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </div>
          </div>

          {/* Row 3: Currency, Salary Min & Max */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-9 rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] px-3 text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Minimum Salary / yr
              </label>
              <Input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder={currency === "INR" ? "e.g. 1200000" : "e.g. 120000"}
                min={0}
                className="text-xs font-mono bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Maximum Salary / yr
              </label>
              <Input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder={currency === "INR" ? "e.g. 1800000" : "e.g. 180000"}
                min={0}
                className="text-xs font-mono bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
              />
            </div>
          </div>

          {/* Row 4: URL & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
                Job URL
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => {
                  const newUrl = e.target.value;
                  setUrl(newUrl);
                  const detected = detectSourceFromUrl(newUrl);
                  if (detected && (source === "MANUAL" || source === "OTHER" || source === "URL")) {
                    setSource(detected);
                  }
                }}
                placeholder="https://company.com/careers/job-id"
                className="text-xs font-mono bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#a6abbd]">
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

          {/* Row 5: Description */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#a6abbd]">
              Job Description Text
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full role description and requirements..."
              rows={6}
              className="font-mono text-xs resize-none bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
            />
          </div>

          {/* Row 6: Re-evaluate with AI checkbox */}
          <div className="flex items-center gap-2.5 p-3 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38]">
            <input
              type="checkbox"
              id="rerun-ai-fit-score"
              checked={rerunAI}
              onChange={(e) => setRerunAI(e.target.checked)}
              className="w-4 h-4 rounded-[2px] border-[#2a2e38] bg-[#15171d] text-[#d4a745] focus:ring-[#d4a745] cursor-pointer"
            />
            <label htmlFor="rerun-ai-fit-score" className="text-xs text-[#f4f2ec] font-medium cursor-pointer select-none">
              Re-evaluate candidate Fit Score with AI synthesis after saving
            </label>
          </div>

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
                  <span>{rerunAI ? "Evaluating & Saving..." : "Saving..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
