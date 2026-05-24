"use client";

import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-violet-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-heading text-[2.5rem] tracking-[-0.04em] text-white sm:text-[3.35rem]">{title}</h2>
        {description ? <p className="max-w-2xl text-[14px] leading-6 text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-3">{action}</div> : null}
    </div>
  );
}
