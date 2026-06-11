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
  LayoutGrid,
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
  { href: "/create-market", label: "Create", icon: PlusSquare },
  { href: "/embed", label: "Embeds", icon: LayoutGrid }
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

  if (pathname.startsWith("/embed")) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 -mx-3 mb-6 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] px-3 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid min-h-[52px] gap-3 xl:grid-cols-[240px_minmax(0,1fr)_390px] xl:items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] border border-[color:var(--accent-border)] bg-[color:var(--accent-dim)]">
                <span className="text-lg leading-none text-[color:var(--accent)]">◆</span>
              </div>
              <div>
                <p className="font-heading text-base font-semibold text-[color:var(--text-primary)]">BharatMarket</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
                    Sports prediction exchange
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center justify-center gap-6 xl:flex">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group relative inline-flex h-[52px] items-center gap-2 text-sm font-medium transition",
                    active ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]"
                  )}
                >
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{item.label}</span>
                  {active ? (
                    <motion.span
                      layoutId="nav-active-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[color:var(--accent)]"
                    />
                  ) : null}
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
                  className="inline-flex items-center gap-3 rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] px-3 py-2 text-left transition hover:border-[color:var(--border-strong)]"
                >
                  <Shield className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                  <div className="hidden min-w-[88px] sm:block">
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">Balance</p>
                    <p className="font-mono text-sm font-semibold text-[color:var(--text-primary)]">{balancePreview}</p>
                  </div>
                  <span className="hidden h-5 w-px bg-[color:var(--border-default)] sm:block" />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-[color:var(--text-primary)]">{shortenAddress(address)}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
                        onExpectedNetwork
                          ? "border-[color:var(--accent-border)] bg-[color:var(--accent-dim)] text-[color:var(--text-secondary)]"
                          : "border-[color:rgba(245,65,90,0.35)] bg-[color:var(--red-dim)] text-[color:var(--red)]"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", onExpectedNetwork ? "bg-[color:var(--accent)]" : "bg-[color:var(--red)]")} />
                      {networkLabel}
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-[color:var(--text-tertiary)] transition ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] rounded-[var(--r-lg)] border border-[color:var(--border-default)] bg-[color:var(--surface-1)] p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">Connected Wallet</p>
                        <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">Manage your BharatMarket session</p>
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

                    <div className="mt-4 flex items-center justify-between rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-4 py-3">
                      <div>
                        <p className="font-mono text-sm text-[color:var(--text-primary)]">{shortenAddress(address)}</p>
                        <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">{balancePreview}</p>
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

                    <div className="mt-4 space-y-1 border-t border-[color:var(--border-subtle)] pt-3">
                      <Link
                        href="/my-account"
                        className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-primary)]"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Wallet className="h-4 w-4" />
                        My Account
                      </Link>
                      <Link
                        href="/manage-markets"
                        className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-primary)]"
                        onClick={() => setMenuOpen(false)}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Manage Markets
                      </Link>
                      <div className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-sm text-[color:var(--text-secondary)]">
                        <Wifi className="h-4 w-4" />
                        <span>{onExpectedNetwork ? polygonAmoy.name : "Unsupported network"}</span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[color:var(--border-subtle)] pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          disconnect();
                          setMenuOpen(false);
                        }}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] px-4 py-3 text-sm font-semibold text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
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
