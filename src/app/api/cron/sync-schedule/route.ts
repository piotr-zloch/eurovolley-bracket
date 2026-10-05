import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseSchedule } from "@/lib/tauronliga-schedule";

// League sync, called by Vercel Cron (see vercel.json).
//
// Fetches the league's published schedule page once and hands it to two database functions, which
// decide what may change: sync_league_schedule() for kick-off times (migration 27) and
// sync_league_results() for finished games' scores (migration 28, recomputes the leaderboard).
// This route holds no database privileges of its own: it uses the public anon key plus CRON_SECRET,
// whose hash is the only thing those functions accept. Vercel sends CRON_SECRET as a Bearer token on cron invocations.
//
// Run it by hand with:  curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/sync-schedule

const SOURCE = "https://www.tauronliga.pl/games.html";

function authorised(request: NextRequest, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!authorised(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const slug = process.env.SCHEDULE_SYNC_SLUG ?? "plusliga-2026-27";

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  // Housekeeping first, so a league-site outage cannot stop it: accounts unused for 12 months are
  // deleted (migration 35; the policy is stated in the terms and privacy policy).
  const purge = await supabase.rpc("purge_inactive_accounts", { p_secret: secret });
  if (purge.error) console.error(`purge_inactive_accounts failed: ${purge.error.message}`);

  let html: string;
  try {
    const res = await fetch(SOURCE, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; typer-schedule-sync)" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return NextResponse.json({ error: `schedule source returned ${res.status}` }, { status: 502 });
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: `could not fetch the schedule: ${(e as Error).message}` }, { status: 502 });
  }

  const games = parseSchedule(html);
  if (games.length === 0) {
    // A page we can't parse is a failure worth seeing in the Vercel logs, not a quiet no-op.
    return NextResponse.json({ error: "no games found on the schedule page (layout changed?)" }, { status: 502 });
  }

  // Independent calls: a problem with one (say, results) must not stop the other from applying.
  const schedule = await supabase.rpc("sync_league_schedule", {
    p_secret: secret,
    p_slug: slug,
    p_games: games.map(({ id, date, time }) => ({ id, date, time })),
  });
  const results = await supabase.rpc("sync_league_results", {
    p_secret: secret,
    p_slug: slug,
    p_games: games.map(({ id, homeSets, awaySets }) => ({ id, home_sets: homeSets, away_sets: awaySets })),
  });

  const errors = [
    schedule.error && `schedule: ${schedule.error.message}`,
    results.error && `results: ${results.error.message}`,
    purge.error && `purge: ${purge.error.message}`,
  ].filter(Boolean);

  return NextResponse.json(
    {
      parsed: games.length,
      schedule: schedule.data ?? null,
      results: results.data ?? null,
      purge: purge.data ?? null,
      errors,
    },
    { status: errors.length > 0 ? 500 : 200 }
  );
}
