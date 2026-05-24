import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";

import { getRequiredAddresses } from "@/lib/contracts";
import { fetchLiquidityCostBasis } from "@/lib/event-indexer";
import { fetchAverageEntryBySide, fetchMarketDetail, fetchMarketSummaries } from "@/lib/market-data";
import {
  getCachedPortfolio,
  getCachedSummaries,
  isFresh,
  setCachedPortfolio
} from "@/lib/server/market-cache";
import { getServerPublicClient } from "@/lib/server/public-client";
import type { PortfolioGroup, PortfolioOverview, PortfolioPosition, PositionSide } from "@/types/product";
import { outcomeTokenAbi } from "@/lib/abis";

const PORTFOLIO_TTL_MS = 120_000;
const SUMMARY_TTL_MS = 120_000;

function serializePosition(position: PortfolioPosition) {
  return {
    ...position,
    shares: position.shares.toString(),
    averageEntryPrice: position.averageEntryPrice?.toString() ?? null,
    currentProbability: position.currentProbability.toString(),
    estimatedValue: position.estimatedValue.toString(),
    unrealizedPnl: position.unrealizedPnl.toString(),
    redeemable: position.redeemable.toString(),
    liquidityValue: position.liquidityValue?.toString() ?? null
  };
}

function serializeOverview(overview: PortfolioOverview) {
  return {
    ...overview,
    walletUsdcBalance: overview.walletUsdcBalance.toString(),
    yesHoldings: overview.yesHoldings.toString(),
    noHoldings: overview.noHoldings.toString(),
    lpHoldings: overview.lpHoldings.toString(),
    redeemableWinnings: overview.redeemableWinnings.toString(),
    estimatedPositionValue: overview.estimatedPositionValue.toString(),
    unrealizedPnl: overview.unrealizedPnl.toString()
  };
}

