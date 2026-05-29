import { runResolutionSync } from "@/backend/services/resolution-runner";
import { loadLocalEnvFile } from "@/backend/workers/load-env";

loadLocalEnvFile();

const intervalMs = Number(process.env.RESOLUTION_SYNC_INTERVAL_MS || process.env.INDEXER_SYNC_INTERVAL_MS || "30000");

async function main() {
  console.log(`[resolution] starting BharatMarket resolution loop (${intervalMs}ms)`);

  while (true) {
    try {
      const result = await runResolutionSync("loop");
      console.log(`[resolution] ${JSON.stringify(result)}`);
    } catch (error) {
      console.error("[resolution] failed", error);
    }

    await sleep(intervalMs);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main();
