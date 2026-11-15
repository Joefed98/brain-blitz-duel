/**
 * difficulty-check (the difficulty framework, phase 2 step 4, 15 Nov 2026; docs/design/difficulty/README.md). No
 * browser, ~1 min. Proves:
 *
 *  1. The level type and the registry: four levels in order, Normal always offered and first, every registry entry a
 *     real game, the stored key mapping ("classic" is Normal) both ways.
 *  2. The standing rules: no game at any level has a clock over 120 s (every active game dealt at every level it
 *     offers, and at a level it lacks); every puzzle (non-arcade) game's non-Normal level names how its boards are
 *     proven to have exactly one solution (a check script that exists, or an open game's reason), and the rule
 *     refuses a stand-in that names none.
 *  3. Normal is exactly today's game: a deal asked at Normal, or at a level the game lacks, is byte for byte the deal
 *     asked with no level and carries no `level` field; a stand-in game's Hard deal carries `level: "hard"` in both
 *     halves; the generator is handed the resolved level.
 *  4. Where levels apply: rated matches and the Daily always deal Normal (modes.ts, and the server's deal names it);
 *     a room's level is stored as a token only when it isn't Normal, read back, validated and dealt to every round;
 *     ratings never mix levels (a recorded run holding another level is refused and is another game version).
 *  5. Bests and stars per level: Normal's values are the stored "classic" rows exactly; the migration only adds.
 *  6. The player's choice: the catalogue's level for every game, a game page's own choice, Normal without storage.
 *  7. The first-time explanation (Joe, 15 Nov 2026): shown once on a device, on the first selector seen, never on a
 *     second screen at the same time; it says rated matches and the Daily are always Normal; every selector draws it.
 *
 *   bun scripts/difficulty-check.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";

import { ACTIVE_PUZZLE_TYPES, PUZZLE_TYPES, puzzleDef, puzzleTimeLimitMs, usesArcadeClock } from "../src/lib/duel/catalogue";
import { buildRoomPuzzles, dealRounds, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import {
  DEFAULT_SETTINGS,
  encodeRoomSettings,
  readRoomSettings,
  roomLevelOf,
  validateRoomSettings,
  withRoomLevel,
} from "../src/lib/duel/roomSettings";
import { gameVersionOf, recordedRefusal, type RecordedCandidate } from "../src/lib/rated/matchmaking";
import {
  GAME_LEVELS,
  gameLevelSettings,
  hasLevels,
  levelProof,
  levelsOf,
  resolveLevel,
  withGameLevels,
  type GameLevels,
} from "../src/lib/levels/gameLevels";
import {
  LEVELS,
  MAX_ROUND_CLOCK_MS,
  NORMAL,
  isLevel,
  levelFromStored,
  puzzleLevel,
  storedLevelKey,
  type Level,
} from "../src/lib/levels/levels";
import { NORMAL_ONLY_MODES, modeLevel } from "../src/lib/levels/modes";
import { bestOf, starOf, type PracticeProgressView } from "../src/lib/practice/progress";

let failures = 0;
let passes = 0;
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
}
const json = (x: unknown) => JSON.stringify(x);
const deal = (type: PuzzleType, seed: number, level?: Level) =>
  withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level ? { level } : {}) }));

/* ------------------------------------------------------------------ 1. the type and the registry */

check(json(LEVELS) === json(["easy", "normal", "hard", "expert"]), "four levels in order: Easy, Normal, Hard, Expert");
check(NORMAL === "normal" && LEVELS.every(isLevel) && !isLevel("classic") && !isLevel(null), "Normal is today's game; only the four are levels");
const strayEntries = Object.keys(GAME_LEVELS).filter((t) => !(PUZZLE_TYPES as readonly string[]).includes(t));
check(strayEntries.length === 0, `every registry entry is a real game${strayEntries.length ? `: ${strayEntries.join(", ")}` : ""}`);
const badOffer = ACTIVE_PUZZLE_TYPES.filter((t) => levelsOf(t)[0] === "normal" ? false : !levelsOf(t).includes("normal"));
check(badOffer.length === 0 && ACTIVE_PUZZLE_TYPES.every((t) => levelsOf(t).includes("normal")), "every game offers Normal");
check(ACTIVE_PUZZLE_TYPES.every((t) => json(levelsOf(t)) === json(LEVELS.filter((l) => levelsOf(t).includes(l)))), "a game's levels are listed in LEVELS order");
check(storedLevelKey("normal") === "classic" && storedLevelKey("hard") === "hard" && storedLevelKey("easy") === "easy" && storedLevelKey("expert") === "expert", "Normal's stored key is the older 'classic'; the others keep their names");
check(levelFromStored("classic") === "normal" && levelFromStored(null) === "normal" && levelFromStored("junk") === "normal" && levelFromStored("hard") === "hard", "a stored key reads back as its level (classic, null and junk are Normal)");
check(LEVELS.every((l) => levelFromStored(storedLevelKey(l)) === l), "stored key and level round-trip for all four");

