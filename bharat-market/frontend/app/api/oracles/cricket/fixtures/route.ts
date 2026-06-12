import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CricApiMatch = {
  id?: string;
  name?: string;
  matchType?: string;
  status?: string;
  venue?: string;
  date?: string;
  dateTimeGMT?: string;
  teams?: string[];
  matchStarted?: boolean;
  matchEnded?: boolean;
};

type CricApiMatchesResponse = {
  status?: string;
  data?: CricApiMatch[];
  reason?: string;
};

const FIXTURE_CACHE_MS = 60_000;
const fixturePageCache = new Map<string, { expiresAt: number; data: CricApiMatch[] }>();

export async function GET(request: NextRequest) {
  const apiKey = process.env.CRICAPI_KEY;
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const limit = clampLimit(Number(request.nextUrl.searchParams.get("limit") ?? "12"));
  const window = parseFixtureWindow(request.nextUrl.searchParams.get("window"));

  if (!apiKey) {
    return NextResponse.json({ error: "CRICAPI_KEY is not configured." }, { status: 500 });
  }

  try {
    const offsets = search ? [0] : window === "all" ? [0, 25] : [0];
    const pages = await Promise.all(offsets.map((offset) => fetchFixturePage({ apiKey, search, offset })));
    const fixtures = uniqueFixtures(pages.flat());
    const upcomingFixtures = fixtures
      .filter(isUpcomingFixture)
      .sort((left, right) => getFixtureTime(left) - getFixtureTime(right));
    const windowedFixtures = upcomingFixtures.filter((fixture) => isInsideWindow(fixture, window));

    return NextResponse.json({
      status: "success",
      provider: "cricapi",
      meta: {
        window,
        scanned: fixtures.length,
        upcoming: upcomingFixtures.length,
        matched: windowedFixtures.length
      },
      data: windowedFixtures.slice(0, limit).map(toClientFixture)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load cricket fixtures." },
      { status: 502 }
    );
  }
}

function uniqueFixtures(fixtures: CricApiMatch[]) {
  const seen = new Set<string>();
  return fixtures.filter((fixture) => {
    if (!fixture.id || seen.has(fixture.id)) return false;
    seen.add(fixture.id);
    return true;
  });
}

async function fetchFixturePage({
  apiKey,
  search,
  offset
}: {
  apiKey: string;
  search: string;
  offset: number;
}) {
  const cacheKey = `${search.toLowerCase()}::${offset}`;
  const cached = fixturePageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = new URL("https://api.cricapi.com/v1/matches");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("offset", String(offset));
  if (search) {
    url.searchParams.set("search", search);
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CricAPI fixtures request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as CricApiMatchesResponse;
  if (payload.status && payload.status !== "success") {
    throw new Error(payload.reason || "CricAPI fixtures request failed.");
  }

  const data = Array.isArray(payload.data) ? payload.data : [];
  fixturePageCache.set(cacheKey, {
    expiresAt: Date.now() + FIXTURE_CACHE_MS,
    data
  });

  return data;
}

function isUpcomingFixture(match: CricApiMatch) {
  const teams = Array.isArray(match.teams) ? match.teams.filter(Boolean) : [];
  const normalizedTeams = teams.map((team) => team.trim().toLowerCase());

  return Boolean(
    match.id &&
      match.name &&
      match.dateTimeGMT &&
      match.matchStarted === false &&
      match.matchEnded === false &&
      teams.length >= 2 &&
      !normalizedTeams.includes("tbc")
  );
}

function toClientFixture(match: CricApiMatch) {
  const teams = Array.isArray(match.teams) ? match.teams : [];
  const [teamA = "", teamB = ""] = teams;

  return {
    id: match.id,
    name: match.name,
    matchType: match.matchType ?? "cricket",
    status: match.status ?? null,
    venue: match.venue ?? null,
    date: match.date ?? null,
    dateTimeGMT: match.dateTimeGMT,
    teams,
    teamA,
    teamB,
    league: inferLeague(match.name ?? ""),
    matchStarted: false,
    matchEnded: false
  };
}

function inferLeague(name: string) {
  const parts = name.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return parts.slice(2).join(", ");
  }

  return parts.at(-1) ?? "Cricket";
}

function getFixtureTime(match: CricApiMatch) {
  const timestamp = Date.parse(`${match.dateTimeGMT ?? ""}Z`);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function isInsideWindow(match: CricApiMatch, window: string) {
  if (window === "all") return true;

  const timestamp = getFixtureTime(match);
  const now = Date.now();
  const maxMs = window === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  return timestamp >= now && timestamp <= now + maxMs;
}

function parseFixtureWindow(value: string | null) {
  if (value === "24h" || value === "7d" || value === "all") return value;
  return "24h";
}

function clampLimit(value: number) {
  if (!Number.isFinite(value)) return 12;
  return Math.min(Math.max(Math.floor(value), 1), 25);
}
