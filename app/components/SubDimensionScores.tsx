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
    if (score >= 80) return "text-[#d4a745]";
    if (score >= 60) return "text-[#8ab384]";
    return "text-[#a6abbd]";
  };

  const getBarColor = (score: number) => {
    if (score >= 80) return "bg-[#d4a745]";
    if (score >= 60) return "bg-[#8ab384]";
    return "bg-[#3d4352]";
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {dimensions.map((dim) => (
          <div
            key={dim.key}
            className="bg-[#15171d] border border-[#2a2e38] rounded-[3px] p-2.5 flex flex-col justify-between hover:border-[#3d4352] transition-colors"
            title={dim.description}
          >
            <div className="flex items-center justify-between gap-1 text-xs mb-1">
              <span className="font-semibold text-[#f4f2ec] truncate">{dim.label}</span>
              <span className="text-[10px] font-mono tabular-nums text-[#a6abbd] shrink-0">{dim.weight}</span>
            </div>

            <div className="flex items-baseline justify-between gap-1 mb-1.5">
              <span className={`text-base font-bold font-mono tabular-nums ${getScoreColor(dim.score)}`}>
                {dim.score}
              </span>
              <span className="text-[10px] text-[#a6abbd] font-mono tabular-nums">/100</span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-[#0d0e12] rounded-[1px] h-1.5 overflow-hidden border border-[#2a2e38]">
              <div
                className={`h-full rounded-[1px] transition-all duration-300 ${getBarColor(dim.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
