"use client";

import { useState, useEffect } from "react";
import {
  getScoringFeedbackLoopState,
  getScoringWeightHistory,
  updateScoringWeights,
  applySuggestedWeights,
  resetScoringWeights,
} from "@/app/settings/actions";
import type {
  CalibrationResult,
  WeightHistoryEntry,
} from "@/lib/scoring/feedback-loop";
import {
  DEFAULT_FIT_SCORE_WEIGHTS,
  type FitScoreWeights,
} from "@/lib/scoring/fit-score";

interface DimensionItem {
  key: keyof FitScoreWeights;
  label: string;
  description: string;
}

const DIMENSIONS: DimensionItem[] = [
  {
    key: "skills",
    label: "Skills Fit",
    description: "Alignment with required tech stack and core competencies",
  },
  {
    key: "experience",
    label: "Experience Fit",
    description: "Seniority level, scope, and years of experience",
  },
  {
    key: "domain",
    label: "Domain Fit",
    description: "Industry vertical, business model, and domain relevance",
  },
  {
    key: "trajectory",
    label: "Trajectory Fit",
    description: "Growth suitability, progression, and lateral alignment",
  },
];

export default function ScoringFeedbackLoopSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<CalibrationResult | null>(null);
  const [weights, setWeights] = useState<FitScoreWeights>(DEFAULT_FIT_SCORE_WEIGHTS);
  const [locked, setLocked] = useState<Partial<Record<keyof FitScoreWeights, boolean>>>({});
  const [history, setHistory] = useState<WeightHistoryEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [loopState, historyData] = await Promise.all([
        getScoringFeedbackLoopState(),
        getScoringWeightHistory(),
      ]);
      setState(loopState);
      setWeights(loopState.currentWeights);
      setHistory(historyData);
    } catch (err) {
      console.error("Failed to load scoring feedback loop data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleSliderChange(key: keyof FitScoreWeights, value: number) {
    if (locked[key]) return;
    setWeights((prev) => ({
      ...prev,
      [key]: value / 100,
    }));
  }

  function toggleLock(key: keyof FitScoreWeights) {
    setLocked((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  const currentSum = Math.round(
    (weights.skills + weights.experience + weights.domain + weights.trajectory) * 100
  );

  async function handleSaveManual() {
    try {
      setSaving(true);
      setStatusMessage("Saving weights...");
      const res = await updateScoringWeights(weights, locked);
      if (res.success) {
        setWeights(res.weights);
        setStatusMessage("Weights updated successfully!");
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update weights";
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }

  async function handleApplySuggested() {
    if (!state) return;
    try {
      setSaving(true);
      setStatusMessage("Applying calibrated drift...");
      const res = await applySuggestedWeights(state.calibratedWeights, locked);
      if (res.success) {
        setWeights(res.weights);
        setStatusMessage("Calibrated weights applied!");
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply suggested weights";
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }

  async function handleResetDefaults() {
    try {
      setSaving(true);
      setStatusMessage("Resetting to baseline defaults...");
      const res = await resetScoringWeights();
      if (res.success) {
        setWeights(res.weights);
        setLocked({});
        setStatusMessage("Reset to default baseline weights!");
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset weights";
      setStatusMessage(`Error: ${msg}`);
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }

  const getPhaseBadge = () => {
    if (!state) return null;
    if (state.phase === "COLD_START") {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/70 border border-blue-800 text-blue-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span>Phase 0: Cold Start ({state.sampleSize}/10 outcomes)</span>
        </div>
      );
    }
    if (state.phase === "SUGGESTED") {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/70 border border-amber-800 text-amber-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Phase 1: Suggested Drift ({state.sampleSize} outcomes)</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>Phase 2: Automated Bayesian Loop ({state.sampleSize} outcomes)</span>
      </div>
    );
  };

  return (
    <div className="bg-[#111] p-6 rounded-xl border border-neutral-800 space-y-6">
      {/* Header & Phase Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-900">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            <h2 className="text-base font-bold text-white tracking-tight">
              Adaptive Scoring & Feedback Loop
            </h2>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Calibrates sub-dimension weights via regularized Bayesian drift from real application outcomes.
          </p>
        </div>

        {getPhaseBadge()}
      </div>

      {loading ? (
        <div className="text-xs text-neutral-500 py-6 text-center animate-pulse">
          Loading scoring calibration metrics...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sub-Dimension Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DIMENSIONS.map((dim) => {
              const currentVal = Math.round((weights[dim.key] || 0) * 100);
              const suggestedVal = state
                ? Math.round((state.calibratedWeights[dim.key] || 0) * 100)
                : currentVal;
              const deltaVal = state
                ? Math.round((state.dimensionConversionDeltas[dim.key] || 0) * 100)
                : 0;
              const isLocked = !!locked[dim.key];

              return (
                <div
                  key={dim.key}
                  className={`p-4 rounded-xl border transition-all ${
                    isLocked
                      ? "bg-[#141414] border-purple-900/60"
                      : "bg-[#161616] border-neutral-800/80 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{dim.label}</span>
                      <button
                        type="button"
                        onClick={() => toggleLock(dim.key)}
                        title={isLocked ? "Pinned / Locked (Click to unlock)" : "Unlocked (Click to pin/lock weight)"}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                          isLocked
                            ? "bg-purple-950/80 border-purple-700 text-purple-300 font-semibold"
                            : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300"
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isLocked ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          )}
                        </svg>
                        <span>{isLocked ? "Pinned" : "Lock"}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-white">
                        {currentVal}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-500 mb-3 leading-relaxed">
                    {dim.description}
                  </p>

                  {/* Interactive Range Slider */}
                  <div className="space-y-1.5">
                    <input
                      type="range"
                      min="10"
                      max="50"
                      step="1"
                      disabled={isLocked}
                      value={currentVal}
                      onChange={(e) => handleSliderChange(dim.key, Number(e.target.value))}
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-neutral-600">
                      <span>10%</span>
                      <span>30%</span>
                      <span>50%</span>
                    </div>
                  </div>

                  {/* Conversion Delta & Suggestion Badges */}
                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-neutral-800/60 text-[10px]">
                    <div className="text-neutral-500">
                      Outcome Delta:{" "}
                      <span
                        className={`font-mono font-semibold ${
                          deltaVal > 0
                            ? "text-emerald-400"
                            : deltaVal < 0
                            ? "text-amber-400"
                            : "text-neutral-400"
                        }`}
                      >
                        {deltaVal > 0 ? `+${deltaVal}%` : `${deltaVal}%`}
                      </span>
                    </div>

                    {state && state.phase !== "COLD_START" && suggestedVal !== currentVal && (
                      <div className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300 font-mono text-[10px]">
                        Suggested: {suggestedVal}% ({suggestedVal > currentVal ? `+${suggestedVal - currentVal}%` : `${suggestedVal - currentVal}%`})
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weight Sum & Control Bar */}
          <div className="bg-[#141414] p-4 rounded-xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-xs">
                <span className="text-neutral-500">Total Sum: </span>
                <span
                  className={`font-mono font-bold ${
                    currentSum === 100 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {currentSum}%
                </span>
                {currentSum !== 100 && (
                  <span className="text-[10px] text-amber-500 ml-2">
                    (Must equal 100% — will auto-normalize on save)
                  </span>
                )}
              </div>

              {statusMessage && (
                <div className="text-xs text-purple-300 animate-pulse font-medium">
                  {statusMessage}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Reset to Defaults
              </button>

              {state && state.hasChanges && state.phase !== "COLD_START" && (
                <button
                  type="button"
                  onClick={handleApplySuggested}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-purple-950/80 border border-purple-800 hover:bg-purple-900 text-purple-300 text-xs font-bold transition-all disabled:opacity-50"
                >
                  Apply Suggested ({state.sampleSize} outcomes)
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveManual}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Weights"}
              </button>
            </div>
          </div>

          {/* Calibrated Conversion Insights Prompt Injection Preview */}
          {state && state.insights ? (
            <div className="bg-[#141414] p-4 rounded-xl border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Active AI System Prompt Injection
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  Statistical clustering &ge; 15 apps
                </span>
              </div>
              <pre className="p-3 bg-black rounded-lg border border-neutral-900 text-[11px] font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {state.insights}
              </pre>
            </div>
          ) : null}

          {/* Weight Change History */}
          {history.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Weight Calibration History
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg bg-[#141414] border border-neutral-900 flex items-center justify-between text-xs gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-200">{entry.reason || entry.eventType}</span>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-3">
                        <span>Skills: {Math.round(entry.weights.skills * 100)}%</span>
                        <span>Exp: {Math.round(entry.weights.experience * 100)}%</span>
                        <span>Domain: {Math.round(entry.weights.domain * 100)}%</span>
                        <span>Traj: {Math.round(entry.weights.trajectory * 100)}%</span>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 shrink-0">
                      {entry.eventType.replace("WEIGHTS_", "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
