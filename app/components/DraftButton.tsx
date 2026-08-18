"use client";

import { useState } from "react";
import { generateDraft } from "../actions";
import { Button } from "@/components/ui/button";

export default function DraftButton({ company, role }: { company: string; role: string }) {
  const [isDrafting, setIsDrafting] = useState(false);

  const handleDraft = async () => {
    setIsDrafting(true);

    try {
      const result = await generateDraft(role, company);

      if (result.success && result.message) {
        alert(
          `>> PULSE AGENT LOG [${new Date().toLocaleTimeString()}]\n\nACTION: GENERATE_DRAFT_EMAIL\nTARGET: ${company}\n----------------------------------\n\n${result.message}\n\n[STATUS: Draft saved to Outbox]`
        );
      } else {
        alert("Error: AI could not generate a draft at this time.");
      }
    } catch (error) {
      console.error("Draft failed", error);
      alert("System Error: Failed to connect to Agent.");
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDraft}
      disabled={isDrafting}
      className="h-7 px-2.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border-zinc-800 bg-zinc-950 font-medium cursor-pointer disabled:cursor-not-allowed"
    >
      {isDrafting ? (
        <>
          <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-violet-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-zinc-300">Agent Thinking...</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span>Draft Follow-up</span>
        </>
      )}
    </Button>
  );
}