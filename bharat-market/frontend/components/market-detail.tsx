"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";

import { LiquidityPanel } from "@/components/liquidity-panel";
import { ResolutionPanel } from "@/components/resolution-panel";
import { TradePanel } from "@/components/trade-panel";
import { marketAbi } from "@/lib/abis";
import { getRequiredAddresses } from "@/lib/contracts";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import {
  formatPercent,
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

export function MarketDetail({ address }: { address: string }) {
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const [market, setMarket] = useState<MarketDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemHash, setRedeemHash] = useState<`0x${string}` | undefined>();
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingRequest, setPendingRequest] = useState<`0x${string}` | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const marketClosed = market ? market.status !== "active" : false;

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

  const loadDetail = useCallback(async () => {
    if (!addresses) {
      setLoading(false);
      setError(
        "Missing frontend env configuration. Set NEXT_PUBLIC_MARKET_FACTORY_ADDRESS and NEXT_PUBLIC_USDC_ADDRESS."
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setWarning(null);

      const params = new URLSearchParams();
      params.set("refresh", Date.now().toString());
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
    if (redeemReceipt?.status === "success") {
      void loadDetail();
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
      setRedeemHash(hash);
    } catch (err) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex text-sm text-slate-400 transition hover:text-white">
          ← Back to markets
        </Link>
        <button
          type="button"
          onClick={() => setRefreshTick((value) => value + 1)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 transition hover:border-white/20 hover:text-white"
        >
          Refresh Market
        </button>
      </div>

      <section className="glass rounded-[32px] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
              {market.statusLabel}
            </span>
            <h1 className="font-heading max-w-4xl text-4xl uppercase leading-tight text-white sm:text-5xl">
              {market.question}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300">
              Market address {shortenAddress(market.address)} • Ends {formatTimestamp(market.endTime)}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Oracle Route</p>
            <p className="mt-2 text-base font-semibold text-white">{market.oracleType}</p>
            <p className="mt-1 break-all text-xs text-slate-500">{market.oracleQuery}</p>
          </div>
        </div>

        <div className="stat-grid mt-8">
          <Stat label="YES Price" value={formatPercent(market.yesProbability)} tone="mint" />
          <Stat label="NO Price" value={formatPercent(market.noProbability)} tone="coral" />
          <Stat label="Liquidity" value={formatUsdc(market.liquidity)} tone="gold" />
          <Stat
            label="Winning Outcome"
            value={market.resolved ? market.winningLabel : "Pending"}
            tone="slate"
          />
        </div>
        {warning ? (
          <p className="mt-5 text-sm text-gold">
            Showing cached backend data because Polygon Amoy RPC is unstable right now.
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="glass rounded-[28px] p-5">
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
          </div>

          <div className="glass rounded-[28px] p-5">
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
              <p className="mt-4 text-sm text-slate-300">
                Redeem transaction{" "}
                {redeemBusy
                  ? "is pending"
                  : redeemReceipt?.status === "success"
                    ? "confirmed"
                    : redeemReceipt?.status === "reverted"
                      ? "failed"
                      : "submitted"}.
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleRedeem}
              disabled={!market.resolved || redeemableBalance <= 0n || redeemBusy}
              className="mt-5 w-full rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 font-semibold text-gold transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {redeemBusy ? "Redeeming..." : "Redeem Winnings"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <TradePanel
            marketAddress={market.address}
            usdcAddress={addresses.usdc}
            disabled={marketClosed}
            onComplete={loadDetail}
          />
          <ResolutionPanel
            marketAddress={market.address}
            chainlinkOracleAddress={addresses.chainlinkOracle ?? null}
            marketResolved={market.resolved}
            endTime={market.endTime}
            pendingRequest={pendingRequest}
            onComplete={loadDetail}
          />
          <LiquidityPanel
            marketAddress={market.address}
            usdcAddress={addresses.usdc}
            lpTokenAddress={market.lpToken}
            lpBalance={market.lpBalance}
            disabled={market.resolved}
            onComplete={loadDetail}
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
