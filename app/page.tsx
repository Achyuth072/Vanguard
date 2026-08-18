import { getJobs } from "@/lib/data";
import Link from "next/link";
import PriorityInbox from "./components/PriorityInbox";
import ExportMenu from "./components/ExportMenu";
import CandidateProfileButton from "./components/CandidateProfileButton";

export default async function Home() {
  const jobs = await getJobs();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER: Minimalist & Clean Command Cockpit */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">Career Operations</h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-mono tracking-widest bg-purple-950/60 border border-purple-800/80 text-purple-400">
                Pulse v1.0
              </span>
            </div>
            <p className="text-zinc-400 text-xs sm:text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Autonomous Job Evaluation & Application Tracking
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <ExportMenu />
            <CandidateProfileButton />

            <Link 
              href="/create-job"
              className="group flex items-center gap-2 px-3.5 py-2 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 hover:bg-zinc-800 transition-all text-xs font-semibold"
            >
              <span>Manual Entry</span>
            </Link>

            <button
              type="button"
              onClick={undefined}
              aria-label="Open command palette"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 text-xs font-mono transition-colors"
            >
              <span>Search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-400">⌘K</kbd>
            </button>
          </div>
        </div>

        {/* Priority Inbox & Pipeline Tracker */}
        <PriorityInbox initialJobs={jobs} />
      </div>
    </main>
  );
}