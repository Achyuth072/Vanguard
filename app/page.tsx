import { getJobs } from "@/lib/data";
import Link from "next/link";
import PriorityInbox from "./components/PriorityInbox";
import ExportMenu from "./components/ExportMenu";
import CandidateProfileButton from "./components/CandidateProfileButton";

export default async function Home() {
  const jobs = await getJobs();

  return (
    <main className="min-h-screen bg-black text-white p-6 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER: Minimalist & Clean */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-900">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Career Operations</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-widest bg-purple-950/60 border border-purple-800 text-purple-400">
                Pulse v1.0
              </span>
            </div>
            <p className="text-neutral-500 text-xs sm:text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Autonomous Job Evaluation & Application Tracking
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <ExportMenu />
            <CandidateProfileButton />

            <Link 
              href="/create-job"
              className="group flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-800 bg-[#0D0D0D] text-neutral-400 hover:text-white hover:border-neutral-700 transition-all text-xs font-semibold"
            >
              <span>Manual Entry</span>
            </Link>
          </div>
        </div>

        {/* Priority Inbox & Pipeline Tracker */}
        <PriorityInbox initialJobs={jobs} />
      </div>
    </main>
  );
}