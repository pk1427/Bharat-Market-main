import type { CricketOracleMetadata } from "@/lib/oracle-metadata";
import {
  hashOraclePayload,
  resolveCricketWinnerOutcome,
  validateCommonMetadata
} from "@/backend/oracles/outcome-engine";
import { OracleProviderError, type OracleProviderAdapter } from "@/backend/oracles/types";

export const cricketOracleProvider: OracleProviderAdapter = {
  category: "cricket",
  provider: "cricapi",
  describe(metadata) {
    const cricket = metadata as CricketOracleMetadata;
    return `${cricket.selectedTeam} winner market for ${cricket.matchId}`;
  },
  validate(metadata) {
    if (metadata.category !== "cricket") return ["Cricket provider received non-cricket metadata."];
    const cricket = metadata as CricketOracleMetadata;
    return [
      ...validateCommonMetadata(metadata),
      ...(!cricket.matchId ? ["Match ID is required."] : []),
      ...(!cricket.teamA || !cricket.teamB ? ["Both teams are required."] : []),
      ...(!cricket.selectedTeam ? ["Selected YES team is required."] : [])
    ];
  },
  async evaluate(metadata) {
    if (metadata.category !== "cricket") {
      throw new OracleProviderError("Cricket adapter can only evaluate cricket metadata.", "INVALID_CATEGORY");
    }

    const cricket = metadata as CricketOracleMetadata;
    const apiKey = process.env.CRICAPI_KEY;
    if (!apiKey) {
      throw new OracleProviderError("CRICAPI_KEY is not configured.", "MISSING_PROVIDER_SECRET");
    }

    const url = `https://api.cricapi.com/v1/match_info?apikey=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(cricket.matchId)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new OracleProviderError(`CricAPI request failed with ${response.status}.`, "PROVIDER_HTTP_ERROR");
    }

    const payload = await response.json() as {
      status?: string;
      data?: {
        status?: string;
        matchEnded?: boolean;
        matchStarted?: boolean;
        matchWinner?: string;
        name?: string;
      };
    };
    const match = payload.data;
    if (!match?.matchEnded || !match.matchWinner) {
      throw new OracleProviderError("Cricket match is not completed or winner is unavailable.", "MARKET_NOT_SETTLED");
    }

    const outcome = resolveCricketWinnerOutcome(cricket, match.matchWinner);
    return {
      ...outcome,
      provider: "cricapi",
      externalId: cricket.matchId,
      settlementPrice: null,
      payloadHash: hashOraclePayload(payload),
      observedAt: new Date().toISOString(),
      payloadPreview: {
        name: match.name,
        status: match.status,
        matchWinner: match.matchWinner
      }
    };
  }
};
