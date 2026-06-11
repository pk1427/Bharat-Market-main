import { ActionHub } from "@/components/action-hub";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

export default function CreateMarketPage() {
  return (
    <main className="space-y-3 pb-10">
      <Panel className="p-4 sm:p-5">
        <SectionHeader
          eyebrow="Creator Console"
          title="Create Market"
          description="Launch a new sports prediction contract with external USDC collateral, oracle metadata, and wallet-native approvals."
        />
      </Panel>
      <ActionHub />
    </main>
  );
}
