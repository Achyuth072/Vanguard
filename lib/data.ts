import { db } from "@/lib/db";

export async function getJobs() {
  const jobs = await db.job.findMany({
    include: {
      fitScore: true,
      application: true,
    },
    orderBy: {
      discoveredAt: "desc",
    },
  });

  return jobs.map((job) => ({
    id: job.id,
    companyName: job.company,
    role: job.title,
    status: job.status,
    dateApplied: job.application?.appliedAt || job.discoveredAt,
    aiAnalysis: job.fitScore?.reasoning || (job.description ? job.description.slice(0, 150) : null),
  }));
}

export async function addJob(job: {
  companyName: string;
  role: string;
  status?: string;
  aiAnalysis?: string;
}) {
  const dedupeKey = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return await db.job.create({
    data: {
      dedupeKey,
      company: job.companyName,
      title: job.role,
      status: job.status || "DISCOVERED",
      description: job.aiAnalysis || "Manual entry",
    },
  });
}

