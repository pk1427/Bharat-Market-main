export function getCategoryLabel(oracleType: string, oracleQuery: string) {
  if (oracleType === "sports") {
    if (oracleQuery.includes("ipl") || oracleQuery.includes("_vs_")) {
      return "Cricket";
    }

    return "Sports";
  }

  if (oracleType === "crypto") {
    return "Crypto";
  }

  if (oracleType === "election") {
    return "Governance";
  }

  return oracleType
    ? oracleType.charAt(0).toUpperCase() + oracleType.slice(1)
    : "General";
}

export function getOracleSourceLabel(oracleType: string) {
  if (oracleType === "sports") {
    return "Chainlink Functions";
  }

  if (oracleType === "crypto") {
    return "Chainlink Functions";
  }

  return "Oracle";
}

export function isEndingSoon(endTime: bigint, hours = 6) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const threshold = BigInt(hours * 60 * 60);
  return endTime > now && endTime - now <= threshold;
}
