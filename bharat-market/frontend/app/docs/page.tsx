import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  FileJson,
  GitBranch,
  Globe2,
  Layers3,
  Radio,
  ShieldCheck,
  TerminalSquare
} from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

const docNav = [
  {
    group: "Introduction",
    items: [
      ["Overview", "#overview"],
      ["BharatMarket 101", "#bharatmarket-101"],
      ["Supported markets", "#supported-markets"],
      ["Market lifecycle", "#market-lifecycle"]
    ]
  },
  {
    group: "Oracle Layer",
    items: [
      ["Structured metadata", "#oracle-metadata"],
      ["Crypto settlement", "#crypto-settlement"],
      ["Cricket settlement", "#cricket-settlement"],
      ["Automation", "#automation"]
    ]
  },
  {
    group: "Using The App",
    items: [
      ["Markets", "#markets-page"],
      ["Create", "#create-page"],
      ["Account", "#account-page"],
      ["Embeds", "#embeds"]
    ]
  },
  {
    group: "Integrate",
    items: [
      ["Quickstart", "#quickstart"],
      ["SDK", "#sdk"],
      ["Public API", "#api"],
      ["Webhooks", "#webhooks"]
    ]
  },
  {
    group: "Reference",
    items: [
      ["Contracts", "#contracts"],
      ["Indexer", "#indexer"],
      ["Environment", "#environment"],
      ["Roadmap", "#roadmap"]
    ]
  }
];

const toc = [
  ["Documentation overview", "#overview"],
  ["BharatMarket 101", "#bharatmarket-101"],
  ["Supported markets", "#supported-markets"],
  ["Oracle architecture", "#oracle-metadata"],
  ["Using the app", "#markets-page"],
  ["Integrate", "#quickstart"],
  ["Reference", "#contracts"],
  ["Roadmap", "#roadmap"]
];

const supportedMarkets = [
  {
    title: "Crypto markets",
    status: "Live",
    tone: "mint" as const,
    body: "CoinGecko-backed price_above and price_below markets for BTC, ETH, SOL, and USDC-style outcomes."
  },
  {
    title: "Cricket markets",
    status: "Live",
    tone: "mint" as const,
    body: "CricAPI-backed winner markets using finished fixture data and deterministic team normalization."
  },
  {
    title: "Election markets",
    status: "Planned",
    tone: "gold" as const,
    body: "Visible as architecture only until verified, reproducible election result providers are added."
  }
];

const appPages: Array<[string, string]> = [
  ["Markets", "Live and awaiting markets, indexed probabilities, category filters, top movers, and direct market entry."],
  ["History", "Resolved and ended markets with outcome review and archive visibility."],
  ["Create", "Structured market creation with oracle metadata, USDC fee approval, and wallet-native contract deployment."],
  ["My Account", "Portfolio terminal for YES/NO/LP holdings, redeemable claims, open exposure, and book health."],
  ["Manage Markets", "Creator-facing board for markets launched by the connected wallet."],
  ["Embeds", "Partner-friendly board and market widgets backed by indexed BharatMarket data."],
  ["Docs", "Protocol documentation, integration notes, current stage, and roadmap."]
];

const apiEndpoints = [
  "GET /api/public/markets",
  "GET /api/public/markets/[address]",
  "GET /api/public/portfolio/[wallet]",
  "GET /api/public/oracles"
];

const webhookEvents = [
  "market.created",
  "trade.executed",
  "liquidity.added",
  "oracle.requested",
  "oracle.completed",
  "market.resolved"
];

const liveFeatures = [
  "Crypto creation, trading, indexing, Chainlink Functions settlement, and redemption",
  "Cricket winner-market creation and provider-backed settlement path",
  "Backend indexer with market, activity, portfolio, snapshot, and oracle state",
  "Autonomous resolution worker and Vercel-compatible sync endpoints",
  "Public API, webhook foundation, SDK foundation, and embed widgets"
];

const plannedFeatures = [
  "Multi-outcome markets",
  "Creator revenue sharing",
  "Trader and creator reputation",
  "Private markets and access control",
  "API keys and developer tiers",
  "Verified election settlement",
  "Mainnet-ready deployment hardening"
];

