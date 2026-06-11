import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CricApiMatchInfo = {
  status?: string;
  data?: {
    id?: string;
    name?: string;
    status?: string;
    matchEnded?: boolean;
    matchStarted?: boolean;
    matchWinner?: string;
    teams?: string[];
  };
};

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get("matchId")?.trim();
  const apiKey = process.env.CRICAPI_KEY;

  if (!matchId) {
    return NextResponse.json({ error: "matchId is required." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "CRICAPI_KEY is not configured." }, { status: 500 });
  }

  const url = `https://api.cricapi.com/v1/match_info?apikey=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(matchId)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json(
      { error: "CricAPI request failed.", status: response.status },
      { status: 502 }
    );
  }

  const payload = await response.json() as CricApiMatchInfo;
  const match = payload.data;
  if (!match) {
    return NextResponse.json(
      { error: "CricAPI response did not include match data." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    status: "success",
    provider: "cricapi",
    data: {
      id: match.id ?? matchId,
      name: match.name ?? null,
      status: match.status ?? null,
      matchEnded: Boolean(match.matchEnded),
      matchStarted: Boolean(match.matchStarted),
      matchWinner: match.matchWinner ?? null,
      teams: Array.isArray(match.teams) ? match.teams : []
    }
  });
}
