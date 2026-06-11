import { redirect } from "next/navigation";
import Link from "next/link";

import { listTrendingMarkets } from "@/backend/services/markets";
import { EmbedMarketWidget } from "@/components/embed-market-widget";
import { Panel } from "@/components/ui/panel";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default async function EmbedMarketPage({
  params
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const normalizedAddress = address.toLowerCase();

  if (normalizedAddress === ZERO_ADDRESS) {
    const latestMarkets = await listTrendingMarkets(1);
    const fallbackAddress = latestMarkets?.[0]?.address ?? process.env.NEXT_PUBLIC_DEFAULT_MARKET_ADDRESS;

    if (fallbackAddress && fallbackAddress.toLowerCase() !== ZERO_ADDRESS) {
      redirect(`/embed/market/${fallbackAddress}`);
    }

    return (
      <main className="pb-10">
        <Panel className="rounded-[28px] border border-coral/20 bg-coral/10 p-5 text-coral">
          No default market address is configured yet. Open the board widget or pass a real market
          address to preview the embed card.
          <div className="mt-4">
            <Link
              href="/embed/board"
              className="inline-flex items-center rounded-full border border-coral/30 bg-black/10 px-4 py-2 text-sm font-semibold text-coral transition hover:border-coral/40"
            >
              Open board embed
            </Link>
          </div>
        </Panel>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <EmbedMarketWidget address={address} />
    </main>
  );
}
