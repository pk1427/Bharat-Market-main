export type MarketSyncMode = "market" | "create" | "oracle";

export async function syncMarketAfterTransaction(params: {
  txHash: `0x${string}`;
  marketAddress?: `0x${string}`;
  mode?: MarketSyncMode;
}) {
  const response = await fetch("/api/markets/sync-tx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params)
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to sync market transaction.");
  }

  return payload;
}
