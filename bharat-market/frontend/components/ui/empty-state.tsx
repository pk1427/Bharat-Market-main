"use client";

import { Sparkles } from "lucide-react";

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--r-lg)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] text-[color:var(--text-tertiary)]">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-[color:var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
