"use client";

import { useEffect, useState } from "react";
import { zeroHash } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { chainlinkFunctionsOracleAbi } from "@/lib/abis";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import { formatTxError } from "@/lib/format";

export function ResolutionPanel({
  marketAddress,
  chainlinkOracleAddress,
  marketResolved,
  endTime,
  pendingRequest,
  onComplete
}: {
  marketAddress: `0x${string}`;
  chainlinkOracleAddress: `0x${string}` | null;
  marketResolved: boolean;
  endTime: bigint;
  pendingRequest: `0x${string}` | null;
  onComplete: () => void;
}) {
  const { address: account } = useAccount();
  const publicClient = usePublicClient();
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
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
      onComplete();
    }
    if (receipt?.status === "reverted") {
      setError("Resolution request failed on-chain.");
    }
  }, [onComplete, receipt]);

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
    } catch (err) {
      setError(formatTxError(err));
    }
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const tooEarly = now < endTime;
  const hasPending = Boolean(pendingRequest && pendingRequest !== zeroHash);
  const disabled = !chainlinkOracleAddress || marketResolved || tooEarly || hasPending || isPending || isLoading;

  return (
    <div className="glass rounded-[28px] p-5">
      <h3 className="font-heading text-2xl uppercase text-white">Resolution</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        After the market end time, request Chainlink Functions resolution directly from the UI.
      </p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Resolved</span>
          <span className="font-semibold text-white">{marketResolved ? "Yes" : "No"}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>Pending request</span>
          <span className="font-semibold text-white">
            {hasPending ? `${pendingRequest?.slice(0, 10)}...` : "None"}
          </span>
        </div>
      </div>

      {tooEarly ? <p className="mt-4 text-sm text-gold">Market has not ended yet.</p> : null}
      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
      {txHash ? (
        <p className="mt-4 text-sm text-slate-300">
          Resolution request{" "}
          {isPending || isLoading
            ? "is pending"
            : receipt?.status === "success"
              ? "confirmed"
              : receipt?.status === "reverted"
                ? "failed"
                : "submitted"}.
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleRequestResolution}
        disabled={disabled}
        className="mt-5 w-full rounded-2xl border border-coral/30 bg-coral/15 px-4 py-3 font-semibold text-coral transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending || isLoading ? "Requesting..." : "Request Resolution"}
      </button>
    </div>
  );
}
