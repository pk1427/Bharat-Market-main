import type { PrismaClient } from "@prisma/client";
import { decodeEventLog } from "viem";
import type { Address, PublicClient } from "viem";

import { getBlockTimestamp } from "@/backend/indexer/blocks";
import {
  getFromBlockHint,
  INDEXER_BATCH_SIZE,
  INDEXER_CONFIRMATIONS,
  INDEXER_LOG_BLOCK_RANGE,
  INDEXER_LOG_REQUEST_DELAY_MS,
  INDEXER_MAX_RETRIES,
  INITIAL_POOL_LIQUIDITY
} from "@/backend/indexer/config";
import { getCursorStartBlock, setCursorBlock } from "@/backend/indexer/cursors";
import {
  applyAddLiquidity,
  applyBuyNo,
  applyBuyYes,
  applyRemoveLiquidity,
  getProbabilities
} from "@/backend/indexer/math";
import { chainlinkFunctionsOracleAbi, marketAbi, marketFactoryAbi, outcomeTokenAbi } from "@/lib/abis";
import { decodeOracleMetadata, summarizeOracleMetadata } from "@/lib/oracle-metadata";

type RequiredAddresses = {
  marketFactory: Address;
  chainlinkOracle?: Address | null;
};

export async function syncProtocolIndexer(params: {
  prisma: PrismaClient;
  publicClient: PublicClient;
  addresses: RequiredAddresses;
}) {
  const latestBlock = await params.publicClient.getBlockNumber();
  const safeHead =
    latestBlock > BigInt(INDEXER_CONFIRMATIONS)
      ? latestBlock - BigInt(INDEXER_CONFIRMATIONS)
      : latestBlock;
  const floorBlock = getFromBlockHint() ?? getRecentLookbackBlock(safeHead);

  if (safeHead < floorBlock) {
    return {
      indexedThrough: safeHead.toString()
    };
  }

  await bootstrapFactoryMarkets(params.prisma, params.publicClient, params.addresses.marketFactory, floorBlock, safeHead);
  let markets = await params.prisma.market.findMany({
    select: {
      id: true,
      marketAddress: true,
      createdBlock: true
    }
  });

  for (const market of markets) {
    await hydrateMarketChainState(
      params.prisma,
      params.publicClient,
      market.id,
      market.marketAddress as Address
    );

    await syncMarketEvents(
      params.prisma,
      params.publicClient,
      market.id,
      market.marketAddress as Address,
      maxBigInt(floorBlock, BigInt(market.createdBlock)),
      safeHead
    );
  }

  await syncFactoryEvents(params.prisma, params.publicClient, params.addresses.marketFactory, floorBlock, safeHead);
  if (params.addresses.chainlinkOracle) {
    await syncOracleEvents(
      params.prisma,
      params.publicClient,
      params.addresses.chainlinkOracle,
      floorBlock,
      safeHead
    );
  }

  markets = await params.prisma.market.findMany({
    select: {
      id: true,
      marketAddress: true,
      createdBlock: true
    }
  });

  return {
    indexedThrough: safeHead.toString(),
    marketsIndexed: markets.length
  };
}

export async function syncSingleMarketIndexer(params: {
  prisma: PrismaClient;
  publicClient: PublicClient;
  marketAddress: Address;
  floorBlock: bigint;
  safeHead: bigint;
  createdBlockHint?: bigint;
}) {
  const createdBlock =
    params.createdBlockHint ??
    (await resolveCreatedBlock(
      params.prisma,
      params.publicClient,
      params.marketAddress,
      params.floorBlock,
      params.safeHead
    ));

  await upsertIndexedMarket(params.prisma, params.publicClient, {
    marketAddress: params.marketAddress,
    question: null,
    creator: null,
    createdAt: await getBlockTimestamp(params.publicClient, createdBlock),
    createdBlock,
    createdTxHash: null,
    endTime: null
  });

  const market = await params.prisma.market.findUniqueOrThrow({
    where: {
      marketAddress: params.marketAddress.toLowerCase()
    },
    select: {
      id: true,
      createdBlock: true,
      createdTxHash: true
    }
  });

  await hydrateMarketChainState(params.prisma, params.publicClient, market.id, params.marketAddress);

  await syncMarketEvents(
    params.prisma,
    params.publicClient,
    market.id,
    params.marketAddress,
    maxBigInt(params.floorBlock, BigInt(market.createdBlock)),
    params.safeHead
  );

  return {
    indexedThrough: params.safeHead.toString(),
    marketAddress: params.marketAddress
  };
}

