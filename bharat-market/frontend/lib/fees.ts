import { parseGwei, type PublicClient } from "viem";

const MIN_PRIORITY_FEE = parseGwei("25");
const MIN_MAX_FEE = parseGwei("50");
const MAX_SAFE_GAS_LIMIT = 5_000_000n;

export function getCappedGasLimit(estimate: bigint, multiplier = 12n, divisor = 10n) {
  const buffered = (estimate * multiplier) / divisor;
  return buffered > MAX_SAFE_GAS_LIMIT ? MAX_SAFE_GAS_LIMIT : buffered;
}

export async function getSafeFeeOverrides(publicClient: PublicClient) {
  const fees = await publicClient.estimateFeesPerGas().catch(() => null);

  const maxPriorityFeePerGas =
    fees?.maxPriorityFeePerGas && fees.maxPriorityFeePerGas > MIN_PRIORITY_FEE
      ? fees.maxPriorityFeePerGas
      : MIN_PRIORITY_FEE;

  const suggestedMaxFee =
    fees?.maxFeePerGas && fees.maxFeePerGas > maxPriorityFeePerGas
      ? fees.maxFeePerGas
      : maxPriorityFeePerGas * 2n;

  const maxFeePerGas = suggestedMaxFee > MIN_MAX_FEE ? suggestedMaxFee : MIN_MAX_FEE;

  return {
    maxFeePerGas,
    maxPriorityFeePerGas
  };
}
