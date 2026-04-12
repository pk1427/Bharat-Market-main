import { createConfig, fallback, http, injected } from "wagmi";
import { polygonAmoy } from "wagmi/chains";

const browserRpcProxyUrl = process.env.NEXT_PUBLIC_RPC_PROXY_URL || "/api/rpc";

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors: [injected()],
  ssr: true,
  transports: {
    [polygonAmoy.id]: fallback([
      http(browserRpcProxyUrl, {
        retryCount: 0
      }),
      http(browserRpcProxyUrl, {
        retryCount: 1
      })
    ]),
  },
});
