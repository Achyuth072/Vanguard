"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  Copy,
  X,
  Sparkles,
  FileText,
  Zap,
} from "lucide-react";
import {
  getCandidateProfile,
  updateCandidateProfile,
  parseCandidateResumeAction,
  getLocalResumeMarkdownAction,
} from "@/app/actions/candidate";

import type {
  CandidateProfile,
  MasterProject,
  MasterExperience,
  MasterSkill,
  MasterSkillCategory,
  RemoteStatus,
} from "@/types/candidate";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SUPPORTED_CURRENCIES } from "@/lib/utils/currency";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: CandidateProfile) => void;
}

type TabType = "general" | "projects" | "experiences" | "skills" | "resume";

const SKILL_CATEGORIES: MasterSkillCategory[] = [
  "LANGUAGE",
  "FRAMEWORK",
  "DATABASE",
  "CLOUD",
  "TOOL",
  "DOMAIN",
];

const CATEGORY_BADGE_VARIANTS: Record<
  MasterSkillCategory,
  "blue" | "violet" | "emerald" | "amber" | "destructive" | "secondary"
> = {
  LANGUAGE: "blue",
  FRAMEWORK: "violet",
  DATABASE: "emerald",
  CLOUD: "amber",
  TOOL: "secondary",
  DOMAIN: "violet",
};

