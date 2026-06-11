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
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--blue)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--blue)]" />
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold text-[color:var(--text-primary)] sm:text-[2rem]">
          {title}
        </h2>
        {description ? <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-3">{action}</div> : null}
    </div>
  );
}
