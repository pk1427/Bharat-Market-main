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
        "panel-surface rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(25,24,35,0.96),rgba(16,16,24,0.96))] shadow-[0_18px_50px_rgba(0,0,0,0.32)]",
        glow && "panel-glow",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
