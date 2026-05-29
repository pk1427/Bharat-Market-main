"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useAccount } from "wagmi";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMarketBoard } from "@/hooks/use-market-board";
import { formatUsdcCompact } from "@/lib/format";
import { shortenAddress } from "@/lib/format";

export function CreatorDashboard() {
  const { address } = useAccount();
  const { markets, loading, error } = useMarketBoard();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "awaiting" | "resolved">(
    "all"
  );

  const createdMarkets = useMemo(() => {
    if (!address) return [];

    return markets
      .filter((market) => market.creator?.toLowerCase() === address.toLowerCase())
      .filter((market) => (statusFilter === "all" ? true : market.status === statusFilter))
      .filter((market) =>
        query.trim().length === 0
          ? true
          : `${market.question} ${market.oracleQuery}`.toLowerCase().includes(query.toLowerCase())
      );
  }, [address, markets, query, statusFilter]);

  const metrics = useMemo(() => {
    const totalVolume = createdMarkets.reduce((sum, market) => sum + market.volume, 0n);
    const totalLiquidity = createdMarkets.reduce((sum, market) => sum + market.liquidity, 0n);
    const activeNow = createdMarkets.filter((market) => market.status === "active").length;
    const awaiting = createdMarkets.filter((market) => market.status === "awaiting").length;

    return {
      totalCreated: createdMarkets.length,
      activeNow,
      awaiting,
      totalVolume,
      totalLiquidity
    };
  }, [createdMarkets]);

  if (!address) {
    return (
      <EmptyState
        title="Connect Your Wallet"
        description="Connect the creator wallet you used on BharatMarket to manage your markets here."
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-[20px]" />
        <Skeleton className="h-[28rem] rounded-[20px]" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="space-y-5">
      <Panel className="p-6">
        <SectionHeader
          eyebrow="Global Protocol Performance"
          title="Manage Markets"
          description={`Creator wallet ${shortenAddress(address)}. Monitor the markets you launched and jump back into the execution view fast.`}
          action={
            <Link
              href="/create-market"
              className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Create New Market
            </Link>
          }
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <CreatorMetric label="Total Created" value={String(metrics.totalCreated)} />
          <CreatorMetric label="Active Now" value={String(metrics.activeNow)} accent="text-violet-300" />
          <CreatorMetric label="Awaiting" value={String(metrics.awaiting)} accent="text-gold" />
          <CreatorMetric label="Liquidity" value={formatUsdcCompact(metrics.totalLiquidity)} accent="text-white" />
          <CreatorMetric label="Volume" value={formatUsdcCompact(metrics.totalVolume)} accent="text-mint" />
        </div>
      </Panel>

      <Panel className="p-6">
        <SectionHeader
          eyebrow="Manage My Markets"
          title="Creator Board"
          description="Search and filter the contracts launched from your wallet."
        />

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by market question or oracle query..."
              className="w-full rounded-[14px] border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-violet-400/30"
            />
          </label>

          <div className="flex rounded-[14px] border border-white/10 bg-white/[0.03] p-1">
            {(["all", "active", "awaiting", "resolved"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatusFilter(item)}
                className={`rounded-[10px] px-4 py-2 text-sm transition ${
                  statusFilter === item ? "bg-white text-black" : "text-slate-400 hover:text-white"
                }`}
              >
                {item === "all" ? "All Campaigns" : item}
              </button>
            ))}
          </div>
        </div>

        {createdMarkets.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No Creator Markets Yet"
              description="Launch your first sports contract and it will appear here for monitoring and management."
              action={
                <Link
                  href="/create-market"
                  className="rounded-[12px] border border-violet-500/30 bg-violet-500/15 px-4 py-3 font-semibold text-violet-200"
                >
                  Create Market
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {createdMarkets.map((market) => (
              <Link key={market.address} href={`/markets/${market.address}`} className="block">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-400/30 hover:bg-white/[0.05]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">
                        {market.question}
                      </h3>
                      <p className="mt-2 text-xs text-slate-500">
                        {market.oracleMetadata?.externalId ?? market.oracleQuery}
                      </p>
                    </div>
                    <StatusBadge
                      label={market.statusLabel}
                      tone={
                        market.status === "active"
                          ? "mint"
                          : market.status === "awaiting"
                            ? "gold"
                            : "coral"
                      }
                    />
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <CreatorSubMetric label="Category" value={market.category} />
                    <CreatorSubMetric label="Liquidity" value={formatUsdcCompact(market.liquidity)} />
                    <CreatorSubMetric label="Volume" value={formatUsdcCompact(market.volume)} />
                  </div>

                  <div className="mt-5 rounded-[12px] border border-white/8 bg-black/10 px-4 py-3 text-sm text-slate-300">
                    Open terminal
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CreatorMetric({
  label,
  value,
  accent = "text-white"
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={`mt-4 font-mono text-[2.3rem] font-semibold tracking-[-0.04em] ${accent}`}>
        {value}
      </p>
    </div>
  );
}

function CreatorSubMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
