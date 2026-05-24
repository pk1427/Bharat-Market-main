"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  CandlestickChart,
  ChevronDown,
  Copy,
  FolderClock,
  LogOut,
  PlusSquare,
  ShieldCheck,
  Shield,
  TriangleAlert,
  Trophy,
  User,
  Wallet,
  Wifi
} from "lucide-react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { polygonAmoy } from "wagmi/chains";

import { ActionButton } from "@/components/ui/action-button";
import { useWalletSummary } from "@/hooks/use-wallet-summary";
import { formatUsdc, shortenAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Markets", icon: CandlestickChart },
  { href: "/history", label: "History", icon: FolderClock },
  { href: "/create-market", label: "Create", icon: PlusSquare }
];

export function WalletBar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const walletSummary = useWalletSummary();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  async function handleCopyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      window.addEventListener("mousedown", handleOutsideClick);
    }

    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const balancePreview = walletSummary.data
    ? formatUsdc(walletSummary.data.usdcBalance)
    : "Syncing";
  const onExpectedNetwork = chainId === polygonAmoy.id;
  const networkLabel = onExpectedNetwork ? "Amoy" : "Wrong network";

  return (
    <div className="sticky top-3 z-50 mb-8">
      <div className="rounded-[18px] border border-white/8 bg-[rgba(10,10,16,0.88)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_390px] xl:items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#7c3aed,#22d3ee)] shadow-[0_0_24px_rgba(124,58,237,0.24)]">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-heading text-[1.12rem] text-white">BharatMarket</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_8px_rgba(52,211,153,0.95)]" />
                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Sports prediction exchange
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-1 rounded-[16px] border border-white/8 bg-white/[0.03] p-1.5">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group relative inline-flex items-center gap-2 rounded-[12px] px-3 py-2.5 text-sm font-medium transition",
                    active ? "text-white" : "text-slate-400 hover:text-white"
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-[12px] bg-white/9 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    />
                  ) : null}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {isConnected && address ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  className="inline-flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left transition hover:border-white/20"
                >
                  <Shield className="h-4 w-4 text-slate-400" />
                  <div className="hidden min-w-[88px] sm:block">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Balance</p>
                    <p className="font-mono text-sm font-semibold text-white">{balancePreview}</p>
                  </div>
                  <span className="hidden h-5 w-px bg-white/10 sm:block" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{shortenAddress(address)}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em]",
                        onExpectedNetwork
                          ? "border-white/10 bg-white/[0.04] text-slate-400"
                          : "border-coral/30 bg-coral/10 text-coral"
                      )}
                    >
                      {networkLabel}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-500 transition ${menuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] rounded-[18px] border border-white/10 bg-[rgba(16,16,24,0.98)] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Connected Wallet</p>
                        <p className="mt-1 text-xs text-slate-500">Manage your BharatMarket session</p>
                      </div>
                      <span
                        className={cn(
                          "text-xs uppercase tracking-[0.14em]",
                          onExpectedNetwork ? "text-slate-500" : "text-coral"
                        )}
                      >
                        {networkLabel}
                      </span>
                    </div>

                    {!onExpectedNetwork ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await handleSwitchNetwork();
                          setMenuOpen(false);
                        }}
                        disabled={isSwitching}
                        className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-[14px] border border-coral/30 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral transition hover:border-coral/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <TriangleAlert className="h-4 w-4" />
                        {isSwitching ? "Switching..." : "Switch to Polygon Amoy"}
                      </button>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div>
                        <p className="font-mono text-sm text-white">{shortenAddress(address)}</p>
                        <p className="mt-1 text-xs text-slate-500">{balancePreview}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-white/20 hover:text-white"
                        aria-label="Copy wallet address"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
                      <Link
                        href="/my-account"
                        className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Wallet className="h-4 w-4" />
                        My Account
                      </Link>
                      <Link
                        href="/manage-markets"
                        className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-sm text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
                        onClick={() => setMenuOpen(false)}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Manage Markets
                      </Link>
                      <div className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-sm text-slate-300">
                        <Wifi className="h-4 w-4" />
                        <span>{onExpectedNetwork ? polygonAmoy.name : "Unsupported network"}</span>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-white/8 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          disconnect();
                          setMenuOpen(false);
                        }}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-[14px] border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20"
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </button>
                    </div>

                    {copied ? (
                      <p className="mt-3 text-center text-xs text-mint">Address copied</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <ActionButton
                type="button"
                onClick={handleWalletClick}
                disabled={isPending}
                tone="gold"
                className="min-w-[170px] px-4 py-2.5"
              >
                {isPending ? "Connecting..." : "Connect MetaMask"}
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
