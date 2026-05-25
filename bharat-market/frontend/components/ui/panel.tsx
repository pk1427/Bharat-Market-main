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
        "panel-surface rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(24,23,34,0.94),rgba(13,14,22,0.97))] shadow-[0_22px_55px_rgba(0,0,0,0.34)]",
        glow && "panel-glow",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
