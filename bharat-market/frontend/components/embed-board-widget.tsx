"use client";

import Link from "next/link";
import { ArrowUpRight, Flame, Sparkles, TrendingUp } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketBoard } from "@/hooks/use-market-board";
import { formatPercent, formatUsdcCompact } from "@/lib/format";

export function EmbedBoardWidget() {
  const { markets, loading, error } = useMarketBoard({ limit: 6 });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-[24px]" />
        <Skeleton className="h-32 rounded-[24px]" />
      </div>
    );
  }

  if (error) {
    return (
      <Panel className="rounded-[24px] border border-coral/20 bg-coral/10 p-5 text-coral">
        {error}
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,24,0.98),rgba(16,18,28,0.96))] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">BharatMarket Embed</p>
            <h2 className="mt-2 font-heading text-2xl text-white">Live Board</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-2 text-xs font-semibold text-mint">
            <Flame className="h-4 w-4" />
            {markets.length} markets
          </div>
        </div>
      </Panel>

      <div className="grid gap-4">
        {markets.slice(0, 4).map((market) => (
          <Link key={market.address} href={`/markets/${market.address}`} className="block">
            <Panel className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 transition hover:border-violet-400/30 hover:bg-white/[0.05]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.26em] text-slate-500">{market.category}</p>
                  <p className="mt-2 line-clamp-2 text-lg font-semibold leading-tight text-white">
                    {market.question}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{market.oracleSource}</p>
                </div>
                <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label="YES" value={formatPercent(market.yesProbability)} />
                <Stat label="Liquidity" value={formatUsdcCompact(market.liquidity)} />
                <Stat label="Volume" value={formatUsdcCompact(market.volume)} />
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/8 bg-black/15 px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-base font-semibold text-white">{value}</p>
    </div>
  );
}
