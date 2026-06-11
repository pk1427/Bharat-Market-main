import { EmbedMarketWidget } from "@/components/embed-market-widget";

export default async function EmbedMarketPage({
  params
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  return (
    <main className="pb-10">
      <EmbedMarketWidget address={address} />
    </main>
  );
}
