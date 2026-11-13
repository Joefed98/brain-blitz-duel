/**
 * retirement-check (13 Nov 2026, Joe's rule): retired games are out of the app. Every one of the 21 in RETIRED_TYPES
 * (src/lib/duel/catalogue.ts, the one switch) is hidden from every place a player can choose, play or earn from it, and
 * counts towards nothing from now on; nothing is deleted, and taking a game out of the set restores it.
 *
 *  1. The switch: 21 retired games (the nine of 13 Nov 2026 among them); isPlayable says no to each and yes to the 83
 *     live ones; the counts (live games, categories, groups) come from it.
 *  2. Where games are offered: room picks, the Dailies' categories, Score Attack's and the Category Cup's picks (every
 *     one holds at least 5 live games), offline packs, Warm up, Practice challenges, recorded rated runs, the Daily
 *     archive's days, friend challenges, the shop's pool and Customise's skins: no retired game anywhere.
 *  3. Counting: the star total is every live game × 3 (249), a retired game's star never counts, and every gem
 *     threshold is at most the live star total and rising (Diamond is every live star), so a retirement can't make a gem
 *     unreachable.
 *  4. Bring-back: with one game taken out of RETIRED_TYPES (in this process) every rule above offers it again.
 *  6. History stays true: 79 stored rounds of the nine games retired on 13 Nov 2026, graded on main f268bcd before the
 *     retirement (scripts/fixtures/retired-history.json.gz, `bun scripts/retired-history-record.ts <main checkout>`),
 *     replay and grade to the same score, verdict and stored extra today, two or more rounds of each game.
 *  5. The database (local PostgreSQL 16, every migration): the mirror holds the 21 and 249; the star total and the badge
 *     facts leave a retired game's stars and completions out but keep them stored; Diamond unlocks at every live star; a
 *     gem already unlocked stays; the server's sync restores a game; no client role can reach the mirror.
 *
 *   bun scripts/retirement-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";

import { ACTIVE_PUZZLE_TYPES, PUZZLE_TYPES, RETIRED_TYPES, isPlayable, typesInCategory } from "../src/lib/duel/catalogue";
import { ARCADE_GROUPS, arcadeGroupTypes } from "../src/lib/duel/arcadeGroups";
import { ACTIVE_ARCADE_GAMES, RETIRED_ARCADE_GAMES } from "../src/lib/arcade/arcadeFxGames.renderer";
import { ROOM_PICKS, pickTypes } from "../src/lib/duel/roomSettings";
import { CUP_ROTATION } from "../src/lib/tournaments/eventRules";
import { SCORE_ATTACK_ROUNDS } from "../src/config/tournamentConfig";
import { DAILY_PUZZLE_CATEGORIES } from "../src/lib/duel/daily";
import { packTypes } from "../src/lib/offline/packs";
import { warmUpTypes } from "../src/lib/duel/practiceRecent";
import { PRACTICE_CHALLENGES, challengeLive } from "../src/lib/duel/practiceChallenges";
import { recordedRefusal } from "../src/lib/rated/matchmaking";
import { holdsRetiredGame } from "../src/lib/plus/archive.server";
import { retiredClosed } from "../src/lib/duel/asyncRoom.server";
import { forRetiredGame } from "../src/lib/economy/retiredLooks";
import { gameLookRows } from "../src/lib/identity/customise";
import { GEM_THRESHOLDS, STAR_TOTAL_MAX, STARS_PER_GAME, starCounts } from "../src/lib/practice/progressRules";
import { retirementMirror } from "../src/lib/data/retirement.server";
import { postgresBin, startLocalDb, type LocalDb } from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(cond: unknown, label: string): void {
  if (cond) passes += 1;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

const NINE = ["stroop", "tiles", "rings", "lightsout", "stopwatch", "slice", "alleyroll", "bintoss", "bullseye"];
const EARLIER = ["rooftop", "swerve", "dual", "steady", "hotfloor", "dig", "junction", "wordfall", "snip", "pokersquares", "muggins", "golfsol"];
const retired = [...RETIRED_TYPES] as string[];

/* 1. The switch */
check(retired.length === 21 && [...NINE, ...EARLIER].every((t) => RETIRED_TYPES.has(t as never)), `21 retired games, the nine of 13 Nov 2026 among them (${retired.length})`);
check(retired.every((t) => !isPlayable(t)) && ACTIVE_PUZZLE_TYPES.every((t) => isPlayable(t)), "isPlayable: no for every retired game, yes for every live one");
check(ACTIVE_PUZZLE_TYPES.length === 83 && PUZZLE_TYPES.length === ACTIVE_PUZZLE_TYPES.length + retired.length, `83 live games (${ACTIVE_PUZZLE_TYPES.length})`);
check(!isPlayable("not-a-game") && !isPlayable(undefined), "an unknown id is never playable");
const arcadeRetired = retired.filter((t) => (ACTIVE_ARCADE_GAMES as readonly string[]).includes(t));
check(arcadeRetired.length === 0, `no retired game among the active arcade games (${arcadeRetired.join(", ")})`);
check(["slice", "alleyroll", "bintoss", "bullseye"].every((t) => (RETIRED_ARCADE_GAMES as readonly string[]).includes(t as never)), "the four retired arcade games are in RETIRED_ARCADE_GAMES");
check([...ACTIVE_ARCADE_GAMES].sort().join() === [...typesInCategory("arcade")].sort().join(), "the active arcade worlds are exactly the live Arcade games");

