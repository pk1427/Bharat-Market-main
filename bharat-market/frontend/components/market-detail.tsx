"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  Dot,
  Gauge,
  LineChart,
  ShieldCheck,
  LockKeyhole,
  TrendingUp,
  Users,
  Waves
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { TxStatusNotice } from "@/components/ui/tx-status-notice";
import { marketAbi } from "@/lib/abis";
import { getRequiredAddresses } from "@/lib/contracts";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import { syncMarketAfterTransaction } from "@/lib/market-sync";
import { useIndexerStatus } from "@/hooks/use-indexer-status";
import {
  formatPercent,
  formatDateTimeIst,
  formatProbabilityNumber,
  formatShares,
  formatTimestamp,
  formatTxError,
  formatUsdc,
  shortenAddress
} from "@/lib/format";
import { recordMarketSnapshot } from "@/lib/history";
import { useMarketDetail } from "@/hooks/use-market-detail";
import { useMarketHistory } from "@/hooks/use-market-history";
import { useLiveMarketStream } from "@/hooks/use-live-stream";
import { failTxToast, handleTxToast, settleTxToast } from "@/lib/tx-toasts";

export function MarketDetail({ address }: { address: string }) {
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const detail = useMarketDetail(address);
  const indexerStatus = useIndexerStatus();
  const marketStream = useLiveMarketStream(address);
  const market = detail.market;
  const [redeemHash, setRedeemHash] = useState<`0x${string}` | undefined>();
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemToastId, setRedeemToastId] = useState<string | number | null>(null);
  const [chartRange, setChartRange] = useState<"1H" | "24H" | "ALL">("ALL");
  const marketHistory = useMarketHistory(market, chartRange);

  const addresses = useMemo(() => getRequiredAddresses(), []);
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
      if (!redeemHash || !market) {
        void detail.refresh(true);
        return;
      }
      void syncMarketAfterTransaction({
        txHash: redeemHash,
        marketAddress: market.address,
        mode: "market"
      })
        .catch(() => null)
        .finally(() => {
          void detail.refresh(true);
        });
      return;
    }

    if (redeemReceipt?.status === "reverted") {
      setRedeemError("Redeem transaction failed on-chain.");
    }
  }, [detail.refresh, redeemReceipt]);

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

  if (detail.loading) {
    return <div className="glass rounded-[32px] p-10 text-slate-300">Loading market...</div>;
  }

  if (detail.error || !market || !addresses) {
    return (
      <div className="glass rounded-[32px] border border-coral/20 bg-coral/10 p-8 text-coral">
        {detail.error ??
          "Missing frontend env configuration. Set NEXT_PUBLIC_MARKET_FACTORY_ADDRESS and NEXT_PUBLIC_USDC_ADDRESS."}
      </div>
    );
  }

  const redeemBusy = redeemPending || redeemConfirming;
  const redeemableBalance =
    market.winningOutcome === 1 ? market.yesBalance : market.winningOutcome === 2 ? market.noBalance : 0n;
  const yesPercent = formatProbabilityNumber(market.yesProbability);
  const volatility = Math.abs(yesPercent - 50).toFixed(1);
  const momentum = yesPercent >= 50 ? "YES momentum" : "NO momentum";
  const sentiment = yesPercent >= 60 ? "Bullish YES" : yesPercent <= 40 ? "Defensive NO" : "Balanced";
  const dominance = yesPercent >= 50 ? "YES" : "NO";
  const marketClosed = market.status !== "active";
  const autoManaged = market.oracleMetadata?.category === "crypto" || market.oracleMetadata?.category === "cricket";
  const marketStateCopy =
    market.status === "active"
      ? "Trading is open and BharatMarket is streaming pricing, liquidity depth, and wallet exposure."
      : market.status === "awaiting"
        ? "Trading is closed. The contract is waiting for oracle resolution and redemption unlocks once the outcome is finalized."
        : "This market has resolved. Final balances, winning outcome, and redemption state are shown below.";
  const oracleSettled = market.resolved || Boolean(market.oracleMetadata?.settlementPrice);
  const oracleTrustLabel = oracleSettled
    ? "Settlement verified"
    : market.status === "awaiting"
      ? "Awaiting oracle fetch"
      : "Oracle armed";
  const oracleTrustTone = oracleSettled ? "mint" : market.status === "awaiting" ? "gold" : "slate";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/markets" className="inline-flex text-sm text-slate-400 transition hover:text-white">
          ← Back to markets
        </Link>
        <button
          type="button"
          onClick={() => void detail.refresh(true)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 transition hover:border-white/20 hover:text-white"
        >
          Refresh Market
        </button>
      </div>

      <Panel glow className="surface-mask overflow-hidden rounded-[34px] p-0">
        <div className="grid xl:grid-cols-[minmax(0,1.35fr)_430px]">
          <div className="space-y-8 px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center gap-3">
              <GlowBadge
                label={market.statusLabel}
                tone={market.status === "active" ? "mint" : market.status === "awaiting" ? "gold" : "coral"}
                pulse={market.status === "active"}
              />
              <GlowBadge label={market.category} tone="slate" />
              <GlowBadge label={momentum} tone={yesPercent >= 50 ? "mint" : "coral"} />
              <GlowBadge label={sentiment} tone="gold" />
              <GlowBadge
                label={marketStream.status === "live" ? "Live tape connected" : marketStream.status === "fallback" ? "Fallback sync" : "Stream reconnecting"}
                tone={marketStream.status === "live" ? "mint" : marketStream.status === "fallback" ? "gold" : "slate"}
                pulse={marketStream.status === "live"}
              />
              <GlowBadge
                label={
                  indexerStatus.data?.freshness.fresh
                    ? "Indexer fresh"
                    : indexerStatus.data?.freshness.state === "stale"
                      ? "Indexer stale"
                      : "Indexer warming"
                }
                tone={
                  indexerStatus.data?.freshness.fresh
                    ? "mint"
                    : indexerStatus.data?.freshness.state === "stale"
                      ? "gold"
                      : "slate"
                }
              />
              {market.oracleMetadata ? (
                <GlowBadge
                  label={oracleTrustLabel}
                  tone={oracleTrustTone}
                  pulse={market.status === "awaiting" && !oracleSettled}
                />
              ) : null}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(95,242,191,0.18),transparent_42%),linear-gradient(180deg,rgba(6,8,18,0.92),rgba(12,14,24,0.96))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="text-[10px] uppercase tracking-[0.38em] text-slate-500">Probability Terminal</p>
                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="space-y-4">
                    <h1 className="font-heading max-w-5xl text-[3.2rem] leading-[0.92] tracking-[-0.05em] text-white sm:text-[4.8rem]">
                      {market.question}
                    </h1>
                    <p className="max-w-3xl text-sm leading-7 text-slate-400">
                      Market address {shortenAddress(market.address)} • Expires {formatTimestamp(market.endTime)}
                    </p>
                    <p className="max-w-3xl text-sm leading-7 text-slate-300">{marketStateCopy}</p>
                  </div>

                  <div className="text-right">
                    <div className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-mint">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {dominance} in control
                    </div>
                    <p className="mt-4 font-mono text-[4.9rem] font-semibold leading-none tracking-tight text-mint sm:text-[6.6rem]">
                      {formatPercent(market.yesProbability)}
                    </p>
                    <div className="mt-3 flex items-center justify-end gap-4 text-xs uppercase tracking-[0.3em]">
                      <span className="text-mint">YES</span>
                      <span className="text-coral">{formatPercent(market.noProbability)} NO</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 lg:grid-cols-4">
                  <InlineMetric label="Momentum" value={`${volatility}%`} helper="from neutral 50/50" tone="slate" />
                  <InlineMetric label="Volume" value={formatUsdc(market.volume)} helper="aggregate notional" tone="cyan" />
                  <InlineMetric label="Liquidity" value={formatUsdc(market.liquidity)} helper="pool depth" tone="gold" />
                  <InlineMetric label="Settlement" value={market.resolved ? market.winningLabel : "Pending"} helper={market.statusLabel} tone="slate" />
                </div>
              </motion.div>

              <div className="grid gap-4">
                <MetricCard label="YES" value={formatPercent(market.yesProbability)} helper="probability" tone="mint" />
                <MetricCard label="NO" value={formatPercent(market.noProbability)} helper="probability" tone="coral" />
              </div>
            </div>
          </div>

          <div className="border-t border-white/6 bg-black/15 px-6 py-7 sm:px-8 xl:border-l xl:border-t-0">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <MetricPanel
                icon={Waves}
                label="Oracle Route"
                value={market.oracleType}
                helper={market.oracleMetadata?.externalId ?? market.oracleQuery}
              />
              <MetricPanel icon={ShieldCheck} label="Oracle Source" value={market.oracleSource} helper="Resolution provider for this contract" />
              <MetricPanel icon={Users} label="Participants" value={String(market.traderCount)} helper="Unique wallets that executed buys" />
              <MetricPanel icon={Clock3} label="Expiry" value={formatTimestamp(market.endTime)} helper={market.endTimeLabel} />
              <MetricPanel icon={Gauge} label="Volatility" value={`${volatility}%`} helper="Distance from neutral" />
              <MetricPanel icon={ArrowUpRight} label="Settlement" value={market.resolved ? market.winningLabel : "Pending"} helper={market.statusLabel} />
            </div>
          </div>
        </div>

        {detail.warning ? (
          <p className="border-t border-white/6 px-6 py-4 text-sm text-gold sm:px-8">
            {detail.warning}
          </p>
        ) : null}
      </Panel>

      {market.oracleMetadata ? (
        <Panel className="overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="relative overflow-hidden px-6 py-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(95,242,191,0.14),transparent_45%)]" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.28em] text-mint">Oracle Transparency</p>
                <h2 className="mt-3 font-heading text-4xl uppercase tracking-[-0.04em] text-white">
                  {oracleSettled ? "Settlement Verified" : "Settlement Pipeline Armed"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  {market.oracleMetadata.settlementRule}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <OracleStep
                    icon={ShieldCheck}
                    label="Provider"
                    value={market.oracleMetadata.provider}
                    active
                  />
                  <OracleStep
                    icon={Activity}
                    label="Fetch"
                    value={oracleSettled ? "Price captured" : market.status === "awaiting" ? "Ready after request" : "Waiting expiry"}
                    active={market.status !== "active"}
                  />
                  <OracleStep
                    icon={LockKeyhole}
                    label="On-chain"
                    value={market.resolved ? market.winningLabel : "Pending"}
                    active={market.resolved}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/6 bg-black/15 p-5 lg:border-l lg:border-t-0">
              <div className="rounded-[24px] border border-mint/15 bg-mint/[0.05] p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-mint">
                  {market.oracleMetadata.settlementPrice ? "Fetched Settlement Price" : "Fetched Settlement Result"}
                </p>
                <p className="mt-3 font-mono text-4xl font-semibold text-white">
                  {market.oracleMetadata.settlementPrice
                    ? formatSettlementPrice(market.oracleMetadata.settlementPrice)
                    : market.resolved
                      ? market.winningLabel
                      : "Awaiting fulfillment"}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Observed {formatSettlementObservedAt(market.oracleMetadata.settlementObservedAt)}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DataRow label="Market Type" value={market.oracleMetadata.marketType} />
                <DataRow label="External ID" value={market.oracleMetadata.externalId ?? "--"} />
                <DataRow label="Verification Source" value={market.oracleMetadata.verificationSource} />
                <DataRow label="Fallback Source" value={market.oracleMetadata.fallbackSource ?? "None"} />
              </div>

              <div className="mt-4 rounded-2xl bg-slate-950/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Settlement Summary</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {market.oracleMetadata.settlementSummary ?? "No Chainlink fulfillment has been indexed yet. Once fulfilled, BharatMarket will show the fetched CoinGecko price, outcome, and redemption state here."}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(355px,0.75fr)] xl:items-start">
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
            <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(15,19,31,0.96),rgba(9,12,20,0.94))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-slate-500">
                <LineChart className="h-3.5 w-3.5 text-cyan-300" />
                Chart, Flow, and Resolution
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                The chart is the center of this market. Use the movement curve, live tape, and snapshot metrics below to understand sentiment before you trade or wait for settlement.
              </p>
            </div>
            <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(15,19,31,0.96),rgba(9,12,20,0.94))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Probability Pulse</p>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                <span className="inline-flex items-center gap-2"><Dot className="h-4 w-4 text-mint" /> YES</span>
                <span className="font-mono text-2xl text-mint">{formatPercent(market.yesProbability)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
                <span className="inline-flex items-center gap-2"><Dot className="h-4 w-4 text-coral" /> NO</span>
                <span className="font-mono text-2xl text-coral">{formatPercent(market.noProbability)}</span>
              </div>
            </div>
          </div>

          <MarketPriceChart
            history={marketHistory.history}
            range={chartRange}
            onRangeChange={setChartRange}
            loading={marketHistory.isLoading}
            warning={marketHistory.warning}
          />

          <Panel className="overflow-hidden p-0">
            <div className="border-b border-white/6 px-5 py-5">
              <h2 className="font-heading text-2xl uppercase text-white">Market Snapshot</h2>
              <p className="mt-2 text-sm text-slate-400">Live contract reads pulled from the deployed market.</p>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <DataRow label="YES Pool" value={formatUsdc(market.yesPool)} />
              <DataRow label="NO Pool" value={formatUsdc(market.noPool)} />
              <DataRow label="YES Token Balance" value={formatShares(market.yesBalance)} />
              <DataRow label="NO Token Balance" value={formatShares(market.noBalance)} />
              <DataRow label="LP Balance" value={formatShares(market.lpBalance)} />
              <DataRow label="Wallet USDC" value={formatUsdc(market.usdcBalance)} />
            </div>
          </Panel>

          <Panel className="overflow-hidden p-0">
            <div className="border-b border-white/6 px-5 py-5">
              <h2 className="font-heading text-2xl uppercase text-white">Redeem</h2>
              <p className="mt-2 text-sm text-slate-400">Only holders of the winning side can redeem after resolution.</p>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Resolved</span>
                  <span className="font-semibold text-white">{market.resolved ? "Yes" : "No"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span>Redeemable balance</span>
                  <span className="font-semibold text-white">{formatShares(redeemableBalance)}</span>
                </div>
              </div>

              {redeemError ? <p className="text-sm text-coral">{redeemError}</p> : null}
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
                className="w-full rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 font-semibold text-gold transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {redeemBusy ? "Redeeming..." : "Redeem Winnings"}
              </button>
            </div>
          </Panel>

          <div id="activity">
            <ActivityFeed marketAddress={market.address} />
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-28">
          <Panel glow className="overflow-hidden p-0">
            <div className="border-b border-white/6 px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Wallet Exposure</p>
              <h3 className="mt-2 font-heading text-2xl uppercase text-white">Position Summary</h3>
            </div>
            <div className="grid gap-3 px-5 py-5 sm:grid-cols-3 xl:grid-cols-1">
              <MetricCard label="Wallet USDC" value={formatUsdc(market.usdcBalance)} helper="Available collateral" tone="slate" />
              <MetricCard label="YES Exposure" value={formatShares(market.yesBalance)} helper="Held YES shares" tone="mint" />
              <MetricCard label="NO Exposure" value={formatShares(market.noBalance)} helper="Held NO shares" tone="coral" />
            </div>
          </Panel>

          <TradePanel
            marketAddress={market.address}
            usdcAddress={addresses.usdc}
            disabled={marketClosed}
            onComplete={() => void detail.refresh(true)}
          />
          <LiquidityPanel
            marketAddress={market.address}
            usdcAddress={addresses.usdc}
            lpTokenAddress={market.lpToken}
            lpBalance={market.lpBalance}
            disabled={market.resolved}
            onComplete={() => void detail.refresh(true)}
          />
          <ResolutionPanel
            marketAddress={market.address}
            chainlinkOracleAddress={addresses.chainlinkOracle ?? null}
            marketResolved={market.resolved}
            endTime={market.endTime}
            pendingRequest={detail.pendingRequest}
            autoManaged={autoManaged}
            onComplete={() => void detail.refresh(true)}
          />
        </div>
      </section>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-950/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function OracleStep({
  icon: Icon,
  label,
  value,
  active
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className={`rounded-[20px] border px-4 py-4 ${
      active ? "border-mint/20 bg-mint/[0.06]" : "border-white/8 bg-white/[0.035]"
    }`}>
      <Icon className={`h-4 w-4 ${active ? "text-mint" : "text-slate-500"}`} />
      <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function formatSettlementPrice(value?: string | null) {
  if (!value) {
    return "Awaiting fulfillment";
  }

  const raw = BigInt(value);
  const whole = raw / 100_000_000n;
  const fraction = raw % 100_000_000n;
  const trimmedFraction = fraction.toString().padStart(8, "0").replace(/0+$/, "");
  return `$${trimmedFraction ? `${whole.toString()}.${trimmedFraction}` : whole.toString()}`;
}

function formatSettlementObservedAt(value?: string | null) {
  if (!value) {
    return "Awaiting fulfillment";
  }

  return formatDateTimeIst(new Date(value));
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
    <div className="rounded-[24px] bg-white/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] uppercase tracking-[0.3em]">{label}</p>
      </div>
      <p className="mt-3 font-mono text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-400">{helper}</p> : null}
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
  tone: "cyan" | "gold" | "slate";
}) {
  const tones = {
    cyan: "text-cyan-300",
    gold: "text-gold",
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
