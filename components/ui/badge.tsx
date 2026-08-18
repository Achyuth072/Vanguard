import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-zinc-950",
  {
    variants: {
      variant: {
        default:
          "border border-zinc-700 bg-zinc-800 text-zinc-100",
        secondary:
          "border border-zinc-800 bg-zinc-900 text-zinc-400",
        destructive:
          "border border-red-800/80 bg-red-950/60 text-red-400",
        outline:
          "border border-zinc-800 text-zinc-400",
        emerald:
          "border border-emerald-800/80 bg-emerald-950/60 text-emerald-400",
        amber:
          "border border-amber-800/80 bg-amber-950/60 text-amber-400",
        violet:
          "border border-purple-800/80 bg-purple-950/60 text-purple-400",
        blue:
          "border border-blue-800/80 bg-blue-950/60 text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
