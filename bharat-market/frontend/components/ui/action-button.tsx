"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export function ActionButton({
  children,
  className,
  tone = "slate",
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<"button">,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragEnd" | "onDragStart"
> & {
  tone?: "mint" | "coral" | "gold" | "slate";
}) {
  const toneMap = {
    mint: "border-mint/25 bg-[linear-gradient(135deg,rgba(52,211,153,0.16),rgba(52,211,153,0.05))] text-mint hover:border-mint/40",
    coral: "border-coral/25 bg-[linear-gradient(135deg,rgba(248,113,113,0.16),rgba(248,113,113,0.05))] text-coral hover:border-coral/40",
    gold: "border-violet-500/35 bg-[linear-gradient(135deg,rgba(124,58,237,0.95),rgba(168,85,247,0.9))] text-white hover:border-violet-300/40",
    slate: "border-white/10 bg-white/5 text-slate-200 hover:border-white/20"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "rounded-[12px] border px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        toneMap[tone],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
