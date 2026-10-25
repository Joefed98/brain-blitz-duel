/**
 * round-max-check (25 Oct 2026, the 200-point foundation; docs/scoring-200.md, src/lib/duel/roundMax.ts).
 *
 *   1. Today: every game's round maximum is 150, the ceiling is 200, every game has its line, and the
 *      chart, texts, perfect moment and bands read exactly as they did with 150 written in.
 *   2. One game raised (withRoundMax(type, 200), for every game in turn): its intro and "?" help state
 *      200 where they stated 150 and change nowhere else, every other game's texts stay as they are,
 *      its reveal chart's scale ends at 200, its perfect moment, Perfectionist, signature threshold and
 *      score bands move to the 200 scale, and every other game keeps 150.
 *   3. The wiring: the screens read the game's maximum, never a written-in 150.
 *   4. Practice bests v3: old (v2 and unversioned) bests are never read after the switch.
 *   5. Room arcade bests v2 (rooms, daily, challenge): old records are never read, the first new run is no "New best!".
 *
 *   bun scripts/round-max-check.ts
 */
import { readFileSync } from "node:fs";

import { chartLabels, chartPoint, chartRow, chartScore, layoutMarkers } from "../src/lib/duel/arcadeChart";
import { GAME_DISPLAY_NAMES } from "../src/lib/duel/gameNames";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { podiumAwards, type AwardRound } from "../src/lib/duel/podiumAwards";
import {
  DEFAULT_ROUND_MAX,
  ROUND_MAX,
  SCORE_CEILING,
  isPerfectScore,
  isValidRoundScore,
  roundMaxFor,
  scaledToMax,
  scoreBandFloor,
  scoreBandOf,
  topRoundMax,
  withRoundMax,
} from "../src/lib/duel/roundMax";
import type { DuelPlayerRow, PuzzleType, RoundResultRow } from "../src/lib/duel/types";
import { SIGNATURE_MIN_SCORE, signatureMinScore, signatureTierForVerdict } from "../src/lib/fx/signature";

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 60) failures.push(message);
}

const TYPES = Object.keys(GAME_DISPLAY_NAMES) as PuzzleType[];
/** A stated 200 (not the 200 in "1,200 ms" or "7,200 points"). */
const TOP200 = /(?<![\d,.])200(?![\d,]*\d)/g;
const texts = (type: PuzzleType) => ({ intro: INTRO_SCORE[type], help: PUZZLE_INSTRUCTIONS[type].score, lines: JSON.stringify({ ...PUZZLE_INSTRUCTIONS[type], score: "" }) });

/* 1. Today. */
ok(SCORE_CEILING === 200 && DEFAULT_ROUND_MAX === 150, "the ceiling is 200 and the default 150");
ok(TYPES.length >= 80 && TYPES.every((t) => t in ROUND_MAX) && Object.keys(ROUND_MAX).every((t) => t in GAME_DISPLAY_NAMES), "every game has its own maximum line, and only games do");
for (const type of TYPES) ok(ROUND_MAX[type] === 150 && roundMaxFor(type) === 150, `${type}: its maximum is 150 today (${ROUND_MAX[type]})`);
ok(roundMaxFor("no-such-game") === 150 && roundMaxFor(null) === 150, "an unknown or removed game is 150");
ok(Object.values(ROUND_MAX).every((m) => m <= SCORE_CEILING), "no maximum above the ceiling");
ok(topRoundMax().top === 150 && topRoundMax().shared, "the onboarding's top score is 150, shared by every game");
ok(JSON.stringify(chartLabels().map((l) => l.text)) === '["0","50","100","150"]', "the chart reads 0 / 50 / 100 / 150");
ok(signatureMinScore("wordsmith") === SIGNATURE_MIN_SCORE && SIGNATURE_MIN_SCORE === 120, "the no-finish beat still needs 120");
ok(scaledToMax("snake", 110) === 110 && scaledToMax("snake", 120) === 120, "thresholds on the 150 scale are unchanged at 150");
for (const [score, band] of [[150, "perfect"], [149, "near-perfect"], [130, "near-perfect"], [129, "great"], [110, "great"], [109, "good"], [90, "good"], [89, "decent"], [80, "decent"], [79, "average"], [60, "average"], [59, "low"], [0, "low"]] as const)
  ok(scoreBandOf("tilegrid", score) === band, `bands at 150: ${score} is ${band} (${scoreBandOf("tilegrid", score)})`);
