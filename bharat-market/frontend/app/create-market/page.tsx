import { ActionHub } from "@/components/action-hub";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

export default function CreateMarketPage() {
  return (
    <main className="page-stack">
      <Panel className="protocol-card-strong p-4 sm:p-5">
        <SectionHeader
          eyebrow="Creator Console"
          title="Create Market"
          description="Launch oracle-settled crypto and cricket markets with USDC collateral, structured metadata, and wallet-native approvals."
        />
      </Panel>
      <ActionHub />
    </main>
  );
}
