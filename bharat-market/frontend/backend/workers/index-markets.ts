import { getPrismaClient } from "@/backend/db/client";
import { runIndexerSync } from "@/backend/services/indexer-runner";
import { loadLocalEnvFile } from "@/backend/workers/load-env";

async function main() {
  loadLocalEnvFile();
  const result = await runIndexerSync("manual");

  console.log("Indexed BharatMarket protocol state", result);
}

main()
  .catch((error) => {
    console.error("Failed to index BharatMarket events");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrismaClient()?.$disconnect();
  });
