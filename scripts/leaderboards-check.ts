/**
 * leaderboards-check (wave 4, session W4a, 11 Nov 2026; docs/leaderboards.md): the leaderboards through the real
 * server functions (src/lib/leaderboards/leaderboards.functions.ts), the real server rules and every migration on a
 * local PostgreSQL 16, with the server-function harness's PostgREST / GoTrue stand-in (scripts/server-fn-harness.ts).
 *
 * What it proves:
 * - rating boards: order (higher first), ties sharing a place (1, 2, 2, 4), your own row pinned when you're past the top
 *   500 (pages of 50, never past 500), country and friends scopes (ranked among themselves), this season against the
 *   all-time peak, the Top 500 number from W3a's tier, category boards; the board is the stored snapshot (a changed
 *   rating shows only after a refresh), old generations are cleared;
 * - privacy: an under-18 is "Hidden player" by default on global and country boards with ranks unchanged, always shown
 *   to friends, shown once they opt in; an adult is shown by default and hidden once they opt out; the setting's
 *   default comes back with null; a hidden row carries no name, colour or number, and no row carries more than the
 *   player card shows;
 * - the Daily top 100: accounts only, each account's one finished attempt, accounts at least 24 hours old, never a
 *   flagged run; ties to the faster time and a shared place when level on both (exactly daily.ts rankBoard); the top
 *   100 and your own place pinned below; the board shows only once you've finished or the day closed; a board frozen
 *   30 minutes after its day closes is kept and never recomputed; earlier days browsable (prev / next);
 * - the Daily badges: Daily Champion only on a final board of 100+ players (not 99), Daily Top 100 only on 500+ (not
 *   499), awarded by C2's syncMyBadges;
 * - boards are read-only to players: anon and authenticated can't read or write any leaderboard table or call any of
 *   its functions; the schema is closed;
 * - the two analytics events (leaderboard_viewed once per board opened, daily_board_viewed) with fixed-word props;
 * - the Top 500 emblem is mockup 03's 28 px art;
 * - the binding to W3a's real engine (20261115100300): matches recorded by recordRatedMatch show on the Joulz, Puzzles
 *   and Logic boards with W3a's stored, rounded ratings (and what getRatingsFor answers), the peak from the stored
 *   history, placed accounts only (a rated guest never shows);
 * - the Worker's Cron Trigger (every 5 minutes, beside pg_cron's job): the schedule agrees with vite.config.ts, and two
 *   runs at once and a third leave every board exactly as one run does.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's runners). Without them it fails on CI and prints a NOTE
 * locally. No browser.
 */

import { readFileSync } from "node:fs";

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
  if (/^\s*(FAIL|NOTE)|^leaderboards-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const VIEW = uid(1); // adult, GB: the viewer
const ACE = uid(2); // adult, GB, Top 500
const BEE = uid(3); // adult, FR
const CEE = uid(4); // adult, GB (ties with BEE this season)
const TEEN = uid(5); // 15, GB: hidden by default
const OPTIN = uid(6); // 16, GB: opts in
const OPTOUT = uid(7); // adult, GB: opts out
const PAL = uid(8); // 15, FR: VIEW's friend
const GONE = uid(9); // adult, GB: deletion requested
const NEWBIE = uid(10); // adult, made just before their Daily attempt
const GUEST = uid(11); // a guest (no profile)
const FLAG = uid(12); // adult whose Daily run is flagged
const SLOW = uid(13); // adult who never finished the Daily
const W1 = uid(20); // wins a Daily of exactly 100
const W2 = uid(21); // wins a Daily of 99
const X5 = uid(22); // 50th on a Daily of exactly 500
const X6 = uid(23); // 50th on a Daily of 499
const FILLERS = 600;
const FILL = (i: number) => uid(1000 + i);

const yearsAgo = (years: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 3);
  return d.toISOString().slice(0, 10);
};

let db: LocalDb | null = null;
let rest: RestServer | null = null;

await pureChecks();

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`leaderboards-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`leaderboards-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

