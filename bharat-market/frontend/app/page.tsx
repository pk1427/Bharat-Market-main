"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Flame,
  FolderClock,
  LineChart,
  Radar,
  Sparkles,
  Trophy,
  Users,
  Waves
} from "lucide-react";

import { MarketList } from "@/components/market-list";
import { DevSyncStatus } from "@/components/dev-sync-status";
import { GlowBadge } from "@/components/ui/glow-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { TickerRow } from "@/components/ui/ticker-row";
import { useBoardAnalytics } from "@/hooks/use-board-analytics";
import { useIndexerStatus } from "@/hooks/use-indexer-status";
import { useLiveBoardStream } from "@/hooks/use-live-stream";
import { useMarketBoard } from "@/hooks/use-market-board";
import { formatPercent, formatProbabilityNumber, formatUsdcCompact } from "@/lib/format";

export default function HomePage() {
  const [marketRefreshTick] = useState(0);
  const boardStream = useLiveBoardStream();
  const indexerStatus = useIndexerStatus();
  const { markets, loading, error, warning, refresh } = useMarketBoard({
    externalRefreshTick: marketRefreshTick
  });
  const analytics = useBoardAnalytics();

  const boardMetrics = useMemo(() => {
    const activeMarkets = markets.filter((market) => market.status === "active");
    const awaitingMarkets = markets.filter((market) => market.status === "awaiting");
    const resolvedMarkets = markets.filter((market) => market.status === "resolved");
    const totalVolume = markets.reduce((sum, market) => sum + market.volume, 0n);
    const totalLiquidity = markets.reduce((sum, market) => sum + market.liquidity, 0n);
    const liveTraders = markets.reduce((sum, market) => sum + market.traderCount, 0);
    const categoryItems = [...markets.reduce((map, market) => {
      map.set(market.category, (map.get(market.category) ?? 0) + 1);
      return map;
    }, new Map<string, number>())]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);
    const featured = (analytics.trending.length > 0 ? analytics.trending : [...markets])
      .slice()
      .sort((left, right) => {
        const scoreLeft = Number(left.volume + left.liquidity / 4n) + left.traderCount * 1_000_000;
        const scoreRight = Number(right.volume + right.liquidity / 4n) + right.traderCount * 1_000_000;
        return scoreRight - scoreLeft;
      })
      .slice(0, 4);
    const topMovers =
      analytics.topMovers.length > 0
        ? analytics.topMovers.slice(0, 3)
        : [...markets]
            .sort(
              (left, right) =>
                Math.abs(formatProbabilityNumber(right.yesProbability) - 50) -
                Math.abs(formatProbabilityNumber(left.yesProbability) - 50)
            )
            .slice(0, 3);

    return {
      activeMarkets,
      awaitingMarkets,
      resolvedMarkets,
      totalVolume,
      totalLiquidity,
      liveTraders,
      categoryItems,
      featured,
      topMovers
    };
  }, [analytics.topMovers, analytics.trending, markets]);

  const tickerItems = useMemo(
    () =>
      [...new Map(
        markets.map((market) => [
          market.address,
          `${market.category} • ${market.question.slice(0, 32)}${market.question.length > 32 ? "..." : ""} • YES ${formatPercent(market.yesProbability)}`
        ])
      ).values()].slice(0, 8),
    [markets]
  );

  const leadMarket = boardMetrics.featured[0];
  const headline =
    boardMetrics.activeMarkets.length > 0
      ? "Trade live sports probability with exchange-grade clarity."
      : "Monitor live sports markets with exchange-grade clarity.";
  const subhead =
    boardMetrics.activeMarkets.length > 0
      ? "BharatMarket turns real-time sports conviction into a fast probability board with live pricing, wallet-native execution, and clean on-chain settlement."
      : "The live board is quiet right now, but liquidity, oracle state, and archived outcomes are still streaming through the terminal so traders can stay positioned.";

  return (
    <main className="space-y-8 pb-16">
      <section className="overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,rgba(17,16,28,0.98),rgba(10,10,18,0.98))] px-6 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <GlowBadge label="Protocol Explorer" tone="gold" />
              <GlowBadge
                label={boardMetrics.activeMarkets.length > 0 ? "Live markets on board" : "Board in watch mode"}
                tone={boardMetrics.activeMarkets.length > 0 ? "mint" : "slate"}
                pulse={boardMetrics.activeMarkets.length > 0}
              />
              <GlowBadge
                label={boardStream.status === "live" ? "Live stream connected" : boardStream.status === "fallback" ? "Fallback sync" : "Stream reconnecting"}
                tone={boardStream.status === "live" ? "mint" : boardStream.status === "fallback" ? "gold" : "slate"}
                pulse={boardStream.status === "live"}
              />
              <GlowBadge
                label={
                  indexerStatus.data?.freshness.fresh
                    ? "Indexer fresh"
                    : indexerStatus.data?.freshness.state === "stale"
                      ? "Indexer stale"
                      : "Indexer warming"
                }
                tone={
                  indexerStatus.data?.freshness.fresh
                    ? "mint"
                    : indexerStatus.data?.freshness.state === "stale"
                      ? "gold"
                      : "slate"
                }
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-end">
              <div className="space-y-5">
                <h1 className="font-heading max-w-5xl text-[3.35rem] leading-[0.9] tracking-[-0.06em] text-white sm:text-[5.35rem]">
                  {headline}
                </h1>
                <p className="max-w-3xl text-[15px] leading-7 text-slate-400">
                  {subhead}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="#market-board"
                    className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    Explore Board
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={boardMetrics.activeMarkets.length > 0 ? "/my-account" : "/history"}
                    className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:text-white"
                  >
                    {boardMetrics.activeMarkets.length > 0 ? "Open Account" : "View Archive"}
                  </Link>
                </div>
              </div>

              <div className="data-grid-fade rounded-[26px] bg-[linear-gradient(180deg,rgba(8,12,20,0.94),rgba(15,18,28,0.96))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Live Board Metrics</p>
                <div className="mt-4 space-y-4">
                  <MetricTape label="Live Markets" value={String(boardMetrics.activeMarkets.length)} accent="text-mint" />
                  <MetricTape label="Liquidity" value={formatUsdcCompact(boardMetrics.totalLiquidity)} accent="text-gold" />
                  <MetricTape label="Volume" value={formatUsdcCompact(boardMetrics.totalVolume)} accent="text-cyan-300" />
                  <MetricTape label="Participants" value={String(boardMetrics.liveTraders)} accent="text-white" />
                </div>
              </div>
            </div>

            {tickerItems.length > 1 ? <TickerRow items={tickerItems} className="border-white/8 bg-white/[0.03]" /> : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(10,14,24,0.98),rgba(16,18,28,0.96))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Trending Rail</p>
                  <h2 className="market-pulse mt-2 font-heading text-[2rem] uppercase text-white">Board Focus</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">
                  <Flame className="h-4 w-4" />
                  {boardMetrics.featured.length} Focused
                </div>
              </div>

              {leadMarket ? (
                <Link
                  href={`/markets/${leadMarket.address}`}
                  className="group mt-5 block rounded-[22px] bg-white/[0.035] p-5 transition hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">Featured contract</p>
                      <p className="mt-3 text-[2rem] font-semibold leading-[1.04] tracking-[-0.04em] text-white">
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
                      <p className="font-mono text-[3rem] font-semibold leading-none text-mint">
                        {formatPercent(leadMarket.yesProbability)}
                      </p>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-slate-500">YES</p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="mt-5 rounded-[22px] bg-white/[0.035] p-5 text-sm text-slate-400">
                  Featured contracts will appear here when the board has enough activity to rank markets.
                </div>
              )}

              <div className="mt-4 grid gap-3">
                {boardMetrics.featured.slice(1, 4).map((market, index) => (
                  <Link
                    key={market.address}
                    href={`/markets/${market.address}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[18px] bg-black/18 px-4 py-4 transition hover:bg-white/[0.05]"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">#{index + 2} highlighted</p>
                      <p className="mt-2 truncate text-base font-semibold text-white">{market.question}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xl text-mint">{formatPercent(market.yesProbability)}</p>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">YES</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
              <RailPanel
                eyebrow="Resolution Queue"
                icon={Radar}
                body={
                  boardMetrics.awaitingMarkets.length > 0
                    ? `${boardMetrics.awaitingMarkets.length} market${boardMetrics.awaitingMarkets.length === 1 ? "" : "s"} waiting for oracle resolution.`
                    : "No contracts are currently queued for resolution."
                }
              />
              <RailPanel
                eyebrow="Live Tape"
                icon={Activity}
                body={
                  warning
                    ? "Backend snapshots are keeping the board responsive while Amoy RPC is noisy."
                    : "Board data is flowing through the backend-assisted market index."
                }
              />
              <RailPanel
                eyebrow="Top Movers"
                icon={Trophy}
                body={
                  boardMetrics.topMovers[0]
                    ? `${boardMetrics.topMovers[0].question.slice(0, 42)}${boardMetrics.topMovers[0].question.length > 42 ? "..." : ""} moved furthest away from neutral pricing.`
                    : "Probability movers appear here as the board becomes active."
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section id="market-board" className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_360px] 2xl:items-start">
        <div className="space-y-5">
          <SectionHeader
            eyebrow="Protocol Board"
            title="Market Board"
            description="Scan live and pending contracts, compare probability structure, and move directly into the market that matches your conviction."
            action={
              <div className="flex items-center gap-3">
                <Link
                  href="/history"
                  className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  <FolderClock className="h-4 w-4" />
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
            board={{ markets, total: markets.length, loading, error, warning, meta: null, refresh }}
          />
        </div>

        <div className="space-y-4 2xl:sticky 2xl:top-28">
          <SidebarBlock
            eyebrow="Board Structure"
            title="Categories in play"
            items={[
              ...(boardMetrics.categoryItems.length > 0
                ? boardMetrics.categoryItems.map(([category, count]) => ({
                    label: category,
                    value: String(count),
                    helper: "markets on board"
                  }))
                : [
                    {
                      label: "Categories",
                      value: "0",
                      helper: "markets on board"
                    }
                  ]),
              {
                label: "Live",
                value: String(boardMetrics.activeMarkets.length),
                helper: "tradable now"
              },
              {
                label: "Awaiting",
                value: String(boardMetrics.awaitingMarkets.length),
                helper: "oracle queue"
              }
            ]}
          />
          <SidebarBlock
            eyebrow="Top Movers"
            title="Probability pressure"
            items={boardMetrics.topMovers.map((market) => ({
              label: market.question.length > 28 ? `${market.question.slice(0, 28)}...` : market.question,
              value: `${Math.abs(formatProbabilityNumber(market.yesProbability) - 50).toFixed(1)}%`,
              helper: `${market.category} • ${market.statusLabel}`
            }))}
          />
          <SidebarBlock
            eyebrow="Market Sentiment"
            title="Board pulse"
            items={[
              {
                label: "YES leadership",
                value: leadMarket ? formatPercent(leadMarket.yesProbability) : "--",
                helper: leadMarket ? leadMarket.question.slice(0, 32) : "No featured leader yet"
              },
              {
                label: "Participants",
                value: String(boardMetrics.liveTraders),
                helper: "unique observed traders"
              },
              {
                label: "Liquidity",
                value: formatUsdcCompact(boardMetrics.totalLiquidity),
                helper: "pooled collateral depth"
              }
            ]}
          />
          <DevSyncStatus />
        </div>
      </section>
    </main>
  );
}

function MetricTape({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/6 pb-3 last:border-b-0 last:pb-0">
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={`font-mono text-xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function RailPanel({
  eyebrow,
  body,
  icon: Icon
}: {
  eyebrow: string;
  body: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-[22px] bg-[linear-gradient(180deg,rgba(16,18,29,0.96),rgba(11,13,22,0.94))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-cyan-300" />
        {eyebrow}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}

function SidebarBlock({
  eyebrow,
  title,
  items
}: {
  eyebrow: string;
  title: string;
  items: Array<{ label: string; value: string; helper: string }>;
}) {
  return (
    <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(16,18,29,0.96),rgba(11,13,22,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-2 font-heading text-[1.7rem] uppercase text-white">{title}</h3>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="rounded-[18px] bg-white/[0.035] px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-300">{item.label}</p>
              <p className="font-mono text-lg font-semibold text-white">{item.value}</p>
            </div>
            <p className="mt-2 text-xs text-slate-500">{item.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
