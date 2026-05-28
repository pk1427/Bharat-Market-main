export function calculateProbabilityMove(
  latestYesProbability: bigint | number | string,
  previousYesProbability: bigint | number | string
) {
  const latest = BigInt(latestYesProbability);
  const previous = BigInt(previousYesProbability);
  return latest >= previous ? latest - previous : previous - latest;
}
