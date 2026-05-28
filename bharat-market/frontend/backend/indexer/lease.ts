import type { PrismaClient } from "@prisma/client";

declare global {
  var __bharatMarketIndexerLease: boolean | undefined;
}

const LEASE_KEY = 20260525;

export async function acquireIndexerLease(prisma: PrismaClient | null) {
  if (!prisma) {
    if (globalThis.__bharatMarketIndexerLease) {
      return false;
    }

    globalThis.__bharatMarketIndexerLease = true;
    return true;
  }

  try {
    const result = await prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${LEASE_KEY}) AS locked
    `;
    return result[0]?.locked ?? false;
  } catch {
    if (globalThis.__bharatMarketIndexerLease) {
      return false;
    }

    globalThis.__bharatMarketIndexerLease = true;
    return true;
  }
}

export async function releaseIndexerLease(prisma: PrismaClient | null) {
  if (!prisma) {
    globalThis.__bharatMarketIndexerLease = false;
    return;
  }

  try {
    await prisma.$queryRaw`
      SELECT pg_advisory_unlock(${LEASE_KEY})
    `;
  } catch {
    // Best effort unlock; process exit will also release connection-bound advisory locks.
  } finally {
    globalThis.__bharatMarketIndexerLease = false;
  }
}
