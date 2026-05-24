import type { ActivityItem, ActivityType } from "@/types/product";

export function getActivityLabel(type: ActivityType) {
  switch (type) {
    case "buy_yes":
      return "Bought YES";
    case "buy_no":
      return "Bought NO";
    case "add_liquidity":
      return "Added Liquidity";
    case "remove_liquidity":
      return "Removed Liquidity";
    case "market_created":
      return "Created Market";
    case "resolution_requested":
      return "Requested Resolution";
    case "resolution_fulfilled":
      return "Resolved Market";
    case "redeemed":
      return "Redeemed";
    default:
      return "Activity";
  }
}

export function getActivityTone(type: ActivityType) {
  switch (type) {
    case "buy_yes":
      return "mint";
    case "buy_no":
      return "coral";
    case "add_liquidity":
      return "gold";
    case "remove_liquidity":
      return "coral";
    case "market_created":
      return "slate";
    case "resolution_requested":
      return "gold";
    case "resolution_fulfilled":
      return "mint";
    case "redeemed":
      return "mint";
    default:
      return "slate";
  }
}

export function getActivityAmountLabel(item: ActivityItem) {
  if (item.type === "buy_yes" || item.type === "buy_no") {
    return "Trade";
  }

  if (item.type === "add_liquidity" || item.type === "remove_liquidity") {
    return "Liquidity";
  }

  if (item.type === "redeemed") {
    return "Payout";
  }

  return "Amount";
}
