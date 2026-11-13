/**
 * badges-check (wave 2, train C, session C2, 11 Nov 2026; docs/badges/README.md): badges, titles, the account
 * rewards and the Daily streak on the account, through the real server functions (src/lib/badges/badges.functions.ts),
 * the real server code and the real migrations on a local PostgreSQL 16 with the server-function harness's PostgREST /
 * GoTrue stand-in (scripts/server-fn-harness.ts).
 *
 * What it proves:
 * - the catalogue: the 54 badges are docs/art/badges/badges.json's (slug, name, group, rarity, coins, order), 8 / 12 /
 *   17 / 9 / 8 by rarity, every Legendary pays 250; the art in public/art/badges is the approved SVGs byte for byte;
 *   the titles are the brief's 32 (Rookie and 31 badge titles), each tied to a real badge; the database's rows match;
 * - the catalogue is Joe's approved one (docs/badges/catalogue.md's table, every rule shown, none "announced soon");
 *   each earnable badge has a rule here or is awarded elsewhere (Friendly, B1), each rule a test that earns it and one
 *   that just misses (pure, and on stored rooms, Dailies, challenges and gems through public.badge_facts); no badge
 *   that waits (all stars, Hard challenges, Daily boards, tournaments) can be awarded; rated play's 13 are earnable
 *   (wave 3 W3a; ratings-check earns them through real matches); locked counted badges carry their progress;
 * - awards are idempotent; a Legendary pays 250 once; the sign-up reward pays 1,000 once, at sign-up and after the
 *   backfill, whichever comes first; the backfill pays every existing account and every Founding Player (badge with
 *   number, 250, the Founding frame) and a second run adds nothing;
 * - founding: an account made at 23:59 on 25 January 2027 UK time qualifies, one at 00:00 on 26 January doesn't;
 * - only earned badges and unlocked titles can be equipped (three at most, no duplicates); a guest can't; anon and
 *   authenticated can't award badges, pay coins or write any badge table; other players read a card's badges and title;
 * - the badge-earned moment never appears over a results screen (it is drawn only on tab pages);
 * - the Daily streak from the server matches today's device rule on test histories (played, missed, a missed day
 *   covered by a freeze, which is used once and recorded), and is the same on two devices of one account, while a
 *   second device's guest stays separate;
 * - the events badge_earned and title_equipped.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's runners). Without them the database part fails on CI and
 * prints a NOTE locally. No browser.
 */

