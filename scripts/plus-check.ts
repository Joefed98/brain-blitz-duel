/**
 * plus-check (wave 2, session E2, 13 Nov 2026; docs/economy/plus.md): Joulz Plus, the Daily archive, early access and
 * the public cosmetics read, through the real server code (src/lib/plus, src/lib/cosmetics) and the real migrations on
 * a local PostgreSQL 16, with the server-function harness's PostgREST / GoTrue stand-in.
 *
 * What it proves:
 * - membership months: month n starts n calendar months after the start (UTC), clamped to the month's end;
 * - nothing that scores, grades, replays, matches or times reaches Plus's or the cosmetics' modules (import graph);
 * - the Plus migration's copies of C2's badge_facts and D2's pass_activity are exactly their latest earlier text plus
 *   the archive condition, and no later definition drops it (scripts/plus-copies.ts);
 * - test rewards: a test membership's coins and freezes carry reason plus_test_monthly, and plus.remove_test_rewards
 *   takes them all back in one call (one account or everyone), once, logged;
 * - archive plays are marked archive: true in game_started and daily_archive_played, keeping the daily mode;
 * - the database: no API role reaches Plus's tables or functions, and the `plus` schema not even the service role;
 *   non-testers and guests are refused by every Plus function; a tester's test purchase starts Plus marked as a test
 *   (plus_bought, test true); the monthly perks (200 coins, reason plus_monthly; 2 streak freezes) are paid once per
 *   membership month across month boundaries, however often and however concurrently the server is asked
 *   (plus_perk_granted only for lines actually written); the premium pass goes through D2's binding (once a month
 *   when bound, never when not); Joe's plus.remove_test_purchase ends it (logged, a note required) and
 *   plus.start_test starts one; the PLUS chip is off by default and shows only for a member who turns it on;
 * - early access: a marked game is held back from non-members and guests until its day ends, never from members,
 *   and nothing is held back when nothing is marked;
 * - the Daily archive: members only; a replay copies the day's stored rounds exactly into its own room; it never
 *   reaches that day's board, the streak (daily_history), badges (badge_facts) or the daily analytics; its solutions
 *   are never locked; daily_archive_played once per new replay;
 * - the public cosmetics: an account's equipped finish, accessory, special edition, celebrations, reactions; guests
 *   none; an emote's pack is sendable only by a player who equipped it.
 *
 * Needs the PostgreSQL 16 binaries for the database part (preinstalled on GitHub's runners). Without them it fails on
 * CI and prints a NOTE locally. No browser. ~20 s.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

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
  if (/^\s*(FAIL|NOTE)|^plus-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const JOE = uid(51); // a tester
const KIM = uid(52); // not a tester
const MIA = uid(53); // a second tester
const NED = uid(54); // a guest
const RIA = uid(55); // flagged-run checks: the flagged player
const SAM = uid(56); // flagged-run checks: the other player in her room
const DAY = 86_400_000;

/* ------------------------------------------------------------------ pure */

async function pureChecks(): Promise<void> {
  const { monthStartMs, monthsBegun } = await import("../src/lib/plus/months");
  const at = (s: string) => Date.parse(s);
  const iso = (ms: number) => new Date(ms).toISOString();
  check(iso(monthStartMs(at("2026-01-31T10:00:00Z"), 1)) === "2026-02-28T10:00:00.000Z", "a 31 January start: month 1 on 28 February");
  check(iso(monthStartMs(at("2028-01-31T10:00:00Z"), 1)) === "2028-02-29T10:00:00.000Z", "in a leap year: 29 February");
  check(iso(monthStartMs(at("2026-11-13T09:30:00Z"), 2)) === "2027-01-13T09:30:00.000Z", "month 2 crosses the year");
  check(iso(monthStartMs(at("2026-11-13T09:30:00Z"), 12)) === "2027-11-13T09:30:00.000Z", "month 12 is a year on");
  const start = at("2026-11-13T09:30:00Z");
  check(monthsBegun(start, start - 1).length === 0, "nothing before the start");
  check(monthsBegun(start, start).join() === "0", "month 0 at the start");
  check(monthsBegun(start, at("2026-12-13T09:29:59Z")).join() === "0", "still month 0 a second before month 1");
  check(monthsBegun(start, at("2026-12-13T09:30:00Z")).join() === "0,1", "month 1 at its exact start");
  check(monthsBegun(start, at("2027-11-14T00:00:00Z")).length === 13, "a year and a day: 13 months begun");
}

/* ------------------------------------------------------------------ the import graph */

