import { NextResponse } from "next/server";

import {
  createWebhookSubscription,
  isWebhookEventType,
  listWebhookSubscriptions
} from "@/backend/services/webhooks";
import type { WebhookEventType } from "@/backend/services/webhooks";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const owner = requestUrl.searchParams.get("owner");
  const subscriptions = await listWebhookSubscriptions(owner);

  return NextResponse.json({
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      owner: subscription.owner,
      url: subscription.url,
      events: subscription.events,
      active: subscription.active,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString()
    }))
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { owner?: string; url?: string; events?: string[] }
    | null;

  if (!body?.url || !Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json(
      { error: "url and events are required." },
      { status: 400 }
    );
  }

  if (body.events.some((event) => !isWebhookEventType(event))) {
    return NextResponse.json(
      { error: "One or more webhook event types are invalid." },
      { status: 400 }
    );
  }

  const { subscription, secret } = await createWebhookSubscription({
    owner: body.owner,
    url: body.url,
    events: body.events.filter(isWebhookEventType) as WebhookEventType[]
  });

  return NextResponse.json({
    subscription: {
      id: subscription.id,
      owner: subscription.owner,
      url: subscription.url,
      events: subscription.events,
      active: subscription.active,
      createdAt: subscription.createdAt.toISOString()
    },
    secret
  });
}
