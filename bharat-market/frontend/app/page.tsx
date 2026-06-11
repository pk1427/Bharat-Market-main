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

import { Panel } from "@/components/ui/panel";
import { MarketList } from "@/components/market-list";
import { GlowBadge } from "@/components/ui/glow-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
  const boardMarkets = useMemo(
    () => markets.filter((market) => market.status !== "resolved"),
    [markets]
  );
  const boardTopMovers = useMemo(
    () => analytics.topMovers.filter((market) => market.status !== "resolved"),
    [analytics.topMovers]
  );
  const boardTrending = useMemo(
    () => analytics.trending.filter((market) => market.status !== "resolved"),
    [analytics.trending]
  );

  const boardMetrics = useMemo(() => {
    const totalMarkets = markets.length;
    const resolvedMarkets = markets.filter((market) => market.status === "resolved");
    const activeMarkets = boardMarkets.filter((market) => market.status === "active");
    const awaitingMarkets = boardMarkets.filter((market) => market.status === "awaiting");
    const totalVolume = boardMarkets.reduce((sum, market) => sum + market.volume, 0n);
    const totalLiquidity = boardMarkets.reduce((sum, market) => sum + market.liquidity, 0n);
    const liveTraders = boardMarkets.reduce((sum, market) => sum + market.traderCount, 0);
    const activeParticipants = markets.reduce((sum, market) => sum + market.traderCount, 0);
    const categoryItems = [...boardMarkets.reduce((map, market) => {
      map.set(market.category, (map.get(market.category) ?? 0) + 1);
      return map;
    }, new Map<string, number>())]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);
    const featured = (boardTrending.length > 0 ? boardTrending : [...boardMarkets])
      .slice()
      .sort((left, right) => {
        const scoreLeft = Number(left.volume + left.liquidity / 4n) + left.traderCount * 1_000_000;
        const scoreRight = Number(right.volume + right.liquidity / 4n) + right.traderCount * 1_000_000;
        return scoreRight - scoreLeft;
      })
      .slice(0, 4);
    const topMovers =
      boardTopMovers.length > 0
        ? boardTopMovers.slice(0, 3)
        : [...boardMarkets]
            .sort(
              (left, right) =>
                Math.abs(formatProbabilityNumber(right.yesProbability) - 50) -
                Math.abs(formatProbabilityNumber(left.yesProbability) - 50)
            )
            .slice(0, 3);

    return {
      totalMarkets,
      resolvedMarkets,
      activeMarkets,
      awaitingMarkets,
      totalVolume,
      totalLiquidity,
      liveTraders,
      activeParticipants,
      categoryItems,
      featured,
      topMovers
    };
  }, [boardMarkets, boardTopMovers, boardTrending, markets]);

  const tickerItems = useMemo(
    () =>
      [...new Map(
        boardMarkets.map((market) => [
          market.address,
          `${market.category} • ${market.question.slice(0, 32)}${market.question.length > 32 ? "..." : ""} • YES ${formatPercent(market.yesProbability)}`
        ])
      ).values()].slice(0, 8),
    [boardMarkets]
  );

  const headline =
    boardMetrics.activeMarkets.length > 0
      ? "Trade live sports probability with exchange-grade clarity."
      : "Monitor live sports markets with exchange-grade clarity.";
  const subhead =
    boardMetrics.activeMarkets.length > 0
      ? "BharatMarket turns real-time sports conviction into a fast probability board with live pricing, wallet-native execution, and clean on-chain settlement."
      : "The live board is quiet right now, but liquidity, oracle state, and archived outcomes are still streaming through the terminal so traders can stay positioned.";

  return (
    <main className="space-y-5 pb-12">
      <section className="overflow-hidden rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-0)] px-4 py-4 sm:px-5 sm:py-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_370px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <GlowBadge label="Protocol Explorer" tone="gold" />
              <GlowBadge
                label={boardMetrics.activeMarkets.length > 0 ? "Live Markets" : "Watch Mode"}
                tone={boardMetrics.activeMarkets.length > 0 ? "mint" : "slate"}
                pulse={boardMetrics.activeMarkets.length > 0}
              />
              <GlowBadge
                label={boardStream.status === "live" ? "Stream Connected" : boardStream.status === "fallback" ? "Fallback Sync" : "Reconnecting"}
                tone={boardStream.status === "live" ? "mint" : boardStream.status === "fallback" ? "gold" : "slate"}
                pulse={boardStream.status === "live"}
              />
              <GlowBadge
                label={
                  indexerStatus.data?.freshness.fresh
                    ? "Indexer Fresh"
                    : indexerStatus.data?.freshness.state === "stale"
                      ? "Indexer Stale"
                      : "Indexer Warming"
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

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_230px] xl:items-end">
              <div className="space-y-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">Predict. Trade. Verify.</p>
                <h1 className="max-w-3xl text-[2.75rem] font-semibold leading-[1.02] text-[color:var(--text-primary)] sm:text-[4rem]">
                  Oracle-powered prediction markets for crypto and sports.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                  Trade event probabilities with transparent oracle settlement, automated resolution, and indexed market infrastructure.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="#market-board"
                    className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    Explore Markets
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/create-market"
                    className="inline-flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:text-white"
                  >
                    Create Market
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="rounded-[var(--r-lg)] border border-[color:var(--border-default)] bg-[color:var(--surface-1)] p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">Protocol Metrics</p>
                <div className="mt-3 grid gap-2">
                  <ProtocolStat label="Total Markets" value={String(boardMetrics.totalMarkets)} />
                  <ProtocolStat label="Resolved Markets" value={String(boardMetrics.resolvedMarkets.length)} />
                  <ProtocolStat label="Total Volume" value={formatUsdcCompact(markets.reduce((sum, market) => sum + market.volume, 0n))} />
                  <ProtocolStat label="Total Liquidity" value={formatUsdcCompact(markets.reduce((sum, market) => sum + market.liquidity, 0n))} />
                  <ProtocolStat label="Active Participants" value={String(boardMetrics.activeParticipants)} />
                </div>
              </div>
            </div>

            {tickerItems.length > 1 ? <TickerRow items={tickerItems} className="border-[color:var(--border-subtle)] bg-[color:var(--surface-1)]" /> : null}
          </div>

          <div className="space-y-3">
            <Panel className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">How BharatMarket Works</p>
                  <h2 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">Flow</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-2 text-xs font-semibold text-mint">
                  <Flame className="h-4 w-4" />
                  {boardMetrics.featured.length} ranked
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {protocolFlow.map((step, index) => (
                  <div key={step.title} className="rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">0{index + 1}</p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{step.title}</p>
                      </div>
                      <span className="text-xs text-slate-500">{step.helper}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--text-secondary)]">{step.description}</p>
                  </div>
                ))}
              </div>
            </Panel>

          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {supportedMarkets.map((marketType) => (
          <Panel key={marketType.title} className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">{marketType.badge}</p>
                <h3 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{marketType.title}</h3>
              </div>
              <StatusBadge label={marketType.status} tone={marketType.tone} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">{marketType.description}</p>
          </Panel>
        ))}
      </section>

      <section id="market-board" className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_330px] 2xl:items-start">
        <div className="space-y-4">
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
            board={{ markets: boardMarkets, total: boardMarkets.length, loading, error, warning, meta: null, refresh }}
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

