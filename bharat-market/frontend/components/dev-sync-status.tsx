"use client";

import { Database, TimerReset } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { useIndexerStatus } from "@/hooks/use-indexer-status";
import { formatRelativeTime } from "@/lib/format";

export function DevSyncStatus() {
  const enabled = process.env.NODE_ENV !== "production";
  const query = useIndexerStatus(enabled);

  if (!enabled || query.isLoading || query.error || !query.data) {
    return null;
  }

  const latestCursor = query.data.cursors[0] ?? null;

  return (
    <Panel className="rounded-[22px] px-5 py-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-slate-500">
        <Database className="h-3.5 w-3.5 text-cyan-300" />
        Indexed Backend
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
        <div>
          <p className="text-slate-500">Markets</p>
          <p className="mt-1 font-mono text-white">{query.data.counts.markets}</p>
        </div>
        <div>
          <p className="text-slate-500">Snapshots</p>
          <p className="mt-1 font-mono text-white">{query.data.counts.snapshots}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">Indexer status</span>
        <span className={query.data.freshness.fresh ? "text-mint" : "text-gold"}>
          {query.data.freshness.fresh ? "Fresh" : "Stale"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <TimerReset className="h-3.5 w-3.5" />
        {latestCursor
          ? `Last cursor update ${formatRelativeTime(Date.parse(latestCursor.updatedAt))}`
          : "Waiting for cursor data"}
      </div>
    </Panel>
  );
}
