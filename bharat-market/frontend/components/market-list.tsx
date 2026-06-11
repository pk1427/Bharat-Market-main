"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { MarketCard } from "@/components/market-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketBoard } from "@/hooks/use-market-board";
import type { MarketStatus, MarketSummary } from "@/lib/market-data";

export function MarketList({
  externalRefreshTick = 0,
  board: initialBoard
}: {
  externalRefreshTick?: number;
  board?: ReturnType<typeof useMarketBoard>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MarketStatus>("all");
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const pageSize = 12;

  useEffect(() => {
    setPage(0);
  }, [deferredQuery, statusFilter]);

  const boardQuery = useMarketBoard({
    externalRefreshTick,
    search: deferredQuery,
    status: statusFilter,
    limit: pageSize,
    offset: page * pageSize
  });
  const board =
    !deferredQuery && statusFilter === "all" && page === 0 && initialBoard ? initialBoard : boardQuery;
  const markets = board.markets;
  const loading = board.loading;
  const error = board.error;
  const warning = board.warning;
  const total = board.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageSummary = useMemo(() => {
    if (total === 0) {
      return "0 results";
    }

    const start = page * pageSize + 1;
    const end = Math.min(total, start + markets.length - 1);
    return `${start}-${end} of ${total}`;
  }, [markets.length, page, total]);

  if (loading) {
    return (
      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[20rem] rounded-[20px]" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (total === 0) {
    return (
      <EmptyState
        title={deferredQuery || statusFilter !== "all" ? "No Matching Markets" : "No Markets Yet"}
        description={
          deferredQuery || statusFilter !== "all"
            ? "Try a different search or switch board views to surface more contracts."
            : "Create your first market and it will appear here with live pricing, liquidity, and resolution status."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {warning ? (
        <div className="rounded-[16px] border border-gold/20 bg-gold/10 p-4 text-sm text-gold">
          RPC is unstable, so this board is showing cached backend data.
        </div>
      ) : null}

      <div className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] p-4">
        <div className="flex flex-col gap-4 border-b border-[color:var(--border-subtle)] pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">Protocol Board</p>
            <h3 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">Markets</h3>
          </div>
          <p className="font-mono text-xs text-[color:var(--text-tertiary)]">
            {total} contracts indexed • {statusFilter === "all" ? "all states" : statusFilter}
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by market question, category, or oracle query..."
            className="w-full rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] py-3 pl-11 pr-4 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-border)] focus:ring-2 focus:ring-[color:var(--accent-dim)]"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <BoardFilter
            active={statusFilter === "all"}
            label={`All (${total})`}
            onClick={() => setStatusFilter("all")}
          />
          <BoardFilter
            active={statusFilter === "active"}
            label="Live"
            onClick={() => setStatusFilter("active")}
          />
          <BoardFilter
            active={statusFilter === "awaiting"}
            label="Awaiting"
            onClick={() => setStatusFilter("awaiting")}
          />
          <BoardFilter
            active={statusFilter === "resolved"}
            label="Resolved"
            onClick={() => setStatusFilter("resolved")}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {markets.map((market) => (
          <MarketCard key={market.address} market={market} />
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-[color:var(--text-secondary)]">Showing {pageSummary}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 text-xs uppercase tracking-[0.22em] text-slate-500">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={page >= totalPages - 1 || !board.meta?.hasMore}
            className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export type MarketListHandle = {
  refresh: () => void;
};

function BoardFilter({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border px-4 py-3 text-sm transition ${
        active
          ? "border-violet-500/30 bg-violet-500/12 text-violet-200"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
