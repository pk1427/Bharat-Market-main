import type { Address, PublicClient } from "viem";
import { erc20Abi } from "viem";

import { marketAbi, marketFactoryAbi, outcomeTokenAbi } from "@/lib/abis";
import { getCategoryLabel, getOracleSourceLabel } from "@/lib/market-meta";

export type MarketStatus = "active" | "awaiting" | "resolved";

export type MarketSummary = {
  address: Address;
  creator: Address | null;
  question: string;
  category: string;
  oracleSource: string;
  oracleType: string;
  oracleQuery: string;
  yesProbability: bigint;
  noProbability: bigint;
  liquidity: bigint;
  volume: bigint;
  traderCount: number;
  endTime: bigint;
  endTimeLabel: string;
  resolved: boolean;
  status: MarketStatus;
  statusLabel: string;
  resolvedOutcome: number;
};

export type MarketDetailData = MarketSummary & {
  yesPool: bigint;
  noPool: bigint;
  yesBalance: bigint;
  noBalance: bigint;
  lpBalance: bigint;
  usdcBalance: bigint;
  yesToken: Address;
  noToken: Address;
  lpToken: Address;
  winningOutcome: number;
  winningLabel: string;
};

export type MarketSummaryDto = Omit<
  MarketSummary,
  "yesProbability" | "noProbability" | "liquidity" | "volume" | "endTime"
> & {
  yesProbability: string;
  noProbability: string;
  liquidity: string;
  volume: string;
  endTime: string;
};

export type MarketDetailDto = Omit<
  MarketDetailData,
  | "yesProbability"
  | "noProbability"
  | "liquidity"
  | "volume"
  | "endTime"
  | "yesPool"
  | "noPool"
  | "yesBalance"
  | "noBalance"
  | "lpBalance"
  | "usdcBalance"
> & {
  yesProbability: string;
  noProbability: string;
  liquidity: string;
  volume: string;
  endTime: string;
  yesPool: string;
  noPool: string;
  yesBalance: string;
  noBalance: string;
  lpBalance: string;
  usdcBalance: string;
};

type CreationMeta = {
  creator: Address | null;
  question: string;
  endTime: bigint;
};

export async function fetchMarketSummaries(
  publicClient: PublicClient,
  marketFactory: Address
): Promise<MarketSummary[]> {
  const marketAddresses = await fetchMarketAddresses(publicClient, marketFactory);
  const creationMap = await fetchMarketCreationMap(publicClient, marketFactory);

  const summaries = await Promise.all(
    marketAddresses.map(async (marketAddress) => {
      const [
        yesProbability,
        noProbability,
        yesPool,
        noPool,
        resolved,
        endTime,
        oracleType,
        oracleQuery,
        winningOutcome,
        volume,
        traderCount
      ] = await Promise.all([
        publicClient.readContract({
          address: marketAddress,
          abi: marketAbi,
          functionName: "priceYes"
        }),
        publicClient.readContract({
          address: marketAddress,
          abi: marketAbi,
          functionName: "priceNo"
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
        }),
        publicClient.readContract({
          address: marketAddress,
          abi: marketAbi,
          functionName: "resolved"
        }),
        publicClient.readContract({
          address: marketAddress,
          abi: marketAbi,
          functionName: "endTime"
        }),
        publicClient.readContract({
          address: marketAddress,
          abi: marketAbi,
          functionName: "oracleType"
        }),
        publicClient.readContract({
          address: marketAddress,
          abi: marketAbi,
          functionName: "oracleQuery"
        }),
        publicClient.readContract({
          address: marketAddress,
          abi: marketAbi,
          functionName: "winningOutcome"
        }),
        fetchMarketVolume(publicClient, marketAddress),
        fetchMarketTraderCount(publicClient, marketAddress)
      ]);

      const created = creationMap.get(marketAddress.toLowerCase());
      const status = getMarketStatus(resolved, endTime);
      const question =
        created?.question ?? deriveQuestion(oracleType, oracleQuery, marketAddress);

      return {
        address: marketAddress,
        creator: created?.creator ?? null,
        question,
        category: getCategoryLabel(oracleType, oracleQuery),
        oracleSource: getOracleSourceLabel(oracleType),
        oracleType,
        oracleQuery,
        yesProbability,
        noProbability,
        liquidity: yesPool + noPool,
        volume,
        traderCount,
        endTime,
        endTimeLabel: getEndTimeLabel(endTime),
        resolved,
        status,
        statusLabel: getStatusLabel(status),
        resolvedOutcome: winningOutcome
      };
    })
  );

  return summaries.sort((a, b) => Number(b.endTime - a.endTime));
}

