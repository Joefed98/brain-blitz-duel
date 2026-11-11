/**
 * seasons-check (wave 4, session W4d; docs/seasons/README.md): one season clock for ratings and the pass, the season
 * end, the reset and the peak-tier rewards, through the pure rules (src/lib/seasons/rules.ts), the real server code
 * (seasons.server.ts, seasons.functions.ts, badges.functions.ts) and the real migrations on a local PostgreSQL 16
 * with the server-function harness's PostgREST / GoTrue stand-in.
 *
 * What it proves:
 * - the reset maths on 400 simulated players: every rating a third of the way back towards the average of rated
 *   players (exactly two thirds of the distance left), the uncertainty wider (a third of the way back to 350, never
 *   narrower, never past 350), the database's formula equal to the phone's; categories likewise on their own averages;
 * - placement: 5 the first time, 3 after a season reset ("Placement 2 of 3", the smaller reveal), from the reset;
 * - the season a rated match counts in: D2's seasons only (a tester in the test season while it runs, everyone else in
 *   the real season), nothing between seasons, each match once;
 * - rewards: only players who finished placement and played 10+ rated matches, from the peak tier actually held (a
 *   cap-held "Storm-rated" player's peak is Surge), every tier's emblem mark, frame and title (S1 Spark to S1 Lightning,
 *   S1 Top 500), granted once however often the close runs; titles equippable only once granted;
 * - a full test-season end and reset as testers would run it (start, play, close, rewards, the testers' ratings reset,
 *   non-testers untouched, a reset left waiting completed by running the close again, the rewards taken back, a second
 *   run), all in pass.admin_log; then Season 1's own close for everyone;
 * - anon, authenticated and the server's own role can't end a season, close one, grant rewards or reset ratings;
 * - the two analytics events; Profile's view and the notice from the server functions; the check-only switch is
 *   ignored in production builds; nothing in scoring, grading, replay, matchmaking or timing reaches a seasons module.
 *
 * The ratings themselves are W3a's: the check stands in for its public.ratings_season_reset with a small table that
 * applies public.season_reset_rating exactly as the contract says (docs/seasons/README.md).
 *
 * Needs the PostgreSQL 16 binaries for the database part. Without them it fails on CI and prints a NOTE locally.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  accountToken,
  ANON_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  startLocalDb,
  startRestServer,
  userToken,
  type LocalDb,
  type RestServer,
} from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(false, `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
  }
}

const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^seasons-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const rules = await import("../src/lib/seasons/rules");
const { TIERS } = await import("../src/lib/data/ratings");
type Tier = (typeof TIERS)[number];

/** A seeded generator (simulated players are the same every run). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

await pureChecks();

let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`seasons-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`seasons-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Season 1 players: one per tier at its peak, a cap-held one, two who just miss.
const PEAKS: Tier[] = ["spark", "charge", "volt", "surge", "storm", "lightning", "top500"];
const PEAK_PLAYERS = PEAKS.map((_, i) => uid(101 + i));
const CAPPED = uid(110); // Storm-rated, held at Surge by the cap
const NINE = uid(111); // placement done, 9 rated matches
const NOPLACE = uid(112); // 15 matches, placement never finished
const IDLE = uid(113); // an account that never played rated
const TESTER = uid(120); // on shop.testers
const TESTER2 = uid(121); // on shop.testers, too few matches in the test season
const GUEST = uid(130);

try {
  db = startLocalDb("seasons-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  const accounts = [...PEAK_PLAYERS, CAPPED, NINE, NOPLACE, IDLE, TESTER, TESTER2];
  db.psql(
    `INSERT INTO auth.users (id, is_anonymous, email) VALUES ${accounts.map((u, i) => `('${u}', false, 'p${i}@example.com')`).join(", ")}, ('${GUEST}', true, NULL)`,
  );
  await installServerFnPlugin();
  await databaseChecks(db);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`seasons-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: one season clock, the season end, the reset and the peak-tier rewards hold.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  await section("the reset maths", async () => {
    const r = rng(7);
    const players = Array.from({ length: 400 }, () => ({ rating: 600 + r() * 1800, rd: 40 + r() * 300 }));
    const avg = rules.ratedAverage(players.map((p) => p.rating))!;
    let third = 0;
    let wider = 0;
    for (const p of players) {
      const after = rules.seasonResetRating(p, avg);
      if (close(avg - after.rating, ((avg - p.rating) * 2) / 3)) third++;
      if (after.rd >= p.rd && after.rd <= 350 && close(after.rd, p.rd + (350 - p.rd) / 3)) wider++;
    }
    check(third === 400, `400 simulated players: each rating a third of the way back towards the average (${third})`);
    check(wider === 400, `and each one's uncertainty wider, a third of the way back to 350 (${wider})`);
    const spreadBefore = Math.max(...players.map((p) => Math.abs(p.rating - avg)));
    const spreadAfter = Math.max(...players.map((p) => Math.abs(rules.seasonResetRating(p, avg).rating - avg)));
    check(close(spreadAfter, (spreadBefore * 2) / 3), "the field's spread shrinks to two thirds");
    const avgAfter = rules.ratedAverage(players.map((p) => rules.seasonResetRating(p, avg).rating))!;
    check(close(avgAfter, avg), "the average itself doesn't move");
    check(rules.seasonResetRating({ rating: 1500, rd: 350 }, 1000).rd === 350, "an uncertainty already at 350 stays at 350");
    check(rules.SEASON_RESET.pull === 1 / 3 && rules.SEASON_RESET.startRd === 350, "the reset's constants: a third, back towards 350");
  });

  await section("placement", async () => {
    check(rules.FIRST_PLACEMENT_MATCHES === 5 && rules.SEASON_PLACEMENT_MATCHES === 3, "5 placement matches the first time, 3 each new season");
    check(rules.placementLabel(1, 3) === "Placement 2 of 3" && rules.placementLabel(0, 3) === "Placement 1 of 3" && rules.placementLabel(3, 3) === null, "the label: Placement 2 of 3, none once done");
    check(rules.placementReveal(3) === "small" && rules.placementReveal(5) === "full", "the smaller reveal after a season reset");
  });

  await section("peak and eligibility", async () => {
    check(rules.peakTier(["volt", "surge", null, "surge"]) === "surge", "the peak is the highest tier held");
    check(rules.peakTier([null, null]) === null, "no tier held: no peak");
    // A Storm-rated player held at Surge by the cap shows Surge (TierView.tier) with heldBack Storm: the shown tier counts.
    check(rules.peakTier(["surge"]) === "surge", "a cap-held Storm-rated player's peak is Surge");
    check(rules.eligibleForReward({ placementDone: true, ratedMatches: 10, peak: "volt" }), "placement done and 10 rated matches: rewarded");
    check(!rules.eligibleForReward({ placementDone: true, ratedMatches: 9, peak: "volt" }), "9 rated matches: not rewarded");
    check(!rules.eligibleForReward({ placementDone: false, ratedMatches: 30, peak: null }), "placement not finished: not rewarded");
  });

  await section("every tier's reward", async () => {
    const cat = await import("../src/lib/badges/catalogue");
    const items = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as {
      items: { id: string; kind: string; source: string; animated: boolean; exclusive_forever: boolean; html: string; png: string }[];
    }).items;
    const names = rules.SEASON_TIERS.map((t) => rules.season1Reward(t).title.name).join(", ");
    check(names === "S1 Spark, S1 Charge, S1 Volt, S1 Surge, S1 Storm, S1 Lightning, S1 Top 500", `the seven titles (${names})`);
    check(cat.SEASON_TITLE_DEFS.map((t) => `${t.id}:${t.name}:${t.kind}`).join() === rules.SEASON_1_TITLES.map((t) => `${t.id}:${t.name}:season`).join(), "C2's title list holds the seven season titles");
    check(rules.SEASON_1_TITLES.every((t) => cat.TITLE_BY_ID.get(t.id)?.name === t.name), "every season title has its name");
    const frames = rules.SEASON_1_FRAMES.map((id) => items.find((i) => i.id === id));
    check(frames.every((f) => f && f.kind === "frame" && f.source === "earned-season-peak-tier" && f.exclusive_forever), "the seven frames are earned catalogue items, exclusive forever");
    check(
      rules.SEASON_TIERS.every((t, i) => frames[i]!.animated === rules.ANIMATED_SEASON_TIERS.includes(t)),
      "animated for Storm, Lightning and Top 500 only",
    );
    check(items.slice(-7).map((i) => i.id).join() === rules.SEASON_1_FRAMES.join(), "they are catalogue.json's last seven, in tier order");
    check(frames.every((f) => f!.html.startsWith("placeholders/") && f!.png.startsWith("placeholders/")), "placeholder art until drawn, kept apart from the approved items");
    const placeholders = Bun.spawnSync(["bun", "scripts/season-frame-placeholders.ts", "--check"]);
    check(placeholders.exitCode === 0, "the placeholder sources are what scripts/season-frame-placeholders.ts writes");
    check(rules.SEASON_TIERS.every((t) => rules.season1Reward(t).emblem.mark === "S1"), "every tier's emblem carries the S1 mark");
  });

  await section("the switch and neutrality", async () => {
    const api = readFileSync("src/lib/seasons/seasonsApi.ts", "utf8");
    check(
      /if \(import\.meta\.env\.PROD\) return true;\s*return \(window as \{ __DUELZ_ALLOW_SEASONS__\?: boolean \}\)\.__DUELZ_ALLOW_SEASONS__ !== true;/.test(api),
      "the check-only window.__DUELZ_ALLOW_SEASONS__ is never read in a production build",
    );
    // Nothing in scoring, grading, replay, matchmaking or timing reaches a seasons module.
    const roots = ["src/lib/duel", "src/lib/arcade", "src/lib/round", "src/puzzles", "src/lib/rated"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      let names: string[] = [];
      try {
        names = readdirSync(dir);
      } catch {
        return;
      }
      for (const n of names) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(n) && /@\/lib\/seasons|\/seasons\//.test(readFileSync(p, "utf8"))) offenders.push(p);
      }
    };
    roots.forEach(walk);
    check(offenders.length === 0, `no scoring, grading, replay, matchmaking or timing code imports seasons (${offenders.join(", ") || "none"})`);
  });
}

/* =================================================================== the database */

