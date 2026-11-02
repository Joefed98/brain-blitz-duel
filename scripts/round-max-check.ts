/**
 * round-max-check (25 Oct 2026, the 200-point foundation; docs/scoring-200.md, src/lib/duel/roundMax.ts).
 *
 *   1. Today: every game's round maximum is 150 or, once its expansion raised it, the ceiling (200);
 *      every game has its line; the 150 scale's chart, texts, perfect moment and bands read exactly as
 *      they did with 150 written in, and every raised game is on the 200 scale (perfect, bands, the
 *      signature threshold, valid scores, a text stating its 200).
 *   2. One game raised (withRoundMax(type, 200), for every game still at 150 in turn): its intro and "?" help state
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
import { typesInCategory } from "../src/lib/duel/registry";
import { ACTIVE_ARCADE_GAMES } from "../src/lib/arcade/arcadeFxGames.renderer";
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
import { WORD_DEPTH_GAMES } from "../src/lib/duel/wordDepth";
import { NUMBER_DEPTH_GAMES } from "../src/lib/duel/numberDepth";
import { SIGNATURE_MIN_SCORE, signatureMinScore, signatureTierForVerdict } from "../src/lib/fx/signature";

const failures: string[] = [];
let passes = 0;
function ok(cond: boolean, message: string): void {
  if (cond) passes++;
  else if (failures.length < 60) failures.push(message);
}

const ALL_TYPES = Object.keys(GAME_DISPLAY_NAMES) as PuzzleType[];
/**
 * Games an expansion has raised to the ceiling, one list for every expansion (docs/scoring-200.md: each adds its
 * games here): the Number depth games and Tenfall and Trail (#152), Coral Pop, Gemstone and Ball Tracker (E6,
 * #153), Topsy-Turvy and Jumbled (the D5 remodels, #156), the twelve Speed and Attention games (depth D3, #160), the
 * nine word puzzles (word depth d1, #157), the eleven Logic depth games (d6, #159), depth batch 4's eight (#158),
 * High Rise and Pinball (E4, #161), Swish and Slice (E5, #162), Breaker (E3, #168) and Meteor and Tempo (E2). Checked
 * against ROUND_MAX below, so the list and the maximums can't drift apart.
 */
const RAISED: PuzzleType[] = [
  "target", "equation", "numline", "numpyramid", "balance", "measure", "checkout", "tendrop", "trail", "bubble", "matchup", "balltrack",
  // Depth D3 (docs/depth/d3-speed-attention.md): the twelve Speed and Attention games.
  "reaction", "numhunt", "stopwatch", "chain", "whack", "clayshoot", "stroop", "symscan", "spotdiff", "countup", "maze", "pairmatch",
  // The D5 remodels (docs/depth/d5-remodels.md): Topsy-Turvy and Jumbled.
  "gravity", "tiles",
  // Word depth d1 (docs/depth/d1-word.md): the nine word puzzles.
  "wordsmith", "wordhunt", "wordslide", "tilegrid", "letterwheel", "strikeout", "codeword", "swapword", "wordsearch",
  // Logic depth d6 (docs/depth/d6-logic.md): the eleven Logic and Pattern games on depthRev 1.
  "lightsout", "sudoku", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup",
  // Depth batch 4 (docs/depth/d4-pattern.md): eight Pattern / Logic games.
  "unblock", "blockparty", "pipes", "flow", "iceslide", "push", "laser", "rings",
  // The Sports group (30 Oct 2026): Minigolf, Speed Pool and Curling, on the arcade standard from their first stamp.
  "minigolf", "pool", "curling",
  // Expansion E4 (docs/expansions/e4.md): High Rise and Pinball.
  "skyline", "pinball",
  // The Sports group (30 Oct 2026, docs/arcade-standard/): born on the arcade scoring standard at 200.
  "homerun", "freekick", "racing",
  // World expansion E5 (docs/expansions/e5.md): Swish and Slice.
  "bintoss", "slice",
  // Expansion E3 (docs/expansions/e3.md): Breaker.
  "breaker",
  // The 200-point expansion (docs/expansions/x200-snip.md): Scrumper.
  "snip",
  // Expansion E2 (docs/expansions/e2.md): Meteor and Tempo.
  "snake", "beat",
  // Expansion E7 (docs/expansions/x200-flip.md): Roofbound flipRev 8.
  "flip",
  // The 200 expansions (docs/expansions/x200-hover.md): Hover.
  "hover",
  // Grappler's 200 expansion (docs/expansions/x200-swing.md): swingRev 13.
  "swing",
  // The expansions to 200 under the arcade rule (docs/expansions/x200-*.md): Orbit, Wavefront, Rainbow Bridge, Tilt, Jaywalk.
  "orbit",
  "wavefront",
  "inkbridge",
  "tilt",
  "cross",
  // Expansion E9 (docs/expansions/e9.md): Rally, Fission and Flightpath.
  "rally", "burst", "bullseye",
  // Cards & Board (30 Oct 2026, docs/arcade-standard/minesweeper.md and mahjong.md): born on the arcade scoring standard.
  "minesweeper", "mahjong",
  // Cards & Board (30 Oct 2026, docs/arcade-standard/freecell.md, tripeaks.md, pokersquares.md): born on the standard.
  "freecell", "tripeaks", "pokersquares",
  // Five Hands (31 Oct 2026, docs/arcade-standard/fivehands.md): born on the standard.
  "fivehands",
  // The new grid puzzles (1 Nov 2026, docs/scoring-standard.md "New grid puzzles"): born on the puzzle scoring standard.
  "fences", "fillomino", "bridges", "kakuro",
];
/** The games still at 150: section 2 raises each of them in turn. */
const TYPES = ALL_TYPES.filter((t) => ROUND_MAX[t] === DEFAULT_ROUND_MAX);
/** A game still at 150 for the samples below (the preferred one while it is). */
const at150 = (preferred: PuzzleType, not?: PuzzleType): PuzzleType =>
  TYPES.includes(preferred) && preferred !== not ? preferred : TYPES.find((t) => t !== not)!;
