import { getJobs } from "@/lib/data";
import PriorityInbox from "./components/PriorityInbox";
import ExportMenu from "./components/ExportMenu";
import CandidateProfileButton from "./components/CandidateProfileButton";

export default async function Home() {
  const jobs = await getJobs();

  return (
    <main className="h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-5 lg:p-6 font-sans overflow-hidden flex flex-col">
      <div className="w-full max-w-[1800px] mx-auto flex flex-col flex-1 min-h-0 space-y-3 sm:space-y-4">
        {/* HEADER: Minimalist & Clean Command Cockpit */}
        <header className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
                Vanguard
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-mono tracking-widest bg-purple-950/60 border border-purple-800/80 text-purple-400">
                v1.0
              </span>
            </div>
            <p className="text-zinc-400 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Personal Career Scouting & Application Cockpit
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ExportMenu />
            <CandidateProfileButton />

            <button
              type="button"
              onClick={undefined}
              aria-label="Open command palette"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 text-xs font-mono transition-colors"
            >
              <span>Search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400">
                ⌘K
              </kbd>
            </button>
          </div>
        </header>

        {/* Priority Inbox & Master-Detail Pipeline Cockpit */}
        <PriorityInbox initialJobs={jobs} />
      </div>
    </main>
  );
}