function neutralityChecks(): void {
  const ROOT = resolve(".");
  const SRC = join(ROOT, "src");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
  const resolveSpec = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
    if (!base) return null;
    for (const ext of EXTS) if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
    return null;
  };
  const SPEC = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  const imports = (file: string) =>
    [...readFileSync(file, "utf8").matchAll(SPEC)].flatMap((m) => {
      const p = resolveSpec(file, m[1] ?? m[2] ?? m[3] ?? "");
      return p ? [p] : [];
    });
  const rel = (p: string) => relative(ROOT, p);
  const PATTERN = /(grade|scor|replay|rank|match|deal|generate|standard|taplog|speedpar|stagedrounds|clock|buzzer|roomclose|timing|window|receipt|trust|partialcredit|roundmax|puzzlebands|arcade\.server|sports\.server|cards\.ts$|registry|catalogue\.data)/i;
  const roots = walk(SRC).filter((p) => {
    const r = rel(p);
    if (/^src\/(lib\/arcade|lib\/round|lib\/replay|puzzles)\//.test(r)) return true;
    return /^src\/lib\/duel\//.test(r) && PATTERN.test(r.slice("src/lib/duel/".length));
  });
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const f = queue.shift()!;
    if (seen.has(f)) continue;
    seen.add(f);
    // The practice deal's early-access question (access.server.ts) is allowed: it never reads the economy.
    for (const next of imports(f)) if (!seen.has(next)) queue.push(next);
  }
  const forbidden = [...seen].filter((p) => {
    const r = rel(p);
    return (
      /^src\/lib\/plus\/(plus|archive)\.(server|functions)\.ts$/.test(r) ||
      /^src\/lib\/plus\/(plusApi|passBinding\.server)\.ts$/.test(r) ||
      /^src\/lib\/cosmetics\//.test(r) ||
      /^src\/design\/identity\/cosmetics/.test(r)
    );
  });
  check(roots.length > 300, `${roots.length} scoring, grading, replay, matchmaking and timing files walked`);
  check(forbidden.length === 0, `none of them reaches Plus's perks, the archive or the cosmetics${forbidden.length ? `: ${forbidden.slice(0, 3).map(rel).join(", ")}` : ""}`);
  // The early-access question reaches no ledger.
  const access = new Set<string>();
  const q2 = [join(SRC, "lib/plus/access.server.ts")];
  while (q2.length) {
    const f = q2.shift()!;
    if (access.has(f)) continue;
    access.add(f);
    for (const next of imports(f)) q2.push(next);
  }
  check(![...access].some((p) => /^src\/lib\/economy\//.test(rel(p))), "the early-access question reaches no economy module");
}

/* ------------------------------------------------------------------ the copied functions */

/**
 * C2's badge_facts and D2's pass_activity are re-made in the Plus migration from copies (Joe, 13 Nov 2026): each copy
 * must be exactly the latest earlier definition plus the archive condition, and anything defined later must keep the
 * condition (scripts/plus-copies.ts).
 */
async function copiesChecks(): Promise<void> {
  const copies = await import("./plus-copies");
  const problems = copies.copiesReport();
  check(problems.length === 0, `the copied badge_facts and pass_activity are their sources plus the archive condition${problems.length ? `: ${problems.join(" | ")}` : ""}`);
  // The comparison catches a one-line change in the source (as C2 or D2 changing their function would make).
  for (const c of copies.COPIED) {
    const want = copies.expectedCopy(c);
    if ("error" in want) continue;
    const changed = want.text.replace("SELECT", "SELECT  ");
    check(copies.heldCopy(c) !== changed && copies.heldCopy(c) === want.text, `${c.name}: a changed source would be caught`);
    // Exactly the two conditions: every insertion is the archive kind or a flagged run, nothing else.
    const adds = c.insertions.map((i) => i.add);
    check(
      adds.length > 0 && adds.every((a) => a.includes(copies.ARCHIVE) || a.includes(copies.FLAGGED)),
      `${c.name}: the copy adds only the archive and flagged-run conditions (${adds.length} insertions)`,
    );
    const counts = copies.conditionCounts(c);
    check(counts.archive >= 1 && counts.flagged >= 3, `${c.name}: both conditions present (archive ${counts.archive}, flagged ${counts.flagged})`);
    // A later definition dropping either would be caught.
    const dropArchive = want.text.replaceAll(copies.ARCHIVE, "'x'");
    const dropFlagged = want.text.replaceAll(copies.FLAGGED, "->> 'x'");
    check(dropArchive.split(copies.ARCHIVE).length - 1 < counts.archive && dropFlagged.split(copies.FLAGGED).length - 1 < counts.flagged, `${c.name}: dropping either condition is counted short`);
  }
}

/* ------------------------------------------------------------------ the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const fns = await import("../src/lib/plus/plus.functions");
  const plus = await import("../src/lib/plus/plus.server");
  const access = await import("../src/lib/plus/access.server");
  const archive = await import("../src/lib/plus/archive.server");
  const binding = await import("../src/lib/plus/passBinding.server");
  const cosmetics = await import("../src/lib/cosmetics/cosmetics.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const daily = await import("../src/lib/duel/daily.server");
  const engine = await import("../src/lib/duel/asyncRoom.server");
  const { ukDayKey, shiftDayKey, ukDayWindow } = await import("../src/lib/duel/daily");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = await adminDb();
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const refused = (sql: string) => {
    const out = db.psql(`BEGIN; ${sql}; ROLLBACK;`);
    return out.ok && !/ERROR/.test(out.err) ? "" : out.err;
  };
  const events = async (event: string, player?: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}'${player ? ` AND player_id = '${player}'` : ""}`));
  };
  // A test membership's monthly rewards carry reason plus_test_monthly (Joe, 13 Nov 2026: marked as test rewards).
  const plusCoins = (id: string) => Number(q(`SELECT coalesce(sum(amount), 0) FROM coin_ledger WHERE user_id = '${id}' AND reason = 'plus_test_monthly'`));
  const plusFreezes = (id: string) => Number(q(`SELECT coalesce(sum(amount), 0) FROM consumable_ledger WHERE user_id = '${id}' AND reason = 'plus_test_monthly'`));
  const tok = { joe: accountToken(JOE), kim: accountToken(KIM), mia: accountToken(MIA), ned: userToken(NED) };
  const deviceDb = (token: string | null) =>
    createClient(rest.url, ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

  q(`SELECT public.create_profile('${JOE}', 'Joe_Plus', 3::smallint, DATE '1985-05-05', NULL)`);
  q(`SELECT public.create_profile('${KIM}', 'Kim_Free', 4::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT public.create_profile('${MIA}', 'Mia_Plus', 6::smallint, DATE '1992-02-02', NULL)`);
  q(`SELECT shop.add_tester('Joe_Plus', 'testing Plus')`);
  q(`SELECT shop.add_tester('Mia_Plus', 'testing Plus')`);

  await section("roles", async () => {
    for (const t of ["plus_memberships", "plus_perk_grants", "plus_settings", "early_access_games"]) {
      for (const token of [null, tok.kim]) {
        const { data, error } = await deviceDb(token).from(t).select("*");
        check(!!error || (data ?? []).length === 0, `${t}: no API read (${token ? "authenticated" : "anon"})`);
      }
    }
    for (const fn of ["plus_test_purchase", "plus_membership", "plus_set_mark", "cosmetics_public", "plus_is_member"]) {
      const { error } = await deviceDb(tok.kim).rpc(fn, fn === "cosmetics_public" ? { p_user_ids: [KIM] } : fn === "plus_test_purchase" ? { p_user_id: KIM, p_plan: "monthly" } : fn === "plus_set_mark" ? { p_user_id: KIM, p_on: true } : { p_user_id: KIM });
      check(!!error, `${fn}: not callable from a phone`);
    }
    for (const role of ["anon", "authenticated", "service_role"])
      check(!!refused(`SET LOCAL ROLE ${role}; SELECT plus.list_members()`), `the plus schema: not reachable as ${role}`);
  });

  await section("not open: non-testers and guests are refused", async () => {
    const status = await callServerFn(fns.plusStatusFn, {}, tok.kim);
    check(status.open === false && status.member === null, "a non-tester's status: Plus not open");
    const bought = await callServerFn(fns.plusTestPurchaseFn, { plan: "monthly" }, tok.kim);
    check(bought.ok === false && bought.reason === "not_tester", "a non-tester's test purchase is refused");
    check(q(`SELECT count(*) FROM plus_memberships WHERE user_id = '${KIM}'`) === "0", "and starts nothing");
    const mark = await callServerFn(fns.plusSetMarkFn, { on: true }, tok.kim);
    check(mark.ok === false, "a non-tester can't set the PLUS chip");
    const arch = await callServerFn(fns.dailyArchiveFn, {}, tok.kim);
    check(arch.ok === false, "a non-tester can't open the Daily archive");
    const start = await callServerFn(fns.dailyArchiveStartFn, { kind: "puzzle", day: shiftDayKey(ukDayKey(Date.now()), -1) }, tok.kim);
    check(start.ok === false, "a non-tester can't replay a Daily");
    const guest = await callServerFn(fns.plusTestPurchaseFn, { plan: "monthly" }, tok.ned);
    check(guest.ok === false && guest.reason === "guest", "a guest's test purchase is refused");
    const gs = await callServerFn(fns.plusStatusFn, {}, tok.ned);
    check(gs.open === false, "a guest's status: not open");
    check(q(`SELECT public.plus_test_purchase('${KIM}', 'monthly') ->> 'status'`) === "not_tester", "the database refuses a non-tester too");
  });

  let calls = 0;
  await section("a test purchase and the monthly perks", async () => {
    binding.bindPremiumPass(null);
    const bad = await callServerFn(fns.plusTestPurchaseFn, { plan: "weekly" }, tok.joe);
    check(bad.ok === false && bad.reason === "bad_plan", "only monthly or yearly");
    const bought = await callServerFn(fns.plusTestPurchaseFn, { plan: "monthly" }, tok.joe);
    check(bought.ok === true && bought.status.member?.plan === "monthly" && bought.status.member?.test === true, "a tester's test purchase starts monthly Plus, marked as a test");
    check(q(`SELECT test FROM plus_memberships WHERE user_id = '${JOE}' AND ended_at IS NULL`) === "t", "stored as a test");
    check((await events("plus_bought", JOE)) === 1, "plus_bought recorded");
    check(q(`SELECT props ->> 'test' || ',' || (props ->> 'plan') FROM analytics.events WHERE event = 'plus_bought' AND player_id = '${JOE}'`) === "true,monthly", "plus_bought: test and plan");
    check(plusCoins(JOE) === 200 && plusFreezes(JOE) === 2, `month 0: 200 coins and 2 streak freezes (${plusCoins(JOE)}, ${plusFreezes(JOE)})`);
    check((await events("plus_perk_granted", JOE)) === 2, `plus_perk_granted for coins and freezes (${await events("plus_perk_granted", JOE)})`);
    check(bought.status.premiumPass === false && q(`SELECT count(*) FROM pass_premium WHERE user_id = '${JOE}'`) === "0", "no season shown yet: no premium pass given (D2's function answers none)");
    const again = await callServerFn(fns.plusTestPurchaseFn, { plan: "yearly" }, tok.joe);
    check(again.ok === false && again.reason === "already_member", "a second purchase: already a member");
    for (let i = 0; i < 3; i++) await callServerFn(fns.plusStatusFn, {}, tok.joe);
    check(plusCoins(JOE) === 200 && plusFreezes(JOE) === 2 && (await events("plus_perk_granted", JOE)) === 2, "asking again in the same month pays nothing more");
    const started = Date.parse(q(`SELECT to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM plus_memberships WHERE user_id = '${JOE}' AND ended_at IS NULL`));
    const { monthStartMs } = await import("../src/lib/plus/months");
    // Just before month 1: nothing new. At month 1: one more lot. Three months on (two missed): both, once.
    await plus.plusStatus(admin, JOE, monthStartMs(started, 1) - 1000);
    check(plusCoins(JOE) === 200, "a second before month 1: nothing more");
    await plus.plusStatus(admin, JOE, monthStartMs(started, 1));
    check(plusCoins(JOE) === 400 && plusFreezes(JOE) === 4, "month 1: another 200 coins and 2 freezes");
    await Promise.all([1, 2, 3, 4].map(() => plus.plusStatus(admin, JOE, monthStartMs(started, 3) + DAY)));
    check(plusCoins(JOE) === 800 && plusFreezes(JOE) === 8, "months 2 and 3 caught up once, however many ask at once");
    check(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${JOE}' AND reason = 'plus_test_monthly'`) === "4", "one coin line a month");
    check(q(`SELECT count(*) FROM coin_ledger WHERE reason = 'plus_monthly'`) === "0" && q(`SELECT count(*) FROM consumable_ledger WHERE reason = 'plus_monthly'`) === "0", "a test membership's rewards are all marked as test rewards (never plus_monthly)");
    check(q(`SELECT count(*) FROM analytics.events WHERE event = 'plus_perk_granted' AND player_id = '${JOE}' AND props ->> 'test' = 'true'`) === "8", "plus_perk_granted says they were test rewards");
    check(q(`SELECT count(*) FROM plus_perk_grants WHERE user_id = '${JOE}'`) === "8", "one perk record a month for each perk");
    check((await events("plus_perk_granted", JOE)) === 8, `plus_perk_granted once per line written (${await events("plus_perk_granted", JOE)})`);
    // D2's function bound: the premium pass once per month.
    binding.bindPremiumPass({ grantPremiumPass: async () => (calls++ === 0 ? "granted" : "already") });
    const s1 = await plus.plusStatus(admin, JOE, monthStartMs(started, 3) + DAY);
    const s2 = await plus.plusStatus(admin, JOE, monthStartMs(started, 3) + 2 * DAY);
    check(s1.premiumPass && s2.premiumPass && calls === 1, "the premium pass goes through D2's function once a month");
    await plus.plusStatus(admin, JOE, monthStartMs(started, 4));
    check(calls === 2 && q(`SELECT count(*) FROM plus_perk_grants WHERE user_id = '${JOE}' AND perk = 'premium_pass'`) === "2", "and again in the next month");
    binding.bindPremiumPass(null);
  });

  await section("the PLUS chip", async () => {
    const [before] = await cosmetics.publicCosmeticsFor(admin, [JOE]);
    check(before?.plusMark === false, "off by default");
    const on = await callServerFn(fns.plusSetMarkFn, { on: true }, tok.joe);
    check(on.ok === true, "a member turns it on");
    const [after] = await cosmetics.publicCosmeticsFor(admin, [JOE]);
    check(after?.plusMark === true, "others see it");
    const mia = await callServerFn(fns.plusSetMarkFn, { on: true }, tok.mia);
    check(mia.ok === false && mia.reason === "not_member", "a tester without Plus can't turn it on");
  });

  await section("early access", async () => {
    const today = ukDayKey(Date.now());
    access.forgetEarlyAccessCache();
    check((await access.heldGamesFor(admin, KIM, Date.now())).length === 0, "nothing marked: nothing held back");
    q(`SELECT plus.mark_early_access('unblock', DATE '${today}', 'check: early access')`);
    access.forgetEarlyAccessCache();
    check(await access.heldBackFor(admin, "unblock", KIM, Date.now()), "a marked game is held back from a non-member");
    check(await access.heldBackFor(admin, "unblock", null, Date.now()), "and from a guest");
    check(await access.heldBackFor(admin, "unblock", MIA, Date.now()), "and from a tester without Plus");
    check(!(await access.heldBackFor(admin, "unblock", JOE, Date.now())), "never from a member");
    check(!(await access.heldBackFor(admin, "hover", KIM, Date.now())), "an unmarked game is never held back");
    const later = ukDayWindow(today).closesAt + 1000;
    access.forgetEarlyAccessCache();
    check(!(await access.heldBackFor(admin, "unblock", KIM, later)), "everyone plays it once its day ends");
    access.forgetEarlyAccessCache();
    const held = await callServerFn(fns.earlyAccessFn, {}, tok.kim);
    check(Array.isArray(held.held) && held.held.includes("unblock"), "earlyAccessFn: the Practice list hides it for a non-member");
    access.forgetEarlyAccessCache();
    const open = await callServerFn(fns.earlyAccessFn, {}, tok.joe);
    check(Array.isArray(open.held) && open.held.length === 0, "and shows it to a member");
    check(q(`SELECT plus.clear_early_access('unblock', 'check done')`) === "cleared", "Joe clears the mark");
    access.forgetEarlyAccessCache();
  });

  await section("the Daily archive", async () => {
    const now = Date.now();
    const yesterday = shiftDayKey(ukDayKey(now), -1);
    const yMs = ukDayWindow(yesterday).opensAt + 3600_000;
    const source = await daily.ensureDailyRoom(admin, "arcade", yMs, KIM);
    // KIM plays yesterday's Daily for real (one round), so the day has a board and a history.
    const ks = await engine.startAttempt(admin, source, KIM, { name: "Kim_Free", colour: null, icon: null }, yMs);
    check(ks.ok, "a player started yesterday's Daily (the control)");
    const list = await callServerFn(fns.dailyArchiveFn, {}, tok.joe);
    check(list.ok === true && list.days.some((d: { day: string; kind: string; available: boolean }) => d.day === yesterday && d.kind === "arcade" && d.available), "a member sees yesterday's Daily Arcade in the archive");
    check(list.ok === true && !list.days.some((d: { day: string }) => d.day === ukDayKey(now)), "today's Daily is never in the archive");
    const tooOld = await callServerFn(fns.dailyArchiveStartFn, { kind: "arcade", day: shiftDayKey(ukDayKey(now), -31) }, tok.joe);
    check(tooOld.ok === false, "a day past the archive's 30 is refused");
    const todayStart = await callServerFn(fns.dailyArchiveStartFn, { kind: "arcade", day: ukDayKey(now) }, tok.joe);
    check(todayStart.ok === false, "today's Daily can't be replayed (play it)");
    const started = await callServerFn(fns.dailyArchiveStartFn, { kind: "arcade", day: yesterday }, tok.joe);
    check(started.ok === true, "a member replays yesterday's Daily Arcade");
    const room = await engine.roomById(admin, started.roomId);
    check(room?.kind === "daily_archive", "in a room of its own (daily_archive)");
    const sorted = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sorted(x)])) : v;
    check(JSON.stringify(sorted(room?.puzzles_public)) === JSON.stringify(sorted(source.puzzles_public)) && room?.seed === source.seed, "with the day's stored rounds exactly");
    const privSource = q(`SELECT puzzles_private::text FROM async_room_secrets WHERE room_id = '${source.id}'`);
    const privCopy = q(`SELECT puzzles_private::text FROM async_room_secrets WHERE room_id = '${started.roomId}'`);
    check(privSource === privCopy, "and their private halves");
    const again = await callServerFn(fns.dailyArchiveStartFn, { kind: "arcade", day: yesterday }, tok.joe);
    check(again.ok === true && again.roomId === started.roomId && again.created === false, "starting again continues the same replay");
    check((await events("daily_archive_played", JOE)) === 1, "daily_archive_played once");
    check((await events("daily_started", JOE)) === 0, "never a daily_started");
    check(q(`SELECT props ->> 'archive' FROM analytics.events WHERE event = 'daily_archive_played' AND player_id = '${JOE}'`) === "true", "daily_archive_played is marked archive: true");
    // Play a round and store a 200 (the round engine's own path, then the score set as a top run would).
    const attempt = await engine.attemptFor(admin, started.roomId, JOE);
    const r1 = await engine.startAsyncRound(admin, room!, attempt!, 1, Date.now());
    check(r1.ok, "the replay's first round starts");
    await flushAnalytics();
    check(
      q(`SELECT count(*) FROM analytics.events WHERE event = 'game_started' AND player_id = '${JOE}' AND mode = 'daily' AND props ->> 'archive' = 'true'`) === "1",
      "the replay's game_started keeps the daily mode and is marked archive: true",
    );
    q(`UPDATE async_results SET answered = true, answered_at = now(), score = 200, is_correct = true, ms_remaining = 500 WHERE room_id = '${started.roomId}' AND user_id = '${JOE}' AND round_number = 1`);
    const board = await daily.dailyBoard(admin, "arcade", yesterday, JOE, Date.now());
    check(board.me === null && !board.rows.some((r) => r.name === "Joe_Plus"), "never on that day's board");
    check(q(`SELECT count(*) FROM public.daily_history('${JOE}')`) === "0", "never in the streak (daily_history)");
    check(q(`SELECT count(*) FROM public.daily_history('${KIM}')`) === "1", "control: a real Daily is in it");
    const facts = JSON.parse(q(`SELECT public.badge_facts('${JOE}', '{}'::jsonb)::text`)) as { games200: number };
    check(facts.games200 === 0, "never counts for a badge (a 200 on the replay: games200 stays 0)");
    // Control: the same 200 on a real Daily round does count, so the condition is what keeps it out.
    const kr = await engine.startAsyncRound(admin, source, ks.ok ? ks.attempt : attempt!, 1, yMs + 1000);
    check(kr.ok, "the control's round starts");
    q(`UPDATE async_results SET answered = true, answered_at = now(), score = 200, is_correct = true, ms_remaining = 500 WHERE room_id = '${source.id}' AND user_id = '${KIM}' AND round_number = 1`);
    await flushAnalytics();
    check(
      q(`SELECT count(*) FROM analytics.events WHERE event = 'game_started' AND player_id = '${KIM}' AND (props ->> 'archive') IS NULL`) === "1",
      "control: a real Daily's game_started has no archive mark",
    );
    const kfacts = JSON.parse(q(`SELECT public.badge_facts('${KIM}', '{}'::jsonb)::text`)) as { games200: number };
    check(kfacts.games200 === 1, "control: a 200 on a real Daily does count");
    const joules = (id: string) => q(`SELECT public.pass_activity('${id}', now() - interval '3 days', now() + interval '1 day')::text`);
    check(!/challenge|async_round/.test(joules(JOE)), "never Joules (D2's pass_activity leaves the replay out)");
    check(/daily_arcade_round/.test(joules(KIM)), "control: a real Daily's round earns Joules");
    check(engine.solutionLockFor(room!, { type: "x", answer: "y" }, Date.now()) === null, "a replay's solutions are never locked");
  });

  await section("flagged runs never count for badges or Joules", async () => {
    // Joe, 11 Nov 2026: a run the server flagged (extra.flagged true in its stored grade) never counts towards any badge
    // or any Joules: rooms (live and archived), the Daily; Practice already leaves flagged plays out. The other player in
    // the same room keeps every clean run of their own.
    q(`SELECT public.create_profile('${RIA}', 'Ria_Flag', 7::smallint, DATE '1991-01-01', NULL)`);
    q(`SELECT public.create_profile('${SAM}', 'Sam_Clean', 8::smallint, DATE '1991-01-01', NULL)`);
    const facts = (id: string) => JSON.parse(q(`SELECT public.badge_facts('${id}', '{}'::jsonb)::text`)) as { games200: number };
    const acts = (id: string) =>
      JSON.parse(q(`SELECT public.pass_activity('${id}', now() - interval '1 day', now() + interval '1 day')::text`)) as { k: string; key: string }[];
    const room = (n: number) => {
      const id = uid(9100 + n);
      q(`INSERT INTO public.duels (id, room_code, host_user_id, status, round_order) VALUES ('${id}', 'FL${n}A', '${SAM}', 'finished', '["pinball"]'::jsonb)`);
      q(`INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name) VALUES ('${id}', 1, '${RIA}', 'Ria'), ('${id}', 2, '${SAM}', 'Sam')`);
      return id;
    };
    const result = (duel: string, slot: number, score: number, flagged: boolean) =>
      q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, is_correct, ms_remaining, submitted_at, extra) VALUES
         ('${duel}', ${slot}, 1, ${score}, true, 0, now(), '${JSON.stringify(flagged ? { flagged: true, endedSeconds: 60 } : { flagged: false, endedSeconds: 60 })}'::jsonb)`);
    // A room: Ria's run flagged at 200, Sam's clean 200 in the same room.
    const r1 = room(1);
    result(r1, 1, 200, true);
    result(r1, 2, 200, false);
    check(facts(RIA).games200 === 0, "a flagged room run at 200 earns no Flawless progress");
    check(!acts(RIA).some((a) => a.k === "room_round" || a.k === "room_finish"), "nor any room Joules (its round or the room's finish)");
    check(facts(SAM).games200 === 1, "the other player's own clean 200 in the same room still counts for Flawless");
    check(acts(SAM).filter((a) => a.k === "room_round").length === 1 && acts(SAM).some((a) => a.k === "room_finish" && a.key.includes(r1)), "and their round and finish Joules");
    // Archived by Play again: the same rule.
    q(`INSERT INTO public.round_results_archive (id, duel_id, game_index, player_slot, user_id, round_number, game_id, score, is_correct, ms_remaining, time_limit_ms, submitted_at, extra)
       VALUES (gen_random_uuid(), '${r1}', 0, 1, '${RIA}', 1, 'pinball', 200, true, 0, NULL, now(), '{"flagged": true}'::jsonb)`);
    check(facts(RIA).games200 === 0 && !acts(RIA).some((a) => a.k === "room_round"), "an archived flagged run counts for neither");
    // A Daily: Ria's Daily Arcade round flagged at 200.
    const today = ukDayKey(Date.now());
    const dailyAttempt = (who: string, day: string, flagged: boolean) => {
      const roomId = q(`INSERT INTO async_rooms (kind, room_key, day, seed, round_order, round_count, opens_at, closes_at) VALUES
        ('daily_arcade', 'daily_arcade:${day}:${who}', DATE '${day}', 1, '["pinball"]'::jsonb, 1, now() - interval '1 hour', now() + interval '1 hour') RETURNING id`).split("\n")[0]!.trim();
      const att = q(`INSERT INTO async_attempts (room_id, user_id, display_name, started_at, finished_at, rounds_done, total_score) VALUES
        ('${roomId}', '${who}', 'P', now() - interval '10 minutes', now() - interval '5 minutes', 1, 200) RETURNING id`).split("\n")[0]!.trim();
      q(`INSERT INTO async_results (room_id, attempt_id, user_id, round_number, started_at, answered, answered_at, is_correct, ms_remaining, score, extra) VALUES
        ('${roomId}', '${att}', '${who}', 1, now() - interval '10 minutes', true, now() - interval '6 minutes', true, 0, 200, '${JSON.stringify({ flagged })}'::jsonb)`);
      return roomId;
    };
    dailyAttempt(RIA, today, true);
    check(facts(RIA).games200 === 0, "a flagged Daily run at 200 earns no Flawless progress");
    check(!acts(RIA).some((a) => a.k.startsWith("daily_")), "nor any Daily Joules (its round or the Daily's 150)");
    // The same player's next clean runs count as normal.
    const r2 = room(2);
    result(r2, 1, 200, false);
    check(facts(RIA).games200 === 1, "her next clean room run at 200 counts for Flawless");
    check(acts(RIA).some((a) => a.k === "room_round") && acts(RIA).some((a) => a.k === "room_finish" && a.key.includes(r2)), "and earns its room Joules");
    dailyAttempt(RIA, shiftDayKey(today, -1), false);
    check(acts(RIA).some((a) => a.k === "daily_arcade") && acts(RIA).some((a) => a.k === "daily_arcade_round"), "her next clean Daily earns its Joules");
  });

  await section("Joe's functions", async () => {
    check(/note/.test(refused(`SELECT plus.remove_test_purchase('Joe_Plus', '')`)), "a note is required");
    check(q(`SELECT plus.remove_test_purchase('joe_plus', 'testing finished')`) === "removed", "remove_test_purchase ends a test membership (any capitals)");
    check(q(`SELECT plus.remove_test_purchase('Joe_Plus', 'twice')`) === "no_test_membership", "twice: nothing to end");
    const status = await callServerFn(fns.plusStatusFn, {}, tok.joe);
    check(status.member === null && status.open === true, "the tester no longer has Plus");
    const [joe] = await cosmetics.publicCosmeticsFor(admin, [JOE]);
    check(joe?.plusMark === false, "the PLUS chip goes with it");
    const arch = await callServerFn(fns.dailyArchiveFn, {}, tok.joe);
    check(arch.ok === false, "nor the archive");
    check(/add them|not_tester/.test(refused(`SELECT plus.start_test('Kim_Free', 'yearly', 'not a tester')`)), "start_test refuses a non-tester");
    check(q(`SELECT plus.start_test('Mia_Plus', 'yearly', 'testing yearly') ->> 'status'`) === "started", "start_test starts a tester's yearly Plus");
    check(q(`SELECT string_agg(username || ':' || plan || ':' || test || ':' || (ended_at IS NULL), ',' ORDER BY started_at) FROM plus.list_members()`) === "Joe_Plus:monthly:true:false,Mia_Plus:yearly:true:true", "list_members");
    check(q(`SELECT count(*) FROM plus.admin_log WHERE note = '' OR by_role IS NULL`) === "0" && Number(q(`SELECT count(*) FROM plus.admin_log`)) >= 5, "every change is logged with who and why");
    // D2's own function (wave 2 D2's pass_grant_premium through grantPremiumTrack): once a season is shown to the
    // member, Plus gives its premium track with source 'plus', once.
    q(`UPDATE pass_seasons SET starts_at = now() - interval '1 day' WHERE id = 'test'`);
    const s1 = await plus.plusStatus(admin, MIA, Date.now());
    const s2 = await plus.plusStatus(admin, MIA, Date.now());
    check(s1.premiumPass && s2.premiumPass, "the premium pass reaches a member through D2's function");
    check(q(`SELECT source || ':' || count(*) OVER () FROM pass_premium WHERE user_id = '${MIA}'`) === "plus:1", "one premium track, source plus");
    check((await events("pass_bought", MIA)) === 1, "D2 records its pass_bought once");
  });

  await section("taking test rewards back", async () => {
    // Joe's one call (13 Nov 2026): every coin and streak freeze a test membership paid, for one account or all.
    const joeCoins = plusCoins(JOE);
    const joeFreezes = plusFreezes(JOE);
    const wallet = (id: string) => Number(q(`SELECT coalesce((SELECT balance FROM coin_wallets WHERE user_id = '${id}'), 0)`));
    const freezes = (id: string) => Number(q(`SELECT coalesce((SELECT count FROM consumable_balances WHERE user_id = '${id}' AND kind = 'streak_freeze'), 0)`));
    const before = { coins: wallet(JOE), freezes: freezes(JOE) };
    check(/note/.test(refused(`SELECT plus.remove_test_rewards('')`)), "a note is required");
    const lines = Number(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${JOE}' AND reason = 'plus_test_monthly'`));
    const one = JSON.parse(q(`SELECT plus.remove_test_rewards('clean one tester', 'Joe_Plus')::text`)) as Record<string, number>;
    check(one["coins"] === joeCoins && one["freezes"] === joeFreezes && one["coin_lines"] === lines && one["freeze_lines"] === lines && lines === 5, `one account's test rewards taken back (${JSON.stringify(one)})`);
    check(wallet(JOE) === before.coins - joeCoins && freezes(JOE) === before.freezes - joeFreezes, "its balances drop by exactly those");
    check(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${JOE}' AND reason = 'plus_test_removed'`) === String(lines), "a removal line per test line (never an edited balance)");
    const again = JSON.parse(q(`SELECT plus.remove_test_rewards('again', 'Joe_Plus')::text`)) as Record<string, number>;
    check(again["coins"] === 0 && again["freezes"] === 0, "twice: nothing more is taken");
    const miaHad = plusCoins(MIA);
    const all = JSON.parse(q(`SELECT plus.remove_test_rewards('clean every tester before launch')::text`)) as Record<string, number>;
    check(miaHad > 0 && all["coins"] === miaHad, `one call for everyone takes the rest (${JSON.stringify(all)})`);
    check(q(`SELECT count(*) FROM coin_ledger l WHERE reason = 'plus_test_monthly' AND NOT EXISTS (SELECT 1 FROM coin_ledger x WHERE x.idempotency_key = 'plus_test_removed:' || l.id)`) === "0", "no test reward left anywhere");
    check(q(`SELECT count(*) FROM plus.admin_log WHERE action = 'remove_test_rewards'`) === "3", "each call logged");
    for (const role of ["anon", "authenticated", "service_role"])
      check(!!refused(`SET LOCAL ROLE ${role}; SELECT plus.remove_test_rewards('x')`), `remove_test_rewards: not reachable as ${role}`);
  });

  await section("the public cosmetics and reactions", async () => {
    for (const item of ["reaction.banter", "avatar-finish.chrome", "celebration.power-surge", "celebration.circuit-overload", "tile-style.blueprint"])
      q(`SELECT economy.grant_item('Mia_Plus', '${item}', 'check: cosmetics')`);
    const equip = async (slot: string, item: string | null) => (await admin.rpc("economy_equip", { p_user_id: MIA, p_slot: slot, p_item_id: item })).data;
    check((await equip("reaction-1", "reaction.banter")) === "equipped", "a reaction pack in a reaction slot");
    await equip("avatar-finish", "avatar-finish.chrome");
    await equip("celebration", "celebration.power-surge");
    await equip("podium-entrance", "celebration.circuit-overload");
    await equip("tile-style", "tile-style.blueprint");
    const [mia] = await cosmetics.publicCosmeticsFor(admin, [MIA]);
    check(
      mia?.finish === "avatar-finish.chrome" && mia.celebration === "celebration.power-surge" && mia.entrance === "celebration.circuit-overload" && mia.reactions.join() === "reaction.banter",
      "everyone sees what the owner equipped",
    );
    check(mia?.avatar?.id === "captain-joulz" && mia.avatar.colour === 6, "with the avatar their card draws");
    const kimEquip = (await admin.rpc("economy_equip", { p_user_id: KIM, p_slot: "reaction-1", p_item_id: "reaction.banter" })).data;
    check(kimEquip === "not_owned", "a pack nobody gave you can't be equipped (A1's rule)");
    check(await cosmetics.canSendPack(admin, MIA, "reaction.banter"), "the owner may send its emotes");
    check(!(await cosmetics.canSendPack(admin, KIM, "reaction.banter")), "anyone else may not");
    check(!(await cosmetics.canSendPack(admin, MIA, "reaction.live-wire")), "nor a pack not equipped");
    const guest = await cosmetics.publicCosmeticsFor(admin, [NED, "not-a-uuid"]);
    check(guest.length === 0, "a guest (and a bad id) has none");
    const [kim] = await cosmetics.publicCosmeticsFor(admin, [KIM]);
    check(!!kim && !kim.finish && !kim.celebration && !kim.entrance && kim.reactions.length === 0 && !kim.plusMark, "an account with nothing equipped: nothing");
  });
}

/* ------------------------------------------------------------------ run */

await pureChecks();
neutralityChecks();
await copiesChecks();

let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`plus-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`plus-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

try {
  db = startLocalDb("plus-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES
    ('${JOE}', false, 'joe@example.com'), ('${KIM}', false, 'kim@example.com'), ('${MIA}', false, 'mia@example.com'), ('${NED}', true, NULL),
    ('${RIA}', false, 'ria@example.com'), ('${SAM}', false, 'sam@example.com')`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `database checks threw: ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`plus-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
