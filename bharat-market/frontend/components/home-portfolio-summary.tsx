"use client";

import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatShares, formatUsdc } from "@/lib/format";

export function HomePortfolioSummary() {
  const portfolio = usePortfolio();

  if (!portfolio.isEnabled) {
    return null;
  }

  if (portfolio.isLoading) {
    return <Skeleton className="h-40 rounded-[28px]" />;
  }

  if (!portfolio.data || portfolio.data.groups.length === 0) {
    return (
      <EmptyState
        title="Your Portfolio Will Show Up Here"
        description="Once you trade or add liquidity, BharatMarket will summarize your positions and redeemable winnings in one place."
        action={
          <Link
            href="/my-account"
            className="rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 font-semibold text-gold"
          >
            Open Portfolio
          </Link>
        }
      />
    );
  }

  const { overview, warning } = portfolio.data;

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeader
        eyebrow="Performance Metrics"
        title="Portfolio Snapshot"
        description="Your BharatMarket wallet, position value, and redeemable exposure at a glance."
        action={
          <div className="flex items-center gap-2">
            <StatusBadge label={warning ? "Cached" : "Live"} tone={warning ? "gold" : "mint"} />
            <Link
              href="/my-account"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              Open Portfolio
            </Link>
          </div>
        }
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Wallet USDC" value={formatUsdc(overview.walletUsdcBalance)} helper="Ready collateral" tone="slate" />
        <MetricCard label="Position Value" value={formatUsdc(overview.estimatedPositionValue)} helper="Marked to current market" tone="cyan" />
        <MetricCard
          label="Redeemable"
          value={formatUsdc(overview.redeemableWinnings)}
          helper={`${overview.activePositions} active positions`}
          tone="gold"
        />
        <MetricCard
          label="Holdings"
          value={`${formatShares(overview.yesHoldings)} / ${formatShares(overview.noHoldings)}`}
          helper={`${formatShares(overview.lpHoldings)} LP`}
          tone="mint"
        />
      </div>
    </Panel>
  );
}
