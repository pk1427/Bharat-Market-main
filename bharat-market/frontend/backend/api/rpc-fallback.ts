export function isDashboardRpcFallbackAllowed(request: Request) {
  const url = new URL(request.url);
  return (
    url.searchParams.get("fallback") === "rpc" ||
    process.env.ENABLE_RPC_DASHBOARD_FALLBACK === "true"
  );
}

export const INDEXED_ONLY_WARNING =
  "Indexed backend data is not ready yet. Run the indexer, then refresh the dashboard.";
