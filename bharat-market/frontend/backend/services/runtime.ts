import { getPrismaClient, isDatabaseConfigured } from "@/backend/db/client";

export function getIndexedBackend() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  return getPrismaClient();
}
