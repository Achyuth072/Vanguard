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
  Sliders,
  Briefcase,
  FolderGit2,
  Wrench,
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
import BottomSheet, {
  TACTICAL_DRAWER_CLASS,
} from "@/components/ui/bottom-sheet";
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SUPPORTED_CURRENCIES } from "@/lib/utils/currency";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: CandidateProfile) => void;
}

type TabType = "preferences" | "skills" | "experiences" | "projects" | "resume";

const SKILL_CATEGORIES: MasterSkillCategory[] = [
  "LANGUAGE",
  "FRAMEWORK",
  "DATABASE",
  "CLOUD",
  "TOOL",
  "DOMAIN",
];

const CATEGORY_STYLES: Record<MasterSkillCategory, string> = {
  LANGUAGE: "bg-[#1f222a] text-[#f4f2ec] border-[#3d4352]",
  FRAMEWORK: "bg-[#1f222a] text-[#d4a745] border-[#d4a745]/40",
  DATABASE: "bg-[#1f222a] text-[#8ab384] border-[#8ab384]/40",
  CLOUD: "bg-[#1f222a] text-[#d4a745] border-[#d4a745]/40",
  TOOL: "bg-[#15171d] text-[#a6abbd] border-[#2a2e38]",
  DOMAIN: "bg-[#1f222a] text-[#8ab384] border-[#8ab384]/40",
};

interface ProfileNavTab {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  countKey?: "skills" | "experiences" | "projects";
}

const PROFILE_NAV_TABS: ProfileNavTab[] = [
  { id: "preferences", label: "01 · PREFERENCES", icon: Sliders },
  { id: "skills", label: "02 · SKILLS", icon: Wrench, countKey: "skills" },
  { id: "experiences", label: "03 · EXPERIENCE", icon: Briefcase, countKey: "experiences" },
  { id: "projects", label: "04 · PROJECTS", icon: FolderGit2, countKey: "projects" },
  { id: "resume", label: "05 · MASTER RESUME", icon: FileText },
];