export async function syncCreatedMarketFromTransaction(params: {
  prisma: PrismaClient;
  publicClient: PublicClient;
  marketFactory: Address;
  txHash: `0x${string}`;
}) {
  const receipt = await params.publicClient.getTransactionReceipt({
    hash: params.txHash
  });

  if (receipt.status !== "success") {
    throw new Error("Market creation transaction did not succeed.");
  }

  const createdLog = receipt.logs
    .filter((log) => log.address.toLowerCase() === params.marketFactory.toLowerCase())
    .map((log) => {
      try {
        return {
          raw: log,
          decoded: decodeEventLog({
            abi: marketFactoryAbi,
            data: log.data,
            topics: log.topics
          })
        };
      } catch {
        return null;
      }
    })
    .find((entry) => entry?.decoded.eventName === "MarketCreated");

  if (!createdLog) {
    throw new Error("No MarketCreated event found in transaction receipt.");
  }

  const args = createdLog.decoded.args as {
    market?: Address;
    creator?: Address;
    question?: string;
    endTime?: bigint;
  };
  const marketAddress = args.market;

  if (!marketAddress || args.question === undefined || args.endTime === undefined) {
    throw new Error("MarketCreated event is missing required fields.");
  }

  const createdAt = await getBlockTimestamp(params.publicClient, receipt.blockNumber);
  await upsertIndexedMarket(params.prisma, params.publicClient, {
    marketAddress,
    question: args.question,
    creator: args.creator?.toLowerCase() ?? null,
    createdAt,
    createdBlock: receipt.blockNumber,
    createdTxHash: params.txHash,
    endTime: new Date(Number(args.endTime) * 1000)
  });

  const market = await params.prisma.market.findUniqueOrThrow({
    where: {
      marketAddress: marketAddress.toLowerCase()
    },
    select: {
      id: true
    }
  });

  await hydrateMarketChainState(params.prisma, params.publicClient, market.id, marketAddress);
  await syncMarketEvents(
    params.prisma,
    params.publicClient,
    market.id,
    marketAddress,
    receipt.blockNumber,
    receipt.blockNumber
  );

  return {
    status: "market_synced" as const,
    marketAddress,
    txHash: params.txHash,
    indexedThrough: receipt.blockNumber.toString()
  };
}

async function bootstrapFactoryMarkets(
  prisma: PrismaClient,
  publicClient: PublicClient,
  marketFactory: Address,
  floorBlock: bigint,
  safeHead: bigint
) {
  const marketAddresses = await publicClient.readContract({
    address: marketFactory,
    abi: marketFactoryAbi,
    functionName: "getAllMarkets"
  });

  if (!marketAddresses.length) {
    return;
  }

  const existingMarkets = await prisma.market.findMany({
    where: {
      marketAddress: {
        in: marketAddresses.map((address) => address.toLowerCase())
      }
    },
    select: {
      marketAddress: true,
      question: true,
      creator: true,
      createdAt: true,
      createdBlock: true,
      createdTxHash: true,
      endTime: true
    }
  });
  const existingByAddress = new Map(
    existingMarkets.map((market) => [market.marketAddress, market] as const)
  );

  for (const marketAddress of marketAddresses) {
    const existing = existingByAddress.get(marketAddress.toLowerCase());
    const createdBlock =
      existing?.createdBlock && BigInt(existing.createdBlock) >= floorBlock
        ? BigInt(existing.createdBlock)
        : await findContractDeploymentBlock(publicClient, marketAddress, floorBlock, safeHead);
    const createdAt =
      existing?.createdAt && existing?.createdBlock && BigInt(existing.createdBlock) === createdBlock
        ? existing.createdAt
        : await getBlockTimestamp(publicClient, createdBlock);

    await upsertIndexedMarket(prisma, publicClient, {
      marketAddress,
      question: existing?.question ?? null,
      creator: existing?.creator ?? null,
      createdAt,
      createdBlock,
      createdTxHash: existing?.createdTxHash ?? null,
      endTime: existing?.endTime ?? null
    });
  }
}

