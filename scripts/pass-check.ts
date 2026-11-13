/**
 * pass-check (wave 2, train D, session D2, 13 Nov 2026; docs/economy/pass.md): the Season pass, Joules and the weekly
 * challenges, through the pure rules (src/lib/pass/), the real server functions (pass.functions.ts) and the real
 * migrations on a local PostgreSQL 16 with the server-function harness's PostgREST / GoTrue stand-in.
 *
 * What it proves:
 * - both tracks match the economy doc's tables (docs/economy/economy-design.md) and catalogue.json's pass levels, level
 *   by level: 30 free and 60 premium rewards, 1,000 and 1,500 coins, the tickets, freezes, titles and 40 items;
 * - levels: 1,000 Joules a level, 60 levels; the soft cap and the day limits (pure and in the database's own
 *   arithmetic, across a UK day boundary in winter and in summer time);
 * - over a simulated year of Mondays: one Easy, one Medium and one Hard every week, never a tournament challenge and
 *   an R challenge only while rated play is on for everyone (wave 3 W3a, 11 Nov 2026, Joe's approval),
 *   three different categories each week and many over the year, the same picks however asked; the pool is the doc's 45;
 * - every Joules source pays the right amount once per stored event (rooms live and after Play again's archive, the
 *   Daily Puzzle and Arcade, friend challenges with the first five a day, copied room attempts left out, Practice 20 up
 *   to 200 a day and nothing before C1a's fresh start, a Practice challenge's first completion, weekly challenges);
 * - claiming: only reached levels, premium only with the premium track, claiming twice (even at once) pays once, a late
 *   test purchase unlocks exactly the passed premium rewards and the helmet at once, everything claimed at level 60
 *   pays exactly the doc's totals;
 * - non-testers and guests are refused by every pass function; test purchases are marked and removable; the season's
 *   dates come only from Joe's functions; the test season starts, resets (one tester or all) and ends, all logged;
 *   E2's premium grant is idempotent; anon and authenticated can't write Joules, levels, claims or weekly progress;
 * - the four analytics events; the check-only override is ignored in production builds.
 *
 * Needs the PostgreSQL 16 binaries for the database part (preinstalled on GitHub's runners). Without them it fails on
 * CI and prints a NOTE locally. No browser.
 */

import { RATED_PLAY_FOR_EVERYONE } from "../src/config/ratedConfig";
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
  if (/^\s*(FAIL|NOTE)|^pass-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

interface JsonItem {
  id: string;
  name: string;
  source: string;
  pass_level: number | null;
}
const ITEMS = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: JsonItem[] }).items;
const DOC = readFileSync("docs/economy/economy-design.md", "utf8");

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const JOE = uid(41); // tester
const MIA = uid(42); // tester (E2's grant)
const KIM = uid(43); // an account, not a tester
const NED = uid(44); // a guest
const LEO = uid(45); // an account for the database's own arithmetic

await pureChecks();

let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`pass-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`pass-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

