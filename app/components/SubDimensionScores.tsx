"use client";

interface SubDimensionScoresProps {
  skillsFit?: number | null;
  experienceFit?: number | null;
  domainFit?: number | null;
  trajectoryFit?: number | null;
  className?: string;
}

interface DimensionConfig {
  key: string;
  label: string;
  weight: string;
  score: number;
  description: string;
}

export default function SubDimensionScores({
  skillsFit,
  experienceFit,
  domainFit,
  trajectoryFit,
  className = "",
}: SubDimensionScoresProps) {
  const dimensions: DimensionConfig[] = [
    {
      key: "skills",
      label: "Skills Fit",
      weight: "35%",
      score: skillsFit ?? 0,
      description: "Direct alignment with tech stack and role skills",
    },
    {
      key: "experience",
      label: "Experience",
      weight: "30%",
      score: experienceFit ?? 0,
      description: "Seniority level, scope, and years of experience",
    },
    {
      key: "domain",
      label: "Domain",
      weight: "20%",
      score: domainFit ?? 0,
      description: "Industry vertical, business model, and domain relevance",
    },
    {
      key: "trajectory",
      label: "Trajectory",
      weight: "15%",
      score: trajectoryFit ?? 0,
      description: "Career growth suitability and role progression",
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-neutral-400";
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-neutral-600";
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {dimensions.map((dim) => (
          <div
            key={dim.key}
            className="bg-[#141414] border border-neutral-800/80 rounded-lg p-2.5 flex flex-col justify-between group/dim hover:border-neutral-700 transition-colors"
            title={dim.description}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] mb-1.5">
              <span className="font-semibold text-neutral-300 truncate">{dim.label}</span>
              <span className="text-[9px] font-mono text-neutral-500 shrink-0">{dim.weight}</span>
            </div>

            <div className="flex items-baseline justify-between gap-1 mb-1.5">
              <span className={`text-sm font-bold font-mono ${getScoreColor(dim.score)}`}>
                {dim.score}
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">/100</span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getBarColor(dim.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
