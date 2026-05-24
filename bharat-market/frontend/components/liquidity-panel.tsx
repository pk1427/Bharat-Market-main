"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { ActionButton } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { TxStatusNotice } from "@/components/ui/tx-status-notice";
import { marketAbi } from "@/lib/abis";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import { formatShares, formatTxError } from "@/lib/format";
import { failTxToast, handleTxToast, settleTxToast } from "@/lib/tx-toasts";

export function LiquidityPanel({
  marketAddress,
  usdcAddress,
  lpTokenAddress,
  lpBalance,
  disabled,
  onComplete
}: {
  marketAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  lpTokenAddress: `0x${string}`;
  lpBalance: bigint;
  disabled: boolean;
  onComplete: () => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [txKind, setTxKind] = useState<"approve" | "add" | "remove" | null>(null);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [toastId, setToastId] = useState<string | number | null>(null);

  const parsedAmount = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 6) : 0n;
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
  const busy = isPending || isConfirming;

  useEffect(() => {
    if (!txHash || !txKind) {
      return;
    }

    if (receipt?.status === "success" && txKind !== "approve") {
      if (txHash && toastId !== null) {
        settleTxToast({
          id: toastId,
          hash: txHash,
          status: "success",
          successLabel: txKind === "add" ? "Liquidity added." : "Liquidity removed.",
          errorLabel: txKind === "add" ? "Add liquidity failed." : "Remove liquidity failed."
        });
      }
      if (txKind === "add") {
        setAmount("");
      }
      onComplete();
      return;
    }

    if (receipt?.status === "success" && txKind === "approve" && txHash && toastId !== null) {
      settleTxToast({
        id: toastId,
        hash: txHash,
        status: "success",
        successLabel: "LP approval confirmed.",
        errorLabel: "LP approval failed."
      });
    }

    if (receipt?.status === "reverted") {
      if (txHash && toastId !== null) {
        settleTxToast({
          id: toastId,
          hash: txHash,
          status: "error",
          successLabel: "Liquidity transaction confirmed.",
          errorLabel: "Liquidity transaction failed."
        });
      }
      setError("Liquidity transaction failed on-chain.");
    }
  }, [onComplete, receipt, txHash, txKind, toastId]);

  useEffect(() => {
    if (!txHash || !txKind || !receiptError) {
      return;
    }

    setError(formatTxError(receiptError));
  }, [receiptError, txHash, txKind]);

  useEffect(() => {
    let cancelled = false;

    async function loadAllowance() {
      if (!address) {
        setAllowance(0n);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.set("account", address);
        params.set("amount", amount);
        const response = await fetch(`/api/markets/${marketAddress}/wallet?${params.toString()}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          allowance?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load allowance.");
        }

        if (!cancelled) {
          setAllowance(BigInt(payload.allowance ?? "0"));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setAllowance(0n);
          setError(err instanceof Error ? err.message : "Failed to load allowance.");
        }
      }
    }

    void loadAllowance();

    return () => {
      cancelled = true;
    };
  }, [address, amount, marketAddress, txHash]);

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
      setToastId(handleTxToast({ hash, pendingLabel: "Approving for LP..." }));
    } catch (err) {
      failTxToast(formatTxError(err));
      setTxKind(null);
      setError(formatTxError(err));
    }
  }

  async function handleAddLiquidity() {
    if (!parsedAmount) return;

    try {
      setError(null);
      setTxHash(undefined);
      setTxKind(null);
      setActionLabel("Adding liquidity");
      if (!publicClient) {
        throw new Error("Public client unavailable.");
      }
      if (!address) {
        throw new Error("Wallet not connected.");
      }
      const gas = await publicClient
        .estimateContractGas({
          address: marketAddress,
          abi: marketAbi,
          functionName: "addLiquidity",
          args: [parsedAmount],
          account: address
        })
        .then((value) => getCappedGasLimit(value))
        .catch(() => 500_000n);
      const fees = await getSafeFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: "addLiquidity",
        args: [parsedAmount],
        gas,
        ...fees
      });
      setTxKind("add");
      setTxHash(hash);
      setToastId(handleTxToast({ hash, pendingLabel: "Adding liquidity..." }));
    } catch (err) {
      failTxToast(formatTxError(err));
      setTxKind(null);
      setError(formatTxError(err));
    }
  }

  async function handleRemoveAllLiquidity() {
    if (lpBalance <= 0n) return;

    try {
      setError(null);
      setTxHash(undefined);
      setTxKind(null);
      setActionLabel("Removing liquidity");
      if (!publicClient) {
        throw new Error("Public client unavailable.");
      }
      if (!address) {
        throw new Error("Wallet not connected.");
      }
      const gas = await publicClient
        .estimateContractGas({
          address: marketAddress,
          abi: marketAbi,
          functionName: "removeLiquidity",
          args: [lpBalance],
          account: address
        })
        .then((value) => getCappedGasLimit(value))
        .catch(() => 500_000n);
      const fees = await getSafeFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: "removeLiquidity",
        args: [lpBalance],
        gas,
        ...fees
      });
      setTxKind("remove");
      setTxHash(hash);
      setToastId(handleTxToast({ hash, pendingLabel: "Removing liquidity..." }));
    } catch (err) {
      failTxToast(formatTxError(err));
      setTxKind(null);
      setError(formatTxError(err));
    }
  }

  return (
    <Panel className="p-5">
      <div>
        <h3 className="font-heading text-2xl uppercase text-white">
          Liquidity
        </h3>
        <p className="text-sm text-slate-400">
          Optional LP controls for supplying and withdrawing USDC from the pool.
        </p>
      </div>

      <label className="mt-5 block text-sm text-slate-300">
        Add liquidity in USDC
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="50"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-gold/40"
        />
      </label>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span>Your LP balance</span>
          <span className="font-semibold text-white">{formatShares(lpBalance)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <span>LP token</span>
          <span className="truncate font-mono text-xs text-slate-400">{lpTokenAddress}</span>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
      {txHash && txKind ? (
        <TxStatusNotice
          state={
            busy ? "pending" : receipt?.status === "success" ? "success" : "error"
          }
          title={actionLabel ?? "Liquidity transaction"}
          detail={
            busy
              ? "Waiting for liquidity confirmation on Polygon Amoy."
              : receipt?.status === "success"
                ? "Market balances have been refreshed from the confirmed transaction."
                : "The liquidity transaction reverted on-chain."
          }
        />
      ) : null}

      <div className="mt-5 grid gap-3">
        <ActionButton
          onClick={handleApprove}
          disabled={!address || !needsApproval || busy || disabled}
          tone="gold"
        >
          {busy && actionLabel === "Approving USDC" ? "Approving..." : "Approve for LP"}
        </ActionButton>
        <ActionButton
          onClick={handleAddLiquidity}
          disabled={!address || needsApproval || busy || disabled || parsedAmount <= 0n}
          tone="mint"
        >
          {busy && actionLabel === "Adding liquidity" ? "Adding..." : "Add Liquidity"}
        </ActionButton>
        <ActionButton
          onClick={handleRemoveAllLiquidity}
          disabled={!address || busy || lpBalance <= 0n}
          tone="coral"
        >
          {busy && actionLabel === "Removing liquidity" ? "Removing..." : "Remove All Liquidity"}
        </ActionButton>
      </div>
    </Panel>
  );
}