async function syncFactoryEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  marketFactory: Address,
  floorBlock: bigint,
  safeHead: bigint
) {
  const cursorName = "factory";
  let fromBlock = await getCursorStartBlock(prisma, cursorName, floorBlock);

  while (fromBlock <= safeHead) {
    const toBlock = minBigInt(fromBlock + getEffectiveLogBatchSize() - 1n, safeHead);
    const logs = await getLogsResilient(publicClient, {
      address: marketFactory,
      event: marketFactoryAbi[0],
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const marketAddress = log.args.market;
      const question = log.args.question;
      const endTime = log.args.endTime;
      if (!marketAddress || question === undefined || endTime === undefined || log.blockNumber === null) {
        continue;
      }

      const timestamp = await getBlockTimestamp(publicClient, log.blockNumber);
      await upsertIndexedMarket(prisma, publicClient, {
        marketAddress,
        question,
        creator: log.args.creator?.toLowerCase() ?? null,
        createdAt: timestamp,
        createdBlock: log.blockNumber,
        createdTxHash: log.transactionHash,
        endTime: new Date(Number(endTime) * 1000)
      });

      const market = await prisma.market.findUniqueOrThrow({
        where: {
          marketAddress: marketAddress.toLowerCase()
        }
      });

      await prisma.marketSnapshot.upsert({
        where: {
          eventKey: eventKey(log.transactionHash, log.logIndex)
        },
        update: {},
        create: {
          eventKey: eventKey(log.transactionHash, log.logIndex),
          marketId: market.id,
          timestamp,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          yesProbability: 500_000_000_000_000_000n,
          noProbability: 500_000_000_000_000_000n,
          yesPool: INITIAL_POOL_LIQUIDITY,
          noPool: INITIAL_POOL_LIQUIDITY,
          liquidity: INITIAL_POOL_LIQUIDITY * 2n,
          volume: 0n
        }
      });
    }

    await setCursorBlock(prisma, cursorName, toBlock);
    console.log(`[indexer] ${cursorName} -> ${toBlock.toString()}`);
    fromBlock = toBlock + 1n;
  }
}

async function upsertIndexedMarket(
  prisma: PrismaClient,
  publicClient: PublicClient,
  input: {
    marketAddress: Address;
    question: string | null;
    creator: string | null;
    createdAt: Date;
    createdBlock: bigint;
    createdTxHash: string | null;
    endTime: Date | null;
  }
) {
  const [oracleType, oracleQuery, yesToken, noToken, lpToken, owner, chainEndTime] = await Promise.all([
    publicClient.readContract({
      address: input.marketAddress,
      abi: marketAbi,
      functionName: "oracleType"
    }),
    publicClient.readContract({
      address: input.marketAddress,
      abi: marketAbi,
      functionName: "oracleQuery"
    }),
    publicClient.readContract({
      address: input.marketAddress,
      abi: marketAbi,
      functionName: "yesToken"
    }),
    publicClient.readContract({
      address: input.marketAddress,
      abi: marketAbi,
      functionName: "noToken"
    }),
    publicClient.readContract({
      address: input.marketAddress,
      abi: marketAbi,
      functionName: "lpToken"
    }),
    publicClient.readContract({
      address: input.marketAddress,
      abi: marketAbi,
      functionName: "owner"
    }),
    publicClient.readContract({
      address: input.marketAddress,
      abi: marketAbi,
      functionName: "endTime"
    })
  ]);

  const inferredQuestion =
    input.question ??
    normalizeQuestionFromTokenName(
      await publicClient.readContract({
        address: yesToken,
        abi: outcomeTokenAbi,
        functionName: "name"
      })
    );
  const decodedOracleMetadata = decodeOracleMetadata(oracleQuery);
  const oracleTransparency = summarizeOracleMetadata(decodedOracleMetadata);

  const market = await prisma.market.upsert({
    where: {
      marketAddress: input.marketAddress.toLowerCase()
    },
    update: {
      question: inferredQuestion,
      oracleType,
      oracleQuery,
      oracleMetadata: decodedOracleMetadata ?? undefined,
      oracleProvider: oracleTransparency?.provider ?? undefined,
      oracleMarketType: oracleTransparency?.marketType ?? undefined,
      oracleExternalId: oracleTransparency?.externalId ?? undefined,
      settlementRule: oracleTransparency?.settlementRule ?? undefined,
      verificationSource: oracleTransparency?.verificationSource ?? undefined,
      fallbackSource: oracleTransparency?.fallbackSource ?? undefined,
      creator: input.creator ?? owner.toLowerCase(),
      endTime: input.endTime ?? new Date(Number(chainEndTime) * 1000),
      createdAt: input.createdAt,
      createdBlock: input.createdBlock,
      createdTxHash: input.createdTxHash ?? undefined,
      yesToken: yesToken.toLowerCase(),
      noToken: noToken.toLowerCase(),
      lpToken: lpToken.toLowerCase()
    },
    create: {
      marketAddress: input.marketAddress.toLowerCase(),
      question: inferredQuestion,
      oracleType,
      oracleQuery,
      oracleMetadata: decodedOracleMetadata ?? undefined,
      oracleProvider: oracleTransparency?.provider ?? null,
      oracleMarketType: oracleTransparency?.marketType ?? null,
      oracleExternalId: oracleTransparency?.externalId ?? null,
      settlementRule: oracleTransparency?.settlementRule ?? null,
      verificationSource: oracleTransparency?.verificationSource ?? null,
      fallbackSource: oracleTransparency?.fallbackSource ?? null,
      creator: input.creator ?? owner.toLowerCase(),
      createdAt: input.createdAt,
      createdBlock: input.createdBlock,
      createdTxHash: input.createdTxHash,
      endTime: input.endTime ?? new Date(Number(chainEndTime) * 1000),
      yesToken: yesToken.toLowerCase(),
      noToken: noToken.toLowerCase(),
      lpToken: lpToken.toLowerCase(),
      yesPool: INITIAL_POOL_LIQUIDITY,
      noPool: INITIAL_POOL_LIQUIDITY,
      totalLiquidity: INITIAL_POOL_LIQUIDITY * 2n,
      latestYesProbability: 500_000_000_000_000_000n,
      latestNoProbability: 500_000_000_000_000_000n
    }
  });

  await prisma.marketSnapshot.upsert({
    where: {
      eventKey: `bootstrap:${input.marketAddress.toLowerCase()}`
    },
    update: {},
    create: {
      eventKey: `bootstrap:${input.marketAddress.toLowerCase()}`,
      marketId: market.id,
      timestamp: input.createdAt,
      blockNumber: input.createdBlock,
      txHash: input.createdTxHash ?? ZERO_HASH,
      logIndex: -1,
      yesProbability: 500_000_000_000_000_000n,
      noProbability: 500_000_000_000_000_000n,
      yesPool: INITIAL_POOL_LIQUIDITY,
      noPool: INITIAL_POOL_LIQUIDITY,
      liquidity: INITIAL_POOL_LIQUIDITY * 2n,
      volume: 0n
    }
  });
}

async function hydrateMarketChainState(
  prisma: PrismaClient,
  publicClient: PublicClient,
  marketId: string,
  marketAddress: Address
) {
  const [resolved, outcome, yesPool, noPool] = await Promise.all([
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "resolved"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "winningOutcome"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "yesPool"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "noPool"
    })
  ]);
  const { yesProbability, noProbability } = getProbabilities(yesPool, noPool);

  await prisma.market.update({
    where: {
      id: marketId
    },
    data: {
      resolved,
      outcome: resolved
        ? Number(outcome) === 1
          ? "YES"
          : Number(outcome) === 2
            ? "NO"
            : "PENDING"
        : "PENDING",
      yesPool,
      noPool,
      totalLiquidity: yesPool + noPool,
      latestYesProbability: yesProbability,
      latestNoProbability: noProbability,
      lastActivityAt: resolved ? new Date() : undefined
    }
  });
}

