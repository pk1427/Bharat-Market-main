export function parsePositiveInt(value: string | null, fallback: number, max = fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(parsed), 0), max);
}
