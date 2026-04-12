import { MarketDetail } from "@/components/market-detail";

export default async function MarketPage({
  params
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  return (
    <main className="pb-10">
      <MarketDetail address={address} />
    </main>
  );
}
