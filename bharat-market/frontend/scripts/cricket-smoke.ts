import { getPrismaClient } from "@/backend/db/client";
import { runResolutionSync } from "@/backend/services/resolution-runner";
import { loadLocalEnvFile } from "@/backend/workers/load-env";
import { syncSingleMarketIndexer } from "@/backend/indexer/core";
import { marketAbi, marketFactoryAbi, mockUsdcAbi } from "@/lib/abis";
import { getRequiredAddresses } from "@/lib/contracts";
import { encodeOracleMetadata } from "@/lib/oracle-metadata";
import { collateralConfig } from "@/lib/collateral";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  parseEventLogs,
  type Address
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";

loadLocalEnvFile();

type CricketSmokeConfig = {
  matchId: string;
  league: string;
  teamA: string;
  teamB: string;
  selectedTeam: string;
  question: string;
  durationMinutes: number;
  waitForSettlement: boolean;
  maxWaitMinutes: number;
  pollMs: number;
};

type DiscoveredMatch = {
  matchId: string;
  league: string;
  teamA: string;
  teamB: string;
  selectedTeam: string;
  question: string;
};

async function main() {
  const addresses = getRequiredAddresses();
  if (!addresses) {
    throw new Error("Missing NEXT_PUBLIC market addresses in frontend/.env.local.");
  }

  const rpcUrl = process.env.INDEXER_RPC_URL || process.env.NEXT_PUBLIC_AMOY_RPC_URL;
  if (!rpcUrl) {
    throw new Error("Set INDEXER_RPC_URL or NEXT_PUBLIC_AMOY_RPC_URL.");
  }

  const signerKey = normalizePrivateKey(
    process.env.PRIVATE_KEY || process.env.RESOLUTION_WORKER_PRIVATE_KEY || process.env.CRICKET_TEST_PRIVATE_KEY
  );
  if (!signerKey) {
    throw new Error("Set PRIVATE_KEY, RESOLUTION_WORKER_PRIVATE_KEY, or CRICKET_TEST_PRIVATE_KEY in frontend/.env.local.");
  }

  const config = await readConfig();
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(rpcUrl)
  }) as any;
  const walletClient = createWalletClient({
    account: privateKeyToAccount(signerKey),
    chain: polygonAmoy,
    transport: http(rpcUrl)
  }) as any;
  const account = privateKeyToAccount(signerKey).address;

  console.log("BharatMarket cricket smoke test");
  console.log("Account:", account);
  console.log("Match:", config.matchId, config.teamA, "vs", config.teamB);
  console.log("Selected YES team:", config.selectedTeam);
  console.log("Duration:", `${config.durationMinutes} minute(s)`);

  const marketFactory = addresses.marketFactory;
  const usdc = addresses.usdc;
  const fee = parseUnits("10", 6);

  await ensureBalanceAndApproval({
    publicClient,
    walletClient,
    account,
    usdc,
    spender: marketFactory,
    fee
  });

  const metadata = {
    category: "cricket",
    provider: "cricapi",
    marketType: "winner",
    matchId: config.matchId,
    league: config.league,
    teamA: config.teamA,
    teamB: config.teamB,
    selectedTeam: config.selectedTeam,
    settlementRule: `${config.selectedTeam} must be the official match winner`,
    verificationSource: "CricAPI match_info endpoint",
    fallbackSource: "Secondary cricket score provider"
  } as const;

  const oracleQuery = encodeOracleMetadata(metadata);
  const question = config.question.trim() || `Will ${config.selectedTeam} beat ${otherTeam(config.teamA, config.teamB, config.selectedTeam)} in ${config.league}?`;
  const endTime = Math.floor(Date.now() / 1000) + config.durationMinutes * 60;

  const txHash = await walletClient.writeContract({
    address: marketFactory,
    abi: marketFactoryAbi,
    functionName: "createMarket",
    args: [question, BigInt(endTime), "sports", oracleQuery]
  });
  console.log("Create tx:", txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const createdMarket = extractCreatedMarket(receipt.logs);
  if (!createdMarket) {
    throw new Error("Could not find MarketCreated event.");
  }

  console.log("Created market:", createdMarket as Address);
  console.log("Oracle query:", oracleQuery);
  console.log("Waiting for expiry:", new Date(endTime * 1000).toISOString());

  if (config.waitForSettlement) {
    await sleepUntil(endTime * 1000 + 15_000);
    await driveSettlementLoop({
      publicClient,
      marketAddress: createdMarket as Address,
      createdBlock: receipt.blockNumber,
      maxWaitMinutes: config.maxWaitMinutes,
      pollMs: config.pollMs
    });
  }

  console.log("Smoke test finished.");
}

