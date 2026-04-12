"use client";

import Link from "next/link";

import type { MarketSummary } from "@/lib/market-data";
import { formatPercent, formatUsdcCompact } from "@/lib/format";

const statusStyles: Record<MarketSummary["status"], string> = {
  active: "border-mint/20 bg-mint/10 text-mint",
  awaiting: "border-gold/20 bg-gold/10 text-gold",
  resolved: "border-coral/20 bg-coral/10 text-coral"
};

export function MarketCard({ market }: { market: MarketSummary }) {
  return (
    <Link
      href={`/markets/${market.address}`}
      className="glass group block rounded-[28px] p-5 transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-slate-900/80"
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${statusStyles[market.status]}`}
        >
          {market.statusLabel}
        </span>
        <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
          {market.endTimeLabel}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <h3 className="font-heading min-h-[72px] text-3xl uppercase leading-tight text-white">
          {market.question}
        </h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-mint/15 bg-mint/10 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-mint">Yes Odds</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatPercent(market.yesProbability)}
            </p>
          </div>
          <div className="rounded-2xl border border-coral/15 bg-coral/10 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-coral">No Odds</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatPercent(market.noProbability)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Liquidity {formatUsdcCompact(market.liquidity)}</span>
          <span className="transition group-hover:text-white">Open market →</span>
        </div>
      </div>
    </Link>
  );
}
