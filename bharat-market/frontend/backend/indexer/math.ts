import { FEE_PERCENT, FIXED_POINT_ONE } from "@/backend/indexer/config";

export type MarketStateAccumulator = {
  yesPool: bigint;
  noPool: bigint;
  volume: bigint;
};

function getEffectiveTradeAmount(amountIn: bigint) {
  const fee = (amountIn * FEE_PERCENT) / 100n;
  const protocolFee = fee / 2n;
  return amountIn - protocolFee;
}

export function applyBuyYes(state: MarketStateAccumulator, amountIn: bigint) {
  const k = state.yesPool * state.noPool;
  const yesPool = state.yesPool + getEffectiveTradeAmount(amountIn);
  const noPool = yesPool > 0n ? k / yesPool : state.noPool;

  return {
    yesPool,
    noPool,
    volume: state.volume + amountIn
  };
}

export function applyBuyNo(state: MarketStateAccumulator, amountIn: bigint) {
  const k = state.yesPool * state.noPool;
  const noPool = state.noPool + getEffectiveTradeAmount(amountIn);
  const yesPool = noPool > 0n ? k / noPool : state.yesPool;

  return {
    yesPool,
    noPool,
    volume: state.volume + amountIn
  };
}

export function applyAddLiquidity(state: MarketStateAccumulator, amount: bigint) {
  const half = amount / 2n;
  return {
    ...state,
    yesPool: state.yesPool + half,
    noPool: state.noPool + (amount - half)
  };
}

export function applyRemoveLiquidity(state: MarketStateAccumulator, amount: bigint) {
  const totalPool = state.yesPool + state.noPool;
  if (totalPool <= 0n) {
    return state;
  }

  const yesShare = (amount * state.yesPool) / totalPool;
  const noShare = amount - yesShare;

  return {
    ...state,
    yesPool: state.yesPool > yesShare ? state.yesPool - yesShare : 0n,
    noPool: state.noPool > noShare ? state.noPool - noShare : 0n
  };
}

export function getProbabilities(yesPool: bigint, noPool: bigint) {
  const total = yesPool + noPool;
  if (total <= 0n) {
    return {
      yesProbability: 0n,
      noProbability: 0n
    };
  }

  return {
    yesProbability: (yesPool * FIXED_POINT_ONE) / total,
    noProbability: (noPool * FIXED_POINT_ONE) / total
  };
}
