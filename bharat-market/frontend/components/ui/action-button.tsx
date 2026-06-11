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
    mint: "border-[color:rgba(34,217,138,0.35)] bg-[color:var(--green)] text-black hover:brightness-110",
    coral: "border-[color:rgba(245,65,90,0.35)] bg-[color:var(--red)] text-white hover:brightness-110",
    gold: "border-[color:var(--accent-border)] bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)]",
    slate: "border-[color:var(--border-default)] bg-[color:var(--surface-2)] text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)]"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "rounded-[var(--r-md)] border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-[color:var(--surface-0)] disabled:cursor-not-allowed disabled:opacity-40",
        toneMap[tone],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
