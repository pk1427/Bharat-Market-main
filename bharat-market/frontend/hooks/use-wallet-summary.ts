"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { fetchApi } from "@/services/api-client";

type WalletSummaryPayload = {
  creationFee?: string;
  usdcBalance?: string;
  creationAllowance?: string;
};

export function useWalletSummary() {
  const { address } = useAccount();
  const enabled = Boolean(address);

  const query = useQuery({
    queryKey: ["wallet-summary", address],
    enabled,
    queryFn: async () => {
      const payload = await fetchApi<WalletSummaryPayload>(`/api/wallet?account=${address}`);

      return {
        usdcBalance: BigInt(payload.usdcBalance ?? "0")
      };
    },
    staleTime: 30_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false
  });

  return {
    ...query,
    isEnabled: enabled
  };
}