export async function fetchMarketDetail(
  publicClient: PublicClient,
  marketFactory: Address,
  marketAddress: Address,
  usdcAddress: Address,
  account?: Address
): Promise<MarketDetailData> {
  const creationMap = await fetchMarketCreationMap(publicClient, marketFactory);
  const [
    yesProbability,
    noProbability,
    yesPool,
    noPool,
    resolved,
    endTime,
    winningOutcome,
    oracleType,
    oracleQuery,
    yesToken,
    noToken,
    lpToken,
    volume,
    traderCount
  ] = await Promise.all([
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "priceYes"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "priceNo"
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
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "resolved"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "endTime"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "winningOutcome"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "oracleType"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "oracleQuery"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "yesToken"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "noToken"
    }),
    publicClient.readContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "lpToken"
    }),
    fetchMarketVolume(publicClient, marketAddress),
    fetchMarketTraderCount(publicClient, marketAddress)
  ]);

  const [yesBalance, noBalance, lpBalance, usdcBalance] = account
    ? await Promise.all([
        publicClient.readContract({
          address: yesToken,
          abi: outcomeTokenAbi,
          functionName: "balanceOf",
          args: [account]
        }),
        publicClient.readContract({
          address: noToken,
          abi: outcomeTokenAbi,
          functionName: "balanceOf",
          args: [account]
        }),
        publicClient.readContract({
          address: lpToken,
          abi: outcomeTokenAbi,
          functionName: "balanceOf",
          args: [account]
        }),
        publicClient.readContract({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account]
        })
      ])
    : [0n, 0n, 0n, 0n];

  const status = getMarketStatus(resolved, endTime);
  const created = creationMap.get(marketAddress.toLowerCase());
  const question = created?.question ?? deriveQuestion(oracleType, oracleQuery, marketAddress);

  return {
    address: marketAddress,
    creator: created?.creator ?? null,
    question,
    category: getCategoryLabel(oracleType, oracleQuery),
    oracleSource: getOracleSourceLabel(oracleType),
    oracleType,
    oracleQuery,
    yesProbability,
    noProbability,
    liquidity: yesPool + noPool,
    volume,
    traderCount,
    endTime,
    endTimeLabel: getEndTimeLabel(endTime),
    resolved,
    status,
    statusLabel: getStatusLabel(status),
    resolvedOutcome: winningOutcome,
    yesPool,
    noPool,
    yesBalance,
    noBalance,
    lpBalance,
    usdcBalance,
    yesToken,
    noToken,
    lpToken,
    winningOutcome,
    winningLabel: winningOutcome === 1 ? "YES" : winningOutcome === 2 ? "NO" : "Pending"
  };
}

export async function fetchMarketVolume(
  publicClient: PublicClient,
  marketAddress: Address,
  account?: Address
) {
  const logs = await publicClient.getLogs({
    address: marketAddress,
    event: marketAbi[0],
    ...(account ? { args: { user: account } } : {}),
    fromBlock: getFromBlockHint()
  });

  return logs.reduce((total, log) => total + (log.args.amountIn ?? 0n), 0n);
}

export async function fetchMarketTraderCount(publicClient: PublicClient, marketAddress: Address) {
  const logs = await publicClient.getLogs({
    address: marketAddress,
    event: marketAbi[0],
    fromBlock: getFromBlockHint()
  });

  return new Set(logs.flatMap((log) => (log.args.user ? [log.args.user.toLowerCase()] : []))).size;
}

export async function fetchAverageEntryBySide(
  publicClient: PublicClient,
  marketAddress: Address,
  account: Address
) {
  const logs = await publicClient.getLogs({
    address: marketAddress,
    event: marketAbi[0],
    args: { user: account },
    fromBlock: getFromBlockHint()
  });

  let yesAmount = 0n;
  let yesShares = 0n;
  let noAmount = 0n;
  let noShares = 0n;

  for (const log of logs) {
    const amountIn = log.args.amountIn;
    const sharesMinted = log.args.sharesMinted;
    if (amountIn === undefined || sharesMinted === undefined) {
      continue;
    }

    if (log.args.isYes) {
      yesAmount += amountIn;
      yesShares += sharesMinted;
    } else {
      noAmount += amountIn;
      noShares += sharesMinted;
    }
  }

  return {
    yes: yesShares > 0n ? (yesAmount * 1_000_000n) / yesShares : null,
    no: noShares > 0n ? (noAmount * 1_000_000n) / noShares : null
  };
}

