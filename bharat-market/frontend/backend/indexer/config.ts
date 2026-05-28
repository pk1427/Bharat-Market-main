export const INDEXER_CONFIRMATIONS = Number(process.env.INDEXER_CONFIRMATIONS ?? "5");
export const INDEXER_BATCH_SIZE = BigInt(process.env.INDEXER_BATCH_SIZE ?? "2000");
export const INDEXER_LOG_BLOCK_RANGE = BigInt(process.env.INDEXER_LOG_BLOCK_RANGE ?? "10");
export const INDEXER_REORG_BUFFER = BigInt(process.env.INDEXER_REORG_BUFFER ?? "8");
export const INDEXER_LOG_REQUEST_DELAY_MS = Number(process.env.INDEXER_LOG_REQUEST_DELAY_MS ?? "150");
export const INDEXER_MAX_RETRIES = Number(process.env.INDEXER_MAX_RETRIES ?? "6");
export const INITIAL_POOL_LIQUIDITY = 1_000_000_000n;
export const FIXED_POINT_ONE = 1_000_000_000_000_000_000n;
export const FEE_PERCENT = 2n;

export function getFromBlockHint() {
  const raw = process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK;
  if (!raw) {
    return null;
  }

  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}
