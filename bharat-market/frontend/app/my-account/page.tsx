import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { WalletRequiredGate } from "@/components/wallet-required-gate";

export default function MyAccountPage() {
  return (
    <main className="page-stack">
      <WalletRequiredGate
        title="Connect to view account"
        description="Your portfolio, redeemable winnings, wallet exposure, and LP positions are scoped to the connected BharatMarket wallet."
        feature="Account access"
      >
        <PortfolioDashboard />
      </WalletRequiredGate>
    </main>
  );
}
