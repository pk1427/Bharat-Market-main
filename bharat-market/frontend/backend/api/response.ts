import type { ApiDataSource, ApiMeta } from "@/types/product";

export function buildApiMeta(params: {
  source: ApiDataSource;
  updatedAt?: string;
  stale?: boolean;
  warning?: string | null;
  indexed?: boolean;
  fallbackUsed?: boolean;
  cursor?: string | null;
  hasMore?: boolean;
  range?: "1H" | "24H" | "ALL";
}): ApiMeta {
  return {
    source: params.source,
    stale: params.stale ?? false,
    updatedAt: params.updatedAt ?? new Date().toISOString(),
    warning: params.warning ?? null,
    indexed: params.indexed,
    fallbackUsed: params.fallbackUsed,
    cursor: params.cursor ?? null,
    hasMore: params.hasMore,
    range: params.range
  };
}