/* 2. Where games are offered */
const live = (types: readonly string[]) => types.every((t) => isPlayable(t));
check(ROOM_PICKS.every((p) => live(pickTypes(p))), "room picks hold live games only");
check(ARCADE_GROUPS.every((g) => live(arcadeGroupTypes(g.id))), "arcade groups deal live games only");
check(DAILY_PUZZLE_CATEGORIES.every((c) => live(typesInCategory(c))) && live(typesInCategory("arcade")), "the Dailies' pools hold live games only");
for (const pick of new Set([...ROOM_PICKS, ...CUP_ROTATION])) {
  const n = pickTypes(pick).length;
  check(n >= SCORE_ATTACK_ROUNDS && n >= 5, `Score Attack and the Category Cup: ${pick} holds at least 5 live games (${n})`);
}
check(live(packTypes()) && retired.every((t) => !(packTypes() as string[]).includes(t)), "offline packs: no retired game");
check(live(warmUpTypes([])) && warmUpTypes([]).length === 3 && live(warmUpTypes(["slice", "tiles", "stroop", "unblock"])), "Warm up: live games only, three of them");
const liveChallenges = PRACTICE_CHALLENGES.filter(challengeLive);
check(liveChallenges.every((c) => isPlayable(c.type)) && PRACTICE_CHALLENGES.some((c) => !isPlayable(c.type)), "Practice challenges: a retired game's are kept in the catalogue but never live");
const runOf = (types: string[]) => ({
  key: "k",
  source: "room" as const,
  ownerId: "o",
  ownerRating: null,
  format: null,
  choice: null,
  games: types.map((type) => ({ type, signature: "", flagged: false })),
  recordedAtMs: 1_000,
  usesToday: 0,
});
const ctx = { viewerId: "v", rating: 1500, format: "bo3" as const, choice: "mixed" as const, lastOwnerId: null, nowMs: 2_000, liveSignature: () => "" };
check(recordedRefusal(runOf(["slice", "unblock", "hover"]) as any, ctx as any) === "retired", "rated: a recorded run holding a retired game is never played against");
check(recordedRefusal(runOf(["sudoku", "unblock", "hover"]) as any, ctx as any) !== "retired", "rated: a run of live games is not refused for retirement");
check(holdsRetiredGame([{ type: "unblock" }, { type: "tiles" }]) && !holdsRetiredGame([{ type: "unblock" }, { type: "sudoku" }]), "the Daily archive hides a day that included a retired game");
check(retiredClosed({ kind: "challenge", puzzles_public: [{ type: "stopwatch" }] as any }) && !retiredClosed({ kind: "challenge", puzzles_public: [{ type: "reaction" }] as any }), "a friend challenge holding a retired game is closed");
check(retiredClosed({ kind: "daily_archive", puzzles_public: [{ type: "rings" }] as any }) && !retiredClosed({ kind: "daily_puzzle", puzzles_public: [{ type: "rings" }] as any }), "an archive replay holding one is closed; the day's own Daily is not touched");
check(forRetiredGame({ gameType: "pokersquares" }) && !forRetiredGame({ gameType: "pool" }) && !forRetiredGame({ gameType: null }), "the shop never sells a retired game's skin or theme");
const looks = gameLookRows(
  [
    { id: "game-skin.full-house.midnight-felt", gameType: "pokersquares" },
    { id: "game-skin.cue-ball.neon-8-ball", gameType: "pool" },
  ] as any,
  new Set(["game-skin.full-house.midnight-felt", "game-skin.cue-ball.neon-8-ball"]),
  {},
);
check(looks.games.every((g) => isPlayable(g.game)), "Customise offers no retired game's skins or themes");

