"use client";

import { useState } from "react";
import ProfileDrawer from "./ProfileDrawer";

interface CandidateProfileButtonProps {
  className?: string;
}

export default function CandidateProfileButton({
  className = "group flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-800 bg-[#0D0D0D] text-neutral-400 hover:text-white hover:border-neutral-700 transition-all text-xs font-semibold cursor-pointer",
}: CandidateProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <svg
          className="w-4 h-4 text-neutral-500 group-hover:text-purple-400 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <span>Candidate Profile</span>
      </button>

      <ProfileDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
