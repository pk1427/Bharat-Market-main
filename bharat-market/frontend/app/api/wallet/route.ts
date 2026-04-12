import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { erc20Abi } from "viem";

import { marketFactoryAbi } from "@/lib/abis";
import { getServerPublicClient } from "@/lib/server/public-client";

function parseAddress(value: string | null) {
  if (!value) return null;

  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const marketFactory = parseAddress(process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS ?? null);
  const usdc = parseAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS ?? null);
  const account = parseAddress(request.nextUrl.searchParams.get("account"));

  if (!marketFactory || !usdc) {
    return NextResponse.json(
      { error: "Missing frontend contract configuration." },
      { status: 500 }
    );
  }

  try {
    const publicClient = getServerPublicClient();
    const creationFee = await publicClient.readContract({
      address: marketFactory,
      abi: marketFactoryAbi,
      functionName: "creationFee"
    });

    if (!account) {
      return NextResponse.json({
        creationFee: creationFee.toString(),
        usdcBalance: "0",
        creationAllowance: "0"
      });
    }

    const [usdcBalance, creationAllowance] = await Promise.all([
      publicClient.readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account]
      }),
      publicClient.readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, marketFactory]
      })
    ]);

    return NextResponse.json({
      creationFee: creationFee.toString(),
      usdcBalance: usdcBalance.toString(),
      creationAllowance: creationAllowance.toString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load wallet data."
      },
      { status: 500 }
    );
  }
}
