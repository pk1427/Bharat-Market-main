"use client";

import { StatusBadge } from "@/components/ui/status-badge";

export function TxStatusNotice({
  state,
  title,
  detail
}: {
  state: "pending" | "success" | "error";
  title: string;
  detail?: string;
}) {
  const tone = state === "pending" ? "gold" : state === "success" ? "mint" : "coral";
  const label = state === "pending" ? "Pending" : state === "success" ? "Confirmed" : "Failed";

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={label} tone={tone} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {detail ? <p className="mt-2 text-sm text-slate-400">{detail}</p> : null}
    </div>
  );
}
