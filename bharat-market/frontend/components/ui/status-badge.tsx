"use client";

import { cn } from "@/lib/utils";

type Tone = "mint" | "coral" | "gold" | "slate";

const toneMap: Record<Tone, string> = {
  mint: "border-[color:rgba(34,217,138,0.24)] bg-[color:var(--green-dim)] text-[color:var(--green)]",
  coral: "border-[color:rgba(245,65,90,0.24)] bg-[color:var(--red-dim)] text-[color:var(--red)]",
  gold: "border-[color:rgba(245,158,11,0.24)] bg-[color:var(--amber-dim)] text-[color:var(--amber)]",
  slate: "border-[color:var(--border-default)] bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]"
};

export function StatusBadge({
  label,
  tone = "slate",
  className
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.06em]",
        toneMap[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
