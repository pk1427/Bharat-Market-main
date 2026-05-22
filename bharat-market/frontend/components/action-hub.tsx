"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { marketFactoryAbi, mockUsdcAbi } from "@/lib/abis";
import { collateralConfig } from "@/lib/collateral";
import { getRequiredAddresses } from "@/lib/contracts";
import { getSafeFeeOverrides } from "@/lib/fees";
import { formatTxError, formatUsdc } from "@/lib/format";

export function ActionHub({ onMarketCreated }: { onMarketCreated: () => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const addresses = getRequiredAddresses();
  const [createForm, setCreateForm] = useState({
    question: "Will Mumbai Indians beat KKR today?",
    oracleType: "sports",
    oracleQuery: "mi_vs_kkr",
    durationMinutes: "180"
  });
  const [mintHash, setMintHash] = useState<`0x${string}` | undefined>();
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [createHash, setCreateHash] = useState<`0x${string}` | undefined>();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const fees = await getSafeFeeOverrides(client);
      const hash = await writeContractAsync({
        address: addresses.usdc,
        abi: mockUsdcAbi,
        functionName: "mint",
        args: [address, parseUnits("100", 6)],
        ...fees
      });
      setMintHash(hash);
    } catch (err) {
      setError(formatTxError(err));
    }
  }

  async function handleApproveCreationFee() {
    const client = publicClient;
    if (!addresses || !client) return;

    try {
      setError(null);
      setStatus(`Approving ${formatUsdc(requiredFee)} for market creation...`);
      const fees = await getSafeFeeOverrides(client);
      const hash = await writeContractAsync({
        address: addresses.usdc,
        abi: mockUsdcAbi,
        functionName: "approve",
        args: [addresses.marketFactory, requiredFee],
        ...fees
      });
      setApproveHash(hash);
    } catch (err) {
      setError(formatTxError(err));
    }
  }

  async function handleCreateMarket() {
    const client = publicClient;
    if (!addresses || !client) return;

    try {
      setError(null);
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
      const hash = await writeContractAsync({
        address: addresses.marketFactory,
        abi: marketFactoryAbi,
        functionName: "createMarket",
        args: [createForm.question, endTime, createForm.oracleType, createForm.oracleQuery],
        gas,
        ...fees
      });
      setCreateHash(hash);
    } catch (err) {
      setError(formatTxError(err));
    }
  }

  useEffect(() => {
    if (mintSuccess) {
      setStatus(`${collateralConfig.label} ready in your wallet.`);
    }
  }, [mintSuccess]);

  useEffect(() => {
    if (approveSuccess) {
      setStatus("Creation fee approved. You can create the market now.");
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (createSuccess) {
      setStatus("Market created. Refresh the market board.");
      onMarketCreated();
    }
  }, [createSuccess, onMarketCreated]);

  return (
    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="glass rounded-[28px] p-5">
        <h2 className="font-heading text-2xl uppercase text-white">Wallet Actions</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {collateralConfig.isMintable
            ? `Fund your connected wallet with ${collateralConfig.label}, then jump into a live market.`
            : `Make sure your connected wallet is funded with ${collateralConfig.label} before trading or creating markets.`}
        </p>

        <div className="mt-5 grid gap-3">
          {collateralConfig.isMintable ? (
            <button
              type="button"
              onClick={handleMintUsdc}
              disabled={!address || !addresses || busy}
              className="rounded-2xl border border-mint/30 bg-mint/15 px-4 py-3 font-semibold text-mint transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mintConfirming ? "Minting..." : `Mint 100 ${collateralConfig.label}`}
            </button>
          ) : collateralConfig.faucetUrl ? (
            <a
              href={collateralConfig.faucetUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-mint/30 bg-mint/15 px-4 py-3 text-center font-semibold text-mint transition hover:border-mint/50"
            >
              Get {collateralConfig.label} from Faucet
            </a>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Wallet {collateralConfig.label}</span>
              <span className="font-semibold text-white">{formatUsdc(usdcBalance ?? 0n)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Creation fee</span>
              <span className="font-semibold text-white">{formatUsdc(requiredFee)}</span>
            </div>
          </div>

          {defaultMarketHref ? (
            <Link
              href={defaultMarketHref}
              className="rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 text-center font-semibold text-gold transition hover:border-gold/50"
            >
              Open Latest Market
            </Link>
          ) : null}
        </div>

        {status ? <p className="mt-4 text-sm text-slate-300">{status}</p> : null}
        {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
      </div>

      <div className="glass rounded-[28px] p-5">
        <h2 className="font-heading text-2xl uppercase text-white">Create Market</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Launch a new IPL-style prediction market directly from the frontend.
        </p>

        <div className="mt-5 grid gap-4">
          <label className="text-sm text-slate-300">
            Question
            <input
              value={createForm.question}
              onChange={(event) => setCreateForm((current) => ({ ...current, question: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-gold/40"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-slate-300">
              Oracle Type
              <select
                value={createForm.oracleType}
                onChange={(event) => setCreateForm((current) => ({ ...current, oracleType: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              >
                <option value="sports">sports</option>
                <option value="crypto">crypto</option>
                <option value="election">election</option>
              </select>
            </label>

            <label className="text-sm text-slate-300">
              Oracle Query
              <input
                value={createForm.oracleQuery}
                onChange={(event) => setCreateForm((current) => ({ ...current, oracleQuery: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-gold/40"
              />
            </label>

            <label className="text-sm text-slate-300">
              Duration (mins)
              <input
                value={createForm.durationMinutes}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, durationMinutes: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-gold/40"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <span>Fee approval</span>
              <span className="font-semibold text-white">{hasCreationApproval ? "Ready" : "Required"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Wallet balance</span>
              <span className="font-semibold text-white">{formatUsdc(usdcBalance ?? 0n)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleApproveCreationFee}
            disabled={!address || !addresses || busy || hasCreationApproval}
            className="rounded-2xl border border-mint/30 bg-mint/15 px-4 py-3 font-semibold text-mint transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {approveConfirming ? "Approving..." : hasCreationApproval ? "Creation Fee Approved" : "Approve Creation Fee"}
          </button>

          <button
            type="button"
            onClick={handleCreateMarket}
            disabled={!address || !addresses || busy || !hasCreationApproval || !hasEnoughUsdc}
            className="rounded-2xl border border-gold/30 bg-gold/15 px-4 py-3 font-semibold text-gold transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {createConfirming ? "Creating..." : "Create Market"}
          </button>
        </div>
      </div>
    </section>
  );
}
