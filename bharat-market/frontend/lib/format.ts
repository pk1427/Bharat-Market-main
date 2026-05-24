import { formatUnits } from "viem";

export function formatPercent(value: bigint) {
  const numeric = Number(value) / 1e16;
  return `${numeric.toFixed(1)}%`;
}

export function formatProbabilityNumber(value: bigint) {
  return Number(value) / 1e16;
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

export function formatUsdcRaw(value: bigint) {
  return Number(formatUnits(value, 6));
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

export function formatRelativeTime(timestampMs: number) {
  const diff = Date.now() - timestampMs;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

export function formatCountdown(endTime: bigint, nowMs = Date.now()) {
  const diffSeconds = Number(endTime) - Math.floor(nowMs / 1000);

  if (diffSeconds <= 0) {
    return "Closed";
  }

  const days = Math.floor(diffSeconds / 86400);
  const hours = Math.floor((diffSeconds % 86400) / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
}

export function formatTxError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Transaction failed.";
}
