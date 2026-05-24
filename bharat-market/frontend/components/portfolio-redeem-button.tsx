"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { marketAbi } from "@/lib/abis";
import { getCappedGasLimit, getSafeFeeOverrides } from "@/lib/fees";
import { failTxToast, handleTxToast, settleTxToast } from "@/lib/tx-toasts";

export function PortfolioRedeemButton({
  marketAddress,
  disabled,
  onComplete
}: {
  marketAddress: `0x${string}`;
  disabled: boolean;
  onComplete: () => void;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const [working, setWorking] = useState(false);

  async function handleRedeem() {
    if (!publicClient || !address) {
      failTxToast("Connect your wallet to redeem.");
      return;
    }

    try {
      setWorking(true);
      const gas = await publicClient
        .estimateContractGas({
          address: marketAddress,
          abi: marketAbi,
          functionName: "redeem",
          args: [],
          account: address
        })
        .then((value) => getCappedGasLimit(value))
        .catch(() => 400_000n);
      const fees = await getSafeFeeOverrides(publicClient);
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: marketAbi,
        functionName: "redeem",
        args: [],
        gas,
        ...fees
      });

      const toastId = handleTxToast({
        hash,
        pendingLabel: "Redeeming winnings..."
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        settleTxToast({
          id: toastId,
          hash,
          status: "success",
          successLabel: "Redeem confirmed.",
          errorLabel: "Redeem failed."
        });
        onComplete();
      } else {
        settleTxToast({
          id: toastId,
          hash,
          status: "error",
          successLabel: "Redeem confirmed.",
          errorLabel: "Redeem failed."
        });
      }
    } catch (error) {
      failTxToast(error instanceof Error ? error.message : "Redeem failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRedeem}
      disabled={disabled || isPending || working}
      className="rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 font-semibold text-gold transition disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isPending || working ? "Redeeming..." : "Redeem"}
    </button>
  );
}
