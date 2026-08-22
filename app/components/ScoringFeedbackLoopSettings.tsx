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
import {
  Lock,
  Unlock,
  RotateCcw,
  Sparkles,
  Check,
  Sliders,
  History,
  Terminal,
} from "lucide-react";

interface DimensionItem {
  code: string;
  key: keyof FitScoreWeights;
  label: string;
  description: string;
}

const DIMENSIONS: DimensionItem[] = [
  {
    code: "01",
    key: "skills",
    label: "Skills Fit",
    description: "Alignment with required tech stack, core proficiencies, and tools",
  },
  {
    code: "02",
    key: "experience",
    label: "Experience Fit",
    description: "Seniority ceiling, scope of impact, and verified years of experience",
  },
  {
    code: "03",
    key: "domain",
    label: "Domain Fit",
    description: "Industry vertical, business model, and operational domain relevance",
  },
  {
    code: "04",
    key: "trajectory",
    label: "Trajectory Fit",
    description: "Career progression, growth suitability, and lateral alignment",
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
        setStatusMessage("Weights updated successfully");
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
        setStatusMessage("Calibrated weights applied");
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
        setStatusMessage("Reset to default baseline weights");
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
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#a6abbd] text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a6abbd]"></span>
          <span>PHASE 0 · COLD START ({state.sampleSize}/10 OUTCOMES)</span>
        </div>
      );
    }
    if (state.phase === "SUGGESTED") {
      return (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#d4a745]/15 border border-[#d4a745]/40 text-[#d4a745] text-xs font-mono font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4a745] animate-pulse"></span>
          <span>PHASE 1 · SUGGESTED DRIFT ({state.sampleSize} OUTCOMES)</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#8ab384]/15 border border-[#8ab384]/40 text-[#8ab384] text-xs font-mono font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8ab384]"></span>
        <span>PHASE 2 · BAYESIAN ACTIVE ({state.sampleSize} OUTCOMES)</span>
      </div>
    );
  };

  return (
    <div className="bg-[#15171d] p-5 sm:p-6 rounded-[3px] border border-[#2a2e38] space-y-6">
      {/* Header & Phase Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#2a2e38]">
        <div>
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-[#d4a745]" />
            <h2 className="text-base font-bold text-[#f4f2ec] tracking-tight">
              Adaptive Scoring &amp; Feedback Calibration
            </h2>
          </div>
          <p className="text-xs text-[#a6abbd] mt-1 font-mono">
            Calibrates sub-dimension weights via regularized Bayesian drift from confirmed application outcomes.
          </p>
        </div>

        {getPhaseBadge()}
      </div>

      {loading ? (
        <div className="text-xs text-[#a6abbd] py-12 text-center font-mono">
          Loading scoring calibration metrics...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sub-Dimension Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  className={`p-4 rounded-[2px] border transition-all flex flex-col justify-between ${
                    isLocked
                      ? "bg-[#1f222a] border-[#d4a745]/60"
                      : "bg-[#0d0e12] border-[#2a2e38] hover:border-[#3d4352]"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-[#a6abbd] uppercase tracking-wider">
                        {dim.code} · {dim.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleLock(dim.key)}
                        title={isLocked ? "Pinned (Click to unlock)" : "Unlocked (Click to pin weight)"}
                        className={`text-[10px] px-2 py-0.5 rounded-[2px] border font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                          isLocked
                            ? "bg-[#d4a745]/20 border-[#d4a745]/60 text-[#d4a745] font-bold"
                            : "bg-[#15171d] border-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec] hover:border-[#3d4352]"
                        }`}
                      >
                        {isLocked ? (
                          <>
                            <Lock className="w-2.5 h-2.5" />
                            <span>PINNED</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-2.5 h-2.5" />
                            <span>LOCK</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-2xl font-bold font-mono text-[#f4f2ec]">
                        {currentVal}%
                      </span>
                      {state && state.phase !== "COLD_START" && suggestedVal !== currentVal && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-[#d4a745]/15 border border-[#d4a745]/40 text-[#d4a745]">
                          Sugg: {suggestedVal}%
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#a6abbd] leading-relaxed line-clamp-2">
                      {dim.description}
                    </p>
                  </div>

                  {/* Range Slider & Telemetry Footers */}
                  <div className="space-y-3 pt-3 mt-3 border-t border-[#2a2e38]">
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="10"
                        max="50"
                        step="1"
                        disabled={isLocked}
                        value={currentVal}
                        onChange={(e) => handleSliderChange(dim.key, Number(e.target.value))}
                        className="w-full h-1.5 bg-[#1f222a] rounded-[2px] appearance-none cursor-pointer accent-[#d4a745] disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-[#a6abbd]">
                        <span>10%</span>
                        <span>30%</span>
                        <span>50%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                      <span className="text-[#a6abbd]">Outcome Delta:</span>
                      <span
                        className={`font-bold ${
                          deltaVal > 0
                            ? "text-[#8ab384]"
                            : deltaVal < 0
                            ? "text-[#c4634e]"
                            : "text-[#a6abbd]"
                        }`}
                      >
                        {deltaVal > 0 ? `+${deltaVal}%` : `${deltaVal}%`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weight Sum & Control Bar */}
          <div className="bg-[#0d0e12] p-4 rounded-[2px] border border-[#2a2e38] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs flex items-center gap-2">
                <span className="text-[#a6abbd]">Total Weight Sum:</span>
                <span
                  className={`font-bold text-sm ${
                    currentSum === 100 ? "text-[#8ab384]" : "text-[#c4634e]"
                  }`}
                >
                  {currentSum}%
                </span>
                {currentSum !== 100 && (
                  <span className="text-[10px] text-[#d4a745]">
                    (Auto-normalizes to 100% on save)
                  </span>
                )}
              </div>

              {statusMessage && (
                <div className="text-xs text-[#d4a745] font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={saving}
                className="px-3 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#15171d] hover:bg-[#1f222a] text-[#a6abbd] hover:text-[#f4f2ec] text-xs font-mono transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Baseline</span>
              </button>

              {state && state.hasChanges && state.phase !== "COLD_START" && (
                <button
                  type="button"
                  onClick={handleApplySuggested}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-[2px] bg-[#d4a745]/15 border border-[#d4a745]/40 hover:bg-[#d4a745]/25 text-[#d4a745] text-xs font-mono font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Apply Calibrated ({state.sampleSize})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveManual}
                disabled={saving}
                className="px-4 py-1.5 rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-mono font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Saving..." : "Save Weights"}
              </button>
            </div>
          </div>

          {/* Calibrated Conversion Insights Prompt Injection Preview */}
          {state && state.insights ? (
            <div className="bg-[#0d0e12] p-4 rounded-[2px] border border-[#2a2e38] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#f4f2ec] flex items-center gap-2 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-[#8ab384]" />
                  Active AI System Prompt Injection
                </span>
                <span className="text-[10px] font-mono text-[#a6abbd]">
                  Clustered Outcomes &ge; 15 Apps
                </span>
              </div>
              <pre className="p-3 bg-[#15171d] rounded-[2px] border border-[#2a2e38] text-[11px] font-mono text-[#f4f2ec] whitespace-pre-wrap leading-relaxed">
                {state.insights}
              </pre>
            </div>
          ) : null}

          {/* Weight Change History */}
          {history.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-[#a6abbd]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#a6abbd] font-mono">
                  Weight Calibration Audit Log
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] flex items-center justify-between text-xs gap-3"
                  >
                    <div className="space-y-0.5 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#f4f2ec]">{entry.reason || entry.eventType}</span>
                        <span className="text-[10px] text-[#a6abbd]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#a6abbd] flex items-center gap-3">
                        <span>SKL: {Math.round(entry.weights.skills * 100)}%</span>
                        <span>EXP: {Math.round(entry.weights.experience * 100)}%</span>
                        <span>DOM: {Math.round(entry.weights.domain * 100)}%</span>
                        <span>TRJ: {Math.round(entry.weights.trajectory * 100)}%</span>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#a6abbd] shrink-0">
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
