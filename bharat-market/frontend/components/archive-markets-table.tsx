"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMarketBoard } from "@/hooks/use-market-board";
import { formatUsdcCompact } from "@/lib/format";
import type { MarketSummary } from "@/lib/market-data";

const PAGE_SIZE = 10;

export function ArchiveMarketsTable() {
  const { markets, loading, error } = useMarketBoard();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "awaiting" | "resolved">("all");

  const filtered = useMemo(() => {
    return markets
      .filter((market) => market.status !== "active")
      .filter((market) =>
        statusFilter === "all" ? true : market.status === statusFilter
      )
      .filter((market) =>
        query.trim().length === 0
          ? true
          : `${market.question} ${market.oracleQuery}`.toLowerCase().includes(query.toLowerCase())
      );
  }, [markets, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-[32rem] rounded-[20px]" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No Archived Markets"
        description="Resolved and awaiting-resolution contracts will appear here once active markets roll off the live board."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Panel className="p-5">
        <SectionHeader
          eyebrow="Protocol Archive"
          title="Past Markets"
          description="Review ended contracts, resolution state, and verification-ready market outcomes."
          action={
            <p className="text-sm text-slate-500">
              Showing {rows.length} of {filtered.length} results
            </p>
          }
        />

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by question or oracle query..."
              className="w-full rounded-[14px] border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-violet-400/30"
            />
          </label>

          <div className="flex rounded-[14px] border border-white/10 bg-white/[0.03] p-1">
            {(["all", "awaiting", "resolved"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setStatusFilter(item);
                  setPage(1);
                }}
                className={`rounded-[10px] px-4 py-2 text-sm transition ${
                  statusFilter === item
                    ? "bg-white text-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {item === "all" ? "All Statuses" : item === "awaiting" ? "Awaiting Resolution" : "Resolved"}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-white/8 bg-black/10">
                <ArchiveHead>ID</ArchiveHead>
                <ArchiveHead>Market</ArchiveHead>
                <ArchiveHead>Liquidity</ArchiveHead>
                <ArchiveHead>Volume</ArchiveHead>
                <ArchiveHead>Status</ArchiveHead>
                <ArchiveHead align="right">Verification</ArchiveHead>
              </tr>
            </thead>
            <tbody>
              {rows.map((market, index) => (
                <tr
                  key={market.address}
                  className="border-b border-white/6 transition hover:bg-white/[0.02] last:border-b-0"
                >
                  <ArchiveCell strong>#{filtered.length - ((page - 1) * PAGE_SIZE + index)}</ArchiveCell>
                  <ArchiveCell>
                    <div>
                      <p className="font-medium text-white">{market.question}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {market.oracleMetadata?.externalId ?? market.oracleQuery}
                      </p>
                    </div>
                  </ArchiveCell>
                  <ArchiveCell>{formatUsdcCompact(market.liquidity)}</ArchiveCell>
                  <ArchiveCell>{formatUsdcCompact(market.volume)}</ArchiveCell>
                  <ArchiveCell>
                    <StatusBadge
                      label={market.statusLabel}
                      tone={market.status === "resolved" ? "mint" : "gold"}
                    />
                  </ArchiveCell>
                  <ArchiveCell align="right">
                    <Link
                      href={`/markets/${market.address}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:border-violet-400/30 hover:text-white"
                    >
                      Details
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </ArchiveCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

function ArchiveHead({
  children,
  align = "left"
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-6 py-4 text-[10px] uppercase tracking-[0.24em] text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function ArchiveCell({
  children,
  align = "left",
  strong = false
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  strong?: boolean;
}) {
  return (
    <td
      className={`px-6 py-5 text-sm ${
        strong ? "font-semibold text-white" : "text-slate-300"
      } ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </td>
  );
}

function Pagination({
  page,
  totalPages,
  onChange
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="rounded-[12px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400 transition disabled:opacity-40"
      >
        Prev
      </button>
      <div className="rounded-[12px] border border-violet-500/30 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-200">
        {page}
      </div>
      <button
        type="button"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-[12px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400 transition disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
