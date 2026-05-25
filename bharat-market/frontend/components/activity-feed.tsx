"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { getActivityAmountLabel, getActivityLabel, getActivityTone } from "@/lib/activity";
import { formatRelativeTime, formatShares, formatUsdc, shortenAddress } from "@/lib/format";
import type { ActivityItem } from "@/types/product";

type ActivityFilter = "all" | "trades" | "liquidity" | "resolution" | "redeemed" | "created";

const filterMatchers: Record<ActivityFilter, (item: ActivityItem) => boolean> = {
  all: () => true,
  trades: (item) => item.type === "buy_yes" || item.type === "buy_no",
  liquidity: (item) => item.type === "add_liquidity" || item.type === "remove_liquidity",
  resolution: (item) => item.type === "resolution_requested" || item.type === "resolution_fulfilled",
  redeemed: (item) => item.type === "redeemed",
  created: (item) => item.type === "market_created"
};

export function ActivityFeed({ marketAddress }: { marketAddress: string }) {
  const activity = useActivityFeed(marketAddress);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [whalesOnly, setWhalesOnly] = useState(false);

  const filteredItems = useMemo(() => {
    const items = activity.data?.items ?? [];
    return items.filter((item) => filterMatchers[filter](item)).filter((item) => (whalesOnly ? item.whale : true));
  }, [activity.data?.items, filter, whalesOnly]);

  if (activity.isLoading) {
    return (
      <Panel className="p-5">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </Panel>
    );
  }

  if (activity.error) {
    return <ErrorState message={activity.error.message} />;
  }

  if (!activity.data || activity.data.items.length === 0) {
    return (
      <Panel className="p-5">
        <EmptyState
          title="No Activity Yet"
          description={
            activity.data?.warning
              ? "Activity is temporarily unavailable from RPC, but trading and settlement data are still usable."
              : "As traders, LPs, and the oracle interact with this market, their actions will appear here."
          }
        />
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden p-0">
      <SectionHeader
        eyebrow="Live Tape"
        title="Activity Feed"
        description="Newest on-chain activity first."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWhalesOnly((value) => !value)}
              className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.25em] transition ${
                whalesOnly
                  ? "border-gold/30 bg-gold/15 text-gold"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              Whale Only
            </button>
            <StatusBadge label="Auto Refresh" tone="mint" />
          </div>
        }
      />

      <div className="border-b border-white/6 px-5 pb-4">
      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "trades", "liquidity", "resolution", "redeemed", "created"] as ActivityFilter[]).map(
          (item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.25em] transition ${
                filter === item
                  ? "border-mint/30 bg-mint/15 text-mint"
                  : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {item}
            </button>
          )
        )}
      </div>
      </div>

      <div className="space-y-3 px-5 py-5">
        {activity.data.warning ? (
          <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
            Activity is temporarily using a degraded data path because Amoy RPC limited recent event lookups.
          </div>
        ) : null}
        {filteredItems.length === 0 ? (
          <EmptyState
            title="No Matching Activity"
            description="Try a different filter or turn off whale-only mode to see more market activity."
          />
        ) : null}
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-[18px] px-4 py-4 ${
              item.whale ? "bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(245,158,11,0.05))]" : "bg-white/[0.035]"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={getActivityLabel(item.type)} tone={getActivityTone(item.type)} />
                  {item.whale ? <StatusBadge label="Whale Trade" tone="gold" /> : null}
                </div>
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-white">{shortenAddress(item.actor)}</span> • {item.question}
                </p>
                <p className="text-xs text-slate-500">{formatRelativeTime(item.timestamp)}</p>
              </div>
              <div className="text-right text-sm text-slate-300">
                {item.amount > 0n ? (
                  <p>
                    {getActivityAmountLabel(item)}: <span className="font-semibold text-white">{formatUsdc(item.amount)}</span>
                  </p>
                ) : null}
                {item.shares ? (
                  <p className="text-xs text-slate-500">Shares {formatShares(item.shares)}</p>
                ) : null}
                <a
                  href={`https://amoy.polygonscan.com/tx/${item.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs text-gold hover:underline"
                >
                  View Tx
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
