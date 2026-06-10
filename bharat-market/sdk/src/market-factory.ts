import type { Address, Hash, PublicClient, WalletClient } from "viem";
import { parseAbi } from "viem";

export const marketFactoryAbi = parseAbi([
  "event MarketCreated(address indexed market, address indexed creator, string question, uint256 endTime)",
  "function getAllMarkets() view returns (address[])",
  "function getMarkets(uint256 start, uint256 count) view returns (address[])",
  "function createMarket(string question, uint256 endTime, string oracleType, string oracleQuery) returns (address)",
  "function creationFee() view returns (uint256)"
]);

export const marketAbi = parseAbi([
  "function buyYes(uint256 amount, uint256 minShares)",
  "function buyNo(uint256 amount, uint256 minShares)",
  "function addLiquidity(uint256 amount)",
  "function removeLiquidity(uint256 lpAmount)",
  "function redeem()"
]);

export type CreateMarketParams = {
  question: string;
  endTime: bigint;
  oracleType: string;
  oracleQuery: string;
};

export async function createMarket(
  walletClient: WalletClient,
  factory: Address,
  params: CreateMarketParams,
  account: Address
): Promise<Hash> {
  return walletClient.writeContract({
    address: factory,
    abi: marketFactoryAbi,
    functionName: "createMarket",
    args: [params.question, params.endTime, params.oracleType, params.oracleQuery],
    account,
    chain: walletClient.chain ?? undefined
  });
}

export async function buyYes(
  walletClient: WalletClient,
  market: Address,
  amount: bigint,
  minShares: bigint,
  account: Address
): Promise<Hash> {
  return walletClient.writeContract({
    address: market,
    abi: marketAbi,
    functionName: "buyYes",
    args: [amount, minShares],
    account,
    chain: walletClient.chain ?? undefined
  });
}

export async function buyNo(
  walletClient: WalletClient,
  market: Address,
  amount: bigint,
  minShares: bigint,
  account: Address
): Promise<Hash> {
  return walletClient.writeContract({
    address: market,
    abi: marketAbi,
    functionName: "buyNo",
    args: [amount, minShares],
    account,
    chain: walletClient.chain ?? undefined
  });
}

export async function addLiquidity(
  walletClient: WalletClient,
  market: Address,
  amount: bigint,
  account: Address
): Promise<Hash> {
  return walletClient.writeContract({
    address: market,
    abi: marketAbi,
    functionName: "addLiquidity",
    args: [amount],
    account,
    chain: walletClient.chain ?? undefined
  });
}

export async function removeLiquidity(
  walletClient: WalletClient,
  market: Address,
  lpAmount: bigint,
  account: Address
): Promise<Hash> {
  return walletClient.writeContract({
    address: market,
    abi: marketAbi,
    functionName: "removeLiquidity",
    args: [lpAmount],
    account,
    chain: walletClient.chain ?? undefined
  });
}

export async function redeem(
  walletClient: WalletClient,
  market: Address,
  account: Address
): Promise<Hash> {
  return walletClient.writeContract({
    address: market,
    abi: marketAbi,
    functionName: "redeem",
    args: [],
    account,
    chain: walletClient.chain ?? undefined
  });
}

export async function listMarketAddresses(publicClient: PublicClient, factory: Address) {
  return publicClient.readContract({
    address: factory,
    abi: marketFactoryAbi,
    functionName: "getAllMarkets"
  });
}

export async function listMarketPage(
  publicClient: PublicClient,
  factory: Address,
  start: bigint,
  count: bigint
) {
  return publicClient.readContract({
    address: factory,
    abi: marketFactoryAbi,
    functionName: "getMarkets",
    args: [start, count]
  });
}
