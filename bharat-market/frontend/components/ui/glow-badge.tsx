"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export function GlowBadge({
  label,
  tone = "mint",
  pulse = false,
  className
}: {
  label: string;
  tone?: "mint" | "coral" | "gold" | "slate";
  pulse?: boolean;
  className?: string;
}) {
  const toneMap = {
    mint: "border-mint/25 bg-mint/12 text-mint",
    coral: "border-coral/25 bg-coral/12 text-coral",
    gold: "border-gold/25 bg-gold/12 text-gold",
    slate: "border-white/10 bg-white/6 text-slate-200"
  };

  return (
    <motion.span
      animate={pulse ? { boxShadow: ["0 0 0 rgba(95,242,191,0.15)", "0 0 18px rgba(95,242,191,0.35)", "0 0 0 rgba(95,242,191,0.15)"] } : undefined}
      transition={pulse ? { repeat: Infinity, duration: 2.6, ease: "easeInOut" } : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em]",
        toneMap[tone],
        className
      )}
    >
      {pulse ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {label}
    </motion.span>
  );
}