/* ------------------------------------------------------------------ 2. the standing rules */

/** The one-solution rule on a registry: the problems it finds. */
function oneSolutionProblems(reg: Partial<Record<string, GameLevels>>): string[] {
  const out: string[] = [];
  withGameLevels(reg, () => {
    for (const type of Object.keys(reg)) {
      const arcade = (PUZZLE_TYPES as readonly string[]).includes(type) && puzzleDef(type as PuzzleType).category === "arcade";
      for (const level of levelsOf(type)) {
        if (level === NORMAL) continue;
        const proof = levelProof(type, level);
        if (!proof) {
          if (!arcade) out.push(`${type} ${level}: no oneSolution`);
          continue;
        }
        if ("proof" in proof) {
          if (!/^scripts\/[a-z0-9-]+-check\.tsx?$/.test(proof.proof) || !existsSync(proof.proof)) out.push(`${type} ${level}: proof ${proof.proof} is not a check script`);
        } else if (!proof.open.trim()) out.push(`${type} ${level}: an open game needs its reason`);
      }
    }
  });
  return out;
}
const problems = oneSolutionProblems(GAME_LEVELS);
check(problems.length === 0, `every puzzle game's non-Normal level names its one-solution proof${problems.length ? `: ${problems.join("; ")}` : ""}`);
check(
  oneSolutionProblems({ tents: { levels: { hard: { settings: {} } } } }).length === 1 &&
    oneSolutionProblems({ tents: { levels: { hard: { settings: {}, oneSolution: { proof: "scripts/not-there-check.ts" } } } } }).length === 1 &&
    oneSolutionProblems({ tents: { levels: { hard: { settings: {}, oneSolution: { proof: "scripts/difficulty-check.ts" } } } } }).length === 0 &&
    oneSolutionProblems({ tilt: { levels: { hard: { settings: {} } } } }).length === 0,
  "the one-solution rule refuses a puzzle level with no proof or a missing script, and takes a real check (arcade games need none)",
);

