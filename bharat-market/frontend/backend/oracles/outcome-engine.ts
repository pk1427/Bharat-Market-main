import { createHash } from "crypto";

import type {
  CricketOracleMetadata,
  CryptoOracleMetadata,
  ElectionOracleMetadata,
  OracleMetadata
} from "@/lib/oracle-metadata";

export function resolveCryptoOutcome(metadata: CryptoOracleMetadata, price: number) {
  const isAboveRule = metadata.marketType.includes("above");
  const yes = isAboveRule ? price >= metadata.targetPrice : price <= metadata.targetPrice;

  return {
    outcome: (yes ? 1 : 2) as 1 | 2,
    summary: `${metadata.asset} observed at $${price}; rule ${metadata.settlementRule}; outcome ${yes ? "YES" : "NO"}`
  };
}

export function resolveCricketWinnerOutcome(metadata: CricketOracleMetadata, winner: string) {
  const normalizedWinner = winner.trim().toUpperCase();
  const selectedTeam = metadata.selectedTeam.trim().toUpperCase();
  const yes = normalizedWinner.includes(selectedTeam) || selectedTeam.includes(normalizedWinner);

  return {
    outcome: (yes ? 1 : 2) as 1 | 2,
    summary: `Official winner ${winner}; selected team ${metadata.selectedTeam}; outcome ${yes ? "YES" : "NO"}`
  };
}

export function resolveElectionWinnerOutcome(metadata: ElectionOracleMetadata, winner: string) {
  const normalizedWinner = winner.trim().toLowerCase();
  const candidate = metadata.candidate.trim().toLowerCase();
  const yes = normalizedWinner.includes(candidate) || candidate.includes(normalizedWinner);

  return {
    outcome: (yes ? 1 : 2) as 1 | 2,
    summary: `Verified winner ${winner}; selected candidate ${metadata.candidate}; outcome ${yes ? "YES" : "NO"}`
  };
}

export function hashOraclePayload(payload: unknown) {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function validateCommonMetadata(metadata: OracleMetadata) {
  const errors: string[] = [];
  if (!metadata.provider) errors.push("Provider is required.");
  if (!metadata.marketType) errors.push("Market type is required.");
  if (!metadata.settlementRule) errors.push("Settlement rule is required.");
  if (!metadata.verificationSource) errors.push("Verification source is required.");
  return errors;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    .join(",")}}`;
}
