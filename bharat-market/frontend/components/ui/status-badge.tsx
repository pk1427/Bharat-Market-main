"use client";

import { cn } from "@/lib/utils";

type Tone = "mint" | "coral" | "gold" | "slate";

const toneMap: Record<Tone, string> = {
  mint: "border-mint/20 bg-mint/10 text-mint",
  coral: "border-coral/20 bg-coral/10 text-coral",
  gold: "border-gold/20 bg-gold/10 text-gold",
  slate: "border-white/10 bg-white/5 text-slate-300"
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
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]",
        toneMap[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