/** Expansion E6's games: their intros state the 200 themselves (not only the help). */
const E6_RAISED: PuzzleType[] = ["bubble", "matchup", "balltrack", "rally", "burst", "bullseye"];
/** Expansion E4's games: their intro and their help both state the 200 and never 150. */
const E4_RAISED: PuzzleType[] = ["skyline", "pinball"];
/** A stated 200 (not the 200 in "1,200 ms" or "7,200 points"). */
const TOP200 = /(?<![\d,.])200(?![\d,]*\d)/g;
const texts = (type: PuzzleType) => ({ intro: INTRO_SCORE[type], help: PUZZLE_INSTRUCTIONS[type].score, lines: JSON.stringify({ ...PUZZLE_INSTRUCTIONS[type], score: "" }) });


/* 1. Today. */
ok(SCORE_CEILING === 200 && DEFAULT_ROUND_MAX === 150, "the ceiling is 200 and the default 150");
ok(ALL_TYPES.length >= 80 && ALL_TYPES.every((t) => t in ROUND_MAX) && Object.keys(ROUND_MAX).every((t) => t in GAME_DISPLAY_NAMES), "every game has its own maximum line, and only games do");
ok(JSON.stringify([...RAISED].sort()) === JSON.stringify(ALL_TYPES.filter((t) => ROUND_MAX[t] === SCORE_CEILING).sort()), `RAISED lists exactly the games ROUND_MAX puts at 200 (${ALL_TYPES.filter((t) => ROUND_MAX[t] === SCORE_CEILING).join(", ")})`);
for (const type of ALL_TYPES) ok((ROUND_MAX[type] === 150 || ROUND_MAX[type] === 200) && roundMaxFor(type) === ROUND_MAX[type], `${type}: its maximum is 150, or 200 once raised (${ROUND_MAX[type]})`);
ok(TYPES.length >= 2, "at least two games still at 150 for the samples below");
// The depth sessions' games (word d1: wordDepth.ts; number: numberDepth.ts) are exactly the raised ones listed so far.
for (const type of [...WORD_DEPTH_GAMES, ...(Object.keys(NUMBER_DEPTH_GAMES) as PuzzleType[])]) ok(RAISED.includes(type), `${type}: raised to 200 by its depth PR`);
// The raised games (each expansion's own checks prove its texts and scoring): on the 200 scale.
for (const type of RAISED) {
  ok(!isPerfectScore(type, 150) && !isPerfectScore(type, 199) && isPerfectScore(type, 200), `${type}: perfect is 200 only`);
  ok(scoreBandFloor(type, "perfect") === 200 && scoreBandFloor(type, "near-perfect") === 173 && scoreBandFloor(type, "great") === 147 && scoreBandFloor(type, "average") === 80 && scoreBandOf(type, 150) === "great", `${type}: bands on the 200 scale`);
  ok(signatureMinScore(type) === 160 && isValidRoundScore(type, 200) && !isValidRoundScore(type, 201), `${type}: the beat needs 160 and valid scores run to 200`);
  ok(scaledToMax(type, 120) === 160 && isPerfectScore(type, 200) && !isPerfectScore(type, 150), `${type}: raised, its thresholds and perfect are on the 200 scale`);
  ok(chartLabels(roundMaxFor(type)).map((l) => l.text)[3] === "200", `${type}: the chart's top label is 200`);
  ok(TOP200.test(INTRO_SCORE[type] + " " + PUZZLE_INSTRUCTIONS[type].score), `${type}: its intro or help states its 200 maximum`);
  TOP200.lastIndex = 0;
}
for (const type of E4_RAISED) {
  ok(/\b200\b/.test(INTRO_SCORE[type]) && !/\b150\b/.test(INTRO_SCORE[type]), `${type} (raised): its intro states 200: "${INTRO_SCORE[type]}"`);
  ok(/\b200\b/.test(PUZZLE_INSTRUCTIONS[type].score) && !/\b150\b/.test(PUZZLE_INSTRUCTIONS[type].score), `${type} (raised): its help states 200: "${PUZZLE_INSTRUCTIONS[type].score}"`);
}
for (const type of E6_RAISED) ok(/\b200\b/.test(INTRO_SCORE[type]) && !/\b150\b/.test(INTRO_SCORE[type]), `${type}: the intro states its 200: "${INTRO_SCORE[type]}"`);
ok(roundMaxFor("no-such-game") === 150 && roundMaxFor(null) === 150, "an unknown or removed game is 150");
ok(Object.values(ROUND_MAX).every((m) => m <= SCORE_CEILING), "no maximum above the ceiling");
ok(RAISED.length ? topRoundMax().top === 200 && !topRoundMax().shared : topRoundMax().top === 150 && topRoundMax().shared, `the onboarding's top score is ${RAISED.length ? "200, not every game's" : "150, shared by every game"}`);
ok(JSON.stringify(chartLabels().map((l) => l.text)) === '["0","50","100","150"]', "the chart reads 0 / 50 / 100 / 150");
const [S_WORD, S_SNAKE, S_TILE, S_HOVER] = [at150("wordsmith"), at150("snake"), at150("tilegrid"), at150("hover")];
ok(signatureMinScore(S_WORD) === SIGNATURE_MIN_SCORE && SIGNATURE_MIN_SCORE === 120, `the no-finish beat still needs 120 (${S_WORD})`);
ok(scaledToMax(S_SNAKE, 110) === 110 && scaledToMax(S_SNAKE, 120) === 120, `thresholds on the 150 scale are unchanged at 150 (${S_SNAKE})`);
for (const [score, band] of [[150, "perfect"], [149, "near-perfect"], [130, "near-perfect"], [129, "great"], [110, "great"], [109, "good"], [90, "good"], [89, "decent"], [80, "decent"], [79, "average"], [60, "average"], [59, "low"], [0, "low"]] as const)
  ok(scoreBandOf(S_TILE, score) === band, `bands at 150: ${score} is ${band} (${S_TILE}: ${scoreBandOf(S_TILE, score)})`);
