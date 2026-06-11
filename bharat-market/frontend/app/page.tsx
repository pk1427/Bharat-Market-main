import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Eye,
  FileText,
  GitBranch,
  Globe2,
  Radio,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TrendingUp
} from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

export default function LandingPage() {
  return (
    <main className="page-stack">
      <section className="relative overflow-hidden rounded-[32px] border border-[color:var(--border-default)] bg-[radial-gradient(circle_at_18%_12%,rgba(34,217,138,0.14),transparent_24rem),radial-gradient(circle_at_70%_0%,rgba(124,92,252,0.18),transparent_26rem),linear-gradient(180deg,rgba(14,14,23,0.94),rgba(7,7,13,0.98))] px-5 py-8 sm:px-8 sm:py-12 lg:px-10">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_430px] xl:items-center">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="Live on Polygon Amoy" tone="mint" />
              <StatusBadge label="Oracle-settled" tone="gold" />
              <StatusBadge label="Indexed backend" tone="slate" />
            </div>
            <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">
              Predict. Trade. Verify.
            </p>
            <h1 className="mt-3 max-w-5xl text-[3.2rem] font-semibold leading-[0.98] tracking-[-0.06em] text-[color:var(--text-primary)] sm:text-[5.5rem] xl:text-[6.4rem]">
              Oracle-powered prediction markets.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--text-secondary)]">
              Create, trade, resolve, and embed crypto and cricket prediction markets with transparent provider data, Chainlink Functions settlement, and a backend indexer built for smooth exchange-grade UX.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/markets"
                className="inline-flex items-center gap-2 rounded-[var(--r-md)] bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Enter Protocol
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] px-5 py-3 text-sm font-semibold text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
              >
                Read Documentation
                <FileText className="h-4 w-4" />
              </Link>
              <Link
                href="/create-market"
                className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-transparent px-5 py-3 text-sm font-semibold text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
              >
                Create Market
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <Panel className="p-5">
            <p className="micro-label">Private reserves</p>
            <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">Oracle Integrity: Active</h2>
            <div className="mt-5 grid gap-3">
              <HeroSignal icon={ShieldCheck} title="Deterministic Settlement" body="CoinGecko and CricAPI provider responses flow through Chainlink Functions before on-chain outcome updates." />
              <HeroSignal icon={TerminalSquare} title="Indexed Execution" body="Market board, portfolio, widgets, and public APIs read from BharatMarket’s backend data layer." />
              <HeroSignal icon={Eye} title="Transparent Outcomes" body="Each market exposes provider, external id, settlement rule, fetched result, and resolution state." />
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <LandingFeature
          icon={Radio}
          title="Oracle-settled markets"
          body="CoinGecko and CricAPI outcomes flow through Chainlink Functions before markets resolve on-chain."
        />
        <LandingFeature
          icon={TrendingUp}
          title="Exchange-grade board"
          body="Indexed probabilities, liquidity, market activity, and portfolio state keep the frontend fast and consistent."
        />
        <LandingFeature
          icon={Globe2}
          title="Embeddable protocol"
          body="Public APIs, webhooks, SDK foundations, and widgets make BharatMarket usable by external products."
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-stretch">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[color:var(--border-subtle)] px-5 py-5">
            <p className="micro-label">Architecture</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              Built for oracle-first execution
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--text-secondary)]">
              The frontend reads indexed backend state for speed, while deterministic settlement flows through provider adapters, Chainlink Functions, and market contracts.
            </p>
          </div>
          <div className="grid gap-0 divide-y divide-[color:var(--border-subtle)] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            {architecturePath.map((item, index) => (
              <div key={item.title} className="p-5">
                <span className="font-mono text-[11px] text-[color:var(--text-tertiary)]">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{item.body}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="micro-label">Live status</p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">What works today</h2>
          <div className="mt-5 grid gap-3">
            {liveFeatures.map((feature) => (
              <div key={feature.title} className="flex gap-3 rounded-[var(--r-md)] bg-[color:var(--surface-2)] p-3">
                <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--green)]" />
                <div>
                  <p className="font-semibold text-[color:var(--text-primary)]">{feature.title}</p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--text-secondary)]">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[color:var(--border-subtle)] px-5 py-5">
            <p className="micro-label">Roadmap</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">From testnet exchange to protocol platform</h2>
          </div>
          <div className="grid gap-0 divide-y divide-[color:var(--border-subtle)] md:grid-cols-3 md:divide-x md:divide-y-0">
            <RoadmapPhase phase="Current" title="Oracle market core" items={["Crypto + cricket", "USDC trading", "Automated resolution"]} />
            <RoadmapPhase phase="Next" title="Developer platform" items={["API keys", "Webhooks", "SDK package"]} />
            <RoadmapPhase phase="Later" title="Market expansion" items={["Multi-outcome", "Private markets", "Mainnet readiness"]} />
          </div>
        </Panel>

        <section className="rounded-[32px] border border-[color:var(--border-default)] bg-[color:var(--surface-1)] px-5 py-7">
          <Sparkles className="h-6 w-6 text-[color:var(--accent)]" />
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
            Start trading testnet markets
          </h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">
            Open the board, create a structured market, or read the technical docs.
          </p>
          <div className="mt-6 grid gap-3">
            <Link href="/markets" className="inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] bg-white px-5 py-3 text-sm font-semibold text-black">
              Launch Testnet App
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs" className="inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-[color:var(--border-default)] px-5 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
              Documentation
              <FileText className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}

function HeroSignal({
  icon: Icon,
  title,
  body
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[color:var(--green)]" />
        <p className="font-semibold text-[color:var(--text-primary)]">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{body}</p>
    </div>
  );
}

function LandingFeature({
  icon: Icon,
  title,
  body
}: {
  icon: typeof Radio;
  title: string;
  body: string;
}) {
  return (
    <Panel hover className="p-5">
      <Icon className="h-5 w-5 text-[color:var(--blue)]" />
      <h2 className="mt-4 text-xl font-semibold text-[color:var(--text-primary)]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">{body}</p>
    </Panel>
  );
}

function RoadmapPhase({
  phase,
  title,
  items
}: {
  phase: string;
  title: string;
  items: string[];
}) {
  return (
    <div className="p-5">
      <p className="micro-label">{phase}</p>
      <h3 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{title}</h3>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--green)]" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

const liveFeatures = [
  {
    icon: ShieldCheck,
    title: "CoinGecko crypto settlement",
    body: "BTC, ETH, SOL, and USDC markets resolve through provider-backed Chainlink Functions."
  },
  {
    icon: Radio,
    title: "CricAPI cricket settlement",
    body: "Winner markets use fixture metadata and deterministic selected-team matching."
  },
  {
    icon: TerminalSquare,
    title: "Autonomous workers",
    body: "Expired markets are detected, requested, indexed, and surfaced without manual hidden settlement."
  }
];

const architecturePath = [
  {
    title: "Create",
    body: "Structured metadata defines category, provider, market type, target, and settlement rule."
  },
  {
    title: "Trade",
    body: "Users trade YES/NO and add liquidity with wallet-native USDC execution."
  },
  {
    title: "Verify",
    body: "Chainlink Functions fetches provider data after expiry and normalizes the outcome."
  },
  {
    title: "Index",
    body: "Backend workers persist market, oracle, portfolio, and redemption-ready state."
  }
];