function parseAccount(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("account");
  if (!value) {
    return null;
  }

  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

async function buildPortfolioPayload(account: `0x${string}`, addresses: NonNullable<ReturnType<typeof getRequiredAddresses>>) {
  const publicClient = getServerPublicClient();
  const cachedSummaries = await getCachedSummaries();
  const summaries = cachedSummaries && isFresh(cachedSummaries.updatedAt, SUMMARY_TTL_MS)
    ? cachedSummaries.data.map((summary) => ({
        ...summary,
        yesProbability: BigInt(summary.yesProbability),
        noProbability: BigInt(summary.noProbability),
        liquidity: BigInt(summary.liquidity),
        volume: BigInt(summary.volume),
        endTime: BigInt(summary.endTime)
      }))
    : await fetchMarketSummaries(publicClient, addresses.marketFactory);
  const groups: PortfolioGroup[] = [];
  const overview: PortfolioOverview = {
    walletUsdcBalance: 0n,
    yesHoldings: 0n,
    noHoldings: 0n,
    lpHoldings: 0n,
    redeemableWinnings: 0n,
    activePositions: 0,
    estimatedPositionValue: 0n,
    unrealizedPnl: 0n
  };

  for (const summary of summaries) {
    const detail = await fetchMarketDetail(
      publicClient,
      addresses.marketFactory,
      summary.address,
      addresses.usdc,
      account
    );
    const avgEntries = await fetchAverageEntryBySide(publicClient, summary.address, account);
    const lpTotalSupply = await publicClient.readContract({
      address: detail.lpToken,
      abi: outcomeTokenAbi,
      functionName: "totalSupply"
    });

    overview.walletUsdcBalance = detail.usdcBalance;

    const positions: PortfolioPosition[] = [];

    const yesValue = (detail.yesBalance * detail.yesProbability) / 1_000_000_000_000_000_000n;
    if (detail.yesBalance > 0n) {
      const costBasis = avgEntries.yes ? (avgEntries.yes * detail.yesBalance) / 1_000_000n : 0n;
      positions.push({
        marketAddress: detail.address,
        question: detail.question,
        status: detail.status,
        statusLabel: detail.statusLabel,
        side: "yes",
        shares: detail.yesBalance,
        averageEntryPrice: avgEntries.yes,
        currentProbability: detail.yesProbability,
        estimatedValue: yesValue,
        unrealizedPnl: yesValue - costBasis,
        redeemable:
          detail.resolved && detail.winningOutcome === 1 ? detail.yesBalance : 0n,
        oracleType: detail.oracleType,
        category: detail.category
      });
    }

    const noValue = (detail.noBalance * detail.noProbability) / 1_000_000_000_000_000_000n;
    if (detail.noBalance > 0n) {
      const costBasis = avgEntries.no ? (avgEntries.no * detail.noBalance) / 1_000_000n : 0n;
      positions.push({
        marketAddress: detail.address,
        question: detail.question,
        status: detail.status,
        statusLabel: detail.statusLabel,
        side: "no",
        shares: detail.noBalance,
        averageEntryPrice: avgEntries.no,
        currentProbability: detail.noProbability,
        estimatedValue: noValue,
        unrealizedPnl: noValue - costBasis,
        redeemable:
          detail.resolved && detail.winningOutcome === 2 ? detail.noBalance : 0n,
        oracleType: detail.oracleType,
        category: detail.category
      });
    }

    if (detail.lpBalance > 0n) {
      const currentValue =
        lpTotalSupply > 0n ? ((detail.yesPool + detail.noPool) * detail.lpBalance) / lpTotalSupply : 0n;
      const lpCostBasis = await fetchLiquidityCostBasis(publicClient, detail.address, account);
      positions.push({
        marketAddress: detail.address,
        question: detail.question,
        status: detail.status,
        statusLabel: detail.statusLabel,
        side: "lp",
        shares: detail.lpBalance,
        averageEntryPrice: null,
        currentProbability: 500000000000000000n,
        estimatedValue: currentValue,
        unrealizedPnl: currentValue - lpCostBasis.netCostBasis,
        redeemable: 0n,
        liquidityValue: currentValue,
        oracleType: detail.oracleType,
        category: detail.category
      });
    }

    if (positions.length === 0) {
      continue;
    }

    const redeemableTotal = positions.reduce((total, position) => total + position.redeemable, 0n);
    groups.push({
      marketAddress: detail.address,
      question: detail.question,
      status: detail.status,
      statusLabel: detail.statusLabel,
      category: detail.category,
      oracleType: detail.oracleType,
      positions,
      redeemableTotal
    });

    for (const position of positions) {
      if (position.side === "yes") {
        overview.yesHoldings += position.shares;
      } else if (position.side === "no") {
        overview.noHoldings += position.shares;
      } else {
        overview.lpHoldings += position.shares;
      }

      overview.estimatedPositionValue += position.estimatedValue;
      overview.unrealizedPnl += position.unrealizedPnl;
      overview.redeemableWinnings += position.redeemable;

      if (position.status !== "resolved") {
        overview.activePositions += 1;
      }
    }
  }

  return {
    overview: serializeOverview(overview),
    groups: groups.map((group) => ({
      ...group,
      redeemableTotal: group.redeemableTotal.toString(),
      positions: group.positions.map(serializePosition)
    })),
    updatedAt: new Date().toISOString()
  };
}

export async function GET(request: NextRequest) {
  const account = parseAccount(request);
  const addresses = getRequiredAddresses();

  if (!account) {
    return NextResponse.json({ error: "Missing or invalid account address." }, { status: 400 });
  }

  if (!addresses) {
    return NextResponse.json({ error: "Missing frontend env configuration." }, { status: 500 });
  }

  try {
    const forceFresh = request.nextUrl.searchParams.get("fresh") === "1";
    const cachedPortfolio = await getCachedPortfolio(account);
    if (!forceFresh && cachedPortfolio) {
      if (!isFresh(cachedPortfolio.updatedAt, PORTFOLIO_TTL_MS)) {
        void buildPortfolioPayload(account, addresses)
          .then((payload) => setCachedPortfolio(account, payload))
          .catch(() => {
            // Preserve the last good backend portfolio snapshot if refresh fails.
          });
      }

      return NextResponse.json({
        ...(cachedPortfolio.data as Record<string, unknown>),
        updatedAt: cachedPortfolio.updatedAt,
        stale: !isFresh(cachedPortfolio.updatedAt, PORTFOLIO_TTL_MS),
        cached: true
      });
    }

    const payload = await buildPortfolioPayload(account, addresses);
    await setCachedPortfolio(account, payload);

    return NextResponse.json(payload);
  } catch (error) {
    const cachedPortfolio = await getCachedPortfolio(account);
    if (cachedPortfolio) {
      return NextResponse.json({
        ...(cachedPortfolio.data as Record<string, unknown>),
        updatedAt: cachedPortfolio.updatedAt,
        stale: true,
        warning:
          error instanceof Error
            ? error.message
            : "RPC unavailable. Showing cached portfolio."
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build portfolio."
      },
      { status: 500 }
    );
  }
}
