"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export function TickerRow({
  items,
  className
}: {
  items: string[];
  className?: string;
}) {
  return (
    <div className={cn("ticker-shell overflow-hidden rounded-full border border-white/10 bg-white/5", className)}>
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        className="flex min-w-max gap-8 px-5 py-2"
      >
        {[...items, ...items].map((item, index) => (
          <div key={`${item}-${index}`} className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_10px_rgba(95,242,191,0.8)]" />
            <span>{item}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
