import type { PrismaClient } from "@prisma/client";

import { INDEXER_REORG_BUFFER } from "@/backend/indexer/config";

export async function getCursorStartBlock(
  prisma: PrismaClient,
  name: string,
  fallbackStart: bigint
) {
  const cursor = await prisma.indexerCursor.findUnique({
    where: { name }
  });

  if (!cursor) {
    return fallbackStart;
  }

  const rewindTarget =
    cursor.lastIndexedBlock > INDEXER_REORG_BUFFER
      ? cursor.lastIndexedBlock - INDEXER_REORG_BUFFER
      : 0n;

  return rewindTarget > fallbackStart ? rewindTarget : fallbackStart;
}

export async function setCursorBlock(prisma: PrismaClient, name: string, blockNumber: bigint) {
  await prisma.indexerCursor.upsert({
    where: { name },
    update: {
      lastIndexedBlock: blockNumber
    },
    create: {
      name,
      lastIndexedBlock: blockNumber
    }
  });
}
