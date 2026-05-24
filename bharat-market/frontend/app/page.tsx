"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowUpRight, Flame, Sparkles } from "lucide-react";

import { MarketList } from "@/components/market-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TickerRow } from "@/components/ui/ticker-row";
import { useMarketBoard } from "@/hooks/use-market-board";
import { formatPercent, formatUsdcCompact } from "@/lib/format";

export default function HomePage() {
  const [marketRefreshTick] = useState(0);
  const { markets, loading, error, warning, refresh } = useMarketBoard({
    externalRefreshTick: marketRefreshTick
  });

  const boardMetrics = useMemo(() => {
    const activeMarkets = markets.filter((market) => market.status === "active");
    const awaitingMarkets = markets.filter((market) => market.status === "awaiting");
    const resolvedMarkets = markets.filter((market) => market.status === "resolved");
    const totalVolume = markets.reduce((sum, market) => sum + market.volume, 0n);
    const totalLiquidity = markets.reduce((sum, market) => sum + market.liquidity, 0n);
    const liveTraders = markets.reduce((sum, market) => sum + market.traderCount, 0);
    const featured = [...markets]
      .sort((left, right) => Number(right.volume - left.volume))
      .slice(0, 3);

    return {
      activeMarkets,
      awaitingMarkets,
      resolvedMarkets,
      totalVolume,
      totalLiquidity,
      liveTraders,
      featured
    };
  }, [markets]);

  const tickerItems = useMemo(
    () =>
      [...new Map(
        markets.map((market) => [
          market.address,
          `${market.category} • ${market.question.slice(0, 30)}${market.question.length > 30 ? "..." : ""} • YES ${formatPercent(market.yesProbability)}`
        ])
      ).values()].slice(0, 6),
    [markets]
  );

  const leadMarket = boardMetrics.featured[0];
  const featuredCount = boardMetrics.featured.length;
  const headline = boardMetrics.activeMarkets.length > 0
    ? "Trade live sports probability markets."
    : "Track sports markets through creation, trading, and resolution.";
  const subhead = boardMetrics.activeMarkets.length > 0
    ? "Trade live sports conviction with real-time probability pricing, wallet-native execution, and clear on-chain settlement across BharatMarket’s prediction board."
    : "No live contracts are currently trading, but the board is still surfacing liquidity, oracle state, and archived outcomes so traders can stay oriented.";
  return (
    <main className="space-y-8 pb-16">
      <section className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(22,20,32,0.98),rgba(14,14,22,0.98))] px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-10 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-violet-400/85">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
                Protocol Explorer
              </p>
              <h1 className="font-heading max-w-4xl text-[3.15rem] leading-[0.94] text-white sm:text-[4.75rem]">
                {headline}
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-400">
                {subhead}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="#live-markets"
                  className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Explore Board
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href={boardMetrics.activeMarkets.length > 0 ? "/my-account" : "/history"}
                  className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:text-white"
                >
                  {boardMetrics.activeMarkets.length > 0 ? "Open Account" : "View Archive"}
                </Link>
              </div>
            </div>

          </div>

          <div className="space-y-4">
            <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Featured Board
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Board Focus</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">
                  <Flame className="h-4 w-4" />
                  {featuredCount} Highlighted
                </div>
              </div>

              {leadMarket ? (
                <Link
                  href={`/markets/${leadMarket.address}`}
                  className="group mt-5 block rounded-[18px] border border-white/8 bg-black/10 px-5 py-5 transition hover:border-violet-400/30 hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        Featured contract
                      </p>
                      <p className="mt-2 text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
                        {leadMarket.question}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{leadMarket.category}</span>
                        <span>{leadMarket.statusLabel}</span>
                        <span>{leadMarket.traderCount} traders</span>
                        <span>{formatUsdcCompact(leadMarket.volume)} volume</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-4xl font-semibold text-mint">
                        {formatPercent(leadMarket.yesProbability)}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        YES
                      </p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="mt-5 rounded-[18px] border border-white/8 bg-black/10 px-5 py-5 text-sm text-slate-400">
                  Featured contracts will appear here when the board has enough activity to rank markets.
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[16px] border border-white/8 bg-black/10 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Resolution Queue
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {boardMetrics.awaitingMarkets.length > 0
                      ? `${boardMetrics.awaitingMarkets.length} market${boardMetrics.awaitingMarkets.length === 1 ? "" : "s"} waiting for oracle resolution.`
                      : "No contracts are currently queued for resolution."}
                  </p>
                </div>
                <div className="rounded-[16px] border border-white/8 bg-black/10 px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Board Health
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {warning
                      ? "Backend cache is active to keep the board stable while RPC is noisy."
                      : "Board data is flowing live from the backend-assisted market index."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {tickerItems.length > 1 ? <TickerRow items={tickerItems} /> : null}

      <section id="live-markets" className="space-y-5">
        <SectionHeader
          eyebrow="Protocol Board"
          title="Market Board"
          description="Scan active and pending prediction contracts, compare implied probability, and move directly into the market that matches your conviction."
          action={
            <div className="flex items-center gap-3">
              <Link
                href="/history"
                className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                <Sparkles className="h-4 w-4" />
                View archive
              </Link>
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-[14px] border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-500/15"
              >
                Refresh Board
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          }
        />
        <MarketList
          externalRefreshTick={marketRefreshTick}
          markets={markets}
          loading={loading}
          error={error}
          warning={warning}
        />
      </section>

      <section id="activity" className="sr-only">
        <h2>Market Activity</h2>
      </section>
    </main>
  );
}
