"use client";

import { useState } from "react";
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

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: "paste" | "url" | "manual";
}

export default function IngestModal({ isOpen, onClose, onSuccess, initialMode = "paste" }: IngestModalProps) {
  const [mode, setMode] = useState<"paste" | "url" | "manual">(initialMode);
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
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
        source: mode === "url" ? "URL" : mode === "manual" ? "MANUAL" : "PASTE",
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
      <DialogContent className="sm:max-w-xl border-zinc-800 bg-zinc-900 text-zinc-100 p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-zinc-800/80">
          <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            Ingest Target Job
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Paste JD text, provide a URL, or enter details manually. AI extracts details & scores candidate fit automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector */}
        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              mode === "paste"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Paste JD
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              mode === "url"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Job URL
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              mode === "manual"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Manual Entry
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {resultMessage && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{resultMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "paste" && (
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Job Description Text *
              </label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the full job posting, requirements, and responsibilities here..."
                rows={6}
                required
                className="font-mono text-xs resize-none"
              />
            </div>
          )}

          {mode === "url" && (
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-400 mb-1.5">
                Job Posting URL *
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://jobs.example.com/roles/ai-engineer"
                required
                className="font-mono text-xs"
              />
            </div>
          )}

          {/* Primary Fields: Company & Title */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                Company {mode === "manual" ? "*" : "(Optional override)"}
              </label>
              <Input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Anthropic"
                required={mode === "manual"}
                className="text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                Role Title {mode === "manual" ? "*" : "(Optional override)"}
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI Systems Engineer"
                required={mode === "manual"}
                className="text-xs"
              />
            </div>
          </div>

          {/* Details / Overrides Section: Always expanded for Manual mode, Collapsible for Paste/URL */}
          {mode === "manual" ? (
            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-950/40 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                    Location (Optional)
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
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                    Work Mode
                  </label>
                  <select
                    value={remoteStatus}
                    onChange={(e) => setRemoteStatus(e.target.value as "AUTO" | "REMOTE" | "HYBRID" | "ONSITE")}
                    className="flex h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                  >
                    <option value="AUTO">Auto / Unspecified</option>
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ONSITE">Onsite</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                    Min Salary
                  </label>
                  <Input
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="e.g. 120000"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                    Max Salary
                  </label>
                  <Input
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="e.g. 160000"
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="SGD">SGD ($)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                  Description / Notes (Optional)
                </label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Key responsibilities, team details, or notes about this opportunity..."
                  rows={3}
                  className="font-mono text-xs resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-950/40">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-violet-400">⚡</span>
                  Additional Manual Overrides (Location, Work Mode, Salary)
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {showAdvanced ? "Hide ▲" : "Show ▼"}
                </span>
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 pt-2 border-t border-zinc-800/60">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
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
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                        Work Mode
                      </label>
                      <select
                        value={remoteStatus}
                        onChange={(e) => setRemoteStatus(e.target.value as "AUTO" | "REMOTE" | "HYBRID" | "ONSITE")}
                        className="flex h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                      >
                        <option value="AUTO">Auto-detect from JD</option>
                        <option value="REMOTE">Remote</option>
                        <option value="HYBRID">Hybrid</option>
                        <option value="ONSITE">Onsite</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                        Min Salary
                      </label>
                      <Input
                        type="number"
                        value={salaryMin}
                        onChange={(e) => setSalaryMin(e.target.value)}
                        placeholder="e.g. 120000"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                        Max Salary
                      </label>
                      <Input
                        type="number"
                        value={salaryMax}
                        onChange={(e) => setSalaryMax(e.target.value)}
                        placeholder="e.g. 160000"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                        Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="INR">INR (₹)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CAD">CAD ($)</option>
                        <option value="AUD">AUD ($)</option>
                        <option value="SGD">SGD ($)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                  <span>Scoring with AI...</span>
                </>
              ) : (
                <span>Ingest & Evaluate</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

