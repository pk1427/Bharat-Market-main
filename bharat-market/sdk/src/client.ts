import type { Address, PublicClient, WalletClient } from "viem";

import {
  addLiquidity,
  buyNo,
  buyYes,
  createMarket,
  listMarketAddresses,
  listMarketPage,
  redeem,
  removeLiquidity
} from "./market-factory.js";
import type {
  MarketResponse,
  MarketsResponse,
  OracleCatalogResponse,
  WebhookCreateResponse,
  WebhookEventType,
  WebhookListResponse,
  PortfolioResponse
} from "./types";

export type BharatMarketClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export type ContractClientOptions = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Address;
  marketFactory: Address;
};

export class BharatMarketClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BharatMarketClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
  }

  async getMarkets(params: {
    search?: string;
    status?: "all" | "live" | "awaiting" | "resolved";
    limit?: number;
    offset?: number;
  } = {}): Promise<MarketsResponse> {
    const url = new URL(`${this.baseUrl}/api/public/markets`);
    if (params.search) url.searchParams.set("search", params.search);
    if (params.status) url.searchParams.set("status", params.status);
    if (typeof params.limit === "number") url.searchParams.set("limit", String(params.limit));
    if (typeof params.offset === "number") url.searchParams.set("offset", String(params.offset));
    return this.request<MarketsResponse>(url);
  }

  async getMarket(address: Address): Promise<MarketResponse> {
    return this.request<MarketResponse>(`${this.baseUrl}/api/public/markets/${address}`);
  }

  async getPortfolio(wallet: Address): Promise<PortfolioResponse> {
    return this.request<PortfolioResponse>(`${this.baseUrl}/api/public/portfolio/${wallet}`);
  }

  async getOracleCatalog(): Promise<OracleCatalogResponse> {
    return this.request<OracleCatalogResponse>(`${this.baseUrl}/api/public/oracles`);
  }

  async listWebhooks(owner?: string): Promise<WebhookListResponse> {
    const url = new URL(`${this.baseUrl}/api/webhooks`);
    if (owner) {
      url.searchParams.set("owner", owner);
    }
    return this.request<WebhookListResponse>(url);
  }

  async createWebhook(input: {
    owner?: string;
    url: string;
    events: WebhookEventType[];
  }): Promise<WebhookCreateResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/webhooks`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(`BharatMarket webhook request failed with ${response.status}`);
    }

    return (await response.json()) as WebhookCreateResponse;
  }

  async createMarket(client: ContractClientOptions, params: { question: string; endTime: bigint; oracleType: string; oracleQuery: string }) {
    return createMarket(client.walletClient, client.marketFactory, params, client.account);
  }

  async buyYes(client: ContractClientOptions, market: Address, amount: bigint, minShares = 0n) {
    return buyYes(client.walletClient, market, amount, minShares, client.account);
  }

  async buyNo(client: ContractClientOptions, market: Address, amount: bigint, minShares = 0n) {
    return buyNo(client.walletClient, market, amount, minShares, client.account);
  }

  async addLiquidity(client: ContractClientOptions, market: Address, amount: bigint) {
    return addLiquidity(client.walletClient, market, amount, client.account);
  }

  async removeLiquidity(client: ContractClientOptions, market: Address, lpAmount: bigint) {
    return removeLiquidity(client.walletClient, market, lpAmount, client.account);
  }

  async redeem(client: ContractClientOptions, market: Address) {
    return redeem(client.walletClient, market, client.account);
  }

  async getAllMarketAddresses(client: Pick<ContractClientOptions, "publicClient" | "marketFactory">) {
    return listMarketAddresses(client.publicClient, client.marketFactory);
  }

  async getMarketPage(client: Pick<ContractClientOptions, "publicClient" | "marketFactory">, start: bigint, count: bigint) {
    return listMarketPage(client.publicClient, client.marketFactory, start, count);
  }

  private async request<T>(input: RequestInfo | URL): Promise<T> {
    const response = await this.fetchImpl(input);
    if (!response.ok) {
      throw new Error(`BharatMarket API request failed with ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

export function createBharatMarketClient(baseUrl: string, fetchImpl?: typeof fetch) {
  return new BharatMarketClient({ baseUrl, fetch: fetchImpl });
}
