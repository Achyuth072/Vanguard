"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportMenuItem {
  id: string;
  title: string;
  ext: string;
  description: string;
  href: string;
  badgeColor: string;
}

const EXPORT_ITEMS: ExportMenuItem[] = [
  {
    id: "json",
    title: "Full JSON Snapshot",
    ext: ".JSON",
    description: "Complete offline database dump",
    href: "/api/export?format=json",
    badgeColor: "#d4a745",
  },
  {
    id: "applications",
    title: "Applications CSV",
    ext: ".CSV",
    description: "Tracked pipeline & submissions",
    href: "/api/export?format=applications",
    badgeColor: "#8ab384",
  },
  {
    id: "jobs",
    title: "All Jobs CSV",
    ext: ".CSV",
    description: "Discovered jobs & fit scores",
    href: "/api/export?format=jobs",
    badgeColor: "#8ab384",
  },
];

interface ExportMenuProps {
  className?: string;
}

export default function ExportMenu({ className }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const closeMenu = useCallback((restoreFocus: boolean = true) => {
    setIsOpen(false);
    if (restoreFocus && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, []);

  // Handle outside click dismissal
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const openAndFocus = (index: number) => {
    setIsOpen(true);
    setTimeout(() => {
      itemRefs.current[index]?.focus();
    }, 0);
  };

  // Handle keyboard navigation on trigger button
  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAndFocus(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAndFocus(EXPORT_ITEMS.length - 1);
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      closeMenu(true);
    }
  }

  // Handle keyboard navigation inside menu items
  function handleItemKeyDown(
    e: React.KeyboardEvent<HTMLAnchorElement>,
    index: number
  ) {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeMenu(true);
        break;
      case "ArrowDown":
        e.preventDefault();
        itemRefs.current[(index + 1) % EXPORT_ITEMS.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        itemRefs.current[(index - 1 + EXPORT_ITEMS.length) % EXPORT_ITEMS.length]?.focus();
        break;
      case "Home":
        e.preventDefault();
        itemRefs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        itemRefs.current[EXPORT_ITEMS.length - 1]?.focus();
        break;
      case "Tab":
        closeMenu(false);
        break;
    }
  }

  return (
    <div className={cn("relative inline-block text-left", className)} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        id="export-menu-trigger"
        data-testid="export-menu-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={isOpen ? "export-menu-dropdown" : undefined}
        aria-label="Export datastore"
        className="group inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 min-h-[36px] rounded-[2px] border border-[#2a2e38] bg-[#15171d] hover:bg-[#1f222a] hover:border-[#3d4352] text-xs font-mono font-semibold text-[#f4f2ec] transition-colors focus-visible:outline-2 focus-visible:outline-[#d4a745] focus-visible:outline-offset-2 cursor-pointer select-none"
      >
        <Download className="w-3.5 h-3.5 text-[#d4a745] transition-colors shrink-0" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-[#c5c9d6] transition-transform duration-150 ease-out shrink-0 hidden sm:inline-block",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          id="export-menu-dropdown"
          role="menu"
          aria-labelledby="export-menu-trigger"
          aria-orientation="vertical"
          data-testid="export-menu-dropdown"
          className="absolute right-0 mt-1.5 w-72 z-50 rounded-[3px] border border-[#2a2e38] bg-[#15171d] shadow-none p-1.5 space-y-1 animate-in fade-in-0 duration-150"
        >
          <div className="px-3 py-2 text-xs uppercase font-mono font-bold tracking-wider text-[#c5c9d6] border-b border-[#2a2e38] flex items-center justify-between">
            <span>Export Datastore</span>
            <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[#c5c9d6]">
              SQLITE
            </span>
          </div>

          <div className="space-y-1 pt-0.5" role="none">
            {EXPORT_ITEMS.map((item, index) => (
              <a
                key={item.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                href={item.href}
                download
                role="menuitem"
                tabIndex={0}
                data-testid={`export-item-${item.id}`}
                onClick={() => closeMenu(false)}
                onKeyDown={(e) => handleItemKeyDown(e, index)}
                className="group flex flex-col gap-1 px-3 py-2 rounded-[2px] border border-transparent hover:border-[#3d4352] bg-[#15171d] hover:bg-[#1f222a] focus:bg-[#1f222a] focus:border-[#3d4352] transition-colors focus-visible:outline-2 focus-visible:outline-[#d4a745] focus-visible:outline-offset-2 cursor-pointer outline-none"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-[2px] shrink-0"
                      style={{ backgroundColor: item.badgeColor }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-mono font-semibold text-[#f4f2ec] group-hover:text-white">
                      {item.title}
                    </span>
                  </div>
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: item.badgeColor }}
                  >
                    {item.ext}
                  </span>
                </div>
                <p className="text-xs font-mono text-[#c5c9d6] leading-relaxed">
                  {item.description}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