async function syncOracleEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  oracleAddress: Address,
  floorBlock: bigint,
  safeHead: bigint
) {
  const cursorName = "oracle";
  let fromBlock = await getCursorStartBlock(prisma, cursorName, floorBlock);

  while (fromBlock <= safeHead) {
    const toBlock = minBigInt(fromBlock + getEffectiveLogBatchSize() - 1n, safeHead);
    const rawLogs = await getLogsResilient(publicClient, {
      address: oracleAddress,
      fromBlock,
      toBlock
    });
    const logs = decodeLogs(chainlinkFunctionsOracleAbi, rawLogs) as any[];

    for (const log of logs) {
      const args = (log.args ?? {}) as Record<string, any>;
      const marketAddress = args.market as Address | undefined;
      if (!marketAddress || log.blockNumber === null) {
        continue;
      }

      const market = await prisma.market.findUnique({
        where: { marketAddress: marketAddress.toLowerCase() }
      });
      if (!market) {
        continue;
      }

      await prisma.oracleEvent.upsert({
        where: { eventKey: eventKey(log.transactionHash, log.logIndex) },
        update: {},
        create: {
          eventKey: eventKey(log.transactionHash, log.logIndex),
          marketId: market.id,
          requestId: (args.requestId as string | null | undefined) ?? null,
          type:
            log.eventName === "ResolutionRequested"
              ? "REQUESTED"
              : log.eventName === "ResolutionFulfilled"
                ? "FULFILLED"
                : "FAILED",
          oracleType: (args.oracleType as string | null | undefined) ?? null,
          oracleQuery: (args.oracleQuery as string | null | undefined) ?? null,
          provider: (args.provider as string | null | undefined) || market.oracleProvider || null,
          externalId: (args.externalId as string | null | undefined) || market.oracleExternalId || null,
          settlementPrice: args.settlementPriceE8 !== undefined ? BigInt(args.settlementPriceE8) : null,
          observedAt: args.settlementPriceE8 !== undefined ? await getBlockTimestamp(publicClient, log.blockNumber) : null,
          summary:
            args.settlementPriceE8 !== undefined
              ? `${(args.provider as string | undefined) || market.oracleProvider || "oracle"} settlement price ${formatPriceE8(BigInt(args.settlementPriceE8))} USD; outcome ${Number(args.outcome) === 1 ? "YES" : Number(args.outcome) === 2 ? "NO" : "PENDING"}`
              : null,
          outcome: args.outcome !== undefined ? Number(args.outcome) : null,
          errorData: (args.errorData as string | null | undefined) ?? null,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          timestamp: await getBlockTimestamp(publicClient, log.blockNumber)
        }
      });

      if (log.eventName === "ResolutionFulfilled") {
        const timestamp = await getBlockTimestamp(publicClient, log.blockNumber);
        const provider = (args.provider as string | null | undefined) || market.oracleProvider || null;
        const externalId = (args.externalId as string | null | undefined) || market.oracleExternalId || null;
        const settlementPrice = args.settlementPriceE8 !== undefined ? BigInt(args.settlementPriceE8) : null;
        const outcome = args.outcome !== undefined ? Number(args.outcome) : null;
        const summary =
          settlementPrice && provider
            ? `${provider} settlement price ${formatPriceE8(settlementPrice)} USD; outcome ${outcome === 1 ? "YES" : outcome === 2 ? "NO" : "PENDING"}`
            : null;

        await prisma.market.update({
          where: { id: market.id },
          data: {
            settlementProvider: provider,
            settlementPrice,
            settlementObservedAt: settlementPrice ? timestamp : null,
            settlementSummary: summary,
            lastActivityAt: timestamp
          }
        });

        const existingAudit = await prisma.oracleResolutionAudit.findFirst({
          where: {
            marketId: market.id,
            fulfillmentTxHash: log.transactionHash
          }
        });

        if (!existingAudit) {
          await prisma.oracleResolutionAudit.create({
            data: {
              marketId: market.id,
              provider: provider || "unknown",
              marketType: market.oracleMarketType || "unknown",
              externalId,
              settlementRule: market.settlementRule || "Oracle settlement",
              verificationSource: market.verificationSource || "Chainlink Functions",
              fallbackSource: market.fallbackSource,
              status: "FULFILLED",
              normalizedOutcome: outcome,
              settlementPrice,
              payloadPreview: settlementPrice
                ? {
                    settlementPriceE8: settlementPrice.toString(),
                    settlementPriceUsd: formatPriceE8(settlementPrice)
                  }
                : undefined,
              fulfillmentTxHash: log.transactionHash,
              chainlinkRequestId: (args.requestId as string | null | undefined) ?? null,
              requestedAt: timestamp,
              completedAt: timestamp
            }
          });
        }
      }
    }

    await setCursorBlock(prisma, cursorName, toBlock);
    console.log(`[indexer] ${cursorName} -> ${toBlock.toString()}`);
    fromBlock = toBlock + 1n;
  }
}

