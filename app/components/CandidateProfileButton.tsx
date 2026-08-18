"use client";

import { useState } from "react";
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

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          "group text-xs font-semibold text-zinc-300 hover:text-zinc-100 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700",
          className
        )}
      >
        <User className="h-3.5 w-3.5 text-zinc-400 group-hover:text-violet-400 transition-colors" />
        <span>Candidate Profile</span>
      </Button>

      <ProfileDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