async function databaseChecks(d: LocalDb): Promise<void> {
  const fns = await import("../src/lib/seasons/seasons.functions");
  const badgeFns = await import("../src/lib/badges/badges.functions");
  const seasons = await import("../src/lib/seasons/seasons.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const admin = await adminDb();
  const call = callServerFn;
  const q = (sql: string) => {
    const out = d.psql(sql);
    if (!out.ok || /ERROR/.test(out.err)) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const refused = (sql: string) => {
    const out = d.psql(`BEGIN; ${sql}; ROLLBACK;`);
    return !out.ok || /ERROR/.test(out.err);
  };
  const events = (event: string) => Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}'`));
  const owns = (id: string, item: string) => q(`SELECT count(*) FROM inventory_items WHERE user_id = '${id}' AND item_id = '${item}' AND how = 'earned'`) === "1";
  const note = (u: string, match: number, ago: string, tier: Tier | null, label: string | null, done: boolean) =>
    q(`SELECT public.season_note_rated_match('${u}', '${uid(900000 + match)}', now() - interval '${ago}', ${tier ? `'${tier}'` : "NULL"}, ${label ? `'${label}'` : "NULL"}, ${done})`);
  let matchNo = 0;
  /** n rated matches: the first `placement` in placement (no tier), the rest at the tiers given in turn. */
  const play = (u: string, n: number, placement: number, tiers: Tier[], ago = "2 days") => {
    for (let i = 0; i < n; i++) {
      const done = i >= placement;
      const t = done ? tiers[(i - placement) % tiers.length]! : null;
      note(u, ++matchNo, ago, t, t ? `${rules.SEASON_TIER_NAMES[t]} II` : null, done);
    }
  };

  const names = ["Pea_Spark", "Pea_Charge", "Pea_Volt", "Pea_Surge", "Pea_Storm", "Pea_Light", "Pea_Top"];
  PEAK_PLAYERS.forEach((u, i) => q(`SELECT public.create_profile('${u}', '${names[i]}', ${i}::smallint, DATE '1990-01-01', NULL)`));
  q(`SELECT public.create_profile('${CAPPED}', 'Cap_Held', 8::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT public.create_profile('${NINE}', 'Nine_Only', 9::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT public.create_profile('${NOPLACE}', 'No_Place', 10::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT public.create_profile('${IDLE}', 'Idle_One', 11::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT public.create_profile('${TESTER}', 'Tess_Ter', 12::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT public.create_profile('${TESTER2}', 'Tess_Two', 13::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT shop.add_tester('Tess_Ter', 'season testing')`);
  q(`SELECT shop.add_tester('Tess_Two', 'season testing')`);

  await section("access", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      check(refused(`SET LOCAL ROLE ${role}; SELECT pass.close_season('s1', 'x')`), `${role} can't close a season`);
      check(refused(`SET LOCAL ROLE ${role}; SELECT pass.close_test_season('x')`), `${role} can't close the test season`);
      check(refused(`SET LOCAL ROLE ${role}; SELECT pass.season_close_run('s1')`), `${role} can't run the close itself`);
      check(refused(`SET LOCAL ROLE ${role}; SELECT pass.end_season('s1', 'x')`), `${role} can't end a season`);
      check(refused(`SET LOCAL ROLE ${role}; SELECT public.season_reset_ratings('s1', now(), false)`), `${role} can't reset ratings`);
      check(refused(`SET LOCAL ROLE ${role}; SELECT pass.remove_test_season_tier_rewards('x')`), `${role} can't take rewards back`);
      check(refused(`SET LOCAL ROLE ${role}; INSERT INTO public.season_rewards (season_id, season_start, user_id, tier, peak_label, rated_matches, mark, test) VALUES ('s1', now(), '${IDLE}', 'storm', 'Storm', 10, 'S1', false)`), `${role} can't write a reward`);
      check(refused(`SET LOCAL ROLE ${role}; INSERT INTO public.season_closes (season_id, season_start, players_rewarded, reset_status) VALUES ('s1', now(), 0, 'done')`), `${role} can't write a close`);
    }
    for (const role of ["anon", "authenticated"]) {
      check(refused(`SET LOCAL ROLE ${role}; SELECT public.season_note_rated_match('${IDLE}', '${uid(1)}', now(), NULL, NULL, false)`), `${role} can't record a rated match`);
      check(refused(`SET LOCAL ROLE ${role}; SELECT * FROM public.season_rewards`), `${role} can't read the rewards table`);
      check(refused(`SET LOCAL ROLE ${role}; SELECT public.season_reward_seen('${IDLE}', 's1')`), `${role} can't mark a notice`);
    }
    // Through the API stand-in: a signed-in device's own token can't reach the database functions.
    const device = await fetch(`${process.env["SUPABASE_URL"]}/rest/v1/rpc/season_note_rated_match`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${accountToken(IDLE)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: IDLE, p_match_id: uid(2), p_at: new Date().toISOString(), p_tier: null, p_tier_label: null, p_placement_done: false }),
    });
    check(device.status >= 400, `a signed-in device's API call to record a rated match is refused (${device.status})`);
    check(Number(q(`SELECT count(*) FROM season_rated_matches`)) === 0, "nothing was written");
  });

  await section("one season clock", async () => {
    check(note(IDLE, ++matchNo, "1 minute", null, null, false) === "no_season", "before any season starts, a rated match counts in no season");
    q(`SELECT pass.set_season_dates('s1', now() - interval '30 days', NULL, 'Season 1 for the check')`);
    q(`SELECT pass.start_test_season('season testing')`);
    check(q(`SELECT season_id FROM public.season_at('${IDLE}', now())`) === "s1", "an account is in the live real season");
    check(q(`SELECT season_id FROM public.season_at('${TESTER}', now())`) === "test", "a tester is in the test season while it runs");
    check(q(`SELECT season_id FROM public.season_at('${TESTER}', now() - interval '3 days')`) === "s1", "and in the real season before it started");
    check(
      q(`SELECT string_agg(DISTINCT table_schema || '.' || table_name, ',') FROM information_schema.columns WHERE column_name IN ('starts_at', 'ends_at') AND table_name ~ 'season'`) === "public.pass_seasons",
      "no second season table: D2's pass_seasons is the only one with a start and an end",
    );
    check(note(IDLE, 77, "1 day", "storm", null, true) === "bad_tier", "a tier needs its label");
    check(note(IDLE, 78, "1 day", "storm", "Storm II", false) === "bad_tier", "no tier while in placement");
    check(note(IDLE, 79, "1 day", "volt", "Volt I", true) === "noted" && note(IDLE, 79, "1 day", "volt", "Volt I", true) === "duplicate", "each match counts once");
    const viaServer = await seasons.noteRatedMatchInSeason(admin, { userId: IDLE, matchId: uid(800001), finishedAt: new Date(Date.now() - 60_000).toISOString(), tier: "storm", tierLabel: "Storm III", placementDone: true });
    check(viaServer === "noted", `the ratings engine's call notes a match (${viaServer})`);
    check(q(`SELECT tier FROM season_rated_matches WHERE match_id = '${uid(800001)}'`) === "storm", "with the tier it held");
  });

  // Season 1 play: one player per peak tier (placement done after 5, then 7 more), the capped player shown Surge
  // throughout, Nine with 9 matches, NoPlace never finishing placement.
  const LADDER: Tier[] = ["spark", "charge", "volt", "surge", "storm", "lightning", "top500"];
  PEAK_PLAYERS.forEach((u, i) => play(u, 12, 5, [...LADDER.slice(0, i + 1)].reverse().concat(LADDER.slice(0, i + 1))));
  play(CAPPED, 12, 5, ["volt", "surge", "surge"]);
  play(NINE, 9, 5, ["lightning"]);
  play(NOPLACE, 15, 15, []);

  // The testers' season: Tess plays 11 (placement done after 5) and peaks at Lightning; Tess Two plays 6.
  const tStart = q(`SELECT starts_at FROM pass_seasons WHERE id = 'test'`);
  for (let i = 0; i < 11; i++) {
    const done = i >= 5;
    const t: Tier | null = done ? (i === 8 ? "lightning" : "volt") : null;
    q(`SELECT public.season_note_rated_match('${TESTER}', '${uid(700000 + i)}', now(), ${t ? `'${t}'` : "NULL"}, ${t ? `'${rules.SEASON_TIER_NAMES[t]} III'` : "NULL"}, ${done})`);
  }
  for (let i = 0; i < 6; i++) q(`SELECT public.season_note_rated_match('${TESTER2}', '${uid(710000 + i)}', now(), ${i >= 5 ? "'volt', 'Volt III'" : "NULL, NULL"}, ${i >= 5})`);

  // W3a's ratings, stood in: one row per player and rating key.
  const STANDIN = `
    CREATE TABLE IF NOT EXISTS public.check_ratings (user_id uuid, rating_key text, rating numeric, rd numeric, placement_done boolean, PRIMARY KEY (user_id, rating_key));
    CREATE OR REPLACE FUNCTION public.ratings_season_reset(p_season text, p_start timestamptz, p_testers_only boolean)
    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
    DECLARE v_players jsonb; v_avg jsonb;
    BEGIN
      SELECT jsonb_object_agg(rating_key, a) INTO v_avg FROM (SELECT rating_key, avg(rating) AS a FROM check_ratings WHERE placement_done GROUP BY rating_key) x;
      SELECT coalesce(jsonb_agg(DISTINCT user_id), '[]'::jsonb) INTO v_players FROM check_ratings c
       WHERE placement_done AND (NOT p_testers_only OR public.shop_is_tester(c.user_id));
      UPDATE check_ratings c SET (rating, rd) = (SELECT r.rating, r.rd FROM public.season_reset_rating(c.rating, c.rd, (v_avg ->> c.rating_key)::numeric) r)
       WHERE c.placement_done AND (NOT p_testers_only OR public.shop_is_tester(c.user_id));
      RETURN jsonb_build_object('players', v_players, 'detail', jsonb_build_object('averages', v_avg));
    END $f$;`;
  const r = rng(11);
  const KEYS = ["puzzles", "arcade", "word", "logic", "retro"];
  const everyone = [...PEAK_PLAYERS, CAPPED, NINE, NOPLACE, TESTER, TESTER2];
  const ratingRows: string[] = [];
  for (const u of everyone)
    for (const k of KEYS) {
      if (k === "retro" && u === CAPPED) continue; // a category not played: never counted
      ratingRows.push(`('${u}', '${k}', ${Math.round((700 + r() * 1500) * 100) / 100}, ${Math.round((50 + r() * 250) * 100) / 100}, ${u !== NOPLACE})`);
    }

  await section("the test season, end to end", async () => {
    // Run 1, as testers would: close it (the ratings engine isn't there yet), then again once it is.
    const first = JSON.parse(q(`SELECT pass.close_test_season('trying the season end')`)) as Record<string, unknown>;
    check(first["first_close"] === true && first["players_rewarded"] === 1, `closing the test season rewards the one tester who qualified (${JSON.stringify(first)})`);
    check((first["reset"] as Record<string, unknown>)["status"] === "waiting_for_ratings", "without the ratings engine the reset waits");
    const tr = q(`SELECT tier || ':' || mark || ':' || frame_item || ':' || title_id || ':' || test FROM season_rewards WHERE user_id = '${TESTER}'`);
    check(tr === "lightning:S1:frame.s1-lightning:s1-lightning:true", `Tess earns the S1 Lightning emblem, frame and title, marked test (${tr})`);
    check(q(`SELECT count(*) FROM season_rewards WHERE user_id = '${TESTER2}'`) === "0", "Tess Two (6 matches) earns nothing");
    check(owns(TESTER, "frame.s1-lightning"), "the frame is in Tess's inventory, earned");
    check(q(`SELECT count(*) FROM season_rewards WHERE season_id = 's1'`) === "0", "Season 1's players are untouched");

    q(STANDIN);
    q(`INSERT INTO check_ratings VALUES ${ratingRows.join(", ")}`);
    const before = new Map(q(`SELECT user_id || '|' || rating_key || '|' || rating || '|' || rd FROM check_ratings`).split("\n").map((l) => {
      const [u, k, rt, rd] = l.split("|");
      return [`${u}|${k}`, { rating: Number(rt), rd: Number(rd) }] as const;
    }));
    const again = JSON.parse(q(`SELECT pass.close_test_season('the ratings engine is in: complete the reset')`)) as Record<string, unknown>;
    check(again["first_close"] === false && again["rewarded_now"] === 0, "closing again grants nothing more");
    check((again["reset"] as Record<string, unknown>)["status"] === "done", `and completes the waiting reset (${JSON.stringify(again["reset"])})`);
    const after = new Map(q(`SELECT user_id || '|' || rating_key || '|' || rating || '|' || rd FROM check_ratings`).split("\n").map((l) => {
      const [u, k, rt, rd] = l.split("|");
      return [`${u}|${k}`, { rating: Number(rt), rd: Number(rd) }] as const;
    }));
    const avgOf = (k: string) => rules.ratedAverage(everyone.filter((u) => u !== NOPLACE && before.has(`${u}|${k}`)).map((u) => before.get(`${u}|${k}`)!.rating))!;
    let testerOk = 0;
    let othersSame = 0;
    for (const [key, b] of before) {
      const [u, k] = key.split("|") as [string, string];
      const a = after.get(key)!;
      if (u === TESTER || u === TESTER2) {
        const want = rules.seasonResetRating(b, avgOf(k));
        if (Math.abs(a.rating - want.rating) < 1e-6 && Math.abs(a.rd - want.rd) < 1e-6) testerOk++;
      } else if (a.rating === b.rating && a.rd === b.rd) othersSame++;
    }
    check(testerOk === 10, `the testers' Puzzles, Arcade and categories each a third of the way back to the average of rated players, wider uncertainty (${testerOk} of 10)`);
    check(othersSame === before.size - 10, "non-testers' ratings are untouched by the test season");
    check(JSON.parse(q(`SELECT public.season_placement_for('${TESTER}')`))["of"] === 3, "a reset tester's next placement is 3 matches");
    check(JSON.parse(q(`SELECT public.season_placement_for('${PEAK_PLAYERS[0]}')`))["of"] === 5, "an account never reset keeps the first placement's 5");
    const third = JSON.parse(q(`SELECT pass.close_test_season('third time')`)) as Record<string, unknown>;
    check((third["reset"] as Record<string, unknown>)["again"] === true, "a third close resets nothing again");
    check(q(`SELECT count(*) FROM pass.admin_log WHERE action = 'close_test_season'`) === "3", "every close is in pass.admin_log");

    // The title, equippable once granted.
    const set = await call(badgeFns.setMyTitle, { title: "s1-lightning" }, accountToken(TESTER));
    check(set?.ok === true, `Tess equips S1 Lightning (${JSON.stringify(set).slice(0, 120)})`);
    const mine = await call(badgeFns.getMyBadges, undefined, accountToken(TESTER));
    check(mine?.account === true && mine.seasonTitles?.join() === "s1-lightning", "Customise lists her season title");

    // The testers' rewards taken back before launch.
    const removed = JSON.parse(q(`SELECT pass.remove_test_season_tier_rewards('clean-up before launch')`)) as Record<string, number>;
    check(removed["rewards"] === 1 && removed["frames"] === 1 && removed["titles_unequipped"] === 1, `taking the test rewards back: reward, frame and title (${JSON.stringify(removed)})`);
    check(!owns(TESTER, "frame.s1-lightning") && q(`SELECT count(*) FROM card_titles WHERE user_id = '${TESTER}'`) === "0", "Tess's frame is gone and her card is back to Rookie");
    check((await call(badgeFns.setMyTitle, { title: "s1-lightning" }, accountToken(TESTER)))?.ok === false, "and the title can't be equipped again");
    check(q(`SELECT count(*) FROM season_rewards WHERE user_id = '${TESTER}'`) === "1", "the reward row is kept, marked removed (never deleted)");

    // Run 2: started again, played, closed: a new run with its own reward.
    q(`SELECT pass.start_test_season('second run')`);
    const t2 = q(`SELECT starts_at FROM pass_seasons WHERE id = 'test'`);
    check(t2 !== tStart, "starting it again is a new run");
    for (let i = 0; i < 10; i++)
      q(`SELECT public.season_note_rated_match('${TESTER}', '${uid(720000 + i)}', now(), ${i >= 3 ? "'surge', 'Surge I'" : "NULL, NULL"}, ${i >= 3})`);
    const run2 = JSON.parse(q(`SELECT pass.close_test_season('second run over')`)) as Record<string, unknown>;
    check(run2["first_close"] === true && run2["players_rewarded"] === 1 && (run2["reset"] as Record<string, unknown>)["status"] === "done", `the second run closes and resets on its own (${JSON.stringify(run2).slice(0, 160)})`);
    check(q(`SELECT tier FROM season_rewards WHERE user_id = '${TESTER}' AND removed_at IS NULL`) === "surge", "with its own peak (Surge)");
  });

  await section("Season 1's end", async () => {
    // Season 1's own play happened two days ago; one match for Idle earlier counted too (he has 2: not rewarded).
    const notesBefore = events("season_reward_granted");
    const out = JSON.parse(q(`SELECT pass.close_season('s1', 'Season 1 over')`)) as Record<string, unknown>;
    check(q(`SELECT ends_at IS NOT NULL AND ends_at <= now() FROM pass_seasons WHERE id = 's1'`) === "t", "closing Season 1 ends it (D2's season, now ended)");
    check(out["players_rewarded"] === 8, `8 players rewarded: one per tier and the cap-held one (${JSON.stringify(out).slice(0, 200)})`);
    check((out["reset"] as Record<string, unknown>)["status"] === "done", "and the ratings reset for everyone");
    const peaks = q(`SELECT string_agg(p.username || ':' || w.tier, ',' ORDER BY p.username) FROM season_rewards w JOIN profiles p USING (user_id) WHERE season_id = 's1'`);
    check(
      peaks === "Cap_Held:surge,Pea_Charge:charge,Pea_Light:lightning,Pea_Spark:spark,Pea_Storm:storm,Pea_Surge:surge,Pea_Top:top500,Pea_Volt:volt",
      `each from the peak tier actually held, the cap-held player's Surge (${peaks})`,
    );
    for (const [i, t] of PEAKS.entries()) {
      const want = rules.season1Reward(t);
      const row = q(`SELECT mark || ':' || frame_item || ':' || title_id FROM season_rewards WHERE user_id = '${PEAK_PLAYERS[i]}' AND season_id = 's1'`);
      check(row === `S1:${want.frame}:${want.title.id}` && owns(PEAK_PLAYERS[i]!, want.frame), `${rules.SEASON_TIER_NAMES[t]}: the S1 emblem, ${want.frame} and the title ${want.title.name}`);
      check(q(`SELECT name FROM titles WHERE id = '${want.title.id}' AND kind = 'season'`) === want.title.name, `${want.title.name} is a season title`);
    }
    check(q(`SELECT count(*) FROM season_rewards WHERE user_id IN ('${NINE}', '${NOPLACE}', '${IDLE}') AND season_id = 's1'`) === "0", "9 matches, no placement, or 2 matches: nothing");
    check(!owns(CAPPED, "frame.s1-storm") && owns(CAPPED, "frame.s1-surge"), "the cap-held player gets Surge's frame, not Storm's");
    const inventoryBefore = q(`SELECT count(*) FROM inventory_items`);
    const again = JSON.parse(q(`SELECT pass.close_season('s1', 'again, to be sure')`)) as Record<string, unknown>;
    check(again["rewarded_now"] === 0 && q(`SELECT count(*) FROM inventory_items`) === inventoryBefore && q(`SELECT count(*) FROM season_rewards WHERE season_id = 's1'`) === "8", "closing it again grants nothing twice");
    check(events("season_reward_granted") - notesBefore === 8, "season_reward_granted once per reward");
    check(q(`SELECT count(*) FROM analytics.events WHERE event = 'season_ended' AND props ->> 'season' = 's1' AND (props ->> 'players_rewarded')::int = 8`) === "1", "season_ended once for Season 1, with the players rewarded");
    check(q(`SELECT count(*) FROM analytics.events WHERE event = 'season_reward_granted' AND props ->> 'tier' = 'top500'`) === "1", "season_reward_granted carries the tier");
    check(q(`SELECT count(*) FROM analytics.events WHERE event IN ('season_ended', 'season_reward_granted') AND props::text ~ '(@|username|Pea_)'`) === "0", "no personal data in the events");
    const pStorm = PEAK_PLAYERS[4]!;
    check(JSON.parse(q(`SELECT public.season_placement_for('${pStorm}')`))["of"] === 3, "after the reset every rated player's next placement is 3");
    const placement = await seasons.placementFor(admin, pStorm);
    check(placement.of === 3 && placement.reveal === "small" && seasons.placementLabelFor(placement, 1) === "Placement 2 of 3", "next season: Placement 2 of 3, and the smaller reveal");
    check(JSON.parse(q(`SELECT public.season_placement_for('${NOPLACE}')`))["of"] === 5, "a player who never finished placement wasn't reset");
    check(q(`SELECT count(*) FROM pass.admin_log WHERE action IN ('close_season', 'end_season') AND season_id = 's1'`) === "3", "ending and both closes are logged");
    check(refused(`SELECT pass.close_season('test', 'x')`) && refused(`SELECT pass.close_season('nope', 'x')`), "close_season refuses the test season and unknown seasons");
    q(`SELECT pass.create_season('s2', 'Season 2', 'not started')`);
    check(refused(`SELECT pass.season_close_run('s2')`), "a season that hasn't ended can't be closed");
  });

  await section("Profile and the notice", async () => {
    const pStorm = PEAK_PLAYERS[4]!;
    const mine = await call(fns.getMySeasonsFn, undefined, accountToken(pStorm));
    check(mine?.account === true && mine.current === null, "between seasons there is no current season");
    const h = mine?.account ? mine.history : [];
    check(h.length === 1 && h[0]!.tier === "storm" && h[0]!.mark === "S1" && h[0]!.frame === "frame.s1-storm" && h[0]!.title === "s1-storm" && !h[0]!.seen, `the history: Season 1, Storm, unseen (${JSON.stringify(h).slice(0, 160)})`);
    check((await call(fns.seasonRewardSeenFn, { season: "s1" }, accountToken(pStorm)))?.ok === true, "the notice is marked shown");
    const later = await call(fns.getMySeasonsFn, undefined, accountToken(pStorm));
    check(later?.account === true && later.history[0]!.seen === true, "and isn't due again");
    check((await call(fns.seasonRewardSeenFn, { season: "s1; DROP" }, accountToken(pStorm)))?.ok === false, "a malformed season id is refused");
    const guest = await call(fns.getMySeasonsFn, undefined, userToken(GUEST));
    check(guest?.account === false, "a guest has no seasons");
    q(`SELECT pass.set_season_dates('s2', now() - interval '1 hour', NULL, 'Season 2 for the check')`);
    note(pStorm, ++matchNo, "10 minutes", null, null, false);
    note(pStorm, ++matchNo, "5 minutes", "volt", "Volt I", true);
    const now2 = await call(fns.getMySeasonsFn, undefined, accountToken(pStorm));
    const cur = now2?.account ? now2.current : null;
    check(cur?.season === "s2" && cur.ratedMatches === 2 && cur.peak === "volt" && cur.peakLabel === "Volt I" && cur.mark === "S2", `the season peak so far, from stored matches only (${JSON.stringify(cur)})`);
    const idle = await call(fns.getMySeasonsFn, undefined, accountToken(PEAK_PLAYERS[0]!));
    check(idle?.account === true && idle.current?.peak === null && idle.current?.ratedMatches === 0, "no peak for a player with no rated match this season");
  });
}
