"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { marketAbi } from "@/lib/abis";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import { formatShares, formatTxError, formatUsdc } from "@/lib/format";

type Side = "yes" | "no";

export function TradePanel({
  marketAddress,
  usdcAddress,
  disabled,
  onComplete
}: {
  marketAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  disabled: boolean;
  onComplete: () => void;
}) {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [side, setSide] = useState<Side>("yes");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<bigint>(0n);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [txKind, setTxKind] = useState<"approve" | "trade" | null>(null);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);

  async function refreshTradeState(currentSide: Side, currentAmount: string) {
    if (!address) {
      setAllowance(0n);
      setPreview(0n);
      return;
    }

    const params = new URLSearchParams();
    params.set("account", address);

    const trimmedAmount = currentAmount.trim();
    if (!disabled && trimmedAmount) {
      params.set("side", currentSide);
      params.set("amount", trimmedAmount);
    }

    const response = await fetch(`/api/markets/${marketAddress}/wallet?${params.toString()}`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as {
      allowance?: string;
      preview?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to refresh trade state.");
    }

    setAllowance(BigInt(payload.allowance ?? "0"));
    setPreview(BigInt(payload.preview ?? "0"));
  }

  const parsedAmount = useMemo(() => {
    try {
      return amount.trim() ? parseUnits(amount.trim(), 6) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const { writeContractAsync, isPending } = useWriteContract();
  const {
    data: receipt,
    error: receiptError,
    isLoading: isConfirming
  } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: Boolean(txHash)
    }
  });

  const needsApproval = parsedAmount > 0n && (allowance ?? 0n) < parsedAmount;

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (disabled || parsedAmount <= 0n) {
        setPreview(0n);
        if (address) {
          try {
            await refreshTradeState(side, amount);
          } catch {
            if (!cancelled) {
              setAllowance(0n);
            }
          }
        }
        return;
      }

      try {
        setPreviewLoading(true);
        await refreshTradeState(side, amount);
        if (!cancelled) {
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPreview(0n);
          setError(err instanceof Error ? err.message : "Preview failed.");
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [address, amount, disabled, marketAddress, parsedAmount, side]);

  useEffect(() => {
    if (!txHash || txKind !== "approve") {
      return;
    }

    if (receipt?.status === "success") {
      void refreshTradeState(side, amount)
        .then(() => {
          setError(null);
        })
        .catch((err) => {
          setError(formatTxError(err));
        });
      return;
    }

    if (receipt?.status === "reverted") {
      setError("Approval failed on-chain.");
    }
  }, [amount, receipt, side, txHash, txKind, address, marketAddress, disabled]);

  useEffect(() => {
    if (!txHash || txKind !== "trade") {
      return;
    }

    if (receipt?.status === "success") {
      onComplete();
      void refreshTradeState(side, "")
        .catch(() => {
          // Ignore refresh failure here; parent refresh still runs.
        });
      setAmount("");
      setPreview(0n);
      return;
    }

    if (receipt?.status === "reverted") {
      setError("Trade failed on-chain. The market may be closed or the transaction may have reverted.");
    }
  }, [onComplete, receipt, txHash, txKind, side, address, marketAddress, disabled]);

  useEffect(() => {
    if (!txHash || txKind !== "trade" || !receiptError) {
      return;
    }

    setError(formatTxError(receiptError));
  }, [receiptError, txHash, txKind]);

  async function handleApprove() {
    if (!parsedAmount) return;

    try {
      setError(null);
      setTxHash(undefined);
      setTxKind(null);
      setActionLabel("Approving USDC");
      if (!publicClient) {
        throw new Error("Public client unavailable.");
      }
      if (!address) {
        throw new Error("Wallet not connected.");
      }
      const gas = await publicClient
        .estimateContractGas({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [marketAddress, parsedAmount],
          account: address
        })
        .then((value) => getCappedGasLimit(value))
        .catch(() => 300_000n);
      const fees = await getSafeFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [marketAddress, parsedAmount],
        gas,
        ...fees
      });
      setTxKind("approve");
      setTxHash(hash);
    } catch (err) {
      setTxKind(null);
      setError(formatTxError(err));
    }
  }

  async function handleTrade() {
    if (!parsedAmount || preview <= 0n) return;

    try {
      setError(null);
      setTxHash(undefined);
      setTxKind(null);
      setActionLabel(side === "yes" ? "Buying YES" : "Buying NO");
      if (!publicClient) {
        throw new Error("Public client unavailable.");
      }
      if (!address) {
        throw new Error("Wallet not connected.");
      }
      const minShares = (preview * 99n) / 100n;
      const gas = await publicClient
        .estimateContractGas({
          address: marketAddress,
          abi: marketAbi,
          functionName: side === "yes" ? "buyYes" : "buyNo",
          args: [parsedAmount, minShares],
          account: address
        })
        .then((value) => getCappedGasLimit(value))
        .catch(() => 500_000n);
      const fees = await getSafeFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: side === "yes" ? "buyYes" : "buyNo",
        args: [parsedAmount, minShares],
        gas,
        ...fees
      });
      setTxKind("trade");
      setTxHash(hash);
    } catch (err) {
      setTxKind(null);
      setError(formatTxError(err));
    }
  }

  const busy = isPending || isConfirming;

  return (
    <div className="glass rounded-[28px] p-5">
      <div>
        <h3 className="font-heading text-2xl uppercase text-white">Trade</h3>
        <p className="text-sm text-slate-400">Preview shares before sending the transaction.</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setSide("yes")}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            side === "yes"
              ? "border-mint/30 bg-mint/15 text-white"
              : "border-white/10 bg-white/5 text-slate-300"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-mint">Buy</p>
          <p className="mt-1 text-lg font-semibold">YES</p>
        </button>
        <button
          type="button"
          onClick={() => setSide("no")}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            side === "no"
              ? "border-coral/30 bg-coral/15 text-white"
              : "border-white/10 bg-white/5 text-slate-300"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-coral">Buy</p>
          <p className="mt-1 text-lg font-semibold">NO</p>
        </button>
      </div>

      <label className="mt-5 block text-sm text-slate-300">
        USDC amount
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="25"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-gold/40"
        />
      </label>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Previewed shares</span>
          <span className="font-semibold text-white">
            {previewLoading ? "Loading..." : formatShares(preview)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span>Trade size</span>
          <span>{amount.trim() && parsedAmount > 0n ? formatUsdc(parsedAmount) : "0 USDC"}</span>
        </div>
      </div>

      {!address ? (
        <p className="mt-4 text-sm text-gold">Connect your wallet to approve USDC and trade.</p>
      ) : null}
      {disabled ? (
        <p className="mt-4 text-sm text-coral">Trading is disabled because this market is closed.</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
      {txHash && txKind ? (
        <p className="mt-4 text-sm text-slate-300">
          {actionLabel ?? "Transaction"}{" "}
          {busy
            ? "is pending"
            : receipt?.status === "success"
              ? "confirmed"
              : receipt?.status === "reverted"
                ? "failed"
                : "submitted"}.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={!address || !needsApproval || busy || disabled}
          className="rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 font-semibold text-gold transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && actionLabel === "Approving USDC" ? "Approving..." : "Approve USDC"}
        </button>
        <button
          type="button"
          onClick={handleTrade}
          disabled={!address || needsApproval || busy || disabled || preview <= 0n}
          className="rounded-2xl border border-mint/30 bg-mint/15 px-4 py-3 font-semibold text-mint transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && actionLabel !== "Approving USDC"
            ? `${side === "yes" ? "Buying YES" : "Buying NO"}...`
            : side === "yes"
              ? "Buy YES"
              : "Buy NO"}
        </button>
      </div>
    </div>
  );
}