export default function ProfileDrawer({
  isOpen,
  onClose,
  onProfileUpdated,
}: ProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isReadingLocalResume, setIsReadingLocalResume] = useState(false);
  const [parseSummary, setParseSummary] = useState<string | null>(null);

  // Form State
  const [profile, setProfile] = useState<CandidateProfile>({
    id: "candidate-default",
    name: "Default Candidate",
    targetRole: "Software Engineer",
    minSalary: 0,
    currency: "INR",
    yearsOfExperience: 0,
    remotePreference: "ANY",
    preferredLocations: [],
    skills: [],
    projects: [],
    experiences: [],
    resumeText: "",
  });

  // Location input helper
  const [newLocationInput, setNewLocationInput] = useState("");

  // New Skill helper
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState<MasterSkillCategory>("LANGUAGE");
  const [newSkillYears, setNewSkillYears] = useState<string>("");

  // Expanded card tracking
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedExpId, setExpandedExpId] = useState<string | null>(null);

  // Skill category filter tab
  const [selectedSkillCategory, setSelectedSkillCategory] = useState<string>("ALL");

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getCandidateProfile("candidate-default");
      setProfile(data);
      if (data.projects.length > 0) {
        setExpandedProjectId(data.projects[0].id);
      }
      if (data.experiences.length > 0) {
        setExpandedExpId(data.experiences[0].id);
      }
    } catch (err: unknown) {
      console.error("Failed to load candidate profile:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load candidate profile"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen, loadProfile]);

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await updateCandidateProfile(profile);
      if (res.success) {
        setProfile(res.profile);
        setSuccessMessage("Candidate profile updated successfully!");
        if (onProfileUpdated) onProfileUpdated(res.profile);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: unknown) {
      console.error("Failed to save profile:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update profile"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleParseResume(mode: "deterministic" | "ai" = "deterministic") {
    const trimmed = profile.resumeText.trim();
    if (!trimmed) {
      setErrorMessage(
        "Base resume text is empty. Please enter or load resume markdown first."
      );
      return;
    }

    setIsParsingResume(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setParseSummary(null);

    try {
      const res = await parseCandidateResumeAction(trimmed, profile.id, mode);
      if (res.success && res.profile) {
        setProfile(res.profile);
        const methodLabel = res.method === "deterministic" ? "Instant (No AI)" : "AI Parser";
        const summaryMsg = `[${methodLabel}] Parsed & updated profile: ${res.profile.skills.length} skills, ${res.profile.projects.length} projects, and ${res.profile.experiences.length} experience roles.`;
        setSuccessMessage(summaryMsg);
        setParseSummary(summaryMsg);
        if (res.profile.projects.length > 0) {
          setExpandedProjectId(res.profile.projects[0].id);
        }
        if (res.profile.experiences.length > 0) {
          setExpandedExpId(res.profile.experiences[0].id);
        }
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(res.error || "Failed to parse resume markdown");
      }
    } catch (err: unknown) {
      console.error("Failed to parse resume:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to parse resume markdown"
      );
    } finally {
      setIsParsingResume(false);
    }
  }

  async function handleLoadLocalResume() {
    setIsReadingLocalResume(true);
    setErrorMessage(null);
    try {
      const res = await getLocalResumeMarkdownAction();
      if (res.success && res.markdown) {
        setProfile((prev) => ({
          ...prev,
          resumeText: res.markdown!,
        }));
        setSuccessMessage(
          `Loaded local resume (${res.filename || "file"}). Click "Parse & Auto-Fill" to populate all spots.`
        );
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage("No local resume file found in .scratch/Resume/");
      }
    } catch (err: unknown) {
      console.error("Failed to load local resume:", err);
      setErrorMessage("Failed to load local resume file.");
    } finally {
      setIsReadingLocalResume(false);
    }
  }


  // --- Location Handlers ---
  function handleAddLocation() {
    const trimmed = newLocationInput.trim();
    if (!trimmed) return;
    if (!profile.preferredLocations.includes(trimmed)) {
      setProfile((prev) => ({
        ...prev,
        preferredLocations: [...prev.preferredLocations, trimmed],
      }));
    }
    setNewLocationInput("");
  }

  function handleRemoveLocation(index: number) {
    setProfile((prev) => ({
      ...prev,
      preferredLocations: prev.preferredLocations.filter((_, i) => i !== index),
    }));
  }

  // --- Master Project Handlers ---
  function handleAddProject() {
    const newProj: MasterProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: "New Project",
      company: "",
      role: "",
      startDate: "",
      endDate: "",
      technologies: [],
      highlights: [],
      metrics: [],
      description: "",
    };
    setProfile((prev) => ({
      ...prev,
      projects: [newProj, ...prev.projects],
    }));
    setExpandedProjectId(newProj.id);
  }

  function handleUpdateProject(
    id: string,
    updates: Partial<MasterProject>
  ) {
    setProfile((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }

  function handleRemoveProject(id: string) {
    setProfile((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
    }));
    if (expandedProjectId === id) {
      setExpandedProjectId(null);
    }
  }

  // --- Master Experience Handlers ---
  function handleAddExperience() {
    const newExp: MasterExperience = {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      company: "New Company",
      title: "Software Engineer",
      location: "",
      remoteStatus: "HYBRID",
      startDate: "",
      endDate: "",
      isCurrent: false,
      highlights: [],
    };
    setProfile((prev) => ({
      ...prev,
      experiences: [newExp, ...prev.experiences],
    }));
    setExpandedExpId(newExp.id);
  }

  function handleUpdateExperience(
    id: string,
    updates: Partial<MasterExperience>
  ) {
    setProfile((prev) => ({
      ...prev,
      experiences: prev.experiences.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    }));
  }

  function handleRemoveExperience(id: string) {
    setProfile((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((e) => e.id !== id),
    }));
    if (expandedExpId === id) {
      setExpandedExpId(null);
    }
  }

  // --- Skills Handlers ---
  function handleAddSkill() {
    const name = newSkillName.trim();
    if (!name) return;
    const exists = profile.skills.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setErrorMessage(`Skill "${name}" already exists.`);
      return;
    }

    const years = newSkillYears.trim() ? parseInt(newSkillYears, 10) : null;
    const newSkill: MasterSkill = {
      name,
      category: newSkillCategory,
      yearsOfExperience: isNaN(Number(years)) ? null : years,
    };

    setProfile((prev) => ({
      ...prev,
      skills: [...prev.skills, newSkill],
    }));
    setNewSkillName("");
    setNewSkillYears("");
    setErrorMessage(null);
  }

  function handleRemoveSkill(name: string) {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s.name !== name),
    }));
  }

  // Helper for comma-separated or newline-separated array editing
  function updateStringArray(
    currentArray: string[],
    rawText: string,
    delimiter: "\n" | "," = "\n"
  ): string[] {
    return rawText
      .split(delimiter)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const filteredSkills =
    selectedSkillCategory === "ALL"
      ? profile.skills
      : profile.skills.filter((s) => s.category === selectedSkillCategory);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col h-full bg-zinc-900 border-l border-zinc-800 text-zinc-100 shadow-none gap-0 overflow-hidden"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-6 border-b border-zinc-800 bg-zinc-900 shrink-0 space-y-4 text-left">
          <div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="violet" className="font-mono uppercase tracking-wider text-[10px]">
                  Candidate Master Facts
                </Badge>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {profile.projects.length} Projects • {profile.skills.length} Skills • {profile.experiences.length} Roles
                </Badge>
              </div>
              <SheetTitle className="text-xl font-bold tracking-tight text-zinc-100">
                {profile.name || "Candidate Profile"}
              </SheetTitle>
              <SheetDescription className="text-xs text-zinc-400">
                Verified facts repository for automated resume tailoring &amp; question answering.
              </SheetDescription>
            </div>
          </div>

          {/* Notification Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-md bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-md bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800 text-xs font-semibold overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={cn(
                "flex-1 min-w-[110px] py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all text-xs",
                activeTab === "general"
                  ? "bg-zinc-800 text-zinc-100 shadow-none font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span>General &amp; Target</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("projects")}
              className={cn(
                "flex-1 min-w-[110px] py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all text-xs",
                activeTab === "projects"
                  ? "bg-zinc-800 text-zinc-100 shadow-none font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span>Master Projects</span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px]">
                {profile.projects.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("experiences")}
              className={cn(
                "flex-1 min-w-[110px] py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all text-xs",
                activeTab === "experiences"
                  ? "bg-zinc-800 text-zinc-100 shadow-none font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span>Work Experience</span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px]">
                {profile.experiences.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("skills")}
              className={cn(
                "flex-1 min-w-[110px] py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all text-xs",
                activeTab === "skills"
                  ? "bg-zinc-800 text-zinc-100 shadow-none font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span>Skills Repository</span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-[10px]">
                {profile.skills.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("resume")}
              className={cn(
                "flex-1 min-w-[110px] py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all text-xs",
                activeTab === "resume"
                  ? "bg-zinc-800 text-zinc-100 shadow-none font-semibold"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span>Base Resume</span>
            </button>
          </div>
        </SheetHeader>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-zinc-500 text-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                <span>Loading candidate master facts...</span>
              </div>
            </div>
          ) : (
            <>
              {/* 1. GENERAL & TARGET PREFERENCES TAB */}
              {activeTab === "general" && (
                <div className="space-y-6">
                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-400" />
                      Primary Profile Information
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-zinc-400">
                          Candidate Name
                        </label>
                        <Input
                          type="text"
                          value={profile.name}
                          onChange={(e) =>
                            setProfile((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="e.g. Alex Builder"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-zinc-400">
                          Target Role
                        </label>
                        <Input
                          type="text"
                          value={profile.targetRole}
                          onChange={(e) =>
                            setProfile((prev) => ({
                              ...prev,
                              targetRole: e.target.value,
                            }))
                          }
                          placeholder="e.g. Senior Software Engineer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-zinc-400">
                          Min. Expected Salary / yr
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={profile.currency || "INR"}
                            onChange={(e) =>
                              setProfile((prev) => ({
                                ...prev,
                                currency: e.target.value,
                              }))
                            }
                            className="flex h-9 w-28 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs font-medium text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                          >
                            {SUPPORTED_CURRENCIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} ({c.symbol})
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            value={profile.minSalary || ""}
                            onChange={(e) =>
                              setProfile((prev) => ({
                                ...prev,
                                minSalary: Math.max(0, parseInt(e.target.value, 10) || 0),
                              }))
                            }
                            placeholder={profile.currency === "INR" ? "e.g. 1500000" : "e.g. 120000"}
                            className="font-mono flex-1 min-w-0"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-zinc-400">
                          Years of Experience
                        </label>
                        <Input
                          type="number"
                          value={profile.yearsOfExperience || ""}
                          onChange={(e) =>
                            setProfile((prev) => ({
                              ...prev,
                              yearsOfExperience: Math.max(
                                0,
                                parseInt(e.target.value, 10) || 0
                              ),
                            }))
                          }
                          placeholder="e.g. 5"
                          className="font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-zinc-400">
                          Remote Preference
                        </label>
                        <select
                          value={profile.remotePreference}
                          onChange={(e) =>
                            setProfile((prev) => ({
                              ...prev,
                              remotePreference: e.target.value,
                            }))
                          }
                          className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                        >
                          <option value="ANY">Any / Flexible</option>
                          <option value="REMOTE_ONLY">Remote Only</option>
                          <option value="HYBRID">Hybrid</option>
                          <option value="ONSITE">On-site Only</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Preferred Locations */}
                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800 space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        Location Preferences
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Add geographic hubs, cities, or &quot;Remote&quot; to evaluate job location matches.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddLocation();
                          }
                        }}
                        placeholder="e.g. Bengaluru, San Francisco, Remote..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAddLocation}
                        className="h-9"
                      >
                        Add Hub
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {profile.preferredLocations.length === 0 ? (
                        <span className="text-xs text-zinc-500 italic">
                          No preferred locations set (flexible anywhere).
                        </span>
                      ) : (
                        profile.preferredLocations.map((loc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium"
                          >
                            <span>{loc}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLocation(idx)}
                              className="text-zinc-500 hover:text-zinc-200 transition-colors"
                              aria-label={`Remove location ${loc}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. MASTER PROJECTS TAB */}
              {activeTab === "projects" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                        Master Project Catalog
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Add rich projects with metrics, bullet points, and tech stacks. AI selects the top 2-3 most relevant for each application.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddProject}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Master Project</span>
                    </Button>
                  </div>

                  {profile.projects.length === 0 ? (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 text-center space-y-3">
                      <p className="text-xs text-zinc-400">
                        No master projects added yet. Add projects to enable AI resume tailoring.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddProject}
                      >
                        Create First Project
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {profile.projects.map((proj) => {
                        const isExpanded = expandedProjectId === proj.id;
                        return (
                          <div
                            key={proj.id}
                            className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden transition-all"
                          >
                            {/* Project Header */}
                            <div
                              onClick={() =>
                                setExpandedProjectId(isExpanded ? null : proj.id)
                              }
                              className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-900/60 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-zinc-100">
                                    {proj.title || "Untitled Project"}
                                  </h4>
                                  {proj.company && (
                                    <span className="text-xs text-zinc-400">
                                      @ {proj.company}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                                  {proj.technologies.slice(0, 4).map((t, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="font-mono text-[10px] py-0 px-1.5"
                                    >
                                      {t}
                                    </Badge>
                                  ))}
                                  {proj.technologies.length > 4 && (
                                    <span className="text-[10px] text-zinc-500">
                                      +{proj.technologies.length - 4} more
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveProject(proj.id);
                                  }}
                                  className="text-zinc-500 hover:text-red-400 hover:bg-zinc-900"
                                  title="Delete project"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <ChevronDown
                                  className={cn(
                                    "w-4 h-4 text-zinc-400 transition-transform",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </div>
                            </div>

                            {/* Project Expanded Editor */}
                            {isExpanded && (
                              <div className="p-5 border-t border-zinc-800 bg-zinc-900/40 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Project Title *
                                    </label>
                                    <Input
                                      type="text"
                                      value={proj.title}
                                      onChange={(e) =>
                                        handleUpdateProject(proj.id, {
                                          title: e.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Company / Context
                                    </label>
                                    <Input
                                      type="text"
                                      value={proj.company}
                                      onChange={(e) =>
                                        handleUpdateProject(proj.id, {
                                          company: e.target.value,
                                        })
                                      }
                                      placeholder="e.g. Pulse or Independent"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Your Role
                                    </label>
                                    <Input
                                      type="text"
                                      value={proj.role}
                                      onChange={(e) =>
                                        handleUpdateProject(proj.id, {
                                          role: e.target.value,
                                        })
                                      }
                                      placeholder="e.g. Lead Engineer"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-xs font-medium text-zinc-400">
                                    Project Description &amp; Scope
                                  </label>
                                  <Textarea
                                    rows={2}
                                    value={proj.description}
                                    onChange={(e) =>
                                      handleUpdateProject(proj.id, {
                                        description: e.target.value,
                                      })
                                    }
                                    placeholder="Brief architectural overview of what you built and why..."
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-xs font-medium text-zinc-400">
                                    Technologies (Comma-separated)
                                  </label>
                                  <Input
                                    type="text"
                                    value={proj.technologies.join(", ")}
                                    onChange={(e) =>
                                      handleUpdateProject(proj.id, {
                                        technologies: updateStringArray(
                                          proj.technologies,
                                          e.target.value,
                                          ","
                                        ),
                                      })
                                    }
                                    placeholder="TypeScript, Next.js, Prisma, PostgreSQL, Redis..."
                                    className="font-mono"
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Measurable Metrics (One per line)
                                    </label>
                                    <Textarea
                                      rows={3}
                                      value={proj.metrics.join("\n")}
                                      onChange={(e) =>
                                        handleUpdateProject(proj.id, {
                                          metrics: updateStringArray(
                                            proj.metrics,
                                            e.target.value,
                                            "\n"
                                          ),
                                        })
                                      }
                                      placeholder="Cut API p99 latency by 65%&#10;Saved $12k/mo in cloud infrastructure"
                                      className="font-mono text-xs"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Highlights / Bullet Points (One per line)
                                    </label>
                                    <Textarea
                                      rows={3}
                                      value={proj.highlights.join("\n")}
                                      onChange={(e) =>
                                        handleUpdateProject(proj.id, {
                                          highlights: updateStringArray(
                                            proj.highlights,
                                            e.target.value,
                                            "\n"
                                          ),
                                        })
                                      }
                                      placeholder="Architected offline-first database schema&#10;Integrated zero-cost LLM fallback pipeline"
                                      className="text-xs"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 3. WORK EXPERIENCES TAB */}
              {activeTab === "experiences" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                        Work Experience Records
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Structured career timeline used to formulate tailored executive summaries and answer behavioral prompts.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddExperience}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Experience</span>
                    </Button>
                  </div>

                  {profile.experiences.length === 0 ? (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 text-center space-y-3">
                      <p className="text-xs text-zinc-400">
                        No work experience records found.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddExperience}
                      >
                        Add First Role
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {profile.experiences.map((exp) => {
                        const isExpanded = expandedExpId === exp.id;
                        return (
                          <div
                            key={exp.id}
                            className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden transition-all"
                          >
                            <div
                              onClick={() =>
                                setExpandedExpId(isExpanded ? null : exp.id)
                              }
                              className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-900/60 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-zinc-100">
                                    {exp.title}
                                  </h4>
                                  <span className="text-xs text-zinc-400">
                                    @ {exp.company}
                                  </span>
                                  {exp.isCurrent && (
                                    <Badge variant="emerald" className="text-[10px] py-0">
                                      Current
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-500 flex items-center gap-2">
                                  {exp.location && <span>{exp.location}</span>}
                                  {exp.remoteStatus && <span>• {exp.remoteStatus}</span>}
                                  {exp.startDate && (
                                    <span>
                                      • {exp.startDate} - {exp.isCurrent ? "Present" : exp.endDate || "N/A"}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveExperience(exp.id);
                                  }}
                                  className="text-zinc-500 hover:text-red-400 hover:bg-zinc-900"
                                  title="Delete experience"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <ChevronDown
                                  className={cn(
                                    "w-4 h-4 text-zinc-400 transition-transform",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-5 border-t border-zinc-800 bg-zinc-900/40 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Company Name *
                                    </label>
                                    <Input
                                      type="text"
                                      value={exp.company}
                                      onChange={(e) =>
                                        handleUpdateExperience(exp.id, {
                                          company: e.target.value,
                                        })
                                      }
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Job Title *
                                    </label>
                                    <Input
                                      type="text"
                                      value={exp.title}
                                      onChange={(e) =>
                                        handleUpdateExperience(exp.id, {
                                          title: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Location
                                    </label>
                                    <Input
                                      type="text"
                                      value={exp.location}
                                      onChange={(e) =>
                                        handleUpdateExperience(exp.id, {
                                          location: e.target.value,
                                        })
                                      }
                                      placeholder="e.g. San Francisco, CA"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Workplace Mode
                                    </label>
                                    <select
                                      value={exp.remoteStatus}
                                      onChange={(e) =>
                                        handleUpdateExperience(exp.id, {
                                          remoteStatus: e.target.value as RemoteStatus,
                                        })
                                      }
                                      className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                                    >
                                      <option value="REMOTE">Remote</option>
                                      <option value="HYBRID">Hybrid</option>
                                      <option value="ONSITE">Onsite</option>
                                      <option value="UNKNOWN">Unknown / Other</option>
                                    </select>
                                  </div>

                                  <div className="flex items-center pt-5">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                                      <input
                                        type="checkbox"
                                        checked={exp.isCurrent}
                                        onChange={(e) =>
                                          handleUpdateExperience(exp.id, {
                                            isCurrent: e.target.checked,
                                          })
                                        }
                                        className="rounded border-zinc-800 text-violet-500 focus:ring-violet-400 bg-zinc-950"
                                      />
                                      <span>Currently Working Here</span>
                                    </label>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      Start Date
                                    </label>
                                    <Input
                                      type="text"
                                      value={exp.startDate || ""}
                                      onChange={(e) =>
                                        handleUpdateExperience(exp.id, {
                                          startDate: e.target.value,
                                        })
                                      }
                                      placeholder="e.g. 2021-01"
                                      className="font-mono"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium text-zinc-400">
                                      End Date
                                    </label>
                                    <Input
                                      type="text"
                                      disabled={exp.isCurrent}
                                      value={exp.isCurrent ? "Present" : exp.endDate || ""}
                                      onChange={(e) =>
                                        handleUpdateExperience(exp.id, {
                                          endDate: e.target.value,
                                        })
                                      }
                                      placeholder="e.g. 2023-12"
                                      className="font-mono disabled:opacity-50"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-xs font-medium text-zinc-400">
                                    Key Responsibilities &amp; Highlights (One per line)
                                  </label>
                                  <Textarea
                                    rows={3}
                                    value={exp.highlights.join("\n")}
                                    onChange={(e) =>
                                      handleUpdateExperience(exp.id, {
                                        highlights: updateStringArray(
                                          exp.highlights,
                                          e.target.value,
                                          "\n"
                                        ),
                                      })
                                    }
                                    placeholder="Led team of 6 engineers across product initiatives&#10;Built and shipped multi-tenant backend"
                                    className="text-xs"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 4. SKILLS REPOSITORY TAB */}
              {activeTab === "skills" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                      Master Skills Repository
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Categorized skills with years of experience. Anti-hallucination engines strictly match against these entries.
                    </p>
                  </div>

                  {/* Add Skill Form */}
                  <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-3">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      Add New Skill
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="block text-xs font-medium text-zinc-400">
                          Skill Name *
                        </label>
                        <Input
                          type="text"
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddSkill();
                            }
                          }}
                          placeholder="e.g. React, TypeScript, Docker..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-400">
                          Category
                        </label>
                        <select
                          value={newSkillCategory}
                          onChange={(e) =>
                            setNewSkillCategory(
                              e.target.value as MasterSkillCategory
                            )
                          }
                          className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                        >
                          {SKILL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-400">
                          Years Exp. (Opt)
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={newSkillYears}
                            onChange={(e) => setNewSkillYears(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSkill();
                              }
                            }}
                            placeholder="e.g. 4"
                            className="font-mono"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddSkill}
                            className="h-9 shrink-0"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant={selectedSkillCategory === "ALL" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSkillCategory("ALL")}
                      className="rounded-full h-7 text-xs px-3"
                    >
                      All ({profile.skills.length})
                    </Button>

                    {SKILL_CATEGORIES.map((cat) => {
                      const count = profile.skills.filter(
                        (s) => s.category === cat
                      ).length;
                      return (
                        <Button
                          key={cat}
                          type="button"
                          variant={selectedSkillCategory === cat ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedSkillCategory(cat)}
                          className="rounded-full h-7 text-xs px-3"
                        >
                          {cat} ({count})
                        </Button>
                      );
                    })}
                  </div>

                  {/* Skills Grid */}
                  <div className="bg-zinc-950 p-5 rounded-lg border border-zinc-800">
                    {filteredSkills.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic text-center py-4">
                        No skills found in this category.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {filteredSkills.map((skill) => (
                          <Badge
                            key={skill.name}
                            variant={CATEGORY_BADGE_VARIANTS[skill.category] || "secondary"}
                            className="gap-1.5 py-1 px-2.5 text-xs font-normal"
                          >
                            <span>{skill.name}</span>
                            {skill.yearsOfExperience !== null &&
                              skill.yearsOfExperience !== undefined && (
                                <span className="font-mono text-[10px] opacity-75">
                                  {skill.yearsOfExperience}y
                                </span>
                              )}
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill.name)}
                              className="hover:opacity-100 opacity-60 hover:text-red-300 font-bold ml-0.5"
                              title={`Remove ${skill.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. BASE RESUME TEXT TAB */}
              {activeTab === "resume" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                        <span>Raw Resume / Markdown Bio</span>
                        <Badge variant="violet" className="text-[10px] py-0 font-mono">
                          AI Grounding Source
                        </Badge>
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Source markdown used to extract candidate master facts and ground all tailored assets.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleLoadLocalResume}
                        disabled={isReadingLocalResume || isParsingResume}
                        className="gap-1.5 text-xs bg-zinc-950 border-zinc-800 hover:bg-zinc-850"
                        title="Load markdown from .scratch/Resume/"
                      >
                        {isReadingLocalResume ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        <span>Load Local File</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleParseResume("deterministic")}
                        disabled={isParsingResume || !profile.resumeText.trim()}
                        className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                        title="Extract all profile fields deterministically without AI (0ms, 0 API calls)"
                      >
                        <Zap className="w-3.5 h-3.5 text-emerald-100" />
                        <span>Parse Instantly (No AI)</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleParseResume("ai")}
                        disabled={isParsingResume || !profile.resumeText.trim()}
                        className="gap-1.5 text-xs font-medium text-zinc-300 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:text-white"
                        title="Extract profile fields using AI models (Gemini / Groq)"
                      >
                        {isParsingResume ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Parsing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                            <span>Parse with AI</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Information banner about extraction */}
                  <div className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800 text-zinc-300 text-xs flex items-start gap-2.5">
                    <Zap className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-200">
                        Deterministic Local Parsing (Recommended)
                      </p>
                      <p className="text-zinc-400 leading-relaxed">
                        <strong className="text-emerald-300">&quot;Parse Instantly (No AI)&quot;</strong> extracts your name, target role, technical skills, projects, and work history directly from Markdown in &lt;1ms without using AI API quotas or risking hallucinations. Use <strong className="text-violet-300">&quot;Parse with AI&quot;</strong> only if your resume is unformatted free-form text.
                      </p>
                    </div>
                  </div>

                  {parseSummary && (
                    <div className="p-3 rounded-md bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{parseSummary}</span>
                    </div>
                  )}

                  <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-500 pb-1 border-b border-zinc-900">
                      <span className="font-mono text-[11px] text-zinc-400">
                        {profile.resumeText.length} characters
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (!profile.resumeText) return;
                          navigator.clipboard.writeText(profile.resumeText);
                          setSuccessMessage("Resume text copied to clipboard!");
                          setTimeout(() => setSuccessMessage(null), 2000);
                        }}
                        className="gap-1.5 h-7 text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Markdown</span>
                      </Button>
                    </div>

                    <Textarea
                      rows={16}
                      value={profile.resumeText}
                      onChange={(e) =>
                        setProfile((prev) => ({
                          ...prev,
                          resumeText: e.target.value,
                        }))
                      }
                      placeholder="Paste your full unformatted resume text or Markdown summary here..."
                      className="font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-violet-400 leading-relaxed resize-none p-4"
                    />
                  </div>
                </div>
              )}

            </>
          )}
        </div>

        {/* Drawer Footer */}
        <SheetFooter className="p-4 border-t border-zinc-800 bg-zinc-900 flex flex-row items-center justify-between shrink-0 text-xs text-zinc-500">
          <span className="font-mono text-[11px]">Profile ID: {profile.id}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="font-bold text-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Save Profile</span>
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