function formatPriceE8(value: bigint) {
  const whole = value / 100_000_000n;
  const fraction = value % 100_000_000n;
  const trimmedFraction = fraction.toString().padStart(8, "0").replace(/0+$/, "");
  return trimmedFraction ? `${whole.toString()}.${trimmedFraction}` : whole.toString();
}

async function syncMarketEvents(
  prisma: PrismaClient,
  publicClient: PublicClient,
  marketId: string,
  marketAddress: Address,
  floorBlock: bigint,
  safeHead: bigint
) {
  const cursorName = `market:${marketAddress.toLowerCase()}`;
  let fromBlock = await getCursorStartBlock(prisma, cursorName, floorBlock);

  while (fromBlock <= safeHead) {
    const toBlock = minBigInt(fromBlock + getEffectiveLogBatchSize() - 1n, safeHead);
    const rawLogs = await getLogsResilient(publicClient, {
      address: marketAddress,
      fromBlock,
      toBlock
    });
    const decodedLogs = decodeLogs(marketAbi, rawLogs) as any[];

    const market = await prisma.market.findUniqueOrThrow({
      where: { id: marketId }
    });

    type IndexedLog = { kind: "buy" | "add" | "remove" | "redeem" | "resolve"; log: any };

    const allLogs: IndexedLog[] = [];
    for (const log of decodedLogs) {
      switch (log.eventName) {
        case "Bought":
          allLogs.push({ kind: "buy", log });
          break;
        case "LiquidityAdded":
          allLogs.push({ kind: "add", log });
          break;
        case "LiquidityRemoved":
          allLogs.push({ kind: "remove", log });
          break;
        case "Redeemed":
          allLogs.push({ kind: "redeem", log });
          break;
        case "Resolved":
          allLogs.push({ kind: "resolve", log });
          break;
        default:
          break;
      }
    }

    allLogs.sort((left, right) => {
      const leftBlock = left.log.blockNumber ?? 0n;
      const rightBlock = right.log.blockNumber ?? 0n;
      if (leftBlock === rightBlock) {
        return left.log.logIndex - right.log.logIndex;
      }

      return leftBlock < rightBlock ? -1 : 1;
    });

    const baseSnapshot = await prisma.marketSnapshot.findFirst({
      where: {
        marketId,
        blockNumber: {
          lt: fromBlock
        }
      },
      orderBy: [{ blockNumber: "desc" }, { logIndex: "desc" }]
    });

    let state = baseSnapshot
      ? {
          yesPool: baseSnapshot.yesPool,
          noPool: baseSnapshot.noPool,
          volume: baseSnapshot.volume
        }
      : {
          yesPool: INITIAL_POOL_LIQUIDITY,
          noPool: INITIAL_POOL_LIQUIDITY,
          volume: 0n
        };

    for (const entry of allLogs) {
      if (entry.log.blockNumber === null) {
        continue;
      }

      const timestamp = await getBlockTimestamp(publicClient, entry.log.blockNumber);
      const snapshotKey = eventKey(entry.log.transactionHash, entry.log.logIndex);
      const args = (entry.log.args ?? {}) as Record<string, any>;

      if (entry.kind === "buy") {
        const trader = args.user as Address | undefined;
        const amountIn = args.amountIn as bigint | undefined;
        const sharesMinted = args.sharesMinted as bigint | undefined;
        if (!trader || amountIn === undefined || sharesMinted === undefined) {
          continue;
        }

        const isYes = Boolean(args.isYes);
        state = isYes ? applyBuyYes(state, amountIn) : applyBuyNo(state, amountIn);
        const { yesProbability, noProbability } = getProbabilities(state.yesPool, state.noPool);
        const side = isYes ? "YES" : "NO";
        const probability = isYes ? yesProbability : noProbability;

        await prisma.trade.upsert({
          where: { eventKey: snapshotKey },
          update: {},
          create: {
            eventKey: snapshotKey,
            marketId,
            trader: trader.toLowerCase(),
            side,
            collateralAmount: amountIn,
            sharesReceived: sharesMinted,
            probability,
            txHash: entry.log.transactionHash,
            blockNumber: entry.log.blockNumber,
            logIndex: entry.log.logIndex,
            timestamp
          }
        });

        await prisma.walletPosition.upsert({
          where: {
            wallet_marketId_side: {
              wallet: trader.toLowerCase(),
              marketId,
              side
            }
          },
          update: {
            shares: { increment: sharesMinted },
            collateralIn: { increment: amountIn },
            lastTradeAt: timestamp
          },
          create: {
            wallet: trader.toLowerCase(),
            marketId,
            side,
            shares: sharesMinted,
            collateralIn: amountIn,
            averageEntryPrice: sharesMinted > 0n ? (amountIn * 1_000_000n) / sharesMinted : null,
            lastTradeAt: timestamp
          }
        });

        await prisma.marketParticipant.upsert({
          where: {
            marketId_wallet: {
              marketId,
              wallet: trader.toLowerCase()
            }
          },
          update: {},
          create: {
            marketId,
            wallet: trader.toLowerCase(),
            firstTradeAt: timestamp
          }
        });

        await prisma.market.update({
          where: { id: marketId },
          data: {
            yesPool: state.yesPool,
            noPool: state.noPool,
            totalVolume: state.volume,
            totalLiquidity: state.yesPool + state.noPool,
            latestYesProbability: yesProbability,
            latestNoProbability: noProbability,
            traderCount: await prisma.marketParticipant.count({
              where: { marketId }
            }),
            lastActivityAt: timestamp
          }
        });

        await prisma.walletPosition.update({
          where: {
            wallet_marketId_side: {
              wallet: trader.toLowerCase(),
              marketId,
              side
            }
          },
          data: {
            averageEntryPrice: await calculateAverageEntryPrice(prisma, trader.toLowerCase(), marketId, side)
          }
        });

        await upsertSnapshot(prisma, {
          eventKey: snapshotKey,
          marketId,
          timestamp,
          blockNumber: entry.log.blockNumber,
          txHash: entry.log.transactionHash,
          logIndex: entry.log.logIndex,
          yesPool: state.yesPool,
          noPool: state.noPool,
          volume: state.volume
        });
      }

      if (entry.kind === "add" || entry.kind === "remove") {
        const provider = args.provider as Address | undefined;
        const amount = args.amount as bigint | undefined;
        if (!provider || amount === undefined) {
          continue;
        }

        state = entry.kind === "add" ? applyAddLiquidity(state, amount) : applyRemoveLiquidity(state, amount);
        const { yesProbability, noProbability } = getProbabilities(state.yesPool, state.noPool);
        const lpTokens = amount;

        await prisma.liquidityEvent.upsert({
          where: { eventKey: snapshotKey },
          update: {},
          create: {
            eventKey: snapshotKey,
            marketId,
            provider: provider.toLowerCase(),
            type: entry.kind === "add" ? "ADD" : "REMOVE",
            collateralAmount: amount,
            lpTokens,
            txHash: entry.log.transactionHash,
            blockNumber: entry.log.blockNumber,
            logIndex: entry.log.logIndex,
            timestamp
          }
        });

        await prisma.walletLiquidityPosition.upsert({
          where: {
            wallet_marketId: {
              wallet: provider.toLowerCase(),
              marketId
            }
          },
          update: {
            lpTokens: entry.kind === "add" ? { increment: lpTokens } : { decrement: lpTokens },
            netCollateral:
              entry.kind === "add" ? { increment: amount } : { decrement: amount },
            lastActivityAt: timestamp
          },
          create: {
            wallet: provider.toLowerCase(),
            marketId,
            lpTokens: entry.kind === "add" ? lpTokens : 0n,
            netCollateral: entry.kind === "add" ? amount : 0n,
            lastActivityAt: timestamp
          }
        });

        await prisma.market.update({
          where: { id: marketId },
          data: {
            yesPool: state.yesPool,
            noPool: state.noPool,
            totalLiquidity: state.yesPool + state.noPool,
            latestYesProbability: yesProbability,
            latestNoProbability: noProbability,
            lastActivityAt: timestamp
          }
        });

        await upsertSnapshot(prisma, {
          eventKey: snapshotKey,
          marketId,
          timestamp,
          blockNumber: entry.log.blockNumber,
          txHash: entry.log.transactionHash,
          logIndex: entry.log.logIndex,
          yesPool: state.yesPool,
          noPool: state.noPool,
          volume: state.volume
        });
      }

      if (entry.kind === "redeem") {
        const redeemer = args.user as Address | undefined;
        const payout = args.payout as bigint | undefined;
        if (!redeemer || payout === undefined) {
          continue;
        }

        await prisma.redemption.upsert({
          where: { eventKey: snapshotKey },
          update: {},
          create: {
            eventKey: snapshotKey,
            marketId,
            redeemer: redeemer.toLowerCase(),
            payoutAmount: payout,
            txHash: entry.log.transactionHash,
            blockNumber: entry.log.blockNumber,
            logIndex: entry.log.logIndex,
            timestamp
          }
        });
      }

      if (entry.kind === "resolve") {
        const outcome = args.outcome as number | bigint | undefined;
        if (outcome === undefined) {
          continue;
        }
        await prisma.market.update({
          where: { id: marketId },
          data: {
            resolved: true,
            outcome:
              Number(outcome) === 1
                ? "YES"
                : Number(outcome) === 2
                  ? "NO"
                  : "PENDING",
            lastActivityAt: timestamp
          }
        });
      }
    }

    await setCursorBlock(prisma, cursorName, toBlock);
    console.log(`[indexer] ${cursorName} -> ${toBlock.toString()}`);
    fromBlock = toBlock + 1n;
  }
}

