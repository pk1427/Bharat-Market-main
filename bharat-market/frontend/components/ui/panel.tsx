"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  glow = false,
  hover = false
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  hover?: boolean;
}) {
  return (
    <motion.div
      whileHover={hover ? { y: -4, scale: 1.003 } : undefined}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "panel-surface rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)]",
        glow && "panel-glow",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
