import { CreatorDashboard } from "@/components/creator-dashboard";
import { WalletRequiredGate } from "@/components/wallet-required-gate";

export default function ManageMarketsPage() {
  return (
    <main className="page-stack">
      <WalletRequiredGate
        title="Connect to manage markets"
        description="Creator management is wallet-scoped, so BharatMarket needs the creator wallet before showing launched markets."
        feature="Creator dashboard"
      >
        <CreatorDashboard />
      </WalletRequiredGate>
    </main>
  );
}
