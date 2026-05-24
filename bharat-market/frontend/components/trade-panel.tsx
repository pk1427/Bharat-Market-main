"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { ActionButton } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { TxStatusNotice } from "@/components/ui/tx-status-notice";
import { marketAbi } from "@/lib/abis";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import { formatShares, formatTxError, formatUsdc } from "@/lib/format";
import { failTxToast, handleTxToast, settleTxToast } from "@/lib/tx-toasts";

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
  const [toastId, setToastId] = useState<string | number | null>(null);

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
      if (txHash && toastId !== null) {
        settleTxToast({
          id: toastId,
          hash: txHash,
          status: "success",
          successLabel: "Approval confirmed.",
          errorLabel: "Approval failed."
        });
      }
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
      if (txHash && toastId !== null) {
        settleTxToast({
          id: toastId,
          hash: txHash,
          status: "error",
          successLabel: "Approval confirmed.",
          errorLabel: "Approval failed."
        });
      }
      setError("Approval failed on-chain.");
    }
  }, [amount, receipt, side, txHash, txKind, address, marketAddress, disabled, toastId]);

  useEffect(() => {
    if (!txHash || txKind !== "trade") {
      return;
    }

    if (receipt?.status === "success") {
      if (txHash && toastId !== null) {
        settleTxToast({
          id: toastId,
          hash: txHash,
          status: "success",
          successLabel: side === "yes" ? "YES purchase confirmed." : "NO purchase confirmed.",
          errorLabel: side === "yes" ? "YES purchase failed." : "NO purchase failed."
        });
      }
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
      if (txHash && toastId !== null) {
        settleTxToast({
          id: toastId,
          hash: txHash,
          status: "error",
          successLabel: side === "yes" ? "YES purchase confirmed." : "NO purchase confirmed.",
          errorLabel: side === "yes" ? "YES purchase failed." : "NO purchase failed."
        });
      }
      setError("Trade failed on-chain. The market may be closed or the transaction may have reverted.");
    }
  }, [onComplete, receipt, txHash, txKind, side, address, marketAddress, disabled, toastId]);

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
      setToastId(handleTxToast({ hash, pendingLabel: "Approving USDC..." }));
    } catch (err) {
      failTxToast(formatTxError(err));
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
      setToastId(
        handleTxToast({
          hash,
          pendingLabel: side === "yes" ? "Buying YES..." : "Buying NO..."
        })
      );
    } catch (err) {
      failTxToast(formatTxError(err));
      setTxKind(null);
      setError(formatTxError(err));
    }
  }

  const busy = isPending || isConfirming;
  const quickAmounts = ["1", "5", "10", "25"];
  const projectedPayout = preview;
  const probabilityShift = parsedAmount > 0n ? `${(Number(preview) / 1_000_000).toFixed(2)} shares` : "--";

  return (
    <Panel glow className="p-5">
      <div>
        <h3 className="font-heading text-2xl uppercase text-white">Trade</h3>
        <p className="text-sm text-slate-400">Terminal-grade order entry with live preview, approval state, and payout context.</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <motion.button
          type="button"
          onClick={() => setSide("yes")}
          whileTap={{ scale: 0.985 }}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            side === "yes"
              ? "border-mint/30 bg-[linear-gradient(135deg,rgba(95,242,191,0.18),rgba(95,242,191,0.05))] text-white shadow-[0_0_22px_rgba(95,242,191,0.12)]"
              : "border-white/10 bg-white/5 text-slate-300"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-mint">Buy</p>
          <p className="mt-1 text-lg font-semibold">YES</p>
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setSide("no")}
          whileTap={{ scale: 0.985 }}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            side === "no"
              ? "border-coral/30 bg-[linear-gradient(135deg,rgba(255,125,99,0.18),rgba(255,125,99,0.05))] text-white shadow-[0_0_22px_rgba(255,125,99,0.12)]"
              : "border-white/10 bg-white/5 text-slate-300"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.25em] text-coral">Buy</p>
          <p className="mt-1 text-lg font-semibold">NO</p>
        </motion.button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickAmounts.map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => setAmount(quick)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-slate-300 transition hover:border-cyan-400/25 hover:text-white"
          >
            {quick} USDC
          </button>
        ))}
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

      <div className="mt-4 grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
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
        <div className="flex items-center justify-between">
          <span>Projected payout</span>
          <span className="font-semibold text-white">{formatShares(projectedPayout)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Position impact</span>
          <span className="font-semibold text-white">{probabilityShift}</span>
        </div>
      </div>

      {!address ? (
        <TxStatusNotice
          state="pending"
          title="Wallet connection required"
          detail="Connect MetaMask to approve USDC and place a trade."
        />
      ) : null}
      {disabled ? (
        <TxStatusNotice
          state="pending"
          title="Trading closed"
          detail="This contract is no longer accepting new YES or NO entries. Wait for resolution or review another live market."
        />
      ) : null}
      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
      {txHash && txKind ? (
        <TxStatusNotice
          state={
            busy ? "pending" : receipt?.status === "success" ? "success" : "error"
          }
          title={actionLabel ?? "Transaction"}
          detail={
            busy
              ? "Waiting for confirmation on Polygon Amoy."
              : receipt?.status === "success"
                ? "Trade state has been refreshed with the confirmed transaction."
                : "The transaction reverted on-chain."
          }
        />
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ActionButton
          onClick={handleApprove}
          disabled={!address || !needsApproval || busy || disabled}
          tone="gold"
        >
          {busy && actionLabel === "Approving USDC" ? "Approving..." : "Approve USDC"}
        </ActionButton>
        <ActionButton
          onClick={handleTrade}
          disabled={!address || needsApproval || busy || disabled || preview <= 0n}
          tone={side === "yes" ? "mint" : "coral"}
        >
          {busy && actionLabel !== "Approving USDC"
            ? `${side === "yes" ? "Buying YES" : "Buying NO"}...`
            : side === "yes"
              ? "Buy YES"
              : "Buy NO"}
        </ActionButton>
      </div>
    </Panel>
  );
}
