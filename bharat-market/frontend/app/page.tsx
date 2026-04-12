"use client";

import { ActionHub } from "@/components/action-hub";
import { MarketList } from "@/components/market-list";

import { useState } from "react";

export default function HomePage() {
  const [marketRefreshTick, setMarketRefreshTick] = useState(0);

  return (
    <main className="space-y-10 pb-10">
      <section className="glass overflow-hidden rounded-[32px] border border-white/10 shadow-pulse">
        <div className="grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-end lg:py-14">
          <div className="space-y-5">
            <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-gold">
              Polygon Amoy • IPL Focus
            </span>
            <div className="space-y-4">
              <h1 className="font-heading max-w-3xl text-5xl uppercase leading-none text-white sm:text-6xl">
                Trade cricket convictions, not just opinions.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                BharatMarket turns live sports narratives into on-chain YES/NO markets with
                transparent pricing, wallet-native execution, and redemption after resolution.
              </p>
            </div>
          </div>

          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="rounded-2xl border border-mint/20 bg-mint/10 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-mint">What You Can Do</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Connect MetaMask, scan active IPL-style markets, preview YES/NO pricing, trade
                with MockUSDC, and redeem after resolution.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm leading-6 text-slate-300">
              Markets are loaded from your deployed MarketFactory and pricing is read live from each
              market contract.
            </div>
          </div>
        </div>
      </section>

      <ActionHub onMarketCreated={() => setMarketRefreshTick((value) => value + 1)} />

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-3xl uppercase tracking-wide text-white">
            Live Markets
          </h2>
          <p className="text-sm text-slate-400">
            Markets are served through the BharatMarket backend cache so the board stays stable when Amoy RPC is noisy.
          </p>
        </div>

        <MarketList externalRefreshTick={marketRefreshTick} />
      </section>
    </main>
  );
}
