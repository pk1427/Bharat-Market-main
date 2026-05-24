"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { ArrowUpRight, Coins, FileText, Sparkles, TimerReset, WalletCards } from "lucide-react";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { ActionButton } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { TxStatusNotice } from "@/components/ui/tx-status-notice";
import { marketFactoryAbi, mockUsdcAbi } from "@/lib/abis";
import { collateralConfig } from "@/lib/collateral";
import { getRequiredAddresses } from "@/lib/contracts";
import { getSafeFeeOverrides } from "@/lib/fees";
import { formatTxError, formatUsdc } from "@/lib/format";
import { failTxToast, handleTxToast, settleTxToast } from "@/lib/tx-toasts";

export function ActionHub({ onMarketCreated }: { onMarketCreated?: () => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const addresses = getRequiredAddresses();
  const [createForm, setCreateForm] = useState({
    question: "",
    oracleType: "sports",
    oracleQuery: "",
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

  const { writeContractAsync, isPending } = useWriteContract();
  const { isSuccess: mintSuccess, isLoading: mintConfirming } = useWaitForTransactionReceipt({
    hash: mintHash,
    query: { enabled: Boolean(mintHash) }
  });
  const { isSuccess: approveSuccess, isLoading: approveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
    query: { enabled: Boolean(approveHash) }
  });
  const { isSuccess: createSuccess, isLoading: createConfirming } = useWaitForTransactionReceipt({
    hash: createHash,
    query: { enabled: Boolean(createHash) }
  });

  const busy = isPending || mintConfirming || approveConfirming || createConfirming;
  const defaultMarketHref = useMemo(() => {
    if (!addresses?.defaultMarket) return null;
    return `/markets/${addresses.defaultMarket}`;
  }, [addresses?.defaultMarket]);
  const requiredFee = creationFee ?? parseUnits("10", 6);
  const hasEnoughUsdc = (usdcBalance ?? 0n) >= requiredFee;
  const hasCreationApproval = (creationAllowance ?? 0n) >= requiredFee;

  useEffect(() => {
    let cancelled = false;

    async function loadWalletData() {
      if (!addresses) return;

      try {
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
        };

        if (!response.ok || !payload.creationFee) {
          throw new Error("Failed to load wallet data.");
        }

        if (!cancelled) {
          setCreationFee(BigInt(payload.creationFee));
          setUsdcBalance(BigInt(payload.usdcBalance ?? "0"));
          setCreationAllowance(BigInt(payload.creationAllowance ?? "0"));
        }
      } catch {
        if (!cancelled) {
          setCreationFee(null);
          setUsdcBalance(0n);
          setCreationAllowance(0n);
        }
      }
    }

    void loadWalletData();

    return () => {
      cancelled = true;
    };
  }, [address, addresses, mintSuccess, approveSuccess, createSuccess]);

  async function handleMintUsdc() {
    const client = publicClient;
    if (!address || !addresses || !client) return;

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
      setMintToastId(handleTxToast({ hash, pendingLabel: `Minting ${collateralConfig.label}...` }));
    } catch (err) {
      failTxToast(formatTxError(err));
      setStatusTone("error");
      setError(formatTxError(err));
    }
  }

  async function handleApproveCreationFee() {
    const client = publicClient;
    if (!addresses || !client) return;

    try {
      setError(null);
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
      setApproveToastId(handleTxToast({ hash, pendingLabel: "Approving creation fee..." }));
    } catch (err) {
      failTxToast(formatTxError(err));
      setStatusTone("error");
      setError(formatTxError(err));
    }
  }

  async function handleCreateMarket() {
    const client = publicClient;
    if (!addresses || !client) return;

    try {
      setError(null);
      if (!createForm.question.trim()) {
        throw new Error("Add a market question before creating the contract.");
      }
      if (!createForm.oracleQuery.trim()) {
        throw new Error("Add an oracle query so BharatMarket can resolve the market.");
      }
      if (!hasEnoughUsdc) {
        throw new Error(`You need at least ${formatUsdc(requiredFee)} to pay the creation fee.`);
      }
      if (!hasCreationApproval) {
        throw new Error(`Approve ${collateralConfig.label} for the creation fee before creating the market.`);
      }

      const durationMinutes = Number(createForm.durationMinutes);
      const endTime = BigInt(Math.floor(Date.now() / 1000) + durationMinutes * 60);
      const gas = await client
        .estimateContractGas({
          address: addresses.marketFactory,
          abi: marketFactoryAbi,
          functionName: "createMarket",
          args: [createForm.question, endTime, createForm.oracleType, createForm.oracleQuery],
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
        args: [createForm.question, endTime, createForm.oracleType, createForm.oracleQuery],
        gas,
        ...fees
      });
      setCreateHash(hash);
      setCreateToastId(handleTxToast({ hash, pendingLabel: "Creating market..." }));
    } catch (err) {
      failTxToast(formatTxError(err));
      setStatusTone("error");
      setError(formatTxError(err));
    }
  }

  useEffect(() => {
    if (mintSuccess) {
      setStatus(`${collateralConfig.label} ready in your wallet.`);
      setStatusTone("success");
      if (mintHash && mintToastId !== null) {
        settleTxToast({
          id: mintToastId,
          hash: mintHash,
          status: "success",
          successLabel: `${collateralConfig.label} minted.`,
          errorLabel: `${collateralConfig.label} mint failed.`
        });
      }
    }
  }, [mintHash, mintSuccess, mintToastId]);

  useEffect(() => {
    if (approveSuccess) {
      setStatus("Creation fee approved. You can create the market now.");
      setStatusTone("success");
      if (approveHash && approveToastId !== null) {
        settleTxToast({
          id: approveToastId,
          hash: approveHash,
          status: "success",
          successLabel: "Creation fee approved.",
          errorLabel: "Creation fee approval failed."
        });
      }
    }
  }, [approveHash, approveSuccess, approveToastId]);

  useEffect(() => {
    if (createSuccess) {
      setStatus("Market created. Refresh the market board.");
      setStatusTone("success");
      onMarketCreated?.();
      setCreateForm({
        question: "",
        oracleType: "sports",
        oracleQuery: "",
        durationMinutes: "180"
      });
      if (createHash && createToastId !== null) {
        settleTxToast({
          id: createToastId,
          hash: createHash,
          status: "success",
          successLabel: "Market created.",
          errorLabel: "Market creation failed."
        });
      }
    }
  }, [createHash, createSuccess, createToastId, onMarketCreated]);

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
              Build a new market
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Configure the market question, oracle route, and expiry window with cleaner
              creator controls built for BharatMarket’s live sports contracts.
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
              placeholder="Will Mumbai Indians beat KKR today?"
              className="w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/35"
            />
            <p className="text-xs text-slate-500">
              Phrase the contract so the answer resolves clearly to YES or NO.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-2">
              <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Oracle Type
              </label>
              <select
                value={createForm.oracleType}
                onChange={(event) => setCreateForm((current) => ({ ...current, oracleType: event.target.value }))}
                className="w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-4 text-base text-white outline-none transition focus:border-violet-400/35"
              >
                <option value="sports">sports</option>
                <option value="crypto">crypto</option>
                <option value="election">election</option>
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Oracle Query
              </label>
              <input
                value={createForm.oracleQuery}
                onChange={(event) => setCreateForm((current) => ({ ...current, oracleQuery: event.target.value }))}
                placeholder="mi_vs_kkr"
                className="w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-4 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/35"
              />
            </div>
          </div>

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
                      question: "Will Mumbai Indians beat KKR today?",
                      oracleType: "sports",
                      oracleQuery: "mi_vs_kkr",
                      durationMinutes: "180"
                    })
                  }
                  className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  IPL Match
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm({
                      question: "Will BTC break the target price this week?",
                      oracleType: "crypto",
                      oracleQuery: "btc_price",
                      durationMinutes: "10080"
                    })
                  }
                  className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  Crypto Price
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm({
                      question: "",
                      oracleType: "sports",
                      oracleQuery: "",
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
                <FileText className="h-4 w-4" />
                <p className="text-[10px] uppercase tracking-[0.16em]">Oracle Route</p>
              </div>
              <p className="mt-3 text-sm text-white">
                {createForm.oracleType || "No type selected"} / {createForm.oracleQuery || "No query yet"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton
              onClick={handleApproveCreationFee}
              disabled={!address || !addresses || busy || hasCreationApproval}
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
              disabled={!address || !addresses || busy || !hasCreationApproval || !hasEnoughUsdc}
              tone="gold"
              className="justify-center py-4"
            >
              {createConfirming ? "Creating..." : "Create Market"}
            </ActionButton>
          </div>

          {status && statusTone ? <TxStatusNotice state={statusTone} title={status} /> : null}
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
                {createForm.question.trim() || "Your market question will appear here"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PreviewMetric icon={WalletCards} label="Wallet Balance" value={formatUsdc(usdcBalance ?? 0n)} />
              <PreviewMetric icon={Coins} label="Creation Fee" value={formatUsdc(requiredFee)} />
              <PreviewMetric icon={Sparkles} label="Oracle Type" value={createForm.oracleType || "--"} />
              <PreviewMetric icon={TimerReset} label="Expiry Window" value={durationLabel} />
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
