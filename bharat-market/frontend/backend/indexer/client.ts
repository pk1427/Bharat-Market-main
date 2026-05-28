import { createPublicClient, http } from "viem";
import { polygonAmoy } from "viem/chains";

export function getIndexerPublicClient() {
  const rpcUrl =
    process.env.INDEXER_RPC_URL ||
    process.env.NEXT_PUBLIC_AMOY_RPC_URL ||
    "https://rpc-amoy.polygon.technology";

  return createPublicClient({
    chain: polygonAmoy,
    transport: http(rpcUrl, {
      timeout: 20_000,
      retryCount: 1
    }),
    batch: {
      multicall: false
    }
  });
}