/* 3. Counting */
check(STAR_TOTAL_MAX === ACTIVE_PUZZLE_TYPES.length * STARS_PER_GAME && STAR_TOTAL_MAX === 249, `the star total is every live game × 3 (${STAR_TOTAL_MAX})`);
check(!starCounts("slice", "classic") && starCounts("sudoku", "classic") && !starCounts("sudoku", "expert"), "a retired game's star never counts");
check(GEM_THRESHOLDS.every((g) => g.stars <= STAR_TOTAL_MAX), `every gem threshold is at most the live star total (${STAR_TOTAL_MAX})`);
check(GEM_THRESHOLDS.every((g, i) => i === 0 || g.stars > GEM_THRESHOLDS[i - 1]!.stars), "the gem thresholds rise");
check(GEM_THRESHOLDS.at(-1)!.gem === "diamond" && GEM_THRESHOLDS.at(-1)!.stars === STAR_TOTAL_MAX, "Diamond is every live star");
const mirror = retirementMirror();
check(mirror.starTotal === STAR_TOTAL_MAX && mirror.retired.join() === [...retired].sort().join(), "the server's mirror is RETIRED_TYPES and the star total");
const migration = readFileSync("supabase/migrations/20261117300000_retired_games.sql", "utf8");
const seed = /VALUES \(true, ARRAY\[([^\]]*)\]::text\[\], (\d+)\)/.exec(migration);
const seeded = seed ? [...seed[1]!.matchAll(/'([a-z]+)'/g)].map((m) => m[1]!).sort() : [];
check(seed !== null && seeded.join() === [...retired].sort().join() && Number(seed[2]) === STAR_TOTAL_MAX, "the migration seeds the mirror with today's list and total");

/* 4. Bring-back */
{
  RETIRED_TYPES.delete("tiles" as never);
  try {
    check(isPlayable("tiles") && (packTypes() as string[]).includes("tiles") && PRACTICE_CHALLENGES.filter(challengeLive).some((c) => c.type === "tiles"), "bring-back: out of the set, Gradient is playable, packed and challenged again");
    check(!holdsRetiredGame([{ type: "tiles" }]) && !retiredClosed({ kind: "challenge", puzzles_public: [{ type: "tiles" }] as any }), "bring-back: its archive days and challenges open again");
  } finally {
    RETIRED_TYPES.add("tiles" as never);
  }
  check(!isPlayable("tiles"), "the set is restored after the bring-back test");
}

/* 6. History stays true */
{
  const { gunzipSync } = await import("node:zlib");
  const { createHash } = await import("node:crypto");
  await import("../src/lib/duel/wordfallDict.server");
  const { gradeAnswer } = await import("../src/lib/duel/generate.server");
  const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v ?? null).replace(/"replayMs":[\d.]+,?/g, "")).digest("hex").slice(0, 20);
  const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/retired-history.json.gz")).toString("utf8")) as {
    recordedOn: string;
    rounds: { type: string; label: string; puzzle: any; answer: string; ms: number; score: number; isCorrect: boolean; extra: string }[];
  };
  const warn = console.warn;
  const error = console.error;
  console.warn = () => {};
  console.error = () => {};
  let same = 0;
  try {
    for (const r of fixture.rounds) {
      const g = gradeAnswer(r.puzzle, r.answer, r.ms);
      const match = g.score === r.score && g.isCorrect === r.isCorrect && digest(g.extra) === r.extra;
      if (match) same += 1;
      else check(false, `history: ${r.type} ${r.label} grades as on main ${fixture.recordedOn} (${g.score} vs ${r.score})`);
    }
  } finally {
    console.warn = warn;
    console.error = error;
  }
  check(same === fixture.rounds.length, `history: all ${fixture.rounds.length} stored rounds of the nine replay and grade identically (${same})`);
  check(NINE.every((t) => fixture.rounds.filter((r) => r.type === t).length >= 2), "history: every one of the nine has stored rounds in the fixture");
}

