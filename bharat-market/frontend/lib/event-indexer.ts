import type { Address, PublicClient } from "viem";

import { marketAbi, marketFactoryAbi } from "@/lib/abis";
import type { HistoryPoint } from "@/types/product";

const INITIAL_LIQUIDITY = 1_000_000_000n;
const FEE_PERCENT = 2n;

type LiquidityCostBasis = {
  totalAdded: bigint;
  totalRemoved: bigint;
  netCostBasis: bigint;
};

type IndexedEvent =
  | { id: string; blockNumber: bigint; logIndex: number; kind: "created" }
  | { id: string; blockNumber: bigint; logIndex: number; kind: "buy_yes" | "buy_no"; amountIn: bigint }
  | { id: string; blockNumber: bigint; logIndex: number; kind: "add_liquidity"; amount: bigint }
  | { id: string; blockNumber: bigint; logIndex: number; kind: "remove_liquidity"; amount: bigint };

function getFromBlockHint() {
  const value = process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK;
  if (!value) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

async function resolveFromBlock(publicClient: PublicClient) {
  const hinted = getFromBlockHint();
  if (hinted !== null) {
    return hinted;
  }

  const latestBlock = await publicClient.getBlockNumber();
  const lookbackWindow = 120_000n;

  return latestBlock > lookbackWindow ? latestBlock - lookbackWindow : 0n;
}

function getEventId(transactionHash: `0x${string}`, logIndex: number) {
  return `${transactionHash}-${logIndex}`;
}

function toIndexedEvents(logs: IndexedEvent[]) {
  return logs.sort((left, right) => {
    if (left.blockNumber === right.blockNumber) {
      return left.logIndex - right.logIndex;
    }

    return left.blockNumber < right.blockNumber ? -1 : 1;
  });
}

function getEffectiveAmount(amountIn: bigint) {
  const fee = (amountIn * FEE_PERCENT) / 100n;
  const protocolFee = fee / 2n;
  return amountIn - protocolFee;
}

export async function fetchMarketHistoryFromEvents(
  publicClient: PublicClient,
  marketFactory: Address,
  marketAddress: Address
): Promise<HistoryPoint[]> {
  const fromBlock = await resolveFromBlock(publicClient);
  const [createdLogs, buyLogs, addLogs, removeLogs] = await Promise.all([
    publicClient.getLogs({
      address: marketFactory,
      event: marketFactoryAbi[0],
      args: { market: marketAddress },
      fromBlock
    }),
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
    })
  ]);

  const events = toIndexedEvents([
    ...createdLogs.flatMap((log) =>
      log.blockNumber !== null
        ? [
            {
              id: getEventId(log.transactionHash, log.logIndex),
              blockNumber: log.blockNumber,
              logIndex: log.logIndex,
              kind: "created" as const
            }
          ]
        : []
    ),
    ...buyLogs.flatMap((log) => {
      const amountIn = log.args.amountIn;
      if (log.blockNumber === null || amountIn === undefined) {
        return [];
      }

      return [
        {
          id: getEventId(log.transactionHash, log.logIndex),
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          kind: log.args.isYes ? ("buy_yes" as const) : ("buy_no" as const),
          amountIn
        }
      ];
    }),
    ...addLogs.flatMap((log) => {
      const amount = log.args.amount;
      if (log.blockNumber === null || amount === undefined) {
        return [];
      }

      return [
        {
          id: getEventId(log.transactionHash, log.logIndex),
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          kind: "add_liquidity" as const,
          amount
        }
      ];
    }),
    ...removeLogs.flatMap((log) => {
      const amount = log.args.amount;
      if (log.blockNumber === null || amount === undefined) {
        return [];
      }

      return [
        {
          id: getEventId(log.transactionHash, log.logIndex),
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          kind: "remove_liquidity" as const,
          amount
        }
      ];
    })
  ]);

  if (events.length === 0) {
    return [];
  }

  const blockNumbers = [...new Set(events.map((event) => event.blockNumber.toString()))].map((value) =>
    BigInt(value)
  );
  const blockMap = new Map<bigint, number>();

  await Promise.all(
    blockNumbers.map(async (blockNumber) => {
      const block = await publicClient.getBlock({ blockNumber });
      blockMap.set(blockNumber, Number(block.timestamp) * 1000);
    })
  );

  let yesPool = INITIAL_LIQUIDITY;
  let noPool = INITIAL_LIQUIDITY;
  let volume = 0n;

  const points: HistoryPoint[] = [];
  const createdEvent = events.find((event) => event.kind === "created");
  if (createdEvent) {
    const timestamp = blockMap.get(createdEvent.blockNumber) ?? Date.now();
    points.push({
      timestamp,
      yesProbability: 500_000_000_000_000_000n,
      noProbability: 500_000_000_000_000_000n,
      volume: 0n,
      source: "event"
    });
  }

  for (const event of events) {
    if (event.kind === "created") {
      continue;
    }

    if (event.kind === "buy_yes") {
      const k = yesPool * noPool;
      yesPool += getEffectiveAmount(event.amountIn);
      noPool = k / yesPool;
      volume += event.amountIn;
    } else if (event.kind === "buy_no") {
      const k = yesPool * noPool;
      noPool += getEffectiveAmount(event.amountIn);
      yesPool = k / noPool;
      volume += event.amountIn;
    } else if (event.kind === "add_liquidity") {
      const half = event.amount / 2n;
      yesPool += half;
      noPool += half;
    } else if (event.kind === "remove_liquidity") {
      const totalPool = yesPool + noPool;
      if (totalPool > 0n) {
        const yesShare = (event.amount * yesPool) / totalPool;
        const noShare = event.amount - yesShare;
        yesPool -= yesShare;
        noPool -= noShare;
      }
    }

    const total = yesPool + noPool;
    points.push({
      timestamp: blockMap.get(event.blockNumber) ?? Date.now(),
      yesProbability: total > 0n ? (yesPool * 1_000_000_000_000_000_000n) / total : 0n,
      noProbability: total > 0n ? (noPool * 1_000_000_000_000_000_000n) / total : 0n,
      volume,
      source: "event"
    });
  }

  return points;
}

export async function fetchLiquidityCostBasis(
  publicClient: PublicClient,
  marketAddress: Address,
  account: Address
): Promise<LiquidityCostBasis> {
  const fromBlock = await resolveFromBlock(publicClient);
  const [addLogs, removeLogs] = await Promise.all([
    publicClient.getLogs({
      address: marketAddress,
      event: marketAbi[3],
      args: { provider: account },
      fromBlock
    }),
    publicClient.getLogs({
      address: marketAddress,
      event: marketAbi[4],
      args: { provider: account },
      fromBlock
    })
  ]);

  const totalAdded = addLogs.reduce((sum, log) => sum + (log.args.amount ?? 0n), 0n);
  const totalRemoved = removeLogs.reduce((sum, log) => sum + (log.args.amount ?? 0n), 0n);

  return {
    totalAdded,
    totalRemoved,
    netCostBasis: totalAdded > totalRemoved ? totalAdded - totalRemoved : 0n
  };
}