try {
  db = startLocalDb("pass-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES
    ('${JOE}', false, 'joe@example.com'), ('${MIA}', false, 'mia@example.com'), ('${KIM}', false, 'kim@example.com'),
    ('${NED}', true, NULL), ('${LEO}', false, 'leo@example.com')`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`pass-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the Season pass, Joules, claiming and the weekly challenges hold.");
process.exit(0);

/* =================================================================== pure rules */

/** The economy doc's track table under a heading: level → reward text. */
function docTrack(heading: string): Map<number, string> {
  const start = DOC.indexOf(heading);
  const end = DOC.indexOf("\n## ", start + heading.length);
  const out = new Map<number, string>();
  for (const line of DOC.slice(start, end).split("\n")) {
    const m = /^\| \**(\d+)\**\s*\| \**(.+?)\**\s*\| \**(.+?)\**\s*\|$/.exec(line.trim());
    if (m) out.set(Number(m[1]), m[2]!.trim());
  }
  return out;
}

async function pureChecks(): Promise<void> {
  const rw = await import("../src/lib/pass/rewards");
  const jl = await import("../src/lib/pass/joules");
  const wk = await import("../src/lib/pass/weekly");

  /* ------------------------------------------------------------- the two tracks */
  const free = docTrack("## Season 1 \"Neon Circuit\" pass: free track");
  const premium = docTrack("## Season 1 pass: premium track");
  check(free.size === 30 && premium.size === 60, `the doc's tables read: free ${free.size}, premium ${premium.size}`);
  const nameOf = new Map(ITEMS.map((i) => [i.id, i.name]));
  const mismatch: string[] = [];
  for (const [track, table] of [["free", free], ["premium", premium]] as const) {
    for (let level = 1; level <= 60; level++) {
      const text = table.get(level);
      const reward = rw.rewardAt(track, level);
      if (!text) {
        if (reward) mismatch.push(`${track} ${level}: a reward the doc doesn't list`);
        continue;
      }
      if (!reward) {
        mismatch.push(`${track} ${level}: missing`);
        continue;
      }
      const ok =
        (reward.kind === "coins" && text === `${reward.coins} coins`) ||
        (reward.kind === "freeze" && text === "Streak freeze") ||
        (reward.kind === "ticket" &&
          text === `Tournament ticket (${reward.ticket === "ticket_score_attack" ? "Score Attack" : "Category Cup"})`) ||
        (reward.kind === "title" && text === `Title: ${rw.PASS_TITLES[reward.title]}`) ||
        (reward.kind === "item" && (() => {
          const name = (nameOf.get(reward.item) ?? "\u0000").replace(/^.*?: /, "");
          return text.toLowerCase().includes(name.toLowerCase());
        })());
      if (!ok) mismatch.push(`${track} ${level}: "${text}" vs ${JSON.stringify(reward)}`);
    }
  }
  check(mismatch.length === 0, `both tracks match the economy doc level by level (${mismatch.slice(0, 4).join("; ") || "all match"})`);
  const passItems = ITEMS.filter((i) => i.source === "pass-free" || i.source === "pass-premium");
  const itemsOff = passItems.filter((i) => {
    const r = rw.rewardAt(i.source === "pass-free" ? "free" : "premium", i.pass_level ?? 0);
    return !r || r.kind !== "item" || r.item !== i.id;
  });
  const itemRewards = rw.PASS_REWARDS.filter((r) => r.reward.kind === "item");
  check(passItems.length === 40 && itemsOff.length === 0 && itemRewards.length === 40, `catalogue.json's 40 pass items sit at their pass levels (${itemsOff.map((i) => i.id).join(", ") || "all"})`);
  const sum = (track: "free" | "premium", f: (r: (typeof rw.PASS_REWARDS)[number]["reward"]) => number) =>
    rw.PASS_REWARDS.filter((r) => r.track === track).reduce((n, r) => n + f(r.reward), 0);
  const coins = (r: (typeof rw.PASS_REWARDS)[number]["reward"]) => (r.kind === "coins" ? r.coins : 0);
  const is = (k: string, t?: string) => (r: (typeof rw.PASS_REWARDS)[number]["reward"]) => (r.kind === k && (!t || (r.kind === "ticket" && r.ticket === t)) ? 1 : 0);
  check(sum("free", coins) === 1000 && sum("premium", coins) === 1500, "1,000 coins on the free track, 1,500 on the premium");
  check(sum("free", is("ticket", "ticket_score_attack")) === 4 && sum("free", is("ticket", "ticket_category_cup")) === 2, "free: four Score Attack and two Category Cup tickets");
  check(sum("premium", is("ticket", "ticket_score_attack")) === 5 && sum("premium", is("ticket", "ticket_category_cup")) === 3, "premium: five Score Attack and three Category Cup tickets");
  check(sum("free", is("freeze")) === 3 && sum("premium", is("freeze")) === 6, "three and six streak freezes");
  check(rw.rewardAt("free", 40)?.kind === "title" && rw.rewardAt("premium", 55)?.kind === "title", "Neon Rider (free 40) and Circuit Breaker (premium 55)");
  check(rw.PASS_REWARDS.filter((r) => r.track === "free").every((r) => r.level % 2 === 0), "free rewards every second level");
  const helmet = rw.rewardAt("premium", 1);
  check(helmet?.kind === "item" && helmet.item === "avatar-special-edition.neon-captain-joulz" && rw.PREMIUM_ON_PURCHASE_LEVEL === 1, "the Neon Captain Joulz helmet is premium level 1, on purchase");
  check(rw.reached("premium", 1, 0, true) && !rw.reached("premium", 1, 0, false) && !rw.reached("premium", 2, 1, true) && rw.reached("premium", 2, 2, true), "reached: premium needs the track; the helmet at level 0 with it");

  /* ------------------------------------------------------------- levels and Joules arithmetic */
  check(rw.JOULES_PER_LEVEL === 1000 && rw.PASS_LEVELS === 60, "1,000 Joules a level, 60 levels");
  check(rw.levelFor(999) === 0 && rw.levelFor(1000) === 1 && rw.levelFor(12_430) === 12 && rw.levelFor(60_000) === 60 && rw.levelFor(99_000) === 60, "levels from Joules");
  const lp = rw.levelProgress(12_430);
  check(lp.level === 12 && lp.into === 430 && lp.of === 1000, "level 12, 430 / 1,000 (the mockup)");
  check(jl.JOULES.daily_puzzle === 150 && jl.JOULES.daily_arcade === 150 && jl.JOULES.room_round === 20 && jl.JOULES.room_finish === 50 && jl.JOULES.challenge === 100 && jl.JOULES.practice === 20 && jl.JOULES.practice_challenge === 100, "the economy doc's amounts");
  check(jl.WEEKLY_JOULES.easy === 500 && jl.WEEKLY_JOULES.medium === 750 && jl.WEEKLY_JOULES.hard === 1250, "weekly 500, 750, 1,250");
  check(jl.softCapped(3990, 20) === 15 && jl.softCapped(4000, 150) === 75 && jl.softCapped(0, 150) === 150 && jl.softCapped(3900, 100) === 100, "the soft cap halves past 4,000 (straddling too)");
  const twelve = jl.settleDay(Array.from({ length: 12 }, () => ({ kind: "practice" as const, base: 20 })));
  check(twelve.reduce((a, b) => a + b, 0) === 200 && twelve[10] === 0, "Practice: 20 a game up to 200 a day");
  const six = jl.settleDay(Array.from({ length: 6 }, () => ({ kind: "challenge" as const, base: 100 })));
  check(six.join() === "100,100,100,100,100,0", "friend challenges: the first five a day");
  check(jl.ratedMatchJoules({ won: true, long: false }) === 150 && jl.ratedMatchJoules({ won: false, long: true }) === 150 && jl.tournamentJoules({ kind: "arena_duel" }) === 100, "the wave 3 and 4 hooks' amounts");

  /* ------------------------------------------------------------- the weekly pool and a year of Mondays */
  const docPool: { tier: string; text: string; rated: boolean }[] = [];
  for (const [tier, heading] of [["easy", "**Easy, 500 Joules**"], ["medium", "**Medium, 750 Joules**"], ["hard", "**Hard, 1,250 Joules**"]] as const) {
    const start = DOC.indexOf(heading);
    const block = DOC.slice(start, DOC.indexOf("\n**", start + heading.length + 1) > 0 ? DOC.indexOf("\n**", start + heading.length + 1) : DOC.indexOf("\n## ", start));
    for (const line of block.split("\n")) {
      const m = /^\d+\. (.+)$/.exec(line.trim());
      if (m) docPool.push({ tier, text: m[1]!.replace(/ \(R\)$/, ""), rated: / \(R\)$/.test(m[1]!) });
    }
  }
  const norm = (t: string) => t.replace(/[’']/g, "'");
  const poolOff = wk.WEEKLY_POOL.filter((c, i) => !docPool[i] || norm(docPool[i]!.text) !== norm(c.text) || docPool[i]!.tier !== c.tier || docPool[i]!.rated !== (c.rule.k === "rated"));
  check(wk.WEEKLY_POOL.length === 45 && docPool.length === 45 && poolOff.length === 0, `the pool is the doc's 45, R marks included (${poolOff.map((c) => c.id).join(", ") || "all match"})`);
  const tournamentIds = wk.WEEKLY_POOL.filter((c) => /Score Attack|Arena/.test(c.text)).map((c) => c.id).sort();
  check(tournamentIds.join() === wk.WEEKLY_POOL.filter((c) => c.rule.k === "tournament").map((c) => c.id).sort().join() && tournamentIds.length === 3, "Score Attack and Arena challenges are the tournament ones");
  const firstMonday = wk.weekStartOf("2026-11-11");
  let monday = firstMonday;
  const tags = new Set<string>();
  const ids = new Set<string>();
  let bad = 0;
  let notDistinct = 0;
  for (let w = 0; w < 52; w++) {
    const set = wk.weeklySetFor(monday);
    const three = [set.easy, set.medium, set.hard].map((id) => wk.WEEKLY_BY_ID.get(id)!);
    // Approved by Joe for wave 3 W3a (11 Nov 2026): R challenges are drawable only while RATED_PLAY_FOR_EVERYONE is on.
    if (three[0]?.tier !== "easy" || three[1]?.tier !== "medium" || three[2]?.tier !== "hard" || three.some((c) => !wk.drawable(c) || (c.rule.k === "rated" && !RATED_PLAY_FOR_EVERYONE))) bad++;
    if (new Set(three.map((c) => c.tag)).size !== 3) notDistinct++;
    three.forEach((c) => {
      tags.add(c.tag);
      ids.add(c.id);
    });
    const again = wk.weeklySetFor(monday);
    if (JSON.stringify(again) !== JSON.stringify(set)) bad++;
    monday = wk.nextWeek(monday);
  }
  // Approved by Joe for wave 3 W3a (11 Nov 2026): "never an R challenge" now holds only while rated play is off for everyone.
  check(bad === 0, `52 Mondays: one Easy, one Medium, one Hard, never a tournament challenge, an R challenge only with rated play on for everyone (on: ${RATED_PLAY_FOR_EVERYONE}), the same picks however asked`);
  check(notDistinct === 0, "every week's three are in three different categories");
  check(tags.size >= 12 && ids.size === wk.WEEKLY_POOL.filter(wk.drawable).length, `over the year the sets spread: ${tags.size} categories, all ${ids.size} drawable challenges used`);
  // Approved by Joe for wave 3 W3a (11 Nov 2026): no drawn challenge needs rated play while it is off for everyone (R ones
  // once it is on); none ever needs friends.
  check(wk.WEEKLY_POOL.filter((c) => wk.drawableWith(c, false)).every((c) => c.rule.k !== "rated" && !/rated|friend/i.test(c.text)), "with rated play off, no drawn challenge needs rated play or friends");
  check(wk.WEEKLY_POOL.filter((c) => wk.drawable(c)).every((c) => (RATED_PLAY_FOR_EVERYONE || c.rule.k !== "rated") && !/friend/i.test(c.text)), "today's draw follows the switch (no R challenge while RATED_PLAY_FOR_EVERYONE is off), and none needs friends");
  // Rated play on for everyone (wave 3 W3a): the nine R challenges join the draw; tournaments still never.
  const rated = wk.WEEKLY_POOL.filter((c) => c.rule.k === "rated");
  check(rated.length === 9 && rated.every((c) => wk.drawableWith(c, true) && !wk.drawableWith(c, false)), "the nine R challenges are drawable exactly when rated play is on");
  check(wk.WEEKLY_POOL.filter((c) => c.rule.k === "tournament").every((c) => !wk.drawableWith(c, true)), "tournament challenges are never drawable (wave 4)");
  let onBad = 0;
  const onIds = new Set<string>();
  for (let w = 0, m = firstMonday; w < 104; w++, m = wk.nextWeek(m)) {
    const set = wk.weeklySetFor(m, wk.WEEKLY_POOL, true);
    const three = [set.easy, set.medium, set.hard].map((id) => wk.WEEKLY_BY_ID.get(id)!);
    if (three.some((c) => c.rule.k === "tournament") || new Set(three.map((c) => c.tag)).size !== 3) onBad++;
    if (JSON.stringify(wk.weeklySetFor(m, wk.WEEKLY_POOL, true)) !== JSON.stringify(set)) onBad++;
    three.forEach((c) => onIds.add(c.id));
  }
  check(onBad === 0 && rated.every((c) => onIds.has(c.id)), `with rated play on, two years of Mondays draw every R challenge, never a tournament one, three categories a week (${[...onIds].filter((id) => rated.some((c) => c.id === id)).length} of 9)`);

  /* ------------------------------------------------------------- progress (pure) */
  const g = (mode: string, game: string, category: string | null, score: number, day: string) => ({ mode, game, category, score, day }) as never;
  const act = {
    games: [
      g("daily_puzzle", "gridlock", "pattern", 160, "2026-11-10"),
      g("daily_puzzle", "gridlock", "pattern", 90, "2026-11-11"),
      g("daily_arcade", "pinball", "retro", 180, "2026-11-11"),
      g("practice", "kakuro", "number", 151, "2026-11-11"),
      g("practice", "kakuro", "number", 155, "2026-11-11"),
      g("room", "trail", "logic", 120, "2026-11-12"),
    ],
    stars: ["kakuro", "kakuro"],
    practiceChallenges: 1,
    playedBefore: new Set(["gridlock", "pinball", "trail"]),
  };
  const p = (id: string) => wk.progressOf(wk.WEEKLY_BY_ID.get(id)!, act);
  check(p("e1").done === 2 && p("e10").done === 1 && p("e4").done === 6 && p("e5").done === 4, "progress: Daily days, both Dailies on a day, games, categories");
  check(p("e6").done === 2 && p("m3").done === 1 && p("m5").done === 1 && p("m6").done === 1 && p("h4").done === 1, "progress: a new game's plays, distinct games, the Daily scores");
  check(p("m2").done === 1 && p("h2").done === 1 && p("m7").done === 1 && p("e13").done === 2, "progress: stars (distinct), Practice challenges, Practice games");
  // R challenges (wave 3 W3a): from the week's counted rated matches, in the order finished.
  const rm = (result: "win" | "loss" | "draw", bestOf: number | null, games: [string | null, boolean][]) => ({ result, bestOf, games: games.map(([category, won]) => ({ category, won })) }) as never;
  const ract = {
    ...act,
    rated: [
      rm("win", 3, [["logic", true], ["sports", true]]),
      rm("win", 3, [["logic", true], ["word", false], ["sports", true]]),
      rm("loss", 3, [["logic", false], ["sports", false]]),
      rm("win", 5, [["retro", true], ["logic", true], ["number", true]]),
      rm("win", null, [["sports", true]]),
      rm("win", 3, [["speed", true], ["logic", false], ["attention", true]]),
    ],
  };
  const pr = (id: string) => wk.progressOf(wk.WEEKLY_BY_ID.get(id)!, ract);
  check(pr("e3").done === 5 && pr("e3").need === 5 && pr("e12").done === 2 && pr("m4").done === 4 && pr("h3").done === 5, "R progress: matches played (capped at the need) and won");
  check(pr("m1").done === 3 && pr("m9").done === 3, "R progress: Sports and Logic games won in rated matches");
  check(pr("m12").done === 1, "R progress: a best of 3 won 2–0 (a 2–1 and a best of 5 don't count)");
  check(pr("h5").done === 3, "R progress: the longest run of wins in a row (a loss breaks it)");
  check(pr("h10").done === 4, "R progress: different categories won in, in matches won");
  check(wk.progressOf(wk.WEEKLY_BY_ID.get("e3")!, act).done === 0, "R progress: no rated matches, nothing done");
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const fns = await import("../src/lib/pass/pass.functions");
  const pass = await import("../src/lib/pass/pass.server");
  const jl = await import("../src/lib/pass/joules");
  const rw = await import("../src/lib/pass/rewards");
  const wk = await import("../src/lib/pass/weekly");
  const { ukDayWindow, ukDayKey, shiftDayKey } = await import("../src/lib/duel/daily");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = await adminDb();
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
  const events = async (event: string, player?: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}'${player ? ` AND player_id = '${player}'` : ""}`));
  };
  const balance = (id: string) => Number(q(`SELECT coalesce((SELECT balance FROM coin_wallets WHERE user_id = '${id}'), -1)`));
  const lines = (id: string, reason: string) => Number(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${id}' AND reason = '${reason}'`));
  const owns = (id: string, item: string) => q(`SELECT count(*) FROM inventory_items WHERE user_id = '${id}' AND item_id = '${item}'`) === "1";
  const consumable = (id: string, kind: string) => Number(q(`SELECT coalesce((SELECT count FROM consumable_balances WHERE user_id = '${id}' AND kind = '${kind}'), 0)`));
  const tok = { joe: accountToken(JOE), mia: accountToken(MIA), kim: accountToken(KIM), ned: userToken(NED), leo: accountToken(LEO) };
  const iso = (msv: number) => new Date(msv).toISOString();

  q(`SELECT public.create_profile('${JOE}', 'Joe_Pass', 3::smallint, DATE '1985-05-05', NULL)`);
  q(`SELECT public.create_profile('${MIA}', 'Mia_Pass', 6::smallint, DATE '1992-02-02', NULL)`);
  q(`SELECT public.create_profile('${KIM}', 'Kim_Plain', 4::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT public.create_profile('${LEO}', 'Leo_Sums', 5::smallint, DATE '1991-01-01', NULL)`);
  q(`SELECT shop.add_tester('Joe_Pass', 'pass testing')`);
  q(`SELECT shop.add_tester('Mia_Pass', 'pass testing')`);

  // The calendar the stored play sits on: last week (UK), entirely in the past.
  const nowMs = Date.now();
  const thisMonday = wk.weekStartOf(ukDayKey(nowMs));
  const lastMonday = shiftDayKey(thisMonday, -7);
  const at = (day: string, hhmm: string, plusDays = 0) => {
    const d = shiftDayKey(day, plusDays);
    const [h, m] = hhmm.split(":").map(Number) as [number, number];
    return ukDayWindow(d).opensAt + (h * 60 + m) * 60_000;
  };
  const seasonStart = ukDayWindow(lastMonday).opensAt;
  const D1 = shiftDayKey(lastMonday, 1);
  const D2 = shiftDayKey(lastMonday, 2);
  const SAT = shiftDayKey(lastMonday, 5);

  /* ------------------------------------------------------------- before any season: refusals */
  await section("refusals", async () => {
    const kim = await call(fns.getPassFn, undefined, tok.kim);
    check(kim?.open === false && kim.reason === "not_tester", "a non-tester's pass: not_tester");
    const ned = await call(fns.getPassFn, undefined, tok.ned);
    check(ned?.open === false && ned.reason === "guest", "a guest's pass: guest");
    const joe = await call(fns.getPassFn, undefined, tok.joe);
    check(joe?.open === false && joe.reason === "no_season", "a tester with no season started: no_season (Season 1 isn't started)");
    check((await call(fns.claimPassRewardFn, { track: "free", level: 2 }, tok.kim))?.ok === false, "a non-tester can't claim");
    const tp = await call(fns.testPremiumFn, undefined, tok.kim);
    check(tp?.ok === false && tp.reason === "not_tester", "a non-tester can't make a test purchase");
    check((await call(fns.passJoulesSinceFn, { sinceMs: nowMs - 60_000 }, tok.kim)) === null, "a non-tester gets no Joules line");
    check((await call(fns.passLevelSeenFn, { level: 1 }, tok.kim))?.ok === false, "a non-tester can't mark a level seen");
    check((await call(fns.testPremiumFn, undefined, tok.ned))?.ok === false && (await call(fns.claimPassRewardFn, { track: "free", level: 2 }, tok.ned))?.ok === false, "a guest is refused too");
  });

  /* ------------------------------------------------------------- the season's dates: Joe's functions only */
  await section("season dates", async () => {
    check(q(`SELECT pass.set_season_dates('s1', '${iso(seasonStart)}', NULL, 'check: Season 1 from last Monday')`) === "set", "pass.set_season_dates sets Season 1");
    check(/note/.test(refused(`SELECT pass.set_season_dates('s1', now(), NULL, '')`)), "a note is required");
    check(/test season/.test(refused(`SELECT pass.set_season_dates('test', now(), NULL, 'x')`)), "the test season's dates come from its own functions");
    check(/end after/.test(refused(`SELECT pass.set_season_dates('s1', now(), now() - interval '1 day', 'x')`)), "an end before the start is refused");
    for (const role of ["anon", "authenticated", "service_role"]) {
      check(/permission denied/.test(refused(`SET LOCAL ROLE ${role}; UPDATE public.pass_seasons SET starts_at = now()`)), `${role} can't write a season's dates`);
      check(/permission denied/.test(refused(`SET LOCAL ROLE ${role}; SELECT pass.start_test_season('x')`)), `${role} can't reach Joe's pass functions`);
    }
    const src = ["src/lib/pass/pass.server.ts", "src/lib/data/pass.server.ts"].map((f) => readFileSync(f, "utf8")).join("\n");
    check(!/pass_seasons"\)\s*\.(insert|update|upsert|delete)/.test(src) && !/set_season_dates|start_test_season/.test(src), "the app never writes a season (it only reads them)");
  });

  /* ------------------------------------------------------------- stored play → Joules */
  const games = { puzzle: "gridlock", arcade: "pinball", logic: "trail" };
  let roomId = "";
  await section("stored play", async () => {
    // C1a's fresh start on the live database is the deploy's moment; here it is Tuesday of last week.
    q(`UPDATE practice_progress_start SET fresh_start_at = '${iso(at(D1, "00:00"))}'`);
    // A room of three rounds, finished, on Tuesday (Joe in slot 1, Kim in slot 2).
    roomId = uid(9001);
    q(`INSERT INTO public.duels (id, room_code, host_user_id, status, round_order) VALUES ('${roomId}', 'PAS1', '${JOE}', 'finished', '${JSON.stringify([games.puzzle, games.arcade, games.logic])}'::jsonb)`);
    q(`INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name) VALUES ('${roomId}', 1, '${JOE}', 'Joe'), ('${roomId}', 2, '${KIM}', 'Kim')`);
    for (const r of [1, 2, 3])
      for (const slot of [1, 2])
        q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, is_correct, ms_remaining, submitted_at) VALUES ('${roomId}', ${slot}, ${r}, ${100 + r}, true, 1000, '${iso(at(D1, `10:0${r}`))}')`);
    // The Daily Puzzle on Tuesday (finished), the Daily Arcade on Wednesday (finished).
    const daily = (kind: string, day: string, game: string, score: number) => {
      const id = q(`INSERT INTO async_rooms (kind, room_key, day, seed, round_order, round_count, opens_at, closes_at) VALUES
        ('${kind}', '${kind}:${day}', DATE '${day}', 1, '${JSON.stringify([game])}'::jsonb, 1, '${iso(at(day, "00:00"))}', '${iso(at(day, "00:00", 1))}') RETURNING id`).split("\n")[0]!.trim();
      const att = q(`INSERT INTO async_attempts (room_id, user_id, display_name, started_at, finished_at, rounds_done, total_score) VALUES
        ('${id}', '${JOE}', 'Joe', '${iso(at(day, "12:00"))}', '${iso(at(day, "12:05"))}', 1, ${score}) RETURNING id`).split("\n")[0]!.trim();
      q(`INSERT INTO async_results (room_id, attempt_id, user_id, round_number, started_at, answered, answered_at, is_correct, ms_remaining, score) VALUES
        ('${id}', '${att}', '${JOE}', 1, '${iso(at(day, "12:00"))}', true, '${iso(at(day, "12:04"))}', true, 0, ${score})`);
    };
    daily("daily_puzzle", D1, games.puzzle, 160);
    daily("daily_arcade", D2, games.arcade, 120);
    // Six friend challenges finished on Tuesday (five pay), and one attempt copied in from a room (pays nothing).
    for (let i = 0; i < 7; i++) {
      const copied = i === 6;
      const id = q(`INSERT INTO async_rooms (kind, room_key, seed, round_order, round_count, opens_at, closes_at) VALUES
        ('challenge', 'challenge:PCH00${i}', 1, '${JSON.stringify([games.logic])}'::jsonb, 1, '${iso(at(D1, "13:00"))}', '${iso(at(D1, "13:00", 7))}') RETURNING id`).split("\n")[0]!.trim();
      q(`INSERT INTO challenges (room_id, code, created_by, source, source_duel_id, source_game_index, round_count, created_at, expires_at) VALUES
        ('${id}', 'PCHXZ${"ABCDEFG"[i]}', '${KIM}', '${copied ? "room" : "play"}', ${copied ? `'${roomId}'` : "NULL"}, ${copied ? 0 : "NULL"}, 1, '${iso(at(D1, "13:00"))}', '${iso(at(D1, "13:00", 7))}')`);
      const start = copied ? at(D1, "13:00") : at(D1, `14:0${i}`);
      q(`INSERT INTO async_attempts (room_id, user_id, display_name, started_at, finished_at, rounds_done, total_score) VALUES
        ('${id}', '${JOE}', 'Joe', '${iso(start)}', '${iso(start + 60_000)}', 1, 140)`);
    }
    // Practice: one run on Monday (before the fresh start: never counts), twelve on Tuesday (ten pay).
    const practice = (when: number, game: string, score: number) =>
      q(`INSERT INTO practice_plays (user_id, game_id, score, is_correct, created_at, progress_counted_at) VALUES ('${JOE}', '${game}', ${score}, true, '${iso(when)}', '${iso(when)}')`);
    practice(at(lastMonday, "12:00"), games.puzzle, 150);
    for (let i = 0; i < 12; i++) practice(at(D1, "15:00") + i * 60_000, i % 2 ? games.puzzle : games.logic, 130);
    // An example run and an uncounted run never pay.
    q(`INSERT INTO practice_plays (user_id, game_id, score, example, created_at, progress_counted_at) VALUES ('${JOE}', '${games.puzzle}', 100, true, '${iso(at(D2, "09:00"))}', '${iso(at(D2, "09:00"))}')`);
    q(`INSERT INTO practice_plays (user_id, game_id, score, created_at) VALUES ('${JOE}', '${games.puzzle}', 100, '${iso(at(D2, "09:01"))}')`);
    // Practice challenges completed: Tuesday and Saturday (100 each, first completion); stars on Saturday in two games.
    q(`INSERT INTO practice_challenge_progress (user_id, challenge_id, game_id, best, completed_at) VALUES
       ('${JOE}', '${games.puzzle}.check-one', '${games.puzzle}', 1, '${iso(at(D1, "16:00"))}'),
       ('${JOE}', '${games.logic}.check-two', '${games.logic}', 1, '${iso(at(SAT, "11:00"))}')`);
    q(`INSERT INTO practice_progress (user_id, game_id, level, best_score, star_at, star_score) VALUES
       ('${JOE}', '${games.puzzle}', 'classic', 180, '${iso(at(SAT, "11:30"))}', 180),
       ('${JOE}', '${games.logic}', 'classic', 182, '${iso(at(SAT, "11:40"))}', 182)`);
    // Last week's three, recorded before (as the server would have drawn and recorded them).
    q(`INSERT INTO pass_weeks (week_start, easy, medium, hard) VALUES ('${lastMonday}', 'e13', 'm7', 'h2')`);

    const view = await call(fns.getPassFn, undefined, tok.joe);
    check(view?.open === true && view.season.id === "s1" && view.season.name === "Neon Circuit", "Joe (tester) sees Season 1 once it has started");
    // Independently: Tuesday 3 rounds + finish, Daily Puzzle, 6 challenges (5 pay), 12 practice (10 pay), a Practice
    // challenge; Wednesday the Daily Arcade; Saturday a Practice challenge; the week's three weekly challenges.
    const tue = jl.settleDay([
      ...[1, 2, 3].map(() => ({ kind: "room_round" as const, base: 20 })),
      { kind: "room_finish", base: 50 },
      { kind: "daily_puzzle", base: 150 },
      ...Array.from({ length: 6 }, () => ({ kind: "challenge" as const, base: 100 })),
      ...Array.from({ length: 12 }, () => ({ kind: "practice" as const, base: 20 })),
      { kind: "practice_challenge", base: 100 },
    ]).reduce((a, b) => a + b, 0);
    const expected = tue + 150 + 100 + 500 + 750 + 1250;
    check(view?.open === true && view.joules === expected, `every source paid once: ${view?.open ? view.joules : "?"} Joules (expected ${expected})`);
    const byKind = (kind: string) => Number(q(`SELECT coalesce(sum(amount), 0) FROM pass_joules WHERE user_id = '${JOE}' AND season_id = 's1' AND kind = '${kind}'`));
    check(byKind("room_round") === 60 && byKind("room_finish") === 50, "a room: 20 a round played, 50 for finishing");
    check(byKind("daily_puzzle") === 150 && byKind("daily_arcade") === 150, "the Daily Puzzle and Daily Arcade: 150 each");
    check(byKind("challenge") === 500, "friend challenges: the first five a day (the copied room attempt pays nothing)");
    check(byKind("practice") === 200, "Practice: 20 a game up to 200; nothing before the fresh start, no example or uncounted run");
    check(Number(q(`SELECT count(*) FROM pass_joules WHERE user_id = '${JOE}' AND kind = 'practice'`)) === 12, "Practice runs before the fresh start aren't even recorded");
    check(byKind("practice_challenge") === 200, "a Practice challenge's first completion: 100 each");
    check(byKind("weekly") === 2500, "last week's three weekly challenges: 500 + 750 + 1,250");
    check(await events("weekly_challenge_completed", JOE) === 3, "weekly_challenge_completed recorded for each");
    check(q(`SELECT string_agg(props->>'tier' || ':' || (props->>'challenge'), ',' ORDER BY props->>'tier') FROM analytics.events WHERE event = 'weekly_challenge_completed'`) === "easy:e13,hard:h2,medium:m7", "with the tier and challenge id");

    const again = await call(fns.getPassFn, undefined, tok.joe);
    check(again?.open === true && again.joules === expected && Number(q(`SELECT count(*) FROM pass_joules WHERE user_id = '${JOE}'`)) === Number(q(`SELECT count(DISTINCT source_key) FROM pass_joules WHERE user_id = '${JOE}'`)), "reading the pass again pays nothing more");
    // Play again archives the room's results; they still count once.
    q(`SELECT public.restart_duel_room('${roomId}', '${JOE}')`);
    check(Number(q(`SELECT count(*) FROM round_results WHERE duel_id = '${roomId}'`)) === 0 && Number(q(`SELECT count(*) FROM round_results_archive WHERE duel_id = '${roomId}'`)) === 6, "Play again moved the room's rounds to the archive");
    const after = await call(fns.getPassFn, undefined, tok.joe);
    check(after?.open === true && after.joules === expected, "archived rounds and the finished game count once (no second payment)");

    // This week's three: drawn once from the week, recorded, the same for everyone.
    const set = wk.weeklySetFor(thisMonday);
    const rec = q(`SELECT easy || ',' || medium || ',' || hard FROM pass_weeks WHERE week_start = '${thisMonday}'`);
    check(rec === `${set.easy},${set.medium},${set.hard}`, `this week's picks recorded as drawn (${rec})`);
    check(after?.open === true && after.weekly?.weekStart === thisMonday && after.weekly.challenges.map((c) => c.id).join(",") === rec && after.weekly.challenges.map((c) => c.joules).join() === "500,750,1250", "the pass shows this week's three with their Joules");
    const weekLog = q(`SELECT pass.week('${shiftDayKey(lastMonday, 3)}')::text`);
    check(weekLog.includes('"easy": "e13"'), "Joe can check any week's picks (pass.week)");
  });

  /* ------------------------------------------------------------- the database's own arithmetic: day limits, soft cap, UK days */
  await section("soft cap and UK days", async () => {
    const credit = async (epoch: number, rows: { key: string; kind: string; base: number; at: string }[]) => {
      const { data, error } = await admin.rpc("pass_credit_joules", { p_user_id: LEO, p_season: "s1", p_epoch: epoch, p_rows: rows as never });
      if (error) throw new Error(error.message);
      return data as unknown as { key: string; status: string; amount: number }[];
    };
    // Winter: 199 room rounds (3,980) late on a day, a Daily (crossing 4,000: 20 + 65), a round after (10), then just
    // past UK midnight, a fresh day (full pay).
    const day = "2026-12-01";
    const late = ukDayWindow(day).opensAt + 23 * 3_600_000;
    const rows = Array.from({ length: 199 }, (_, i) => ({ key: `r:${i}`, kind: "room_round", base: 20, at: iso(late + i * 1000) }));
    rows.push({ key: "d:1", kind: "daily_puzzle", base: 150, at: iso(late + 300_000) });
    rows.push({ key: "r:x", kind: "room_round", base: 20, at: iso(late + 301_000) });
    rows.push({ key: "n:1", kind: "daily_arcade", base: 150, at: iso(ukDayWindow(shiftDayKey(day, 1)).opensAt + 30_000) });
    rows.push({ key: "w:1", kind: "weekly", base: 1250, at: iso(late + 302_000) });
    const out = await credit(1, rows);
    const amt = (k: string) => out.find((o) => o.key === k)?.amount;
    const pure = jl.settleDay([...rows.slice(0, 201)].map((r) => ({ kind: r.kind as never, base: r.base })));
    check(amt("d:1") === 85 && amt("r:x") === 10 && pure[199] === 85 && pure[200] === 10, `past 4,000 a day, half (the Daily 20 + 65 = ${amt("d:1")}, then ${amt("r:x")})`);
    check(amt("n:1") === 150, "just after UK midnight the next day starts again (full pay)");
    check(amt("w:1") === 1250, "weekly rewards are paid whole, outside the day's cap");
    const repeat = await credit(1, rows.slice(0, 3));
    check(repeat.every((o) => o.status === "duplicate" && o.amount === 0), "the same source event twice pays once");
    // Summer time: 23:30 UTC on 1 July is 00:30 on 2 July in the UK.
    const summer = await credit(2, [
      { key: "s:1", kind: "challenge", base: 100, at: "2026-07-01T22:30:00Z" },
      ...Array.from({ length: 5 }, (_, i) => ({ key: `s:${i + 2}`, kind: "challenge", base: 100, at: `2026-07-01T23:3${i}:00Z` })),
    ]);
    check(q(`SELECT string_agg(DISTINCT uk_day::text, ',') FROM pass_joules WHERE user_id = '${LEO}' AND epoch = 2`) === "2026-07-01,2026-07-02", "in summer time the UK day turns at 23:00 UTC");
    check(summer.every((o) => o.amount === 100), "five challenges either side of UK midnight all pay (the limit is per UK day)");
    const twelve = await credit(3, Array.from({ length: 12 }, (_, i) => ({ key: `p:${i}`, kind: "practice", base: 20, at: `2026-12-03T10:${String(i).padStart(2, "0")}:00Z` })));
    check(twelve.filter((o) => o.status === "limit").length === 2 && twelve.reduce((n, o) => n + o.amount, 0) === 200, "Practice limit in the database: 200 a day");
    // Two credits at once never pass a limit together.
    const [a, b] = await Promise.all([
      credit(4, Array.from({ length: 4 }, (_, i) => ({ key: `ca:${i}`, kind: "challenge", base: 100, at: `2026-12-04T10:0${i}:00Z` }))),
      credit(4, Array.from({ length: 4 }, (_, i) => ({ key: `cb:${i}`, kind: "challenge", base: 100, at: `2026-12-04T10:0${i}:30Z` }))),
    ]);
    check([...a, ...b].filter((o) => o.status === "credited").length === 5, "two batches at once: still five challenges paid");
  });

  /* ------------------------------------------------------------- the UK day the play happened, not the day it's credited */
  await section("UK day of play", async () => {
    const D3 = shiftDayKey(lastMonday, 3);
    // Kim (pass on for everyone) plays late on Wednesday: 18 rooms of 12 rounds (5,220 Joules before the cap), then 12
    // Practice runs from 23:50; two more just after midnight. She doesn't open the pass until Thursday morning.
    q(`DO $$
      DECLARE d uuid;
      BEGIN
        FOR i IN 1..18 LOOP
          d := gen_random_uuid();
          INSERT INTO public.duels (id, room_code, host_user_id, status, round_order)
          VALUES (d, 'Q' || lpad(i::text, 3, '0'), '${KIM}', 'finished', '${JSON.stringify(Array.from({ length: 12 }, () => games.logic))}'::jsonb);
          INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name) VALUES (d, 1, '${KIM}', 'Kim');
          FOR r IN 1..12 LOOP
            INSERT INTO public.round_results (duel_id, player_slot, round_number, score, is_correct, ms_remaining, submitted_at)
            VALUES (d, 1, r, 120, true, 0, '${iso(at(D2, "21:00"))}'::timestamptz + make_interval(secs => i * 60 + r));
          END LOOP;
        END LOOP;
      END $$`);
    for (let i = 0; i < 12; i++)
      q(`INSERT INTO practice_plays (user_id, game_id, score, is_correct, created_at, progress_counted_at) VALUES ('${KIM}', '${games.puzzle}', 120, true, '${iso(at(D2, "23:48") + i * 60_000)}', '${iso(at(D2, "23:48") + i * 60_000)}')`);
    for (let i = 0; i < 2; i++)
      q(`INSERT INTO practice_plays (user_id, game_id, score, is_correct, created_at, progress_counted_at) VALUES ('${KIM}', '${games.puzzle}', 120, true, '${iso(at(D3, "00:01") + i * 60_000)}', '${iso(at(D3, "00:01") + i * 60_000)}')`);
    const nextMorning = at(D3, "09:00");
    const view = await pass.passViewFor(admin, KIM, nextMorning, true);
    check(view.open === true, "Kim opens the pass the next morning");
    // Joules from play on a UK day (a weekly challenge's whole reward is outside the day's cap).
    const day = (d: string) => Number(q(`SELECT coalesce(sum(amount), 0) FROM pass_joules WHERE user_id = '${KIM}' AND season_id = 's1' AND uk_day = '${d}' AND kind <> 'weekly'`));
    const wedRooms = 216 * 20 + 18 * 50;
    const wedPractice = jl.settleDay(Array.from({ length: 12 }, () => ({ kind: "practice" as const, base: 20 }))).reduce((a, b) => a + b, 0);
    const wedTotal = wedRooms + wedPractice;
    check(day(D2) === 4000 + (wedTotal - 4000) / 2, `Wednesday's play counts on Wednesday: 4,000 then half (${day(D2)} of ${wedTotal})`);
    check(Number(q(`SELECT count(*) FROM pass_joules WHERE user_id = '${KIM}' AND kind = 'practice' AND uk_day = '${D2}' AND base > 0`)) === 10, "Wednesday's Practice limit: ten runs paid, though credited on Thursday");
    check(Number(q(`SELECT sum(amount) FROM pass_joules WHERE user_id = '${KIM}' AND kind = 'practice' AND uk_day = '${D2}'`)) === 100, "and those ten fall after Wednesday's 4,000, so earn half");
    check(day(D3) === 40 && q(`SELECT string_agg(amount::text, ',') FROM pass_joules WHERE user_id = '${KIM}' AND uk_day = '${D3}' AND kind <> 'weekly'`) === "20,20", "the two runs after midnight start Thursday afresh: full pay, their own limit");
    check(q(`SELECT count(*) FROM pass_joules WHERE user_id = '${KIM}' AND created_at::date <> uk_day AND uk_day = '${D2}'`) !== "0", "credited days later, still counted on the day of play");
    const later = await pass.passViewFor(admin, KIM, Date.now(), true);
    check(later.open === true && day(D2) === 4000 + (wedTotal - 4000) / 2 && day(D3) === 40, "opening it again later changes nothing");
  });

  /* ------------------------------------------------------------- claiming */
  await section("claiming", async () => {
    const view = await call(fns.getPassFn, undefined, tok.joe);
    const level = view?.open ? view.level : -1;
    check(level === rw.levelFor(view?.open ? view.joules : 0) && level >= 2 && level < 12, `Joe's level from his Joules (${level})`);
    check(await events("pass_level_reached", JOE) === level, `pass_level_reached once for each level reached (${level})`);
    check(view?.open === true && view.levelNotice === level, "the level-up notice is due");
    check((await call(fns.passLevelSeenFn, { level }, tok.joe))?.ok === true, "the notice marked seen");
    const seen = await call(fns.getPassFn, undefined, tok.joe);
    check(seen?.open === true && seen.levelNotice === null, "and not shown again");
    const before = balance(JOE);
    const c1 = await call(fns.claimPassRewardFn, { track: "free", level: 2 }, tok.joe);
    check(c1?.ok === true && balance(JOE) === before + 100, "free level 2 claimed: 100 coins");
    const c2 = await call(fns.claimPassRewardFn, { track: "free", level: 2 }, tok.joe);
    check(c2?.ok === true && balance(JOE) === before + 100 && lines(JOE, "pass_reward") === 1, "claiming twice pays once");
    const cell = c2?.ok ? c2.view.levels[1]!.free : null;
    check(cell?.state === "claimed", "the cell shows claimed");
    check((await call(fns.claimPassRewardFn, { track: "free", level: 40 }, tok.joe))?.ok === false, "a level not reached can't be claimed");
    const np = await call(fns.claimPassRewardFn, { track: "premium", level: 2 }, tok.joe);
    check(np?.ok === false && np.reason === "needs_premium", "premium rewards need the premium track");
    check((await call(fns.claimPassRewardFn, { track: "free", level: 3 }, tok.joe))?.ok === false, "a level with no free reward: nothing to claim");
    check(c2?.ok === true && c2.view.levels[3]!.free?.detail.includes("coming soon") === true, "tickets show as for tournaments, coming soon");

    // A late test purchase: the helmet at once, every passed premium reward claimable, nothing above.
    const tp = await call(fns.testPremiumFn, undefined, tok.joe);
    check(tp?.ok === true && tp.view.premium?.source === "test", "a tester's test purchase gives the premium track (marked test)");
    check(owns(JOE, "avatar-special-edition.neon-captain-joulz"), "the Neon Captain Joulz helmet arrives on purchase");
    const claimable = tp?.ok ? tp.view.levels.filter((l) => l.premium?.state === "claimable").map((l) => l.level) : [];
    check(claimable.join() === Array.from({ length: level - 1 }, (_, i) => i + 2).join(), `exactly the passed premium rewards unlock (${claimable.join(",")})`);
    check(tp?.ok === true && tp.view.levels[level]!.premium?.state === "locked", "the next premium level stays locked");
    check(await events("pass_bought", JOE) === 1 && q(`SELECT props->>'test' FROM analytics.events WHERE event = 'pass_bought' AND player_id = '${JOE}'`) === "true", "pass_bought recorded, marked test");
    // Two taps at once on the same reward (premium level 2: 100 coins).
    const coins2 = balance(JOE);
    const [x, y] = await Promise.all([
      call(fns.claimPassRewardFn, { track: "premium", level: 2 }, tok.joe),
      call(fns.claimPassRewardFn, { track: "premium", level: 2 }, tok.joe),
    ]);
    check(x?.ok === true && y?.ok === true && balance(JOE) === coins2 + 100 && Number(q(`SELECT count(*) FROM pass_claims WHERE user_id = '${JOE}' AND track = 'premium' AND level = 2`)) === 1, "two taps at once: 100 coins once, one claim");
    const again = await call(fns.testPremiumFn, undefined, tok.joe);
    check(again?.ok === false && again.reason === "already", "a second test purchase: already");
    check(q(`SELECT source FROM pass_premium WHERE user_id = '${JOE}' AND season_id = 's1'`) === "test", "stored as a test purchase");

    // To level 60 (a stand-in source), then claim everything: exactly the doc's totals.
    await admin.rpc("pass_credit_joules", {
      p_user_id: JOE,
      p_season: "s1",
      p_epoch: seasonStart,
      p_rows: Array.from({ length: 30 }, (_, i) => ({ key: `check:top:${i}`, kind: "weekly", base: 2000, at: iso(at(SAT, "12:00") + i) })) as never,
    });
    const top = await call(fns.getPassFn, undefined, tok.joe);
    check(top?.open === true && top.level === 60 && top.into === 1000, "level 60 is the last");
    check(await events("pass_level_reached", JOE) === 60, "pass_level_reached for every level to 60, once each");
    const coinsBefore = balance(JOE) - 200;
    for (const l of top?.open ? top.levels : [])
      for (const c of [l.free, l.premium]) if (c && c.state === "claimable") await call(fns.claimPassRewardFn, { track: c.track, level: c.level }, tok.joe);
    const done = await call(fns.getPassFn, undefined, tok.joe);
    check(done?.open === true && done.claimable === 0 && done.levels.every((l) => (!l.free || l.free.state === "claimed") && (!l.premium || l.premium.state === "claimed")), "every reward claimed");
    check(balance(JOE) - coinsBefore === 2500 && lines(JOE, "pass_reward") === 25, `coins: 1,000 + 1,500 (${balance(JOE) - coinsBefore})`);
    const passItems = rw.PASS_REWARDS.filter((r) => r.reward.kind === "item").map((r) => (r.reward as { item: string }).item);
    check(passItems.every((id) => owns(JOE, id)) && Number(q(`SELECT count(*) FROM inventory_items WHERE user_id = '${JOE}' AND how = 'pass'`)) === 40, "all 40 pass items owned (granted as pass items)");
    check(consumable(JOE, "ticket_score_attack") === 9 && consumable(JOE, "ticket_category_cup") === 5 && consumable(JOE, "streak_freeze") === 9, "tickets 9 + 5 and 9 streak freezes (A1's consumables)");
    check(q(`SELECT string_agg(title_id, ',' ORDER BY title_id) FROM pass_title_unlocks WHERE user_id = '${JOE}'`) === "circuit-breaker,neon-rider", "both pass titles unlocked");
    check(await events("reward_claimed", JOE) === 90 && Number(q(`SELECT count(*) FROM pass_claims WHERE user_id = '${JOE}'`)) === 90, "reward_claimed for each of the 90 claims, once");
    check(q(`SELECT count(*) FROM analytics.events WHERE event = 'reward_claimed' AND (props->>'track') IS NOT NULL AND (props->>'level') IS NOT NULL AND (props->>'kind') IS NOT NULL`) === "90", "with the track, level and kind");

    // The pass titles (Joe's approval, 11 Nov 2026): equippable once unlocked, never before.
    const badgeFns = await import("../src/lib/badges/badges.functions");
    // 34 → 41: follows the seven Season 1 frames and seven S1 titles (approved by Joe, 11 Nov 2026; wave 4 W4d).
    check(q(`SELECT string_agg(id || ':' || kind, ',' ORDER BY sort_order) FROM titles WHERE kind = 'pass'`) === "neon-rider:pass,circuit-breaker:pass" && q(`SELECT count(*) FROM titles`) === "41", "public.titles: the brief's 32, then Neon Rider and Circuit Breaker");
    const mine = await call(badgeFns.getMyBadges, undefined, tok.joe);
    check(mine?.account === true && (mine.passTitles ?? []).slice().sort().join() === "circuit-breaker,neon-rider", "Joe's badges list both pass titles as unlocked");
    const eq = await call(badgeFns.setMyTitle, { title: "neon-rider" }, tok.joe);
    check(eq?.ok === true && eq.badges.account === true && eq.badges.title === "neon-rider", "an unlocked pass title is equipped");
    check(q(`SELECT title FROM card_titles WHERE user_id = '${JOE}'`) === "neon-rider", "and shown on the card (card_titles)");
    const kimTitle = await call(badgeFns.setMyTitle, { title: "circuit-breaker" }, tok.kim);
    check(kimTitle?.ok === false && kimTitle.reason === "not_earned", "a pass title not unlocked is refused");
    const cards = (await call(badgeFns.getCardBadges, { playerIds: [JOE] }, tok.kim)) as { playerId: string; title: string }[] | undefined;
    check(cards?.find((c) => c.playerId === JOE)?.title === "neon-rider", "other players read the pass title on Joe's card");

    // Joe removes the test purchase: the track goes, what was claimed stays owned.
    check(q(`SELECT count(*) FROM pass.test_purchases('Joe_Pass') WHERE removed_at IS NULL`) === "1", "pass.test_purchases lists it");
    check(q(`SELECT pass.remove_test_purchase('Joe_Pass', 'end of the test round', 's1')`) === "removed", "pass.remove_test_purchase removes it");
    check(q(`SELECT pass.remove_test_purchase('Joe_Pass', 'again')`) === "none", "and only once");
    const gone = await call(fns.getPassFn, undefined, tok.joe);
    check(gone?.open === true && gone.premium === null && owns(JOE, "avatar-special-edition.neon-captain-joulz"), "the premium track is gone; claimed items stay");
    check(q(`SELECT removed_note FROM pass_premium WHERE user_id = '${JOE}'`) === "end of the test round", "marked removed with the note, never deleted");
  });

  /* ------------------------------------------------------------- E2: the premium track from another source */
  await section("E2's grant", async () => {
    const first = await pass.grantPremiumTrack(admin, { userId: MIA, seasonId: "s1", source: "plus", key: "plus:s1:check" });
    const second = await pass.grantPremiumTrack(admin, { userId: MIA, seasonId: "s1", source: "plus", key: "plus:s1:check-again" });
    check(first === "granted" && second === "already", "grantPremiumTrack is idempotent (granted, then already)");
    check(owns(MIA, "avatar-special-edition.neon-captain-joulz") && q(`SELECT source FROM pass_premium WHERE user_id = '${MIA}'`) === "plus", "the helmet arrives with it; stored as plus");
    check(await events("pass_bought", MIA) === 1 && q(`SELECT props->>'test' FROM analytics.events WHERE event = 'pass_bought' AND player_id = '${MIA}'`) === "false", "pass_bought once, not a test");
    check((await pass.grantPremiumTrack(admin, { userId: NED, seasonId: "s1", source: "plus", key: "plus:s1:ned" })) === "no_account", "a guest can't be granted it");
    check((await pass.grantPremiumTrack(admin, { userId: KIM, seasonId: "nope", source: "plus", key: "plus:x" })) === "unknown_season", "an unknown season is refused");
    const kimEnabled = await pass.passViewFor(admin, KIM, Date.now(), true);
    check(kimEnabled.open === true && kimEnabled.season.id === "s1" && kimEnabled.tester === false, "with the pass on for everyone, a non-tester sees Season 1 (and no test purchase)");
    const kimTest = await pass.testPurchase(admin, KIM, Date.now(), true);
    check(kimTest.ok === false && kimTest.reason === "not_tester", "test purchases stay testers only with the pass on");
  });

  /* ------------------------------------------------------------- the testers' season */
  await section("test season", async () => {
    check(q(`SELECT pass.start_test_season('testing the pass')`) === "started", "pass.start_test_season starts it");
    const joe = await call(fns.getPassFn, undefined, tok.joe);
    check(joe?.open === true && joe.season.id === "test" && joe.season.test === true && joe.joules === 0, "a tester now sees the test season, from zero (earlier play isn't in it)");
    const kim = await pass.passViewFor(admin, KIM, Date.now(), true);
    check(kim.open === true && kim.season.id === "s1", "a non-tester never sees the test season");
    const epoch = Number(q(`SELECT floor(extract(epoch FROM starts_at) * 1000)::bigint FROM pass_seasons WHERE id = 'test'`));
    await admin.rpc("pass_credit_joules", { p_user_id: JOE, p_season: "test", p_epoch: epoch, p_rows: [{ key: "check:t", kind: "weekly", base: 3000, at: iso(Date.now()) }] as never });
    const mid = await call(fns.getPassFn, undefined, tok.joe);
    check(mid?.open === true && mid.level === 3, "the test season fills like a real one");
    const mia = await call(fns.getPassFn, undefined, tok.mia);
    check(mia?.open === true && mia.joules === 0, "one tester's Joules are their own");

    // Test-season rewards are test rewards, and Joe takes them all back in one call.
    await admin.rpc("pass_credit_joules", { p_user_id: MIA, p_season: "test", p_epoch: epoch, p_rows: [{ key: "check:m", kind: "weekly", base: 41_000, at: iso(Date.now()) }] as never });
    const coinsBeforeTest = balance(MIA);
    for (const [track, level] of [["free", 2], ["free", 4], ["free", 6], ["free", 34], ["free", 40]] as const)
      await call(fns.claimPassRewardFn, { track, level }, tok.mia);
    check(balance(MIA) === coinsBeforeTest + 100 && lines(MIA, "test_pass_reward") === 1 && lines(MIA, "pass_reward") === 0, "test-season coins are paid as test rewards (reason test_pass_reward)");
    check(Number(q(`SELECT count(*) FROM consumable_ledger WHERE user_id = '${MIA}' AND reason = 'test_pass_reward'`)) === 2 && consumable(MIA, "ticket_score_attack") === 1 && consumable(MIA, "streak_freeze") === 1, "and its ticket and streak freeze too");
    check(owns(MIA, "frame.bronze") && q(`SELECT season_id FROM pass_title_unlocks WHERE user_id = '${MIA}' AND title_id = 'neon-rider'`) === "test", "an item and the Neon Rider title from the test season");
    const badgeFns = await import("../src/lib/badges/badges.functions");
    check((await call(badgeFns.setMyTitle, { title: "neon-rider" }, tok.mia))?.ok === true, "Mia equips the test season's title");
    q(`SELECT economy.grant_coins('Mia_Pass', 40, 'check: coins of her own')`);
    check(lines(JOE, "test_pass_reward") === 0 && lines(JOE, "pass_reward") === 25, "Season 1's rewards are never test rewards");
    const removed = JSON.parse(q(`SELECT pass.remove_test_season_rewards('clean-up before launch', 'Mia_Pass')`)) as Record<string, number>;
    check(removed["coins"] === 100 && removed["consumables"] === 2 && removed["items"] === 1 && removed["titles"] === 1, `pass.remove_test_season_rewards takes the coins, consumables, item and title back in one call (${JSON.stringify(removed)})`);
    check(balance(MIA) === coinsBeforeTest + 40 && consumable(MIA, "ticket_score_attack") === 0 && consumable(MIA, "streak_freeze") === 0, "her own coins stay; the test coins, ticket and freeze are gone");
    check(!owns(MIA, "frame.bronze") && owns(MIA, "avatar-special-edition.neon-captain-joulz"), "the test item is removed; the helmet from her Season 1 premium (Plus) stays");
    check(q(`SELECT count(*) FROM card_titles WHERE user_id = '${MIA}'`) === "0" && q(`SELECT count(*) FROM pass_title_unlocks WHERE user_id = '${MIA}'`) === "0", "the test title is gone and her card is back to Rookie");
    check(lines(MIA, "test_pass_reward") === 1 && lines(MIA, "test_pass_reward_removed") === 1, "removal is a line of its own (the test line is never changed)");
    const twice = JSON.parse(q(`SELECT pass.remove_test_season_rewards('again')`)) as Record<string, number>;
    check(twice["coins"] === 0 && twice["consumables"] === 0 && twice["items"] === 0 && twice["titles"] === 0, "running it again (for everyone) takes nothing more");
    for (const role of ["anon", "authenticated", "service_role"])
      check(/permission denied/.test(refused(`SET LOCAL ROLE ${role}; SELECT pass.remove_test_season_rewards('x')`)), `${role} can't remove test rewards`);
    await new Promise((r) => setTimeout(r, 5));
    check(q(`SELECT pass.reset_test_season('again from zero', 'Joe_Pass')`) === "reset", "pass.reset_test_season for one tester");
    const reset = await call(fns.getPassFn, undefined, tok.joe);
    check(reset?.open === true && reset.joules === 0 && reset.level === 0, "Joe's test season starts again from zero");
    check(Number(q(`SELECT count(*) FROM pass_joules WHERE user_id = '${JOE}' AND season_id = 'test'`)) === 1, "nothing deleted: the earlier line stays under its old start");
    check(q(`SELECT pass.reset_test_season('everyone again')`) === "reset_all", "pass.reset_test_season for every tester");
    check(q(`SELECT pass.end_test_season('testing finished')`) === "ended" && q(`SELECT pass.end_test_season('again')`) === "not_running", "pass.end_test_season ends it (once)");
    await new Promise((r) => setTimeout(r, 5));
    // An ended test season stays shown for claiming (CLAIM_GRACE_DAYS), so a tester sees it, ended.
    const ended = await call(fns.getPassFn, undefined, tok.joe);
    check(ended?.open === true && ended.season.id === "test" && ended.season.ended === true && ended.weekly === null, "an ended season stays open for claiming only (no weekly challenges)");
    check(Number(q(`SELECT count(*) FROM pass.admin_log WHERE action IN ('start_test_season', 'reset_test_season', 'end_test_season', 'set_season_dates', 'remove_test_purchase', 'remove_test_season_rewards')`)) === 9, "every season and test-purchase change is logged");
    check(q(`SELECT count(*) FROM pass.admin_log WHERE note = '' OR by_role IS NULL`) === "0", "each with who and why");
  });

  /* ------------------------------------------------------------- nobody else writes */
  await section("roles", async () => {
    const tables = ["pass_seasons", "pass_joules", "pass_members", "pass_premium", "pass_claims", "pass_title_unlocks", "pass_weeks", "pass_member_resets"];
    for (const role of ["anon", "authenticated"]) {
      for (const t of tables) check(/permission denied/.test(refused(`SET LOCAL ROLE ${role}; SELECT * FROM public.${t} LIMIT 1`)), `${role} can't read ${t}`);
      for (const f of ["pass_credit_joules(uuid,text,bigint,jsonb)", "pass_record_claim(uuid,text,bigint,text,integer,jsonb)", "pass_grant_premium(uuid,text,text,text)", "pass_note_level(uuid,text,bigint,integer,boolean)", "pass_record_week(date,text,text,text)", "pass_unlock_title(uuid,text,text)", "pass_activity(uuid,timestamptz,timestamptz)"])
        check(q(`SELECT has_function_privilege('${role}', 'public.${f}', 'EXECUTE')`) === "f", `${role} can't execute ${f.split("(")[0]}`);
    }
    for (const t of tables) check(/permission denied/.test(refused(`SET LOCAL ROLE service_role; DELETE FROM public.${t}`)), `the server can't write ${t} directly`);
    const kim = deviceDb(tok.kim);
    const attempts = await Promise.all([
      kim.from("pass_joules").insert({ season_id: "s1", epoch: 1, user_id: KIM, source_key: "x:1", kind: "weekly", uk_day: "2026-12-01", at: iso(Date.now()), base: 9999, amount: 9999 }),
      kim.from("pass_claims").insert({ season_id: "s1", epoch: 1, user_id: KIM, track: "free", level: 60, reward: {} }),
      kim.from("pass_premium").insert({ season_id: "s1", user_id: KIM, source: "purchase", grant_key: "fake" }),
      kim.from("pass_members").insert({ season_id: "s1", epoch: 1, user_id: KIM, level_reached: 60 }),
      kim.rpc("pass_credit_joules", { p_user_id: KIM, p_season: "s1", p_epoch: 1, p_rows: [] as never }),
      kim.rpc("pass_grant_premium", { p_user_id: KIM, p_season: "s1", p_source: "purchase", p_key: "fake" }),
      deviceDb(null).rpc("pass_record_claim", { p_user_id: KIM, p_season: "s1", p_epoch: 1, p_track: "free", p_level: 2, p_reward: {} as never }),
    ]);
    check(attempts.every((r) => r.error !== null), "a signed-in device and anon can't write Joules, levels, claims, premium or call the writers");
    check(Number(q(`SELECT count(*) FROM pass_joules WHERE user_id = '${KIM}' AND (source_key = 'x:1' OR amount = 9999)`)) === 0 && Number(q(`SELECT count(*) FROM pass_premium WHERE user_id = '${KIM}'`)) === 0 && Number(q(`SELECT count(*) FROM pass_claims WHERE user_id = '${KIM}'`)) === 0, "and nothing was written");
  });

  /* ------------------------------------------------------------- the check-only override */
  await section("production override", async () => {
    const api = await import("../src/lib/pass/passApi");
    check(api.overrideAllowed(false, true) === true && api.overrideAllowed(true, true) === false && api.overrideAllowed(false, undefined) === false, "window.__DUELZ_ALLOW_PASS__ only outside production builds");
    const src = readFileSync("src/lib/pass/passApi.ts", "utf8");
    check(/overrideAllowed\(import\.meta\.env\.PROD,/.test(src), "the app passes import.meta.env.PROD to it");
  });
}
