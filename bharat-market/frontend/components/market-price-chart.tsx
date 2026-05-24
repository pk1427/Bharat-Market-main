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

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-2xl uppercase text-white">Price History</h3>
          <p className="text-sm text-slate-400">
            Event-backed YES and NO probability history with local live snapshots layered in.
          </p>
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

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Latest YES" value={latest ? `${latest.yes.toFixed(1)}%` : "--"} />
        <Metric label="Latest NO" value={latest ? `${latest.no.toFixed(1)}%` : "--"} />
        <Metric label="Volume" value={latest ? latest.volumeLabel : "--"} />
        <Metric label="Last Snapshot" value={latest ? formatRelativeTime(latest.timestamp) : "--"} />
      </div>

      {warning ? (
        <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
          History is temporarily running in fallback mode because Amoy RPC limited event lookups.
        </div>
      ) : null}

      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered}>
            <defs>
              <linearGradient id="yesFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#5ff2bf" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#5ff2bf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="timeLabel" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "rgba(7,16,29,0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px"
              }}
            />
            <Area
              type="monotone"
              dataKey="yes"
              stroke="#5ff2bf"
              fill="url(#yesFill)"
              strokeWidth={3}
              isAnimationActive
              activeDot={{ r: 6, stroke: "#07101d", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="no"
              stroke="#ff7d63"
              fillOpacity={0}
              strokeWidth={2}
              isAnimationActive
              activeDot={{ r: 5, stroke: "#07101d", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
