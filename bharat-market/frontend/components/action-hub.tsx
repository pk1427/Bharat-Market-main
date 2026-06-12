"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type PublicClient, formatEther, parseEther, parseUnits } from "viem";
import { ArrowUpRight, CalendarClock, Coins, Search, ShieldCheck, TimerReset, WalletCards } from "lucide-react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { ActionButton } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { TxStatusNotice } from "@/components/ui/tx-status-notice";
import { marketFactoryAbi, mockUsdcAbi } from "@/lib/abis";
import { collateralConfig } from "@/lib/collateral";
import { getRequiredAddresses } from "@/lib/contracts";
import { getSafeFeeOverrides } from "@/lib/fees";
import { formatTxError, formatUsdc } from "@/lib/format";
import { syncMarketAfterTransaction } from "@/lib/market-sync";
import {
  buildOracleQuestion,
  encodeOracleMetadata,
  normalizeOracleMetadata,
  type OracleMetadata,
  type OracleCategory
} from "@/lib/oracle-metadata";
import { dismissTxToast, failTxToast, handleTxToast, settleTxToast } from "@/lib/tx-toasts";

type CricketFixture = {
  id: string;
  name: string;
  matchType: string;
  status: string | null;
  venue: string | null;
  dateTimeGMT: string;
  teams: string[];
  teamA: string;
  teamB: string;
  league: string;
};

type CricketFixtureWindow = "24h" | "7d" | "all";

const defaultCreateForm = {
  question: "",
  category: "crypto" as OracleCategory,
  cryptoAsset: "ETH",
  cryptoTargetPrice: "5000",
  cryptoDirection: "price_above",
  cricketProvider: "cricapi",
  cricketMatchId: "",
  cricketLeague: "",
  cricketTeamA: "",
  cricketTeamB: "",
  cricketSelectedTeam: "",
  cricketMatchType: "",
  cricketStartTimeGMT: "",
  electionId: "",
  electionCandidate: "",
  electionRegion: "",
  electionType: "winner",
  durationMinutes: "180"
};

