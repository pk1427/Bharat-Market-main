"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Users, Waves } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { ProbabilityBar } from "@/components/ui/probability-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatProbabilityNumber, formatPercent, formatUsdcCompact } from "@/lib/format";
import { isEndingSoon } from "@/lib/market-meta";
import type { MarketSummary } from "@/lib/market-data";

export function MarketCard({ market }: { market: MarketSummary }) {
  const yesPercent = formatProbabilityNumber(market.yesProbability);
  const noPercent = formatProbabilityNumber(market.noProbability);
  const endingSoon = market.status === "active" && isEndingSoon(market.endTime);
  const trending = market.volume >= 50_000_000n;
  const statusTone =
    market.status === "active" ? "mint" : market.status === "awaiting" ? "gold" : "coral";
  const contextLine =
    market.status === "active"
      ? `${market.oracleSource} settlement • closes ${market.endTimeLabel}`
      : market.status === "awaiting"
        ? `Trading closed • waiting for ${market.oracleSource} resolution`
        : `Resolved by ${market.oracleSource} • market archived`;
  const oracleLabel = market.oracleMetadata?.provider ?? market.oracleSource;

  const outcomeLabel =
    market.resolvedOutcome === 1 ? "YES" : market.resolvedOutcome === 2 ? "NO" : "Pending";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <Link href={`/markets/${market.address}`} className="group block">
        <Panel hover className="p-0">
          <div className="grid min-h-[74px] gap-3 px-4 py-3 transition group-hover:bg-[color:var(--surface-2)] lg:grid-cols-[minmax(280px,1.45fr)_210px_110px_110px_90px_132px] lg:items-center">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge label={market.statusLabel} tone={statusTone} />
                <StatusBadge label={market.category} tone="slate" />
                {trending ? <StatusBadge label="Trending" tone="gold" /> : null}
                {endingSoon ? <StatusBadge label="Ending soon" tone="coral" /> : null}
              </div>
              <h3 className="truncate text-[13px] font-semibold text-[color:var(--text-primary)]" title={market.question}>
                {market.question}
              </h3>
              <p className="mt-1 truncate text-xs text-[color:var(--text-tertiary)]" title={contextLine}>
                {contextLine}
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-xs">
                <span className="text-[color:var(--green)]">YES {formatPercent(market.yesProbability)}</span>
                <span className="text-[color:var(--red)]">NO {formatPercent(market.noProbability)}</span>
              </div>
              <ProbabilityBar yesPercent={yesPercent} noPercent={noPercent} compact />
            </div>

            <RowMetric icon={Waves} label="Liq" value={formatUsdcCompact(market.liquidity)} />
            <RowMetric icon={ArrowRight} label="Vol" value={formatUsdcCompact(market.volume)} />
            <RowMetric icon={Users} label="Traders" value={String(market.traderCount)} />

            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <div className="text-left lg:text-right">
                <p className="font-mono text-xs text-[color:var(--text-secondary)]">
                  {market.status === "resolved" ? outcomeLabel : market.endTimeLabel}
                </p>
                <p className="mt-1 truncate text-[11px] text-[color:var(--text-tertiary)]" title={oracleLabel}>
                  {market.status === "resolved" ? "Outcome" : oracleLabel}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-[color:var(--text-tertiary)] transition group-hover:text-[color:var(--accent)]" />
            </div>
          </div>
        </Panel>
      </Link>
    </motion.div>
  );
}

function RowMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof ArrowRight;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-3 py-2 lg:block lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
      <div className="flex items-center gap-1.5 text-[color:var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <p className="font-mono text-[11px] uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="font-mono text-sm font-semibold text-[color:var(--text-primary)] lg:mt-1">{value}</p>
    </div>
  );
}
