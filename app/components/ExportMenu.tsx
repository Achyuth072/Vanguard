"use client";

import { useState, useRef, useEffect } from "react";

export default function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="group flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-800 bg-[#0D0D0D] text-neutral-400 hover:text-white hover:border-neutral-700 transition-all text-xs font-semibold"
      >
        <svg
          className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        <span>Export</span>
        <svg
          className={`w-3 h-3 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#0F0F0F] border border-neutral-800 shadow-2xl z-50 p-1.5 space-y-1">
          <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-widest text-neutral-500 border-b border-neutral-900">
            Export Datastore
          </div>

          <a
            href="/api/export?format=json"
            download
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover:scale-125 transition-transform"></span>
            <div>
              <div className="font-semibold text-white">Full JSON Snapshot</div>
              <div className="text-[10px] text-neutral-500">Complete offline database dump</div>
            </div>
          </a>

          <a
            href="/api/export?format=applications"
            download
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:scale-125 transition-transform"></span>
            <div>
              <div className="font-semibold text-white">Applications CSV</div>
              <div className="text-[10px] text-neutral-500">Tracked pipeline & submissions</div>
            </div>
          </a>

          <a
            href="/api/export?format=jobs"
            download
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform"></span>
            <div>
              <div className="font-semibold text-white">All Jobs CSV</div>
              <div className="text-[10px] text-neutral-500">Discovered jobs & fit scores</div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
