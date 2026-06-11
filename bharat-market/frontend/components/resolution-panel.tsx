"use client";

import { useEffect, useState } from "react";
import { zeroHash } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Activity, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";

import { ActionButton } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { TxStatusNotice } from "@/components/ui/tx-status-notice";
import { chainlinkFunctionsOracleAbi } from "@/lib/abis";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import { formatTxError } from "@/lib/format";
import { syncMarketAfterTransaction } from "@/lib/market-sync";
import { failTxToast, handleTxToast, settleTxToast } from "@/lib/tx-toasts";

export function ResolutionPanel({
  marketAddress,
  chainlinkOracleAddress,
  marketResolved,
  endTime,
  pendingRequest,
  autoManaged = false,
  onComplete
}: {
  marketAddress: `0x${string}`;
  chainlinkOracleAddress: `0x${string}` | null;
  marketResolved: boolean;
  endTime: bigint;
  pendingRequest: `0x${string}` | null;
  autoManaged?: boolean;
  onComplete: () => void;
}) {
  const { address: account } = useAccount();
  const publicClient = usePublicClient();
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [toastId, setToastId] = useState<string | number | null>(null);
  const { writeContractAsync, isPending } = useWriteContract();
  const {
    data: receipt,
    error: receiptError,
    isLoading
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) }
  });

  useEffect(() => {
    if (receipt?.status === "success") {
      if (txHash && toastId !== null) {
        settleTxToast({
          id: toastId,
          hash: txHash,
          status: "success",
          successLabel: "Resolution request submitted.",
          errorLabel: "Resolution request failed."
        });
      }
      if (!txHash) {
        onComplete();
        return;
      }
      void syncMarketAfterTransaction({
        txHash,
        marketAddress,
        mode: "oracle"
      })
        .catch(() => null)
        .finally(() => {
          onComplete();
        });
    }
    if (receipt?.status === "reverted") {
      if (txHash && toastId !== null) {
        settleTxToast({
          id: toastId,
          hash: txHash,
          status: "error",
          successLabel: "Resolution request submitted.",
          errorLabel: "Resolution request failed."
        });
      }
      setError("Resolution request failed on-chain.");
    }
  }, [onComplete, receipt, toastId, txHash]);

  useEffect(() => {
    if (!txHash || !receiptError) {
      return;
    }

    setError(formatTxError(receiptError));
  }, [receiptError, txHash]);

  async function handleRequestResolution() {
    if (!chainlinkOracleAddress) return;

    try {
      setError(null);
      if (!publicClient) {
        throw new Error("Public client unavailable.");
      }
      if (!account) {
        throw new Error("Wallet not connected.");
      }
      const gas = await publicClient
        .estimateContractGas({
          address: chainlinkOracleAddress,
          abi: chainlinkFunctionsOracleAbi,
          functionName: "requestMarketResolution",
          args: [marketAddress],
          account
        })
        .then((value) => getCappedGasLimit(value))
        .catch(() => 750_000n);
      const fees = await getSafeFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: chainlinkOracleAddress,
        abi: chainlinkFunctionsOracleAbi,
        functionName: "requestMarketResolution",
        args: [marketAddress],
        gas,
        ...fees
      });
      setTxHash(hash);
      setToastId(handleTxToast({ hash, pendingLabel: "Requesting resolution..." }));
    } catch (err) {
      failTxToast(formatTxError(err));
      setError(formatTxError(err));
    }
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const tooEarly = now < endTime;
  const hasPending = Boolean(pendingRequest && pendingRequest !== zeroHash);
  const disabled = !chainlinkOracleAddress || marketResolved || tooEarly || hasPending || isPending || isLoading;
  const resolutionState = marketResolved
    ? "Verified"
    : hasPending
      ? "Chainlink pending"
      : tooEarly
        ? "Waiting expiry"
        : "Ready to request";

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-gold">Oracle Settlement</p>
          <h3 className="mt-2 font-heading text-2xl uppercase text-white">Resolution</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-slate-300">
          {resolutionState}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {marketResolved
          ? "Chainlink Functions has finalized this market. Redemption is now governed by the winning outcome shown above."
          : "After expiry, Chainlink Functions fetches the configured provider data, returns the deterministic outcome, and unlocks redemption."}
      </p>

      <div className="mt-5 grid gap-3">
        <ResolutionStep icon={Clock3} label="Expiry" value={tooEarly ? "Locked" : "Reached"} active={!tooEarly} />
        <ResolutionStep
          icon={Activity}
          label="Request"
          value={marketResolved ? "Fulfilled" : hasPending ? `${pendingRequest?.slice(0, 10)}...` : "None"}
          active={marketResolved || hasPending}
        />
        <ResolutionStep icon={ShieldCheck} label="Outcome" value={marketResolved ? "Resolved" : "Pending"} active={marketResolved} />
      </div>

      {tooEarly ? (
        <TxStatusNotice
          state="pending"
          title="Market still active"
          detail="Resolution requests unlock after the market end time has passed."
        />
      ) : null}
      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
      {txHash ? (
        <TxStatusNotice
          state={
            isPending || isLoading ? "pending" : receipt?.status === "success" ? "success" : "error"
          }
          title="Resolution request"
          detail={
            isPending || isLoading
              ? "Waiting for the oracle request transaction to finalize."
              : receipt?.status === "success"
                ? "The request was accepted and BharatMarket will poll for fulfillment."
                : "The resolution request reverted on-chain."
          }
        />
      ) : null}

      {marketResolved ? (
        <TxStatusNotice
          state="success"
          title="Oracle settlement complete"
          detail="No further resolution request is needed for this market."
        />
      ) : autoManaged ? (
        <TxStatusNotice
          state="pending"
          title="Autonomous settlement enabled"
          detail="BharatMarket's resolution worker handles the Chainlink request automatically once expiry and provider data are ready."
        />
      ) : (
        <ActionButton
          onClick={handleRequestResolution}
          disabled={disabled}
          tone="coral"
          className="mt-5 w-full"
        >
          {isPending || isLoading ? "Requesting..." : "Request Resolution"}
        </ActionButton>
      )}
    </Panel>
  );
}

function ResolutionStep({
  icon: Icon,
  label,
  value,
  active
}: {
  icon: typeof LockKeyhole;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${
      active ? "border-mint/20 bg-mint/[0.05]" : "border-white/10 bg-white/[0.035]"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
          <Icon className={active ? "h-4 w-4 text-mint" : "h-4 w-4 text-slate-500"} />
          {label}
        </span>
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
    </div>
  );
}
