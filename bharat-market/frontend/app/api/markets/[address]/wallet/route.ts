import { NextRequest, NextResponse } from "next/server";
import { getAddress, parseUnits } from "viem";
import { erc20Abi } from "viem";

import { marketAbi } from "@/lib/abis";
import { getServerPublicClient } from "@/lib/server/public-client";

function parseAddress(value: string | null) {
  if (!value) return null;

  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function parseAmount(value: string | null) {
  if (!value) return 0n;

  try {
    return parseUnits(value, 6);
  } catch {
    return 0n;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const { address: marketAddressParam } = await context.params;
  const marketAddress = parseAddress(marketAddressParam);
  const usdc = parseAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS ?? null);
  const account = parseAddress(request.nextUrl.searchParams.get("account"));
  const side = request.nextUrl.searchParams.get("side") === "no" ? "no" : "yes";
  const amount = parseAmount(request.nextUrl.searchParams.get("amount"));

  if (!marketAddress || !usdc) {
    return NextResponse.json(
      { error: "Invalid market or USDC address configuration." },
      { status: 400 }
    );
  }

  try {
    const publicClient = getServerPublicClient();
    const previewPromise =
      amount > 0n
        ? publicClient.readContract({
            address: marketAddress,
            abi: marketAbi,
            functionName: side === "yes" ? "previewBuyYes" : "previewBuyNo",
            args: [amount]
          })
        : Promise.resolve(0n);

    const allowancePromise = account
      ? publicClient.readContract({
          address: usdc,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account, marketAddress]
        })
      : Promise.resolve(0n);

    const [preview, allowance] = await Promise.all([previewPromise, allowancePromise]);

    return NextResponse.json({
      preview: preview.toString(),
      allowance: allowance.toString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load market wallet data."
      },
      { status: 500 }
    );
  }
}