async function upsertSnapshot(
  prisma: PrismaClient,
  params: {
    eventKey: string;
    marketId: string;
    timestamp: Date;
    blockNumber: bigint;
    txHash: string;
    logIndex: number;
    yesPool: bigint;
    noPool: bigint;
    volume: bigint;
  }
) {
  const { yesProbability, noProbability } = getProbabilities(params.yesPool, params.noPool);
  await prisma.marketSnapshot.upsert({
    where: { eventKey: params.eventKey },
    update: {},
    create: {
      eventKey: params.eventKey,
      marketId: params.marketId,
      timestamp: params.timestamp,
      blockNumber: params.blockNumber,
      txHash: params.txHash,
      logIndex: params.logIndex,
      yesProbability,
      noProbability,
      yesPool: params.yesPool,
      noPool: params.noPool,
      liquidity: params.yesPool + params.noPool,
      volume: params.volume
    }
  });
}

async function calculateAverageEntryPrice(
  prisma: PrismaClient,
  wallet: string,
  marketId: string,
  side: "YES" | "NO"
) {
  const trades = await prisma.trade.findMany({
    where: {
      marketId,
      trader: wallet,
      side
    },
    select: {
      collateralAmount: true,
      sharesReceived: true
    }
  });

  const totals = trades.reduce(
    (
      accumulator: { collateral: bigint; shares: bigint },
      trade: { collateralAmount: bigint | number; sharesReceived: bigint | number }
    ) => ({
      collateral: accumulator.collateral + BigInt(trade.collateralAmount),
      shares: accumulator.shares + BigInt(trade.sharesReceived)
    }),
    { collateral: 0n, shares: 0n }
  );

  return totals.shares > 0n ? (totals.collateral * 1_000_000n) / totals.shares : null;
}

