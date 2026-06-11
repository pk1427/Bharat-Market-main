import {
  createBharatMarketClient,
  listOracleAdapters
} from "../../../../sdk/src/index.js";

type RecordedRequest = {
  url: string;
  method: string;
  body: string | null;
};

const requests: RecordedRequest[] = [];

const fetchMock: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.toString();
  const pathname = new URL(url).pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : null;

  requests.push({ url, method, body });

  if (pathname.startsWith("/api/public/markets") && method === "GET") {
    return jsonResponse({
      markets: [
        {
          address: "0x1111111111111111111111111111111111111111",
          creator: "0x2222222222222222222222222222222222222222",
          question: "Will ETH be above $5,000 at settlement?",
          category: "Crypto",
          oracleSource: "CoinGecko + Chainlink Functions",
          oracleType: "crypto",
          oracleQuery: "ethereum",
          oracleMetadata: null,
          yesProbability: "50.2",
          noProbability: "49.8",
          liquidity: "2000",
          volume: "7",
          traderCount: 2,
          endTime: "2026-06-09T09:52:24.000Z",
          endTimeLabel: "Jun 9, 9:52 AM",
          resolved: false,
          status: "active",
          statusLabel: "Active",
          resolvedOutcome: 0
        }
      ],
      total: 1,
      meta: {
        source: "indexed",
        stale: false,
        updatedAt: "2026-06-11T00:00:00.000Z",
        indexed: true
      }
    });
  }

  if (pathname.startsWith("/api/public/portfolio") && method === "GET") {
    return jsonResponse({
      overview: {
        walletUsdcBalance: "10.00",
        yesHoldings: "3.96",
        noHoldings: "1.99",
        lpHoldings: "2.00",
        redeemableWinnings: "0.00",
        activePositions: 2,
        estimatedPositionValue: "5.95",
        unrealizedPnl: "1.95"
      },
      groups: [],
      updatedAt: "2026-06-11T00:00:00.000Z",
      meta: {
        source: "indexed",
        stale: false,
        updatedAt: "2026-06-11T00:00:00.000Z"
      }
    });
  }

  if (pathname.startsWith("/api/webhooks") && method === "GET") {
    return jsonResponse({
      subscriptions: [
        {
          id: "sub-1",
          owner: "0xde504608441fe32bae7fceacf6d04af61c39d8ec",
          url: "https://example.com/webhook",
          events: ["market.created", "market.resolved"],
          active: true,
          createdAt: "2026-06-11T00:00:00.000Z",
          updatedAt: "2026-06-11T00:00:00.000Z"
        }
      ]
    });
  }

  if (pathname.startsWith("/api/webhooks") && method === "POST") {
    return jsonResponse({
      subscription: {
        id: "sub-2",
        owner: "0xde504608441fe32bae7fceacf6d04af61c39d8ec",
        url: "https://example.com/webhook",
        events: ["market.created"],
        active: true,
        createdAt: "2026-06-11T00:00:00.000Z"
      },
      secret: "test-secret"
    });
  }

  throw new Error(`Unexpected SDK request: ${method} ${url}`);
};

async function main() {
  const sdk = createBharatMarketClient("https://bharatmarket.example", fetchMock);

  const markets = await sdk.getMarkets({ status: "live", limit: 1 });
  const portfolio = await sdk.getPortfolio("0xdE504608441fe32BAE7fceAcF6D04Af61c39D8Ec");
  const webhooks = await sdk.listWebhooks("0xdE504608441fe32BAE7fceAcF6D04Af61c39D8Ec");
  const createdWebhook = await sdk.createWebhook({
    owner: "0xdE504608441fe32BAE7fceAcF6D04Af61c39D8Ec",
    url: "https://example.com/webhook",
    events: ["market.created"]
  });
  const adapters = listOracleAdapters("crypto");

  if (markets.markets.length !== 1) throw new Error("Expected one market from the SDK client.");
  if (portfolio.overview.activePositions !== 2) throw new Error("Expected portfolio to round-trip.");
  if (webhooks.subscriptions.length !== 1) throw new Error("Expected webhook list to round-trip.");
  if (createdWebhook.secret !== "test-secret") throw new Error("Expected webhook creation secret.");
  if (adapters.length === 0) throw new Error("Expected oracle adapters to be exposed.");

  console.log(
    JSON.stringify(
      {
        markets: markets.markets.length,
        portfolioPositions: portfolio.overview.activePositions,
        webhooks: webhooks.subscriptions.length,
        createdWebhook: createdWebhook.subscription.id,
        oracleAdapters: adapters.map((adapter) => adapter.provider),
        requests: requests.map((request) => `${request.method} ${request.url}`)
      },
      null,
      2
    )
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
