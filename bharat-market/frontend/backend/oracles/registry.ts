import type { OracleMetadata } from "@/lib/oracle-metadata";
import { cryptoOracleProvider } from "@/backend/oracles/providers/crypto";
import { cricketOracleProvider } from "@/backend/oracles/providers/cricket";
import { electionOracleProvider } from "@/backend/oracles/providers/elections";
import { OracleProviderError, type OracleProviderAdapter } from "@/backend/oracles/types";

const providers: OracleProviderAdapter[] = [
  cryptoOracleProvider,
  cricketOracleProvider,
  electionOracleProvider
];

export function getOracleProvider(metadata: OracleMetadata) {
  const provider = providers.find(
    (candidate) => candidate.category === metadata.category && candidate.provider === metadata.provider
  ) ?? providers.find((candidate) => candidate.category === metadata.category);

  if (!provider) {
    throw new OracleProviderError(`No oracle provider registered for ${metadata.category}.`, "PROVIDER_NOT_FOUND");
  }

  return provider;
}

export function validateOracleMetadata(metadata: OracleMetadata) {
  return getOracleProvider(metadata).validate(metadata);
}

export function describeOracleMetadata(metadata: OracleMetadata) {
  return getOracleProvider(metadata).describe(metadata);
}

export async function evaluateOracleMetadata(metadata: OracleMetadata) {
  return getOracleProvider(metadata).evaluate(metadata);
}

export function listOracleProviders() {
  return providers.map((provider) => ({
    category: provider.category,
    provider: provider.provider
  }));
}