function eventKey(txHash: `0x${string}`, logIndex: number) {
  return `${txHash}-${logIndex}`;
}

function minBigInt(left: bigint, right: bigint) {
  return left < right ? left : right;
}

function getEffectiveLogBatchSize() {
  return INDEXER_LOG_BLOCK_RANGE > 0n && INDEXER_LOG_BLOCK_RANGE < INDEXER_BATCH_SIZE
    ? INDEXER_LOG_BLOCK_RANGE
    : INDEXER_BATCH_SIZE;
}

function maxBigInt(left: bigint, right: bigint) {
  return left > right ? left : right;
}

function getRecentLookbackBlock(latestBlock: bigint, lookbackWindow = 120_000n) {
  return latestBlock > lookbackWindow ? latestBlock - lookbackWindow : 0n;
}

async function resolveCreatedBlock(
  prisma: PrismaClient,
  publicClient: PublicClient,
  marketAddress: Address,
  floorBlock: bigint,
  safeHead: bigint
) {
  const existing = await prisma.market.findUnique({
    where: {
      marketAddress: marketAddress.toLowerCase()
    },
    select: {
      createdBlock: true,
      createdTxHash: true
    }
  });

  if (existing?.createdTxHash && existing.createdTxHash !== ZERO_HASH) {
    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: existing.createdTxHash as `0x${string}`
      });
      if (receipt.blockNumber) {
        return receipt.blockNumber;
      }
    } catch {
      // Fall through to contract-code discovery if the receipt provider is temporarily unavailable.
    }
  }

  if (existing?.createdBlock && BigInt(existing.createdBlock) > floorBlock) {
    return BigInt(existing.createdBlock);
  }

  if (existing?.createdBlock && BigInt(existing.createdBlock) === floorBlock) {
    return BigInt(existing.createdBlock);
  }

  return findContractDeploymentBlock(publicClient, marketAddress, floorBlock, safeHead);
}