ok(isPerfectScore(S_HOVER, 150) && !isPerfectScore(S_HOVER, 149) && !isPerfectScore(S_HOVER, null), `perfect is 150 only (${S_HOVER})`);
ok(isValidRoundScore(S_HOVER, 150) && !isValidRoundScore(S_HOVER, 151) && !isValidRoundScore(S_HOVER, -1) && !isValidRoundScore(S_HOVER, 1.5), `a valid score is a whole number 0–150 (${S_HOVER})`);

/* 2. One game raised to 200. */
const baseline = new Map(ALL_TYPES.map((t) => [t, texts(t)]));
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
    const other = at150("hover", type);
    ok(roundMaxFor(other) === 150 && isPerfectScore(other, 150) && signatureMinScore(other) === 120, `${type}: ${other} keeps 150`);
  });
  ok(roundMaxFor(type) === ROUND_MAX[type], `${type}: the override ends with its call`);
}
// Every other game's texts are untouched by one game's change (checked once for a sample, all games each way).
for (const raised of [at150("snake"), at150("tilegrid"), at150("wordsmith"), at150("reaction")]) {
  withRoundMax(raised, 200, () => {
    for (const type of ALL_TYPES) if (type !== raised) ok(JSON.stringify(texts(type)) === JSON.stringify(baseline.get(type)), `${raised} raised: ${type}'s texts changed`);
  });
}
for (const type of ALL_TYPES) ok(JSON.stringify(texts(type)) === JSON.stringify(baseline.get(type)), `${type}: texts back to today's after the overrides`);
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
ok(!/\b150\b|MAX_ROUND_SCORE/.test(read("src/components/async/AsyncResults.tsx")), "the daily and challenge results write in no 150 (batch R dropped their top-score highlight)");
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
  for (const type of ALL_TYPES) {
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
  // The active arcade games as the registry deals them (the counts read the registry since the new groups, 30 Oct 2026).
  const arcade = ALL_TYPES.filter((t) => typesInCategory("arcade").includes(t));
  ok(arcade.length === ACTIVE_ARCADE_GAMES.length && arcade.every((t) => (ACTIVE_ARCADE_GAMES as readonly string[]).includes(t)) && !arcade.includes("snip"), `the active arcade games, the arcade worlds' active list (Scrumper practice only since 27 Oct 2026) (${arcade.length})`);
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
console.log(`PASS round-max-check: ${passes} checks — every game's maximum is 150 today${RAISED.length ? ` but ${RAISED.length} raised to 200 (${RAISED.join(", ")})` : ""}; raising one moves its texts, chart, perfect moment, Perfectionist, signature threshold and bands together and no other game; old practice and room arcade bests are never read`);
