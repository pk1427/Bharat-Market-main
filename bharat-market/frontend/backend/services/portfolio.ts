import { erc20Abi, getAddress } from "viem";

import { getIndexedBackend } from "@/backend/services/runtime";
import {
  createPosition,
  getMarketStatus,
  getStatusLabel,
  serializeGroup,
  serializeOverview
} from "@/backend/services/serializers";
import { getCategoryLabel } from "@/lib/market-meta";
import { getRequiredAddresses } from "@/lib/contracts";
import { getServerPublicClient } from "@/lib/server/public-client";
import type { PortfolioGroup, PortfolioOverview } from "@/types/product";

export async function getIndexedPortfolio(account: `0x${string}`) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return null;
  }

  const wallet = account.toLowerCase();
  const [positions, liquidityPositions, redemptions] = await Promise.all([
    prisma.walletPosition.findMany({
      where: { wallet },
      include: { market: true }
    }),
    prisma.walletLiquidityPosition.findMany({
      where: { wallet },
      include: { market: true }
    }),
    prisma.redemption.findMany({
      where: { redeemer: wallet },
      include: { market: true }
    })
  ]);

  if (positions.length === 0 && liquidityPositions.length === 0 && redemptions.length === 0) {
    return {
      overview: serializeOverview({
        walletUsdcBalance: await readWalletUsdcBalance(account),
        yesHoldings: 0n,
        noHoldings: 0n,
        lpHoldings: 0n,
        redeemableWinnings: 0n,
        activePositions: 0,
        estimatedPositionValue: 0n,
        unrealizedPnl: 0n
      }),
      groups: [],
      updatedAt: new Date().toISOString(),
      indexed: true
    };
  }

  const groupsByMarket = new Map<string, PortfolioGroup>();
  const redeemedMarketIds = new Set(redemptions.map((entry: (typeof redemptions)[number]) => entry.marketId));
  const redeemedByMarket = new Map<string, bigint>();
  for (const redemption of redemptions) {
    redeemedByMarket.set(
      redemption.marketId,
      (redeemedByMarket.get(redemption.marketId) ?? 0n) + BigInt(redemption.payoutAmount)
    );
  }
  const overview: PortfolioOverview = {
    walletUsdcBalance: await readWalletUsdcBalance(account),
    yesHoldings: 0n,
    noHoldings: 0n,
    lpHoldings: 0n,
    redeemableWinnings: 0n,
    activePositions: 0,
    estimatedPositionValue: 0n,
    unrealizedPnl: 0n
  };

  for (const position of positions) {
    const market = position.market;
    const status = getMarketStatus(market.resolved, market.endTime);
    const statusLabel = getStatusLabel(status);
    const category = getCategoryLabel(market.oracleType, market.oracleQuery);
    const probability = market.resolved
      ? (position.side === "YES" && market.outcome === "YES") || (position.side === "NO" && market.outcome === "NO")
        ? 1_000_000_000_000_000_000n
        : 0n
      : position.side === "YES"
        ? BigInt(market.latestYesProbability)
        : BigInt(market.latestNoProbability);
    const positionShares = BigInt(position.shares);
    const redeemedForPosition =
      market.resolved &&
      ((position.side === "YES" && market.outcome === "YES") || (position.side === "NO" && market.outcome === "NO"))
        ? redeemedByMarket.get(market.id) ?? 0n
        : 0n;
    const indexedRedeemed = BigInt(position.redeemedAmount);
    const unindexedRedeemed =
      redeemedForPosition > indexedRedeemed ? redeemedForPosition - indexedRedeemed : 0n;
    const shares = positionShares > unindexedRedeemed ? positionShares - unindexedRedeemed : 0n;
    const collateralIn = BigInt(position.collateralIn);
    const estimatedValue = (shares * probability) / 1_000_000_000_000_000_000n;
    const avgEntry =
      (position.averageEntryPrice !== null ? BigInt(position.averageEntryPrice) : null) ??
      (shares > 0n ? (collateralIn * 1_000_000n) / shares : null);
    const costBasis = avgEntry ? (avgEntry * shares) / 1_000_000n : 0n;
    const redeemable =
      market.resolved &&
      !redeemedMarketIds.has(market.id) &&
      ((position.side === "YES" && market.outcome === "YES") ||
        (position.side === "NO" && market.outcome === "NO"))
        ? shares
        : 0n;

    const portfolioPosition = createPosition({
      marketAddress: market.marketAddress,
      question: market.question,
      status,
      statusLabel,
      side: position.side === "YES" ? "yes" : "no",
      shares,
      averageEntryPrice: avgEntry,
      currentProbability: probability,
      estimatedValue,
      unrealizedPnl: estimatedValue - costBasis,
      redeemable,
      oracleType: market.oracleType,
      category
    });

    const existingGroup = groupsByMarket.get(market.id);
    if (existingGroup) {
      existingGroup.positions.push(portfolioPosition);
      existingGroup.redeemableTotal += redeemable;
    } else {
      groupsByMarket.set(market.id, {
        marketAddress: market.marketAddress as `0x${string}`,
        question: market.question,
        status,
        statusLabel,
        category,
        oracleType: market.oracleType,
        positions: [portfolioPosition],
        redeemableTotal: redeemable
      });
    }

    if (position.side === "YES") {
      overview.yesHoldings += shares;
    } else {
      overview.noHoldings += shares;
    }

    if (status !== "resolved") {
      overview.activePositions += 1;
    }

    overview.estimatedPositionValue += estimatedValue;
    overview.unrealizedPnl += estimatedValue - costBasis;
    overview.redeemableWinnings += redeemable;
  }

  for (const lpPosition of liquidityPositions) {
    const market = lpPosition.market;
    const status = getMarketStatus(market.resolved, market.endTime);
    const statusLabel = getStatusLabel(status);
    const category = getCategoryLabel(market.oracleType, market.oracleQuery);
    const lpTokens = BigInt(lpPosition.lpTokens);
    const netCollateral = BigInt(lpPosition.netCollateral);
    const currentValue = netCollateral > 0n ? netCollateral : lpTokens;
    const portfolioPosition = createPosition({
      marketAddress: market.marketAddress,
      question: market.question,
      status,
      statusLabel,
      side: "lp",
      shares: lpTokens,
      averageEntryPrice: null,
      currentProbability: 500_000_000_000_000_000n,
      estimatedValue: currentValue,
      unrealizedPnl: currentValue - netCollateral,
      redeemable: 0n,
      oracleType: market.oracleType,
      category,
      liquidityValue: currentValue
    });

    const existingGroup = groupsByMarket.get(market.id);
    if (existingGroup) {
      existingGroup.positions.push(portfolioPosition);
    } else {
      groupsByMarket.set(market.id, {
        marketAddress: market.marketAddress as `0x${string}`,
        question: market.question,
        status,
        statusLabel,
        category,
        oracleType: market.oracleType,
        positions: [portfolioPosition],
        redeemableTotal: 0n
      });
    }

    overview.lpHoldings += lpTokens;
    overview.estimatedPositionValue += currentValue;
    overview.unrealizedPnl += currentValue - netCollateral;
  }

  await prisma.portfolioSnapshot.create({
    data: {
      wallet,
      timestamp: new Date(),
      totalValue: overview.walletUsdcBalance + overview.estimatedPositionValue,
      unrealizedPnl: overview.unrealizedPnl,
      realizedPnl: redemptions.reduce(
        (sum: bigint, redemption: (typeof redemptions)[number]) => sum + BigInt(redemption.payoutAmount),
        0n
      )
    }
  });

  const groups = [...groupsByMarket.values()]
    .map(serializeGroup)
    .sort((left, right) => left.question.localeCompare(right.question));

  return {
    overview: serializeOverview(overview),
    groups,
    updatedAt: new Date().toISOString(),
    indexed: true
  };
}

async function readWalletUsdcBalance(account: `0x${string}`) {
  const addresses = getRequiredAddresses();
  if (!addresses) {
    return 0n;
  }

  try {
    return await getServerPublicClient().readContract({
      address: addresses.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [getAddress(account)]
    });
  } catch {
    return 0n;
  }
}
