import { ActionHub } from "@/components/action-hub";
import { Panel } from "@/components/ui/panel";
import { WalletRequiredGate } from "@/components/wallet-required-gate";

export default function CreateMarketPage() {
  return (
    <main className="page-stack">
      <Panel className="protocol-card-strong overflow-hidden p-0">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
              Creator Console
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)] sm:text-4xl">
              Launch an oracle-settled market.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
              Choose a crypto rule or a real cricket fixture, review the generated oracle metadata, approve the USDC creation fee, and deploy the market on Amoy.
            </p>
          </div>

          <div className="grid gap-2 rounded-[22px] border border-white/10 bg-black/20 p-3">
            <CreatorStep number="01" title="Select event" body="Pick crypto parameters or a CricAPI fixture." />
            <CreatorStep number="02" title="Review oracle" body="BharatMarket generates the settlement metadata." />
            <CreatorStep number="03" title="Approve + create" body="Wallet approval and market deployment stay separate." />
          </div>
        </div>
      </Panel>
      <WalletRequiredGate
        title="Connect to create markets"
        description="Market creation requires your wallet for the USDC creation-fee approval and the on-chain MarketFactory transaction."
        feature="Creator access"
      >
        <ActionHub />
      </WalletRequiredGate>
    </main>
  );
}

function CreatorStep({
  number,
  title,
  body
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-start gap-3">
        <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-1 font-mono text-[10px] text-violet-200">
          {number}
        </span>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
        </div>
      </div>
    </div>
  );
}
