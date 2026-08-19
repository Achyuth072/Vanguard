"use client";

import { useState, useEffect } from "react";
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
  const [salaryMin, setSalaryMin] = useState<string>("");
  const [salaryMax, setSalaryMax] = useState<string>("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [rerunAI, setRerunAI] = useState(true);
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
      setSalaryMin(job.salaryMin !== null && job.salaryMin !== undefined ? String(job.salaryMin) : "");
      setSalaryMax(job.salaryMax !== null && job.salaryMax !== undefined ? String(job.salaryMax) : "");
      setUrl(job.url || "");
      setDescription(job.description || "");
      setRerunAI(true);
      setError(null);
      setSuccessMessage(null);
    }
  }, [job, isOpen]);

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
        salaryMin: isNaN(parsedMin as number) ? null : parsedMin,
        salaryMax: isNaN(parsedMax as number) ? null : parsedMax,
        url: url.trim(),
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-900 text-zinc-100 p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-zinc-800/80">
          <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Job Details
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Tweak title, company, compensation, location, or listing text for this job opportunity.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Title & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Role Title *
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                required
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Company *
              </label>
              <Input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Cloud"
                required
                className="text-xs"
              />
            </div>
          </div>

          {/* Row 2: Location, Remote Status & Employment Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Location
              </label>
              <Input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA"
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Remote Status
              </label>
              <select
                value={remoteStatus}
                onChange={(e) => setRemoteStatus(e.target.value)}
                className="w-full h-8 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs px-2.5 outline-none focus:border-zinc-700 cursor-pointer"
              >
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ONSITE">On-site</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full h-8 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs px-2.5 outline-none focus:border-zinc-700 cursor-pointer"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="PART_TIME">Part Time</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </div>
          </div>

          {/* Row 3: Salary Min & Max ($) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Minimum Salary ($ / yr)
              </label>
              <Input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="e.g. 140000"
                min={0}
                step={1000}
                className="text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Maximum Salary ($ / yr)
              </label>
              <Input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="e.g. 180000"
                min={0}
                step={1000}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 4: URL */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
              Job URL
            </label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://company.com/careers/job-id"
              className="text-xs font-mono"
            />
          </div>

          {/* Row 5: Description */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
              Job Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Full role description and requirements..."
              rows={6}
              className="font-mono text-xs resize-none"
            />
          </div>

          {/* Row 6: Re-evaluate with AI checkbox */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-zinc-950/80 border border-zinc-800">
            <input
              type="checkbox"
              id="rerun-ai-fit-score"
              checked={rerunAI}
              onChange={(e) => setRerunAI(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-zinc-950 cursor-pointer"
            />
            <label htmlFor="rerun-ai-fit-score" className="text-xs text-zinc-300 font-medium cursor-pointer select-none">
              Re-evaluate candidate Fit Score with AI after saving
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="gap-2 font-semibold"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-zinc-900" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{rerunAI ? "Evaluating & Saving..." : "Saving..."}</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

