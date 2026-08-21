"use client";

import React from "react";

export interface ReticleGaugeProps {
  score: number;
  label?: string;
  weight?: string;
  size?: "sm" | "md" | "lg";
  accentColor?: "brass" | "sage" | "rust" | "auto";
  showTicks?: boolean;
  className?: string;
}

export function ReticleGauge({
  score,
  label,
  weight,
  size = "md",
  accentColor = "auto",
  showTicks = true,
  className = "",
}: ReticleGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)));

  // Resolve accent color with WCAG AAA tokens
  let strokeColor = "#d4a745"; // brass
  if (accentColor === "sage") {
    strokeColor = "#8ab384";
  } else if (accentColor === "rust") {
    strokeColor = "#c4634e";
  } else if (accentColor === "brass") {
    strokeColor = "#d4a745";
  } else {
    if (clampedScore >= 80) {
      strokeColor = "#d4a745"; // brass for top-tier
    } else if (clampedScore >= 60) {
      strokeColor = "#8ab384"; // sage for evaluation/review
    } else {
      strokeColor = "#a6abbd"; // paper-muted for low
    }
  }

  const isLockedOn = clampedScore >= 90;

  // Sizing configurations with accessible text sizes
  const dimensions = {
    sm: {
      box: 48,
      radius: 18,
      stroke: 2.5,
      textSize: "text-sm font-bold",
      labelSize: "text-xs font-semibold",
    },
    md: {
      box: 92,
      radius: 34,
      stroke: 3,
      textSize: "text-xl font-bold",
      labelSize: "text-xs font-semibold",
    },
    lg: {
      box: 128,
      radius: 48,
      stroke: 3.5,
      textSize: "text-3xl font-bold",
      labelSize: "text-sm font-semibold",
    },
  }[size];

  const center = dimensions.box / 2;
  const radius = dimensions.radius;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  // Generate 12 radial ticks at 30° intervals around circle perimeter
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const innerR = radius + (size === "sm" ? 3 : 5);
    const outerR = radius + (size === "sm" ? 5 : 9);
    const isMajor = i % 3 === 0;
    return {
      x1: center + innerR * Math.cos(angle),
      y1: center + innerR * Math.sin(angle),
      x2: center + (outerR + (isMajor ? 2 : 0)) * Math.cos(angle),
      y2: center + (outerR + (isMajor ? 2 : 0)) * Math.sin(angle),
      isMajor,
    };
  });

  const accessibleLabel = label
    ? `${label}: ${clampedScore} of 100${weight ? ` (Weight ${weight})` : ""}`
    : `Score: ${clampedScore} of 100`;

  return (
    <div
      role="meter"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={accessibleLabel}
      className={`flex flex-col items-center select-none ${className}`}
    >
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={dimensions.box}
          height={dimensions.box}
          viewBox={`0 0 ${dimensions.box} ${dimensions.box}`}
          className="transform -rotate-90 overflow-visible"
          aria-hidden="true"
        >
          {/* Tick marks */}
          {showTicks &&
            ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.isMajor ? "#4a5163" : "#2a2e38"}
                strokeWidth={t.isMajor ? 1.5 : 1}
              />
            ))}

          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1f222a"
            strokeWidth={dimensions.stroke}
          />

          {/* Active arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={dimensions.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
            className="transition-all duration-500 ease-out"
          />

          {/* Locked-on crosshair indicators for scores >= 90 */}
          {isLockedOn && size !== "sm" && (
            <g opacity="0.8">
              <line
                x1={center}
                y1={center - radius + 2}
                x2={center}
                y2={center - radius - 5}
                stroke={strokeColor}
                strokeWidth="2"
              />
              <line
                x1={center + radius - 2}
                y1={center}
                x2={center + radius + 5}
                y2={center}
                stroke={strokeColor}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Center reading */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={`font-mono tracking-tight text-[#f4f2ec] ${dimensions.textSize} tabular-nums leading-none`}
          >
            {clampedScore}
          </span>
          {size === "lg" && (
            <span className="text-xs font-mono text-[#a6abbd] tracking-wider uppercase mt-1">
              /100
            </span>
          )}
        </div>
      </div>

      {/* Label and weight below */}
      {label && (
        <div className="mt-2.5 text-center">
          <div
            className={`font-sans font-semibold tracking-wide uppercase text-[#f4f2ec] ${dimensions.labelSize}`}
          >
            {label}
          </div>
          {weight && (
            <div className="text-xs font-mono text-[#a6abbd] tabular-nums mt-0.5">
              Weight {weight}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReticleGauge;