ok(isPerfectScore("hover", 150) && !isPerfectScore("hover", 149) && !isPerfectScore("hover", null), "perfect is 150 only");
ok(isValidRoundScore("hover", 150) && !isValidRoundScore("hover", 151) && !isValidRoundScore("hover", -1) && !isValidRoundScore("hover", 1.5), "a valid score is a whole number 0–150");

/* 2. One game raised to 200. */
const baseline = new Map(TYPES.map((t) => [t, texts(t)]));
const players = [1, 2].map((slot) => ({ player_slot: slot, status: "active", display_name: `P${slot}` }) as unknown as DuelPlayerRow);
const row = (slot: number, score: number) =>
  ({ player_slot: slot, round_number: 1, score, is_correct: true, ms_remaining: 0, reaction_avg_ms: null, extra: null }) as unknown as RoundResultRow;
const perfectionist = (type: PuzzleType, score: number) =>
  podiumAwards(players, [row(1, score), row(2, 10)], [{ type, name: "Game", timeLimitMs: 60_000, timed: false } satisfies AwardRound]).find((a) => a.id === "perfect");

for (const type of TYPES) {
  const before = baseline.get(type)!;
  const statesTop = /\b150\b/.test(before.intro.replace(/150 ms/g, ""));
  withRoundMax(type, 200, () => {
    ok(roundMaxFor(type) === 200, `${type}: the override reads back`);
    const now = texts(type);
    // Only the maximum's figures moved: putting 150 back gives today's text exactly. An open game's
    // ", 150 at N" (openBandsLine) is where today's scoring reaches the maximum, so it drops out until the
    // expansion's scoring reaches 200; a band curve's own top ("150 at 24,000") is the curve and stays.
    const dropTop = (text: string) => text.replace(/, 150 at [^;]*?(?=;|\. |\.$)/g, "");
    ok(now.intro.replace(TOP200, "150") === before.intro, `${type}: its intro changed beyond the maximum`);
    ok(now.lines === before.lines, `${type}: its goal or how-to lines changed`);
    ok(now.help.replace(TOP200, "150") === before.help || now.help.replace(TOP200, "150") === dropTop(before.help), `${type}: its help changed beyond the maximum`);
    if (statesTop) ok(/\b200\b/.test(now.intro), `${type}: the intro still states 150, not its 200 maximum: "${now.intro}"`);
    ok(!/\b150\b/.test(now.intro.replace(/150 ms/g, "")), `${type}: the intro still says 150: "${now.intro}"`);
    // The chart's axis.
    const labels = chartLabels(roundMaxFor(type)).map((l) => l.text);
    ok(labels[0] === "0" && labels[3] === "200", `${type}: the chart's top label is its maximum (${labels.join("/")})`);
    ok(chartScore(250, roundMaxFor(type)) === 200 && chartRow(200, roundMaxFor(type)) === 2 && chartPoint(200, roundMaxFor(type)).x === 1 && chartPoint(150, roundMaxFor(type)).x < 1, `${type}: 200 sits at the end of the line, 150 short of it`);
    const [m] = layoutMarkers([{ key: 1, score: 200, name: "Sam" }], 300, roundMaxFor(type));
    ok(m?.row === 2 && m.px === 300, `${type}: a 200 marker sits at the line's end`);
    // The perfect moment and Perfectionist.
    ok(!isPerfectScore(type, 150) && isPerfectScore(type, 200), `${type}: perfect is 200, not 150`);
    ok(perfectionist(type, 150) === undefined && perfectionist(type, 200)?.line === "A perfect 200 in Game", `${type}: Perfectionist follows the maximum`);
    // The signature beat's no-finish threshold and the bands.
    ok(signatureMinScore(type) === 160, `${type}: the no-finish beat needs 160 of 200 (${signatureMinScore(type)})`);
    ok(scoreBandFloor(type, "perfect") === 200 && scoreBandFloor(type, "near-perfect") === 173 && scoreBandFloor(type, "great") === 147 && scoreBandFloor(type, "average") === 80, `${type}: bands on the 200 scale`);
    ok(scoreBandOf(type, 150) === "great" && scoreBandOf(type, 199) === "near-perfect" && scoreBandOf(type, 200) === "perfect", `${type}: a 150 is great, 200 perfect`);
    ok(isValidRoundScore(type, 200) && !isValidRoundScore(type, 201), `${type}: valid scores run to 200`);
    ok(topRoundMax().top === 200 && !topRoundMax().shared, `${type}: the onboarding's top becomes 200, no longer every game's`);
    // Every other game is untouched.
    const other = type === "hover" ? "tilegrid" : "hover";
    ok(roundMaxFor(other) === 150 && isPerfectScore(other, 150) && signatureMinScore(other) === 120, `${type}: ${other} keeps 150`);
  });
  ok(roundMaxFor(type) === 150, `${type}: the override ends with its call`);
}
// Every other game's texts are untouched by one game's change (checked once for a sample, all games each way).
for (const raised of ["snake", "tilegrid", "wordsmith", "reaction"] as const) {
  withRoundMax(raised, 200, () => {
    for (const type of TYPES) if (type !== raised) ok(JSON.stringify(texts(type)) === JSON.stringify(baseline.get(type)), `${raised} raised: ${type}'s texts changed`);
  });
}
for (const type of TYPES) ok(JSON.stringify(texts(type)) === JSON.stringify(baseline.get(type)), `${type}: texts back to today's after the overrides`);
// The beat itself on a no-finish game: a 150 at 200 no longer earns it.
withRoundMax("wordsmith", 200, () => {
  const v = { type: "wordsmith" as PuzzleType, arcade: false, correct: true, msRemaining: 0, timeLimitMs: 90_000 };
  ok(signatureTierForVerdict({ ...v, score: 150 }) === null && signatureTierForVerdict({ ...v, score: 160 }) === "solve", "Nucleus at 200: 150 earns no beat, 160 does");
});