try {
  db = startLocalDb("leaderboards-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`leaderboards-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: rating boards, the Daily top 100, privacy, the Daily badges, read-only boards and events hold.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  await section("words", async () => {
    const b = await import("../src/lib/leaderboards/boards");
    check(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "112th", "412th"].join() === [1, 2, 3, 4, 11, 12, 13, 21, 22, 112, 412].map(b.ordinal).join(), "ordinals");
    check(b.topShare(412, 2318) === "top 18%" && b.topShare(1, 100000) === "top 1%" && b.topShare(10, 10) === "top 100%", "top shares (mockup 02: 412th of 2,318 is top 18%)");
    check(b.boardTime(252_000) === "4:12" && b.boardTime(400_400) === "6:40" && b.boardTime(5_000) === "0:05", "times as m:ss");
    check(b.top500Label(37) === "Top 500 #37", "Top 500 #37");
    const row = { rank: 2, value: 1, isMe: false, isFriend: false, hidden: true, deleted: false, name: null, colour: null, playerNumber: null };
    check(b.rowName(row) === "Hidden player" && b.rowName({ ...row, deleted: true }) === "Deleted player", "a hidden row reads Hidden player, a deleted one Deleted player");
    check(b.rowName({ ...row, hidden: false, name: "Sam", isFriend: true }) === "Sam (friend)" && b.rowName({ ...row, hidden: false, name: "Tia", isMe: true }) === "Tia (you)", "friends and you are marked");
    check(b.DAILY_CHAMPION_FIELD === 100 && b.DAILY_TOP100_FIELD === 500 && b.DAILY_ACCOUNT_MIN_AGE_MS === 86_400_000, "the decided field sizes (100, 500) and the 24-hour account age");
    check(b.isDayKey("2026-11-07") && !b.isDayKey("2026-11-7") && !b.isDayKey("x") && !b.isRatingBoard("rated") && b.isRatingBoard("logic"), "inputs are checked");
    check(b.RATING_BOARDS.length === 14, "14 rating boards: Joulz Rating, Puzzles, Arcade and the 11 categories");
  });

  await section("the Top 500 emblem", async () => {
    const html = readFileSync("docs/mockups/wave-4/03-top-500-emblem.html", "utf8");
    const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
    const small = (svgs[9] ?? "").replace("<svg ", "<svg xmlns='http://www.w3.org/2000/svg' ").replace(" role='img' aria-label='Top 500 #37'", "");
    check(small.length > 1000 && readFileSync("public/art/emblems/top-500.svg", "utf8") === small, "public/art/emblems/top-500.svg is mockup 03's 28 px emblem");
  });
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const fns = await import("../src/lib/leaderboards/leaderboards.functions");
  const badges = await import("../src/lib/badges/badges.functions");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { rankBoard, ukDayKey } = await import("../src/lib/duel/daily");
  const { createClient } = await import("@supabase/supabase-js");
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const refused = (sql: string) => {
    const out = db.psql(`BEGIN; ${sql}; ROLLBACK;`);
    return out.ok && !/ERROR/.test(out.err) ? "" : out.err;
  };
  const deviceDb = (token: string | null) =>
    createClient(rest.url, ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

  type Row = { rank: number; value: number; isMe: boolean; isFriend: boolean; hidden: boolean; deleted: boolean; name: string | null; colour: number | null; playerNumber: number | null; top500?: number; timeMs?: number };
  // Joe's rule of 11 Nov 2026: a visible row also carries its player's card and tier (what the player card shows).
  const ALLOWED = new Set(["rank", "value", "isMe", "isFriend", "hidden", "deleted", "name", "colour", "playerNumber", "top500", "timeMs", "boardRank", "card", "tier"]);

  /* ---------------------------------------------------------------- accounts */
  const people: [string, string, string, string | null][] = [
    [VIEW, "Viewer", yearsAgo(30), "GB"],
    [ACE, "Ace", yearsAgo(30), "GB"],
    [BEE, "Bee", yearsAgo(30), "FR"],
    [CEE, "Cee", yearsAgo(30), "GB"],
    [TEEN, "Teen_A", yearsAgo(15), "GB"],
    [OPTIN, "Teen_In", yearsAgo(16), "GB"],
    [OPTOUT, "Out_Adult", yearsAgo(40), "GB"],
    [PAL, "Pal_Teen", yearsAgo(15), "FR"],
    [GONE, "Gone_Soon", yearsAgo(30), "GB"],
    [NEWBIE, "Newbie", yearsAgo(30), "GB"],
    [FLAG, "Flagged", yearsAgo(30), "GB"],
    [SLOW, "Slowcoach", yearsAgo(30), "GB"],
    [W1, "Winner_One", yearsAgo(30), "GB"],
    [W2, "Winner_Two", yearsAgo(30), "GB"],
    [X5, "Fifty_Five", yearsAgo(30), "GB"],
    [X6, "Fifty_Six", yearsAgo(30), "GB"],
  ];
  q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ${people.map(([id, n]) => `('${id}', false, '${n.toLowerCase()}@example.com')`).join(", ")}, ('${GUEST}', true, NULL)`);
  for (const [id, name, dob, country] of people)
    q(`SELECT public.create_profile('${id}', '${name}', 3::smallint, DATE '${dob}', ${country ? `'${country}'` : "NULL"})`);
  q(`INSERT INTO auth.users (id, is_anonymous, email) SELECT ('00000000-0000-4000-8000-' || lpad((1000 + i)::text, 12, '0'))::uuid, false, 'f' || i || '@example.com' FROM generate_series(0, ${FILLERS - 1}) i`);
  q(`DO $$ BEGIN FOR i IN 0..${FILLERS - 1} LOOP PERFORM public.create_profile(('00000000-0000-4000-8000-' || lpad((1000 + i)::text, 12, '0'))::uuid, 'Fill_' || i, 1::smallint, DATE '1980-01-01', NULL); END LOOP; END $$`);
  // Every account made long ago, but Newbie (made at the start of the first Daily day).
  q(`SET session_replication_role = replica;
     UPDATE profiles SET created_at = TIMESTAMPTZ '2026-10-01 00:00:00+00';
     UPDATE profiles SET created_at = TIMESTAMPTZ '2026-11-01 00:00:00+00' WHERE user_id = '${NEWBIE}';
     SET session_replication_role = origin;`);
  check(Number(q(`SELECT count(*) FROM profiles`)) === people.length + FILLERS, "accounts made");
  // Friends: Viewer with Pal (an under-18) and Ace.
  q(`INSERT INTO friendships (user_low, user_high) VALUES (least('${VIEW}'::uuid, '${PAL}'::uuid), greatest('${VIEW}'::uuid, '${PAL}'::uuid)), (least('${VIEW}'::uuid, '${ACE}'::uuid), greatest('${VIEW}'::uuid, '${ACE}'::uuid))`);
  const tok = { view: accountToken(VIEW), bee: accountToken(BEE), teen: accountToken(TEEN), optin: accountToken(OPTIN), optout: accountToken(OPTOUT), pal: accountToken(PAL), guest: userToken(GUEST), newbie: accountToken(NEWBIE) };

  /* ---------------------------------------------------------------- read-only boards */
  await section("boards are read-only to players", async () => {
    const tables = ["leaderboard_settings", "leaderboard_generations", "leaderboard_rating_rows", "daily_boards", "daily_board_entries"];
    for (const t of tables)
      for (const role of ["anon", "authenticated"])
        check(
          q(`SELECT has_table_privilege('${role}', 'public.${t}', 'SELECT') OR has_table_privilege('${role}', 'public.${t}', 'INSERT') OR has_table_privilege('${role}', 'public.${t}', 'UPDATE') OR has_table_privilege('${role}', 'public.${t}', 'DELETE')`) === "f",
          `${role} has no right on ${t}`,
        );
    const fnLeaks = q(`SELECT coalesce(string_agg(p.proname, ','), '') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE (n.nspname = 'leaderboards' OR (n.nspname = 'public' AND (p.proname LIKE 'leaderboard\\_%' OR p.proname LIKE 'daily\\_board\\_%'))) AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
    check(fnLeaks === "", `no leaderboard function is callable by anon or authenticated (${fnLeaks || "none"})`);
    check(q(`SELECT has_schema_privilege('authenticated', 'leaderboards', 'USAGE') OR has_schema_privilege('anon', 'leaderboards', 'USAGE')`) === "f", "the leaderboards schema is closed to phones");
    check(refused(`SET LOCAL ROLE authenticated; INSERT INTO daily_board_entries (room_id, attempt_id, total, tie_ms, finished_at, rank, position) VALUES (gen_random_uuid(), gen_random_uuid(), 1, 1, now(), 1, 1)`) !== "", "SQL: authenticated can't write a Daily board row");
    check(refused(`SET LOCAL ROLE authenticated; UPDATE leaderboard_rating_rows SET value = 9999`) !== "", "SQL: authenticated can't change a rating board");
    check(refused(`SET LOCAL ROLE anon; SELECT * FROM leaderboard_rating_rows`) !== "", "SQL: anon can't read the raw rating rows");
    const device = deviceDb(tok.view);
    const reads = await Promise.all(["leaderboard_rating_rows", "daily_board_entries", "daily_boards", "leaderboard_settings"].map((t) => device.from(t).select("*")));
    check(reads.every((r) => !!r.error), "a phone can't read the raw boards through the API");
    const writes = await Promise.all([
      device.from("leaderboard_settings").insert({ user_id: VIEW, show_on_boards: true }),
      device.from("daily_boards").update({ players: 1 }).eq("kind", "daily_puzzle"),
      device.rpc("leaderboard_page", { p_viewer: VIEW, p_board: "joulz", p_period: "season", p_scope: "global", p_offset: 0, p_limit: 10 }),
      device.rpc("leaderboard_refresh", {}),
      deviceDb(null).rpc("daily_board_page", { p_viewer: VIEW, p_kind: "daily_puzzle", p_day: "2026-11-01", p_scope: "top100" }),
    ]);
    check(writes.every((w) => !!w.error), "a phone can't write a board, change a setting directly, call a board function or refresh");
  });

  const board = (token: string, input: Record<string, unknown>) => call(fns.ratingBoardFn, input, token);

  await section("not ready before the first refresh", async () => {
    const a = await board(tok.view, { board: "joulz", scope: "global", period: "season" });
    check(a.ok && a.page.ready === false && a.page.rows.length === 0, "before any refresh the board says not ready");
  });

  /* ---------------------------------------------------------------- W3a's real engine */
  // The binding (20261115100300_leaderboards_rating_source.sql) on matches recorded by W3a's own recordRatedMatch.
  await section("the boards read W3a's real ratings", async () => {
    const rs = await import("../src/lib/rated/ratings.server");
    const mt = await import("../src/lib/rated/match");
    const catalogue = await import("../src/lib/duel/catalogue");
    const { dealtSignature } = await import("../src/lib/duel/dealSignature");
    const { createClient: typed } = await import("@supabase/supabase-js");
    const admin = typed<import("../src/integrations/supabase/types").Database>(rest.url, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    type Result = import("../src/lib/data/ratings").RatedMatchResult;
    const LOGIC = catalogue.ACTIVE_PUZZLE_TYPES.find((t) => mt.gamePool(t) === "puzzles" && mt.gameCategory(t) === "logic")!;
    const game = (a: string, b: string, x: number, y: number): Result["games"][number] => ({
      type: LOGIC, pool: mt.gamePool(LOGIC)!, category: mt.gameCategory(LOGIC)!, version: "classic", signature: dealtSignature(LOGIC), scores: { [a]: x, [b]: y },
    });
    let seq = 0;
    const duel = (a: string, b: string, aWins: boolean): Result => ({
      matchId: `20000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
      format: { kind: "duel", bestOf: 3 },
      choice: "puzzles",
      players: [{ playerId: a, side: "live" }, { playerId: b, side: "live" }],
      games: [aWins ? game(a, b, 150, 100) : game(a, b, 100, 150), aWins ? game(a, b, 150, 100) : game(a, b, 100, 150)],
    });
    const R = [40, 41, 42, 43, 44, 45].map(uid);
    const RG = uid(46); // a guest who plays rated: never on a board (no username to show)
    q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ${R.map((id, i) => `('${id}', false, 'rated${i}@example.com')`).join(", ")}, ('${RG}', true, NULL)`);
    R.forEach((id, i) => q(`SELECT public.create_profile('${id}', 'Rated_${i}', ${i}::smallint, DATE '1990-01-01', 'GB')`));
    let at = Date.UTC(2026, 10, 16, 12);
    const joulzAfter = new Map<string, number[]>();
    const play = async (a: string, b: string, aWins: boolean) => {
      // A new UK day for every match, so the 4th-match rule never freezes a pair.
      at += 86_400_000;
      const out = await rs.recordRatedMatch(admin, duel(a, b, aWins), at);
      if (!out.ok) throw new Error(`recordRatedMatch: ${out.reason} ${out.message}`);
      for (const p of out.players) if (p.joulz.after !== null) joulzAfter.set(p.playerId, [...(joulzAfter.get(p.playerId) ?? []), p.joulz.after]);
    };
    // A round robin: everyone's 5 placement matches (the lower index wins), then the guest's, then Rated_0 loses four.
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) await play(R[i]!, R[j]!, true);
    for (const id of R.slice(0, 5)) await play(RG, id, false);
    for (const id of R.slice(1, 5)) await play(R[0]!, id, false);
    q(`SELECT public.leaderboard_refresh()`);
    const views = await Promise.all([...R, RG].map((id) => rs.getRatingsFor(admin, id)));
    const placed = R.filter((_, i) => views[i]?.placement.done);
    check(placed.length === R.length && views[R.length]?.placement.done === true, `every player finished placement through the real engine (${placed.length} of ${R.length} accounts)`);
    const a = await board(tok.view, { board: "joulz", scope: "global", period: "season" });
    const rows = a.page.rows as Row[];
    check(a.ok && rows.length === R.length, `the Joulz board has the six placed accounts and not the guest (${rows.length})`);
    const stored = new Map(q(`SELECT player_id || ':' || round(joulz) FROM rated_profiles WHERE joulz IS NOT NULL`).split("\n").map((l) => { const [id, v] = l.split(":"); return [id!, Number(v)]; }));
    const byName = (name: string) => rows.find((r) => r.name === name);
    check(R.every((id, i) => byName(`Rated_${i}`)?.value === stored.get(id)), "each row's value is W3a's stored Joulz Rating, rounded as W3a shows it");
    check(R.every((id, i) => Math.abs((byName(`Rated_${i}`)?.value ?? 0) - (views[i]?.joulz ?? -999)) <= 1), "and agrees with what W3a answers the player (getRatingsFor)");
    check(rows.every((r, i) => i === 0 || rows[i - 1]!.value >= r.value) && rows.every((r) => r.rank === 1 + rows.filter((o) => o.value > r.value).length), "ordered by rating, level ratings sharing a place");
    const peak = await board(tok.view, { board: "joulz", scope: "global", period: "peak" });
    const p0 = (peak.page.rows as Row[]).find((r) => r.name === "Rated_0");
    const want0 = Math.round(Math.max(stored.get(R[0]!) ?? 0, ...(joulzAfter.get(R[0]!) ?? [])));
    check(!!p0 && p0.value === want0 && p0.value > (byName("Rated_0")?.value ?? 0), `the all-time peak is the highest Joulz Rating after any stored match (Rated_0: ${p0?.value} peak against ${byName("Rated_0")?.value} now)`);
    const logic = await board(tok.view, { board: "logic", scope: "global", period: "season" });
    const lr = logic.page.rows as Row[];
    const logicStored = new Map(q(`SELECT player_id || ':' || round(rating) FROM rated_ratings WHERE key = 'logic'`).split("\n").map((l) => { const [id, v] = l.split(":"); return [id!, Number(v)]; }));
    check(lr.length === R.length && R.every((id, i) => lr.find((r) => r.name === `Rated_${i}`)?.value === logicStored.get(id)), "the Logic board is W3a's Logic rating");
    check(R.every((id, i) => { const v = views[i]?.categories?.logic; return v?.status === "rated" && lr.find((r) => r.name === `Rated_${i}`)?.value === v.rating; }), "and is what W3a shows each player for Logic");
    const pz = await board(tok.view, { board: "puzzles", scope: "global", period: "season" });
    check((pz.page.rows as Row[]).length === R.length && (await board(tok.view, { board: "arcade", scope: "global", period: "season" })).page.rows.length === 0, "the Puzzles board has them; nobody has an Arcade rating yet");
    const tiers = new Set(q(`SELECT coalesce(shown_tier, '') FROM rated_profiles`).split("\n"));
    check(!tiers.has("top500") && rows.every((r) => r.top500 === undefined), "no Top 500 numbers below W3a's 1,000-player cap");
    // Clean up, so the stood-in source below starts from an empty board.
    q(`SELECT public.leaderboard_refresh()`);
  });

  /* ---------------------------------------------------------------- rating boards */
  // W3a's ratings, stood in: one row per player and board, this season and the all-time peak.
  q(`CREATE TABLE public.lb_check_source (player_id uuid, board text, season_rating integer, peak_rating integer, tier text);
     CREATE OR REPLACE FUNCTION leaderboards.rating_source()
     RETURNS TABLE (player_id uuid, board text, season_rating integer, peak_rating integer, tier text)
     LANGUAGE sql STABLE AS $$ SELECT player_id, board, season_rating, peak_rating, tier FROM public.lb_check_source $$;`);
  const src: [string, number | null, number | null, string | null][] = [
    [ACE, 3000, 3100, "top500"],
    [TEEN, 2950, 2950, "top500"],
    [BEE, 2900, 2950, "top500"],
    [CEE, 2900, 3200, "top500"],
    [OPTOUT, 2700, 2700, "lightning"],
    [OPTIN, 2600, 2650, "lightning"],
    [PAL, 2500, 2500, "storm"],
    [GONE, 2450, 2450, "storm"],
    [VIEW, 1500, 1600, "volt"],
    [NEWBIE, null, 2800, null],
  ];
  q(`INSERT INTO lb_check_source VALUES ${src.map(([id, s, p, t]) => `('${id}', 'joulz', ${s ?? "NULL"}, ${p ?? "NULL"}, ${t ? `'${t}'` : "NULL"})`).join(", ")}`);
  q(`INSERT INTO lb_check_source SELECT ('00000000-0000-4000-8000-' || lpad((1000 + i)::text, 12, '0'))::uuid, 'joulz', 2000 + (i % 300), 2000 + (i % 300), 'storm' FROM generate_series(0, ${FILLERS - 1}) i`);
  q(`INSERT INTO lb_check_source VALUES ('${CEE}', 'logic', 1900, 1900, NULL), ('${VIEW}', 'logic', 1800, 1900, NULL), ('${TEEN}', 'logic', 2100, 2100, NULL), ('${BEE}', 'puzzles', 2000, 2000, NULL)`);
  q(`UPDATE profiles SET deletion_requested_at = now() WHERE user_id = '${GONE}'`);

  q(`SELECT public.leaderboard_refresh()`);

  await section("rating board order, ties and the pinned row", async () => {
    const a = await board(tok.view, { board: "joulz", scope: "global", period: "season" });
    check(a.ok && a.page.ready, "the board is ready after a refresh");
    const rows = a.page.rows as Row[];
    check(rows.length === 50, `a page is 50 rows (${rows.length})`);
    check(rows.slice(0, 7).map((r) => r.rank).join() === "1,2,3,3,5,6,7", `higher first, level ratings share a place (1, 2, 3, 3, 5…: ${rows.slice(0, 7).map((r) => r.rank).join()})`);
    check(rows[0]!.name === "Ace" && rows[0]!.value === 3000 && rows[0]!.top500 === 1, "Ace first with Top 500 #1 (W3a's tier)");
    check(rows[2]!.name === "Bee" && rows[3]!.name === "Cee", "a shared place in a fixed order (player number)");
    check(rows.every((r, i) => i === 0 || rows[i - 1]!.value >= r.value), "values never rise down the board");
    check(rows.every((r) => Object.keys(r).every((k) => ALLOWED.has(k))), "no row carries more than the player card shows (no id, country, age or date)");
    check(!rows.some((r) => r.name === "Gone_Soon"), "an account waiting for deletion is off the board");
    check(!rows.some((r) => r.name === "Newbie"), "a player not rated this season isn't on this season's board");
    const me = a.page.me as Row;
    check(!!me && me.isMe && me.rank === 7 + FILLERS + 1 && me.value === 1500 && !rows.some((r) => r.isMe), `your own row comes with the page, pinned (you're ${me?.rank}th)`);
    check(a.page.total === src.filter((s) => s[1] !== null && s[0] !== GONE).length + FILLERS, `the total counts the board (${a.page.total})`);
    const p2 = await board(tok.view, { board: "joulz", scope: "global", period: "season", offset: 450 });
    check(p2.ok && p2.page.rows.length === 50 && p2.page.rows[0].rank >= p2.page.rows.length, "the tenth page is the last (rows 451–500)");
    const p3 = await board(tok.view, { board: "joulz", scope: "global", period: "season", offset: 500 });
    check(!p3.ok && p3.reason === "bad_board", "the list never runs past the top 500");
    const bad = await board(tok.view, { board: "chess", scope: "global", period: "season" });
    check(!bad.ok && bad.reason === "bad_board", "an unknown board is refused");
  });

  await section("privacy on rating boards", async () => {
    const bee = await board(tok.bee, { board: "joulz", scope: "global", period: "season" });
    const rows = bee.page.rows as Row[];
    const teen = rows[1]!;
    check(teen.hidden && teen.name === null && teen.colour === null && teen.playerNumber === null && teen.rank === 2 && teen.value === 2950, "an under-18 is a Hidden player by default, rank and rating unchanged, no name, colour or number");
    const pal = rows.find((r) => r.value === 2500)!;
    check(pal.hidden && pal.rank === 7, "an under-18 is hidden from a stranger");
    const optout = rows.find((r) => r.value === 2700)!;
    check(!optout.hidden && optout.name === "Out_Adult", "an adult is shown by default");
    const view = await board(tok.view, { board: "joulz", scope: "global", period: "season" });
    const palToView = (view.page.rows as Row[]).find((r) => r.value === 2500)!;
    check(!palToView.hidden && palToView.name === "Pal_Teen" && palToView.isFriend, "an under-18 is always visible to their friends");
    const teenSelf = await board(tok.teen, { board: "joulz", scope: "global", period: "season" });
    check((teenSelf.page.rows as Row[])[1]!.isMe && (teenSelf.page.rows as Row[])[1]!.name === "Teen_A", "an under-18 always sees their own row");

    const vis = await call(fns.boardVisibilityFn, undefined, tok.optin);
    check(vis.ok && vis.visibility.show === false && vis.visibility.setting === null && vis.visibility.adult === false, "an under-18's setting: hidden by default");
    const on = await call(fns.setBoardVisibilityFn, { show: true }, tok.optin);
    check(on.ok && on.visibility.show === true && on.visibility.setting === true, "an under-18 can opt in");
    const off = await call(fns.setBoardVisibilityFn, { show: false }, tok.optout);
    check(off.ok && off.visibility.show === false && off.visibility.adult === true, "an adult can opt out");
    const after = await board(tok.bee, { board: "joulz", scope: "global", period: "season" });
    const ar = after.page.rows as Row[];
    check(ar.find((r) => r.value === 2600)?.name === "Teen_In" && ar.find((r) => r.value === 2600)?.rank === 6, "an opted-in under-18 shows by name at once (no refresh needed)");
    check(ar.find((r) => r.value === 2700)?.hidden === true && ar.find((r) => r.value === 2700)?.rank === 5, "an opted-out adult is a Hidden player, rank unchanged");
    const outSelf = await board(tok.optout, { board: "joulz", scope: "global", period: "season" });
    check((outSelf.page.rows as Row[]).find((r) => r.isMe)?.name === "Out_Adult", "an opted-out adult still sees their own name");
    const reset = await call(fns.setBoardVisibilityFn, { show: null }, tok.optout);
    check(reset.ok && reset.visibility.show === true && reset.visibility.setting === null, "null puts the default back");
    const guest = await call(fns.boardVisibilityFn, undefined, tok.guest);
    check(!guest.ok && guest.reason === "account", "a guest has no setting");
    const junk = await call(fns.setBoardVisibilityFn, { show: "yes" }, tok.view);
    check(!junk.ok, "a setting that isn't true, false or null is refused");
  });

  await section("country and friends scopes", async () => {
    const gb = await board(tok.view, { board: "joulz", scope: "country", period: "season" });
    const g = gb.page.rows as Row[];
    check(gb.ok && gb.page.country === "GB" && g.map((r) => r.rank).join() === "1,2,3,4,5,6", `the country board ranks GB players among themselves (${g.map((r) => r.rank).join()})`);
    check(g[1]!.hidden && g[1]!.value === 2950 && g[0]!.name === "Ace", "privacy holds on the country board");
    check(g.find((r) => r.isMe)?.rank === 6 && gb.page.total === 6, "your own place on your country's board");
    const fr = await board(tok.bee, { board: "joulz", scope: "country", period: "season" });
    check((fr.page.rows as Row[]).length === 2 && (fr.page.rows as Row[])[1]!.hidden, "another country's board is its own (Bee's FR: Bee and a hidden under-18)");
    const friends = await board(tok.view, { board: "joulz", scope: "friends", period: "season" });
    const f = friends.page.rows as Row[];
    check(f.map((r) => `${r.rank}:${r.name}`).join() === "1:Ace,2:Pal_Teen,3:Viewer", `friends ranked among themselves (${f.map((r) => `${r.rank}:${r.name}`).join()})`);
    check(f.every((r) => !r.hidden), "nobody is hidden on a friends board");
    const guest = await board(tok.guest, { board: "joulz", scope: "friends", period: "season" });
    check(!guest.ok && guest.reason === "account", "friends boards need an account");
    const guestGlobal = await board(tok.guest, { board: "joulz", scope: "global", period: "season" });
    check(guestGlobal.ok && guestGlobal.page.me === null && (guestGlobal.page.rows as Row[])[1]!.hidden, "a guest can look at the global board (no own row; privacy holds)");
  });

  await section("season against all-time peak, categories", async () => {
    const peak = await board(tok.view, { board: "joulz", scope: "global", period: "peak" });
    const p = peak.page.rows as Row[];
    check(p[0]!.name === "Cee" && p[0]!.value === 3200 && p[1]!.name === "Ace" && p[1]!.value === 3100, `the peak board orders by each player's all-time peak (${p.slice(0, 2).map((r) => r.name).join()})`);
    check(p.some((r) => r.name === "Newbie" && r.value === 2800), "a player with a peak but no rating this season is on the peak board only");
    check(p.every((r) => r.top500 === undefined), "Top 500 numbers are this season's only");
    check((peak.page.me as Row).value === 1600, "your own peak, pinned");
    const logic = await board(tok.view, { board: "logic", scope: "global", period: "season" });
    const l = logic.page.rows as Row[];
    check(l.map((r) => r.value).join() === "2100,1900,1800" && l[0]!.hidden && l[2]!.isMe, "a category board (Top Logic players), privacy included");
    const puzzles = await board(tok.view, { board: "puzzles", scope: "global", period: "season" });
    check(puzzles.ok && puzzles.page.rows.length === 1 && puzzles.page.me === null, "a pool board; no own row when you aren't on it");
  });

  await section("refreshed every few minutes, never per request", async () => {
    q(`UPDATE lb_check_source SET season_rating = 3500 WHERE player_id = '${VIEW}' AND board = 'joulz'`);
    const before = await board(tok.view, { board: "joulz", scope: "global", period: "season" });
    check((before.page.me as Row).value === 1500 && (before.page.rows as Row[])[0]!.name === "Ace", "a changed rating doesn't show until the refresh");
    q(`SELECT public.leaderboard_refresh()`);
    const after = await board(tok.view, { board: "joulz", scope: "global", period: "season" });
    check((after.page.rows as Row[])[0]!.isMe && (after.page.rows as Row[])[0]!.value === 3500, "the refresh moves it");
    q(`SELECT public.leaderboard_refresh()`);
    check(Number(q(`SELECT count(*) FROM leaderboard_generations`)) === 2, "only the newest generation and the one before are kept");
    check(q(`SELECT count(DISTINCT generation) FROM leaderboard_rating_rows`) === "2", "older generations' rows are removed with them");
    const cron = q(`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')`);
    if (cron === "t") check(q(`SELECT schedule FROM cron.job WHERE jobname = 'leaderboards-refresh'`) === "*/5 * * * *", "pg_cron refreshes every 5 minutes");
    else check(Number(q(`SELECT count(*) FROM migration_log.notes WHERE message LIKE 'leaderboards refresh not scheduled%'`)) >= 1, "without pg_cron the migration leaves a warning in the log");
    q(`UPDATE lb_check_source SET season_rating = 1500 WHERE player_id = '${VIEW}' AND board = 'joulz'`);
    q(`SELECT public.leaderboard_refresh()`);
  });

  /* ---------------------------------------------------------------- the Daily top 100 */
  type Attempt = { user: string; total: number; tie: number; finished?: string | null; started?: string; flagged?: boolean };
  let rooms = 0;
  const makeRoom = (day: string, opens: string, closes: string) => {
    rooms++;
    return q(`INSERT INTO async_rooms (kind, room_key, day, seed, round_count, opens_at, closes_at) VALUES ('daily_puzzle', 'daily_puzzle:${day}', DATE '${day}', ${rooms}, 6, TIMESTAMPTZ '${opens}', TIMESTAMPTZ '${closes}') RETURNING id`).split("\n")[0]!;
  };
  const addAttempts = (room: string, list: Attempt[], dayStart: string) => {
    for (const a of list) {
      const started = a.started ?? `${dayStart} 10:00:00+00`;
      const finished = a.finished === undefined ? `${dayStart} 10:20:00+00` : a.finished;
      const id = q(`INSERT INTO async_attempts (room_id, user_id, display_name, started_at, finished_at, rounds_done, total_score, tie_ms) VALUES ('${room}', '${a.user}', 'P', TIMESTAMPTZ '${started}', ${finished ? `TIMESTAMPTZ '${finished}'` : "NULL"}, 6, ${a.total}, ${a.tie}) RETURNING id`).split("\n")[0]!;
      q(`INSERT INTO async_results (room_id, attempt_id, user_id, round_number, started_at, answered, score, extra) VALUES ('${room}', '${id}', '${a.user}', 1, TIMESTAMPTZ '${started}', true, ${a.total}, '${a.flagged ? '{"flagged": true}' : "{}"}'::jsonb)`);
    }
  };
  const fillerAttempts = (from: number, count: number, top: number): Attempt[] =>
    Array.from({ length: count }, (_, i) => ({ user: FILL(from + i), total: top - i, tie: 300_000 }));

  const D1 = makeRoom("2026-11-01", "2026-11-01 00:00:00+00", "2026-11-02 00:00:00+00");
  addAttempts(
    D1,
    [
      { user: ACE, total: 1184, tie: 252_000 },
      { user: BEE, total: 1176, tie: 271_000 },
      { user: CEE, total: 1176, tie: 260_000 }, // the faster of a level total: above Bee
      { user: OPTOUT, total: 1150, tie: 280_000 },
      { user: OPTIN, total: 1150, tie: 280_000 }, // level on both: shares Out_Adult's place
      { user: TEEN, total: 1149, tie: 300_000 },
      { user: PAL, total: 1100, tie: 300_000 },
      { user: NEWBIE, total: 1500, tie: 100_000 }, // made under 24 hours before: not counted
      { user: GUEST, total: 1400, tie: 100_000 }, // a guest: not counted
      { user: FLAG, total: 1300, tie: 100_000, flagged: true }, // flagged: never shown
      { user: SLOW, total: 1250, tie: 100_000, finished: null }, // never finished
      ...fillerAttempts(0, 110, 1000),
      { user: VIEW, total: 694, tie: 400_000 },
    ],
    "2026-11-01",
  );
  const D2 = makeRoom("2026-11-02", "2026-11-02 00:00:00+00", "2026-11-03 00:00:00+00");
  addAttempts(D2, [{ user: BEE, total: 900, tie: 200_000 }, { user: VIEW, total: 800, tie: 200_000 }], "2026-11-02");
  q(`SELECT public.leaderboard_refresh()`);

  const daily = (token: string, input: Record<string, unknown>) => call(fns.dailyTopBoardFn, input, token);

  await section("the Daily top 100", async () => {
    const a = await daily(tok.view, { kind: "puzzle", day: "2026-11-01", scope: "top100" });
    check(a.ok && a.page.exists && a.page.final && a.page.open, "a closed day's board is final and open");
    const rows = a.page.rows as Row[];
    check(a.page.players === 7 + 110 + 1, `only counted accounts make the field (${a.page.players})`);
    check(rows.slice(0, 6).map((r) => `${r.rank}:${r.value}`).join() === "1:1184,2:1176,3:1176,4:1150,4:1150,6:1149", `ties go to the faster time; level on both share a place (${rows.slice(0, 6).map((r) => `${r.rank}:${r.value}`).join()})`);
    check(rows[1]!.name === "Cee" && rows[2]!.name === "Bee" && rows[1]!.timeMs === 260_000, "of a level total, the faster time is above");
    check(rows.length === 100 && rows.every((r) => r.rank <= 100), `the top 100 (${rows.length} rows)`);
    check(!rows.some((r) => r.value >= 1250), "a new account, a guest, a flagged run and an unfinished one are never on the board");
    check(rows[5]!.hidden && rows[5]!.name === null && rows[5]!.rank === 6, "privacy holds on the Daily board (an under-18 hidden, place unchanged)");
    check(rows.find((r) => r.value === 1100)?.isFriend === true && rows.find((r) => r.value === 1100)?.name === "Pal_Teen", "your under-18 friend is visible to you");
    const me = a.page.me as Row;
    check(!!me && me.isMe && me.rank === 118 && me.value === 694 && me.timeMs === 400_000 && !rows.some((r) => r.isMe), `your own place pinned below the top 100 (${me?.rank})`);
    check(rows.every((r) => Object.keys(r).every((k) => ALLOWED.has(k))), "no Daily row carries more than the player card shows");
    // The same rule as daily.ts rankBoard on the same counted rows.
    const counted = JSON.parse(q(`SELECT json_agg(json_build_object('id', a.id, 'total', a.total_score, 'tieMs', a.tie_ms, 'finishedAt', extract(epoch FROM a.finished_at) * 1000)) FROM async_attempts a JOIN daily_board_entries e ON e.attempt_id = a.id WHERE e.room_id = '${D1}'`)) as { id: string; total: number; tieMs: number; finishedAt: number }[];
    const ranked = rankBoard(counted);
    const stored = new Map(q(`SELECT attempt_id || ':' || rank || ':' || position FROM daily_board_entries WHERE room_id = '${D1}'`).split("\n").map((l) => { const [id, rank, pos] = l.split(":"); return [id!, { rank: Number(rank), pos: Number(pos) }]; }));
    check(ranked.every((r, i) => stored.get(r.id)?.rank === r.rank && stored.get(r.id)?.pos === i + 1), "every stored place and order is daily.ts rankBoard's (src/lib/duel/ranking.ts)");
  });

  await section("why you aren't on a Daily board", async () => {
    const reason = async (token: string) => ((await daily(token, { kind: "puzzle", day: "2026-11-01", scope: "top100" })).page.meReason as string | null);
    check((await reason(tok.newbie)) === "new_account", "a new account is told it counts from its second day");
    check((await reason(tok.guest)) === "guest", "a guest is told only accounts count");
    check((await reason(accountToken(FLAG))) === "not_counted", "a flagged run is just not counted");
    check((await reason(accountToken(SLOW))) === "not_finished", "an unfinished attempt needs finishing");
  });

  await section("friends on the Daily", async () => {
    const a = await daily(tok.view, { kind: "puzzle", day: "2026-11-01", scope: "friends" });
    const f = a.page.rows as Row[];
    check(f.map((r) => `${r.rank}:${r.name}`).join() === "1:Ace,2:Pal_Teen,3:Viewer", `friends on a Daily, ranked among themselves (${f.map((r) => `${r.rank}:${r.name}`).join()})`);
    const guest = await daily(tok.guest, { kind: "puzzle", day: "2026-11-01", scope: "friends" });
    check(!guest.ok && guest.reason === "account", "a guest has no friends board");
  });

  await section("earlier days kept and browsable", async () => {
    const a = await daily(tok.view, { kind: "puzzle", day: "2026-11-02", scope: "top100" });
    check(a.page.prevDay === "2026-11-01" && a.page.nextDay === null, "the day before is reachable (prev / next)");
    const b = await daily(tok.view, { kind: "puzzle", day: "2026-11-01", scope: "top100" });
    check(b.page.nextDay === "2026-11-02" && b.page.prevDay === null, "and the day after");
    q(`UPDATE async_attempts SET total_score = 5000 WHERE room_id = '${D1}' AND user_id = '${VIEW}'`);
    q(`SELECT public.leaderboard_refresh()`);
    const c = await daily(tok.view, { kind: "puzzle", day: "2026-11-01", scope: "top100" });
    check((c.page.me as Row).value === 694 && (c.page.me as Row).rank === 118, "a final board is kept as it was (never recomputed)");
    const none = await daily(tok.view, { kind: "puzzle", day: "2026-10-01", scope: "top100" });
    check(none.ok && none.page.exists === false && none.page.nextDay === "2026-11-01", "a day with no board says so and points to the next one");
    const arcade = await daily(tok.view, { kind: "arcade", day: "2026-11-01", scope: "top100" });
    check(arcade.ok && arcade.page.exists === false, "the Daily Arcade has its own boards");
  });

  await section("today's board", async () => {
    const now = Date.now();
    const today = ukDayKey(now);
    const opens = new Date(now - 3_600_000).toISOString();
    const closes = new Date(now + 3_600_000).toISOString();
    const room = q(`INSERT INTO async_rooms (kind, room_key, day, seed, round_count, opens_at, closes_at) VALUES ('daily_puzzle', 'daily_puzzle:${today}-today', DATE '${today}', 77, 6, TIMESTAMPTZ '${opens}', TIMESTAMPTZ '${closes}') RETURNING id`).split("\n")[0]!;
    const startedLongAgo = new Date(now - 1_800_000).toISOString();
    addAttempts(room, [{ user: ACE, total: 900, tie: 100_000, started: startedLongAgo, finished: new Date(now - 600_000).toISOString() }, { user: BEE, total: 700, tie: 100_000, started: startedLongAgo, finished: null }], today);
    q(`SELECT public.leaderboard_refresh()`);
    const bee = await daily(tok.bee, { kind: "puzzle", scope: "top100" });
    check(bee.ok && bee.page.day === today && bee.page.final === false && bee.page.open === false && (bee.page.rows as Row[]).length === 0, "today's board stays closed to you until you finish (the Daily's rule; the day is today's by default)");
    const ace = await daily(accountToken(ACE), { kind: "puzzle", scope: "top100" });
    check(ace.page.open === true && (ace.page.rows as Row[])[0]?.isMe === true, "once you've finished, today's board opens");
    q(`UPDATE async_attempts SET finished_at = now() WHERE room_id = '${room}' AND user_id = '${BEE}'`);
    const pending = await daily(tok.bee, { kind: "puzzle", scope: "top100" });
    check(pending.page.open === true && pending.page.meReason === "pending", "a run finished since the last refresh shows as on its way");
    q(`SELECT public.leaderboard_refresh_daily(TIMESTAMPTZ '${closes}' + interval '10 minutes')`);
    check(q(`SELECT final FROM daily_boards WHERE room_id = '${room}'`) === "f", "a board isn't final until 30 minutes after its day closes (late rounds finish)");
    q(`SELECT public.leaderboard_refresh_daily(TIMESTAMPTZ '${closes}' + interval '31 minutes')`);
    check(q(`SELECT final || ':' || players FROM daily_boards WHERE room_id = '${room}'`) === "true:2", "then it is frozen with its field");
  });

  /* ---------------------------------------------------------------- the players' cards */
  // Joe's rule of 11 Nov 2026: every visible row carries the player's card (A1's public card, C2's badges and title) and
  // W3a's tier, attached by the server in the board's own call; hidden and deleted rows carry none, and no row carries an id.
  await section("every visible row carries the player's card; hidden rows none", async () => {
    q(`SELECT public.economy_grant_item('${ACE}', 'frame.gold', 'grant'), public.economy_grant_item('${ACE}', 'name-colour.gold-leaf', 'grant'),
              public.economy_grant_item('${ACE}', 'card-art.bolt-stripes', 'grant')`);
    q(`SELECT public.economy_equip('${ACE}', 'frame', 'frame.gold'), public.economy_equip('${ACE}', 'name-colour', 'name-colour.gold-leaf'),
              public.economy_equip('${ACE}', 'card-art', 'card-art.bolt-stripes')`);
    q(`SET session_replication_role = replica;
       INSERT INTO player_badges (user_id, badge, detail) VALUES ('${ACE}', 'flawless', '{}'::jsonb) ON CONFLICT DO NOTHING;
       SET session_replication_role = origin;`);
    const set = q(`SELECT public.badge_set_card('${ACE}', ARRAY['flawless'])`);
    check(set === "set", `Ace wears a badge through C2's badge_set_card (${set})`);
    const daily = await call(fns.dailyTopBoardFn, { kind: "puzzle", day: "2026-11-01", scope: "top100" }, tok.bee);
    const rating = await board(tok.bee, { board: "joulz", scope: "global", period: "season" });
    for (const [what, page] of [["Daily", daily.page], ["rating", rating.page]] as const) {
      const rows = [...(page.rows as (Row & Record<string, unknown>)[]), ...(page.me ? [page.me as Row & Record<string, unknown>] : [])];
      check(rows.length > 0 && rows.every((r) => !("pid" in r)), `${what}: no row carries a player's id`);
      check(rows.filter((r) => r.hidden).every((r) => r["card"] === undefined && r["tier"] === undefined), `${what}: a hidden row has no card and no tier`);
      check(rows.filter((r) => !r.hidden && !r.deleted).every((r) => typeof r["card"] === "object"), `${what}: every visible row has its card`);
    }
    const ace = (rating.page.rows as (Row & { card?: Record<string, unknown> })[]).find((r) => r.name === "Ace")!;
    const c = ace.card!;
    check(c["frame"] === "frame.gold" && c["nameColour"] === "name-colour.gold-leaf" && c["cardArt"] === "card-art.bolt-stripes", `Ace's row carries the equipped frame, name colour and card art (${JSON.stringify(c).slice(0, 160)})`);
    check(JSON.stringify(c["badges"]) === '["flawless"]' && c["title"] === "rookie" && c["avatarId"] === "captain-joulz" && c["colour"] === 3, "and the badge, the title, the avatar and the account's colour");
    const aceDaily = (daily.page.rows as (Row & { card?: Record<string, unknown> })[]).find((r) => r.name === "Ace")!;
    check(aceDaily.card?.["frame"] === "frame.gold", "the Daily board carries the same card");
    const teen = (rating.page.rows as (Row & Record<string, unknown>)[])[1]!;
    check(teen.hidden && teen["card"] === undefined && teen.name === null, "a hidden under-18 stays Hidden player with no card");
    const view = await board(tok.view, { board: "joulz", scope: "global", period: "season" });
    const palToFriend = (view.page.rows as (Row & Record<string, unknown>)[]).find((r) => r.name === "Pal_Teen");
    check(typeof palToFriend?.["card"] === "object", "an under-18 shown to a friend carries their card");
  });

  await section("the nameplate's tier comes from W3a", async () => {
    // Rated_0..5 from the real-engine section are off the stood-in board; give one a tier and show it on the Daily.
    q(`UPDATE rated_profiles SET shown_tier = 'storm' WHERE player_id = (SELECT player_id FROM rated_profiles WHERE joulz IS NOT NULL ORDER BY player_id LIMIT 1)`);
    const tierOf = q(`SELECT player_id FROM rated_profiles WHERE shown_tier = 'storm' LIMIT 1`);
    const room = q(`SELECT room_id FROM daily_boards WHERE day = '2026-11-02'`);
    q(`INSERT INTO async_attempts (room_id, user_id, display_name, started_at, finished_at, rounds_done, total_score, tie_ms) VALUES ('${room}', '${tierOf}', 'P', TIMESTAMPTZ '2026-11-02 10:00:00+00', TIMESTAMPTZ '2026-11-02 10:20:00+00', 6, 950, 1000)`);
    q(`UPDATE daily_boards SET final = false WHERE room_id = '${room}'`);
    q(`SET session_replication_role = replica; UPDATE profiles SET created_at = TIMESTAMPTZ '2026-10-01 00:00:00+00' WHERE user_id = '${tierOf}'; SET session_replication_role = origin;`);
    q(`SELECT public.leaderboard_refresh()`);
    const page = (await call(fns.dailyTopBoardFn, { kind: "puzzle", day: "2026-11-02", scope: "top100" }, tok.view)).page;
    const top = (page.rows as (Row & Record<string, unknown>)[])[0]!;
    check(top.value === 950 && top["tier"] === "storm", `a placed player's row carries W3a's shown tier (${String(top["tier"])})`);
    check((page.rows as (Row & Record<string, unknown>)[]).filter((r) => r.name === "Bee").every((r) => r["tier"] === null || r["tier"] === undefined), "an unrated player's row has no tier");
  });

  /* ---------------------------------------------------------------- the Cron Trigger */
  await section("the Worker's Cron Trigger: every 5 minutes, harmless twice", async () => {
    const vite = readFileSync("vite.config.ts", "utf8");
    const { LEADERBOARD_CRONS, runLeaderboardRefreshTask } = await import("../src/lib/leaderboards/tasks/refreshTask.server");
    const cron = LEADERBOARD_CRONS["leaderboards:refresh"];
    check(
      cron === "*/5 * * * *" &&
        vite.includes(`"${cron}": ["leaderboards:refresh"]`) &&
        vite.includes('"leaderboards:refresh": { handler: fileURLToPath(new URL("./src/lib/leaderboards/tasks/refresh.task.ts"') &&
        // One chain of task sets (main's withTasks since 12 Nov 2026), so neither W3a's rated:standings nor B2's
        // push:friend-sweep (also */5) replaces the refresh, nor it them.
        /withTasks\(withTasks\(nitroTasks\(PUSH_TASKS, RATED_TASKS\), MATCHMAKING_TASKS\), LEADERBOARD_TASKS\)/.test(vite),
      `the Cron Trigger: "${cron}" runs leaderboards:refresh beside W3a's rated:standings (vite.config.ts and LEADERBOARD_CRONS agree)`,
    );
    const digest = () =>
      q(`SELECT md5(coalesce((SELECT string_agg(board || period || player_id || ':' || value || ':' || global_rank || ':' || position || ':' || coalesce(country_rank, 0) || coalesce(tier, ''), ',' ORDER BY board, period, player_id)
                                FROM leaderboard_rating_rows WHERE generation = (SELECT max(id) FROM leaderboard_generations WHERE complete)), '') ||
                    coalesce((SELECT string_agg(room_id || ':' || attempt_id || ':' || rank || ':' || position || ':' || coalesce(player_id::text, '-'), ',' ORDER BY room_id, attempt_id) FROM daily_board_entries), '') ||
                    coalesce((SELECT string_agg(room_id || ':' || players || ':' || final, ',' ORDER BY room_id) FROM daily_boards), ''))`);
    const before = digest();
    const both = await Promise.all([runLeaderboardRefreshTask(), runLeaderboardRefreshTask()]);
    check(both.every((r) => (r.result as { ok?: boolean }).ok === true), "two runs at once both finish without an error");
    const twice = digest();
    await runLeaderboardRefreshTask();
    check(before === twice && twice === digest(), "running the refresh twice (at once, then again) leaves every board exactly as one run does");
    check(Number(q(`SELECT count(*) FROM leaderboard_generations`)) <= 2 && q(`SELECT bool_and(complete) FROM leaderboard_generations`) === "t", "no half-written or piled-up generations");
    const lockHeld = q(`BEGIN; SELECT pg_advisory_xact_lock(hashtext('joulz-leaderboards-refresh')); SELECT 1; COMMIT;`);
    check(lockHeld.length > 0 && JSON.parse(q(`SELECT public.leaderboard_refresh()::text`)).skipped !== true, "the lock is released after each run");
  });

  /* ---------------------------------------------------------------- the Daily badges */
  await section("Daily Champion and Daily Top 100 only above 100 and 500 players", async () => {
    // Daily Champion: a board of exactly 100 counted players, and one of 99.
    const D3 = makeRoom("2026-11-03", "2026-11-03 00:00:00+00", "2026-11-04 00:00:00+00");
    addAttempts(D3, [{ user: W1, total: 2000, tie: 1 }, ...fillerAttempts(0, 99, 1000)], "2026-11-03");
    const D4 = makeRoom("2026-11-04", "2026-11-04 00:00:00+00", "2026-11-05 00:00:00+00");
    addAttempts(D4, [{ user: W2, total: 2000, tie: 1 }, ...fillerAttempts(0, 98, 1000)], "2026-11-04");
    // Daily Top 100: 50th on a board of exactly 500, and on one of 499.
    const D5 = makeRoom("2026-11-05", "2026-11-05 00:00:00+00", "2026-11-06 00:00:00+00");
    addAttempts(D5, [...fillerAttempts(0, 49, 2000), { user: X5, total: 1000, tie: 1 }, ...fillerAttempts(49, 450, 900)], "2026-11-05");
    const D6 = makeRoom("2026-11-06", "2026-11-06 00:00:00+00", "2026-11-07 00:00:00+00");
    addAttempts(D6, [...fillerAttempts(0, 49, 2000), { user: X6, total: 1000, tie: 1 }, ...fillerAttempts(49, 449, 900)], "2026-11-06");
    q(`SELECT public.leaderboard_refresh()`);
    check(q(`SELECT string_agg(day || '=' || players, ',' ORDER BY day) FROM daily_boards WHERE day BETWEEN '2026-11-03' AND '2026-11-06'`) === "2026-11-03=100,2026-11-04=99,2026-11-05=500,2026-11-06=499", "the four boards' fields: 100, 99, 500, 499");
    const facts = (id: string) => JSON.parse(q(`SELECT public.daily_board_badge_facts('${id}', 100, 500)::text`)) as { wins: number; top100: number };
    check(facts(W1).wins === 1 && facts(W2).wins === 0, "a first counts on a board of 100, not 99");
    check(facts(X5).top100 === 1 && facts(X6).top100 === 0, "a top-100 finish counts on a board of 500, not 499");
    check(facts(W1).top100 === 0, "a first on a board of 100 is no Daily Top 100 (under 500 players)");
    const has = (id: string, b: string) => q(`SELECT count(*) FROM player_badges WHERE user_id = '${id}' AND badge = '${b}'`) === "1";
    for (const id of [W1, W2, X5, X6]) await call(badges.syncMyBadges, undefined, accountToken(id));
    check(has(W1, "daily-champion") && !has(W2, "daily-champion"), "Daily Champion is awarded on 100 players and not on 99");
    check(has(X5, "daily-top-100") && !has(X6, "daily-top-100"), "Daily Top 100 is awarded on 500 players and not on 499");
    check(!has(W1, "daily-top-100"), "no Daily Top 100 from a board of 100");
    check(q(`SELECT status FROM badges WHERE slug = 'daily-champion'`) === "earnable" && q(`SELECT status FROM badges WHERE slug = 'daily-top-100'`) === "earnable", "both badges are earnable in the catalogue table");
    const award = JSON.parse(q(`SELECT public.badge_award('${W2}', 'daily-champion', '{}'::jsonb)::text`)) as { status: string };
    check(award.status === "awarded", "C2's badge_award now accepts Daily Champion (the database no longer refuses it)");
  });

  /* ---------------------------------------------------------------- analytics */
  await section("events", async () => {
    await flushAnalytics();
    const props = q(`SELECT string_agg(DISTINCT props::text, ' | ') FROM analytics.events WHERE event = 'leaderboard_viewed' AND player_id = '${VIEW}'`);
    check(/"board": "joulz"/.test(props) && /"scope": "global"/.test(props) && /"period": "season"/.test(props) && /"period": "peak"/.test(props) && /"scope": "friends"/.test(props), `leaderboard_viewed carries board, scope and period (${props.slice(0, 120)})`);
    const before = Number(q(`SELECT count(*) FROM analytics.events WHERE event = 'leaderboard_viewed'`));
    await board(tok.view, { board: "joulz", scope: "global", period: "season", offset: 50 });
    await flushAnalytics();
    check(Number(q(`SELECT count(*) FROM analytics.events WHERE event = 'leaderboard_viewed'`)) === before, "a further page isn't a new view");
    const daily = q(`SELECT string_agg(DISTINCT props::text, ' | ') FROM analytics.events WHERE event = 'daily_board_viewed' AND player_id = '${VIEW}'`);
    check(/"kind": "puzzle"/.test(daily) && /"day": "2026-11-01"/.test(daily) && /"kind": "arcade"/.test(daily), `daily_board_viewed carries kind and day (${daily.slice(0, 120)})`);
    check(q(`SELECT count(*) FROM analytics.events WHERE event IN ('leaderboard_viewed', 'daily_board_viewed') AND (props::text ILIKE '%viewer%' OR props::text ILIKE '%ace%')`) === "0", "no name in an event");
  });
}
