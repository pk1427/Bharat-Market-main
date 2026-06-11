import Link from "next/link";

import { listTrendingMarkets } from "@/backend/services/markets";
import { Panel } from "@/components/ui/panel";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const dynamic = "force-dynamic";

export default async function EmbedLandingPage() {
  const latestMarkets = await listTrendingMarkets(1);
  const latestMarketAddress =
    latestMarkets?.[0]?.address ?? process.env.NEXT_PUBLIC_DEFAULT_MARKET_ADDRESS ?? ZERO_ADDRESS;
  const marketHref =
    latestMarketAddress.toLowerCase() === ZERO_ADDRESS ? "/embed/board" : `/embed/market/${latestMarketAddress}`;

  return (
    <main className="page-stack">
      <Panel className="protocol-card-strong p-5">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--blue)]">Embeds</p>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
          BharatMarket widgets for external products
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-secondary)]">
          Use the compact market and board widgets inside news, creator, or community products.
          These views stay indexed and read from BharatMarket’s backend data layer.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Link
            href="/embed/board"
            className="rounded-[var(--r-lg)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--accent-border)]"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">Board Widget</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">Live market board</p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">A compact live board for iframes or partner surfaces.</p>
          </Link>
          <Link
            href={marketHref}
            className="rounded-[var(--r-lg)] border border-[color:var(--border-default)] bg-[color:var(--surface-2)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--accent-border)]"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">Market Widget</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">Single market card</p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
              Open the latest indexed market, or pass any on-chain address directly.
            </p>
          </Link>
        </div>
      </Panel>
    </main>
  );
}
