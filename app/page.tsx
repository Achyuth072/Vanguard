import { getJobs } from "@/lib/data";
import Link from "next/link";
import PriorityInbox from "./components/PriorityInbox";

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
            <Link 
              href="/settings"
              className="group flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-800 bg-[#0D0D0D] text-neutral-400 hover:text-white hover:border-neutral-700 transition-all text-xs font-semibold"
            >
              <svg className="w-4 h-4 text-neutral-500 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <span>Candidate Profile</span>
            </Link>

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