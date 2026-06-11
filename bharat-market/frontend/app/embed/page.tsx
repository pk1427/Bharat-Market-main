import Link from "next/link";

import { Panel } from "@/components/ui/panel";

export default function EmbedLandingPage() {
  return (
    <main className="pb-12">
      <Panel className="rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,14,24,0.98),rgba(16,18,28,0.96))] p-8">
        <p className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Embeds</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">
          BharatMarket widgets for external products
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
          Use the compact market and board widgets inside news, creator, or community products.
          These views stay indexed and read from BharatMarket’s backend data layer.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link
            href="/embed/board"
            className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-400/30 hover:bg-white/[0.05]"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Board Widget</p>
            <p className="mt-3 text-xl font-semibold text-white">Live market board</p>
            <p className="mt-2 text-sm text-slate-400">A compact live board for iframes or partner surfaces.</p>
          </Link>
          <Link
            href="/embed/market/0x0000000000000000000000000000000000000000"
            className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-400/30 hover:bg-white/[0.05]"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Market Widget</p>
            <p className="mt-3 text-xl font-semibold text-white">Single market card</p>
            <p className="mt-2 text-sm text-slate-400">Embed any market using its on-chain address.</p>
          </Link>
        </div>
      </Panel>
    </main>
  );
}