import { readFileSync, readdirSync } from "node:fs";

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
  if (/^\s*(FAIL|NOTE)|^badges-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const MIGRATION = "supabase/migrations/20261111220000_badges_titles.sql";
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ANA = uid(31); // signs up through completeSignUpFn (a Founding Player)
const BEN = uid(32); // an account from before the migration (backfill)
const CAT = uid(33); // a guest
const DOT = uid(34); // made at 23:59 on 25 Jan 2027 UK time
const EVE = uid(35); // made at 00:00 on 26 Jan 2027 UK time
const GUS = uid(36); // a guest on a second device
const FAY = uid(37); // plays rooms, Dailies and a challenge (the stored-facts badges)
const GIL = uid(38); // a second room host, one game short

let db: LocalDb | null = null;
let rest: RestServer | null = null;

await pureChecks();

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`badges-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`badges-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

try {
  db = startLocalDb("badges-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES
    ('${ANA}', false, 'ana@example.com'), ('${BEN}', false, 'ben@example.com'), ('${CAT}', true, NULL),
    ('${DOT}', false, 'dot@example.com'), ('${EVE}', false, 'eve@example.com'), ('${GUS}', true, NULL),
    ('${FAY}', false, 'fay@example.com'), ('${GIL}', false, 'gil@example.com')`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`badges-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: badges, titles, the account rewards and the Daily streak on the account hold.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  await section("catalogue", async () => {
    const cat = await import("../src/lib/badges/catalogue");
    const json = JSON.parse(readFileSync("docs/art/badges/badges.json", "utf8")) as { slug: string; name: string; group: string; rarity: string; coins: number }[];
    check(cat.BADGES.length === 54 && json.length === 54, `54 badges (${cat.BADGES.length})`);
    const diff = json.filter((j, i) => {
      const b = cat.BADGES[i];
      return !b || b.slug !== j.slug || b.name !== j.name || b.group !== j.group || b.rarity !== j.rarity.toLowerCase() || b.coins !== j.coins;
    });
    check(diff.length === 0, `the catalogue is badges.json, field for field and in order${diff.length ? ` (${diff.map((d) => d.slug).join(", ")})` : ""}`);
    const by = (r: string) => cat.BADGES.filter((b) => b.rarity === r).length;
    check(by("common") === 8 && by("rare") === 12 && by("epic") === 17 && by("elite") === 9 && by("legendary") === 8, "8 Common, 12 Rare, 17 Epic, 9 Elite, 8 Legendary");
    check(cat.BADGES.every((b) => b.coins === (b.rarity === "legendary" ? 250 : 0)), "every Legendary pays 250 coins, nothing else pays");
    check(cat.BADGES.every((b) => (b.status === "waits") === (b.waitsFor !== null)), "a badge waits exactly when it names what for");
    check(cat.BADGES.every((b) => b.rule.length > 5 && b.rule.endsWith(".")), "every badge has its rule (no hidden badges)");
    check(cat.BADGES.every((b) => !/announced soon/i.test(cat.badgeHowLine(b))), "no badge says “announced soon”");
    const md = readFileSync("docs/badges/catalogue.md", "utf8");
    const tableRows = md.split("\n").filter((l) => l.startsWith("| `"));
    const mdDiff = cat.BADGES.filter((b, i) => {
      const cells = (tableRows[i] ?? "").split("|").map((c) => c.trim());
      return cells[1] !== `\`${b.slug}\`` || cells[2] !== b.name || cells[5] !== b.rule || cells[6] !== (b.target ? `${b.target.need} ${b.target.unit}` : "–") || (cells[7] === "now" || cells[7] === "now (B1 awards)") !== (b.status === "earnable");
    });
    check(tableRows.length === 54 && mdDiff.length === 0, `docs/badges/catalogue.md's table is the catalogue, rule for rule (${mdDiff.map((d) => d.slug).join(", ") || "none differ"})`);
    const now = cat.BADGES.filter((b) => b.status === "earnable").map((b) => b.slug).sort().join();
    // Approved by Joe in the wave 3 W3a brief (11 Nov 2026): rated play's 13 badges are earnable now (16 earnable → 29).
    // Approved by Joe, 11 Nov 2026 (wave 4 W4a's prompt): Daily Champion and Daily Top 100 move from waiting to earnable (29 → 31).
    // Joe's approval, 11 Nov 2026 (wave 4 W4b prompt; counts set 12 Nov 2026 at the wave 4 train): Entrant, Trophy Hunter,
    // Arena Ace, Champion, Arena Champion, Score Attack Champion and Serial Winner move from waiting to earnable (31 → 38).
    check(now === "all-rounder,arena-ace,arena-champion,buzzer-beater,century,challenge-expert,challenge-seeker,challenger,champion,clean-sweep,comeback-kid,daily-champion,daily-habit,daily-top-100,dedicated,entrant,first-star,first-win,flawless,founding-player,friendly,gem-hunter,giant-slayer,hot-streak,lightning-strikes,party-host,perfectionist,photo-finish,placed,podium-regular,revenge,score-attack-champion,serial-winner,speed-demon,storm-chaser,top-500,trophy-hunter,unstoppable", `earnable now: every badge the approved catalogue says is now (${now})`);
    const wait = (w: string) => cat.BADGES.filter((b) => b.waitsFor === w).map((b) => b.slug).sort().join();
    check(wait("mastery-stars") === "" && wait("practice-challenges") === "", "nothing parked: C1a's three and C1b's three wired");
    const { ACTIVE_PUZZLE_TYPES } = await import("../src/lib/duel/catalogue");
    const ar = cat.BADGE_BY_SLUG.get("all-rounder")!;
    check(ar.target?.need === ACTIVE_PUZZLE_TYPES.length && ar.target.live === true, `All-Rounder counts every active game, from the live list (${ar.target?.need})`);
    // Approved by Joe in the wave 3 W3a brief (11 Nov 2026): rated play's 13 no longer wait (rated play 13 → 0).
    // Joe's approval, 11 Nov 2026 (W4b; set 12 Nov 2026 at the wave 4 train): tournaments 9 → 2 (Swiss and Knockout Champion
    // keep waiting for W4c); W4a (approved by Joe, 11 Nov 2026): Daily boards 2 → 0.
    check(cat.BADGES.filter((b) => b.waitsFor === "rated-play").length === 0 && cat.BADGES.filter((b) => b.waitsFor === "tournaments").length === 2 && wait("tournaments") === "knockout-champion,swiss-champion" && cat.BADGES.filter((b) => b.waitsFor === "all-stars").length === 12 && wait("daily-boards") === "" && wait("hard-challenges") === "category-clear,completionist", "the waves' badges wait as approved (rated play 0 since W3a, tournaments 2 (Swiss and Knockout Champion; 9 until Joe's approval of 11 Nov 2026, W4b), all stars 12, Daily boards 0 since W4a (approved by Joe, 11 Nov 2026), Hard challenges 2)");
    check(cat.badgeProgressLine(cat.BADGE_BY_SLUG.get("daily-habit")!, 4) === "4 of 7 days" && cat.badgeProgressLine(cat.BADGE_BY_SLUG.get("perfectionist")!, 30) === "25 of 25 games" && cat.badgeProgressLine(cat.BADGE_BY_SLUG.get("flawless")!, 0) === null, "progress reads “4 of 7 days”, capped at the count, only on counted badges");
    const svgs = readdirSync("docs/art/badges/svg").filter((f) => f.endsWith(".svg"));
    const same = svgs.filter((f) => readFileSync(`docs/art/badges/svg/${f}`).equals(readFileSync(`public/art/badges/${f}`)));
    check(svgs.length === 54 && same.length === 54 && cat.BADGES.every((b) => svgs.includes(`${b.slug}.svg`)), `public/art/badges is the 54 approved SVGs byte for byte (${same.length})`);

    check(cat.TITLES.length === 32 && cat.TITLES[0]!.id === cat.STARTER_TITLE && cat.TITLES[0]!.name === "Rookie", "32 titles, Rookie first");
    const brief =
      "Grand Master, Top 500, Daily Champion, Knockout Champion, Serial Winner, Completionist, Lightning, Founding Player, Unstoppable, Giant Slayer, Perfectionist, Century, Storm Chaser, Comeback Kid, Clean Sweeper, Speed Demon, Podium Regular, Logician, Wordsmith, Number Cruncher, Pattern Seeker, Speedster, Sharp Eye, Action Hero, Retro Legend, Sports Star, Card Shark, Strategist, Photo Finisher, Buzzer Beater, Avenger";
    check(cat.TITLES.slice(1).map((t) => t.name).join(", ") === brief, "the badge titles are the brief's 31, in its order");
    check(cat.TITLES.slice(1).every((t) => t.badge && cat.BADGE_BY_SLUG.has(t.badge)), "every badge title names a real badge");
    check(cat.titlesUnlocked(new Set()).map((t) => t.id).join() === "rookie", "with no badges only Rookie is unlocked");
    check(cat.titlesUnlocked(new Set(["founding-player"])).map((t) => t.id).join() === "rookie,founding-player", "the Founding Player badge unlocks its title");
  });

  await section("rules", async () => {
    const cat = await import("../src/lib/badges/catalogue");
    const rules = await import("../src/lib/badges/rules.server");
    const earnable = cat.BADGES.filter((b) => b.status === "earnable").map((b) => b.slug);
    const checked = earnable.filter((s) => !rules.AWARDED_ELSEWHERE.includes(s));
    check(checked.every((s) => rules.BADGE_RULES[s]) && Object.keys(rules.BADGE_RULES).every((s) => checked.includes(s)), "a rule for every earnable badge the server checks, and only those");
    // Joe's approval, 11 Nov 2026 (W4b): the seven tournament badges are awarded by the tournaments code, like Friendly by B1.
    const TOURNAMENT_AWARDED = ["entrant", "trophy-hunter", "arena-ace", "champion", "arena-champion", "score-attack-champion", "serial-winner"];
    check(rules.AWARDED_ELSEWHERE.join() === ["friendly", ...TOURNAMENT_AWARDED].join() && earnable.includes("friendly") && !rules.BADGE_RULES["friendly"], "Friendly is earnable but awarded by B1 (no rule here)");
    check(TOURNAMENT_AWARDED.every((s) => earnable.includes(s) && !rules.BADGE_RULES[s]), "the seven tournament badges are earnable and awarded by the tournaments code (no rule here)");
    const none: rules.BadgeFacts = { founding: false, playerNumber: 43, games200: 0, buzzerFinishes: 0, fastFinishes: 0, bestDailyStreak: 0, dailyStreak: 0, hostedRooms: 0, challengesDone: 0, stars: 0, starredGames: 0, gems: 0, rated: rules.NO_RATED_FACTS };
    // Rated play's facts (wave 3 W3a): the earn / miss pair's rated part, over no rated record.
    const r = (part: Partial<rules.RatedFacts>): Partial<rules.BadgeFacts> => ({ rated: { ...rules.NO_RATED_FACTS, ...part } });
    const { ACTIVE_PUZZLE_TYPES: ACTIVE } = await import("../src/lib/duel/catalogue");
    // Each rule: the facts that just earn it, and the same facts one short.
    const earns: Record<string, [Partial<rules.BadgeFacts>, Partial<rules.BadgeFacts>]> = {
      "founding-player": [{ founding: true, playerNumber: 42 }, { founding: false }],
      flawless: [{ games200: 1 }, { games200: 0 }],
      perfectionist: [{ games200: 25 }, { games200: 24 }],
      "daily-habit": [{ bestDailyStreak: 7 }, { bestDailyStreak: 6, dailyStreak: 6 }],
      dedicated: [{ bestDailyStreak: 30 }, { bestDailyStreak: 29 }],
      century: [{ bestDailyStreak: 100 }, { bestDailyStreak: 99 }],
      "buzzer-beater": [{ buzzerFinishes: 1 }, { buzzerFinishes: 0 }],
      "speed-demon": [{ fastFinishes: 10 }, { fastFinishes: 9 }],
      "party-host": [{ hostedRooms: 25 }, { hostedRooms: 24 }],
      "first-star": [{ stars: 1 }, { stars: 0 }],
      "all-rounder": [{ starredGames: ACTIVE.length, stars: ACTIVE.length }, { starredGames: ACTIVE.length - 1, stars: 200 }],
      "gem-hunter": [{ gems: 1 }, { gems: 0 }],
      challenger: [{ challengesDone: 10 }, { challengesDone: 9 }],
      "challenge-seeker": [{ challengesDone: 50 }, { challengesDone: 49 }],
      "challenge-expert": [{ challengesDone: 100 }, { challengesDone: 99 }],
      // Wave 4 W4a (11 Nov 2026): counted from final Daily boards of 100+ / 500+ players (leaderboards-check proves the fields).
      "daily-champion": [{ dailyBoardWins: 1 }, { dailyBoardWins: 0, dailyBoardTop100s: 5 }],
      "daily-top-100": [{ dailyBoardTop100s: 1 }, { dailyBoardTop100s: 0 }],
      // Rated play (wave 3 W3a, 11 Nov 2026).
      "first-win": [r({ wins: 1 }), r({ wins: 0, placementPlayed: 5 })],
      placed: [r({ placementPlayed: 5 }), r({ placementPlayed: 4 })],
      "hot-streak": [r({ bestWinStreak: 5 }), r({ bestWinStreak: 4, winStreak: 4, wins: 40 })],
      "comeback-kid": [r({ comebacks: 1 }), r({ comebacks: 0, wins: 9 })],
      "clean-sweep": [r({ cleanSweeps: 1 }), r({ cleanSweeps: 0, wins: 9 })],
      "podium-regular": [r({ podiums: 25 }), r({ podiums: 24 })],
      unstoppable: [r({ bestWinStreak: 10 }), r({ bestWinStreak: 9, winStreak: 9 })],
      "giant-slayer": [r({ giantSlayers: 1 }), r({ giantSlayers: 0, wins: 30 })],
      "storm-chaser": [r({ peakTier: "storm" }), r({ peakTier: "surge" })],
      "lightning-strikes": [r({ peakTier: "top500" }), r({ peakTier: "storm" })],
      "top-500": [r({ top500Ever: true, peakTier: "top500" }), r({ peakTier: "lightning" })],
      revenge: [r({ revenges: 1 }), r({ revenges: 0, wins: 3 })],
      "photo-finish": [r({ photoFinishes: 1 }), r({ photoFinishes: 0, wins: 3 })],
    };
    for (const slug of checked) {
      const pair = earns[slug];
      check(Boolean(pair), `${slug}: has an earn / miss test`);
      if (!pair) continue;
      check(rules.badgesEarnedBy({ ...none, ...pair[0] }).some((b) => b.slug === slug), `${slug}: earned`);
      check(!rules.badgesEarnedBy({ ...none, ...pair[1] }).some((b) => b.slug === slug), `${slug}: just missed`);
    }
    check(rules.badgesEarnedBy({ ...none, founding: true, playerNumber: 42 }).find((b) => b.slug === "founding-player")?.detail["number"] === 42, "the Founding Player badge carries the number");
    const prog = rules.badgeProgress({ ...none, dailyStreak: 4, bestDailyStreak: 6, games200: 3, hostedRooms: 11, fastFinishes: 2 });
    check(prog["daily-habit"] === 4 && prog["perfectionist"] === 3 && prog["party-host"] === 11 && prog["speed-demon"] === 2, "progress: today's streak for the streak badges, counts for the rest");
  });

  await section("daily streak rule", async () => {
    const { dailyStreakWithFreezes } = await import("../src/lib/duel/dailyStreak");
    const { dailyStreak } = await import("../src/lib/duel/dailyRecord");
    const { shiftDayKey } = await import("../src/lib/duel/daily");
    const T = "2026-11-11";
    const d = (n: number) => shiftDayKey(T, -n);
    const s = (played: string[], frozen: string[] = [], freezes = 0) => dailyStreakWithFreezes({ played, frozen, today: T, freezes });
    check(s([d(0), d(1), d(2)]).streak === 3, "played today and the two days before: 3");
    check(s([d(1), d(2)]).streak === 2 && !s([d(1), d(2)]).playedToday, "today still open: yesterday's run of 2 holds");
    check(s([d(0), d(2), d(3)]).streak === 1, "a missed day breaks the streak");
    check(s([d(2), d(3)]).streak === 0, "missed yesterday, not played today: 0");
    const covered = s([d(0), d(2), d(3)], [], 1);
    check(covered.streak === 3 && covered.freezeDays.join() === d(1), "a freeze covers the missed day (the streak 3, the day named)");
    check(s([d(0), d(2), d(3)], [d(1)]).streak === 3, "a covered day keeps the streak (and adds nothing)");
    check(s([d(0), d(3), d(4)], [], 1).freezeDays.length === 0 && s([d(0), d(3), d(4)], [], 1).streak === 1, "a gap longer than the freezes held uses none and breaks");
    check(s([d(0), d(3), d(4)], [], 2).streak === 3 && s([d(0), d(3), d(4)], [], 2).freezeDays.length === 2, "two freezes cover a two-day gap");
    check(s([d(5)], [], 3).freezeDays.length === 0 || s([d(5)], [], 3).streak === 1, "freezes only save a streak that exists");
    check(s([], [], 2).streak === 0 && s([], [], 2).freezeDays.length === 0, "no history: 0, no freeze used");
    // With no freezes, exactly the device's rule, on 2,000 random histories.
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let same = 0;
    for (let i = 0; i < 2000; i++) {
      const days = Array.from({ length: 30 }, (_, k) => d(k)).filter(() => rnd() < 0.7);
      if (s(days).streak === dailyStreak(days, T)) same++;
    }
    check(same === 2000, `without freezes the server's streak is the device rule's on 2,000 histories (${same})`);
    const { longestDailyStreak } = await import("../src/lib/duel/dailyStreak");
    const run = (from: number, n: number) => Array.from({ length: n }, (_, k) => d(from + k));
    check(longestDailyStreak([...run(20, 7), ...run(2, 3)]) === 7, "the longest run counts, not today's (7 earlier, 3 now)");
    check(longestDailyStreak([...run(20, 3), ...run(24, 3)]) === 3 && longestDailyStreak([...run(20, 3), ...run(24, 3)], [d(23)]) === 6, "a covered day joins two runs without adding to them");
    check(longestDailyStreak([...run(10, 6)], [d(16)]) === 6 && longestDailyStreak([], []) === 0, "a covered day at a run's end adds nothing");
  });

  await section("automation switch", async () => {
    const api = readFileSync("src/lib/badges/badgesApi.ts", "utf8");
    const fn = api.slice(api.indexOf("export function automated"), api.indexOf("async function backend"));
    const prodAt = fn.indexOf("if (import.meta.env.PROD) return true;");
    const switchAt = fn.indexOf("__DUELZ_ALLOW_BADGES__");
    check(prodAt > 0 && switchAt > prodAt, "window.__DUELZ_ALLOW_BADGES__ is read only after a production build has returned (import.meta.env.PROD)");
    check(fn.indexOf("navigator.webdriver !== true) return false") > 0 && fn.indexOf("navigator.webdriver !== true) return false") < prodAt, "a real player's browser (no webdriver) never reads it at all");
    const codeLines = api.split("\n").filter((l) => l.includes("__DUELZ_ALLOW_BADGES__") && !/^\s*(\*|\/\/|\/\*)/.test(l));
    check(codeLines.length === 1, `the switch is read in one place only (${codeLines.length})`);
  });

  await section("moment placement", async () => {
    const shell = readFileSync("src/components/duel/PhoneShell.tsx", "utf8");
    check(/\{tabs && !gameScreen \? <BadgeMoment \/> : null\}/.test(shell), "the badge-earned moment is drawn only on tab pages (PhoneShell's tabs, never a game screen)");
    const uses = (await import("node:child_process")).spawnSync("grep", ["-rln", "<BadgeMoment", "src"], { encoding: "utf8" }).stdout.trim().split("\n");
    check(uses.length === 1 && uses[0] === "src/components/duel/PhoneShell.tsx", `nothing else draws it (no results, podium, standings or share screen) (${uses.join(", ")})`);
    const results = ["src/components/duel/Podium.tsx", "src/components/duel/Standings.tsx", "src/components/duel/FinalResult.tsx", "src/components/async/AsyncResults.tsx"];
    for (const f of results) {
      try {
        const text = readFileSync(f, "utf8");
        check(!text.includes("BadgeMoment") && !/tabs=/.test(text), `${f}: no badge moment and no tab page`);
      } catch {
        /* a file another train renamed: the grep above still proves it */
      }
    }
  });
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const fns = await import("../src/lib/badges/badges.functions");
  const account = await import("../src/lib/account/account.functions");
  const cat = await import("../src/lib/badges/catalogue");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { ukDayKey, shiftDayKey } = await import("../src/lib/duel/daily");
  const { createClient } = await import("@supabase/supabase-js");
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
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
  const hasBadge = (id: string, b: string) => q(`SELECT count(*) FROM player_badges WHERE user_id = '${id}' AND badge = '${b}'`) === "1";
  const ownsFrame = (id: string) => q(`SELECT count(*) FROM inventory_items WHERE user_id = '${id}' AND item_id = 'frame.founding'`) === "1";
  const tok = { ana: accountToken(ANA), ana2: accountToken(ANA), ben: accountToken(BEN), cat: userToken(CAT), dot: accountToken(DOT), eve: accountToken(EVE), gus: userToken(GUS) };

  await section("seed rows", async () => {
    const rows = JSON.parse(q(`SELECT json_agg(b ORDER BY sort_order) FROM badges b`)) as Record<string, unknown>[];
    const diff = cat.BADGES.filter((b, i) => {
      const r = rows[i];
      return !r || r["slug"] !== b.slug || r["name"] !== b.name || r["grp"] !== b.group || r["rarity"] !== b.rarity || r["coins"] !== b.coins || r["status"] !== b.status || r["waits_for"] !== b.waitsFor || r["rule"] !== b.rule || r["target_need"] !== (b.target && !b.target.live ? b.target.need : null) || r["target_unit"] !== (b.target && !b.target.live ? b.target.unit : null);
    });
    const noRule = db.psql(`BEGIN; INSERT INTO badges (slug, name, grp, rarity, coins, status, sort_order) VALUES ('x-z', 'X', 'fun', 'common', 0, 'earnable', 998); ROLLBACK;`);
    check(/ERROR/.test(noRule.err), "the table refuses a badge with no rule");
    check(rows.length === 54 && diff.length === 0, `public.badges is the catalogue, row for row (${diff.map((d) => d.slug).join(", ") || "none differ"})`);
    const titles = JSON.parse(q(`SELECT json_agg(t ORDER BY sort_order) FROM titles t`)) as Record<string, unknown>[];
    // 32 → 34: Neon Rider and Circuit Breaker, the Season pass's titles, follow the brief's 32 (approved by Joe, 11 Nov 2026).
    check(titles.length === 34 && cat.TITLES.every((t, i) => titles[i]?.["id"] === t.id && titles[i]?.["name"] === t.name && titles[i]?.["badge"] === t.badge), "public.titles is the title list, row for row");
    const refusedRow = db.psql(`BEGIN; INSERT INTO badges (slug, name, grp, rarity, coins, status, rule, sort_order) VALUES ('x-y', 'X', 'fun', 'legendary', 0, 'earnable', 'A rule.', 999); ROLLBACK;`);
    check(/ERROR/.test(refusedRow.err), "the table refuses a Legendary that doesn't pay 250");
  });

  await section("sign-up and founding rewards", async () => {
    const made = await call(account.completeSignUpFn, { username: "Ana_Badge", dateOfBirth: "1994-03-02", colour: 4, country: "GB" }, tok.ana);
    check(made?.kind === "account", `Ana signs up (${JSON.stringify(made).slice(0, 100)})`);
    check(q(`SELECT founding FROM profiles WHERE user_id = '${ANA}'`) === "t", "Ana is a Founding Player (made before 26 Jan 2027)");
    const first = await call(fns.syncMyBadges, undefined, tok.ana);
    check(first?.account === true && balance(ANA) === 1250, `sign-up settles: 1,000 + 250 (${balance(ANA)})`);
    check(hasBadge(ANA, "founding-player") && ownsFrame(ANA), "Ana has the Founding Player badge and the Founding frame");
    const num = Number(q(`SELECT player_number FROM profiles WHERE user_id = '${ANA}'`));
    check(first?.earned?.[0]?.number === num, `the badge carries her player number (#${num})`);
    check(first?.unseen?.join() === "founding-player", "the badge is unseen (its moment is due)");
    for (let i = 0; i < 3; i++) await call(fns.syncMyBadges, undefined, i % 2 ? tok.ana2 : tok.ana);
    check(balance(ANA) === 1250 && lines(ANA, "signup_reward") === 1 && lines(ANA, "badge_reward") === 1, "syncing again pays nothing more (one sign-up line, one badge line)");
    check(q(`SELECT idempotency_key FROM coin_ledger WHERE user_id = '${ANA}' AND reason = 'signup_reward'`) === `signup_reward:${ANA}`, "the sign-up reward's key is signup_reward:<user id>");
    check((await events("badge_earned", ANA)) === 1, "one badge_earned event");
    const props = q(`SELECT props::text FROM analytics.events WHERE event = 'badge_earned' AND player_id = '${ANA}'`);
    check(props.includes('"badge": "founding-player"') && props.includes('"rarity": "legendary"'), `badge_earned carries badge and rarity (${props})`);
    await call(fns.markBadgesSeen, { badges: ["founding-player"] }, tok.ana);
    const after = await call(fns.getMyBadges, undefined, tok.ana);
    check(after?.unseen?.length === 0, "once shown, the moment isn't due again");
  });

  await section("backfill", async () => {
    // Ben: an account from before this migration (made without the rewards), then the migration again.
    q(`SELECT public.create_profile('${BEN}', 'Ben_Before', 2::smallint, DATE '1990-01-01', NULL)`);
    check(balance(BEN) === 0 && !hasBadge(BEN, "founding-player"), "Ben starts with nothing (as before the migration)");
    const again = db.psql(readFileSync(MIGRATION, "utf8"));
    check(again.ok && !/ERROR/.test(again.err), `the migration applies again (${again.err.slice(0, 120)})`);
    check(balance(BEN) === 1250 && hasBadge(BEN, "founding-player") && ownsFrame(BEN), `the backfill pays Ben 1,000 + 250 with the badge and frame (${balance(BEN)})`);
    check(balance(ANA) === 1250, "the backfill pays Ana nothing more (she was paid at sign-up)");
    const accounts = q(`SELECT count(*) FROM profiles`);
    check(again.err.includes(`badges backfill: ${accounts} accounts; 1 sign-up rewards paid, 1 Founding Player badges, 1 badge rewards paid, 1 Founding frames granted`), `the deploy log notes the counts (${(again.err.match(/badges backfill:[^\n]*/) ?? ["none"])[0]})`);
    await call(fns.syncMyBadges, undefined, tok.ben);
    check(balance(BEN) === 1250 && lines(BEN, "signup_reward") === 1, "after the backfill, Ben's sync pays nothing more");
    const third = db.psql(readFileSync(MIGRATION, "utf8"));
    check(third.err.includes(`badges backfill: ${accounts} accounts; 0 sign-up rewards paid, 0 Founding Player badges, 0 badge rewards paid, 0 Founding frames granted`), "a second run pays nothing");
    // 32 → 34: the two Season pass titles (approved by Joe, 11 Nov 2026).
    check(Number(q(`SELECT count(*) FROM badges`)) === 54 && Number(q(`SELECT count(*) FROM titles`)) === 34, "and adds no badge or title row");
  });

  await section("founding cutoff", async () => {
    check(q(`SELECT accounts.is_founding(TIMESTAMPTZ '2027-01-25 23:59:00 Europe/London')`) === "t", "23:59 on 25 Jan 2027 UK time is founding");
    check(q(`SELECT accounts.is_founding(TIMESTAMPTZ '2027-01-26 00:00:00 Europe/London')`) === "f", "00:00 on 26 Jan 2027 UK time is not");
    // The insert trigger stamps created_at with now() and founding with accounts.is_founding(created_at): made through
    // create_profile, then (triggers off, as the clock can't be moved) given those times and the flag the same function
    // gives them, exactly what the trigger would have stored at that moment.
    q(`SELECT public.create_profile('${DOT}', 'Dot_Late', 3::smallint, DATE '1990-01-01', NULL)`);
    q(`SELECT public.create_profile('${EVE}', 'Eve_After', 5::smallint, DATE '1990-01-01', NULL)`);
    q(`SET session_replication_role = replica;
       UPDATE profiles SET created_at = TIMESTAMPTZ '2027-01-25 23:59:00 Europe/London', founding = accounts.is_founding(TIMESTAMPTZ '2027-01-25 23:59:00 Europe/London') WHERE user_id = '${DOT}';
       UPDATE profiles SET created_at = TIMESTAMPTZ '2027-01-26 00:00:00 Europe/London', founding = accounts.is_founding(TIMESTAMPTZ '2027-01-26 00:00:00 Europe/London') WHERE user_id = '${EVE}';
       SET session_replication_role = origin;`);
    check(q(`SELECT string_agg(founding::text, ',' ORDER BY username) FROM profiles WHERE user_id IN ('${DOT}', '${EVE}')`) === "true,false", "Dot (23:59) is founding, Eve (00:00) isn't");
    await call(fns.syncMyBadges, undefined, tok.dot);
    await call(fns.syncMyBadges, undefined, tok.eve);
    check(hasBadge(DOT, "founding-player") && ownsFrame(DOT) && balance(DOT) === 1250, "the 23:59 account gets the badge, frame and 250 (and the 1,000)");
    check(!hasBadge(EVE, "founding-player") && !ownsFrame(EVE) && balance(EVE) === 1000, "the 00:00 account gets only the sign-up reward");
  });

  await section("awards", async () => {
    const award = (badge: string) => JSON.parse(q(`SELECT public.badge_award('${EVE}', '${badge}', '{}'::jsonb)::text`)) as { status: string };
    const waiting = cat.BADGES.filter((b) => b.status !== "earnable");
    const refusedAll = waiting.every((b) => award(b.slug).status === "not_earnable");
    // Approved by Joe in the wave 3 W3a brief (11 Nov 2026): 38 waiting → 25 (rated play's 13 earnable).
    // W4a (approved by Joe, 11 Nov 2026): Daily Champion and Daily Top 100 earnable too, 25 waiting → 23.
    // Joe's approval, 11 Nov 2026 (W4b; set 12 Nov 2026 at the wave 4 train): 23 → 16 (the seven tournament badges earnable).
    check(refusedAll && waiting.length === 16 && Number(q(`SELECT count(*) FROM player_badges WHERE user_id = '${EVE}'`)) === 0, `none of the ${waiting.length} badges that wait can be awarded`);
    const friendly = JSON.parse(q(`SELECT public.badge_award('${EVE}', 'friendly', '{}'::jsonb)::text`)) as { status: string };
    check(friendly.status === "awarded" && balance(EVE) === 1000, "Friendly can be awarded through badge_award (B1's path), no coins (Common)");
    q(`DELETE FROM player_badges WHERE user_id = '${EVE}' AND badge = 'friendly'`);
    check(award("no-such-badge").status === "unknown_badge", "an unknown badge is refused");
    const guest = JSON.parse(q(`SELECT public.badge_award('${CAT}', 'founding-player', '{}'::jsonb)::text`)) as { status: string };
    check(guest.status === "no_account", "a guest can't be awarded a badge");
    // A Legendary pays once: awarded again by the database directly.
    const twice = JSON.parse(q(`SELECT public.badge_award('${ANA}', 'founding-player', '{}'::jsonb)::text`)) as { status: string; coins: { status: string } };
    check(twice.status === "owned" && twice.coins.status === "duplicate" && balance(ANA) === 1250, "awarding an owned Legendary again: owned, the 250 a duplicate");
    const sameTime = await Promise.all(Array.from({ length: 6 }, () => call(fns.syncMyBadges, undefined, tok.ben)));
    check(sameTime.every((r) => r?.account) && balance(BEN) === 1250 && lines(BEN, "badge_reward") === 1, "six syncs at once pay nothing twice");
  });

  await section("equipping", async () => {
    const ok = await call(fns.setMyCardBadges, { badges: ["founding-player"] }, tok.ana);
    check(ok?.ok === true && ok.badges.card.join() === "founding-player", "an earned badge goes on the card");
    const notEarned = await call(fns.setMyCardBadges, { badges: ["grand-master"] }, tok.ana);
    check(notEarned?.ok === false && notEarned.reason === "not_earned", "an unearned badge is refused");
    const four = await call(fns.setMyCardBadges, { badges: ["founding-player", "a", "b", "c"] }, tok.ana);
    check(four?.ok === false && four.reason === "too_many", "four badges are refused");
    const dup = await call(fns.setMyCardBadges, { badges: ["founding-player", "founding-player"] }, tok.ana);
    check(dup?.ok === false && dup.reason === "duplicate", "a badge twice is refused");
    const title = await call(fns.setMyTitle, { title: "founding-player" }, tok.ana);
    check(title?.ok === true && title.badges.title === "founding-player", "an unlocked title is equipped");
    const locked = await call(fns.setMyTitle, { title: "grand-master" }, tok.ana);
    check(locked?.ok === false && locked.reason === "not_earned", "a locked title is refused");
    const unknown = await call(fns.setMyTitle, { title: "nope" }, tok.ana);
    check(unknown?.ok === false && unknown.reason === "unknown_title", "an unknown title is refused");
    const eveTitle = await call(fns.setMyTitle, { title: "founding-player" }, tok.eve);
    check(eveTitle?.ok === false && eveTitle.reason === "not_earned", "a title whose badge isn't earned is refused");
    const rookie = await call(fns.setMyTitle, { title: "rookie" }, tok.eve);
    check(rookie?.ok === true && rookie.badges.title === "rookie", "Rookie is everyone's");
    check((await events("title_equipped", ANA)) === 1, "title_equipped recorded once");
    check(q(`SELECT props::text FROM analytics.events WHERE event = 'title_equipped' AND player_id = '${ANA}'`).includes('"title": "founding-player"'), "title_equipped carries the title");
    const guest = await call(fns.setMyTitle, { title: "rookie" }, tok.cat);
    const guestSync = await call(fns.syncMyBadges, undefined, tok.cat);
    check(guest?.ok === false && guest.reason === "guest" && guestSync?.account === false && balance(CAT) === -1, "a guest has no badges, title or rewards");
    const others = await call(fns.getCardBadges, { playerIds: [ANA, CAT, EVE] }, tok.ben);
    const anaCard = (others as { playerId: string; badges: string[]; title: string; foundingNumber: number | null }[]).find((c) => c.playerId === ANA);
    check(anaCard?.badges.join() === "founding-player" && anaCard.title === "founding-player" && typeof anaCard.foundingNumber === "number", "another player reads Ana's card badges, title and number");
    check(!(others as { playerId: string }[]).some((c) => c.playerId === CAT), "a guest has no public card badges");
  });

  await section("grants and RLS", async () => {
    const tables = ["badges", "titles", "player_badges", "card_badges", "card_titles", "daily_streak_freezes"];
    const leaks: string[] = [];
    for (const role of ["anon", "authenticated", "service_role"])
      for (const t of tables)
        for (const priv of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"])
          if (q(`SELECT has_table_privilege('${role}', 'public.${t}', '${priv}')`) === "t") leaks.push(`${role} ${priv} ${t}`);
    check(leaks.length === 0, `no API role may write a badge table${leaks.length ? ` (${leaks.slice(0, 4).join("; ")})` : ""}`);
    const fnsList = ["badge_award(uuid,text,jsonb)", "badge_set_card(uuid,text[])", "badge_set_title(uuid,text)", "badge_mark_seen(uuid,text[])", "daily_streak_freeze(uuid,date)", "daily_history(uuid)", "economy_credit(uuid,integer,text,text,text,text)"];
    const exec: string[] = [];
    for (const role of ["anon", "authenticated"]) for (const f of fnsList) if (q(`SELECT has_function_privilege('${role}', 'public.${f}', 'EXECUTE')`) === "t") exec.push(`${role} ${f}`);
    check(exec.length === 0, `anon and authenticated can't award badges, pay coins or set cards (${exec.join("; ") || "none"})`);
    const eve = deviceDb(tok.eve);
    const tries = await Promise.all([
      eve.rpc("badge_award", { p_user_id: EVE, p_badge: "founding-player", p_detail: {} }),
      eve.rpc("economy_credit", { p_user_id: EVE, p_amount: 1000, p_reason: "signup_reward", p_ref_kind: null, p_ref_id: null, p_key: "phone" }),
      eve.from("player_badges").insert({ user_id: EVE, badge: "founding-player" }),
      eve.from("card_titles").insert({ user_id: EVE, title: "founding-player" }),
      deviceDb(null).rpc("badge_award", { p_user_id: EVE, p_badge: "founding-player", p_detail: {} }),
    ]);
    check(tries.every((t) => t.error) && !hasBadge(EVE, "founding-player") && balance(EVE) === 1000, `a phone (signed in or not) is refused every award, payment and write (${tries.map((t) => (t.error ? "x" : "OK")).join("")})`);
    const own = await deviceDb(tok.ana).from("player_badges").select("user_id");
    const rows = (own.data ?? []) as { user_id: string }[];
    check(!own.error && rows.length > 0 && rows.every((r) => r.user_id === ANA), "a player reads only their own badges");
  });

  await section("stored facts: 200s, buzzer, fast finishes, rooms hosted, gems, Daily streaks", async () => {
    q(`SELECT public.create_profile('${FAY}', 'Fay_Facts', 6::smallint, DATE '1990-01-01', NULL)`);
    q(`SELECT public.create_profile('${GIL}', 'Gil_Host', 7::smallint, DATE '1990-01-01', NULL)`);
    const has = (b: string) => hasBadge(FAY, b);
    const sync = async (tok: string) => call(fns.syncMyBadges, undefined, tok);
    const tokFay = accountToken(FAY);
    let n = 0;
    const room = (host: string, order: string[]) => {
      const id = uid(7000 + ++n);
      q(`INSERT INTO public.duels (id, room_code, host_user_id, status, round_order) VALUES ('${id}', 'F${String(n).padStart(3, "0")}', '${host}', 'finished', '${JSON.stringify(order)}'::jsonb)`);
      return id;
    };
    const seat = (duel: string, slot: number, user: string) =>
      q(`INSERT INTO public.duel_players (duel_id, player_slot, user_id, display_name) VALUES ('${duel}', ${slot}, '${user}', 'P${slot}')`);
    const result = (duel: string, slot: number, round: number, score: number, correct: boolean, ms: number) =>
      q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, is_correct, ms_remaining) VALUES ('${duel}', ${slot}, ${round}, ${score}, ${correct}, ${ms})`);
    const archived = (duel: string, gameIndex: number, slot: number, user: string, game: string, score: number, correct: boolean, ms: number, limit: number | null) =>
      q(`INSERT INTO public.round_results_archive (id, duel_id, game_index, player_slot, user_id, round_number, game_id, score, is_correct, ms_remaining, time_limit_ms, submitted_at)
         VALUES (gen_random_uuid(), '${duel}', ${gameIndex}, ${slot}, '${user}', 1, '${game}', ${score}, ${correct}, ${ms}, ${limit === null ? "NULL" : limit}, now())`);

    // A Daily round finished at the buzzer's edge (Buzzer Beater): 999 ms left counts, 0 ms (after the buzzer) doesn't.
    const limits = (await import("../src/lib/badges/badges.server")).puzzleLimits();
    const puzzleType = Object.keys(limits).find((t) => t === "gridlock") ?? Object.keys(limits)[0]!;
    const arcadeType = "pinball";
    check(limits[arcadeType] === undefined && limits[puzzleType]! > 0, `puzzle clocks for every puzzle, none for an arcade game (${puzzleType} ${limits[puzzleType]} ms)`);
    const asyncRoom = (order: string[]) => {
      const id = uid(7500 + ++n);
      q(`INSERT INTO async_rooms (id, kind, room_key, day, seed, round_order, round_count, opens_at, closes_at) VALUES
         ('${id}', 'daily_puzzle', 'daily_puzzle:f${n}', DATE '2026-11-01', 1, '${JSON.stringify(order)}'::jsonb, ${order.length}, now(), now() + interval '1 day')`);
      const att = q(`INSERT INTO async_attempts (room_id, user_id, display_name) VALUES ('${id}', '${FAY}', 'F') RETURNING id`).split("\n")[0]!.trim();
      return { id, att };
    };
    const asyncResult = (r: { id: string; att: string }, round: number, score: number, correct: boolean, ms: number) =>
      q(`INSERT INTO async_results (room_id, attempt_id, user_id, round_number, started_at, answered, is_correct, ms_remaining, score)
         VALUES ('${r.id}', '${r.att}', '${FAY}', ${round}, now(), true, ${correct}, ${ms}, ${score})`);
    const a1 = asyncRoom([puzzleType, puzzleType, arcadeType]);
    asyncResult(a1, 1, 120, true, 0);
    asyncResult(a1, 2, 130, false, 500);
    asyncResult(a1, 3, 150, true, 500);
    await sync(tokFay);
    check(!has("buzzer-beater"), "Buzzer Beater just missed: 0 ms left (after the buzzer), an unfinished puzzle and an arcade run don't count");
    const a2 = asyncRoom([puzzleType]);
    asyncResult(a2, 1, 125, true, 999);
    await sync(tokFay);
    check(has("buzzer-beater"), "Buzzer Beater: a puzzle finished with 999 ms left");

    // Speed Demon: 10 finishes in under a third of the clock (more than two thirds left), from rooms and the archive.
    const lim = limits[puzzleType]!;
    const fast = Math.floor((lim * 2) / 3) + 1;
    const r1 = room(FAY, Array(9).fill(puzzleType));
    seat(r1, 1, FAY);
    for (let i = 1; i <= 8; i++) result(r1, 1, i, 150, true, fast);
    result(r1, 1, 9, 150, true, Math.floor((lim * 2) / 3)); // exactly a third used: not under
    archived(r1, 0, 1, FAY, arcadeType, 150, true, 59_000, 60_000); // an arcade run: never a puzzle finish
    let mine = await sync(tokFay);
    check(!has("speed-demon") && mine?.progress?.["speed-demon"] === 8, `Speed Demon just missed at 8 (exactly a third doesn't count) (${mine?.progress?.["speed-demon"]})`);
    archived(r1, 0, 1, FAY, puzzleType, 150, true, fast, null);
    archived(r1, 1, 1, FAY, puzzleType, 150, true, 40_000, 45_000); // a stored clock wins
    mine = await sync(tokFay);
    check(has("speed-demon"), `Speed Demon: the 10th fast finish, from the archive (${mine?.progress?.["speed-demon"]})`);

    // Flawless and Perfectionist: 200s in different games (rooms, archive, Daily).
    check(!has("flawless"), "Flawless just missed: no 200 yet (150 is the most so far)");
    const types = Object.keys(limits).slice(0, 25);
    archived(r1, 2, 1, FAY, types[0]!, 200, true, 0, null);
    mine = await sync(tokFay);
    check(has("flawless") && !has("perfectionist") && mine?.progress?.["perfectionist"] === 1, "Flawless: a 200; Perfectionist at 1 of 25");
    for (const t of types.slice(1, 24)) archived(r1, 2, 1, FAY, t, 200, true, 0, null);
    archived(r1, 3, 1, FAY, types[0]!, 200, true, 0, null); // the same game again: still one game
    mine = await sync(tokFay);
    check(!has("perfectionist") && mine?.progress?.["perfectionist"] === 24, `Perfectionist just missed at 24 different games (${mine?.progress?.["perfectionist"]})`);
    archived(r1, 3, 1, FAY, types[24]!, 201, true, 0, null);
    await sync(tokFay);
    check(has("perfectionist"), "Perfectionist: 25 different games at 200");

    // Results a challenge copied from Fay's own room don't count again.
    const c = asyncRoom([puzzleType]);
    q(`INSERT INTO challenges (code, room_id, created_by, round_count, selected_categories, source, source_duel_id, expires_at) VALUES
       ('FAYCPY', '${c.id}', '${FAY}', 1, '{}', 'room', '${r1}', now() + interval '7 days')`);
    const before = (await sync(tokFay))?.progress?.["speed-demon"];
    asyncResult(c, 1, 150, true, fast);
    const after = (await sync(tokFay))?.progress?.["speed-demon"];
    check(before === after, `a challenge's copy of the player's own room isn't counted twice (${before} → ${after})`);

    // Party Host: 25 room games hosted with 3+ players (rooms on now and the archive); 2 players never count.
    let rooms = 0;
    const hostGame = (host: string, players: number, archive: boolean) => {
      const r = room(host, [puzzleType]);
      for (let s2 = 1; s2 <= players; s2++) {
        if (archive) archived(r, 0, s2, s2 === 1 ? host : FAY, puzzleType, 10, false, 0, null);
        else result(r, s2, 1, 10, false, 0);
      }
      rooms++;
    };
    for (let i = 0; i < 12; i++) hostGame(GIL, 3, false);
    for (let i = 0; i < 12; i++) hostGame(GIL, 4, true);
    hostGame(GIL, 2, false);
    const g1 = await sync(accountToken(GIL));
    check(!hasBadge(GIL, "party-host") && g1?.progress?.["party-host"] === 24, `Party Host just missed: 24 games with 3+ (and one of 2) (${g1?.progress?.["party-host"]})`);
    hostGame(GIL, 3, true);
    await sync(accountToken(GIL));
    check(hasBadge(GIL, "party-host"), `Party Host: the 25th (${rooms} hosted in all)`);

    // Challenger, Challenge Seeker, Challenge Expert: completed Practice challenges in C1b's table (through its own
    // writer, public.challenge_record); recorded-but-not-met ones don't count.
    const record = (i: number, met: boolean) =>
      q(`SELECT public.challenge_record('${FAY}', 'gridlock.c${i}', 'gridlock', 5, ${met}, 0)`);
    for (let i = 0; i < 9; i++) record(i, true);
    for (let i = 9; i < 15; i++) record(i, false);
    mine = await sync(tokFay);
    check(!has("challenger") && mine?.progress?.["challenger"] === 9, `Challenger just missed at 9 (6 started, not met) (${mine?.progress?.["challenger"]})`);
    record(9, true);
    mine = await sync(tokFay);
    check(has("challenger") && !has("challenge-seeker") && mine?.progress?.["challenge-seeker"] === 10, "Challenger: the 10th completed; Seeker at 10 of 50");
    for (let i = 10; i < 49; i++) record(i, true);
    await sync(tokFay);
    check(!has("challenge-seeker"), "Challenge Seeker just missed at 49");
    record(49, true);
    await sync(tokFay);
    check(has("challenge-seeker") && !has("challenge-expert"), "Challenge Seeker: 50");
    for (let i = 50; i < 99; i++) record(i, true);
    await sync(tokFay);
    check(!has("challenge-expert"), "Challenge Expert just missed at 99");
    record(99, true);
    await sync(tokFay);
    check(has("challenge-expert"), "Challenge Expert: 100");

    // First Star, All-Rounder and Gem Hunter: C1a's stored stars (public.practice_progress) and gems (gem_unlocks).
    const { ACTIVE_PUZZLE_TYPES: ACTIVE_TYPES, RETIRED_PUZZLE_TYPES } = await import("../src/lib/duel/catalogue");
    const star = (game: string, level = "classic") =>
      q(`INSERT INTO practice_progress (user_id, game_id, level, best_score, star_at, star_score)
         VALUES ('${FAY}', '${game}', '${level}', 180, now(), 180) ON CONFLICT DO NOTHING`);
    q(`INSERT INTO practice_progress (user_id, game_id, level, best_score) VALUES ('${FAY}', '${ACTIVE_TYPES[0]}', 'classic', 174)`);
    q(`INSERT INTO practice_progress (user_id, game_id, level, best_score) VALUES ('${FAY}', '${ACTIVE_TYPES[1]}', 'expert', 190)`);
    mine = await sync(tokFay);
    check(!has("first-star") && mine?.progress?.["all-rounder"] === 0, "First Star just missed: a best of 174, and Expert's 190 (a crown, never a star)");
    q(`DELETE FROM practice_progress WHERE user_id = '${FAY}'`);
    star(ACTIVE_TYPES[0]!);
    mine = await sync(tokFay);
    check(has("first-star") && !has("all-rounder") && mine?.progress?.["all-rounder"] === 1, "First Star: the first star; All-Rounder at 1");
    for (const t of ACTIVE_TYPES.slice(1, -1)) star(t, t.length % 2 ? "classic" : "hard");
    star(ACTIVE_TYPES[1]!, "easy"); // a second star in one game counts that game once
    if (RETIRED_PUZZLE_TYPES[0]) star(RETIRED_PUZZLE_TYPES[0]); // a retired game's star isn't an active game's
    mine = await sync(tokFay);
    check(!has("all-rounder") && mine?.progress?.["all-rounder"] === ACTIVE_TYPES.length - 1, `All-Rounder just missed: every active game but one (${mine?.progress?.["all-rounder"]} of ${ACTIVE_TYPES.length})`);
    star(ACTIVE_TYPES[ACTIVE_TYPES.length - 1]!);
    await sync(tokFay);
    check(has("all-rounder"), `All-Rounder: a star in all ${ACTIVE_TYPES.length} active games`);
    check(!has("gem-hunter"), "Gem Hunter just missed: no gem yet");
    q(`INSERT INTO gem_unlocks (user_id, gem) VALUES ('${FAY}', 'amber')`);
    await sync(tokFay);
    check(has("gem-hunter"), "Gem Hunter: the first gem colour");

    // Practice counts only from C1a's fresh start: a 200 graded before it never counts, one after it does.
    const freshAt = q(`SELECT fresh_start_at FROM practice_progress_start`);
    const gil = accountToken(GIL);
    const play = (game: string, score: number, at: string) =>
      q(`INSERT INTO practice_plays (user_id, game_id, score, is_correct, ms_remaining, time_limit_ms, duration_ms, revision, example, flagged, timed_out, created_at)
         VALUES ('${GIL}', '${game}', ${score}, true, 0, 60000, 60000, '{}'::jsonb, false, false, false, ${at})`);
    play(ACTIVE_TYPES[0]!, 200, `TIMESTAMPTZ '${freshAt}' - interval '1 hour'`);
    await sync(gil);
    check(!hasBadge(GIL, "flawless"), "a Practice 200 from before C1a's fresh start doesn't count");
    play(ACTIVE_TYPES[0]!, 200, `TIMESTAMPTZ '${freshAt}' + interval '1 minute'`);
    await sync(gil);
    check(hasBadge(GIL, "flawless"), "a Practice 200 after the fresh start counts (Flawless)");

    // Daily Habit: 6 days in a row just misses, 7 earns (the longest run, from the server's history).
    const today = ukDayKey(Date.now());
    const dailyOn = (user: string, back: number) => {
      const id = uid(8000 + ++n);
      const d = shiftDayKey(today, -back);
      q(`INSERT INTO async_rooms (id, kind, room_key, day, seed, round_count, opens_at, closes_at) VALUES
         ('${id}', 'daily_arcade', 'daily_arcade:${d}:${n}', DATE '${d}', 1, 1, now(), now() + interval '1 day')`);
      q(`INSERT INTO async_attempts (room_id, user_id, display_name) VALUES ('${id}', '${user}', 'P')`);
    };
    for (let k = 10; k < 16; k++) dailyOn(GIL, k);
    for (let k = 0; k < 2; k++) dailyOn(GIL, k);
    const g2 = await sync(accountToken(GIL));
    check(!hasBadge(GIL, "daily-habit") && g2?.progress?.["daily-habit"] === 2, `Daily Habit just missed: 6 days in a row; progress shows today's streak (${g2?.progress?.["daily-habit"]})`);
    dailyOn(GIL, 16);
    await sync(accountToken(GIL));
    check(hasBadge(GIL, "daily-habit") && !hasBadge(GIL, "dedicated"), "Daily Habit: 7 in a row (an earlier run counts); Dedicated not yet");
    check(Number(q(`SELECT count(*) FROM player_badges WHERE user_id = '${FAY}' AND badge IN ('daily-habit', 'dedicated', 'century')`)) === 0, "a player with no Dailies has no streak badge");
  });

  await section("daily streak on the account", async () => {
    const today = ukDayKey(Date.now());
    const day = (n: number) => shiftDayKey(today, -n);
    let room = 0;
    const play = (user: string, n: number, finished = 0) => {
      const id = uid(9000 + ++room);
      const d = day(n);
      q(`INSERT INTO async_rooms (id, kind, room_key, day, seed, round_count, opens_at, closes_at) VALUES
         ('${id}', 'daily_puzzle', 'daily_puzzle:${d}:${room}', DATE '${d}', 1, 1, now(), now() + interval '1 day')`);
      q(`INSERT INTO async_attempts (room_id, user_id, display_name, finished_at, total_score) VALUES
         ('${id}', '${user}', 'P', ${finished ? "now()" : "NULL"}, ${finished})`);
    };
    // Ana: played today, yesterday and the day before; a best of 612.
    play(ANA, 0, 612);
    play(ANA, 1, 400);
    play(ANA, 2);
    const a1 = await call(fns.getMyDailyRecord, undefined, tok.ana);
    const a2 = await call(fns.getMyDailyRecord, undefined, tok.ana2);
    check(a1?.streak === 3 && a1.playedToday === true && a1.best?.puzzle === 612, `played three days: streak 3, played today, best 612 (${JSON.stringify(a1).slice(0, 140)})`);
    check(JSON.stringify(a1) === JSON.stringify(a2), "the same on two devices of one account");
    // Eve: missed yesterday, no freezes: today alone.
    play(EVE, 0);
    play(EVE, 2);
    play(EVE, 3);
    const e1 = await call(fns.getMyDailyRecord, undefined, tok.eve);
    check(e1?.streak === 1 && e1.freezesUsed.length === 0, "a missed day with no freeze breaks the streak");
    // Then a freeze arrives (as the pass or Plus will give): used automatically, once, recorded.
    q(`SELECT public.economy_grant_consumable('${EVE}', 'streak_freeze', 1, 'admin_adjustment', NULL, NULL, 'test-freeze')`);
    const e2 = await call(fns.getMyDailyRecord, undefined, tok.eve);
    check(e2?.streak === 3 && e2.freezesUsed.join() === day(1), `a freeze covers the missed day: streak 3 (${JSON.stringify(e2?.freezesUsed)})`);
    check(q(`SELECT count(*) FROM daily_streak_freezes WHERE user_id = '${EVE}' AND day = DATE '${day(1)}'`) === "1", "the covered day is recorded");
    check(q(`SELECT count FROM consumable_balances WHERE user_id = '${EVE}' AND kind = 'streak_freeze'`) === "0" && q(`SELECT count(*) FROM consumable_ledger WHERE user_id = '${EVE}' AND reason = 'streak_freeze_used'`) === "1", "one freeze taken, on the ledger");
    const e3 = await call(fns.getMyDailyRecord, undefined, tok.eve);
    check(e3?.streak === 3 && e3.freezesUsed.length === 0, "asking again uses nothing more and keeps the streak");
    const open = JSON.parse(q(`SELECT public.daily_streak_freeze('${EVE}', DATE '${today}')::text`)) as { status: string };
    check(open.status === "open_day", "today (still open) can't be frozen");
    // A guest gets theirs too; a second device's guest is a different user and stays separate.
    play(CAT, 0);
    play(CAT, 1);
    const c = await call(fns.getMyDailyRecord, undefined, tok.cat);
    const g = await call(fns.getMyDailyRecord, undefined, tok.gus);
    check(c?.streak === 2 && g?.streak === 0, "a guest's streak comes from the server; a second device's guest is separate");
    const gFreeze = JSON.parse(q(`SELECT public.daily_streak_freeze('${CAT}', DATE '${day(5)}')::text`)) as { status: string };
    check(gFreeze.status === "no_account", "a guest holds no freezes");
  });
}