export async function fetchMarketCreationMap(
  publicClient: PublicClient,
  marketFactory: Address
) {
  const logs = await publicClient.getLogs({
    address: marketFactory,
    event: marketFactoryAbi[0],
    fromBlock: getFromBlockHint()
  });

  return new Map(
    logs.flatMap((log) => {
      const market = log.args.market;
      const creator = log.args.creator;
      const question = log.args.question;
      const endTime = log.args.endTime;
      if (!market || question === undefined || endTime === undefined) {
        return [];
      }

      return [
        [
          market.toLowerCase(),
          {
            creator: creator ?? null,
            question,
            endTime
          } satisfies CreationMeta
        ] as const
      ];
    })
  );
}

export function serializeMarketSummary(summary: MarketSummary): MarketSummaryDto {
  return {
    ...summary,
    yesProbability: summary.yesProbability.toString(),
    noProbability: summary.noProbability.toString(),
    liquidity: summary.liquidity.toString(),
    volume: summary.volume.toString(),
    endTime: summary.endTime.toString()
  };
}

export function deserializeMarketSummary(summary: MarketSummaryDto): MarketSummary {
  return {
    ...summary,
    yesProbability: BigInt(summary.yesProbability),
    noProbability: BigInt(summary.noProbability),
    liquidity: BigInt(summary.liquidity),
    volume: BigInt(summary.volume),
    endTime: BigInt(summary.endTime)
  };
}

export function serializeMarketDetail(detail: MarketDetailData): MarketDetailDto {
  return {
    ...serializeMarketSummary(detail),
    yesPool: detail.yesPool.toString(),
    noPool: detail.noPool.toString(),
    yesBalance: detail.yesBalance.toString(),
    noBalance: detail.noBalance.toString(),
    lpBalance: detail.lpBalance.toString(),
    usdcBalance: detail.usdcBalance.toString(),
    yesToken: detail.yesToken,
    noToken: detail.noToken,
    lpToken: detail.lpToken,
    winningOutcome: detail.winningOutcome,
    winningLabel: detail.winningLabel
  };
}

export function deserializeMarketDetail(detail: MarketDetailDto): MarketDetailData {
  return {
    ...deserializeMarketSummary(detail),
    yesPool: BigInt(detail.yesPool),
    noPool: BigInt(detail.noPool),
    yesBalance: BigInt(detail.yesBalance),
    noBalance: BigInt(detail.noBalance),
    lpBalance: BigInt(detail.lpBalance),
    usdcBalance: BigInt(detail.usdcBalance),
    yesToken: detail.yesToken,
    noToken: detail.noToken,
    lpToken: detail.lpToken,
    winningOutcome: detail.winningOutcome,
    winningLabel: detail.winningLabel
  };
}

async function fetchMarketAddresses(publicClient: PublicClient, marketFactory: Address) {
  return publicClient.readContract({
    address: marketFactory,
    abi: marketFactoryAbi,
    functionName: "getAllMarkets"
  });
}

function getMarketStatus(resolved: boolean, endTime: bigint): MarketStatus {
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (resolved) return "resolved";
  if (endTime <= now) return "awaiting";
  return "active";
}

function getStatusLabel(status: MarketStatus) {
  if (status === "active") return "Active";
  if (status === "awaiting") return "Awaiting Resolution";
  return "Resolved";
}

function getEndTimeLabel(endTime: bigint) {
  return new Date(Number(endTime) * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function deriveQuestion(oracleType: string, oracleQuery: string, marketAddress: Address) {
  if (oracleType === "sports" && oracleQuery.includes("_vs_")) {
    const [home, away] = oracleQuery.split("_vs_");
    return `Will ${formatTeam(home)} beat ${formatTeam(away)}?`;
  }

  if (oracleType === "crypto" && oracleQuery.endsWith("_price")) {
    return `Will ${oracleQuery.replace("_price", "").toUpperCase()} hit the target price?`;
  }

  if (oracleQuery) {
    return oracleQuery
      .split(/[_-]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return `Market ${marketAddress.slice(0, 8)}`;
}

function formatTeam(team: string) {
  return team
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join(" ");
}

function getFromBlockHint() {
  const value = process.env.NEXT_PUBLIC_FACTORY_DEPLOY_BLOCK;
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? BigInt(parsed) : undefined;
}
