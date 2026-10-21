import { getJobs } from "@/lib/data";
import VanguardCockpit from "./components/VanguardCockpit";
import ExportMenu from "./components/ExportMenu";
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
            <ExportMenu />
            <CandidateProfileButton className="hidden sm:inline-flex" />

            <a
              href="/settings"
              aria-label="Settings & Feed Sources"
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-[2px] border border-[#2a2e38] bg-[#15171d] text-[#a6abbd] hover:text-[#f4f2ec] hover:border-[#3d4352] text-xs font-mono transition-colors"
            >
              <Settings className="w-3.5 h-3.5 sm:hidden" />
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