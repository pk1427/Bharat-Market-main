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
    mint: "from-mint/10 to-transparent text-mint",
    coral: "from-coral/10 to-transparent text-coral",
    gold: "from-gold/10 to-transparent text-gold",
    cyan: "from-violet-400/10 to-transparent text-violet-300",
    slate: "from-white/6 to-transparent text-white"
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "rounded-[16px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
        className
      )}
    >
      <div className={cn("rounded-2xl bg-gradient-to-r px-0 py-0", toneMap[tone])}>
        <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
        <p className="mt-4 font-mono text-[2.1rem] font-semibold tracking-[-0.03em] text-white">{value}</p>
        {helper ? <p className="mt-2 text-[13px] text-slate-400">{helper}</p> : null}
      </div>
    </motion.div>
  );
}
