"use client";

import Link from "next/link";
import { ArrowUpRight, Clock3, Waves } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketDetail } from "@/hooks/use-market-detail";
import { formatPercent, formatTimestamp, formatUsdc } from "@/lib/format";

export function EmbedMarketWidget({ address }: { address: string }) {
  const detail = useMarketDetail(address);

  if (detail.loading) {
    return <Skeleton className="h-[320px] rounded-[28px]" />;
  }

  if (detail.error || !detail.market) {
    return (
      <Panel className="rounded-[28px] border border-coral/20 bg-coral/10 p-5 text-coral">
        {detail.error ?? "Market not found."}
      </Panel>
    );
  }

  const market = detail.market;

  return (
    <Panel className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,24,0.98),rgba(16,18,28,0.96))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Market Widget</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight text-white">{market.question}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {market.category} • {market.oracleSource}
          </p>
        </div>
        <Link
          href={`/markets/${market.address}`}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
        >
          Open
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <CardStat label="YES" value={formatPercent(market.yesProbability)} helper="probability" />
        <CardStat label="Liquidity" value={formatUsdc(market.liquidity)} helper="pool depth" />
        <CardStat label="Expiry" value={formatTimestamp(market.endTime)} helper="market close" />
      </div>

      <div className="mt-5 grid gap-3 rounded-[20px] border border-white/8 bg-black/15 p-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <Waves className="h-4 w-4 text-mint" />
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">Status</p>
            <p className="mt-1 text-sm font-semibold text-white">{market.statusLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock3 className="h-4 w-4 text-gold" />
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">Volume</p>
            <p className="mt-1 text-sm font-semibold text-white">{formatUsdc(market.volume)}</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function CardStat({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
