"use client";

import { cn } from "@/lib/utils";

type Tone = "mint" | "coral" | "gold" | "slate";

const toneMap: Record<Tone, string> = {
  mint: "border-mint/16 bg-mint/10 text-mint shadow-[0_0_16px_rgba(95,242,191,0.08)]",
  coral: "border-coral/16 bg-coral/10 text-coral shadow-[0_0_16px_rgba(255,125,99,0.08)]",
  gold: "border-gold/16 bg-gold/10 text-gold shadow-[0_0_16px_rgba(245,201,107,0.08)]",
  slate: "border-white/8 bg-white/[0.045] text-slate-300"
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
        "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
        toneMap[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