function ProtocolStat({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-3 py-2.5">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">{label}</p>
      <p className="font-mono text-base font-semibold text-[color:var(--text-primary)]">{value}</p>
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
    <div className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="rounded-[var(--r-md)] bg-[color:var(--surface-2)] px-3 py-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[color:var(--text-secondary)]">{item.label}</p>
              <p className="font-mono text-base font-semibold text-[color:var(--text-primary)]">{item.value}</p>
            </div>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">{item.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const protocolFlow = [
  {
    title: "Create Market",
    helper: "01",
    description: "Structured creator forms launch crypto and cricket markets with clear oracle routes and expiry windows."
  },
  {
    title: "Trade Outcomes",
    helper: "02",
    description: "Traders deploy capital into YES or NO positions with live probability, liquidity, and wallet-native settlement."
  },
  {
    title: "Oracle Verification",
    helper: "03",
    description: "Chainlink Functions fetches CoinGecko or CricAPI data and normalizes a deterministic result."
  },
  {
    title: "Settlement & Redemption",
    helper: "04",
    description: "Markets resolve on-chain, the indexer syncs state, and winning holders redeem automatically."
  }
];

const supportedMarkets = [
  {
    title: "Crypto Markets",
    badge: "Live",
    status: "Production ready",
    tone: "mint" as const,
    description:
      "CoinGecko-backed market creation, settlement, and redemption with price_above and price_below support."
  },
  {
    title: "Cricket Markets",
    badge: "Live",
    status: "Production ready",
    tone: "mint" as const,
    description:
      "CricAPI-backed winner markets for finished fixtures, resolved through the same indexed and on-chain pipeline."
  },
  {
    title: "Election Markets",
    badge: "Future",
    status: "Coming Soon",
    tone: "gold" as const,
    description:
      "Intentionally future-facing and marked as not production-enabled until a verified election oracle is added."
  }
];
