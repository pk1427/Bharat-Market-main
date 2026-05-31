import { createConfig, http, injected } from "wagmi";
import { polygonAmoy } from "wagmi/chains";

const browserRpcProxyUrl = process.env.NEXT_PUBLIC_RPC_PROXY_URL || "/api/rpc";

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors: [injected()],
  ssr: true,
  pollingInterval: 8_000,
  transports: {
    [polygonAmoy.id]: http(browserRpcProxyUrl, {
      retryCount: 0,
      timeout: 20_000
    }),
  },
});
