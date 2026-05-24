"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Coins,
  Gauge,
  Layers3,
  PieChart,
  ShieldCheck,
  Trophy,
  Wallet
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { PortfolioRedeemButton } from "@/components/portfolio-redeem-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
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
      { label: "YES", value: overview.yesHoldings, tone: "bg-mint" },
      { label: "NO", value: overview.noHoldings, tone: "bg-coral" },
      { label: "LP", value: overview.lpHoldings, tone: "bg-gold" }
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

    return {
      totalMarkets,
      activeMarkets,
      awaitingMarkets,
      redeemableMarkets
    };
  }, [groups]);

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
        <Skeleton className="h-56 rounded-[28px]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-[22px]" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-[28px]" />
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
      <Panel className="overflow-hidden p-6 sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-violet-400/80">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
                My Account
              </p>
              <h1 className="font-heading max-w-3xl text-[2.8rem] leading-[0.95] text-white sm:text-[4rem]">
                Manage your positions, liquidity, and redeemable book.
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-400">
                BharatMarket keeps your wallet exposure, current marks, and resolution-ready
                claims in one place so you can move from monitoring to execution quickly.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge
                label={portfolio.data.warning ? "Cached Data" : "Live Sync"}
                tone={portfolio.data.warning ? "gold" : "mint"}
              />
              <StatusBadge
                label={`${insightMetrics.activeMarkets} live • ${insightMetrics.awaitingMarkets} awaiting`}
                tone="slate"
              />
              <span className="text-sm text-slate-500">
                Updated {formatRelativeTime(Date.parse(portfolio.data.updatedAt))}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Wallet Balance"
                value={formatUsdc(overview.walletUsdcBalance)}
                helper="Available buying power"
                tone="slate"
              />
              <MetricCard
                label="Marked Value"
                value={formatUsdc(overview.estimatedPositionValue)}
                helper={`${overview.activePositions} open positions`}
                tone="cyan"
              />
              <MetricCard
                label="Unrealized PnL"
                value={formatUsdc(overview.unrealizedPnl)}
                helper={overview.unrealizedPnl >= 0n ? "Positive mark-to-market" : "Current portfolio drawdown"}
                tone={overview.unrealizedPnl >= 0n ? "mint" : "coral"}
              />
              <MetricCard
                label="Redeemable"
                value={formatUsdc(overview.redeemableWinnings)}
                helper={`${insightMetrics.redeemableMarkets} claimable market${insightMetrics.redeemableMarkets === 1 ? "" : "s"}`}
                tone="gold"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Panel className="h-full p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Connected Wallet
                  </p>
                  <p className="mt-2 font-mono text-lg font-semibold text-white">
                    {address ? shortenAddress(address) : "Not connected"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Polygon Amoy account center</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] p-3 text-slate-300">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <CompactInsight
                  icon={PieChart}
                  label="YES Holdings"
                  value={formatShares(overview.yesHoldings)}
                />
                <CompactInsight
                  icon={ShieldCheck}
                  label="NO Holdings"
                  value={formatShares(overview.noHoldings)}
                />
                <CompactInsight
                  icon={Layers3}
                  label="LP Holdings"
                  value={formatShares(overview.lpHoldings)}
                />
              </div>

              <div className="mt-6 border-t border-white/8 pt-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Exposure Mix
                </p>
                <div className="mt-4 space-y-3">
                  {exposureMix.map((item) => (
                    <div key={item.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{item.label}</span>
                        <span className="font-mono text-white">{item.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.05]">
                        <div
                          className={`h-2 rounded-full ${item.tone}`}
                          style={{ width: `${Math.max(item.percentage, item.value > 0n ? 8 : 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="p-6">
          <SectionHeader
            eyebrow="Open Positions"
            title="Portfolio Book"
            description="Filter by market state, side, or category to move through your book quickly."
          />

          <div className="mt-6 flex flex-wrap gap-2">
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

          {filteredGroups.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No Matching Positions"
                description="Try a different status, side, or category filter to surface more of your portfolio."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
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

        <div className="space-y-4">
          <Panel className="p-5">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-violet-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
              Book Health
            </p>
            <div className="mt-5 space-y-4">
              <CompactInsight icon={Coins} label="Markets Held" value={String(insightMetrics.totalMarkets)} />
              <CompactInsight icon={Gauge} label="Live Exposure" value={String(insightMetrics.activeMarkets)} />
              <CompactInsight icon={Activity} label="Awaiting Oracle" value={String(insightMetrics.awaitingMarkets)} />
              <CompactInsight icon={Trophy} label="Claimable Markets" value={String(insightMetrics.redeemableMarkets)} />
            </div>
          </Panel>

          <Panel className="p-5">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-violet-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
              Fast Actions
            </p>
            <div className="mt-5 space-y-3">
              <QuickLink href="/" label="Open Markets" description="Scan the active board and deploy new capital." />
              <QuickLink href="/history" label="Review Archive" description="Inspect resolved contracts and closed outcomes." />
              <QuickLink href="/create-market" label="Create Market" description="Launch a new sports-first prediction contract." />
            </div>
          </Panel>
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
    <div className="overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-white/8 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={group.statusLabel}
              tone={group.status === "active" ? "mint" : group.status === "awaiting" ? "gold" : "coral"}
            />
            <StatusBadge label={group.category} tone="slate" />
          </div>
          <Link href={`/markets/${group.marketAddress}`} className="block">
            <h2 className="font-heading text-2xl leading-tight text-white transition hover:text-gold">
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

      <div className="hidden grid-cols-[110px_110px_130px_120px_140px_140px_120px] gap-4 border-b border-white/8 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-slate-500 lg:grid">
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
    <motion.div
      whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
      className="px-5 py-4"
    >
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
    <div className="flex items-center justify-between gap-4 rounded-[14px] border border-white/8 bg-slate-950/35 px-4 py-3">
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
      className="group block rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-4 transition hover:border-white/16 hover:bg-white/[0.05]"
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
