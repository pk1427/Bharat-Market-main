import { formatUnits } from "viem";

export function formatPercent(value: bigint) {
  const numeric = Number(value) / 1e16;
  return `${numeric.toFixed(1)}%`;
}

export function formatUsdc(value: bigint) {
  const numeric = Number(formatUnits(value, 6));
  return `${numeric.toLocaleString(undefined, {
    minimumFractionDigits: numeric < 10 ? 2 : 0,
    maximumFractionDigits: 2
  })} USDC`;
}

export function formatUsdcCompact(value: bigint) {
  const numeric = Number(formatUnits(value, 6));
  return `${numeric.toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 2
  })} USDC`;
}

export function formatShares(value: bigint) {
  return Number(formatUnits(value, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

export function formatTimestamp(value: bigint) {
  return new Date(Number(value) * 1000).toLocaleString();
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTxError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Transaction failed.";
}
