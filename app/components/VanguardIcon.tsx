import React from "react";

interface VanguardIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  variant?: "mark" | "badge" | "reticle";
}

/**
 * Vanguard Tactical Intelligence Cockpit Icon
 * Implements the Ink & Brass (#0D0E12 / #D4A745) precision reticle + chevron design system.
 * Spec: .scratch/vanguard-ui/spec.md
 */
export function VanguardIcon({
  size = 24,
  className = "",
  variant = "mark",
  ...props
}: VanguardIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Background Container for Badge variant */}
      {variant === "badge" && (
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="3"
          fill="#15171D"
          stroke="#2A2E38"
          strokeWidth="1"
        />
      )}

      {/* Outer Tactical Reticle Ring */}
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="#2A2E38"
        strokeWidth="1"
        strokeDasharray="2 2"
      />

      {/* Inner Precision Arc */}
      <circle
        cx="16"
        cy="16"
        r="9.5"
        stroke="#3D4352"
        strokeWidth="1"
      />

      {/* 4-Axis Cardinal Reticle Ticks */}
      <line x1="16" y1="2" x2="16" y2="5.5" stroke="#D4A745" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="16" y1="26.5" x2="16" y2="30" stroke="#D4A745" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="2" y1="16" x2="5.5" y2="16" stroke="#D4A745" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="26.5" y1="16" x2="30" y2="16" stroke="#D4A745" strokeWidth="1.5" strokeLinecap="square" />

      {/* 45-degree Precision Minor Ticks */}
      <line x1="6.8" y1="6.8" x2="8.2" y2="8.2" stroke="#A6ABBD" strokeWidth="1" />
      <line x1="25.2" y1="6.8" x2="23.8" y2="8.2" stroke="#A6ABBD" strokeWidth="1" />
      <line x1="6.8" y1="25.2" x2="8.2" y2="23.8" stroke="#A6ABBD" strokeWidth="1" />
      <line x1="25.2" y1="25.2" x2="23.8" y2="23.8" stroke="#A6ABBD" strokeWidth="1" />

      {/* Forward Tactical Vanguard Chevron (Brass #D4A745) */}
      <path
        d="M9.5 20.5L16 11.5L22.5 20.5H18.5L16 16.5L13.5 20.5H9.5Z"
        fill="#D4A745"
      />

      {/* Inner Target Center Crosshair Point */}
      <circle cx="16" cy="16" r="1.5" fill="#F4F2EC" />
    </svg>
  );
}

export default VanguardIcon;