export default function ProfileDrawer({
  isOpen,
  onClose,
  onProfileUpdated,
}: ProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("preferences");
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
    location: "",
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
    targetRoleKeywords: [],
    techStack: [],
    companyStageBlacklist: [],
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
        setSuccessMessage("Candidate profile updated & strictly persisted to database.");
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
        // Auto-save to database immediately so changes take effect everywhere
        const saveRes = await updateCandidateProfile(res.profile);
        const finalProfile = saveRes.success ? saveRes.profile : res.profile;
        setProfile(finalProfile);
        if (onProfileUpdated) onProfileUpdated(finalProfile);

        const methodLabel = res.method === "deterministic" ? "Instant Deterministic" : "AI Parser";
        const summaryMsg = `[${methodLabel}] Parsed & saved to database: ${finalProfile.skills.length} skills, ${finalProfile.projects.length} projects, and ${finalProfile.experiences.length} experience roles.`;
        setSuccessMessage(summaryMsg);
        setParseSummary(summaryMsg);
        if (finalProfile.projects.length > 0) {
          setExpandedProjectId(finalProfile.projects[0].id);
        }
        if (finalProfile.experiences.length > 0) {
          setExpandedExpId(finalProfile.experiences[0].id);
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

        // Automatically parse and sync to DB
        const parseRes = await parseCandidateResumeAction(res.markdown, profile.id, "deterministic");
        if (parseRes.success && parseRes.profile) {
          const saveRes = await updateCandidateProfile(parseRes.profile);
          const finalProfile = saveRes.success ? saveRes.profile : parseRes.profile;
          setProfile(finalProfile);
          if (onProfileUpdated) onProfileUpdated(finalProfile);
          if (finalProfile.projects.length > 0) {
            setExpandedProjectId(finalProfile.projects[0].id);
          }
          if (finalProfile.experiences.length > 0) {
            setExpandedExpId(finalProfile.experiences[0].id);
          }
          setSuccessMessage(
            `Loaded and synced local resume (${res.filename || "file"}). Profile saved and updated in database!`
          );
          setTimeout(() => setSuccessMessage(null), 4000);
          return;
        }

        setSuccessMessage(
          `Loaded local resume (${res.filename || "file"}). Click "Parse Instantly" to populate and save.`
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
    <BottomSheet
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      desktopClassName={TACTICAL_DRAWER_CLASS}
      mobileClassName="bg-[#15171d] border-t border-[#2a2e38]"
    >
        {/* Drawer Header */}
        <SheetHeader className="p-6 border-b border-[#2a2e38] bg-[#15171d] shrink-0 space-y-4 text-left">
          <div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#d4a745]">
                  CANDIDATE MASTER FACTS
                </span>
                <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#a6abbd]">
                  {profile.projects.length} Projects · {profile.skills.length} Skills · {profile.experiences.length} Roles
                </span>
              </div>
              <SheetTitle className="text-xl font-bold tracking-tight text-[#f4f2ec]">
                {profile.name || "Candidate Profile"}
              </SheetTitle>
              <SheetDescription className="text-xs text-[#a6abbd]">
                Verified facts repository for automated resume tailoring &amp; question answering.
              </SheetDescription>
            </div>
          </div>

          {/* Notification Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-[2px] bg-[#15171d] border border-[#c4634e] text-[#c4634e] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#c4634e]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-[2px] bg-[#15171d] border border-[#8ab384] text-[#8ab384] text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-[#8ab384]" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Navigation Tabs with 12px monospace indicators */}
          <div className="flex rounded-[2px] bg-[#0d0e12] p-1 border border-[#2a2e38] text-xs font-mono font-semibold overflow-x-auto no-scrollbar gap-1.5 select-none">
            {PROFILE_NAV_TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              const count = tab.countKey ? profile[tab.countKey].length : null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "shrink-0 whitespace-nowrap py-1.5 px-3 rounded-[2px] flex items-center justify-center gap-1.5 border transition-colors text-xs focus-visible:outline-2 focus-visible:outline-[#d4a745]",
                    isSelected
                      ? "bg-[#1f222a] text-[#f4f2ec] border-[#3d4352]"
                      : "border-transparent text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#15171d]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 text-[#d4a745]" />
                  <span>{tab.label}</span>
                  {count !== null && (
                    <span className="px-1.5 py-0.5 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#a6abbd] font-mono text-[10px]">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </SheetHeader>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0d0e12]">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-[#a6abbd] text-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#d4a745]" />
                <span className="font-mono">Loading candidate master facts...</span>
              </div>
            </div>
          ) : (
            <>
              {/* 1. PREFERENCES & SCALAR FILTERS TAB */}
              {activeTab === "preferences" && (
                <div className="space-y-6">
                  <div className="bg-[#15171d] p-5 rounded-[3px] border border-[#2a2e38] space-y-4">
                    <h3 className="text-sm font-semibold text-[#f4f2ec] tracking-tight flex items-center gap-2 font-mono">
                      <Sliders className="w-4 h-4 text-[#d4a745]" />
                      <span>PRIMARY CANDIDATE PROFILE</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#a6abbd]">
                          Candidate Name
                        </label>
                        <Input
                          type="text"
                          value={profile.name}
                          onChange={(e) =>
                            setProfile((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="e.g. Alex Builder"
                          className="bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] rounded-[2px]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#a6abbd]">
                          Current Residence / Base Location
                        </label>
                        <Input
                          type="text"
                          value={profile.location || ""}
                          onChange={(e) =>
                            setProfile((prev) => ({ ...prev, location: e.target.value }))
                          }
                          placeholder="e.g. San Francisco, CA / Kochi, India"
                          className="bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] rounded-[2px]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#a6abbd]">
                          Target Role Title
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
                          className="bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] rounded-[2px]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#a6abbd]">
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
                            className="flex h-9 w-28 shrink-0 rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] px-2 py-1 text-xs font-mono font-medium text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
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
                            className="font-mono flex-1 min-w-0 bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] rounded-[2px]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#a6abbd]">
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
                          className="font-mono bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] rounded-[2px]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#a6abbd]">
                          Remote Preference Filter
                        </label>
                        <select
                          value={profile.remotePreference}
                          onChange={(e) =>
                            setProfile((prev) => ({
                              ...prev,
                              remotePreference: e.target.value,
                            }))
                          }
                          className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] px-3 py-1 text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                        >
                          <option value="ANY">Any / Flexible Mode</option>
                          <option value="REMOTE_ONLY">Remote Only</option>
                          <option value="HYBRID">Hybrid</option>
                          <option value="ONSITE">Onsite Only</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Preferred Locations */}
                  <div className="bg-[#15171d] p-5 rounded-[3px] border border-[#2a2e38] space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-[#f4f2ec] tracking-tight flex items-center gap-2 font-mono">
                        <span className="w-2 h-2 rounded-full bg-[#d4a745]" />
                        <span>GEOGRAPHIC HUB &amp; LOCATION PREFERENCES</span>
                      </h3>
                      <p className="text-xs text-[#a6abbd]">
                        Add preferred relocation hubs, cities, or &quot;Remote&quot;. If an onsite/hybrid role is outside your current residence, the AI checks if it matches these hubs or flags relocation.
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
                        className="flex-1 bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745] rounded-[2px]"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAddLocation}
                        className="h-9 font-mono text-xs rounded-[2px] border border-[#2a2e38] bg-[#1f222a] text-[#f4f2ec] hover:bg-[#3d4352]"
                      >
                        Add Hub
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {profile.preferredLocations.length === 0 ? (
                        <span className="text-xs text-[#a6abbd] italic font-mono">
                          No preferred locations set (flexible anywhere).
                        </span>
                      ) : (
                        profile.preferredLocations.map((loc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#f4f2ec] text-xs font-mono"
                          >
                            <span>{loc}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLocation(idx)}
                              className="text-[#a6abbd] hover:text-[#c4634e] transition-colors"
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

              {/* 2. VERIFIED SKILLS REPOSITORY TAB */}
              {activeTab === "skills" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-[#f4f2ec] tracking-tight font-mono">
                      VERIFIED SKILLS REPOSITORY
                    </h3>
                    <p className="text-xs text-[#a6abbd]">
                      Categorized verified skills with years of experience. Anti-hallucination engines strictly match against these entries.
                    </p>
                  </div>

                  {/* Add Skill Form */}
                  <div className="bg-[#15171d] p-4 rounded-[3px] border border-[#2a2e38] space-y-3">
                    <h4 className="text-xs font-mono font-semibold text-[#a6abbd] uppercase tracking-wider">
                      Add New Verified Skill
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="block text-xs font-medium text-[#a6abbd]">
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
                          className="bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[#a6abbd]">
                          Category
                        </label>
                        <select
                          value={newSkillCategory}
                          onChange={(e) =>
                            setNewSkillCategory(
                              e.target.value as MasterSkillCategory
                            )
                          }
                          className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#0d0e12] px-3 py-1 text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                        >
                          {SKILL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-[#a6abbd]">
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
                            className="font-mono bg-[#0d0e12] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddSkill}
                            className="h-9 shrink-0 font-mono text-xs font-bold rounded-[2px] bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12]"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSkillCategory("ALL")}
                      className={cn(
                        "rounded-[2px] h-7 text-xs font-mono px-3 transition-colors border flex items-center justify-center",
                        selectedSkillCategory === "ALL"
                          ? "bg-[#1f222a] text-[#f4f2ec] border-[#3d4352]"
                          : "border-[#2a2e38] bg-[#0d0e12] text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#15171d]"
                      )}
                    >
                      All ({profile.skills.length})
                    </button>

                    {SKILL_CATEGORIES.map((cat) => {
                      const count = profile.skills.filter(
                        (s) => s.category === cat
                      ).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedSkillCategory(cat)}
                          className={cn(
                            "rounded-[2px] h-7 text-xs font-mono px-3 transition-colors border flex items-center justify-center",
                            selectedSkillCategory === cat
                              ? "bg-[#1f222a] text-[#f4f2ec] border-[#3d4352]"
                              : "border-[#2a2e38] bg-[#0d0e12] text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#15171d]"
                          )}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Skills Grid */}
                  <div className="bg-[#15171d] p-5 rounded-[3px] border border-[#2a2e38]">
                    {filteredSkills.length === 0 ? (
                      <p className="text-xs text-[#a6abbd] font-mono italic text-center py-4">
                        No skills found in this category.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {filteredSkills.map((skill) => (
                          <span
                            key={skill.name}
                            className={cn(
                              "inline-flex items-center gap-1.5 py-1 px-2.5 text-xs font-mono rounded-[2px] border transition-colors",
                              CATEGORY_STYLES[skill.category] || "bg-[#1f222a] text-[#f4f2ec] border-[#2a2e38]"
                            )}
                          >
                            <span>{skill.name}</span>
                            {skill.yearsOfExperience !== null &&
                              skill.yearsOfExperience !== undefined && (
                                <span className="font-mono text-[10px] text-[#a6abbd]">
                                  {skill.yearsOfExperience}y
                                </span>
                              )}
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill.name)}
                              className="text-[#a6abbd] hover:text-[#c4634e] font-bold ml-0.5"
                              title={`Remove ${skill.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. WORK EXPERIENCES TAB */}
              {activeTab === "experiences" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[#f4f2ec] tracking-tight font-mono">
                        WORK EXPERIENCE RECORDS
                      </h3>
                      <p className="text-xs text-[#a6abbd]">
                        Structured career timeline used to formulate tailored executive summaries and answer behavioral prompts.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddExperience}
                      className="gap-1.5 font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] hover:bg-[#1f222a]"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#d4a745]" />
                      <span>Add Experience</span>
                    </Button>
                  </div>

                  {profile.experiences.length === 0 ? (
                    <div className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-8 text-center space-y-3">
                      <p className="text-xs text-[#a6abbd] font-mono">
                        No work experience records found.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddExperience}
                        className="font-mono text-xs rounded-[2px] bg-[#d4a745] text-[#0d0e12] font-bold"
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
                            className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] overflow-hidden transition-all"
                          >
                            <div
                              onClick={() =>
                                setExpandedExpId(isExpanded ? null : exp.id)
                              }
                              className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1f222a] transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-[#f4f2ec]">
                                    {exp.title}
                                  </h4>
                                  <span className="text-xs font-semibold text-[#d4a745]">
                                    @ {exp.company}
                                  </span>
                                  {exp.isCurrent && (
                                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-[2px] bg-[#1f222a] border border-[#8ab384]/60 text-[#8ab384]">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[#a6abbd] flex items-center gap-2 font-mono">
                                  {exp.location && <span>{exp.location}</span>}
                                  {exp.remoteStatus && <span>· {exp.remoteStatus}</span>}
                                  {exp.startDate && (
                                    <span>
                                      · {exp.startDate} - {exp.isCurrent ? "Present" : exp.endDate || "N/A"}
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
                                  className="text-[#a6abbd] hover:text-[#c4634e] hover:bg-[#0d0e12]"
                                  title="Delete experience"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <ChevronDown
                                  className={cn(
                                    "w-4 h-4 text-[#a6abbd] transition-transform",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-5 border-t border-[#2a2e38] bg-[#0d0e12] space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
                                      Workplace Mode
                                    </label>
                                    <select
                                      value={exp.remoteStatus}
                                      onChange={(e) =>
                                        handleUpdateExperience(exp.id, {
                                          remoteStatus: e.target.value as RemoteStatus,
                                        })
                                      }
                                      className="flex h-9 w-full rounded-[2px] border border-[#2a2e38] bg-[#15171d] px-3 py-1 text-xs font-mono text-[#f4f2ec] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
                                    >
                                      <option value="REMOTE">Remote</option>
                                      <option value="HYBRID">Hybrid</option>
                                      <option value="ONSITE">Onsite</option>
                                      <option value="UNKNOWN">Unknown / Other</option>
                                    </select>
                                  </div>

                                  <div className="flex items-center pt-5">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#f4f2ec] font-mono">
                                      <input
                                        type="checkbox"
                                        checked={exp.isCurrent}
                                        onChange={(e) =>
                                          handleUpdateExperience(exp.id, {
                                            isCurrent: e.target.checked,
                                          })
                                        }
                                        className="rounded-[2px] border-[#2a2e38] text-[#d4a745] focus:ring-[#d4a745] bg-[#15171d]"
                                      />
                                      <span>Currently Working Here</span>
                                    </label>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="font-mono bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="font-mono disabled:opacity-50 bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                    className="text-xs bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
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

              {/* 4. MASTER PROJECTS TAB */}
              {activeTab === "projects" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[#f4f2ec] tracking-tight font-mono">
                        MASTER PROJECT CATALOG
                      </h3>
                      <p className="text-xs text-[#a6abbd]">
                        Add rich projects with metrics, bullet points, and tech stacks. AI selects the top 2-3 most relevant for each application.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddProject}
                      className="gap-1.5 font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] hover:bg-[#1f222a]"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#d4a745]" />
                      <span>Add Master Project</span>
                    </Button>
                  </div>

                  {profile.projects.length === 0 ? (
                    <div className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-8 text-center space-y-3">
                      <p className="text-xs text-[#a6abbd] font-mono">
                        No master projects added yet. Add projects to enable AI resume tailoring.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddProject}
                        className="font-mono text-xs rounded-[2px] bg-[#d4a745] text-[#0d0e12] font-bold"
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
                            className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] overflow-hidden transition-all"
                          >
                            <div
                              onClick={() =>
                                setExpandedProjectId(isExpanded ? null : proj.id)
                              }
                              className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#1f222a] transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-[#f4f2ec]">
                                    {proj.title || "Untitled Project"}
                                  </h4>
                                  {proj.company && (
                                    <span className="text-xs font-semibold text-[#d4a745]">
                                      @ {proj.company}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#a6abbd]">
                                  {proj.technologies.slice(0, 4).map((t, idx) => (
                                    <span
                                      key={idx}
                                      className="font-mono text-[10px] py-0.5 px-1.5 rounded-[2px] bg-[#0d0e12] border border-[#2a2e38] text-[#a6abbd]"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                  {proj.technologies.length > 4 && (
                                    <span className="text-[10px] font-mono text-[#a6abbd]">
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
                                  className="text-[#a6abbd] hover:text-[#c4634e] hover:bg-[#0d0e12]"
                                  title="Delete project"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <ChevronDown
                                  className={cn(
                                    "w-4 h-4 text-[#a6abbd] transition-transform",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="p-5 border-t border-[#2a2e38] bg-[#0d0e12] space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      placeholder="e.g. Vanguard or Independent"
                                      className="bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                    className="bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                    className="font-mono bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="font-mono text-xs bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-xs font-semibold text-[#a6abbd]">
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
                                      className="text-xs bg-[#15171d] border-[#2a2e38] text-[#f4f2ec] rounded-[2px]"
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

              {/* 5. BASE RESUME TEXT TAB */}
              {activeTab === "resume" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#f4f2ec] tracking-tight flex items-center gap-2 font-mono">
                        <span>MASTER RESUME SOURCE</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#d4a745]">
                          GROUNDING SOURCE
                        </span>
                      </h3>
                      <p className="text-xs text-[#a6abbd]">
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
                        className="gap-1.5 font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] hover:bg-[#1f222a]"
                        title="Load markdown from .scratch/Resume/"
                      >
                        {isReadingLocalResume ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-[#d4a745]" />
                        )}
                        <span>Load Local File</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleParseResume("deterministic")}
                        disabled={isParsingResume || !profile.resumeText.trim()}
                        className="gap-1.5 font-mono text-xs font-bold rounded-[2px] bg-[#8ab384] hover:bg-[#9bc295] text-[#0d0e12]"
                        title="Extract all profile fields deterministically without AI (0ms, 0 API calls)"
                      >
                        <Zap className="w-3.5 h-3.5 text-[#0d0e12]" />
                        <span>Parse Instantly (No AI)</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleParseResume("ai")}
                        disabled={isParsingResume || !profile.resumeText.trim()}
                        className="gap-1.5 font-mono text-xs rounded-[2px] border-[#d4a745]/50 bg-[#15171d] text-[#d4a745] hover:bg-[#1f222a]"
                        title="Extract profile fields using AI models (Gemini / Groq)"
                      >
                        {isParsingResume ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Parsing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#d4a745]" />
                            <span>Parse with AI</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Information banner about extraction */}
                  <div className="p-3.5 rounded-[2px] bg-[#15171d] border border-[#2a2e38] text-[#a6abbd] text-xs flex items-start gap-2.5">
                    <Zap className="w-4 h-4 shrink-0 text-[#8ab384] mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-[#f4f2ec]">
                        Deterministic Local Parsing (Recommended)
                      </p>
                      <p className="leading-relaxed">
                        <strong className="text-[#8ab384]">&quot;Parse Instantly (No AI)&quot;</strong> extracts your name, target role, technical skills, projects, and work history directly from Markdown in &lt;1ms without using AI API quotas. Use <strong className="text-[#d4a745]">&quot;Parse with AI&quot;</strong> only if your resume is unformatted free-form text.
                      </p>
                    </div>
                  </div>

                  {parseSummary && (
                    <div className="p-3 rounded-[2px] bg-[#15171d] border border-[#8ab384] text-[#8ab384] text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0 text-[#8ab384]" />
                      <span>{parseSummary}</span>
                    </div>
                  )}

                  <div className="bg-[#15171d] p-4 rounded-[3px] border border-[#2a2e38] space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#a6abbd] pb-1 border-b border-[#2a2e38]">
                      <span className="font-mono text-xs text-[#a6abbd]">
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
                        className="gap-1.5 h-7 font-mono text-xs text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#1f222a] rounded-[2px]"
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
                      className="font-mono text-xs text-[#f4f2ec] placeholder:text-[#a6abbd]/60 focus-visible:outline-2 focus-visible:outline-[#d4a745] leading-relaxed resize-none p-4 bg-[#0d0e12] border-[#2a2e38] rounded-[2px]"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <SheetFooter className="p-4 border-t border-[#2a2e38] bg-[#15171d] flex flex-row items-center justify-between shrink-0 text-xs text-[#a6abbd]">
          <span className="font-mono text-xs">Profile ID: {profile.id}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="font-mono text-xs rounded-[2px] border-[#2a2e38] bg-[#0d0e12] text-[#f4f2ec] hover:bg-[#1f222a]"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="font-bold text-xs gap-1.5 bg-[#d4a745] hover:bg-[#e8bd59] text-[#0d0e12] rounded-[2px] focus-visible:outline-2 focus-visible:outline-[#d4a745]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Profile</span>
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
    </BottomSheet>
  );
}
