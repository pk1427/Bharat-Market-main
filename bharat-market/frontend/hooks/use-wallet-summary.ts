"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

type WalletSummaryPayload = {
  creationFee?: string;
  usdcBalance?: string;
  creationAllowance?: string;
  error?: string;
};

export function useWalletSummary() {
  const { address } = useAccount();
  const enabled = Boolean(address);

  const query = useQuery({
    queryKey: ["wallet-summary", address],
    enabled,
    queryFn: async () => {
      const response = await fetch(`/api/wallet?account=${address}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as WalletSummaryPayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load wallet summary.");
      }

      return {
        usdcBalance: BigInt(payload.usdcBalance ?? "0")
      };
    },
    staleTime: 30_000,
    refetchInterval: 45_000
  });

  return {
    ...query,
    isEnabled: enabled
  };
}
