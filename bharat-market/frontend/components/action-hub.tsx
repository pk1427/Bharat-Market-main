"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type PublicClient, formatEther, parseEther, parseUnits } from "viem";
import { ArrowUpRight, CheckCircle2, Coins, FileText, LockKeyhole, ShieldCheck, Sparkles, TimerReset, WalletCards } from "lucide-react";
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

export function ActionHub({ onMarketCreated }: { onMarketCreated?: () => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const addresses = useMemo(() => getRequiredAddresses(), []);
  const [createForm, setCreateForm] = useState({
    question: "",
    category: "crypto" as OracleCategory,
    cryptoAsset: "ETH",
    cryptoTargetPrice: "5000",
    cryptoDirection: "price_above",
    cricketProvider: "cricapi",
    cricketMatchId: "mi_vs_kkr",
    cricketLeague: "IPL",
    cricketTeamA: "MI",
    cricketTeamB: "KKR",
    cricketSelectedTeam: "MI",
    electionId: "",
    electionCandidate: "",
    electionRegion: "",
    electionType: "winner",
    durationMinutes: "180"
  });
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
  const questionToCreate = createForm.question.trim() || generatedQuestion;
  const categoryResolutionReady = createForm.category === "crypto" || createForm.category === "cricket";
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
        question: "",
        category: "crypto",
        cryptoAsset: "ETH",
        cryptoTargetPrice: "5000",
        cryptoDirection: "price_above",
        cricketProvider: "cricapi",
        cricketMatchId: "mi_vs_kkr",
        cricketLeague: "IPL",
        cricketTeamA: "MI",
        cricketTeamB: "KKR",
        cricketSelectedTeam: "MI",
        electionId: "",
        electionCandidate: "",
        electionRegion: "",
        electionType: "winner",
        durationMinutes: "180"
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

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-violet-400/85">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
              Creator Form
            </p>
            <h2 className="mt-4 font-heading text-[2.4rem] leading-none text-white">
              Build an oracle-settled market
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Launch crypto markets with structured metadata, CoinGecko verification, and Chainlink Functions settlement.
              Cricket and election routes stay visible as future provider slots, but crypto is the live autonomous path.
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

        <div className="mt-6 grid gap-6">
          <div className="grid gap-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Market Question
            </label>
            <input
              value={createForm.question}
              onChange={(event) => setCreateForm((current) => ({ ...current, question: event.target.value }))}
              placeholder={generatedQuestion || "Will Mumbai Indians beat KKR today?"}
              className="w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/35"
            />
            <p className="text-xs text-slate-500">
              Phrase the contract so the answer resolves clearly to YES or NO.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <CategoryButton
              active={createForm.category === "crypto"}
              title="Crypto"
              subtitle="CoinGecko live"
              ready
              onClick={() => setCreateForm((current) => ({ ...current, category: "crypto" }))}
            />
            <CategoryButton
              active={createForm.category === "cricket"}
              title="Cricket"
              subtitle="CricAPI live"
              ready
              onClick={() => setCreateForm((current) => ({ ...current, category: "cricket" }))}
            />
            <CategoryButton
              active={createForm.category === "election"}
              title="Election"
              subtitle="Architecture only"
              onClick={() => setCreateForm((current) => ({ ...current, category: "election" }))}
            />
          </div>

          {createForm.category === "crypto" ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Asset</label>
                <select
                  value={createForm.cryptoAsset}
                  onChange={(event) => setCreateForm((current) => ({ ...current, cryptoAsset: event.target.value, question: shouldRegenerateQuestion(current.question) ? "" : current.question }))}
                  className="w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-4 text-base text-white outline-none transition focus:border-violet-400/35"
                >
                  <option value="ETH">Ethereum</option>
                  <option value="BTC">Bitcoin</option>
                  <option value="SOL">Solana</option>
                  <option value="USDC">USD Coin</option>
                </select>
              </div>
              <Field label="Target Price" value={createForm.cryptoTargetPrice} onChange={(value) => setCreateForm((current) => ({ ...current, cryptoTargetPrice: value, question: shouldRegenerateQuestion(current.question) ? "" : current.question }))} placeholder="5000" />
              <div className="grid gap-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Direction</label>
                <select
                  value={createForm.cryptoDirection}
                  onChange={(event) => setCreateForm((current) => ({ ...current, cryptoDirection: event.target.value, question: shouldRegenerateQuestion(current.question) ? "" : current.question }))}
                  className="w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-4 text-base text-white outline-none transition focus:border-violet-400/35"
                >
                  <option value="price_above">above</option>
                  <option value="price_below">below</option>
                </select>
              </div>
            </div>
          ) : null}

          {creationBlockedReason ? (
            <div className="rounded-[18px] border border-gold/20 bg-gold/10 p-4 text-sm leading-6 text-gold">
              {creationBlockedReason} Select Crypto or Cricket to create an end-to-end resolvable market.
            </div>
          ) : null}

          {createForm.category === "cricket" ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Fixture ID" value={createForm.cricketMatchId} onChange={(value) => setCreateForm((current) => ({ ...current, cricketMatchId: value }))} placeholder="ipl_2026_42" />
              <Field label="Team A" value={createForm.cricketTeamA} onChange={(value) => setCreateForm((current) => ({ ...current, cricketTeamA: value.toUpperCase(), cricketSelectedTeam: current.cricketSelectedTeam || value.toUpperCase() }))} placeholder="MI" />
              <Field label="Team B" value={createForm.cricketTeamB} onChange={(value) => setCreateForm((current) => ({ ...current, cricketTeamB: value.toUpperCase() }))} placeholder="KKR" />
              <Field label="League" value={createForm.cricketLeague} onChange={(value) => setCreateForm((current) => ({ ...current, cricketLeague: value }))} placeholder="IPL" />
              <Field label="YES Team" value={createForm.cricketSelectedTeam} onChange={(value) => setCreateForm((current) => ({ ...current, cricketSelectedTeam: value.toUpperCase() }))} placeholder="MI" />
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

          <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
            <div className="grid gap-2">
              <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Duration
              </label>
              <input
                value={createForm.durationMinutes}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, durationMinutes: event.target.value }))
                }
                placeholder="180"
                className="w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/35"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Quick Templates
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm({
                      ...createForm,
                      question: "",
                      category: "cricket",
                      cricketProvider: "cricapi",
                      cricketMatchId: "mi_vs_kkr",
                      cricketLeague: "IPL",
                      cricketTeamA: "MI",
                      cricketTeamB: "KKR",
                      cricketSelectedTeam: "MI",
                      durationMinutes: "180"
                    })
                  }
                  className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  IPL Match Soon
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm({
                      ...createForm,
                      question: "",
                      category: "crypto",
                      cryptoAsset: "ETH",
                      cryptoTargetPrice: "5000",
                      cryptoDirection: "price_above",
                      durationMinutes: "10080"
                    })
                  }
                  className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  ETH Above $5000
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm({
                      question: "",
                      category: "crypto",
                      cryptoAsset: "ETH",
                      cryptoTargetPrice: "5000",
                      cryptoDirection: "price_above",
                      cricketProvider: "cricapi",
                      cricketMatchId: "",
                      cricketLeague: "",
                      cricketTeamA: "",
                      cricketTeamB: "",
                      cricketSelectedTeam: "",
                      electionId: "",
                      electionCandidate: "",
                      electionRegion: "",
                      electionType: "winner",
                      durationMinutes: "180"
                    })
                  }
                  className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  Clear Form
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-slate-400">
                <TimerReset className="h-4 w-4" />
                <p className="text-[10px] uppercase tracking-[0.16em]">Duration Summary</p>
              </div>
              <p className="mt-3 text-sm text-white">{durationLabel}</p>
            </div>
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-[10px] uppercase tracking-[0.16em]">Settlement Route</p>
              </div>
              <p className="mt-3 text-sm text-white">
                {settlementRouteLabel}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton
              onClick={handleApproveCreationFee}
              disabled={!address || !addresses || busy || hasCreationApproval || !hasGasForApproval}
              tone="mint"
              className="justify-center py-4"
            >
              {approveConfirming
                ? "Approving..."
                : hasCreationApproval
                  ? "Creation Fee Approved"
                  : "Approve Creation Fee"}
            </ActionButton>

            <ActionButton
              onClick={handleCreateMarket}
              disabled={!address || !addresses || busy || !hasCreationApproval || !hasEnoughUsdc || !hasGasForCreation || Boolean(creationBlockedReason)}
              tone="gold"
              className="justify-center py-4"
            >
              {createConfirming ? "Creating..." : "Create Market"}
            </ActionButton>
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

      <div className="space-y-6">
        <Panel className="p-5">
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-violet-400/85">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
            Preview
          </p>

          <div className="mt-5 space-y-4">
            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Question</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {questionToCreate || "Your market question will appear here"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PreviewMetric
                icon={WalletCards}
                label="Wallet Balance"
                value={walletLoading ? "Syncing" : walletError ? "Unavailable" : formatUsdc(usdcBalance ?? 0n)}
              />
              <PreviewMetric icon={Coins} label="Creation Fee" value={formatUsdc(requiredFee)} />
              <PreviewMetric
                icon={WalletCards}
                label="Amoy Gas"
                value={walletLoading ? "Syncing" : walletError ? "Unavailable" : nativeBalanceLabel}
              />
              <PreviewMetric icon={Sparkles} label="Oracle Type" value={contractOracleType || "--"} />
              <PreviewMetric icon={TimerReset} label="Expiry Window" value={durationLabel} />
            </div>

            <div className="rounded-[16px] border border-mint/15 bg-mint/[0.05] p-4 text-sm text-slate-300">
              <p className="text-[10px] uppercase tracking-[0.16em] text-mint">Oracle Metadata</p>
              <p className="mt-3 text-white">{oracleMetadata?.settlementRule ?? "Complete the structured metadata to generate a deterministic settlement rule."}</p>
              <p className="mt-2 text-xs text-slate-500">
                Source: {oracleMetadata?.verificationSource ?? "--"}
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-slate-500">
                {structuredOracleCreationEnabled
                  ? encodedOracleQuery || "Encoded oracle query will appear here."
                  : `Legacy-compatible query: ${contractOracleQuery || "--"}`}
              </p>
            </div>

            <div className="grid gap-3">
              <TrustStep
                icon={CheckCircle2}
                title="1. Structured rule"
                detail={oracleMetadata?.settlementRule ?? "Complete the oracle form."}
                active={Boolean(oracleMetadata)}
              />
              <TrustStep
                icon={ShieldCheck}
                title="2. Provider verification"
                detail={
                  createForm.category === "crypto"
                    ? "CoinGecko market_chart/range is sampled after expiry."
                    : createForm.category === "cricket"
                      ? "CricAPI match_info is sampled after the fixture ends and the winner is normalized deterministically."
                      : "Provider not production-enabled yet."
                }
                active={categoryResolutionReady}
              />
              <TrustStep
                icon={LockKeyhole}
                title="3. Chainlink settlement"
                detail={
                  createForm.category === "crypto"
                    ? "Chainlink Functions returns YES/NO plus the fetched settlement price for indexing."
                    : "Chainlink Functions returns YES/NO plus the fetched match result for indexing."
                }
                active={categoryResolutionReady}
              />
            </div>

            <div className="rounded-[16px] border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Fee approval</span>
                <span className="font-semibold text-white">
                  {hasCreationApproval ? "Ready" : "Required"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Collateral mode</span>
                <span className="font-semibold text-white">{collateralConfig.label}</span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-violet-400/85">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.95)]" />
            Funding
          </p>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            {collateralConfig.isMintable
              ? `Fund your connected wallet with ${collateralConfig.label} before launching the market.`
              : `Make sure the connected wallet is funded with ${collateralConfig.label} before creating the contract.`}
          </p>

          <div className="mt-5 grid gap-3">
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
        className="w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/35"
      />
    </div>
  );
}

function CategoryButton({
  active,
  title,
  subtitle,
  ready = false,
  onClick
}: {
  active: boolean;
  title: string;
  subtitle: string;
  ready?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[20px] border px-4 py-4 text-left transition ${
        active
          ? "border-mint/30 bg-[linear-gradient(135deg,rgba(95,242,191,0.16),rgba(95,242,191,0.05))] text-white shadow-[0_0_28px_rgba(95,242,191,0.08)]"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-xl uppercase">{title}</p>
        <span className={`rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.2em] ${
          ready ? "bg-mint/15 text-mint" : "bg-gold/10 text-gold"
        }`}>
          {ready ? "Live" : "Soon"}
        </span>
      </div>
      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{subtitle}</p>
    </button>
  );
}

function TrustStep({
  icon: Icon,
  title,
  detail,
  active
}: {
  icon: typeof CheckCircle2;
  title: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div className={`rounded-[16px] border px-4 py-3 ${
      active ? "border-mint/15 bg-mint/[0.04]" : "border-white/8 bg-white/[0.03]"
    }`}>
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${active ? "text-mint" : "text-slate-500"}`} />
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </div>
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
    <div className="rounded-[14px] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
