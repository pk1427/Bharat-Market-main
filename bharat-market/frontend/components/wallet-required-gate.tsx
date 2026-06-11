"use client";

import { ReactNode } from "react";
import { LockKeyhole, ShieldCheck, Wallet } from "lucide-react";
import { useAccount, useChainId, useConnect, useSwitchChain } from "wagmi";
import { polygonAmoy } from "wagmi/chains";

import { ActionButton } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";

export function WalletRequiredGate({
  children,
  title = "Wallet connection required",
  description = "Connect a Polygon Amoy wallet before using this BharatMarket workspace.",
  feature = "Wallet-gated workspace"
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  feature?: string;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending } = useConnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const connector =
    connectors.find((item) => item.name.toLowerCase().includes("metamask")) ?? connectors[0];
  const onExpectedNetwork = chainId === polygonAmoy.id;

  if (isConnected && onExpectedNetwork) {
    return <>{children}</>;
  }

  return (
    <Panel glow className="mx-auto max-w-4xl overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative overflow-hidden px-6 py-8 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(88,166,255,0.18),transparent_44%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-dim)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              <LockKeyhole className="h-3.5 w-3.5" />
              {feature}
            </div>
            <h2 className="mt-6 font-heading text-5xl uppercase tracking-[-0.05em] text-[color:var(--text-primary)] sm:text-6xl">
              {title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)]">
              {description}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {!isConnected ? (
                <ActionButton
                  type="button"
                  tone="gold"
                  disabled={!connector || isPending}
                  onClick={() => connector && connect({ connector })}
                  className="min-w-[190px]"
                >
                  {isPending ? "Connecting..." : "Connect MetaMask"}
                </ActionButton>
              ) : (
                <ActionButton
                  type="button"
                  tone="gold"
                  disabled={isSwitching}
                  onClick={() => void switchChainAsync({ chainId: polygonAmoy.id })}
                  className="min-w-[190px]"
                >
                  {isSwitching ? "Switching..." : "Switch to Amoy"}
                </ActionButton>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] p-6 lg:border-l lg:border-t-0">
          <div className="space-y-3">
            <Requirement icon={Wallet} label="Wallet" value={isConnected ? "Connected" : "Required"} />
            <Requirement icon={ShieldCheck} label="Network" value={onExpectedNetwork ? "Amoy" : "Polygon Amoy required"} />
            <Requirement icon={LockKeyhole} label="Signing" value="User approved only" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Requirement({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-1)] p-4">
      <div className="flex items-center gap-2 text-[color:var(--text-tertiary)]">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}
