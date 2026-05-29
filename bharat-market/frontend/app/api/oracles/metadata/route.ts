import { NextRequest, NextResponse } from "next/server";

import {
  buildOracleQuestion,
  encodeOracleMetadata,
  normalizeOracleMetadata,
  summarizeOracleMetadata
} from "@/lib/oracle-metadata";
import {
  describeOracleMetadata,
  validateOracleMetadata
} from "@/backend/oracles/registry";

export async function POST(request: NextRequest) {
  const metadata = normalizeOracleMetadata(await request.json().catch(() => null));
  if (!metadata) {
    return NextResponse.json(
      { error: "Invalid oracle metadata." },
      { status: 400 }
    );
  }

  const errors = validateOracleMetadata(metadata);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: "Oracle metadata failed validation.",
        errors
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    metadata: summarizeOracleMetadata(metadata),
    encodedOracleQuery: encodeOracleMetadata(metadata),
    question: buildOracleQuestion(metadata),
    description: describeOracleMetadata(metadata)
  });
}