/* 5. The database */
if (!postgresBin()) {
  if (process.env["CI"]) check(false, "no PostgreSQL binaries on the CI runner");
  else console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
} else {
  let db: LocalDb | null = null;
  try {
    db = startLocalDb("retirement-check-");
    check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    const q = (sql: string) => {
      const r = db!.psql(sql);
      if (!r.ok) console.log(`  (sql) ${r.err.trim()}`);
      return r.out.trim();
    };
    check(q("SELECT array_length(retired, 1) || ':' || star_total FROM public.game_retirement;") === "21:249", "the mirror holds 21 games and 249 stars");
    const U = "00000000-0000-4000-8000-0000000000a1";
    q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ('${U}', false, 'r@example.com');
       INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth) VALUES ('${U}', 'Retiree', 'retiree', 3, DATE '1990-01-01');`);
    // 248 live stars and one on a retired game (Gradient), and a completed challenge on each.
    const liveGames = ACTIVE_PUZZLE_TYPES.slice();
    const rows: string[] = [];
    for (const g of liveGames) for (const level of ["easy", "classic", "hard"]) rows.push(`('${U}', '${g}', '${level}', 190, now(), 190)`);
    rows.pop();
    rows.push(`('${U}', 'tiles', 'classic', 190, now(), 190)`);
    q(`INSERT INTO public.practice_progress (user_id, game_id, level, best_score, star_at, star_score) VALUES ${rows.join(", ")};`);
    check(q(`SELECT public.practice_star_total('${U}');`) === "248", "the star total leaves the retired game's star out (248 of 249)");
    check(q(`SELECT count(*) FROM public.practice_progress WHERE user_id = '${U}' AND game_id = 'tiles';`) === "1", "the retired game's star stays stored");
    check(!/diamond/.test(q(`SELECT public.practice_sync_gems('${U}');`)) && /obsidian/.test(q(`SELECT array_to_string(array_agg(gem), ',') FROM public.gem_unlocks WHERE user_id = '${U}';`)), "248 live stars unlock Obsidian, not Diamond");
    const lastGame = liveGames.at(-1)!;
    q(`INSERT INTO public.practice_progress (user_id, game_id, level, best_score, star_at, star_score) VALUES ('${U}', '${lastGame}', 'hard', 190, now(), 190);`);
    check(q(`SELECT public.practice_star_total('${U}');`) === "249" && /diamond/.test(q(`SELECT public.practice_sync_gems('${U}');`)), "every live star unlocks Diamond");
    const facts = q(`SELECT public.badge_facts('${U}', '{}'::jsonb)::text;`);
    check(/"stars": 249/.test(facts) && !/"tiles"/.test(facts), `the badge facts count live stars only and leave Gradient out of the starred games`);
    // Bring-back through the server's sync: Gradient counts again; a gem once unlocked stays.
    check(q(`SET ROLE service_role; SELECT public.game_retirement_sync(ARRAY['rooftop'], 252);`) === "t", "the server's sync changes the mirror");
    check(q(`SELECT public.practice_star_total('${U}');`) === "250", "bring-back: the restored game's star counts again");
    check(q(`SET ROLE service_role; SELECT public.game_retirement_sync(ARRAY['rooftop'], 252);`) === "f", "the sync writes only when the list changed");
    check(/diamond/.test(q(`SELECT array_to_string(array_agg(gem), ',') FROM public.gem_unlocks WHERE user_id = '${U}';`)), "a gem already unlocked stays unlocked");
    for (const role of ["anon", "authenticated"]) {
      check(!db.psql(`SET ROLE ${role}; SELECT * FROM public.game_retirement;`).ok, `${role} can't read the mirror`);
      check(!db.psql(`SET ROLE ${role}; SELECT public.game_retirement_sync(ARRAY[]::text[], 1);`).ok, `${role} can't sync it`);
      check(!db.psql(`SET ROLE ${role}; SELECT public.retired_game_ids();`).ok, `${role} can't read the retired ids`);
    }
  } catch (err) {
    check(false, `database: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    db?.stop();
  }
}

console.log(`retirement-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
