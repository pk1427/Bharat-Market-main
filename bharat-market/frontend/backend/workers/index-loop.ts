import { getPrismaClient } from "@/backend/db/client";
import { runIndexerSync } from "@/backend/services/indexer-runner";
import { loadLocalEnvFile } from "@/backend/workers/load-env";

const intervalMs = Number(process.env.INDEXER_SYNC_INTERVAL_MS ?? "30000");

async function tick() {
  const result = await runIndexerSync("loop");
  console.log("Indexed BharatMarket protocol state", result);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadLocalEnvFile();

  while (true) {
    try {
      await tick();
    } catch (error) {
      console.error("Loop indexer tick failed");
      console.error(error);
    }

    await sleep(intervalMs);
  }
}

main().catch((error) => {
  console.error("Failed to start BharatMarket loop indexer");
  console.error(error);
  process.exitCode = 1;
});

process.on("SIGINT", async () => {
  await getPrismaClient()?.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await getPrismaClient()?.$disconnect();
  process.exit(0);
});
