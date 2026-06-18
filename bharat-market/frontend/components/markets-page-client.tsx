"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, FolderClock, PlusSquare, RefreshCcw } from "lucide-react";

import { MarketList } from "@/components/market-list";
import { GlowBadge } from "@/components/ui/glow-badge";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { TickerRow } from "@/components/ui/ticker-row";
import { useBoardAnalytics } from "@/hooks/use-board-analytics";
import { useIndexerStatus } from "@/hooks/use-indexer-status";
import { useLiveBoardStream } from "@/hooks/use-live-stream";
import { useMarketBoard } from "@/hooks/use-market-board";
import { formatPercent, formatProbabilityNumber, formatUsdcCompact } from "@/lib/format";

export function MarketsPageClient() {
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

  return (
    <main className="page-stack">
      <section className="protocol-card overflow-hidden rounded-[var(--r-xl)] p-4 sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <GlowBadge label="Protocol Board" tone="gold" />
              <GlowBadge
                label={boardMetrics.activeMarkets.length > 0 ? "Live Trading" : "Watch Mode"}
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

            <div>
              <p className="micro-label">Markets terminal</p>
              <h1 className="mt-2 text-[2.25rem] font-semibold leading-tight tracking-[-0.045em] text-[color:var(--text-primary)] sm:text-[3.5rem]">
                Market Board
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
                Indexed live and pending contracts with probability, liquidity, oracle state, and direct market execution.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:w-[600px] xl:grid-cols-5">
            <ProtocolStat label="Total" value={String(boardMetrics.totalMarkets)} />
            <ProtocolStat label="Live" value={String(boardMetrics.activeMarkets.length)} />
            <ProtocolStat label="Awaiting" value={String(boardMetrics.awaitingMarkets.length)} />
            <ProtocolStat label="Liquidity" value={formatUsdcCompact(markets.reduce((sum, market) => sum + market.liquidity, 0n))} />
            <ProtocolStat label="Volume" value={formatUsdcCompact(markets.reduce((sum, market) => sum + market.volume, 0n))} />
          </div>
        </div>

        {tickerItems.length > 1 ? (
          <TickerRow items={tickerItems} className="mt-5 border-[color:var(--border-subtle)] bg-[color:var(--surface-1)]" />
        ) : null}
      </section>

      <section id="market-board" className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_300px] 2xl:items-start">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Indexed Contracts"
            title="Markets"
            description="Filter the board by status, category, question, or oracle route."
            action={
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
                <Link
                  href="/history"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:text-white sm:flex-none"
                >
                  <FolderClock className="h-4 w-4" />
                  Archive
                </Link>
                <Link
                  href="/create-market"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-semibold text-mint transition hover:border-mint/50 sm:flex-none"
                >
                  <PlusSquare className="h-4 w-4" />
                  Create
                </Link>
                <button
                  type="button"
                  onClick={refresh}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-500/15 sm:flex-none"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
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
            title="Board structure"
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
            title="Top movers"
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

function ProtocolStat({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-h-[68px] gap-2 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">{label}</p>
      <p className="break-words font-mono text-sm font-semibold leading-tight text-[color:var(--text-primary)] sm:text-base">{value}</p>
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
    <div className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] p-3.5 sm:p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)] sm:text-xl">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="rounded-[var(--r-md)] bg-[color:var(--surface-2)] px-3 py-3">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-[color:var(--text-secondary)]">{item.label}</p>
              <p className="font-mono text-sm font-semibold text-[color:var(--text-primary)] sm:text-base">{item.value}</p>
            </div>
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">{item.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
