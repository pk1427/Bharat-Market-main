import { dispatchPendingWebhookDeliveries } from "@/backend/services/webhooks";

const intervalMs = Number(process.env.WEBHOOK_SYNC_INTERVAL_MS ?? "30000");

async function main() {
  console.log(`[webhook] starting BharatMarket webhook loop (${intervalMs}ms)`);

  while (true) {
    try {
      const result = await dispatchPendingWebhookDeliveries();
      console.log(`[webhook] ${JSON.stringify({ status: "webhook_checked", ...result })}`);
    } catch (error) {
      console.error("[webhook] failed", error);
    }

    await delay(intervalMs);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main();
