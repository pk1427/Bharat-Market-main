"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock3, ShieldCheck, Users, Waves } from "lucide-react";

import { GlowBadge } from "@/components/ui/glow-badge";
import { Countdown } from "@/components/ui/countdown";
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
  const topMeta =
    market.status === "active"
      ? { label: <Countdown endTime={market.endTime} />, className: "border-violet-500/35 bg-violet-500/10 text-white" }
      : market.status === "awaiting"
        ? { label: "Resolution pending", className: "border-gold/25 bg-gold/10 text-gold" }
        : {
            label:
              market.resolvedOutcome === 1
                ? "Resolved YES"
                : market.resolvedOutcome === 2
                  ? "Resolved NO"
                  : "Resolved",
            className: "border-mint/25 bg-mint/10 text-mint"
          };
  const contextLine =
    market.status === "active"
      ? `${market.oracleSource} settlement • closes ${market.endTimeLabel}`
      : market.status === "awaiting"
        ? `Trading closed • waiting for ${market.oracleSource} resolution`
        : `Resolved by ${market.oracleSource} • market archived`;

  return (
    <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
      <Link href={`/markets/${market.address}`} className="group block">
        <Panel hover className="h-full p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={market.statusLabel} tone={statusTone} />
              <GlowBadge label={market.category} tone="slate" />
              {trending ? <GlowBadge label="Trending" tone="gold" pulse /> : null}
              {endingSoon ? <GlowBadge label="Ending Soon" tone="coral" pulse /> : null}
            </div>
            <div className={`rounded-full border px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.12em] ${topMeta.className}`}>
              <p>{topMeta.label}</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h3 className="min-h-[60px] text-[1.55rem] font-semibold leading-[1.05] tracking-[-0.04em] text-white transition group-hover:text-violet-200">
                  {market.question}
                </h3>
                <ArrowUpRight className="mt-2 h-5 w-5 shrink-0 text-slate-500 transition group-hover:text-violet-300" />
              </div>
              <p className="text-sm leading-6 text-slate-500">{contextLine}</p>

              <div className="data-grid-fade rounded-[18px] bg-white/[0.04] p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">Implied Probability</p>
                    <div className="mt-2 flex items-end gap-4">
                      <div>
                        <p className="font-mono text-[2.55rem] font-semibold tracking-tight text-mint">
                          {formatPercent(market.yesProbability)}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-slate-500">YES</p>
                      </div>
                      <div className="pb-1 text-right">
                        <p className="font-mono text-xl font-semibold text-coral">
                          {formatPercent(market.noProbability)}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.32em] text-slate-500">NO</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[12px] bg-black/15 px-3 py-2">
                    <p className="text-[9px] uppercase tracking-[0.24em] text-slate-500">Momentum</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-white">
                      {Math.abs(yesPercent - 50).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <ProbabilityBar yesPercent={yesPercent} noPercent={noPercent} />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoPill icon={Waves} label="Liquidity" value={formatUsdcCompact(market.liquidity)} />
              <InfoPill icon={ArrowUpRight} label="24H Volume" value={formatUsdcCompact(market.volume)} />
              <InfoPill icon={Users} label="Traders" value={String(market.traderCount)} />
              <InfoPill icon={market.status === "resolved" ? ShieldCheck : Clock3} label={market.status === "resolved" ? "Outcome" : "Oracle"} value={market.status === "resolved" ? (market.resolvedOutcome === 1 ? "YES" : market.resolvedOutcome === 2 ? "NO" : "Pending") : market.oracleSource} />
            </div>

            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>{market.endTimeLabel}</span>
              <span className="text-white transition group-hover:text-violet-300">
                {market.status === "resolved" ? "Review market" : "Open market"}
              </span>
            </div>
          </div>
        </Panel>
      </Link>
    </motion.div>
  );
}

function InfoPill({
  icon: Icon,
  label,
  value
}: {
  icon: typeof ArrowUpRight;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[12px] border border-white/8 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[9px] uppercase tracking-[0.22em]">{label}</p>
      </div>
      <p className="mt-2 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
