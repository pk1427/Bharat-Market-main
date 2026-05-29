import type { ElectionOracleMetadata } from "@/lib/oracle-metadata";
import {
  hashOraclePayload,
  resolveElectionWinnerOutcome,
  validateCommonMetadata
} from "@/backend/oracles/outcome-engine";
import { OracleProviderError, type OracleProviderAdapter } from "@/backend/oracles/types";

export const electionOracleProvider: OracleProviderAdapter = {
  category: "election",
  provider: "staging",
  describe(metadata) {
    const election = metadata as ElectionOracleMetadata;
    return `${election.candidate} winner market for ${election.electionId}`;
  },
  validate(metadata) {
    if (metadata.category !== "election") return ["Election provider received non-election metadata."];
    const election = metadata as ElectionOracleMetadata;
    return [
      ...validateCommonMetadata(metadata),
      ...(!election.electionId ? ["Election ID is required."] : []),
      ...(!election.candidate ? ["Candidate or party is required."] : [])
    ];
  },
  async evaluate(metadata) {
    if (metadata.category !== "election") {
      throw new OracleProviderError("Election adapter can only evaluate election metadata.", "INVALID_CATEGORY");
    }

    const election = metadata as ElectionOracleMetadata;
    const stagingWinner = process.env.STAGING_ELECTION_WINNER;
    if (!stagingWinner) {
      throw new OracleProviderError("Election provider is configured for staging only. Set STAGING_ELECTION_WINNER for test evaluation.", "STAGING_PROVIDER_ONLY");
    }

    const payload = {
      electionId: election.electionId,
      winner: stagingWinner,
      source: "staging"
    };
    const outcome = resolveElectionWinnerOutcome(election, stagingWinner);
    return {
      ...outcome,
      provider: "staging",
      externalId: election.electionId,
      settlementPrice: null,
      payloadHash: hashOraclePayload(payload),
      observedAt: new Date().toISOString(),
      payloadPreview: payload
    };
  }
};
