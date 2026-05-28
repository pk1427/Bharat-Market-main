import { PrismaClient } from "@prisma/client";

declare global {
  var __bharatMarketPrisma: PrismaClient | undefined;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrismaClient() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!globalThis.__bharatMarketPrisma) {
    globalThis.__bharatMarketPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
  }

  return globalThis.__bharatMarketPrisma;
}