export function ActionHub({ onMarketCreated }: { onMarketCreated?: () => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const addresses = useMemo(() => getRequiredAddresses(), []);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [cricketFixtures, setCricketFixtures] = useState<CricketFixture[]>([]);
  const [cricketFixtureSearch, setCricketFixtureSearch] = useState("");
  const [cricketFixtureWindow, setCricketFixtureWindow] = useState<CricketFixtureWindow>("24h");
  const [cricketFixturesLoading, setCricketFixturesLoading] = useState(false);
  const [cricketFixtureError, setCricketFixtureError] = useState<string | null>(null);
  const [showCricketAdvanced, setShowCricketAdvanced] = useState(false);
  const [mintHash, setMintHash] = useState<`0x${string}` | undefined>();
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [createHash, setCreateHash] = useState<`0x${string}` | undefined>();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"pending" | "success" | "error" | null>(null);
  const [mintToastId, setMintToastId] = useState<string | number | null>(null);
  const [approveToastId, setApproveToastId] = useState<string | number | null>(null);
  const [createToastId, setCreateToastId] = useState<string | number | null>(null);
  const [creationFee, setCreationFee] = useState<bigint | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
  const [creationAllowance, setCreationAllowance] = useState<bigint>(0n);
  const [nativeBalance, setNativeBalance] = useState<bigint>(0n);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [mintConfirming, setMintConfirming] = useState(false);
  const [approveConfirming, setApproveConfirming] = useState(false);
  const [createConfirming, setCreateConfirming] = useState(false);
  const [walletRefreshNonce, setWalletRefreshNonce] = useState(0);

  const { writeContractAsync, isPending } = useWriteContract();

  const busy = isPending || mintConfirming || approveConfirming || createConfirming;
  const defaultMarketHref = useMemo(() => {
    if (!addresses?.defaultMarket) return null;
    return `/markets/${addresses.defaultMarket}`;
  }, [addresses?.defaultMarket]);
  const requiredFee = creationFee ?? parseUnits("10", 6);
  const minimumApprovalGasBalance = parseEther("0.02");
  const minimumCreateGasBalance = parseEther("0.35");
  const hasEnoughUsdc = (usdcBalance ?? 0n) >= requiredFee;
  const hasCreationApproval = (creationAllowance ?? 0n) >= requiredFee;
  const hasGasForApproval = nativeBalance >= minimumApprovalGasBalance;
  const hasGasForCreation = nativeBalance >= minimumCreateGasBalance;
  const nativeBalanceLabel = `${formatPol(nativeBalance)} POL`;
  const settlementTimestamp = useMemo(() => {
    const minutes = Number(createForm.durationMinutes || "0");
    return Math.floor(Date.now() / 1000) + Math.max(Number.isFinite(minutes) ? minutes : 0, 1) * 60;
  }, [createForm.durationMinutes]);
  const oracleMetadata = useMemo(() => {
    if (createForm.category === "crypto") {
      return normalizeOracleMetadata({
        category: "crypto",
        provider: "coingecko",
        asset: createForm.cryptoAsset,
        marketType: createForm.cryptoDirection,
        targetPrice: Number(createForm.cryptoTargetPrice),
        settlementTimestamp,
        externalId: createForm.cryptoAsset.toLowerCase(),
        verificationSource: "CoinGecko market chart range endpoint"
      });
    }

    if (createForm.category === "cricket") {
      return normalizeOracleMetadata({
        category: "cricket",
        provider: createForm.cricketProvider,
        matchId: createForm.cricketMatchId,
        league: createForm.cricketLeague,
        teamA: createForm.cricketTeamA,
        teamB: createForm.cricketTeamB,
        selectedTeam: createForm.cricketSelectedTeam,
        verificationSource: "Cricket score provider match result",
        fallbackSource: "Secondary sports score provider"
      });
    }

    return normalizeOracleMetadata({
      category: "election",
      provider: "staging",
      electionId: createForm.electionId,
      candidate: createForm.electionCandidate,
      region: createForm.electionRegion,
      electionType: createForm.electionType,
      verificationSource: "Verified election results source",
      fallbackSource: "Secondary certified result source"
    });
  }, [createForm, settlementTimestamp]);
  const encodedOracleQuery = oracleMetadata ? encodeOracleMetadata(oracleMetadata) : "";
  const structuredOracleCreationEnabled = process.env.NEXT_PUBLIC_STRUCTURED_ORACLES_ENABLED === "true";
  const legacyOracleQuery = oracleMetadata ? buildLegacyOracleQuery(oracleMetadata) : "";
  const contractOracleQuery = structuredOracleCreationEnabled ? encodedOracleQuery : legacyOracleQuery;
  const contractOracleType =
    createForm.category === "cricket" ? "sports" : createForm.category;
  const generatedQuestion = oracleMetadata ? buildOracleQuestion(oracleMetadata) : "";
  const questionPlaceholder =
    createForm.category === "cricket"
      ? "Select a fixture and YES side to generate the market question"
      : generatedQuestion || "Will ETH be above $5,000 at settlement?";
  const questionToCreate = createForm.question.trim() || generatedQuestion;
  const settlementRouteLabel =
    createForm.category === "crypto"
      ? "CoinGecko -> Chainlink -> on-chain resolution"
      : createForm.category === "cricket"
        ? "CricAPI -> Chainlink -> on-chain resolution"
        : "Provider adapter not enabled for production settlement";
  const creationBlockedReason =
    structuredOracleCreationEnabled && createForm.category === "election"
      ? "Election markets are not production-enabled yet."
      : null;
  const cricketWindowLabel =
    cricketFixtureWindow === "24h"
      ? "CricAPI fixtures starting in the next 24 hours"
      : cricketFixtureWindow === "7d"
        ? "CricAPI fixtures starting in the next 7 days"
        : "All upcoming CricAPI fixtures from the scanned schedule";

  useEffect(() => {
    let cancelled = false;

    async function loadWalletData() {
      if (!addresses) return;

      try {
        setWalletLoading(true);
        setWalletError(null);
        const params = new URLSearchParams();
        if (address) {
          params.set("account", address);
        }

        const response = await fetch(`/api/wallet?${params.toString()}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          creationFee?: string;
          usdcBalance?: string;
          creationAllowance?: string;
          nativeBalance?: string;
        };

        if (!response.ok || !payload.creationFee) {
          throw new Error("Failed to load wallet data.");
        }

        if (!cancelled) {
          setCreationFee(BigInt(payload.creationFee));
          setUsdcBalance(BigInt(payload.usdcBalance ?? "0"));
          setCreationAllowance(BigInt(payload.creationAllowance ?? "0"));
          setNativeBalance(BigInt(payload.nativeBalance ?? "0"));
          setWalletLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setCreationFee(null);
          setCreationAllowance(0n);
          setNativeBalance(0n);
          setWalletError(err instanceof Error ? err.message : "Wallet sync unavailable.");
          setWalletLoading(false);
        }
      }
    }

    void loadWalletData();

    return () => {
      cancelled = true;
    };
  }, [address, addresses, walletRefreshNonce]);

  useEffect(() => {
    if (createForm.category !== "cricket") return;

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setCricketFixturesLoading(true);
        setCricketFixtureError(null);
        const params = new URLSearchParams({ limit: "12", window: cricketFixtureWindow });
        if (cricketFixtureSearch.trim()) {
          params.set("search", cricketFixtureSearch.trim());
        }

        const response = await fetch(`/api/oracles/cricket/fixtures?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json()) as { data?: CricketFixture[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load upcoming cricket fixtures.");
        }

        const fixtures = Array.isArray(payload.data) ? payload.data : [];
        if (!cancelled && !cricketFixtureSearch.trim() && fixtures.length === 0) {
          if (cricketFixtureWindow === "24h") {
            setCricketFixtureWindow("7d");
            return;
          }

          if (cricketFixtureWindow === "7d") {
            setCricketFixtureWindow("all");
            return;
          }
        }

        if (!cancelled) {
          setCricketFixtures(fixtures);
          setCricketFixturesLoading(false);
        }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          setCricketFixtureError(err instanceof Error ? err.message : "Unable to load upcoming cricket fixtures.");
          setCricketFixturesLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [createForm.category, cricketFixtureSearch, cricketFixtureWindow]);

  function selectCricketFixture(fixture: CricketFixture, selectedTeam = fixture.teamA) {
    const opponent = selectedTeam === fixture.teamA ? fixture.teamB : fixture.teamA;
    setCreateForm((current) => ({
      ...current,
      category: "cricket",
      question: shouldRegenerateCricketQuestion(current.question) ? `Will ${selectedTeam} beat ${opponent}?` : current.question,
      cricketProvider: "cricapi",
      cricketMatchId: fixture.id,
      cricketLeague: fixture.league,
      cricketTeamA: fixture.teamA,
      cricketTeamB: fixture.teamB,
      cricketSelectedTeam: selectedTeam,
      cricketMatchType: fixture.matchType,
      cricketStartTimeGMT: fixture.dateTimeGMT,
      durationMinutes: suggestCricketDurationMinutes(fixture.dateTimeGMT, fixture.matchType)
    }));
  }

  async function handleMintUsdc() {
    const client = publicClient;
    if (!address || !addresses || !client) return;
    let pendingToastId: string | number | null = null;

    try {
      setError(null);
      setStatus(`Minting 100 ${collateralConfig.label} to your wallet...`);
      setStatusTone("pending");
      const fees = await getSafeFeeOverrides(client);
      const hash = await writeContractAsync({
        address: addresses.usdc,
        abi: mockUsdcAbi,
        functionName: "mint",
        args: [address, parseUnits("100", 6)],
        ...fees
      });
      setMintHash(hash);
      const toastId = handleTxToast({ hash, pendingLabel: `Minting ${collateralConfig.label}...` });
      pendingToastId = toastId;
      setMintToastId(toastId);
      setMintConfirming(true);
      const receipt = await waitForPropagatedReceipt(client, hash);
      setMintConfirming(false);
      if (receipt.status !== "success") {
        throw new Error(`${collateralConfig.label} mint reverted on-chain.`);
      }
      settleTxToast({
        id: toastId,
        hash,
        status: "success",
        successLabel: `${collateralConfig.label} minted.`,
        errorLabel: `${collateralConfig.label} mint failed.`
      });
      setStatus(`${collateralConfig.label} ready in your wallet.`);
      setStatusTone("success");
      setWalletRefreshNonce((value) => value + 1);
    } catch (err) {
      setMintConfirming(false);
      dismissTxToast(pendingToastId);
      const message = formatTxError(err);
      failTxToast(message);
      setStatusTone("error");
      setError(message);
    }
  }

  async function handleApproveCreationFee() {
    const client = publicClient;
    if (!addresses || !client) return;
    let pendingToastId: string | number | null = null;

    try {
      setError(null);
      if (!hasGasForApproval) {
        throw new Error(
          `Add more POL for Amoy gas before approving. You have ${nativeBalanceLabel}; BharatMarket recommends at least ${formatPol(minimumApprovalGasBalance)} POL for approval.`
        );
      }
      setStatus(`Approving ${formatUsdc(requiredFee)} for market creation...`);
      setStatusTone("pending");
      const fees = await getSafeFeeOverrides(client);
      const hash = await writeContractAsync({
        address: addresses.usdc,
        abi: mockUsdcAbi,
        functionName: "approve",
        args: [addresses.marketFactory, requiredFee],
        ...fees
      });
      setApproveHash(hash);
      const toastId = handleTxToast({ hash, pendingLabel: "Approving creation fee..." });
      pendingToastId = toastId;
      setApproveToastId(toastId);
      setApproveConfirming(true);
      const receipt = await waitForPropagatedReceipt(client, hash);
      setApproveConfirming(false);
      if (receipt.status !== "success") {
        throw new Error("Creation fee approval reverted on-chain.");
      }
      settleTxToast({
        id: toastId,
        hash,
        status: "success",
        successLabel: "Creation fee approved.",
        errorLabel: "Creation fee approval failed."
      });
      setStatus("Creation fee approved. You can create the market now.");
      setStatusTone("success");
      setWalletRefreshNonce((value) => value + 1);
    } catch (err) {
      setApproveConfirming(false);
      dismissTxToast(pendingToastId);
      setApproveHash(undefined);
      setApproveToastId(null);
      const message = formatTxError(err);
      failTxToast(message);
      setStatusTone("error");
      setError(message);
    }
  }

  async function handleCreateMarket() {
    const client = publicClient;
    if (!addresses || !client) return;
    let pendingToastId: string | number | null = null;

    try {
      setError(null);
      if (!questionToCreate.trim()) {
        throw new Error("Add a market question before creating the contract.");
      }
      if (!oracleMetadata || !contractOracleQuery) {
        throw new Error("Complete the structured oracle metadata before creating the market.");
      }
      if (creationBlockedReason) {
        throw new Error(creationBlockedReason);
      }
      if (!hasEnoughUsdc) {
        throw new Error(`You need at least ${formatUsdc(requiredFee)} to pay the creation fee.`);
      }
      if (!hasCreationApproval) {
        throw new Error(`Approve ${collateralConfig.label} for the creation fee before creating the market.`);
      }
      if (!hasGasForCreation) {
        throw new Error(
          `Add more POL for Amoy gas before creating. You have ${nativeBalanceLabel}; market creation deploys contracts and BharatMarket recommends at least ${formatPol(minimumCreateGasBalance)} POL.`
        );
      }

      const durationMinutes = Number(createForm.durationMinutes);
      const endTime = BigInt(Math.floor(Date.now() / 1000) + durationMinutes * 60);
      const gas = await client
        .estimateContractGas({
          address: addresses.marketFactory,
          abi: marketFactoryAbi,
          functionName: "createMarket",
          args: [questionToCreate, endTime, contractOracleType, contractOracleQuery],
          account: address
        })
        .then((value) => (value * 12n) / 10n)
        .catch(() => 5_000_000n);
      const fees = await getSafeFeeOverrides(client);

      setStatus("Creating market on BharatMarket...");
      setStatusTone("pending");
      const hash = await writeContractAsync({
        address: addresses.marketFactory,
        abi: marketFactoryAbi,
        functionName: "createMarket",
        args: [questionToCreate, endTime, contractOracleType, contractOracleQuery],
        gas,
        ...fees
      });
      setCreateHash(hash);
      const toastId = handleTxToast({ hash, pendingLabel: "Creating market..." });
      pendingToastId = toastId;
      setCreateToastId(toastId);
      setCreateConfirming(true);
      const receipt = await waitForPropagatedReceipt(client, hash, 240_000);
      setCreateConfirming(false);
      if (receipt.status !== "success") {
        throw new Error("Market creation reverted on-chain.");
      }
      await syncMarketAfterTransaction({ txHash: hash, mode: "create" });
      settleTxToast({
        id: toastId,
        hash,
        status: "success",
        successLabel: "Market created.",
        errorLabel: "Market creation failed."
      });
      setStatus("Market created. Refresh the market board.");
      setStatusTone("success");
      onMarketCreated?.();
      setCreateForm({
        ...defaultCreateForm
      });
      setWalletRefreshNonce((value) => value + 1);
    } catch (err) {
      setCreateConfirming(false);
      dismissTxToast(pendingToastId);
      const message = formatTxError(err);
      failTxToast(message);
      setStatusTone("error");
      setError(message);
    }
  }

  const durationLabel = useMemo(() => {
    const minutes = Number(createForm.durationMinutes || "0");
    if (!minutes || Number.isNaN(minutes)) return "No duration selected";
    if (minutes >= 1440) return `${Math.round(minutes / 1440)} day window`;
    if (minutes >= 60) return `${Math.round(minutes / 60)} hour window`;
    return `${minutes} minute window`;
  }, [createForm.durationMinutes]);
  const cricketAutoExpiryLabel = useMemo(() => {
    if (!createForm.cricketStartTimeGMT) return "Select fixture";
    return formatCricketAutoExpiry(createForm.cricketStartTimeGMT, createForm.cricketMatchType);
  }, [createForm.cricketMatchType, createForm.cricketStartTimeGMT]);
  const launchExpiryLabel = createForm.category === "cricket" ? cricketAutoExpiryLabel : durationLabel;

  return (
    <>
      <Panel className="p-4 sm:p-5">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--accent)]">
            Step 1 / Market Type
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            What kind of market are you creating?
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
            Pick the settlement route first. BharatMarket will show only the inputs needed for that oracle path.
          </p>
        </div>

        <div className="mx-auto mt-5 grid max-w-5xl gap-3 md:grid-cols-3">
          <CategoryButton
            active={createForm.category === "crypto"}
            title="Crypto"
            subtitle="CoinGecko price markets"
            description="BTC, ETH, SOL, and USDC rules with price-above or price-below settlement."
            ready
            onClick={() => setCreateForm((current) => ({ ...current, category: "crypto" }))}
          />
          <CategoryButton
            active={createForm.category === "cricket"}
            title="Cricket"
            subtitle="CricAPI fixture markets"
            description="Pick a real upcoming fixture and choose which team resolves YES."
            ready
            onClick={() => setCreateForm((current) => ({ ...current, category: "cricket" }))}
          />
          <CategoryButton
            active={createForm.category === "election"}
            title="Election"
            subtitle="Future oracle route"
            description="Architecture is reserved, but production settlement is intentionally disabled."
            onClick={() => setCreateForm((current) => ({ ...current, category: "election" }))}
          />
        </div>
      </Panel>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:items-start">
      <Panel className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
              Step 2 / Configure
            </p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-[color:var(--text-primary)]">
              {createForm.category === "crypto"
                ? "Configure crypto settlement"
                : createForm.category === "cricket"
                  ? "Choose fixture and outcome"
                  : "Election route preview"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
              {createForm.category === "crypto"
                ? "Set the asset, target price, direction, and expiry window. BharatMarket converts it into deterministic CoinGecko oracle metadata."
                : createForm.category === "cricket"
                  ? "Search provider fixtures, select a YES side, then review the generated CricAPI settlement rule before deployment."
                  : "Election markets stay visible as a future provider slot until verified result sources are enabled."}
            </p>
          </div>

          {defaultMarketHref ? (
            <Link
              href={defaultMarketHref}
              className="hidden items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:text-white xl:inline-flex"
            >
              Open Latest
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-5">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Question</p>
                <p className="mt-1 text-sm text-slate-400">Use the generated question or write a clearer version.</p>
              </div>
              {generatedQuestion ? (
                <button
                  type="button"
                  onClick={() => setCreateForm((current) => ({ ...current, question: generatedQuestion }))}
                  className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-white/20 hover:text-white sm:inline-flex"
                >
                  Use generated
                </button>
              ) : null}
            </div>
            <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Market Question
            </label>
            <input
              value={createForm.question}
              onChange={(event) => setCreateForm((current) => ({ ...current, question: event.target.value }))}
              placeholder={questionPlaceholder}
              className="field-control px-4 py-3 text-sm"
            />
            <p className="text-xs text-slate-500">
              Phrase the contract so the answer resolves clearly to YES or NO.
            </p>
          </div>

          {createForm.category === "crypto" ? (
            <div className="overflow-hidden rounded-[24px] border border-violet-400/15 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.16),transparent_34%),rgba(255,255,255,0.025)]">
              <div className="border-b border-white/10 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-200">Crypto Rule Builder</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Define the price condition</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                  Choose an asset, target, and direction. BharatMarket converts this into a CoinGecko + Chainlink settlement rule.
                </p>
              </div>

              <div className="grid gap-4 p-4">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">1. Asset</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400">
                      CoinGecko
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { symbol: "ETH", name: "Ethereum", hint: "Large-cap crypto" },
                      { symbol: "BTC", name: "Bitcoin", hint: "Benchmark asset" },
                      { symbol: "SOL", name: "Solana", hint: "High-beta L1" },
                      { symbol: "USDC", name: "USD Coin", hint: "Stablecoin parity" }
                    ].map((asset) => (
                      <CryptoAssetOption
                        key={asset.symbol}
                        active={createForm.cryptoAsset === asset.symbol}
                        symbol={asset.symbol}
                        name={asset.name}
                        hint={asset.hint}
                        onClick={() =>
                          setCreateForm((current) => ({
                            ...current,
                            cryptoAsset: asset.symbol,
                            question: shouldRegenerateQuestion(current.question) ? "" : current.question
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">2. Direction</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <DirectionChoice
                        active={createForm.cryptoDirection === "price_above"}
                        label="Above"
                        detail="YES if price is at or above target"
                        onClick={() =>
                          setCreateForm((current) => ({
                            ...current,
                            cryptoDirection: "price_above",
                            question: shouldRegenerateQuestion(current.question) ? "" : current.question
                          }))
                        }
                      />
                      <DirectionChoice
                        active={createForm.cryptoDirection === "price_below"}
                        label="Below"
                        detail="YES if price is at or below target"
                        onClick={() =>
                          setCreateForm((current) => ({
                            ...current,
                            cryptoDirection: "price_below",
                            question: shouldRegenerateQuestion(current.question) ? "" : current.question
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">3. Target price</p>
                      <span className="text-xs text-slate-500">USD</span>
                    </div>
                    <div className="mt-3">
                      <input
                        value={createForm.cryptoTargetPrice}
                        onChange={(event) => setCreateForm((current) => ({ ...current, cryptoTargetPrice: event.target.value, question: shouldRegenerateQuestion(current.question) ? "" : current.question }))}
                        placeholder="5000"
                        inputMode="decimal"
                        className="field-control w-full px-4 py-4 text-lg font-semibold"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["2000", "3000", "5000", "100000"].map((price) => (
                        <button
                          key={price}
                          type="button"
                          onClick={() => setCreateForm((current) => ({ ...current, cryptoTargetPrice: price, question: shouldRegenerateQuestion(current.question) ? "" : current.question }))}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
                        >
                          ${Number(price).toLocaleString("en-US")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-mint/15 bg-mint/[0.05] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mint">Generated rule</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {oracleMetadata?.category === "crypto" ? oracleMetadata.settlementRule : "Complete the crypto rule to generate settlement metadata."}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Chainlink Functions fetches the provider price after expiry and returns the deterministic YES/NO outcome.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {creationBlockedReason ? (
            <div className="rounded-[18px] border border-gold/20 bg-gold/10 p-4 text-sm leading-6 text-gold">
              {creationBlockedReason} Select Crypto or Cricket to create an end-to-end resolvable market.
            </div>
          ) : null}

          {createForm.category === "cricket" ? (
            <div className="overflow-hidden rounded-[24px] border border-mint/15 bg-[radial-gradient(circle_at_top_left,rgba(95,242,191,0.12),transparent_34%),rgba(255,255,255,0.025)]">
              <div className="border-b border-white/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mint">Fixture Picker</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">Pick a real upcoming match</h3>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
                      No manual IDs. Pick a provider fixture, choose the YES side, and BharatMarket auto-fills teams, match id, and market close timing.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["24h", "7d", "all"] as CricketFixtureWindow[]).map((window) => (
                      <button
                        key={window}
                        type="button"
                        onClick={() => setCricketFixtureWindow(window)}
                        className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                          cricketFixtureWindow === window
                            ? "border-mint/40 bg-mint/20 text-mint"
                            : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
                        }`}
                      >
                      {window === "24h" ? "Next 24h" : window === "7d" ? "7 days" : "All fixtures"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="grid gap-2">
                    <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      Search fixtures
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={cricketFixtureSearch}
                        onChange={(event) => setCricketFixtureSearch(event.target.value)}
                        placeholder="Team or series, e.g. England Women"
                        className="field-control w-full py-3 pl-10 pr-4 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setCricketFixtureSearch("");
                        setCricketFixtureWindow("24h");
                      }}
                      className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                    >
                      Reset discovery
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCricketAdvanced((value) => !value)}
                      className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
                    >
                      {showCricketAdvanced ? "Hide manual override" : "Manual override"}
                    </button>
                  </div>
                </div>

                <div className="rounded-[16px] border border-sky-400/15 bg-sky-400/[0.06] px-4 py-3 text-xs leading-5 text-slate-300">
                  <span className="font-semibold text-sky-200">Provider window:</span>{" "}
                  {cricketWindowLabel}. Empty windows widen automatically from 24 hours to 7 days, then to all scanned upcoming fixtures. Search a team/series to narrow discovery.
                </div>

                {createForm.cricketMatchId ? (
                  <div className="rounded-[18px] border border-mint/20 bg-mint/[0.06] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mint">Selected fixture</p>
                        <p className="mt-1 text-base font-semibold text-white">
                          {createForm.cricketTeamA} vs {createForm.cricketTeamB}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{createForm.cricketLeague}</p>
                      </div>
                      <div className="grid gap-2 text-xs sm:grid-cols-3 lg:min-w-[360px]">
                        <SelectedFixtureMetric label="YES side" value={createForm.cricketSelectedTeam} tone="mint" />
                        <SelectedFixtureMetric label="Auto close" value={cricketAutoExpiryLabel} />
                        <SelectedFixtureMetric label="Route" value="CricAPI" />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[18px] border border-white/10 bg-black/15 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      {cricketFixtureWindow === "24h" ? "Next 24h" : cricketFixtureWindow === "7d" ? "Next 7 days" : "All upcoming"}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400">
                      {cricketFixtures.length} found
                    </span>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto pr-1">
                    <div className="grid gap-2">
                      {cricketFixturesLoading ? (
                        <div className="rounded-[var(--r-md)] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                          Loading upcoming fixtures from CricAPI...
                        </div>
                      ) : null}
                      {cricketFixtureError ? (
                        <div className="rounded-[var(--r-md)] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
                          {cricketFixtureError}
                        </div>
                      ) : null}
                      {!cricketFixturesLoading && !cricketFixtureError && cricketFixtures.length === 0 ? (
                        <div className="rounded-[var(--r-md)] border border-gold/20 bg-gold/10 p-4 text-sm leading-6 text-gold">
                          No fixtures found in the scanned provider data. Try searching a specific team or series name.
                        </div>
                      ) : null}
                      {cricketFixtures.map((fixture) => (
                        <CricketFixtureCard
                          key={fixture.id}
                          fixture={fixture}
                          selected={createForm.cricketMatchId === fixture.id}
                          selectedTeam={createForm.cricketSelectedTeam}
                          onSelect={(team) => selectCricketFixture(fixture, team)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {showCricketAdvanced ? (
                <div className="border-t border-white/10 p-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Fixture ID" value={createForm.cricketMatchId} onChange={(value) => setCreateForm((current) => ({ ...current, cricketMatchId: value }))} placeholder="CricAPI match id" />
                    <Field label="Team A" value={createForm.cricketTeamA} onChange={(value) => setCreateForm((current) => ({ ...current, cricketTeamA: value, cricketSelectedTeam: current.cricketSelectedTeam || value }))} placeholder="England Women" />
                    <Field label="Team B" value={createForm.cricketTeamB} onChange={(value) => setCreateForm((current) => ({ ...current, cricketTeamB: value }))} placeholder="Scotland Women" />
                    <Field label="League" value={createForm.cricketLeague} onChange={(value) => setCreateForm((current) => ({ ...current, cricketLeague: value }))} placeholder="ICC Womens T20 World Cup 2026" />
                    <Field label="YES Team" value={createForm.cricketSelectedTeam} onChange={(value) => setCreateForm((current) => ({ ...current, cricketSelectedTeam: value }))} placeholder="England Women" />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {createForm.category === "election" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Election ID" value={createForm.electionId} onChange={(value) => setCreateForm((current) => ({ ...current, electionId: value }))} placeholder="india_pm_2029" />
              <Field label="Candidate / Party" value={createForm.electionCandidate} onChange={(value) => setCreateForm((current) => ({ ...current, electionCandidate: value }))} placeholder="Candidate name" />
              <Field label="Region" value={createForm.electionRegion} onChange={(value) => setCreateForm((current) => ({ ...current, electionRegion: value }))} placeholder="India" />
              <Field label="Election Type" value={createForm.electionType} onChange={(value) => setCreateForm((current) => ({ ...current, electionType: value }))} placeholder="winner" />
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_bottom_right,rgba(95,242,191,0.10),transparent_32%),rgba(255,255,255,0.025)]">
            <div className="border-b border-white/10 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">Step 3 / Timing and launch</p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {createForm.category === "cricket" ? "Confirm fixture timing and deploy" : "Set expiry and deploy"}
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {createForm.category === "cricket"
                  ? "Cricket markets use provider fixture timing. BharatMarket estimates market close from match type, then requests Chainlink settlement after the fixture result is available."
                  : "Expiry controls when trading closes. The resolution worker requests Chainlink settlement after the market has ended."}
              </p>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              {createForm.category === "cricket" ? (
                <div className="rounded-[18px] border border-mint/15 bg-mint/[0.05] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mint">Fixture-based close</p>
                      <p className="mt-1 text-sm text-slate-300">No manual duration needed for cricket markets.</p>
                    </div>
                    <div className="flex items-center gap-2 text-mint">
                      <CalendarClock className="h-4 w-4" />
                      <span className="text-sm font-semibold">{cricketAutoExpiryLabel}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <LaunchMetric icon={TimerReset} label="Trading window" value={createForm.cricketStartTimeGMT ? "Auto from fixture" : "Select fixture"} />
                    <LaunchMetric icon={CalendarClock} label="Fixture start" value={createForm.cricketStartTimeGMT ? formatFixtureStart(createForm.cricketStartTimeGMT) : "Waiting for fixture"} />
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-400">
                    The contract still receives an on-chain expiry timestamp, but creators do not need to choose it manually. BharatMarket estimates close from the official fixture start and match format.
                  </p>
                </div>
              ) : (
                <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Duration</p>
                      <p className="mt-1 text-sm text-slate-400">Choose a trading window in minutes.</p>
                    </div>
                    <div className="flex items-center gap-2 text-mint">
                      <TimerReset className="h-4 w-4" />
                      <span className="text-sm font-semibold">{durationLabel}</span>
                    </div>
                  </div>

                  <input
                    value={createForm.durationMinutes}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, durationMinutes: event.target.value }))
                    }
                    placeholder="180"
                    inputMode="numeric"
                    className="field-control mt-4 w-full px-4 py-4 text-lg font-semibold"
                  />

                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {[
                      { label: "3h", value: "180" },
                      { label: "6h", value: "360" },
                      { label: "24h", value: "1440" },
                      { label: "7d", value: "10080" }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCreateForm((current) => ({ ...current, durationMinutes: option.value }))}
                        className={`rounded-[14px] border px-3 py-3 text-sm font-semibold transition ${
                          createForm.durationMinutes === option.value
                            ? "border-mint/40 bg-mint/20 text-mint"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3">
                <LaunchMetric icon={ShieldCheck} label="Settlement route" value={settlementRouteLabel} />
                <LaunchMetric icon={Coins} label="Creation fee" value={formatUsdc(requiredFee)} />
                <LaunchMetric icon={WalletCards} label="Wallet balance" value={walletLoading ? "Syncing" : walletError ? "Unavailable" : formatUsdc(usdcBalance ?? 0n)} />
              </div>
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionButton
                  onClick={handleApproveCreationFee}
                  disabled={!address || !addresses || busy || hasCreationApproval || !hasGasForApproval}
                  tone="mint"
                  className="justify-center py-3.5"
                >
                  {approveConfirming
                    ? "Approving..."
                    : hasCreationApproval
                      ? "Creation Fee Approved"
                      : "Approve Creation Fee"}
                </ActionButton>

                <ActionButton
                  onClick={handleCreateMarket}
                  disabled={!address || !addresses || busy || !oracleMetadata || !contractOracleQuery || !hasCreationApproval || !hasEnoughUsdc || !hasGasForCreation || Boolean(creationBlockedReason)}
                  tone="gold"
                  className="justify-center py-3.5"
                >
                  {createConfirming ? "Creating..." : "Create Market"}
                </ActionButton>
              </div>
            </div>
          </div>

          {!hasGasForApproval ? (
            <TxStatusNotice
              state="error"
              title="More POL needed for approval gas"
              detail={`Your wallet has ${nativeBalanceLabel}. Add at least ${formatPol(minimumApprovalGasBalance)} POL on Amoy, then refresh and try approval again.`}
            />
          ) : null}
          {hasGasForApproval && !hasGasForCreation ? (
            <TxStatusNotice
              state="pending"
              title="Approval gas is available, but creation needs more POL"
              detail={`Your wallet has ${nativeBalanceLabel}. Market creation deploys contracts, so keep around ${formatPol(minimumCreateGasBalance)} POL before clicking Create Market.`}
            />
          ) : null}
          {status && statusTone ? <TxStatusNotice state={statusTone} title={status} /> : null}
          {approveHash && approveConfirming ? (
            <TxStatusNotice
              state="pending"
              title="Waiting for approval confirmation"
              detail="Polygon Amoy can take a little while. You can keep this page open while BharatMarket watches the approval receipt."
            />
          ) : null}
          {error ? <TxStatusNotice state="error" title="Create market failed" detail={error} /> : null}
        </div>
      </Panel>

      <div className="space-y-3 xl:sticky xl:top-24">
        <Panel className="p-3.5 sm:p-4">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
            Launch Summary
          </p>

          <div className="mt-3 space-y-2.5">
            <div className="rounded-[20px] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] p-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">Question</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">
                {questionToCreate || "Your market question will appear here"}
              </p>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.025] p-3.5">
              <SummaryRow label="Market type" value={createForm.category === "cricket" ? "Cricket" : createForm.category === "crypto" ? "Crypto" : "Election"} />
              <SummaryRow label="Oracle route" value={settlementRouteLabel} />
              <SummaryRow label="Expiry" value={launchExpiryLabel} />
              <SummaryRow label="Creation fee" value={formatUsdc(requiredFee)} />
              <SummaryRow label="Wallet" value={walletLoading ? "Syncing" : walletError ? "Unavailable" : formatUsdc(usdcBalance ?? 0n)} />
            </div>

            {oracleMetadata?.settlementRule ? (
              <div className="rounded-[20px] border border-mint/15 bg-mint/[0.04] p-3.5 text-sm text-slate-300">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-mint">Settlement Rule</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-[color:var(--text-primary)]">
                  {oracleMetadata.settlementRule}
                </p>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="p-3.5 sm:p-4">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
            Funding
          </p>

          <p className="mt-3 text-xs leading-5 text-[color:var(--text-secondary)]">
            {collateralConfig.isMintable
              ? `Fund your connected wallet with ${collateralConfig.label} before launching the market.`
              : `Make sure the connected wallet is funded with ${collateralConfig.label} before creating the contract.`}
          </p>

          <div className="mt-3 grid gap-2">
            {collateralConfig.isMintable ? (
              <ActionButton
                onClick={handleMintUsdc}
                disabled={!address || !addresses || busy}
                tone="mint"
                className="justify-center"
              >
                {mintConfirming ? "Minting..." : `Mint 100 ${collateralConfig.label}`}
              </ActionButton>
            ) : collateralConfig.faucetUrl ? (
              <a
                href={collateralConfig.faucetUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-[14px] border border-mint/30 bg-mint/15 px-4 py-3 text-center font-semibold text-mint transition hover:border-mint/50"
              >
                Get {collateralConfig.label} from Faucet
              </a>
            ) : null}

            {defaultMarketHref ? (
              <Link
                href={defaultMarketHref}
                className="rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-center font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Open Latest Market
              </Link>
            ) : null}
          </div>
        </Panel>
      </div>
    </section>
    </>
  );
}

function CricketFixtureCard({
  fixture,
  selected,
  selectedTeam,
  onSelect
}: {
  fixture: CricketFixture;
  selected: boolean;
  selectedTeam: string;
  onSelect: (team: string) => void;
}) {
  const teams = fixture.teams.length >= 2 ? fixture.teams.slice(0, 2) : [fixture.teamA, fixture.teamB].filter(Boolean);

  return (
    <div
      className={`rounded-[18px] border p-3.5 transition ${
        selected
          ? "border-mint/30 bg-mint/[0.06] shadow-[0_0_24px_rgba(95,242,191,0.08)]"
          : "border-white/10 bg-white/[0.035] hover:border-white/20"
      }`}
    >
      <div className="grid gap-3 lg:grid-cols-[150px_minmax(0,1fr)_auto] lg:items-center">
        <div className="rounded-[14px] border border-white/10 bg-black/20 p-3">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">
            {fixture.matchType}
          </span>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold leading-5 text-white">
            <CalendarClock className="h-3.5 w-3.5 text-mint" />
            {formatFixtureStart(fixture.dateTimeGMT)}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-white">{fixture.teamA} vs {fixture.teamB}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{fixture.name}</p>
          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.12em] text-slate-500">
            {fixture.venue ?? fixture.league}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[250px]">
          {teams.map((team) => (
            <button
              key={`${fixture.id}-${team}`}
              type="button"
              onClick={() => onSelect(team)}
              className={`rounded-[14px] border px-3 py-3 text-xs font-semibold leading-4 transition ${
                selected && selectedTeam === team
                  ? "border-mint/40 bg-mint/20 text-mint"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white"
              }`}
            >
              <span className="block font-mono text-[9px] uppercase tracking-[0.16em] opacity-70">YES</span>
              {team}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SelectedFixtureMetric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "mint";
}) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-black/20 p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${tone === "mint" ? "text-mint" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function CryptoAssetOption({
  active,
  symbol,
  name,
  hint,
  onClick
}: {
  active: boolean;
  symbol: string;
  name: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] border p-4 text-left transition ${
        active
          ? "border-violet-300/40 bg-violet-400/15 text-white shadow-[0_0_24px_rgba(124,58,237,0.12)]"
          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:text-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xl font-semibold">{symbol}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-mint shadow-[0_0_12px_rgba(95,242,191,0.9)]" : "bg-white/20"}`} />
      </div>
      <p className="mt-2 text-sm font-semibold">{name}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
    </button>
  );
}

function DirectionChoice({
  active,
  label,
  detail,
  onClick
}: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[16px] border p-4 text-left transition ${
        active
          ? "border-mint/40 bg-mint/15 text-mint"
          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:text-white"
      }`}
    >
      <p className="text-base font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </button>
  );
}

function LaunchMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="font-mono text-[10px] uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-semibold leading-5 text-white">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-2.5 last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="max-w-[190px] text-right text-sm font-semibold leading-5 text-white">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-control px-4 py-3 text-sm"
      />
    </div>
  );
}

function CategoryButton({
  active,
  title,
  subtitle,
  description,
  ready = false,
  onClick
}: {
  active: boolean;
  title: string;
  subtitle: string;
  description?: string;
  ready?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[24px] border p-5 text-left transition ${
        active
          ? "border-mint/40 bg-[linear-gradient(135deg,rgba(95,242,191,0.18),rgba(124,58,237,0.08))] text-white shadow-[0_0_34px_rgba(95,242,191,0.10)]"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
      }`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-lg font-semibold uppercase">{title}</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{subtitle}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.2em] ${
          ready ? "bg-mint/15 text-mint" : "bg-gold/10 text-gold"
        }`}>
          {ready ? "Live" : "Soon"}
        </span>
      </div>
      {description ? (
        <p className="mt-4 min-h-[44px] text-sm leading-6 text-slate-400">{description}</p>
      ) : null}
      <div className={`mt-5 h-1.5 rounded-full ${active ? "bg-mint" : "bg-white/10"}`} />
    </button>
  );
}

function buildLegacyOracleQuery(metadata: OracleMetadata) {
  if (metadata.category === "crypto") {
    return `${metadata.asset.toLowerCase()}_price`;
  }

  if (metadata.category === "cricket") {
    return `${metadata.teamA.toLowerCase()}_vs_${metadata.teamB.toLowerCase()}`;
  }

  return metadata.electionId;
}

function shouldRegenerateQuestion(question: string) {
  const trimmed = question.trim();
  return !trimmed || /^Will (ETH|BTC|SOL|USDC) be (above|below) \$/i.test(trimmed);
}

function shouldRegenerateCricketQuestion(question: string) {
  const trimmed = question.trim();
  return !trimmed || /^Will .+ beat .+\?$/i.test(trimmed);
}

function suggestCricketDurationMinutes(dateTimeGMT: string, matchType = "") {
  const startMs = Date.parse(`${dateTimeGMT}Z`);
  if (!Number.isFinite(startMs)) return "300";

  const closeMs = estimateCricketCloseMs(dateTimeGMT, matchType);
  if (!Number.isFinite(closeMs)) return "300";

  const minutesUntilClose = Math.ceil((closeMs - Date.now()) / 60_000);
  return String(Math.max(minutesUntilClose, 60));
}

function estimateCricketCloseMs(dateTimeGMT: string, matchType = "") {
  const startMs = Date.parse(`${dateTimeGMT}Z`);
  if (!Number.isFinite(startMs)) return Number.NaN;

  const normalized = matchType.toLowerCase();
  const bufferHours = normalized.includes("test")
    ? 5 * 24
    : normalized.includes("odi")
      ? 9
      : normalized.includes("t20")
        ? 4
        : 5;

  return startMs + bufferHours * 60 * 60 * 1000;
}

function formatCricketAutoExpiry(dateTimeGMT: string, matchType = "") {
  const closeMs = estimateCricketCloseMs(dateTimeGMT, matchType);
  if (!Number.isFinite(closeMs)) return "Auto after fixture";

  return `${new Date(closeMs).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })} IST`;
}

function formatFixtureStart(dateTimeGMT: string) {
  const startMs = Date.parse(`${dateTimeGMT}Z`);
  if (!Number.isFinite(startMs)) return "Start time pending";

  return `${new Date(startMs).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })} IST`;
}

function formatPol(value: bigint) {
  const numeric = Number(formatEther(value));
  if (!Number.isFinite(numeric)) return "0.0000";
  if (numeric >= 1) return numeric.toFixed(3);
  return numeric.toFixed(4);
}

async function waitForPropagatedReceipt(
  client: PublicClient,
  hash: `0x${string}`,
  receiptTimeoutMs = 180_000
) {
  const propagated = await waitForTransactionPropagation(client, hash);
  if (!propagated) {
    throw new Error(
      "Wallet returned a transaction hash, but Amoy RPC could not find it. The transaction was likely dropped or not broadcast. Reset MetaMask activity if needed, then try again."
    );
  }

  return client.waitForTransactionReceipt({
    hash,
    pollingInterval: 8_000,
    timeout: receiptTimeoutMs
  });
}

async function waitForTransactionPropagation(client: PublicClient, hash: `0x${string}`) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const tx = await client.getTransaction({ hash }).catch(() => null);
    if (tx) {
      return true;
    }

    await sleep(3_000);
  }

  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function PreviewMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] p-2.5">
      <div className="flex items-center gap-2 text-[color:var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5" />
        <p className="font-mono text-[10px] uppercase tracking-[0.08em]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}
