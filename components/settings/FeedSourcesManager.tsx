"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Building2,
  X,
} from "lucide-react";
import type { FeedSource, FeedSourceType } from "@/types/feed-source";

interface ParsedSource extends Omit<FeedSource, "config"> {
  config: string;
  parsedConfig: {
    boardSlugs?: string[];
    categories?: string[];
    tags?: string[];
    industry?: string;
    count?: number;
    searchStoryPrefix?: string;
    searchStoryId?: number;
    filters?: Record<string, unknown>;
  };
}

export interface FeedSourcesManagerProps {
  className?: string;
  onSyncComplete?: () => void;
}

export function FeedSourcesManager({
  className = "",
  onSyncComplete,
}: FeedSourcesManagerProps) {
  const [sources, setSources] = useState<ParsedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Editing state for company slugs
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [newSlugInput, setNewSlugInput] = useState<string>("");
  const [isAddingSource, setIsAddingSource] = useState(false);

  // New source form state
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<FeedSourceType>("ASHBY");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceSlugs, setNewSourceSlugs] = useState<string[]>([]);
  const [customSlugDraft, setCustomSlugDraft] = useState("");

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/feeds");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSources(json.data);
      } else {
        throw new Error(json.error || "Failed to load feed sources");
      }
    } catch (err) {
      console.error("Error fetching feed sources:", err);
      setError(err instanceof Error ? err.message : "Error fetching feed sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const showStatus = (text: string, type: "success" | "error" | "info" = "success") => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Toggle Enabled
  const handleToggleEnabled = async (source: ParsedSource) => {
    const nextState = !source.enabled;
    // Optimistic UI update
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, enabled: nextState } : s))
    );

    try {
      const res = await fetch(`/api/feeds/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to toggle enabled state");
      }
      showStatus(
        `${source.name} ${nextState ? "enabled" : "disabled"}`,
        nextState ? "success" : "info"
      );
    } catch (err) {
      // Revert optimistic update
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? { ...s, enabled: source.enabled } : s))
      );
      showStatus(
        err instanceof Error ? err.message : "Failed to toggle feed source",
        "error"
      );
    }
  };

  // Toggle Auto-polling
  const handleToggleAutoPoll = async (source: ParsedSource) => {
    const nextState = !source.autoPoll;
    setSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, autoPoll: nextState } : s))
    );

    try {
      const res = await fetch(`/api/feeds/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPoll: nextState }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to toggle auto-polling");
      }
      showStatus(
        `${source.name} auto-polling set to ${nextState ? "ON (Background)" : "OFF"}`,
        "info"
      );
    } catch (err) {
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? { ...s, autoPoll: source.autoPoll } : s))
      );
      showStatus(
        err instanceof Error ? err.message : "Failed to toggle auto-poll",
        "error"
      );
    }
  };

  // Individual Sync ("Fetch Now")
  const handleSyncSource = async (source: ParsedSource) => {
    if (syncingId || syncingAll) return;
    setSyncingId(source.id);
    try {
      const res = await fetch("/api/feeds/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: source.id, forceSync: true }),
      });
      const json = await res.json();
      if (json.success) {
        const stats = json.data;
        const discovered = stats?.jobsDiscovered ?? stats?.discoveredCount ?? 0;
        const passed = stats?.jobsPassed ?? stats?.jobsStaged ?? stats?.passedCount ?? 0;
        showStatus(
          `Synced ${source.name}: ${discovered} discovered, ${passed} passed`,
          "success"
        );
        fetchSources();
        if (onSyncComplete) onSyncComplete();
      } else {
        throw new Error(json.error || "Feed sync failed");
      }
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Failed to sync feed source",
        "error"
      );
      fetchSources();
    } finally {
      setSyncingId(null);
    }
  };

  // Global Sync ("Sync All Sources")
  const handleSyncAll = async () => {
    if (syncingAll || syncingId) return;
    setSyncingAll(true);
    try {
      const res = await fetch("/api/feeds/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceSync: true }),
      });
      const json = await res.json();
      if (json.success) {
        const totalDiscovered = json.data?.totalDiscovered ?? 0;
        const totalPassed = json.data?.totalPassed ?? 0;
        showStatus(
          `Sync All Complete: ${totalDiscovered} discovered, ${totalPassed} passed into buffer`,
          "success"
        );
        fetchSources();
        if (onSyncComplete) onSyncComplete();
      } else {
        throw new Error(json.error || "Global sync failed");
      }
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Failed to sync all feed sources",
        "error"
      );
    } finally {
      setSyncingAll(false);
    }
  };

  // Add Company Board Slug
  const handleAddSlug = async (source: ParsedSource) => {
    const slugToAdd = newSlugInput.trim().toLowerCase();
    if (!slugToAdd) return;

    const currentSlugs = source.parsedConfig.boardSlugs || [];
    if (currentSlugs.includes(slugToAdd)) {
      setNewSlugInput("");
      return;
    }

    const updatedSlugs = [...currentSlugs, slugToAdd];
    try {
      const res = await fetch(`/api/feeds/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardSlugs: updatedSlugs }),
      });
      const json = await res.json();
      if (json.success) {
        setSources((prev) =>
          prev.map((s) =>
            s.id === source.id
              ? {
                  ...s,
                  parsedConfig: {
                    ...s.parsedConfig,
                    boardSlugs: updatedSlugs,
                  },
                }
              : s
          )
        );
        setNewSlugInput("");
        showStatus(`Added company '${slugToAdd}' to ${source.name}`, "success");
      } else {
        throw new Error(json.error || "Failed to add board slug");
      }
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Error saving board slug",
        "error"
      );
    }
  };

  // Remove Company Board Slug
  const handleRemoveSlug = async (source: ParsedSource, slugToRemove: string) => {
    const currentSlugs = source.parsedConfig.boardSlugs || [];
    const updatedSlugs = currentSlugs.filter((s) => s !== slugToRemove);

    try {
      const res = await fetch(`/api/feeds/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardSlugs: updatedSlugs }),
      });
      const json = await res.json();
      if (json.success) {
        setSources((prev) =>
          prev.map((s) =>
            s.id === source.id
              ? {
                  ...s,
                  parsedConfig: {
                    ...s.parsedConfig,
                    boardSlugs: updatedSlugs,
                  },
                }
              : s
          )
        );
        showStatus(`Removed '${slugToRemove}' from ${source.name}`, "info");
      } else {
        throw new Error(json.error || "Failed to remove board slug");
      }
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Error updating board slugs",
        "error"
      );
    }
  };

  // Create New Feed Source
  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    try {
      const configObj: Record<string, unknown> = {};
      if (["ASHBY", "GREENHOUSE", "LEVER"].includes(newSourceType)) {
        configObj.boardSlugs = newSourceSlugs;
      }

      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSourceName.trim(),
          type: newSourceType,
          url: newSourceUrl.trim() || undefined,
          config: configObj,
          enabled: true,
          autoPoll: false,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showStatus(`Created custom source '${newSourceName}'`, "success");
        setIsAddingSource(false);
        setNewSourceName("");
        setNewSourceUrl("");
        setNewSourceSlugs([]);
        fetchSources();
      } else {
        throw new Error(json.error || "Failed to create source");
      }
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Error creating feed source",
        "error"
      );
    }
  };

  const isSlugSupported = (type: string) => {
    return type === "ASHBY" || type === "GREENHOUSE" || type === "LEVER";
  };

  // Global aggregate stats
  const totalDiscovered = sources.reduce((acc, s) => acc + (s.jobsDiscovered || 0), 0);
  const totalPassed = sources.reduce((acc, s) => acc + (s.jobsPassed || 0), 0);
  const activeSourcesCount = sources.filter((s) => s.enabled).length;

  return (
    <div className={`space-y-6 font-sans ${className}`} data-testid="feed-sources-manager">
      {/* Top Banner / Metrics & Global Actions */}
      <div className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2a2e38]">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-bold text-[#f4f2ec] tracking-tight">
                Job Feed Sources &amp; Ingestion Streams
              </h2>
              <span className="px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-mono font-bold tracking-widest bg-[#d4a745]/15 border border-[#d4a745]/40 text-[#d4a745]">
                {sources.length} SOURCES
              </span>
            </div>
            <p className="text-xs text-[#a6abbd] mt-1 font-mono">
              Manage deterministic ATS adapters, company board targets, and multi-stream sync triggers.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddingSource((prev) => !prev)}
              className="px-3 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] hover:bg-[#2a2e38] text-[#f4f2ec] text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#d4a745]" />
              <span>{isAddingSource ? "Cancel" : "Add Source"}</span>
            </button>

            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncingAll || Boolean(syncingId)}
              className="px-3.5 py-1.5 rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-sans uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? "animate-spin" : ""}`} />
              <span>{syncingAll ? "Syncing All..." : "Sync All Sources"}</span>
            </button>
          </div>
        </div>

        {/* Aggregate Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 font-mono">
          <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
            <div className="text-[10px] text-[#a6abbd] uppercase tracking-wider">Active Streams</div>
            <div className="text-lg font-bold text-[#8ab384] mt-0.5">
              {activeSourcesCount} <span className="text-xs text-[#a6abbd] font-normal">/ {sources.length}</span>
            </div>
          </div>

          <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
            <div className="text-[10px] text-[#a6abbd] uppercase tracking-wider">Discovered Jobs</div>
            <div className="text-lg font-bold text-[#f4f2ec] mt-0.5 tabular-nums">
              {totalDiscovered.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
            <div className="text-[10px] text-[#a6abbd] uppercase tracking-wider">Passed Deterministic Filter</div>
            <div className="text-lg font-bold text-[#d4a745] mt-0.5 tabular-nums">
              {totalPassed.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0d0e12] p-3 rounded-[2px] border border-[#2a2e38]">
            <div className="text-[10px] text-[#a6abbd] uppercase tracking-wider">Background Polling</div>
            <div className="text-lg font-bold text-[#a6abbd] mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#a6abbd]" />
              <span className="text-xs">DEFAULT OFF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Toast / Notification */}
      {statusMessage && (
        <div
          className={`p-3 rounded-[2px] border text-xs font-mono flex items-center justify-between transition-all ${
            statusMessage.type === "success"
              ? "bg-[#8ab384]/15 border-[#8ab384]/40 text-[#8ab384]"
              : statusMessage.type === "error"
              ? "bg-[#c4634e]/15 border-[#c4634e]/40 text-[#c4634e]"
              : "bg-[#d4a745]/15 border-[#d4a745]/40 text-[#d4a745]"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {statusMessage.type === "error" && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {statusMessage.type === "info" && <Radio className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Custom Source Form */}
      {isAddingSource && (
        <div className="bg-[#15171d] border border-[#d4a745]/40 rounded-[3px] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#2a2e38] pb-3">
            <h3 className="text-sm font-bold text-[#f4f2ec] uppercase tracking-wider font-mono flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#d4a745]" />
              Add Custom Feed Source
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingSource(false)}
              className="text-[#a6abbd] hover:text-[#f4f2ec] text-xs font-mono"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateSource} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-[#a6abbd] mb-1">
                  Source Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Startups Board"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] p-2.5 text-xs text-[#f4f2ec] font-mono focus:border-[#d4a745] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[#a6abbd] mb-1">
                  Adapter Type *
                </label>
                <select
                  value={newSourceType}
                  onChange={(e) => setNewSourceType(e.target.value as FeedSourceType)}
                  className="w-full bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] p-2.5 text-xs text-[#f4f2ec] font-mono focus:border-[#d4a745] outline-none"
                >
                  <option value="ASHBY">Ashby (Company Boards)</option>
                  <option value="GREENHOUSE">Greenhouse (Company Boards)</option>
                  <option value="LEVER">Lever (Company Boards)</option>
                  <option value="HIMALAYAS">Himalayas (Remote API)</option>
                  <option value="REMOTEOK">RemoteOK (API)</option>
                  <option value="JOBICY">Jobicy (Remote API)</option>
                  <option value="HN">Hacker News (Algolia API)</option>
                  <option value="MANUAL">Manual Ingestion</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#a6abbd] mb-1">
                Custom Endpoint / API URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                className="w-full bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] p-2.5 text-xs text-[#f4f2ec] font-mono focus:border-[#d4a745] outline-none"
              />
            </div>

            {isSlugSupported(newSourceType) && (
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase text-[#a6abbd]">
                  Company Board Slugs (e.g. stripe, openai, figma)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter company slug..."
                    value={customSlugDraft}
                    onChange={(e) => setCustomSlugDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customSlugDraft.trim()) {
                          setNewSourceSlugs((prev) => [
                            ...prev,
                            customSlugDraft.trim().toLowerCase(),
                          ]);
                          setCustomSlugDraft("");
                        }
                      }
                    }}
                    className="flex-1 bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] p-2 text-xs text-[#f4f2ec] font-mono focus:border-[#d4a745] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customSlugDraft.trim()) {
                        setNewSourceSlugs((prev) => [
                          ...prev,
                          customSlugDraft.trim().toLowerCase(),
                        ]);
                        setCustomSlugDraft("");
                      }
                    }}
                    className="px-3 py-2 bg-[#2a2e38] hover:bg-[#3d4352] text-[#f4f2ec] text-xs font-mono rounded-[2px]"
                  >
                    Add Slug
                  </button>
                </div>

                {newSourceSlugs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {newSourceSlugs.map((slug) => (
                      <span
                        key={slug}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-xs font-mono text-[#d4a745]"
                      >
                        {slug}
                        <button
                          type="button"
                          onClick={() =>
                            setNewSourceSlugs((prev) => prev.filter((s) => s !== slug))
                          }
                          className="hover:text-[#c4634e]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingSource(false)}
                className="px-4 py-2 border border-[#2a2e38] rounded-[2px] text-xs font-mono text-[#a6abbd] hover:text-[#f4f2ec]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] font-bold text-xs font-mono uppercase tracking-wider rounded-[2px]"
              >
                Save Source
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feed Sources Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs font-mono text-[#a6abbd] flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#d4a745]" />
          <span>Loading feed sources &amp; status telemetry...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-[#c4634e]/10 border border-[#c4634e]/40 rounded-[3px] text-xs font-mono text-[#c4634e] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((source) => {
            const hasError = source.errorCount > 0;
            const isSyncing = syncingId === source.id || syncingAll;
            const slugs = source.parsedConfig?.boardSlugs || [];
            const isExpanded = editingSourceId === source.id;

            return (
              <div
                key={source.id}
                data-testid={`feed-source-card-${source.id}`}
                className={`bg-[#15171d] border rounded-[3px] p-4 flex flex-col justify-between transition-all ${
                  !source.enabled
                    ? "border-[#2a2e38] opacity-60 bg-[#121318]"
                    : hasError
                    ? "border-[#c4634e]/50 shadow-sm shadow-[#c4634e]/10"
                    : "border-[#2a2e38] hover:border-[#3d4352]"
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header: Name, Type, Status Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            !source.enabled
                              ? "bg-[#64697b]"
                              : hasError
                              ? "bg-[#c4634e] animate-pulse"
                              : "bg-[#8ab384]"
                          }`}
                        />
                        <h3 className="text-sm font-bold text-[#f4f2ec] tracking-tight font-sans">
                          {source.name}
                        </h3>
                        <span className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono bg-[#1f222a] border border-[#2a2e38] text-[#a6abbd]">
                          {source.type}
                        </span>
                      </div>

                      {/* Status indicator text */}
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#a6abbd]">
                        {!source.enabled ? (
                          <span className="text-[#64697b] font-semibold">DISABLED</span>
                        ) : hasError ? (
                          <span className="text-[#c4634e] font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {source.errorCount} FAILS RECORDED
                          </span>
                        ) : (
                          <span className="text-[#8ab384] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            HEALTHY
                          </span>
                        )}
                        <span>·</span>
                        <span>
                          {source.lastPolledAt
                            ? `Last: ${new Date(source.lastPolledAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "Never polled"}
                        </span>
                      </div>
                    </div>

                    {/* Enable / Disable Switch */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={`Toggle ${source.name}`}
                        onClick={() => handleToggleEnabled(source)}
                        className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
                          source.enabled ? "bg-[#8ab384]" : "bg-[#2a2e38]"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                            source.enabled ? "left-4.5" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Telemetry Metrics */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] text-center font-mono">
                    <div>
                      <div className="text-[9px] text-[#a6abbd] uppercase">Discovered</div>
                      <div className="text-xs font-bold text-[#f4f2ec] tabular-nums mt-0.5">
                        {source.jobsDiscovered.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#a6abbd] uppercase">Passed</div>
                      <div className="text-xs font-bold text-[#d4a745] tabular-nums mt-0.5">
                        {source.jobsPassed.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#a6abbd] uppercase">Cadence</div>
                      <div className="text-xs font-bold text-[#a6abbd] tabular-nums mt-0.5">
                        {Math.round(source.pollIntervalMs / 3600000)}h
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Error Banner (when errorCount > 0) */}
                  {hasError && source.lastError && (
                    <div className="p-2.5 bg-[#c4634e]/10 border border-[#c4634e]/40 rounded-[2px] space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#c4634e]">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Adapter Sync Error Diagnostic</span>
                      </div>
                      <p className="text-[10px] font-mono text-[#f4f2ec]/80 line-clamp-2 leading-relaxed">
                        {source.lastError}
                      </p>
                    </div>
                  )}

                  {/* Company Board Slugs Section for ATS Adapters */}
                  {isSlugSupported(source.type) && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#a6abbd] flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-[#d4a745]" />
                          Target Boards ({slugs.length})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingSourceId(isExpanded ? null : source.id)
                          }
                          className="text-[#d4a745] hover:underline text-[11px] font-semibold"
                        >
                          {isExpanded ? "Done" : "Manage Slugs →"}
                        </button>
                      </div>

                      {/* Pill badges for slugs */}
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {slugs.map((slug) => (
                          <span
                            key={slug}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[11px] font-mono text-[#f4f2ec]"
                          >
                            <span>{slug}</span>
                            {isExpanded && (
                              <button
                                type="button"
                                aria-label={`Remove ${slug}`}
                                onClick={() => handleRemoveSlug(source, slug)}
                                className="text-[#a6abbd] hover:text-[#c4634e]"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>

                      {/* Add Slug input when expanded */}
                      {isExpanded && (
                        <div className="flex gap-1.5 pt-1.5">
                          <input
                            type="text"
                            placeholder="Add company slug (e.g. openai)..."
                            value={editingSourceId === source.id ? newSlugInput : ""}
                            onChange={(e) => setNewSlugInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSlug(source);
                              }
                            }}
                            className="flex-1 bg-[#0d0e12] border border-[#2a2e38] rounded-[2px] px-2 py-1 text-xs text-[#f4f2ec] font-mono focus:border-[#d4a745] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddSlug(source)}
                            className="px-2.5 py-1 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] text-xs font-bold font-mono rounded-[2px]"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Auto-Poll Toggle with explicit label */}
                  <div className="pt-2 border-t border-[#2a2e38] flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-[#f4f2ec] font-medium block">
                        Background Auto-polling
                      </span>
                      <span className="text-[10px] text-[#a6abbd]">
                        {source.autoPoll
                          ? "Active (Runs automatically in background)"
                          : "Off by default (Zero unsolicited requests)"}
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label={`Toggle auto-poll for ${source.name}`}
                      onClick={() => handleToggleAutoPoll(source)}
                      className={`px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-bold border transition-colors ${
                        source.autoPoll
                          ? "bg-[#8ab384]/15 border-[#8ab384]/40 text-[#8ab384]"
                          : "bg-[#1f222a] border-[#2a2e38] text-[#a6abbd] hover:text-[#f4f2ec]"
                      }`}
                    >
                      {source.autoPoll ? "POLLING: ON" : "POLLING: OFF"}
                    </button>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-4 mt-3 border-t border-[#2a2e38] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#64697b] truncate max-w-[140px]">
                    ID: {source.id}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleSyncSource(source)}
                    disabled={isSyncing}
                    className="px-3 py-1.5 bg-[#1f222a] hover:bg-[#2a2e38] border border-[#2a2e38] text-[#f4f2ec] text-xs font-mono rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3 h-3 text-[#d4a745] ${
                        syncingId === source.id ? "animate-spin" : ""
                      }`}
                    />
                    <span>{syncingId === source.id ? "Fetching..." : "Fetch Now"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FeedSourcesManager;
