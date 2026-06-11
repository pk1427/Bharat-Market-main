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
    <div
      className={cn("overflow-hidden rounded-full bg-[color:var(--surface-3)]", compact ? "h-2" : "h-3")}
      aria-label={`YES probability: ${yesPercent.toFixed(1)} percent. NO probability: ${noPercent.toFixed(1)} percent.`}
    >
      <div className="flex h-full w-full gap-px bg-[color:var(--surface-0)]">
        <div
          className="h-full bg-[color:var(--green)] transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(100, yesPercent))}%` }}
        />
        <div
          className="h-full bg-[color:var(--red)] transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(100, noPercent))}%` }}
        />
      </div>
    </div>
  );
}
