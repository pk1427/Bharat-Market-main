"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  helper,
  tone = "slate",
  className
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "mint" | "coral" | "gold" | "cyan" | "slate";
  className?: string;
}) {
  const toneMap = {
    mint: "text-[color:var(--green)]",
    coral: "text-[color:var(--red)]",
    gold: "text-[color:var(--amber)]",
    cyan: "text-[color:var(--blue)]",
    slate: "text-[color:var(--text-primary)]"
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] p-4",
        className
      )}
    >
      <div className={cn("px-0 py-0", toneMap[tone])}>
        <p className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">{label}</p>
        <p className="mt-3 font-mono text-2xl font-semibold text-[color:var(--text-primary)]">{value}</p>
        {helper ? <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{helper}</p> : null}
      </div>
    </motion.div>
  );
}
