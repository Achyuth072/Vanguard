"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCandidateProfile,
  updateCandidateProfile,
} from "@/app/actions/candidate";
import type {
  CandidateProfile,
  MasterProject,
  MasterExperience,
  MasterSkill,
  MasterSkillCategory,
  RemoteStatus,
} from "@/types/candidate";

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

const CATEGORY_COLORS: Record<MasterSkillCategory, string> = {
  LANGUAGE: "bg-blue-950/60 border-blue-800 text-blue-300",
  FRAMEWORK: "bg-purple-950/60 border-purple-800 text-purple-300",
  DATABASE: "bg-emerald-950/60 border-emerald-800 text-emerald-300",
  CLOUD: "bg-amber-950/60 border-amber-800 text-amber-300",
  TOOL: "bg-pink-950/60 border-pink-800 text-pink-300",
  DOMAIN: "bg-cyan-950/60 border-cyan-800 text-cyan-300",
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

  // Form State
  const [profile, setProfile] = useState<CandidateProfile>({
    id: "candidate-default",
    name: "Default Candidate",
    targetRole: "Software Engineer",
    minSalary: 0,
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-4xl bg-[#0A0A0A] border-l border-neutral-800 text-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-6 border-b border-neutral-800 bg-[#0E0E0E] shrink-0 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800 text-purple-400 font-bold">
                    Candidate Master Facts
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-neutral-900 text-neutral-400 border-neutral-800">
                    {profile.projects.length} Projects • {profile.skills.length} Skills • {profile.experiences.length} Roles
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {profile.name || "Candidate Profile"}
                </h2>
                <p className="text-xs text-neutral-400">
                  Verified facts repository for automated resume tailoring & question answering.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 transition-all text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Profile</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  aria-label="Close drawer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Notification Alerts */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMessage}</span>
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

            {/* Navigation Tabs */}
            <div className="flex rounded-lg bg-[#141414] p-1 border border-neutral-800 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`flex-1 min-w-[120px] py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "general"
                    ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span>General & Target</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("projects")}
                className={`flex-1 min-w-[120px] py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "projects"
                    ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span>Master Projects</span>
                <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-400 font-mono text-[10px]">
                  {profile.projects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("experiences")}
                className={`flex-1 min-w-[120px] py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "experiences"
                    ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span>Work Experience</span>
                <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-400 font-mono text-[10px]">
                  {profile.experiences.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("skills")}
                className={`flex-1 min-w-[120px] py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "skills"
                    ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span>Skills Repository</span>
                <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-400 font-mono text-[10px]">
                  {profile.skills.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("resume")}
                className={`flex-1 min-w-[120px] py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "resume"
                    ? "bg-purple-950/70 border border-purple-800/80 text-purple-300 shadow-sm font-bold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span>Base Resume Text</span>
              </button>
            </div>
          </div>

          {/* Drawer Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-neutral-500 text-xs">
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading candidate master facts...</span>
                </div>
              </div>
            ) : (
              <>
                {/* 1. GENERAL & TARGET PREFERENCES TAB */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    <div className="bg-[#111] p-5 rounded-xl border border-neutral-800 space-y-4">
                      <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                        Primary Profile Information
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-semibold text-neutral-400 mb-1">
                            Candidate Name
                          </label>
                          <input
                            type="text"
                            value={profile.name}
                            onChange={(e) =>
                              setProfile((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="e.g. Alex Builder"
                            className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-semibold text-neutral-400 mb-1">
                            Target Role
                          </label>
                          <input
                            type="text"
                            value={profile.targetRole}
                            onChange={(e) =>
                              setProfile((prev) => ({
                                ...prev,
                                targetRole: e.target.value,
                              }))
                            }
                            placeholder="e.g. Senior Software Engineer"
                            className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-semibold text-neutral-400 mb-1">
                            Min. Expected Salary ($ / yr)
                          </label>
                          <input
                            type="number"
                            value={profile.minSalary || ""}
                            onChange={(e) =>
                              setProfile((prev) => ({
                                ...prev,
                                minSalary: Math.max(0, parseInt(e.target.value, 10) || 0),
                              }))
                            }
                            placeholder="e.g. 120000"
                            className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-semibold text-neutral-400 mb-1">
                            Years of Experience
                          </label>
                          <input
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
                            className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] uppercase tracking-wider font-semibold text-neutral-400 mb-1">
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
                            className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2.5 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
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
                    <div className="bg-[#111] p-5 rounded-xl border border-neutral-800 space-y-4">
                      <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        Location Preferences
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Add geographic hubs, cities, or &quot;Remote&quot; to evaluate job location matches.
                      </p>

                      <div className="flex items-center gap-2">
                        <input
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
                          className="flex-1 bg-[#161616] border border-neutral-800 rounded-lg p-2.5 text-xs text-white placeholder-neutral-600 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddLocation}
                          className="px-4 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
                        >
                          Add Hub
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {profile.preferredLocations.length === 0 ? (
                          <span className="text-xs text-neutral-500 italic">
                            No preferred locations set (flexible anywhere).
                          </span>
                        ) : (
                          profile.preferredLocations.map((loc, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-800/80 text-cyan-300 text-xs font-medium"
                            >
                              <span>{loc}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveLocation(idx)}
                                className="hover:text-cyan-100 p-0.5 rounded-full"
                                aria-label={`Remove location ${loc}`}
                              >
                                &times;
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
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          Master Project Catalog
                        </h3>
                        <p className="text-xs text-neutral-400">
                          Add rich projects with metrics, bullet points, and tech stacks. AI selects the top 2-3 most relevant for each application.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddProject}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-950/80 border border-purple-800 hover:bg-purple-900 text-purple-300 text-xs font-bold transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Master Project</span>
                      </button>
                    </div>

                    {profile.projects.length === 0 ? (
                      <div className="bg-[#111] border border-neutral-800 rounded-xl p-8 text-center space-y-3">
                        <p className="text-xs text-neutral-400">
                          No master projects added yet. Add projects to enable AI resume tailoring.
                        </p>
                        <button
                          type="button"
                          onClick={handleAddProject}
                          className="px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 text-xs font-bold"
                        >
                          Create First Project
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {profile.projects.map((proj) => {
                          const isExpanded = expandedProjectId === proj.id;
                          return (
                            <div
                              key={proj.id}
                              className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden transition-all"
                            >
                              {/* Project Header */}
                              <div
                                onClick={() =>
                                  setExpandedProjectId(isExpanded ? null : proj.id)
                                }
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-900/40 transition-colors"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-white">
                                      {proj.title || "Untitled Project"}
                                    </h4>
                                    {proj.company && (
                                      <span className="text-xs text-neutral-400">
                                        @ {proj.company}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                                    {proj.technologies.slice(0, 4).map((t, idx) => (
                                      <span
                                        key={idx}
                                        className="px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                    {proj.technologies.length > 4 && (
                                      <span className="text-[10px] text-neutral-500">
                                        +{proj.technologies.length - 4} more
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveProject(proj.id);
                                    }}
                                    className="text-neutral-500 hover:text-rose-400 p-1 rounded transition-colors"
                                    title="Delete project"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  <svg
                                    className={`w-4 h-4 text-neutral-400 transition-transform ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Project Expanded Editor */}
                              {isExpanded && (
                                <div className="p-5 border-t border-neutral-800/80 bg-[#0D0D0D] space-y-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Project Title *
                                      </label>
                                      <input
                                        type="text"
                                        value={proj.title}
                                        onChange={(e) =>
                                          handleUpdateProject(proj.id, {
                                            title: e.target.value,
                                          })
                                        }
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Company / Context
                                      </label>
                                      <input
                                        type="text"
                                        value={proj.company}
                                        onChange={(e) =>
                                          handleUpdateProject(proj.id, {
                                            company: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. Pulse or Independent"
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Your Role
                                      </label>
                                      <input
                                        type="text"
                                        value={proj.role}
                                        onChange={(e) =>
                                          handleUpdateProject(proj.id, {
                                            role: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. Lead Engineer"
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                      Project Description & Scope
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={proj.description}
                                      onChange={(e) =>
                                        handleUpdateProject(proj.id, {
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="Brief architectural overview of what you built and why..."
                                      className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                      Technologies (Comma-separated)
                                    </label>
                                    <input
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
                                      className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white font-mono focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Measurable Metrics (One per line)
                                      </label>
                                      <textarea
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
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white font-mono focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Highlights / Bullet Points (One per line)
                                      </label>
                                      <textarea
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
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
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
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          Work Experience Records
                        </h3>
                        <p className="text-xs text-neutral-400">
                          Structured career timeline used to formulate tailored executive summaries and answer behavioral prompts.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddExperience}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-950/80 border border-purple-800 hover:bg-purple-900 text-purple-300 text-xs font-bold transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Experience</span>
                      </button>
                    </div>

                    {profile.experiences.length === 0 ? (
                      <div className="bg-[#111] border border-neutral-800 rounded-xl p-8 text-center space-y-3">
                        <p className="text-xs text-neutral-400">
                          No work experience records found.
                        </p>
                        <button
                          type="button"
                          onClick={handleAddExperience}
                          className="px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 text-xs font-bold"
                        >
                          Add First Role
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {profile.experiences.map((exp) => {
                          const isExpanded = expandedExpId === exp.id;
                          return (
                            <div
                              key={exp.id}
                              className="bg-[#111] border border-neutral-800 rounded-xl overflow-hidden transition-all"
                            >
                              <div
                                onClick={() =>
                                  setExpandedExpId(isExpanded ? null : exp.id)
                                }
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-900/40 transition-colors"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-white">
                                      {exp.title}
                                    </h4>
                                    <span className="text-xs text-neutral-400">
                                      @ {exp.company}
                                    </span>
                                    {exp.isCurrent && (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[10px] font-bold">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                                    {exp.location && <span>{exp.location}</span>}
                                    {exp.remoteStatus && <span>• {exp.remoteStatus}</span>}
                                    {exp.startDate && (
                                      <span>
                                        • {exp.startDate} - {exp.isCurrent ? "Present" : exp.endDate || "N/A"}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveExperience(exp.id);
                                    }}
                                    className="text-neutral-500 hover:text-rose-400 p-1 rounded transition-colors"
                                    title="Delete experience"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  <svg
                                    className={`w-4 h-4 text-neutral-400 transition-transform ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="p-5 border-t border-neutral-800/80 bg-[#0D0D0D] space-y-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Company Name *
                                      </label>
                                      <input
                                        type="text"
                                        value={exp.company}
                                        onChange={(e) =>
                                          handleUpdateExperience(exp.id, {
                                            company: e.target.value,
                                          })
                                        }
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Job Title *
                                      </label>
                                      <input
                                        type="text"
                                        value={exp.title}
                                        onChange={(e) =>
                                          handleUpdateExperience(exp.id, {
                                            title: e.target.value,
                                          })
                                        }
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Location
                                      </label>
                                      <input
                                        type="text"
                                        value={exp.location}
                                        onChange={(e) =>
                                          handleUpdateExperience(exp.id, {
                                            location: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. San Francisco, CA"
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Workplace Mode
                                      </label>
                                      <select
                                        value={exp.remoteStatus}
                                        onChange={(e) =>
                                          handleUpdateExperience(exp.id, {
                                            remoteStatus: e.target.value as RemoteStatus,
                                          })
                                        }
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      >
                                        <option value="REMOTE">Remote</option>
                                        <option value="HYBRID">Hybrid</option>
                                        <option value="ONSITE">Onsite</option>
                                        <option value="UNKNOWN">Unknown / Other</option>
                                      </select>
                                    </div>

                                    <div className="flex items-center pt-5">
                                      <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                                        <input
                                          type="checkbox"
                                          checked={exp.isCurrent}
                                          onChange={(e) =>
                                            handleUpdateExperience(exp.id, {
                                              isCurrent: e.target.checked,
                                            })
                                          }
                                          className="rounded border-neutral-800 text-purple-600 focus:ring-purple-500 bg-[#161616]"
                                        />
                                        <span>Currently Working Here</span>
                                      </label>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        Start Date
                                      </label>
                                      <input
                                        type="text"
                                        value={exp.startDate || ""}
                                        onChange={(e) =>
                                          handleUpdateExperience(exp.id, {
                                            startDate: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. 2021-01"
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white font-mono focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                        End Date
                                      </label>
                                      <input
                                        type="text"
                                        disabled={exp.isCurrent}
                                        value={exp.isCurrent ? "Present" : exp.endDate || ""}
                                        onChange={(e) =>
                                          handleUpdateExperience(exp.id, {
                                            endDate: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. 2023-12"
                                        className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white font-mono focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none disabled:opacity-50"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                                      Key Responsibilities & Highlights (One per line)
                                    </label>
                                    <textarea
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
                                      className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
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
                      <h3 className="text-sm font-bold text-white tracking-tight">
                        Master Skills Repository
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Categorized skills with years of experience. Anti-hallucination engines strictly match against these entries.
                      </p>
                    </div>

                    {/* Add Skill Form */}
                    <div className="bg-[#111] p-4 rounded-xl border border-neutral-800 space-y-3">
                      <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                        Add New Skill
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                            Skill Name *
                          </label>
                          <input
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
                            className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                            Category
                          </label>
                          <select
                            value={newSkillCategory}
                            onChange={(e) =>
                              setNewSkillCategory(
                                e.target.value as MasterSkillCategory
                              )
                            }
                            className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                          >
                            {SKILL_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                            Years Exp. (Opt)
                          </label>
                          <div className="flex gap-2">
                            <input
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
                              className="w-full bg-[#161616] border border-neutral-800 rounded-lg p-2 text-xs text-white font-mono focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddSkill}
                              className="px-3 py-2 rounded-lg bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedSkillCategory("ALL")}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                          selectedSkillCategory === "ALL"
                            ? "bg-neutral-200 text-black font-bold"
                            : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                        }`}
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
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                              selectedSkillCategory === cat
                                ? "bg-purple-600 text-white font-bold"
                                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
                            }`}
                          >
                            {cat} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Skills Grid */}
                    <div className="bg-[#111] p-5 rounded-xl border border-neutral-800">
                      {filteredSkills.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic text-center py-4">
                          No skills found in this category.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {filteredSkills.map((skill) => (
                            <span
                              key={skill.name}
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium ${
                                CATEGORY_COLORS[skill.category] ||
                                "bg-neutral-900 border-neutral-800 text-neutral-300"
                              }`}
                            >
                              <span>{skill.name}</span>
                              {skill.yearsOfExperience !== null &&
                                skill.yearsOfExperience !== undefined && (
                                  <span className="font-mono text-[10px] opacity-80">
                                    {skill.yearsOfExperience}y
                                  </span>
                                )}
                              <button
                                type="button"
                                onClick={() => handleRemoveSkill(skill.name)}
                                className="hover:opacity-100 opacity-60 hover:text-rose-300 font-bold ml-0.5"
                                title={`Remove ${skill.name}`}
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. BASE RESUME TEXT TAB */}
                {activeTab === "resume" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          Raw Resume / Markdown Bio
                        </h3>
                        <p className="text-xs text-neutral-400">
                          Full textual biography and resume text. Used for deep grounding and semantic matching.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-neutral-500">
                          {profile.resumeText.length} chars
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(profile.resumeText);
                            setSuccessMessage("Resume text copied to clipboard!");
                            setTimeout(() => setSuccessMessage(null), 2000);
                          }}
                          className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#111] p-4 rounded-xl border border-neutral-800 space-y-2">
                      <textarea
                        rows={18}
                        value={profile.resumeText}
                        onChange={(e) =>
                          setProfile((prev) => ({
                            ...prev,
                            resumeText: e.target.value,
                          }))
                        }
                        placeholder="Paste your full unformatted resume text or Markdown summary here..."
                        className="w-full bg-[#0A0A0A] border border-neutral-800 rounded-lg p-4 text-xs text-neutral-200 placeholder-neutral-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none font-mono leading-relaxed resize-none"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-neutral-800 bg-[#0E0E0E] flex items-center justify-between shrink-0 text-xs text-neutral-500">
            <span>Profile ID: {profile.id}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
