"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  CandlestickChart,
  ChevronDown,
  Copy,
  FileText,
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
  { href: "/markets", label: "Markets", icon: CandlestickChart },
  { href: "/history", label: "History", icon: FolderClock },
  { href: "/create-market", label: "Create", icon: PlusSquare },
  { href: "/embed", label: "Embeds", icon: LayoutGrid },
  { href: "/docs", label: "Docs", icon: FileText }
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
  const [navOpen, setNavOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  const metaMaskConnector =
    connectors.find((connector) => connector.id === "metaMaskSDK") ??
    connectors.find((connector) => connector.name.toLowerCase().includes("metamask")) ??
    connectors[0];
  const walletConnectConnector =
    connectors.find((connector) => connector.id === "walletConnect") ?? connectors[1] ?? connectors[0];

  async function handleWalletClick() {
    if (isConnected) {
      disconnect();
      return;
    }

    const connector = /android|iphone|ipad|ipod/i.test(navigator.userAgent)
      ? metaMaskConnector ?? walletConnectConnector
      : metaMaskConnector ?? walletConnectConnector;

    if (connector) {
      connect({ connector });
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
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (navRef.current && !navRef.current.contains(target)) {
        setNavOpen(false);
      }
    }

    if (menuOpen || navOpen) {
      window.addEventListener("mousedown", handleOutsideClick);
    }

    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen, navOpen]);

  const balancePreview = walletSummary.data
    ? formatUsdc(walletSummary.data.usdcBalance)
    : "Syncing";
  const onExpectedNetwork = chainId === polygonAmoy.id;
  const networkLabel = onExpectedNetwork ? "Amoy" : "Wrong network";

  const embeddedWidgetRoute =
    pathname === "/embed/board" || pathname.startsWith("/embed/market/");

  if (embeddedWidgetRoute) {
    return null;
  }

  return (
    <div className="sticky top-2 z-50 mb-4 sm:top-3 sm:mb-7" ref={menuRef}>
      <div className="mx-auto max-w-[1320px] rounded-[20px] border border-[color:var(--border-default)] bg-[rgba(10,10,18,0.9)] px-2.5 py-2 shadow-[0_18px_70px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl sm:rounded-[24px] sm:px-4 sm:py-0">
        <div className="grid min-h-[58px] gap-2 lg:min-h-[70px] lg:grid-cols-[250px_minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-start">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-[color:var(--accent-border)] bg-[color:var(--accent-dim)]">
                <span className="text-lg leading-none text-[color:var(--accent)]">◆</span>
              </div>
              <div className="min-w-0">
                <p className="truncate font-heading text-base font-bold tracking-[-0.03em] text-[color:var(--text-primary)] sm:text-lg">BharatMarket</p>
              </div>
            </Link>

            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <div ref={navRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNavOpen((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs font-semibold text-[color:var(--text-primary)] shadow-[0_10px_25px_rgba(0,0,0,0.14)]"
                >
                  <LayoutGrid className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                  Menu
                  <ChevronDown className={`h-4 w-4 text-[color:var(--text-tertiary)] transition ${navOpen ? "rotate-180" : ""}`} />
                </button>

                {navOpen ? (
                  <div className="fixed inset-x-3 top-[74px] z-[60] rounded-[24px] border border-[color:var(--border-default)] bg-[color:var(--surface-1)] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.52)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] pb-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Navigation</p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">Protocol sections</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNavOpen(false)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]"
                        aria-label="Close menu"
                      >
                        <ChevronDown className="h-4 w-4 rotate-180" />
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3">
                      {navItems.map((item) => {
                        const active =
                          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.label}
                            href={item.href}
                            onClick={() => setNavOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-[18px] border px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] transition",
                              active
                                ? "border-[color:var(--accent-border)] bg-[color:var(--accent-dim)] text-[color:var(--text-primary)]"
                                : "border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-[20px] border border-[color:var(--border-subtle)] bg-[rgba(255,255,255,0.02)] p-3">
                      {isConnected && address ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Wallet</p>
                              <p className="mt-1 truncate font-mono text-sm text-[color:var(--text-primary)]">{shortenAddress(address)}</p>
                              <p className="mt-1 font-mono text-xs font-semibold text-[color:var(--text-secondary)]">{balancePreview}</p>
                            </div>
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                                onExpectedNetwork
                                  ? "border-[color:var(--accent-border)] bg-[color:var(--accent-dim)] text-[color:var(--text-secondary)]"
                                  : "border-[color:rgba(245,65,90,0.35)] bg-[color:var(--red-dim)] text-[color:var(--red)]"
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", onExpectedNetwork ? "bg-[color:var(--accent)]" : "bg-[color:var(--red)]")} />
                              {networkLabel}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={handleCopyAddress}
                              className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-3 py-2.5 text-sm text-[color:var(--text-secondary)]"
                            >
                              <Copy className="h-4 w-4" />
                              {copied ? "Copied" : "Copy"}
                            </button>
                            {!onExpectedNetwork ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await handleSwitchNetwork();
                                  setNavOpen(false);
                                }}
                                disabled={isSwitching}
                                className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-coral/30 bg-coral/10 px-3 py-2.5 text-sm font-semibold text-coral"
                              >
                                <TriangleAlert className="h-4 w-4" />
                                Switch
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  disconnect();
                                  setNavOpen(false);
                                }}
                                className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] px-3 py-2.5 text-sm font-semibold text-[color:var(--text-primary)]"
                              >
                                <LogOut className="h-4 w-4" />
                                Disconnect
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <ActionButton
                          type="button"
                          onClick={handleWalletClick}
                          disabled={isPending}
                          tone="gold"
                          className="w-full justify-center px-4 py-2.5"
                        >
                          {isPending ? "Connecting..." : "Connect Wallet"}
                        </ActionButton>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

            </div>
          </div>

          <div className="lg:hidden">
            {isConnected && address ? (
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="mt-2 grid w-full gap-2 rounded-[18px] border border-[color:var(--accent-border)] bg-[rgba(7,7,13,0.72)] px-3 py-3 text-left shadow-[0_10px_25px_rgba(0,0,0,0.18)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-default)] bg-[color:var(--surface-2)]">
                      <Shield className="h-3.5 w-3.5 text-[color:var(--text-tertiary)]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[10px] uppercase leading-none tracking-[0.14em] text-[color:var(--text-primary)]">
                        {shortenAddress(address)}
                      </span>
                      <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-[color:var(--text-tertiary)]">
                        Balance {balancePreview}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em]",
                      onExpectedNetwork
                        ? "border-[color:var(--accent-border)] bg-[color:var(--accent-dim)] text-[color:var(--text-secondary)]"
                        : "border-[color:rgba(245,65,90,0.35)] bg-[color:var(--red-dim)] text-[color:var(--red)]"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", onExpectedNetwork ? "bg-[color:var(--accent)]" : "bg-[color:var(--red)]")} />
                    {networkLabel}
                  </span>
                </div>
              </button>
            ) : (
              <ActionButton
                type="button"
                onClick={handleWalletClick}
                disabled={isPending}
                tone="gold"
                className="mt-2 w-full justify-center px-4 py-2.5"
              >
                {isPending ? "Connecting..." : "Connect Wallet"}
              </ActionButton>
            )}
          </div>

          <nav className="hidden items-center justify-center gap-8 lg:flex">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.14em] transition sm:text-[11px] lg:h-[70px] lg:rounded-none lg:px-0",
                    active
                      ? "bg-[color:var(--surface-2)] text-[color:var(--text-primary)] lg:bg-transparent"
                      : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-primary)] lg:hover:bg-transparent"
                  )}
                >
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{item.label}</span>
                  {active ? (
                    <motion.span
                      layoutId="nav-active-underline"
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[color:var(--accent)] lg:left-0 lg:right-0"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="hidden flex-wrap items-center justify-end gap-3 lg:flex">
            {isConnected && address ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  className="inline-flex items-center gap-3 rounded-full border border-[color:var(--accent-border)] bg-[rgba(7,7,13,0.72)] px-3 py-2 text-left transition hover:border-[color:var(--border-strong)]"
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
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
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
                  <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(300px,calc(100vw-1.5rem))] rounded-[var(--r-lg)] border border-[color:var(--border-default)] bg-[color:var(--surface-1)] p-3">
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
                {isPending ? "Connecting..." : "Connect Wallet"}
              </ActionButton>
            )}
          </div>
        </div>

        {menuOpen && isConnected && address ? (
          <div className="mt-2 lg:hidden">
            <div className="w-full rounded-[var(--r-lg)] border border-[color:var(--border-default)] bg-[color:var(--surface-1)] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.44)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">Connected Wallet</p>
                  <p className="mt-1 truncate font-mono text-xs text-[color:var(--text-tertiary)]">{shortenAddress(address)}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                    onExpectedNetwork
                      ? "border-[color:var(--accent-border)] bg-[color:var(--accent-dim)] text-[color:var(--text-secondary)]"
                      : "border-[color:rgba(245,65,90,0.35)] bg-[color:var(--red-dim)] text-[color:var(--red)]"
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

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-3 py-3">
                  <p className="micro-label">Balance</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[color:var(--text-primary)]">{balancePreview}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="mt-3 grid gap-1 border-t border-[color:var(--border-subtle)] pt-3">
                <Link href="/my-account" className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-primary)]" onClick={() => setMenuOpen(false)}>
                  <Wallet className="h-4 w-4" />
                  My Account
                </Link>
                <Link href="/manage-markets" className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-primary)]" onClick={() => setMenuOpen(false)}>
                  <ShieldCheck className="h-4 w-4" />
                  Manage Markets
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setMenuOpen(false);
                  }}
                  className="mt-2 inline-flex w-full items-center justify-center gap-3 rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] px-4 py-3 text-sm font-semibold text-[color:var(--text-primary)]"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!isConnected ? (
          <div className="mt-2 grid lg:hidden">
            <ActionButton
              type="button"
              onClick={handleWalletClick}
              disabled={isPending}
              tone="gold"
              className="justify-center px-4 py-2.5"
            >
              {isPending ? "Connecting..." : "Connect Wallet"}
            </ActionButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
