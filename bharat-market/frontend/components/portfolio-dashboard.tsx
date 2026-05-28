"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Coins,
  Gauge,
  Layers3,
  PieChart as PieChartIcon,
  Radar,
  ShieldCheck,
  Target,
  Trophy,
  Wallet
} from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useAccount } from "wagmi";

import { PortfolioRedeemButton } from "@/components/portfolio-redeem-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useIndexerStatus } from "@/hooks/use-indexer-status";
import { useLivePortfolioStream } from "@/hooks/use-live-stream";
import { usePortfolio } from "@/hooks/use-portfolio";
import {
  formatPercent,
  formatRelativeTime,
  formatShares,
  formatUsdc,
  shortenAddress
} from "@/lib/format";
import type { PortfolioGroup, PortfolioPosition, PositionSide } from "@/types/product";

const sideTone: Record<PositionSide, "mint" | "coral" | "gold"> = {
  yes: "mint",
  no: "coral",
  lp: "gold"
};

const sideLabel: Record<PositionSide, string> = {
  yes: "YES",
  no: "NO",
  lp: "LP"
};

export function PortfolioDashboard() {
  const portfolio = usePortfolio();
  const { address } = useAccount();
  const indexerStatus = useIndexerStatus();
  const portfolioStream = useLivePortfolioStream(address ?? null);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "awaiting" | "resolved">("all");
  const [sideFilter, setSideFilter] = useState<"all" | PositionSide>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const groups = portfolio.data?.groups ?? [];
  const overview = portfolio.data?.overview;

  const categories = useMemo(
    () => ["all", ...new Set(groups.map((group) => group.category))],
    [groups]
  );

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        positions: group.positions.filter((position) =>
          sideFilter === "all" ? true : position.side === sideFilter
        )
      }))
      .filter((group) => group.positions.length > 0)
      .filter((group) => (statusFilter === "all" ? true : group.status === statusFilter))
      .filter((group) => (categoryFilter === "all" ? true : group.category === categoryFilter));
  }, [categoryFilter, groups, sideFilter, statusFilter]);

  const exposureMix = useMemo(() => {
    if (!overview) {
      return [];
    }

    const items = [
      { label: "YES", value: overview.yesHoldings, color: "#5ff2bf" },
      { label: "NO", value: overview.noHoldings, color: "#ff7d63" },
      { label: "LP", value: overview.lpHoldings, color: "#f5c451" }
    ];
    const total = items.reduce((sum, item) => sum + item.value, 0n);

    return items.map((item) => ({
      ...item,
      percentage: total > 0n ? Number((item.value * 10000n) / total) / 100 : 0
    }));
  }, [overview]);

  const insightMetrics = useMemo(() => {
    const totalMarkets = groups.length;
    const activeMarkets = groups.filter((group) => group.status === "active").length;
    const awaitingMarkets = groups.filter((group) => group.status === "awaiting").length;
    const redeemableMarkets = groups.filter((group) => group.redeemableTotal > 0n).length;
    const positivePositions = groups.flatMap((group) => group.positions).filter((position) => position.unrealizedPnl > 0n).length;
    const totalPositions = groups.flatMap((group) => group.positions).length;

    return {
      totalMarkets,
      activeMarkets,
      awaitingMarkets,
      redeemableMarkets,
      winRate: totalPositions > 0 ? (positivePositions / totalPositions) * 100 : 0
    };
  }, [groups]);

  const analyticsCurve = useMemo(() => {
    if (!overview) {
      return [];
    }

    const base = Number(overview.estimatedPositionValue) / 1_000_000;
    const pnl = Number(overview.unrealizedPnl) / 1_000_000;
    const safeBase = Number.isFinite(base) ? base : 0;
    const safePnl = Number.isFinite(pnl) ? pnl : 0;

    return [
      { label: "Open", value: Math.max(safeBase - safePnl * 0.55, 0) },
      { label: "Mid", value: Math.max(safeBase - safePnl * 0.2, 0) },
      { label: "Now", value: Math.max(safeBase, 0) }
    ];
  }, [overview]);

  if (!portfolio.isEnabled) {
    return (
      <EmptyState
        title="Connect Your Wallet"
        description="Connect your BharatMarket wallet to view positions, wallet exposure, and redeemable winnings."
      />
    );
  }

  if (portfolio.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-72 rounded-[30px]" />
        <Skeleton className="h-[520px] rounded-[30px]" />
      </div>
    );
  }

  if (portfolio.error) {
    return <ErrorState message={portfolio.error.message} />;
  }

  if (!portfolio.data || groups.length === 0 || !overview) {
    return (
      <EmptyState
        title="No Positions Yet"
        description="Take a position, add liquidity, or resolve a market and your account center will start tracking it here."
        action={
          <Link
            href="/"
            className="rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 font-semibold text-gold"
          >
            Explore Markets
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="overflow-hidden p-0">
        {portfolio.data.meta?.warning ? (
          <div className="border-b border-gold/15 bg-gold/10 px-6 py-4 text-sm text-gold sm:px-8">
            {portfolio.data.meta.warning}
          </div>
        ) : null}
        <div className="grid xl:grid-cols-[minmax(0,1.25fr)_430px]">
          <div className="space-y-7 px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                label={portfolio.data.meta?.source === "indexed" ? "Indexed Sync" : portfolio.data.meta?.source === "cache" ? "Cached Sync" : "Live Sync"}
                tone={portfolio.data.meta?.warning ? "gold" : "mint"}
              />
              <StatusBadge
                label={portfolioStream.status === "live" ? "Stream Live" : portfolioStream.status === "fallback" ? "Fallback" : "Reconnecting"}
                tone={portfolioStream.status === "live" ? "mint" : portfolioStream.status === "fallback" ? "gold" : "slate"}
              />
              <StatusBadge
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
              <StatusBadge
                label={`${insightMetrics.activeMarkets} live • ${insightMetrics.awaitingMarkets} awaiting`}
                tone="slate"
              />
              <span className="text-sm text-slate-500">
                Updated {formatRelativeTime(Date.parse(portfolio.data.updatedAt))}
              </span>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-end">
              <div className="rounded-[30px] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_42%),linear-gradient(180deg,rgba(12,14,24,0.95),rgba(8,10,18,0.96))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">My Account</p>
                <h1 className="mt-4 font-heading max-w-4xl text-[3rem] leading-[0.92] tracking-[-0.05em] text-white sm:text-[4.5rem]">
                  Institutional portfolio terminal for your live prediction book.
                </h1>
                <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-400">
                  Track current marks, open exposure, LP inventory, and redemption-ready claims from one dense account center built around market positions instead of generic wallet cards.
                </p>

                <div className="mt-6 grid gap-3 lg:grid-cols-4">
                  <InlineMetric label="Wallet Balance" value={formatUsdc(overview.walletUsdcBalance)} helper="available buying power" tone="slate" />
                  <InlineMetric label="Marked Value" value={formatUsdc(overview.estimatedPositionValue)} helper={`${overview.activePositions} open positions`} tone="cyan" />
                  <InlineMetric label="Unrealized PnL" value={formatUsdc(overview.unrealizedPnl)} helper={overview.unrealizedPnl >= 0n ? "positive mark-to-market" : "current drawdown"} tone={overview.unrealizedPnl >= 0n ? "mint" : "coral"} />
                  <InlineMetric label="Redeemable" value={formatUsdc(overview.redeemableWinnings)} helper={`${insightMetrics.redeemableMarkets} claimable markets`} tone="gold" />
                </div>
              </div>

              <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(15,19,31,0.96),rgba(9,12,20,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Connected Wallet</p>
                <p className="mt-3 font-mono text-xl font-semibold text-white">
                  {address ? shortenAddress(address) : "Not connected"}
                </p>
                <div className="mt-5 space-y-3">
                  <CompactInsight icon={Wallet} label="YES Holdings" value={formatShares(overview.yesHoldings)} />
                  <CompactInsight icon={ShieldCheck} label="NO Holdings" value={formatShares(overview.noHoldings)} />
                  <CompactInsight icon={Layers3} label="LP Holdings" value={formatShares(overview.lpHoldings)} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/6 bg-black/12 px-6 py-7 sm:px-8 xl:border-l xl:border-t-0">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <AnalyticsPanel
                title="Allocation"
                eyebrow="Exposure Mix"
                body={
                  <div className="grid gap-4 xl:grid-cols-[140px_1fr] xl:items-center">
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={exposureMix}
                            dataKey="percentage"
                            nameKey="label"
                            innerRadius={40}
                            outerRadius={62}
                            stroke="none"
                            paddingAngle={2}
                          >
                            {exposureMix.map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {exposureMix.map((item) => (
                        <ExposureRow key={item.label} label={item.label} value={item.percentage.toFixed(1)} color={item.color} />
                      ))}
                    </div>
                  </div>
                }
              />

              <AnalyticsPanel
                title="Book Health"
                eyebrow="Performance Metrics"
                body={
                  <div className="space-y-3">
                    <CompactInsight icon={Coins} label="Markets Held" value={String(insightMetrics.totalMarkets)} />
                    <CompactInsight icon={Gauge} label="Live Exposure" value={String(insightMetrics.activeMarkets)} />
                    <CompactInsight icon={Radar} label="Awaiting Oracle" value={String(insightMetrics.awaitingMarkets)} />
                    <CompactInsight icon={Trophy} label="Positive Book Rate" value={`${insightMetrics.winRate.toFixed(0)}%`} />
                  </div>
                }
              />

              <AnalyticsPanel
                title="Equity Curve"
                eyebrow="Performance Shape"
                body={
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {analyticsCurve.map((point, index) => (
                        <div key={point.label} className="rounded-[18px] bg-white/[0.035] px-3 py-4 text-center">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{point.label}</p>
                          <p className={`mt-3 font-mono text-lg font-semibold ${index === analyticsCurve.length - 1 ? "text-mint" : "text-white"}`}>
                            {point.value.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {analyticsCurve.map((point, index) => (
                        <div key={`${point.label}-bar`} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{point.label}</span>
                            <span>{point.value.toFixed(2)} USDC</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/[0.05]">
                            <div
                              className={`h-2 rounded-full ${index === analyticsCurve.length - 1 ? "bg-mint" : "bg-violet-400/70"}`}
                              style={{
                                width: `${analyticsCurve.length > 0 && analyticsCurve[analyticsCurve.length - 1].value > 0 ? Math.max((point.value / analyticsCurve[analyticsCurve.length - 1].value) * 100, 8) : 0}%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_340px] xl:items-start">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-white/6 px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Portfolio Book</p>
                <h2 className="mt-2 font-heading text-[2.1rem] uppercase text-white">Open Positions</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Filter by market state, side, or category to move through your book quickly.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "active", "awaiting", "resolved"] as const).map((item) => (
                  <FilterChip
                    key={item}
                    active={statusFilter === item}
                    label={item}
                    onClick={() => setStatusFilter(item)}
                  />
                ))}
                {(["all", "yes", "no", "lp"] as const).map((item) => (
                  <FilterChip
                    key={item}
                    active={sideFilter === item}
                    label={item}
                    onClick={() => setSideFilter(item)}
                  />
                ))}
                {categories.map((item) => (
                  <FilterChip
                    key={item}
                    active={categoryFilter === item}
                    label={item}
                    onClick={() => setCategoryFilter(item)}
                  />
                ))}
              </div>
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="px-6 py-6">
              <EmptyState
                title="No Matching Positions"
                description="Try a different status, side, or category filter to surface more of your portfolio."
              />
            </div>
          ) : (
            <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
              {filteredGroups.map((group) => (
                <PortfolioGroupTable
                  key={group.marketAddress}
                  group={group}
                  onRedeemComplete={() => void portfolio.refetch()}
                />
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4 xl:sticky xl:top-28">
          <AnalyticsPanel
            title="Fast Actions"
            eyebrow="Execution"
            body={
              <div className="space-y-3">
                <QuickLink href="/" label="Open Markets" description="Scan the active board and deploy new capital." />
                <QuickLink href="/history" label="Review Archive" description="Inspect resolved contracts and closed outcomes." />
                <QuickLink href="/create-market" label="Create Market" description="Launch a new sports-first prediction contract." />
              </div>
            }
          />

          <AnalyticsPanel
            title="Position Intelligence"
            eyebrow="Signals"
            body={
              <div className="space-y-3">
                <CompactInsight icon={Target} label="Active Positions" value={String(overview.activePositions)} />
                <CompactInsight icon={Activity} label="Claimable Markets" value={String(insightMetrics.redeemableMarkets)} />
                <CompactInsight icon={PieChartIcon} label="LP Footprint" value={formatShares(overview.lpHoldings)} />
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

function PortfolioGroupTable({
  group,
  onRedeemComplete
}: {
  group: PortfolioGroup;
  onRedeemComplete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,rgba(16,18,29,0.9),rgba(11,13,22,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-col gap-4 border-b border-white/6 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={group.statusLabel}
              tone={group.status === "active" ? "mint" : group.status === "awaiting" ? "gold" : "coral"}
            />
            <StatusBadge label={group.category} tone="slate" />
          </div>
          <Link href={`/markets/${group.marketAddress}`} className="block">
            <h2 className="font-heading text-[2rem] leading-tight text-white transition hover:text-gold">
              {group.question}
            </h2>
          </Link>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            {group.oracleType} • {shortenAddress(group.marketAddress)}
          </p>
        </div>

        {group.redeemableTotal > 0n ? (
          <PortfolioRedeemButton
            marketAddress={group.marketAddress}
            disabled={false}
            onComplete={onRedeemComplete}
          />
        ) : null}
      </div>

      <div className="hidden grid-cols-[110px_110px_130px_120px_140px_140px_120px] gap-4 border-b border-white/6 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-slate-500 lg:grid">
        <span>Side</span>
        <span>Shares</span>
        <span>Avg Entry</span>
        <span>Probability</span>
        <span>Current Value</span>
        <span>Unrealized PnL</span>
        <span>Redeemable</span>
      </div>

      <div className="divide-y divide-white/6">
        {group.positions.map((position) => (
          <PositionRow key={`${group.marketAddress}-${position.side}`} position={position} />
        ))}
      </div>
    </div>
  );
}

function PositionRow({ position }: { position: PortfolioPosition }) {
  return (
    <motion.div whileHover={{ backgroundColor: "rgba(255,255,255,0.025)" }} className="px-5 py-4">
      <div className="grid gap-4 lg:grid-cols-[110px_110px_130px_120px_140px_140px_120px] lg:items-center">
        <div className="flex items-center justify-between gap-3 lg:block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 lg:hidden">Side</span>
          <StatusBadge label={sideLabel[position.side]} tone={sideTone[position.side]} />
        </div>

        <ResponsiveMetric label="Shares" value={formatShares(position.shares)} />
        <ResponsiveMetric
          label="Avg Entry"
          value={position.averageEntryPrice !== null ? formatUsdc(position.averageEntryPrice) : "N/A"}
        />
        <ResponsiveMetric
          label={position.side === "lp" ? "Type" : "Probability"}
          value={position.side === "lp" ? "Liquidity" : formatPercent(position.currentProbability)}
        />
        <ResponsiveMetric label="Current Value" value={formatUsdc(position.estimatedValue)} />
        <ResponsiveMetric
          label="Unrealized PnL"
          value={formatUsdc(position.unrealizedPnl)}
          tone={position.unrealizedPnl >= 0n ? "text-mint" : "text-coral"}
        />
        <ResponsiveMetric
          label="Redeemable"
          value={position.redeemable > 0n ? formatUsdc(position.redeemable) : "--"}
        />
      </div>
    </motion.div>
  );
}

function ResponsiveMetric({
  label,
  value,
  tone = "text-white"
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 lg:block">
      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 lg:hidden">{label}</span>
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}

function FilterChip({
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
      className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.22em] transition ${
        active
          ? "border-gold/30 bg-gold/15 text-gold"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/18 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function CompactInsight({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] bg-slate-950/35 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="rounded-full border border-white/8 bg-white/[0.03] p-2 text-slate-400">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm text-slate-300">{label}</p>
      </div>
      <p className="font-mono text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  description
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[16px] bg-white/[0.035] px-4 py-4 transition hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-white">{label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 text-slate-500 transition group-hover:text-white" />
      </div>
    </Link>
  );
}

function AnalyticsPanel({
  eyebrow,
  title,
  body
}: {
  eyebrow: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-white/6 px-5 py-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
        <h3 className="mt-2 font-heading text-[1.8rem] uppercase text-white">{title}</h3>
      </div>
      <div className="px-5 py-5">{body}</div>
    </Panel>
  );
}

function ExposureRow({
  label,
  value,
  color
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="font-mono text-white">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.05]">
        <div className="h-2 rounded-full" style={{ width: `${Math.max(Number(value), 8)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function InlineMetric({
  label,
  value,
  helper,
  tone
}: {
  label: string;
  value: string;
  helper: string;
  tone: "mint" | "coral" | "gold" | "cyan" | "slate";
}) {
  const tones = {
    mint: "text-mint",
    coral: "text-coral",
    gold: "text-gold",
    cyan: "text-cyan-300",
    slate: "text-white"
  };

  return (
    <div className="rounded-[18px] bg-black/18 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-xl font-semibold ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}
