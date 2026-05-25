"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { MarketCard } from "@/components/market-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketBoard } from "@/hooks/use-market-board";
import type { MarketStatus, MarketSummary } from "@/lib/market-data";

export function MarketList({
  externalRefreshTick = 0,
  markets: providedMarkets,
  loading: providedLoading,
  error: providedError,
  warning: providedWarning
}: {
  externalRefreshTick?: number;
  markets?: MarketSummary[];
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
}) {
  const board = useMarketBoard({
    externalRefreshTick,
    enabled: providedMarkets === undefined
  });
  const markets = providedMarkets ?? board.markets;
  const loading = providedLoading ?? board.loading;
  const error = providedError ?? board.error;
  const warning = providedWarning ?? board.warning;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MarketStatus>("all");

  const filteredMarkets = useMemo(() => {
    const statusRank: Record<MarketStatus, number> = {
      active: 0,
      awaiting: 1,
      resolved: 2
    };

    return [...markets]
      .filter((market) => (statusFilter === "all" ? true : market.status === statusFilter))
      .filter((market) =>
        query.trim().length === 0
          ? true
          : `${market.question} ${market.category} ${market.oracleQuery}`
              .toLowerCase()
              .includes(query.toLowerCase())
      )
      .sort((left, right) => {
        const byStatus = statusRank[left.status] - statusRank[right.status];
        if (byStatus !== 0) return byStatus;
        const byVolume = Number(right.volume - left.volume);
        if (byVolume !== 0) return byVolume;
        return Number(right.liquidity - left.liquidity);
      });
  }, [markets, query, statusFilter]);

  const counts = useMemo(
    () => ({
      active: markets.filter((market) => market.status === "active").length,
      awaiting: markets.filter((market) => market.status === "awaiting").length,
      resolved: markets.filter((market) => market.status === "resolved").length
    }),
    [markets]
  );

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

  if (markets.length === 0) {
    return (
      <EmptyState
        title="No Markets Yet"
        description="Create your first market and it will appear here with live pricing, liquidity, and resolution status."
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

      <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(16,18,29,0.92),rgba(11,13,22,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by market question, category, or oracle query..."
            className="w-full rounded-[16px] border border-white/8 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/30"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <BoardFilter
            active={statusFilter === "all"}
            label={`All (${markets.length})`}
            onClick={() => setStatusFilter("all")}
          />
          <BoardFilter
            active={statusFilter === "active"}
            label={`Live (${counts.active})`}
            onClick={() => setStatusFilter("active")}
          />
          <BoardFilter
            active={statusFilter === "awaiting"}
            label={`Awaiting (${counts.awaiting})`}
            onClick={() => setStatusFilter("awaiting")}
          />
          <BoardFilter
            active={statusFilter === "resolved"}
            label={`Resolved (${counts.resolved})`}
            onClick={() => setStatusFilter("resolved")}
          />
        </div>
      </div>
      </div>

      {filteredMarkets.length === 0 ? (
        <EmptyState
          title="No Matching Markets"
          description="Try a different search or switch board views to surface more contracts."
        />
      ) : (
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {filteredMarkets.map((market) => (
          <MarketCard key={market.address} market={market} />
        ))}
      </div>
      )}
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