/* 3. The wiring: screens read the game's maximum. */
const read = (p: string) => readFileSync(p, "utf8");
ok(/score !== roundMaxFor\(type\)/.test(read("src/lib/fx/useSignature.ts")), "usePerfectBurst (the perfect moment and shared.perfect) reads the game's maximum");
ok(/<StoredScore score=\{myScore\} type=\{puzzle\.type\} \/>/.test(read("src/components/duel/AnswerReveal.tsx")), "the puzzle reveal passes its game to the perfect moment");
ok(/usePerfectBurst\(scoreRef, myScore, puzzle\.type\)/.test(read("src/components/duel/ArcadeReveal.tsx")) && /<ArcadeScoreChart[\s\S]*?type=\{puzzle\.type\}/.test(read("src/components/duel/ArcadeReveal.tsx")), "the arcade reveal passes its game to the perfect moment and the chart");
{
  const chart = read("src/components/duel/ArcadeScoreChart.tsx");
  ok(/const max = roundMaxFor\(type\)/.test(chart) && /lengthTo\(max\)/.test(chart) && /chartLabels\(max\)/.test(chart) && /chartPoint\(score, max\)/.test(chart) && !/\b150\b/.test(chart.replace(/MAX_EXTRA = 150/, "").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "the chart draws on its game's scale, no 150 written in");
}
ok(/isPerfectScore\(type, score\)/.test(read("src/components/async/AsyncResults.tsx")), "the daily and challenge results' top score reads the game's maximum");
ok(/roundMaxFor\(gameType\)/.test(read("src/components/duel/RoundResult.tsx")) && /gameType=\{puzzle\?\.type\}/.test(read("src/routes/duel.$code.tsx")), "the two-player round result's bars run to the game's maximum");
ok(/topRoundMax\(\)/.test(read("src/components/duel/Onboarding.tsx")) && !/\b150\b/.test(read("src/components/duel/Onboarding.tsx")), "the onboarding states the games' top, no 150 written in");
ok(!/MAX_ROUND_SCORE|\b150\b/.test(read("src/lib/duel/podiumAwards.ts").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "podium awards write in no 150");
ok(/roundMaxFor\(game\)/.test(read("src/lib/arcade/liveBands.ts")), "the band games' \"?\" help states its game's maximum");

/* 4. Practice bests v3. */
{
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  };
  const { PRACTICE_BEST_PREFIX, practiceBestKey, readPracticeBest, recordPracticeBest } = await import("../src/lib/duel/practiceBest");
  const { currentPracticeStamp } = await import("../src/lib/duel/practiceStamps");
  for (const type of TYPES) {
    const stamp = currentPracticeStamp(type);
    store.set(`duelz-practice-best:v2:${type}@${stamp}`, "140");
    store.set(`duelz-practice-best:${type}`, "150");
    ok(readPracticeBest(type, stamp) === null, `${type}: an old best is not read after the switch`);
    const first = recordPracticeBest(type, stamp, 12);
    ok(first.best === 12 && !first.improved && practiceBestKey(type, stamp).startsWith(PRACTICE_BEST_PREFIX), `${type}: the first new run starts the v3 best`);
    ok(store.get(`duelz-practice-best:v2:${type}@${stamp}`) === "140", `${type}: the old best is left in storage`);
  }
}

/* 5. Room arcade bests v2 (rooms, daily and challenge reveals): old records are never read after the switch. */
{
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  };
  const { ARCADE_ROOM_BEST_PREFIX, RETIRED_ARCADE_ROOM_BEST_PREFIXES, recordArcadeRoomBest } = await import("../src/lib/fx/arcadeBest");
  ok(ARCADE_ROOM_BEST_PREFIX === "duelz-arcade-room-best:v2:" && !RETIRED_ARCADE_ROOM_BEST_PREFIXES.includes(ARCADE_ROOM_BEST_PREFIX as never), "room arcade bests are stored under the v2 prefix");
  const arcade = TYPES.filter((t) => ["balltrack", "beat", "bintoss", "breaker", "pinball", "bubble", "bullseye", "burst", "cross", "flip", "hover", "inkbridge", "matchup", "orbit", "rally", "skyline", "slice", "snake", "snip", "swing", "tilt", "wavefront"].includes(t));
  ok(arcade.length === 22, `the 22 active arcade games (${arcade.length})`);
  for (const type of arcade) {
    // A device from before the switch: an old record that a low score would otherwise "beat" or lose to.
    const old = JSON.stringify({ best: 20, key: "old-run", improved: false });
    store.set(`duelz-arcade-room-best:${type}`, old);
    const first = recordArcadeRoomBest(type, 90, `${type}-first`);
    ok(first === false, `${type}: the first room run after the switch is never a "New best!" over an old record`);
    ok(JSON.parse(store.get(`${ARCADE_ROOM_BEST_PREFIX}${type}`) ?? "{}").best === 90, `${type}: the new record is written under v2`);
    ok(store.get(`duelz-arcade-room-best:${type}`) === old, `${type}: the old record is left in storage, unread`);
    ok(recordArcadeRoomBest(type, 80, `${type}-second`) === false && recordArcadeRoomBest(type, 95, `${type}-third`) === true, `${type}: later runs compare only with v2 records`);
  }
  const src = read("src/lib/fx/arcadeBest.ts");
  ok(!/removeItem|\.clear\(/.test(src) && (src.match(/getItem\(/g) ?? []).length === 1 && /const PREFIX = ARCADE_ROOM_BEST_PREFIX;/.test(src), "the only read is under the v2 prefix, and nothing is deleted");
  ok(/recordArcadeRoomBest\(puzzle\.type, myScore/.test(read("src/components/duel/ArcadeReveal.tsx")), "the room, daily and challenge arcade reveals record through it");
}

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL round-max-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS round-max-check: ${passes} checks — every game's maximum is 150 today; raising one moves its texts, chart, perfect moment, Perfectionist, signature threshold and bands together and no other game; old practice and room arcade bests are never read`);
