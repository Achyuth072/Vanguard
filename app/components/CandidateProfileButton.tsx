"use client";

import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProfileDrawer from "./ProfileDrawer";

interface CandidateProfileButtonProps {
  className?: string;
}

export default function CandidateProfileButton({
  className,
}: CandidateProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-profile-drawer", handleOpen);
    return () => window.removeEventListener("open-profile-drawer", handleOpen);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        data-testid="candidate-profile-button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "group text-xs font-mono font-semibold text-[#f4f2ec] border-[#2a2e38] bg-[#15171d] hover:bg-[#1f222a] hover:border-[#3d4352] rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-[#d4a745]",
          className
        )}
      >
        <User className="h-3.5 w-3.5 text-[#d4a745] transition-colors" />
        <span>Candidate Profile</span>
      </Button>

      <ProfileDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
