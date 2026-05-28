import { createPublicClient, fallback, http } from "viem";
import { polygonAmoy } from "viem/chains";

export function getServerPublicClient() {
  const rpcUrl = process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
  const fallbackRpcUrl = "https://rpc-amoy.polygon.technology";

  return createPublicClient({
    chain: polygonAmoy,
    transport: fallback([
      http(rpcUrl, {
        timeout: 15_000,
        retryCount: 0
      }),
      http(fallbackRpcUrl, {
        timeout: 15_000,
        retryCount: 1
      })
    ]),
    batch: {
      multicall: false
    }
  });
}
