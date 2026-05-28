import { buildApiMeta } from "@/backend/api/response";
import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

import { getIndexedMarketActivity } from "@/backend/services/activity";
import { chainlinkFunctionsOracleAbi, marketAbi, marketFactoryAbi } from "@/lib/abis";
import { getRequiredAddresses } from "@/lib/contracts";
import { fetchMarketDetail } from "@/lib/market-data";
import {
  getCachedActivity,
  isFresh,
  setCachedActivity
} from "@/lib/server/market-cache";
import { getServerPublicClient } from "@/lib/server/public-client";
import type { ActivityItem } from "@/types/product";

const ACTIVITY_TTL_MS = 180_000;

async function resolveFromBlockHint() {
  const raw = process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK;
  if (raw) {
    try {
      return BigInt(raw);
    } catch {
      // fall through to runtime fallback
    }
  }

  const publicClient = getServerPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const lookbackWindow = 120_000n;
  return latestBlock > lookbackWindow ? latestBlock - lookbackWindow : 0n;
}

async function buildMarketActivitySnapshot(
  addresses: NonNullable<ReturnType<typeof getRequiredAddresses>>,
  marketAddress: `0x${string}`
) {
  const publicClient = getServerPublicClient();
  const fromBlock = await resolveFromBlockHint();
  const detail = await fetchMarketDetail(
    publicClient,
    addresses.marketFactory,
    marketAddress,
    addresses.usdc
  );

  const [buyLogs, addLogs, removeLogs, redeemedLogs, createdLogs, requestLogs, fulfilledLogs] =
    await Promise.all([
      publicClient.getLogs({
        address: marketAddress,
        event: marketAbi[0],
        fromBlock
      }),
      publicClient.getLogs({
        address: marketAddress,
        event: marketAbi[3],
        fromBlock
      }),
      publicClient.getLogs({
        address: marketAddress,
        event: marketAbi[4],
        fromBlock
      }),
      publicClient.getLogs({
        address: marketAddress,
        event: marketAbi[2],
        fromBlock
      }),
      publicClient.getLogs({
        address: addresses.marketFactory,
        event: marketFactoryAbi[0],
        args: { market: marketAddress },
        fromBlock
      }),
      addresses.chainlinkOracle
        ? publicClient.getLogs({
            address: addresses.chainlinkOracle,
            event: chainlinkFunctionsOracleAbi[0],
            args: { market: marketAddress },
            fromBlock
          })
        : Promise.resolve([]),
      addresses.chainlinkOracle
        ? publicClient.getLogs({
            address: addresses.chainlinkOracle,
            event: chainlinkFunctionsOracleAbi[1],
            args: { market: marketAddress },
            fromBlock
          })
        : Promise.resolve([])
    ]);

  const allLogs = [
    ...buyLogs,
    ...addLogs,
    ...removeLogs,
    ...redeemedLogs,
    ...createdLogs,
    ...requestLogs,
    ...fulfilledLogs
  ];
  const blockByItemId = new Map<string, number>(
    allLogs.map((log) => [`${log.transactionHash}-${log.logIndex}`, Number(log.blockNumber ?? 0n)])
  );

  const items: ActivityItem[] = [
    ...buyLogs.flatMap((log) => {
      const actor = log.args.user;
      const amount = log.args.amountIn;
      const shares = log.args.sharesMinted;
      if (!actor || amount === undefined || shares === undefined) {
        return [];
      }

      return [
        {
          id: `${log.transactionHash}-${log.logIndex}`,
          txHash: log.transactionHash,
          marketAddress,
          question: detail.question,
          actor,
          type: log.args.isYes ? "buy_yes" : "buy_no",
          amount,
          shares,
          timestamp: 0,
          whale: amount >= 100_000_000n
        } satisfies ActivityItem
      ];
    }),
    ...addLogs.flatMap((log) => {
      const actor = log.args.provider;
      const amount = log.args.amount;
      if (!actor || amount === undefined) {
        return [];
      }

      return [
        {
          id: `${log.transactionHash}-${log.logIndex}`,
          txHash: log.transactionHash,
          marketAddress,
          question: detail.question,
          actor,
          type: "add_liquidity",
          amount,
          timestamp: 0,
          whale: amount >= 250_000_000n
        } satisfies ActivityItem
      ];
    }),
    ...removeLogs.flatMap((log) => {
      const actor = log.args.provider;
      const amount = log.args.amount;
      if (!actor || amount === undefined) {
        return [];
      }

      return [
        {
          id: `${log.transactionHash}-${log.logIndex}`,
          txHash: log.transactionHash,
          marketAddress,
          question: detail.question,
          actor,
          type: "remove_liquidity",
          amount,
          timestamp: 0,
          whale: amount >= 250_000_000n
        } satisfies ActivityItem
      ];
    }),
    ...redeemedLogs.flatMap((log) => {
      const actor = log.args.user;
      const amount = log.args.payout;
      if (!actor || amount === undefined) {
        return [];
      }

      return [
        {
          id: `${log.transactionHash}-${log.logIndex}`,
          txHash: log.transactionHash,
          marketAddress,
          question: detail.question,
          actor,
          type: "redeemed",
          amount,
          timestamp: 0,
          whale: amount >= 100_000_000n
        } satisfies ActivityItem
      ];
    }),
    ...createdLogs.flatMap((log) => {
      const actor = log.args.creator;
      const question = log.args.question;
      if (!actor || question === undefined) {
        return [];
      }

      return [
        {
          id: `${log.transactionHash}-${log.logIndex}`,
          txHash: log.transactionHash,
          marketAddress,
          question,
          actor,
          type: "market_created",
          amount: 0n,
          timestamp: 0,
          whale: false
        } satisfies ActivityItem
      ];
    }),
    ...requestLogs.map(
      (log) =>
        ({
          id: `${log.transactionHash}-${log.logIndex}`,
          txHash: log.transactionHash,
          marketAddress,
          question: detail.question,
          actor: marketAddress,
          type: "resolution_requested",
          amount: 0n,
          timestamp: 0,
          whale: false
        }) satisfies ActivityItem
    ),
    ...fulfilledLogs.map(
      (log) =>
        ({
          id: `${log.transactionHash}-${log.logIndex}`,
          txHash: log.transactionHash,
          marketAddress,
          question: detail.question,
          actor: marketAddress,
          type: "resolution_fulfilled",
          amount: 0n,
          outcome: log.args.outcome,
          timestamp: 0,
          whale: false
        }) satisfies ActivityItem
    )
  ];

  const blockNumbers = [...new Set(items.map((item) => blockByItemId.get(item.id) ?? 0))];
  const blockMap = new Map<number, number>();

  await Promise.all(
    blockNumbers.map(async (blockNumber) => {
      const block = await publicClient.getBlock({ blockNumber: BigInt(blockNumber) });
      blockMap.set(blockNumber, Number(block.timestamp) * 1000);
    })
  );

  const typedItems = items
    .map((item) => ({
      ...item,
      timestamp: blockMap.get(blockByItemId.get(item.id) ?? 0) ?? Date.now()
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  const payload = typedItems.map((item) => ({
    ...item,
    amount: item.amount.toString(),
    shares: item.shares?.toString()
  }));

  await setCachedActivity(marketAddress, payload);
  return payload;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const addresses = getRequiredAddresses();

  if (!addresses) {
    return NextResponse.json({ error: "Missing frontend env configuration." }, { status: 500 });
  }

  try {
    const { address } = await context.params;
    const marketAddress = getAddress(address);
    const forceFresh = _request.nextUrl.searchParams.get("fresh") === "1";
    const limit = Number(_request.nextUrl.searchParams.get("limit") ?? "100");
    const cursor = _request.nextUrl.searchParams.get("cursor");
    if (!forceFresh) {
      const indexedActivity = await getIndexedMarketActivity(
        marketAddress,
        {
          limit: Number.isFinite(limit) ? Math.min(limit, 200) : 100,
          cursor
        }
      );
      if (indexedActivity) {
        return NextResponse.json({
          items: indexedActivity.items,
          meta: buildApiMeta({
            source: "indexed",
            indexed: true,
            cursor: indexedActivity.nextCursor,
            hasMore: Boolean(indexedActivity.nextCursor)
          })
        });
      }
    }

    const cached = await getCachedActivity(marketAddress);
    if (!forceFresh && cached) {
      if (!isFresh(cached.updatedAt, ACTIVITY_TTL_MS)) {
        void buildMarketActivitySnapshot(addresses, marketAddress).catch(() => {
          // Keep serving the last good backend activity snapshot if refresh fails.
        });
      }

      return NextResponse.json({
        items: cached.data,
        meta: buildApiMeta({
          source: "cache",
          stale: !isFresh(cached.updatedAt, ACTIVITY_TTL_MS),
          updatedAt: cached.updatedAt,
          fallbackUsed: true
        })
      });
    }

    const payload = await buildMarketActivitySnapshot(addresses, marketAddress);

    return NextResponse.json({
      items: payload,
      meta: buildApiMeta({
        source: "rpc"
      })
    });
  } catch (error) {
    const { address } = await context.params;
    const marketAddress = getAddress(address);
    const cached = await getCachedActivity(marketAddress);
    if (cached) {
      return NextResponse.json({
        items: cached.data,
        meta: buildApiMeta({
          source: "cache",
          stale: true,
          updatedAt: cached.updatedAt,
          warning:
            error instanceof Error
              ? error.message
              : "Failed to load activity.",
          fallbackUsed: true
        })
      });
    }

    return NextResponse.json({
      items: [],
      meta: buildApiMeta({
        source: "rpc",
        stale: true,
        warning:
          error instanceof Error
            ? error.message
            : "Failed to load activity."
      })
    });
  }
}
