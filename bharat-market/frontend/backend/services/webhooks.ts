import { createHmac, randomBytes } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { getIndexedBackend } from "@/backend/services/runtime";

export type WebhookEventType =
  | "market.created"
  | "market.updated"
  | "trade.executed"
  | "liquidity.added"
  | "liquidity.removed"
  | "market.resolved"
  | "market.redeemed"
  | "oracle.requested"
  | "oracle.fulfilled"
  | "oracle.failed";

export type WebhookPayload = {
  eventType: WebhookEventType;
  sourceEventKey: string;
  timestamp: string;
  marketAddress?: string;
  question?: string;
  txHash?: string;
  blockNumber?: string;
  [key: string]: unknown;
};

export type CreateWebhookSubscriptionInput = {
  owner?: string | null;
  url: string;
  events: WebhookEventType[];
};

export async function listWebhookSubscriptions(owner?: string | null) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return [];
  }

  return prisma.webhookSubscription.findMany({
    where: owner ? { owner: owner.toLowerCase() } : undefined,
    orderBy: { createdAt: "desc" }
  });
}

export async function createWebhookSubscription(input: CreateWebhookSubscriptionInput) {
  const prisma = getIndexedBackend();
  if (!prisma) {
    throw new Error("DATABASE_URL is missing.");
  }

  const secret = randomBytes(24).toString("hex");
  const subscription = await prisma.webhookSubscription.create({
    data: {
      owner: input.owner?.toLowerCase() ?? null,
      url: input.url,
      secret,
      events: input.events,
      active: true
    }
  });

  return {
    subscription,
    secret
  };
}

export async function queueWebhookEvent(params: {
  prisma: PrismaClient;
  eventType: WebhookEventType;
  sourceEventKey: string;
  payload: WebhookPayload;
}) {
  const subscriptions = await params.prisma.webhookSubscription.findMany({
    where: {
      active: true,
      events: {
        has: params.eventType
      }
    },
    select: {
      id: true
    }
  });

  if (subscriptions.length === 0) {
    return 0;
  }

  await params.prisma.$transaction(
    subscriptions.map((subscription) =>
      params.prisma.webhookDelivery.upsert({
        where: {
          subscriptionId_sourceEventKey: {
            subscriptionId: subscription.id,
            sourceEventKey: params.sourceEventKey
          }
        },
        update: {},
        create: {
          subscriptionId: subscription.id,
          sourceEventKey: params.sourceEventKey,
          eventType: params.eventType,
          payload: params.payload as Prisma.InputJsonValue,
          status: "PENDING"
        }
      })
    )
  );

  return subscriptions.length;
}

export async function dispatchPendingWebhookDeliveries() {
  const prisma = getIndexedBackend();
  if (!prisma) {
    return {
      processed: 0,
      delivered: 0,
      failed: 0
    };
  }

  const now = new Date();
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: "PENDING",
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } }
      ]
    },
    include: {
      subscription: true
    },
    orderBy: [{ createdAt: "asc" }],
    take: 25
  });

  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const payload = normalizeJson(delivery.payload);
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", delivery.subscription.secret).update(body).digest("hex");

    try {
      const response = await fetch(delivery.subscription.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bharatmarket-event": delivery.eventType,
          "x-bharatmarket-signature": signature,
          "x-bharatmarket-delivery-id": delivery.id
        },
        body
      });

      if (!response.ok) {
        throw new Error(`Webhook endpoint returned ${response.status}`);
      }

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          lastError: null
        }
      });
      delivered += 1;
    } catch (error) {
      failed += 1;
      const attempts = delivery.attempts + 1;
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts,
          status: attempts >= 5 ? "FAILED" : "PENDING",
          nextAttemptAt: attempts >= 5 ? null : new Date(Date.now() + retryDelayMs(attempts)),
          lastError: error instanceof Error ? error.message : "Webhook delivery failed."
        }
      });
    }
  }

  return {
    processed: deliveries.length,
    delivered,
    failed
  };
}

export function isWebhookEventType(value: string): value is WebhookEventType {
  return [
    "market.created",
    "market.updated",
    "trade.executed",
    "liquidity.added",
    "liquidity.removed",
    "market.resolved",
    "market.redeemed",
    "oracle.requested",
    "oracle.fulfilled",
    "oracle.failed"
  ].includes(value);
}

function normalizeJson(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function retryDelayMs(attempts: number) {
  return Math.min(30_000 * attempts, 15 * 60_000);
}
