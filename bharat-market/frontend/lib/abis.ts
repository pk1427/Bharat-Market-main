import { parseAbi } from "viem";

export const marketFactoryAbi = parseAbi([
  "event MarketCreated(address indexed market, address indexed creator, string question, uint256 endTime)",
  "function getAllMarkets() view returns (address[])",
  "function createMarket(string question, uint256 endTime, string oracleType, string oracleQuery) returns (address)",
  "function creationFee() view returns (uint256)"
]);

export const marketAbi = parseAbi([
  "event Bought(address indexed user, bool isYes, uint256 amountIn, uint256 sharesMinted)",
  "event Resolved(uint8 outcome)",
  "event Redeemed(address indexed user, uint256 payout)",
  "event LiquidityAdded(address indexed provider, uint256 amount)",
  "event LiquidityRemoved(address indexed provider, uint256 amount)",
  "function priceYes() view returns (uint256)",
  "function priceNo() view returns (uint256)",
  "function yesPool() view returns (uint256)",
  "function noPool() view returns (uint256)",
  "function endTime() view returns (uint256)",
  "function resolved() view returns (bool)",
  "function winningOutcome() view returns (uint8)",
  "function oracleType() view returns (string)",
  "function oracleQuery() view returns (string)",
  "function yesToken() view returns (address)",
  "function noToken() view returns (address)",
  "function lpToken() view returns (address)",
  "function previewBuyYes(uint256 amount) view returns (uint256)",
  "function previewBuyNo(uint256 amount) view returns (uint256)",
  "function buyYes(uint256 amount, uint256 minShares)",
  "function buyNo(uint256 amount, uint256 minShares)",
  "function addLiquidity(uint256 amount)",
  "function removeLiquidity(uint256 lpAmount)",
  "function redeem()"
]);

export const outcomeTokenAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)"
]);

export const mockUsdcAbi = parseAbi([
  "function mint(address to, uint256 amount)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount)"
]);

export const chainlinkFunctionsOracleAbi = parseAbi([
  "event ResolutionRequested(bytes32 indexed requestId, address indexed market, string oracleType, string oracleQuery)",
  "event ResolutionFulfilled(bytes32 indexed requestId, address indexed market, uint8 outcome)",
  "event ResolutionFailed(bytes32 indexed requestId, address indexed market, bytes errorData)",
  "function requestMarketResolution(address market) returns (bytes32)",
  "function marketPendingRequest(address) view returns (bytes32)"
]);
