import type { PublicClient } from "viem";

const blockTimestampCache = new Map<bigint, Date>();

export async function getBlockTimestamp(publicClient: PublicClient, blockNumber: bigint) {
  const cached = blockTimestampCache.get(blockNumber);
  if (cached) {
    return cached;
  }

  const block = await publicClient.getBlock({ blockNumber });
  const timestamp = new Date(Number(block.timestamp) * 1000);
  blockTimestampCache.set(blockNumber, timestamp);
  return timestamp;
}