export default function DocsPage() {
  return (
    <main className="page-stack">
      <Panel className="protocol-card-strong overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="border-b border-[color:var(--border-subtle)] bg-[rgba(7,7,13,0.36)] p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--r-md)] border border-[color:var(--accent-border)] bg-[color:var(--accent-dim)] text-[color:var(--accent)]">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-[color:var(--text-primary)]">BharatMarket</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Protocol docs</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              <DocFact label="Network" value="Polygon Amoy" />
              <DocFact label="Collateral" value="USDC" />
              <DocFact label="Stage" value="Testnet beta" />
            </div>
          </div>

          <div className="px-5 py-6 sm:px-7 sm:py-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--blue)]">Documentation overview</p>
            <h1 className="mt-3 max-w-4xl text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.045em] text-[color:var(--text-primary)] sm:text-[4.25rem]">
              Oracle-powered prediction market protocol.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[color:var(--text-secondary)]">
              BharatMarket lets users and applications create, trade, settle, and embed prediction markets. This guide is organized with concepts first, then each user action, then integration and reference, mapped to the indexed backend, contracts, and oracle workers.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LinkButton href="/create-market" label="Create market" />
              <LinkButton href="/embed" label="Embed widgets" />
              <LinkButton href="#quickstart" label="Integrate" />
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[250px_minmax(0,1fr)_240px] xl:items-start">
        <aside className="hidden xl:block xl:sticky xl:top-28">
          <DocsRail title="Docs">
            {docNav.map((section) => (
              <div key={section.group} className="space-y-2">
                <p className="micro-label">{section.group}</p>
                <div className="grid gap-1">
                  {section.items.map(([label, href]) => (
                    <a key={href} href={href} className="rounded-[var(--r-md)] px-3 py-2 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-primary)]">
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </DocsRail>
        </aside>

        <div className="space-y-5">
          <DocsSection id="overview" icon={BookOpen} eyebrow="Introduction" title="Overview">
            <p>
              BharatMarket is an oracle-powered prediction market exchange for binary event markets. Users create YES/NO markets, provide liquidity, trade outcomes, and redeem winning claims after deterministic on-chain settlement.
            </p>
            <p>
              The live system currently focuses on crypto and cricket markets. Both use structured oracle metadata so the result is externally sourced, reproducible, auditable, and visible in the UI.
            </p>
          </DocsSection>

          <DocsSection id="bharatmarket-101" icon={Layers3} eyebrow="Concepts" title="BharatMarket 101">
            <NumberedList
              items={[
                "Connect a Polygon Amoy wallet and fund it with USDC plus enough POL for gas.",
                "Create or open a market. Every live production market should carry structured oracle metadata.",
                "Trade YES or NO shares, add liquidity, and monitor probabilities from the indexed backend.",
                "After expiry, the resolution worker requests Chainlink Functions to fetch provider data.",
                "Once the market resolves on-chain, the indexer syncs outcome state and redemption unlocks."
              ]}
            />
          </DocsSection>

          <DocsSection id="supported-markets" icon={ShieldCheck} eyebrow="Market types" title="Supported markets">
            <div className="grid gap-3 md:grid-cols-3">
              {supportedMarkets.map((market) => (
                <div key={market.title} className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-[color:var(--text-primary)]">{market.title}</h3>
                    <StatusBadge label={market.status} tone={market.tone} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">{market.body}</p>
                </div>
              ))}
            </div>
          </DocsSection>

          <DocsSection id="market-lifecycle" icon={GitBranch} eyebrow="Lifecycle" title="Market lifecycle">
            <FlowGrid
              items={[
                "Create Market",
                "Trade YES / NO",
                "Market Expires",
                "Oracle Verification",
                "On-chain Settlement",
                "Redemption"
              ]}
            />
          </DocsSection>

          <DocsSection id="oracle-metadata" icon={FileJson} eyebrow="Oracle layer" title="Structured oracle metadata">
            <p>
              BharatMarket avoids arbitrary free-text settlement rules. Market creation encodes provider, category, external id, market type, settlement rule, verification source, and fallback details into a structured metadata payload.
            </p>
            <CodeBlock
              lines={[
                "{",
                "  category: 'crypto',",
                "  provider: 'coingecko',",
                "  marketType: 'price_above',",
                "  externalId: 'ethereum',",
                "  targetPrice: 5000",
                "}"
              ]}
            />
          </DocsSection>

          <DocsSection id="crypto-settlement" icon={Radio} eyebrow="Settlement" title="Crypto settlement">
            <p>
              Crypto markets use CoinGecko as the external provider and Chainlink Functions as the trusted fetch/normalization layer. Supported assets include bitcoin, ethereum, solana, and usd-coin style market rules.
            </p>
            <ReferenceList
              items={[
                ["Provider", "CoinGecko market chart range endpoint"],
                ["Market types", "price_above, price_below"],
                ["Output", "YES or NO plus fetched settlement price"],
                ["Persistence", "Oracle event, provider payload, settlement price, and resolved market state"]
              ]}
            />
          </DocsSection>

          <DocsSection id="cricket-settlement" icon={ShieldCheck} eyebrow="Settlement" title="Cricket settlement">
            <p>
              Cricket markets use CricAPI-compatible fixture metadata. Winner markets resolve by comparing the official match winner against the selected YES team after the fixture is completed.
            </p>
            <ReferenceList
              items={[
                ["Provider", "CricAPI match result endpoint"],
                ["Market type", "winner"],
                ["Rule", "selectedTeam must equal official match winner"],
                ["Status", "Live provider path; election remains future-only"]
              ]}
            />
          </DocsSection>

          <DocsSection id="automation" icon={TerminalSquare} eyebrow="Automation" title="Resolution automation">
            <p>
              The resolution worker scans expired, unresolved, eligible markets from the database, performs prechecks, requests Chainlink Functions, records oracle lifecycle events, and avoids repeated spam through retry cooldowns. Sync endpoints are available for production schedulers.
            </p>
            <CodeBlock
              lines={[
                "market expires",
                "→ worker detects eligible market",
                "→ Chainlink Functions fetches provider data",
                "→ market resolves on-chain",
                "→ indexer syncs result",
                "→ frontend unlocks redemption"
              ]}
            />
          </DocsSection>

          <DocsSection id="markets-page" icon={Globe2} eyebrow="Using the app" title="Pages and tools">
            <ReferenceList items={appPages} />
          </DocsSection>

          <DocsSection id="create-page" icon={CheckCircle2} eyebrow="Creator flow" title="Create market">
            <p>
              Creation is intentionally a two-step wallet flow: approve USDC for the creation fee, then create the market. This keeps ERC-20 allowance explicit and avoids hidden spending permissions.
            </p>
          </DocsSection>

          <DocsSection id="account-page" icon={Layers3} eyebrow="Portfolio" title="Account and positions">
            <p>
              The account center reads portfolio groups from BharatMarket’s indexed data layer and supplements wallet state where needed. It tracks YES, NO, LP holdings, redeemable claims, market status, and estimated value.
            </p>
          </DocsSection>

          <DocsSection id="embeds" icon={Globe2} eyebrow="Widgets" title="Embeds">
            <CodeBlock
              lines={[
                "<iframe src=\"https://bharat-market-main.vercel.app/embed/board\" />",
                "<iframe src=\"https://bharat-market-main.vercel.app/embed/market/0x...\" />"
              ]}
            />
          </DocsSection>

          <DocsSection id="quickstart" icon={Code2} eyebrow="Integrate" title="Quickstart">
            <NumberedList
              items={[
                "Use the public API to read indexed market state.",
                "Use the SDK foundation for create, buy, liquidity, portfolio, and redeem flows.",
                "Subscribe webhooks for market and oracle lifecycle events.",
                "Use embeds for partner surfaces that need a compact board or market card."
              ]}
            />
          </DocsSection>

          <DocsSection id="sdk" icon={Code2} eyebrow="SDK" title="SDK surface">
            <CodeBlock
              lines={[
                "createMarket({ category: 'crypto', asset: 'ETH', targetPrice: 5000 })",
                "buyYes({ market, amount: '10' })",
                "buyNo({ market, amount: '10' })",
                "addLiquidity({ market, amount: '100' })",
                "redeem({ market })"
              ]}
            />
          </DocsSection>

          <DocsSection id="api" icon={FileJson} eyebrow="Public API" title="Indexed endpoints">
            <CodeBlock lines={apiEndpoints} />
          </DocsSection>

          <DocsSection id="webhooks" icon={Radio} eyebrow="Webhooks" title="Event model">
            <CodeBlock lines={webhookEvents} />
          </DocsSection>

          <DocsSection id="contracts" icon={ShieldCheck} eyebrow="Reference" title="Contracts">
            <ReferenceList
              items={[
                ["MarketFactory", "Creates CPMM-style YES/NO markets and collects the creation fee"],
                ["Market", "Handles trading, liquidity, settlement state, and redemption"],
                ["ChainlinkFunctionsOracle", "Requests provider-backed settlement and calls markets with deterministic outcome"],
                ["USDC collateral", "External collateral token configured by deployment environment"]
              ]}
            />
          </DocsSection>

          <DocsSection id="indexer" icon={TerminalSquare} eyebrow="Reference" title="Indexer and database">
            <p>
              The app is designed for smooth UX through PostgreSQL-backed indexed reads. Frontend dashboards consume backend API data first; direct RPC reads are used for wallet-sensitive or fallback state where appropriate.
            </p>
          </DocsSection>

          <DocsSection id="environment" icon={FileJson} eyebrow="Reference" title="Environment">
            <CodeBlock
              lines={[
                "DATABASE_URL",
                "INDEXER_RPC_URL",
                "NEXT_PUBLIC_MARKET_FACTORY_ADDRESS",
                "NEXT_PUBLIC_USDC_ADDRESS",
                "NEXT_PUBLIC_CHAINLINK_ORACLE_ADDRESS",
                "RESOLUTION_WORKER_PRIVATE_KEY",
                "EXCHANGE_SYNC_SECRET"
              ]}
            />
          </DocsSection>

          <DocsSection id="roadmap" icon={GitBranch} eyebrow="Roadmap" title="Current stage and next plans">
            <div className="grid gap-4 md:grid-cols-2">
              <RoadmapCard title="Live / built" items={liveFeatures} tone="mint" />
              <RoadmapCard title="Planned next" items={plannedFeatures} tone="gold" />
            </div>
          </DocsSection>
        </div>

        <aside className="hidden xl:block xl:sticky xl:top-28">
          <DocsRail title="On this page">
            <div className="grid gap-1">
              {toc.map(([label, href]) => (
                <a key={href} href={href} className="rounded-[var(--r-md)] px-3 py-2 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text-primary)]">
                  {label}
                </a>
              ))}
            </div>
          </DocsRail>
        </aside>
      </div>
    </main>
  );
}

function DocsRail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4">
      <p className="micro-label">{title}</p>
      <div className="mt-4 space-y-5">{children}</div>
    </Panel>
  );
}

function DocsSection({
  id,
  icon: Icon,
  eyebrow,
  title,
  children
}: {
  id: string;
  icon: typeof BookOpen;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <Panel className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] text-[color:var(--blue)]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="micro-label">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-primary)]">{title}</h2>
        </div>
      </div>
      <div className="mt-5 space-y-4 text-sm leading-7 text-[color:var(--text-secondary)]">{children}</div>
      </Panel>
    </section>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div key={item} className="flex gap-3 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-3 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-default)] font-mono text-xs text-[color:var(--text-tertiary)]">
            {index + 1}
          </span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function FlowGrid({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item, index) => (
        <div key={item} className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] p-4">
          <span className="font-mono text-[11px] text-[color:var(--text-tertiary)]">0{index + 1}</span>
          <p className="mt-3 font-semibold text-[color:var(--text-primary)]">{item}</p>
        </div>
      ))}
    </div>
  );
}

function ReferenceList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-2 rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] px-3 py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <p className="font-semibold text-[color:var(--text-primary)]">{label}</p>
          <p>{value}</p>
        </div>
      ))}
    </div>
  );
}

function RoadmapCard({
  title,
  items,
  tone
}: {
  title: string;
  items: string[];
  tone: "mint" | "gold";
}) {
  return (
    <div className="rounded-[var(--r-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-2)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[color:var(--text-primary)]">{title}</h3>
        <StatusBadge label={tone === "mint" ? "Done" : "Next"} tone={tone} />
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            <span className={tone === "mint" ? "mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--green)]" : "mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--amber)]"} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-0)] p-4">
      <div className="space-y-2">
        {lines.map((line) => (
          <code key={line} className="block break-words font-mono text-xs leading-5 text-[color:var(--text-secondary)]">
            {line}
          </code>
        ))}
      </div>
    </div>
  );
}

function DocFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--r-md)] bg-[color:var(--surface-2)] px-3 py-2">
      <span className="micro-label">{label}</span>
      <span className="font-mono text-sm font-semibold text-[color:var(--text-primary)]">{value}</span>
    </div>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] px-3 py-2 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-border)]"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
