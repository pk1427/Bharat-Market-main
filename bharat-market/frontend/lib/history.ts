"use client";

import type { Address } from "viem";

import type { HistoryPoint } from "@/types/product";

const HISTORY_KEY = "bharatmarket:history";

type MarketHistoryStore = Record<string, HistoryPoint[]>;
type SerializedHistoryPoint = {
  timestamp: number;
  yesProbability: string;
  noProbability: string;
  volume: string;
  source: HistoryPoint["source"];
};
type SerializedMarketHistoryStore = Record<string, SerializedHistoryPoint[]>;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStore(): MarketHistoryStore {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as SerializedMarketHistoryStore;
    return Object.fromEntries(
      Object.entries(parsed).map(([marketAddress, points]) => [
        marketAddress,
        points.map((point) => ({
          ...point,
          yesProbability: BigInt(point.yesProbability),
          noProbability: BigInt(point.noProbability),
          volume: BigInt(point.volume)
        }))
      ])
    );
  } catch {
    return {};
  }
}

function writeStore(store: MarketHistoryStore) {
  if (!canUseStorage()) {
    return;
  }

  const serialized = Object.fromEntries(
    Object.entries(store).map(([marketAddress, points]) => [
      marketAddress,
      points.map((point) => ({
        ...point,
        yesProbability: point.yesProbability.toString(),
        noProbability: point.noProbability.toString(),
        volume: point.volume.toString()
      }))
    ])
  ) satisfies SerializedMarketHistoryStore;

  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(serialized));
}

export function loadMarketHistory(marketAddress: Address): HistoryPoint[] {
  const store = readStore();
  const history = store[marketAddress] ?? [];
  return history.sort((a, b) => a.timestamp - b.timestamp);
}

export function mergeMarketHistory(primary: HistoryPoint[], secondary: HistoryPoint[]) {
  const merged = new Map<string, HistoryPoint>();

  [...primary, ...secondary].forEach((point) => {
    const key = `${point.timestamp}-${point.yesProbability.toString()}-${point.noProbability.toString()}-${point.volume.toString()}`;
    merged.set(key, point);
  });

  return [...merged.values()].sort((left, right) => left.timestamp - right.timestamp).slice(-500);
}

export function recordMarketSnapshot(
  marketAddress: Address,
  point: Omit<HistoryPoint, "source">
) {
  const store = readStore();
  const existing = store[marketAddress] ?? [];
  const lastPoint = existing.at(-1);

  if (
    lastPoint &&
    lastPoint.timestamp === point.timestamp &&
    lastPoint.yesProbability === point.yesProbability &&
    lastPoint.noProbability === point.noProbability &&
    lastPoint.volume === point.volume
  ) {
    return;
  }

  const next = [...existing, { ...point, source: "local" as const }].slice(-500);
  store[marketAddress] = next;
  writeStore(store);
}
