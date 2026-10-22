import { getJobs } from "@/lib/data";
import VanguardCockpit from "./components/VanguardCockpit";
import CandidateProfileButton from "./components/CandidateProfileButton";
import VanguardIcon from "./components/VanguardIcon";
import { Settings } from "lucide-react";

// The cockpit reads the live SQLite database. Forcing dynamic rendering keeps
// container builds independent of a build-time database and avoids baking
// stale job data into the standalone bundle.
export const dynamic = "force-dynamic";

export default async function Home() {
  const jobs = await getJobs();

  return (
    <main className="h-screen bg-[#0d0e12] text-[#f4f2ec] p-3 sm:p-4 lg:p-5 font-sans overflow-hidden flex flex-col">
      <div className="w-full max-w-[1800px] mx-auto flex flex-col flex-1 min-h-0 space-y-3">
        {/* HEADER: Minimalist & Clean Tactical Command Cockpit */}
        <header className="shrink-0 flex flex-row items-center justify-between gap-2 pb-2 sm:pb-2.5 border-b border-[#2a2e38]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <VanguardIcon size={22} className="shrink-0 sm:hidden" />
              <VanguardIcon size={26} className="shrink-0 hidden sm:block" />
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[#f4f2ec] font-sans">
                Vanguard
              </h1>
              <span className="px-1.5 sm:px-2 py-0.5 rounded-[2px] text-[9px] sm:text-[10px] uppercase font-mono font-bold tracking-widest bg-[#d4a745]/15 border border-[#d4a745]/40 text-[#d4a745]">
                v1.0
              </span>
            </div>
            <p className="hidden sm:flex text-[#a6abbd] text-xs items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#8ab384] animate-pulse" />
              At the Forefront of Your Job Search
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <CandidateProfileButton className="hidden sm:inline-flex" />

            <a
              href="https://github.com/Achyuth072/Vanguard"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source code (AGPL-3.0)"
              className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] min-w-[36px] rounded-[2px] border border-[#2a2e38] bg-[#15171d] text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#1f222a] hover:border-[#3d4352] text-xs font-mono font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#d4a745]"
            >
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
                className="w-3.5 h-3.5 shrink-0"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span className="hidden sm:inline">Source</span>
            </a>

            <a
              href="/settings"
              aria-label="Settings & Feed Sources"
              className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] min-w-[36px] rounded-[2px] border border-[#2a2e38] bg-[#15171d] text-[#a6abbd] hover:text-[#f4f2ec] hover:bg-[#1f222a] hover:border-[#3d4352] text-xs font-mono font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[#d4a745]"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Settings</span>
            </a>

            <button
              type="button"
              onClick={undefined}
              aria-label="Open command palette"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#15171d] text-[#a6abbd] hover:text-[#f4f2ec] hover:border-[#3d4352] text-xs font-mono transition-colors"
            >
              <span>Command</span>
              <kbd className="px-1.5 py-0.5 rounded-[2px] bg-[#1f222a] border border-[#2a2e38] text-[10px] text-[#a6abbd]">
                ⌘K
              </kbd>
            </button>
          </div>
        </header>

        {/* Master-Detail Tactical Intelligence Cockpit */}
        <VanguardCockpit initialJobs={jobs} />
      </div>
    </main>
  );
}