async function driveSettlementLoop(params: {
  publicClient: any;
  marketAddress: Address;
  createdBlock: bigint;
  maxWaitMinutes: number;
  pollMs: number;
}) {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error("DATABASE_URL is missing. Set it in frontend/.env.local.");
  }

  const deadline = Date.now() + params.maxWaitMinutes * 60_000;
  while (Date.now() < deadline) {
    const resolution = await runResolutionSync("manual");
    console.log("[resolution]", JSON.stringify(resolution));

    const latestBlock = await params.publicClient.getBlockNumber();
    const safeHead = latestBlock > 5n ? latestBlock - 5n : latestBlock;
    await syncSingleMarketIndexer({
      prisma,
      publicClient: params.publicClient,
      marketAddress: params.marketAddress,
      floorBlock: params.createdBlock,
      safeHead,
      createdBlockHint: params.createdBlock
    });

    const market = await params.publicClient.readContract({
      address: params.marketAddress,
      abi: marketAbi,
      functionName: "resolved"
    });

    if (market) {
      const outcome = await params.publicClient.readContract({
        address: params.marketAddress,
        abi: marketAbi,
        functionName: "winningOutcome"
      });
      console.log("Market resolved on-chain:", Number(outcome) === 1 ? "YES" : Number(outcome) === 2 ? "NO" : "PENDING");
      await syncSingleMarketIndexer({
        prisma,
        publicClient: params.publicClient,
        marketAddress: params.marketAddress,
        floorBlock: params.createdBlock,
        safeHead,
        createdBlockHint: params.createdBlock
      });
      return;
    }

    await sleep(params.pollMs);
  }

  console.log("Timed out waiting for final on-chain settlement. Keep the worker running and check again later.");
}

async function ensureBalanceAndApproval(params: {
  publicClient: any;
  walletClient: any;
  account: Address;
  usdc: Address;
  spender: Address;
  fee: bigint;
}) {
  const isMintable = collateralConfig.isMintable;
  const erc20Balance = (await params.publicClient.readContract({
    address: params.usdc,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: [params.account]
  })) as bigint;

  if (isMintable && erc20Balance < params.fee) {
    const mintAmount = parseUnits("100", 6);
    await params.walletClient.writeContract({
      address: params.usdc,
      chain: polygonAmoy,
      abi: mockUsdcAbi,
      functionName: "mint",
      args: [params.account, mintAmount]
    });
    console.log("Minted mock collateral for smoke test.");
  }

  if (!isMintable && erc20Balance < params.fee) {
    throw new Error(
      `Insufficient USDC balance for market creation. Wallet has ${formatUsdc(erc20Balance)} USDC, but the fee is ${formatUsdc(params.fee)} USDC. Fund the smoke-test wallet or switch to a mintable local collateral token.`
    );
  }

  const allowance = (await params.publicClient.readContract({
    address: params.usdc,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: [params.account, params.spender]
  })) as bigint;

  if (allowance < params.fee) {
    const approveTx = await params.walletClient.writeContract({
      address: params.usdc,
      chain: polygonAmoy,
      abi: mockUsdcAbi,
      functionName: "approve",
      args: [params.spender, params.fee]
    });
    console.log("Approval tx:", approveTx);
    await params.publicClient.waitForTransactionReceipt({ hash: approveTx });
  }
}

async function readConfig(): Promise<CricketSmokeConfig> {
  const matchId = process.env.CRICKET_MATCH_ID?.trim();
  const league = process.env.CRICKET_LEAGUE?.trim() || "IPL";
  const teamA = process.env.CRICKET_TEAM_A?.trim().toUpperCase();
  const teamB = process.env.CRICKET_TEAM_B?.trim().toUpperCase();
  const selectedTeam = process.env.CRICKET_SELECTED_TEAM?.trim().toUpperCase();
  const discovered = !matchId ? await discoverFinishedMatch() : null;

  const resolvedMatchId = matchId || discovered?.matchId;
  const resolvedLeague = league || discovered?.league || "IPL";
  const resolvedTeamA = teamA || discovered?.teamA;
  const resolvedTeamB = teamB || discovered?.teamB;
  const resolvedSelectedTeam = selectedTeam || discovered?.selectedTeam || resolvedTeamA;

  if (!resolvedMatchId) {
    throw new Error(
      "Set CRICKET_MATCH_ID, or allow the smoke test to auto-discover a finished CricketData match."
    );
  }
  if (!resolvedTeamA || !resolvedTeamB) {
    throw new Error(
      "Set CRICKET_TEAM_A and CRICKET_TEAM_B, or make sure the auto-discovery returns a finished match title in the form Team A vs Team B."
    );
  }
  if (!resolvedSelectedTeam) {
    throw new Error("Set CRICKET_SELECTED_TEAM to the YES side you want to test.");
  }

  const durationMinutes = Number(process.env.CRICKET_DURATION_MINUTES || "5");
  const waitForSettlement = process.env.CRICKET_WAIT_FOR_SETTLEMENT !== "false";
  const maxWaitMinutes = Number(process.env.CRICKET_MAX_WAIT_MINUTES || "20");
  const pollMs = Number(process.env.CRICKET_SETTLEMENT_POLL_MS || "30000");

  return {
    matchId: resolvedMatchId,
    league: resolvedLeague,
    teamA: resolvedTeamA,
    teamB: resolvedTeamB,
    selectedTeam: resolvedSelectedTeam,
    question:
      process.env.CRICKET_QUESTION?.trim() ||
      discovered?.question ||
      `Will ${resolvedSelectedTeam} beat ${otherTeam(resolvedTeamA, resolvedTeamB, resolvedSelectedTeam)} in ${resolvedLeague}?`,
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 5,
    waitForSettlement,
    maxWaitMinutes: Number.isFinite(maxWaitMinutes) && maxWaitMinutes > 0 ? maxWaitMinutes : 20,
    pollMs: Number.isFinite(pollMs) && pollMs > 0 ? pollMs : 30_000
  };
}