async function findContractDeploymentBlock(
  publicClient: PublicClient,
  marketAddress: Address,
  floorBlock: bigint,
  safeHead: bigint
) {
  const latestCode = await getCodeAtBlock(publicClient, marketAddress, safeHead);

  if (!latestCode || latestCode === "0x") {
    return floorBlock;
  }

  let low = floorBlock;
  let high = safeHead;

  while (low < high) {
    const mid = low + (high - low) / 2n;
    const code = await getCodeAtBlock(publicClient, marketAddress, mid);

    if (code && code !== "0x") {
      high = mid;
    } else {
      low = mid + 1n;
    }
  }

  return low;
}

async function getCodeAtBlock(publicClient: PublicClient, marketAddress: Address, blockNumber: bigint) {
  try {
    return await publicClient.getCode({
      address: marketAddress,
      blockNumber
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message} ${"details" in error ? String((error as { details?: unknown }).details ?? "") : ""}`
        : "";

    if (/requested resource not found|unable to complete request at this time/i.test(message)) {
      return null;
    }

    throw error;
  }
}

async function getLogsResilient(
  publicClient: PublicClient,
  params: {
    address: Address;
    event?: unknown;
    fromBlock?: bigint;
    toBlock?: bigint;
  },
  attempt = 0
): Promise<any[]> {
  try {
    if (attempt > 0) {
      await sleep(getRetryDelay(attempt));
    }

    return await publicClient.getLogs(params as Parameters<PublicClient["getLogs"]>[0]);
  } catch (error) {
    const details =
      error instanceof Error
        ? `${error.message} ${"details" in error ? String((error as { details?: unknown }).details ?? "") : ""}`
        : "";
    const fromBlock = params.fromBlock ?? 0n;
    const toBlock = params.toBlock ?? fromBlock;
    const isRangeLimited =
      /block range exceeds configured limit|query returned more than|up to a 10 block range|free tier plan/i.test(
        details
      );
    const isRateLimited = /too many requests|status:\s*429/i.test(details);

    if (fromBlock < toBlock && isRangeLimited) {
      const midpoint = fromBlock + (toBlock - fromBlock) / 2n;
      const left = await getLogsResilient(
        publicClient,
        {
          ...params,
          fromBlock,
          toBlock: midpoint
        },
        attempt + 1
      );
      const right = await getLogsResilient(
        publicClient,
        {
          ...params,
          fromBlock: midpoint + 1n,
          toBlock
        },
        attempt + 1
      );

      return [...left, ...right];
    }

    if (isRateLimited && attempt < INDEXER_MAX_RETRIES) {
      return getLogsResilient(publicClient, params, attempt + 1);
    }

    throw error;
  }
}

function getRetryDelay(attempt: number) {
  return INDEXER_LOG_REQUEST_DELAY_MS * Math.max(1, attempt * 2);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeQuestionFromTokenName(name: string) {
  if (name.startsWith("YES - ")) {
    return name.slice(6).trim();
  }

  return name.trim();
}

const ZERO_HASH = `0x${"0".repeat(64)}`;

function decodeLogs(abi: readonly unknown[], logs: Awaited<ReturnType<PublicClient["getLogs"]>>) {
  return logs.flatMap((log) => {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics
      });

      return [
        {
          ...log,
          eventName: decoded.eventName,
          args: decoded.args as Record<string, unknown>
        }
      ];
    } catch {
      return [];
    }
  });
}
