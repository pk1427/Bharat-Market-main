import type { OracleMetadata } from "@/lib/oracle-metadata";

export type NormalizedOracleOutcome = {
  outcome: 1 | 2;
  summary: string;
  provider: string;
  externalId: string | null;
  settlementPrice: number | null;
  payloadHash: string;
  observedAt: string;
  payloadPreview: unknown;
};

export type OracleProviderAdapter = {
  category: OracleMetadata["category"];
  provider: string;
  describe(metadata: OracleMetadata): string;
  validate(metadata: OracleMetadata): string[];
  evaluate(metadata: OracleMetadata): Promise<NormalizedOracleOutcome>;
};

export class OracleProviderError extends Error {
  constructor(message: string, public readonly code = "ORACLE_PROVIDER_ERROR") {
    super(message);
  }
}
