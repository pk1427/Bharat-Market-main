import type { ApiMeta } from "@/types/product";

export type ApiEnvelope<T> = T & {
  meta?: ApiMeta;
  error?: string;
  warning?: string;
};

export async function fetchApi<T>(input: string): Promise<ApiEnvelope<T>> {
  const response = await fetch(input, {
    cache: "no-store"
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load API response.");
  }

  return payload;
}
