import { NextRequest, NextResponse } from "next/server";

import { getIndexedBackend } from "@/backend/services/runtime";
import { evaluateOracleMetadata, listOracleProviders, validateOracleMetadata } from "@/backend/oracles/registry";
import { decodeOracleMetadata, summarizeOracleMetadata } from "@/lib/oracle-metadata";

function isAuthorized(request: NextRequest) {
  const secrets = [process.env.INDEXER_CRON_SECRET, process.env.CRON_SECRET, process.env.ORACLE_DEBUG_SECRET].filter(
    (value): value is string => Boolean(value)
  );
  if (secrets.length === 0) return false;

  const bearer = request.headers.get("authorization");
  const direct = request.headers.get("x-oracle-secret");
  return secrets.some((secret) => bearer === `Bearer ${secret}` || direct === secret);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getIndexedBackend();
  const markets = prisma
    ? await prisma.market.findMany({
        take: 25,
        orderBy: [{ resolved: "asc" }, { endTime: "asc" }],
        include: {
          oracleEvents: {
            take: 3,
            orderBy: { timestamp: "desc" }
          },
          oracleAuditTrail: {
            take: 3,
            orderBy: { requestedAt: "desc" }
          }
        }
      })
    : [];

  return NextResponse.json({
    providers: listOracleProviders(),
    markets: markets.map((market) => {
      const metadata = decodeOracleMetadata(market.oracleQuery);
      return {
        address: market.marketAddress,
        question: market.question,
        status: market.resolved ? "resolved" : market.endTime.getTime() <= Date.now() ? "awaiting" : "active",
        oracleType: market.oracleType,
        oracleQuery: market.oracleQuery,
        metadata: summarizeOracleMetadata(metadata),
        validationErrors: metadata ? validateOracleMetadata(metadata) : ["No structured oracle metadata available."],
        events: market.oracleEvents,
        auditTrail: market.oracleAuditTrail
      };
    })
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { oracleQuery?: string } | null;
  const metadata = body?.oracleQuery ? decodeOracleMetadata(body.oracleQuery) : null;
  if (!metadata) {
    return NextResponse.json({ error: "Missing or invalid structured oracle query." }, { status: 400 });
  }

  const validationErrors = validateOracleMetadata(metadata);
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Oracle metadata failed validation.", validationErrors }, { status: 400 });
  }

  try {
    const result = await evaluateOracleMetadata(metadata);
    return NextResponse.json({
      metadata: summarizeOracleMetadata(metadata),
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        metadata: summarizeOracleMetadata(metadata),
        error: error instanceof Error ? error.message : "Oracle evaluation failed."
      },
      { status: 502 }
    );
  }
}
