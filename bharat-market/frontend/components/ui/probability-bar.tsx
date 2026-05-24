"use client";

import { cn } from "@/lib/utils";

export function ProbabilityBar({
  yesPercent,
  noPercent,
  compact = false
}: {
  yesPercent: number;
  noPercent: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-full bg-white/6", compact ? "h-2" : "h-3")}>
      <div className="flex h-full w-full">
        <div
          className="h-full bg-mint transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, yesPercent))}%` }}
        />
        <div
          className="h-full bg-coral transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, noPercent))}%` }}
        />
      </div>
    </div>
  );
}
