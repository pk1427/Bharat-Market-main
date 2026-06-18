import { createConfig, http } from "wagmi";
import { injected, metaMask, walletConnect } from "@wagmi/connectors";
import { polygonAmoy } from "wagmi/chains";

const browserRpcProxyUrl = process.env.NEXT_PUBLIC_RPC_PROXY_URL || "/api/rpc";
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "BharatMarket",
        url: typeof window !== "undefined" ? window.location.origin : "https://bharatmarket.vercel.app",
        iconUrl: "/icon.svg"
      },
      useDeeplink: true,
      shimDisconnect: true
    }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true
          })
        ]
      : []),
    injected({ shimDisconnect: true })
  ],
  ssr: true,
  pollingInterval: 8_000,
  transports: {
    [polygonAmoy.id]: http(browserRpcProxyUrl, {
      retryCount: 0,
      timeout: 20_000
    }),
  },
});