// The clock rule: every active game at every level it offers, and at a level it lacks (dealt as Normal).
const SEED = 4242;
const clockOver: string[] = [];
const started = performance.now();
for (const type of ACTIVE_PUZZLE_TYPES) {
  const asked = new Set<Level>([...levelsOf(type), ...(hasLevels(type) ? [] : (["hard"] as Level[]))]);
  for (const level of asked) {
    let puzzle: PuzzleData;
    try {
      puzzle = deal(type, SEED, level);
    } catch (e) {
      clockOver.push(`${type} ${level}: the deal failed (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    // An arcade run's clock is its run length: the definition's 3 s of slack after the buzzer (catalogue.ts) is not play.
    const ms = puzzleTimeLimitMs(puzzle) - (usesArcadeClock(type) ? 3000 : 0);
    if (!(ms > 0 && ms <= MAX_ROUND_CLOCK_MS)) clockOver.push(`${type} ${level}: ${ms} ms`);
  }
}
check(clockOver.length === 0, `no game at any level has a clock over 120 s (${ACTIVE_PUZZLE_TYPES.length} games, ${Math.round(performance.now() - started)} ms)${clockOver.length ? `: ${clockOver.join("; ")}` : ""}`);

/* ------------------------------------------------------------------ 3. Normal is today's game */

const SAMPLE: PuzzleType[] = ["tents", "tubes", "kakuro", "flow", "wordsmith", "reaction", "tilt", "orbit", "freecell", "pool"].filter((t) =>
  (ACTIVE_PUZZLE_TYPES as readonly string[]).includes(t),
) as PuzzleType[];
const notSame: string[] = [];
for (const type of SAMPLE) {
  const plain = json(deal(type, 77));
  if (json(deal(type, 77, "normal")) !== plain) notSame.push(`${type} normal`);
  if (!hasLevels(type) && json(deal(type, 77, "expert")) !== plain) notSame.push(`${type} expert`);
  if ("level" in (deal(type, 77, "normal") as object)) notSame.push(`${type} carries level`);
}
check(notSame.length === 0, `a Normal deal (or one at a level the game lacks) is byte for byte today's deal, with no level field (${SAMPLE.join(", ")})${notSame.length ? `: ${notSame.join(", ")}` : ""}`);

const STAND: Partial<Record<string, GameLevels>> = {
  tents: { levels: { hard: { settings: { stand: 1 }, oneSolution: { proof: "scripts/difficulty-check.ts" } } } },
  tilt: { levels: { easy: { settings: { stand: 2 } } } },
};
withGameLevels(STAND, () => {
  check(json(levelsOf("tents")) === json(["normal", "hard"]) && json(levelsOf("tilt")) === json(["easy", "normal"]) && json(levelsOf("tubes")) === json(["normal"]), "a stand-in registry: each game lists exactly its levels");
  check(resolveLevel("tents", "hard") === "hard" && resolveLevel("tents", "expert") === "normal" && resolveLevel("tubes", "hard") === "normal" && resolveLevel("tents", null) === "normal", "a level a game lacks resolves to Normal");
  check(json(gameLevelSettings("tents", "hard")) === json({ stand: 1 }) && gameLevelSettings("tents", "normal") === null && gameLevelSettings("tubes", "hard") === null, "a level's settings come from its entry (none at Normal)");
  const hard = deal("tents", 91, "hard");
  check(puzzleLevel(hard) === "hard" && (hard as { level?: string }).level === "hard", "a Hard deal carries level: \"hard\"");
  const { pub, priv } = splitPuzzle(hard);
  check(puzzleLevel(pub) === "hard" && priv["level"] === "hard", "the level is in the public half and kept with the private half");
  const { level: _l, ...rest } = hard as unknown as Record<string, unknown>;
  check(json(rest) === json(deal("tents", 91)), "until the game's family session reads its settings, a Hard deal is the Normal board stamped with its level");
  const room = buildRoomPuzzles({ seed: 5150, roundOrder: ["tents", "tubes", "tilt"], level: "hard", recent: [], categories: [] });
  check(json(room.puzzles.map(puzzleLevel)) === json(["hard", "normal", "normal"]), "a Hard room deals every round at Hard where the game has it, Normal where it doesn't");
  const plainRoom = withSeededRandom(8, () => buildRoomPuzzles({ seed: 5150, roundOrder: ["tents", "tubes", "tilt"], recent: [], categories: [] }));
  const normalRoom = withSeededRandom(8, () => buildRoomPuzzles({ seed: 5150, roundOrder: ["tents", "tubes", "tilt"], level: "normal", recent: [], categories: [] }));
  const rounds = withSeededRandom(8, () => dealRounds(["tents", "tubes", "tilt"], { seed: 5150 }));
  check(json(plainRoom.puzzles) === json(rounds) && json(normalRoom.puzzles) === json(rounds), "a room at Normal deals exactly what a room with no level deals");
  const daily = readFileSync("src/lib/duel/daily.server.ts", "utf8");
  check(/level: modeLevel\("daily", null\)/.test(daily), "the Daily's deal names its level through modeLevel(\"daily\") (always Normal)");
});

// The generator is handed the resolved level (the one place it is read before stamping).
const gen = readFileSync("src/lib/duel/generate.server.ts", "utf8");
check(/const level = resolveLevel\(type, requested\.level\);/.test(gen) && /\{ \.\.\.requested, level \}/.test(gen) && /stampLevel\(dealAtLevel\(type, context\), level\)/.test(gen), "the deal resolves the level, hands it to the generator in its context and stamps it");

/* ------------------------------------------------------------------ 4. where levels apply */

check(json(NORMAL_ONLY_MODES) === json(["rated", "daily"]), "rated matches and the Daily are the Normal-only modes");
check(LEVELS.every((l) => modeLevel("rated", l) === "normal" && modeLevel("daily", l) === "normal"), "rated and the Daily deal Normal whatever is asked");
check(LEVELS.every((l) => modeLevel("practice", l) === l && modeLevel("room", l) === l && modeLevel("tournament", l) === l) && modeLevel("practice", null) === "normal", "practice, rooms and tournaments deal the level asked (Normal by default)");
const rated = readFileSync("src/lib/rated/rated.server.ts", "utf8");
check(/level: modeLevel\("rated", null\)/.test(rated), "the rated deal (createDealtMatchRoom) names its level through modeLevel(\"rated\")");

// Rooms: the stored token.
check(json(encodeRoomSettings(DEFAULT_SETTINGS)) === json(encodeRoomSettings(withRoomLevel(DEFAULT_SETTINGS, "normal"))) && !encodeRoomSettings(DEFAULT_SETTINGS).some((v) => v.startsWith("level:")), "a Normal room stores no level token (every room saved before levels reads the same)");
const hardRoom = withRoomLevel(DEFAULT_SETTINGS, "hard");
const stored = encodeRoomSettings(hardRoom);
check(stored.at(-1) === "level:hard" && roomLevelOf(readRoomSettings(stored).settings) === "hard", "a Hard room stores level:hard last and reads it back");
check(json(readRoomSettings(encodeRoomSettings(DEFAULT_SETTINGS)).settings) === json(DEFAULT_SETTINGS), "a Normal room's settings read back with no level field");
check(roomLevelOf(readRoomSettings(["word", "rounds:6", "groups:2", "level:junk"]).settings) === "normal" && readRoomSettings(["word", "logic"]).legacy, "a junk token reads as Normal; a legacy room is untouched");
const okHard = validateRoomSettings({ picks: ["logic"], rounds: 3, level: "hard" });
const okNone = validateRoomSettings({ picks: ["logic"], rounds: 3 });
check(okHard.ok && okHard.settings.level === "hard" && okNone.ok && !("level" in okNone.settings), "the server takes a level, and keeps Normal when none is sent");
const bad = validateRoomSettings({ picks: ["logic"], rounds: 3, level: "classic" });
check(!bad.ok && /Easy, Normal, Hard or Expert/.test(bad.message), "the server refuses anything that isn't a level");
const duel = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
check(/level: stored\.legacy \? undefined : roomLevelOf\(stored\.settings\)/.test(duel), "a room's start deals its rounds at the room's level");

// Ratings never mix levels.
const normalPuzzle = deal("tents", 31);
const hardPuzzle = { ...(normalPuzzle as object), level: "hard" } as PuzzleData;
check(gameVersionOf(hardPuzzle) === `${gameVersionOf(normalPuzzle)} level=hard` && !gameVersionOf(normalPuzzle).includes("level="), "a game dealt at another level is another game version; Normal's version is unchanged");
const candidate = (level?: Level): RecordedCandidate => ({
  key: "room:x:1",
  source: "room",
  ownerId: "b",
  ownerRating: 1500,
  format: null,
  choice: null,
  games: ["tents", "tubes", "kakuro"].map((type) => ({ type, signature: "s", score: 100, finishMs: null, timeline: null, ...(level ? { level } : {}) })),
  recordedAtMs: 1_000,
  usesToday: 0,
});
const ctx = { viewerId: "a", rating: 1500, format: "bo3" as const, choice: "mixed" as const, lastOwnerId: null, nowMs: 2_000, liveSignature: () => "s" };
check(recordedRefusal(candidate("hard"), ctx) === "level" && recordedRefusal(candidate("easy"), ctx) === "level", "a recorded run holding a game at another level is never played against");
check(recordedRefusal(candidate(), ctx) !== "level" && recordedRefusal(candidate("normal"), ctx) !== "level", "a Normal run is not refused for its level");

/* ------------------------------------------------------------------ 5. bests and stars per level */

const view: PracticeProgressView = {
  games: { tents: { classic: { best: 182, star: true, starScore: 182 }, hard: { best: 150, star: false, starScore: null } } },
  stars: 1,
  gems: [],
  noteSeen: true,
  freshStartAt: null,
};
check(bestOf(view, "tents") === 182 && bestOf(view, "tents", storedLevelKey("normal")) === 182 && starOf(view, "tents", storedLevelKey("normal")), "Normal's best and star are the stored 'classic' row exactly");
check(bestOf(view, "tents", storedLevelKey("hard")) === 150 && !starOf(view, "tents", storedLevelKey("hard")) && bestOf(view, "tents", storedLevelKey("expert")) === null, "each level keeps its own best and star");
const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const mine = migrations.find((f) => f.endsWith("_difficulty_levels.sql"));
check(Boolean(mine) && migrations.at(-1) === mine, `the levels migration is dated after everything before it (${mine})`);
const sql = mine ? readFileSync(`supabase/migrations/${mine}`, "utf8").replace(/--.*$/gm, "") : "";
check(!/\b(UPDATE|DELETE|DROP TABLE|DROP COLUMN|TRUNCATE)\b/i.test(sql) && /ADD COLUMN IF NOT EXISTS level/.test(sql), "the migration only adds (no row rewritten): the tournament level column and the name mapping");
const practiceFns = readFileSync("src/lib/duel/practice.functions.ts", "utf8");
check(/if \(level !== "classic"\) return \[\];/.test(practiceFns), "challenges stay on Normal: a run at any other level completes none");
check(/modeLevel\("practice", data\.level \?\? null\)/.test(practiceFns) && /oneOf\(x, LEVELS, "level"\)/.test(practiceFns), "practice deals the level asked, validated as one of the four");

/* ------------------------------------------------------------------ 6. the player's choice */

const memory = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
} as Storage;
const choice = await import("../src/lib/levels/levelChoice");
choice.resetLevelChoiceCache();
check(choice.levelChoiceNow().catalogue === "normal" && choice.chosenLevel("tents") === "normal", "with nothing stored, every game is Normal");
choice.setCatalogueLevel("hard");
check(choice.chosenLevel("tents") === "hard" && choice.chosenLevel("tilt") === "hard", "the catalogue's switch sets the level for every game");
check(choice.playLevel("tents") === "normal", "a game without that level plays Normal");
choice.setGameLevel("tents", "easy");
check(choice.chosenLevel("tents") === "easy" && choice.chosenLevel("tilt") === "hard", "a game page's choice is that game's own");
choice.resetLevelChoiceCache();
check(choice.chosenLevel("tents") === "easy" && choice.levelChoiceNow().catalogue === "hard", "the choice is remembered on the device");
choice.setCatalogueLevel("normal");
check(choice.chosenLevel("tents") === "normal", "changing the catalogue's level clears each game's own choice");
memory.set(choice.LEVEL_CHOICE_KEY, "{not json");
choice.resetLevelChoiceCache();
check(choice.levelChoiceNow().catalogue === "normal", "an unreadable record is Normal");

/* ------------------------------------------------------------------ 7. the first-time explanation */

const intro = await import("../src/lib/levels/levelIntro");
memory.clear();
intro.resetLevelIntroMemory();
const first = Symbol("catalogue");
const second = Symbol("game page");
check(!intro.levelIntroSeen(), "a new device hasn't seen the explanation");
check(intro.claimLevelIntro(first) && intro.claimLevelIntro(first), "the first selector seen shows it (and keeps it while it is up)");
check(!intro.claimLevelIntro(second), "a second selector at the same time doesn't show it again");
check(intro.levelIntroSeen() && memory.has(intro.LEVEL_INTRO_KEY), "it is marked seen on the device as soon as it is shown");
intro.releaseLevelIntro(first);
check(!intro.claimLevelIntro(second), "after Got it, no selector shows it again this visit");
intro.resetLevelIntroMemory();
check(!intro.claimLevelIntro(Symbol("later")), "nor on a later visit");
check(/Rated matches and the Daily are always Normal\./.test(intro.LEVEL_INTRO_TEXT) && /Easy, Normal, Hard or Expert/.test(intro.LEVEL_INTRO_TEXT), "it names the four levels and says rated matches and the Daily are always Normal");
check(intro.LEVEL_INTRO_TEXT.length <= 140, `it is short (${intro.LEVEL_INTRO_TEXT.length} characters)`);
const drawnBy = ["src/components/games/GamesCatalogue.tsx", "src/components/games/GamePage.tsx", "src/components/duel/RoomSettingsSheet.tsx"].filter((f) => /<LevelIntro \/>/.test(readFileSync(f, "utf8")));
check(drawnBy.length === 3, `every level selector draws the explanation (${drawnBy.length} of 3)`);

console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: difficulty-check, ${passes} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
