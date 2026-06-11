import { getAddress, type Address, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";

import { getPrismaClient } from "@/backend/db/client";
import { getIndexerPublicClient } from "@/backend/indexer/client";
import { evaluateOracleMetadata } from "@/backend/oracles/registry";
import { OracleProviderError } from "@/backend/oracles/types";
import { chainlinkFunctionsOracleAbi, marketAbi } from "@/lib/abis";
import { getRequiredAddresses } from "@/lib/contracts";
import { decodeOracleMetadata } from "@/lib/oracle-metadata";

const MAX_MARKETS_PER_RUN = 5;
const DEFAULT_RETRY_COOLDOWN_MS = 30 * 60 * 1000;

export async function runResolutionSync(reason: "manual" | "cron" | "loop" = "manual") {
  const prisma = getPrismaClient();
  const addresses = getRequiredAddresses();
  const workerKey = normalizePrivateKey(process.env.RESOLUTION_WORKER_PRIVATE_KEY || process.env.PRIVATE_KEY);

  if (!prisma) {
    throw new Error("DATABASE_URL is missing. Configure PostgreSQL before running the resolution worker.");
  }

  if (!addresses?.chainlinkOracle) {
    throw new Error("NEXT_PUBLIC_CHAINLINK_ORACLE_ADDRESS is missing.");
  }

  const markets = await prisma.market.findMany({
    where: {
      resolved: false,
      endTime: {
        lte: new Date()
      }
    },
    orderBy: {
      endTime: "asc"
    },
    take: MAX_MARKETS_PER_RUN
  });

  const publicClient = getIndexerPublicClient();
  const walletClient =
    workerKey && addresses.chainlinkOracle
      ? createWalletClient({
          account: privateKeyToAccount(workerKey),
          chain: polygonAmoy,
          transport: http(process.env.INDEXER_RPC_URL || process.env.NEXT_PUBLIC_AMOY_RPC_URL)
        })
      : null;

  const results = [];

  for (const market of markets) {
    const marketAddress = getAddress(market.marketAddress);
    const chainResolved = await publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "resolved"
    });

    if (chainResolved) {
      const outcome = await publicClient.readContract({
        address: marketAddress,
        abi: marketAbi,
        functionName: "winningOutcome"
      });
      await prisma.market.update({
        where: {
          id: market.id
        },
        data: {
          resolved: true,
          outcome: toMarketOutcome(Number(outcome)),
          lastActivityAt: new Date()
        }
      });
      results.push({
        market: market.marketAddress,
        status: "chain_resolved",
        outcome: toMarketOutcome(Number(outcome)),
        reason: "DB was stale; hydrated resolved state from chain."
      });
      continue;
    }

    const metadata = decodeOracleMetadata(market.oracleQuery);
    if (!metadata || (metadata.category !== "crypto" && metadata.category !== "cricket")) {
      results.push({
        market: market.marketAddress,
        status: "skipped",
        reason: "Not an auto-resolvable crypto or cricket market."
      });
      continue;
    }

    const pendingRequest = await publicClient.readContract({
      address: addresses.chainlinkOracle,
      abi: chainlinkFunctionsOracleAbi,
      functionName: "marketPendingRequest",
      args: [marketAddress]
    });

    if (pendingRequest !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      results.push({
        market: market.marketAddress,
        status: "pending",
        requestId: pendingRequest
      });
      continue;
    }

    const recentRequest = await prisma.oracleResolutionAudit.findFirst({
      where: {
        marketId: market.id,
        status: {
          in: ["REQUESTED", "FAILED"]
        },
        requestedAt: {
          gte: new Date(Date.now() - getRetryCooldownMs())
        }
      },
      orderBy: {
        requestedAt: "desc"
      }
    });

    if (recentRequest) {
      if (recentRequest.status === "FAILED") {
        results.push({
          market: market.marketAddress,
          status: "chainlink_failed",
          auditId: recentRequest.id,
          txHash: recentRequest.fulfillmentTxHash ?? recentRequest.requestTxHash,
          reason: recentRequest.error ?? "Recent Chainlink request failed; waiting before retrying."
        });
        continue;
      }

      results.push({
        market: market.marketAddress,
        status: "cooldown",
        auditId: recentRequest.id,
        txHash: recentRequest.requestTxHash,
        reason: "Recent Chainlink request exists; waiting before retrying."
      });
      continue;
    }

    try {
      const preview = await evaluateOracleMetadata(metadata);
      const audit = await prisma.oracleResolutionAudit.create({
        data: {
          marketId: market.id,
          provider: preview.provider,
          marketType: metadata.marketType,
          externalId: preview.externalId,
          settlementRule: metadata.settlementRule,
          verificationSource: metadata.verificationSource,
          fallbackSource: metadata.fallbackSource,
          status: walletClient ? "READY" : "READY_NO_WORKER_KEY",
          normalizedOutcome: preview.outcome,
          payloadHash: preview.payloadHash,
          payloadPreview: preview.payloadPreview as object,
          settlementPrice: preview.settlementPrice === null ? null : BigInt(Math.round(preview.settlementPrice * 100_000_000)),
          requestedAt: new Date(preview.observedAt)
        }
      });

      if (!walletClient) {
        results.push({
          market: market.marketAddress,
          status: "ready",
          auditId: audit.id,
          reason: "Set RESOLUTION_WORKER_PRIVATE_KEY to submit Chainlink resolution requests automatically."
        });
        continue;
      }

      const hash = await walletClient.writeContract({
        address: addresses.chainlinkOracle,
        abi: chainlinkFunctionsOracleAbi,
        functionName: "requestMarketResolution",
        args: [marketAddress]
      });

      await prisma.oracleResolutionAudit.update({
        where: {
          id: audit.id
        },
        data: {
          status: "REQUESTED",
          requestTxHash: hash
        }
      });

      results.push({
        market: market.marketAddress,
        status: "requested",
        txHash: hash
      });
    } catch (error) {
      if (isPendingProviderError(error)) {
        results.push({
          market: market.marketAddress,
          status: "provider_pending",
          reason: error instanceof Error ? error.message : "Provider data is not ready yet."
        });
        continue;
      }

      const message = error instanceof Error ? error.message : "Unknown oracle resolution error.";
      await prisma.oracleResolutionAudit.create({
        data: {
          marketId: market.id,
          provider: metadata.provider,
          marketType: metadata.marketType,
          externalId: metadata.externalId,
          settlementRule: metadata.settlementRule,
          verificationSource: metadata.verificationSource,
          fallbackSource: metadata.fallbackSource,
          status: "FAILED_PRECHECK",
          error: message
        }
      });

      results.push({
        market: market.marketAddress,
        status: "failed_precheck",
        error: message
      });
    }
  }

  return {
    status: "resolution_checked" as const,
    reason,
    checked: markets.length,
    results
  };
}

function normalizePrivateKey(value: string | undefined): `0x${string}` | null {
  if (!value) {
    return null;
  }

  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? (normalized as `0x${string}`) : null;
}

function getRetryCooldownMs() {
  const raw = Number(process.env.RESOLUTION_RETRY_COOLDOWN_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_RETRY_COOLDOWN_MS;
}

function toMarketOutcome(outcome: number) {
  return outcome === 1 ? "YES" : outcome === 2 ? "NO" : "PENDING";
}

function isPendingProviderError(error: unknown) {
  return error instanceof OracleProviderError && error.code === "MARKET_NOT_SETTLED";
}