async function discoverFinishedMatch(): Promise<DiscoveredMatch | null> {
  const sources = [
    "https://www.cricketdata.org/cricket-data-formats/results",
    "https://cricketdata.org/cricket-data-formats/results"
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) continue;

      const html = await response.text();
      const candidates = extractFinishedMatchCandidates(html);
      if (candidates.length === 0) continue;

      const pick = candidates[0];
      console.log("Auto-discovered finished cricket match:", pick.matchId, pick.teamA, "vs", pick.teamB);
      return pick;
    } catch (error) {
      console.warn(`CricketData discovery failed for ${source}:`, error instanceof Error ? error.message : error);
    }
  }

  return null;
}

function extractFinishedMatchCandidates(html: string): DiscoveredMatch[] {
  const candidates: DiscoveredMatch[] = [];
  const seen = new Set<string>();
  const hrefPattern = /href=["']([^"']*\/cricket-data-formats\/matches\/([^"']+?-[0-9a-fA-F-]{36}))["']/gi;

  for (const match of html.matchAll(hrefPattern)) {
    const href = match[1];
    const slug = match[2];
    const parsed = parseCricketMatchSlug(slug);
    if (!parsed) continue;

    const key = `${parsed.matchId}:${parsed.teamA}:${parsed.teamB}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      matchId: parsed.matchId,
      league: inferLeague(slug),
      teamA: parsed.teamA,
      teamB: parsed.teamB,
      selectedTeam: parsed.teamA,
      question: `Will ${parsed.teamA} beat ${parsed.teamB}?`
    });
  }

  return candidates;
}

function parseCricketMatchSlug(slug: string) {
  const matchId = slug.match(/[0-9a-fA-F-]{36}$/)?.[0];
  if (!matchId) return null;

  const withoutId = slug.slice(0, Math.max(0, slug.length - matchId.length - 1));
  const normalized = withoutId
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const split = normalized.split(/\svs\s/i);
  if (split.length < 2) return null;

  const teamA = cleanupTeamName(split[0]);
  const teamB = cleanupTeamName(split[1].replace(/\b(?:\d+(?:st|nd|rd|th)|final|qualifier|eliminator|super\s*over|match)\b.*$/i, ""));
  if (!teamA || !teamB) return null;

  return { matchId, teamA, teamB };
}

function parseMatchTitle(title: string) {
  const normalized = title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\-\|\u2013\u2014:]+\s*/, "");
  const parts = normalized.split(/\s+(?:vs\.?|v\.?|versus)\s+/i);
  if (parts.length < 2) {
    return null;
  }

  const teamA = cleanupTeamName(parts[0]);
  const teamB = cleanupTeamName(parts[1]);
  if (!teamA || !teamB) return null;
  return { teamA, teamB };
}

function inferLeague(text: string) {
  const value = text.toLowerCase();
  if (value.includes("ipl")) return "IPL";
  if (value.includes("world cup")) return "World Cup";
  if (value.includes("odi")) return "ODI";
  if (value.includes("t20")) return "T20";
  return "Cricket";
}

function cleanupTeamName(value: string) {
  return value
    .replace(/^(?:match|result|finished)\s+/i, "")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function extractCreatedMarket(logs: readonly unknown[]) {
  const events = parseEventLogs({
    abi: marketFactoryAbi,
    logs: logs as any[],
    eventName: "MarketCreated"
  });

  return events[0]?.args.market ?? null;
}

function otherTeam(teamA: string, teamB: string, selectedTeam: string) {
  return selectedTeam.toUpperCase() === teamA.toUpperCase() ? teamB : teamA;
}

function normalizePrivateKey(value: string | undefined): `0x${string}` | null {
  if (!value) return null;
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? (normalized as `0x${string}`) : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepUntil(epochMs: number) {
  const remaining = Math.max(0, epochMs - Date.now());
  if (remaining > 0) {
    console.log(`Sleeping ${Math.ceil(remaining / 1000)}s until expiry...`);
    await sleep(remaining);
  }
}

function formatUsdc(value: bigint) {
  return (Number(value) / 1_000_000).toFixed(2);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
