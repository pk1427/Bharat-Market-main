"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { formatProbabilityNumber, formatRelativeTime, formatUsdcCompact } from "@/lib/format";
import type { HistoryPoint } from "@/types/product";

type Range = "1H" | "24H" | "ALL";

export function MarketPriceChart({
  history,
  loading = false,
  warning = null
}: {
  history: HistoryPoint[];
  loading?: boolean;
  warning?: string | null;
}) {
  const [range, setRange] = useState<Range>("ALL");

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === "1H" ? now - 60 * 60 * 1000 : range === "24H" ? now - 24 * 60 * 60 * 1000 : 0;
    const points = history.filter((point) => point.timestamp >= cutoff);

    return points.map((point) => ({
      ...point,
      yes: formatProbabilityNumber(point.yesProbability),
      no: formatProbabilityNumber(point.noProbability),
      volumeLabel: formatUsdcCompact(point.volume),
      timeLabel: new Date(point.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    }));
  }, [history, range]);

  if (loading) {
    return (
      <Panel className="p-5">
        <div className="h-80 animate-pulse rounded-2xl bg-white/5" />
      </Panel>
    );
  }

  if (history.length < 2) {
    return (
      <EmptyState
        title="Building Price History"
        description="BharatMarket is collecting event-backed and local snapshots for this market. More chart history appears as new trades happen."
      />
    );
  }

  const latest = filtered.at(-1);
  const previous = filtered.length > 1 ? filtered[filtered.length - 2] : null;
  const delta = latest && previous ? latest.yes - previous.yes : 0;

  return (
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-white/6 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Market Curve</p>
            <h3 className="mt-2 font-heading text-[2.35rem] uppercase leading-none text-white">Price History</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Event-backed YES and NO probability history with live backend snapshots layered in for a more stable terminal view.
            </p>
        </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-slate-300">
              {delta > 0 ? `YES +${delta.toFixed(1)}%` : delta < 0 ? `YES ${delta.toFixed(1)}%` : "YES flat"}
            </div>
            <div className="flex gap-2">
          {(["1H", "24H", "ALL"] as Range[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
                  className={`rounded-full px-3 py-2 text-xs uppercase tracking-[0.25em] transition ${
                range === item
                    ? "bg-gold/15 text-gold"
                    : "border border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              {item}
            </button>
          ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 border-b border-white/6 md:grid-cols-4">
        <Metric label="Latest YES" value={latest ? `${latest.yes.toFixed(1)}%` : "--"} tone="mint" />
        <Metric label="Latest NO" value={latest ? `${latest.no.toFixed(1)}%` : "--"} tone="coral" />
        <Metric label="Volume" value={latest ? latest.volumeLabel : "--"} tone="slate" />
        <Metric label="Last Snapshot" value={latest ? formatRelativeTime(latest.timestamp) : "--"} tone="gold" />
      </div>

      {warning ? (
        <div className="mx-6 mt-5 rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
          History is temporarily running in fallback mode because Amoy RPC limited event lookups.
        </div>
      ) : null}

      <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-6">
        <div className="h-[26rem] sm:h-[30rem]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered}>
            <defs>
              <linearGradient id="yesFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#5ff2bf" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#5ff2bf" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="noFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#ff7d63" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#ff7d63" stopOpacity={0} />
              </linearGradient>
            </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="timeLabel" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                  background: "rgba(7,16,29,0.97)",
                border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "18px",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.45)"
              }}
                formatter={(value, name) => {
                  const numeric = typeof value === "number" ? value : Number(value ?? 0);
                  return [`${numeric.toFixed(1)}%`, name === "yes" ? "YES" : "NO"];
                }}
            />
            <Area
              type="monotone"
              dataKey="yes"
              stroke="#5ff2bf"
              fill="url(#yesFill)"
                strokeWidth={4}
              isAnimationActive
                activeDot={{ r: 7, stroke: "#07101d", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="no"
              stroke="#ff7d63"
                fill="url(#noFill)"
                fillOpacity={1}
                strokeWidth={2.5}
              isAnimationActive
              activeDot={{ r: 5, stroke: "#07101d", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </div>
    </Panel>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "mint" | "coral" | "gold" | "slate";
}) {
  const toneStyles = {
    mint: "text-mint",
    coral: "text-coral",
    gold: "text-gold",
    slate: "text-white"
  };

  return (
    <div className="px-6 py-5 md:border-r md:border-white/6 last:md:border-r-0">
      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className={`mt-3 font-mono text-[1.85rem] font-semibold ${toneStyles[tone]}`}>{value}</p>
    </div>
  );
}
