"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  ShieldCheck,
  TrendingUp,
  Users,
  Waves
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";

import { ActivityFeed } from "@/components/activity-feed";
import { LiquidityPanel } from "@/components/liquidity-panel";
import { MarketPriceChart } from "@/components/market-price-chart";
import { ResolutionPanel } from "@/components/resolution-panel";
import { TradePanel } from "@/components/trade-panel";
import { GlowBadge } from "@/components/ui/glow-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { TxStatusNotice } from "@/components/ui/tx-status-notice";
import { marketAbi } from "@/lib/abis";
import { getRequiredAddresses } from "@/lib/contracts";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import {
  formatPercent,
  formatProbabilityNumber,
  formatShares,
  formatTimestamp,
  formatTxError,
  formatUsdc,
  shortenAddress
} from "@/lib/format";
import {
  deserializeMarketDetail,
  type MarketDetailData,
  type MarketDetailDto
} from "@/lib/market-data";
import { recordMarketSnapshot } from "@/lib/history";
import { useMarketHistory } from "@/hooks/use-market-history";
import { failTxToast, handleTxToast, settleTxToast } from "@/lib/tx-toasts";

export function MarketDetail({ address }: { address: string }) {
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const [market, setMarket] = useState<MarketDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemHash, setRedeemHash] = useState<`0x${string}` | undefined>();
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemToastId, setRedeemToastId] = useState<string | number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingRequest, setPendingRequest] = useState<`0x${string}` | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const marketRef = useRef<MarketDetailData | null>(null);
  const marketClosed = market ? market.status !== "active" : false;
  const marketHistory = useMarketHistory(market);

  const addresses = getRequiredAddresses();
  const { writeContractAsync, isPending: redeemPending } = useWriteContract();
  const {
    data: redeemReceipt,
    error: redeemReceiptError,
    isLoading: redeemConfirming
  } = useWaitForTransactionReceipt({
    hash: redeemHash,
    query: {
      enabled: Boolean(redeemHash)
    }
  });

  useEffect(() => {
    marketRef.current = market;
  }, [market]);

  const loadDetail = useCallback(async (forceFresh = false) => {
    if (!addresses) {
      setLoading(false);
      setError(
        "Missing frontend env configuration. Set NEXT_PUBLIC_MARKET_FACTORY_ADDRESS and NEXT_PUBLIC_USDC_ADDRESS."
      );
      return;
    }

    try {
      if (!marketRef.current) {
        setLoading(true);
      }
      setError(null);
      setWarning(null);

      const params = new URLSearchParams();
      params.set("refresh", Date.now().toString());
      if (forceFresh) {
        params.set("fresh", "1");
      }
      if (account) {
        params.set("account", account);
      }
      const response = await fetch(`/api/markets/${address}?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as {
        market?: MarketDetailDto;
        pendingRequest?: `0x${string}` | null;
        error?: string;
        warning?: string;
      };

      if (!response.ok || !payload.market) {
        throw new Error(payload.error ?? "Failed to load market details.");
      }

      setMarket(deserializeMarketDetail(payload.market));
      setPendingRequest(payload.pendingRequest ?? null);
      setWarning(payload.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market details.");
    } finally {
      setLoading(false);
    }
  }, [account, address, addresses]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail, refreshTick]);

  useEffect(() => {
    if (!market) {
      return;
    }

    recordMarketSnapshot(market.address, {
      timestamp: Date.now(),
      yesProbability: market.yesProbability,
      noProbability: market.noProbability,
      volume: market.volume
    });
  }, [market]);

  useEffect(() => {
    if (redeemReceipt?.status === "success") {
      void loadDetail(true);
      return;
    }

    if (redeemReceipt?.status === "reverted") {
      setRedeemError("Redeem transaction failed on-chain.");
    }
  }, [loadDetail, redeemReceipt]);

  useEffect(() => {
    if (!redeemHash || !redeemReceiptError) {
      return;
    }

    setRedeemError(formatTxError(redeemReceiptError));
  }, [redeemHash, redeemReceiptError]);

  useEffect(() => {
    if (!redeemHash || !redeemReceipt) {
      return;
    }

    settleTxToast({
      id: redeemToastId ?? redeemHash,
      hash: redeemHash,
      status: redeemReceipt.status === "success" ? "success" : "error",
      successLabel: "Redeem confirmed.",
      errorLabel: "Redeem failed."
    });
  }, [redeemHash, redeemReceipt, redeemToastId]);

  async function handleRedeem() {
    if (!market?.resolved) return;

    try {
      setRedeemError(null);
      if (!publicClient) {
        throw new Error("Public client unavailable.");
      }
      if (!account) {
        throw new Error("Wallet not connected.");
      }
      const gas = await publicClient
        .estimateContractGas({
          address: market.address,
          abi: marketAbi,
          functionName: "redeem",
          args: [],
          account
        })
        .then((value) => getCappedGasLimit(value))
        .catch(() => 400_000n);
      const fees = await getSafeFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: market.address,
        abi: marketAbi,
        functionName: "redeem",
        args: [],
        gas,
        ...fees
      });
      setRedeemToastId(handleTxToast({ hash, pendingLabel: "Redeeming winnings..." }));
      setRedeemHash(hash);
    } catch (err) {
      failTxToast(formatTxError(err));
      setRedeemError(formatTxError(err));
    }
  }

  if (loading) {
    return <div className="glass rounded-[32px] p-10 text-slate-300">Loading market...</div>;
  }

  if (error || !market || !addresses) {
    return (
      <div className="glass rounded-[32px] border border-coral/20 bg-coral/10 p-8 text-coral">
        {error ?? "Market not found."}
      </div>
    );
  }

  const redeemBusy = redeemPending || redeemConfirming;
  const redeemableBalance =
    market.winningOutcome === 1 ? market.yesBalance : market.winningOutcome === 2 ? market.noBalance : 0n;
  const yesPercent = formatProbabilityNumber(market.yesProbability);
  const noPercent = formatProbabilityNumber(market.noProbability);
  const momentum = yesPercent >= 50 ? "YES momentum" : "NO momentum";
  const sentiment = yesPercent >= 60 ? "Bullish YES" : yesPercent <= 40 ? "Defensive NO" : "Balanced";
  const volatility = Math.abs(yesPercent - 50).toFixed(1);
  const marketStateCopy =
    market.status === "active"
      ? "Trading is open and BharatMarket is streaming pricing, liquidity depth, and wallet exposure."
      : market.status === "awaiting"
        ? "Trading is closed. The contract is waiting for oracle resolution and redemption will unlock once the outcome is finalized."
        : "This market has resolved. Final balances, winning outcome, and redemption state are shown below.";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex text-sm text-slate-400 transition hover:text-white">
          ← Back to markets
        </Link>
        <button
          type="button"
          onClick={() => void loadDetail(true)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 transition hover:border-white/20 hover:text-white"
        >
          Refresh Market
        </button>
      </div>

      <Panel glow className="surface-mask rounded-[32px] p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <GlowBadge label={market.statusLabel} tone={market.status === "active" ? "mint" : market.status === "awaiting" ? "gold" : "coral"} pulse={market.status === "active"} />
              <GlowBadge label={market.category} tone="slate" />
              <GlowBadge label={momentum} tone={yesPercent >= 50 ? "mint" : "coral"} />
              <GlowBadge label={sentiment} tone="gold" />
            </div>

            <div className="space-y-4">
              <h1 className="font-heading max-w-5xl text-4xl uppercase leading-[1.02] tracking-[0.03em] text-white sm:text-6xl">
                {market.question}
              </h1>
              <p className="max-w-4xl text-sm leading-7 text-slate-300">
                Market address {shortenAddress(market.address)} • Expires {formatTimestamp(market.endTime)}
              </p>
              <p className="max-w-4xl text-sm leading-7 text-slate-400">
                {marketStateCopy}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.66fr_0.34fr]">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[28px] border border-white/8 bg-slate-950/60 p-5"
              >
                <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Implied Market Probability</p>
                <div className="mt-4 flex flex-wrap items-end gap-6">
                  <div>
                    <p className="font-mono text-[4rem] font-semibold leading-none tracking-tight text-mint sm:text-[5.2rem]">
                      {formatPercent(market.yesProbability)}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.35em] text-mint">YES</p>
                  </div>
                  <div className="pb-2">
                    <p className="font-mono text-3xl font-semibold text-coral">{formatPercent(market.noProbability)}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.35em] text-coral">NO</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
                  <TrendingUp className="h-4 w-4 text-cyan-300" />
                  <span>{momentum}</span>
                  <span className="font-mono text-white">{volatility}% from neutral</span>
                </div>
              </motion.div>

              <div className="grid gap-4">
                <MetricCard label="Volume" value={formatUsdc(market.volume)} helper="Aggregate traded notional" tone="cyan" />
                <MetricCard label="Liquidity" value={formatUsdc(market.liquidity)} helper="Available pool depth" tone="gold" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <MetricPanel icon={Waves} label="Oracle Route" value={market.oracleType} helper={market.oracleQuery} />
            <MetricPanel icon={ShieldCheck} label="Oracle Source" value={market.oracleSource} helper="Resolution provider for this contract" />
            <MetricPanel icon={Users} label="Participants" value={String(market.traderCount)} helper="Unique wallets that executed buys" />
            <MetricPanel icon={Clock3} label="Expiry" value={formatTimestamp(market.endTime)} helper={market.endTimeLabel} />
            <MetricPanel icon={Activity} label="Volatility" value={`${volatility}%`} helper="Distance from a neutral 50/50 market" />
            <MetricPanel icon={ArrowUpRight} label="Settlement" value={market.resolved ? market.winningLabel : "Pending"} helper={market.statusLabel} />
          </div>
        </div>
        {warning ? (
          <p className="mt-5 text-sm text-gold">
            Showing cached backend data because Polygon Amoy RPC is unstable right now.
          </p>
        ) : null}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)] xl:items-start">
        <div className="space-y-6">
          <SectionHeader
            eyebrow="Market Terminal"
            title="Chart, Flow, and Resolution"
            description="Track live price history, current liquidity state, and settlement readiness from one terminal view."
          />
          <MarketPriceChart
            history={marketHistory.history}
            loading={marketHistory.isLoading}
            warning={marketHistory.warning}
          />
          <Panel className="p-5">
            <div>
              <h2 className="font-heading text-2xl uppercase text-white">
                Market Snapshot
              </h2>
              <p className="text-sm text-slate-400">
                Live contract reads pulled from the deployed market.
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <DataRow label="YES Pool" value={formatUsdc(market.yesPool)} />
              <DataRow label="NO Pool" value={formatUsdc(market.noPool)} />
              <DataRow label="YES Token Balance" value={formatShares(market.yesBalance)} />
              <DataRow label="NO Token Balance" value={formatShares(market.noBalance)} />
              <DataRow label="LP Balance" value={formatShares(market.lpBalance)} />
              <DataRow label="Wallet USDC" value={formatUsdc(market.usdcBalance)} />
            </div>
          </Panel>

          <Panel className="p-5">
            <div>
              <h2 className="font-heading text-2xl uppercase text-white">
                Redeem
              </h2>
              <p className="text-sm text-slate-400">
                Only holders of the winning side can redeem after resolution.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Resolved</span>
                <span className="font-semibold text-white">{market.resolved ? "Yes" : "No"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Redeemable balance</span>
                <span className="font-semibold text-white">{formatShares(redeemableBalance)}</span>
              </div>
            </div>

            {redeemError ? <p className="mt-4 text-sm text-coral">{redeemError}</p> : null}
            {redeemHash ? (
              <TxStatusNotice
                state={
                  redeemBusy
                    ? "pending"
                    : redeemReceipt?.status === "success"
                      ? "success"
                      : "error"
                }
                title="Redeem winnings"
                detail={
                  redeemBusy
                    ? "Waiting for the redemption transaction to finalize on Polygon Amoy."
                    : redeemReceipt?.status === "success"
                      ? "Winning collateral has been redeemed successfully."
                      : "Redemption reverted on-chain."
                }
              />
            ) : null}

            <button
              type="button"
              onClick={handleRedeem}
              disabled={!market.resolved || redeemableBalance <= 0n || redeemBusy}
              className="mt-5 w-full rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 font-semibold text-gold transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {redeemBusy ? "Redeeming..." : "Redeem Winnings"}
            </button>
          </Panel>

          <div id="activity">
            <ActivityFeed marketAddress={market.address} />
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-28">
          <Panel glow className="p-4">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MetricCard label="Wallet USDC" value={formatUsdc(market.usdcBalance)} helper="Available collateral" tone="slate" />
              <MetricCard label="YES Exposure" value={formatShares(market.yesBalance)} helper="Held YES shares" tone="mint" />
              <MetricCard label="NO Exposure" value={formatShares(market.noBalance)} helper="Held NO shares" tone="coral" />
            </div>
          </Panel>

          <TradePanel
            marketAddress={market.address}
            usdcAddress={addresses.usdc}
            disabled={marketClosed}
            onComplete={() => void loadDetail(true)}
          />
          <LiquidityPanel
            marketAddress={market.address}
            usdcAddress={addresses.usdc}
            lpTokenAddress={market.lpToken}
            lpBalance={market.lpBalance}
            disabled={market.resolved}
            onComplete={() => void loadDetail(true)}
          />
          <ResolutionPanel
            marketAddress={market.address}
            chainlinkOracleAddress={addresses.chainlinkOracle ?? null}
            marketResolved={market.resolved}
            endTime={market.endTime}
            pendingRequest={pendingRequest}
            onComplete={() => void loadDetail(true)}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "mint" | "coral" | "gold" | "slate";
}) {
  const toneStyles = {
    mint: "border-mint/20 bg-mint/10 text-mint",
    coral: "border-coral/20 bg-coral/10 text-coral",
    gold: "border-gold/20 bg-gold/10 text-gold",
    slate: "border-white/10 bg-white/5 text-slate-300"
  };

  return (
    <div className={`rounded-[24px] border p-4 ${toneStyles[tone]}`}>
      <p className="text-xs uppercase tracking-[0.25em]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function MetricPanel({
  icon: Icon,
  label,
  value,
  helper
}: {
  icon: typeof Waves;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] uppercase tracking-[0.3em]">{label}</p>
      </div>
      <p className="mt-3 font-mono text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-400">{helper}</p> : null}
    </div>
  );
}
