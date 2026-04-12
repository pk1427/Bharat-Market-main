"use client";

import Link from "next/link";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { polygonAmoy } from "wagmi/chains";

import { shortenAddress } from "@/lib/format";

export function WalletBar() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const metaMaskConnector =
    connectors.find((connector) => connector.name.toLowerCase().includes("metamask")) ??
    connectors[0];

  async function handleWalletClick() {
    if (isConnected) {
      disconnect();
      return;
    }

    if (metaMaskConnector) {
      connect({ connector: metaMaskConnector });
    }
  }

  async function handleSwitchNetwork() {
    await switchChainAsync({ chainId: polygonAmoy.id });
  }

  return (
    <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-slate-950/40 px-5 py-4 shadow-pulse sm:flex-row sm:items-center sm:justify-between">
      <Link href="/" className="flex items-center gap-4">
        <div className="font-heading flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-coral text-xl uppercase text-ink">
          BM
        </div>
        <div>
          <p className="font-heading text-2xl uppercase tracking-wide text-white">
            BharatMarket
          </p>
          <p className="text-sm text-slate-400">
            Sports-first prediction markets on Polygon Amoy
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSwitchNetwork}
          disabled={chainId === polygonAmoy.id || isSwitching}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-300 disabled:opacity-70"
        >
          {chainId === polygonAmoy.id ? "Polygon Amoy" : isSwitching ? "Switching..." : "Switch Network"}
        </button>
        {isConnected && address ? (
          <span className="rounded-full border border-mint/20 bg-mint/10 px-3 py-1 text-sm text-mint">
            {shortenAddress(address)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleWalletClick}
          disabled={isPending}
          className="rounded-2xl border border-gold/30 bg-gold/15 px-4 py-2 font-semibold text-gold transition disabled:opacity-60"
        >
          {isConnected ? "Disconnect" : isPending ? "Connecting..." : "Connect MetaMask"}
        </button>
      </div>
    </header>
  );
}
