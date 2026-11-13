/**
 * practice-goals-check (6 Nov 2026): Practice's mastery stars and challenges (src/lib/duel/practiceGoals.ts,
 * practiceChallenges.ts; device storage and presentation only).
 *
 *  1–2. (Changed with Joe's approval, 13 Nov 2026: the device stars these sections tested, bronze 120 / silver 160 /
 *     gold 190 and the star line, are removed; stars live on the account, practice-progress-check.) The goals module
 *     holds no device stars any more.
 *  3. The challenge list (the full catalogue since wave 2 C1b, 11 Nov 2026: 261 over the 92 active games, 217 Classic
 *     live, the 40 first ids kept): 2–4 for each active game, unique ids, built only from what each game already measures:
 *     an arcade part's label and maximum are the live spec's (LIVE_BANDS std and ARCADE_STANDARD), a puzzle's bonus and
 *     speed are its standard rules' (patternRules.ts, logicRules.ts, word.ts), the speed goal's seconds the rule's
 *     "full by" time, and every puzzle is graded on the standard (STANDARD_GAMES).
 *  4. Progress from recorded results, in the server's own stored formats (stdLines for arcade parts, standardFinish
 *     and the standard grader's extra for puzzles): a part's best in one run, a finish's bonus and speed, a single run's
 *     score (Tempo: 180 or more); partial runs, older (non-standard) puzzles and other games' runs never count; done stays done.
 *  5. Storage survives a reload (the record is read back from storage alone); corrupt or blocked storage falls back
 *     safely; the record is one key, never a practice best's; (Changed with Joe's approval, 13 Nov 2026: the proof that
 *     clearing the stored stars never disturbs the challenge record) a record stored with device stars keeps its
 *     challenges exactly when the stars are dropped.
 *  6. Wiring: practice and the offline queue record every graded run's goals from the server's score and extra; the
 *     list, rows and intro show stars; the new-best moment carries the star line; nothing in rooms or the server
 *     imports the goals but the server's challenge checker and the Profile challenges section (Joe, 11 Nov 2026).
 *  7. The full catalogue (wave 2 C1b): every number in every goal's text against what its check reads, from the live
 *     specs, rules and sims (scripts/practice-challenge-numbers.ts), and the catalogue against
 *     docs/challenges/catalogue.md (names, goals, levels, coin marks, every score goal's number).
 *
 * Assertion changes Joe approved in the wave 2 C1b session (for the merge captain: each changed assertion carries
 * "APPROVED by Joe, <date>, change (n)" with the old assertion and the limits he set):
 *   (1) 10 Nov 2026 session, answered 11 Nov 2026: 40 challenges → 261 (217 Classic live).
 *   (2) 11 Nov 2026: 20 games with 2 each → all 92 active games with 2 to 4 each.
 *   (3) 11 Nov 2026: reward "Badge" for all → coins on the marked ones; the inactive ones pinned too (13 Hard at 100,
 *       9 Expert at 250). Revised 11 Nov 2026 (change (9)): the ones that pay no coins show no reward at all.
 *   (4) 11 Nov 2026: goal text ≤ 44 → ≤ 64 characters, provided a check proves the longest goal fits the narrowest
 *       supported phone without truncation (practice-challenge-fit-check, 320 and 375 px).
 *   (5) 11 Nov 2026: a part goal may target the core only for the named challenges, as an explicit allow-list
 *       (CORE_PART_ALLOWED: King of the swingers, Skyscraper, Moonwalker, and the others listed there and reported).
 *   (6) 11 Nov 2026: score goals exactly "Score 180 or more" → any score, every score goal's number checked against
 *       the catalogue (section 7).
 *   (7) 11 Nov 2026: bullseye.score180 must exist → replaced by bullseye.on-a-roll.
 *   (8) 11 Nov 2026: the import allow-list → also, by name only, the server's challenge checker
 *       (src/lib/challenges/challenges.server.ts) and the Profile challenges section (src/components/app/ProfileChallenges.tsx).
 *   (9) 11 Nov 2026: no reward on the challenges that pay no coins (was "Badge"); the coin pins unchanged.
 *
 *   bun scripts/practice-goals-check.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { stdLines, type StdPart } from "../src/lib/arcade/arcadeStandard";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
// Change (8)'s new files import challengeLive; the rest of this import is unchanged.
import { PRACTICE_CHALLENGES, challengeLive, challengeTarget, challengesFor, challengeValueOf } from "../src/lib/duel/practiceChallenges";
import { PAR_MOVES_STD, PAR_STRICT_FULL_BY_S } from "../src/lib/duel/parMoves";
import { GRID_STANDARD } from "../src/lib/duel/standard/gridRules";
import { NUMBER_STANDARD } from "../src/lib/duel/standard/number";
import { ASCEND_STD, CHAIN_STD, COUNT_STD, PAIR_STD, SPOT_STD } from "../src/lib/duel/standard/attention";
import { STD_LOOKOUT, STD_ROUNDABOUT } from "../src/lib/duel/standard/word";
import { numbersReport } from "./practice-challenge-numbers";
// Changed with Joe's approval, 13 Nov 2026: STAR_THRESHOLDS, starLine, starTotal, starsFor and starsOf left out of this import (the device stars are removed).
import {
  PRACTICE_GOALS_KEY,
  challengeState,
  readGoals,
  recordPracticeGoals,
  resetGoalsMemoryForChecks,
} from "../src/lib/duel/practiceGoals";
import { PRACTICE_BEST_PREFIX } from "../src/lib/duel/practiceBest";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_TYPES } from "../src/lib/duel/registry";
// Changed with Joe's approval, 13 Nov 2026: ROUND_MAX no longer imported (only the removed gold-star reach line read it).
import { standardFinish, standardUnfinished } from "../src/lib/duel/standard/shape";
import { PATTERN_STD } from "../src/lib/duel/standard/patternRules";
import { LOGIC_STANDARD } from "../src/lib/duel/standard/logicRules";
import { STD_CRYPTOGRID, STD_SLIDER, STD_SWAPWORD } from "../src/lib/duel/standard/word";
import { STANDARD_GAMES } from "../src/lib/duel/standard/games.server";
import type { PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 60) failures.push(message);
}

/* A device's storage: a plain map that can be made to throw. */
const store = new Map<string, string>();
let blocked = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => {
      if (blocked) throw new Error("blocked");
      return store.has(k) ? store.get(k)! : null;
    },
    setItem: (k: string, v: string) => {
      if (blocked) throw new Error("blocked");
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  },
};
const reload = () => resetGoalsMemoryForChecks();
const wipe = () => {
  store.clear();
  reload();
};

/* ------------------------------------------------------------------ 1–2. the retired device stars */
// Changed with Joe's approval, 13 Nov 2026: sections 1 (thresholds, starsFor, the gold reach, starTotal's 3 a game and 276) and 2 (stars kept,
// starLine, starsOf) are removed with the device stars they tested (stars only; stars live on the account since wave 2
// C1a, practice-progress-check). The 92 active games stay pinned in section 3.
check(!/STAR_THRESHOLDS|function starsFor|function starsOf|function starTotal|function starLine|STAR_NAMES/.test(readFileSync("src/lib/duel/practiceGoals.ts", "utf8")), "the device stars are gone from the goals module");

/* ------------------------------------------------------------------ 3. the list */
// APPROVED by Joe, 11 Nov 2026, change (1): was `PRACTICE_CHALLENGES.length === 40`; now 261, 217 Classic and live.
// APPROVED by Joe, 11 Nov 2026, change (2): was `games.length === 20` and `challengesFor(g).length === 2`; now all 92
// active games with 2 to 4 each.
check(PRACTICE_CHALLENGES.length === 261, `261 challenges (got ${PRACTICE_CHALLENGES.length})`);
check(PRACTICE_CHALLENGES.filter((c) => c.level === "classic").length === 217, "217 Classic challenges");
// Changed with Joe's approval, 13 Nov 2026: the 22 Classic challenges on the nine retired games are hidden (217 → 195 live).
check(PRACTICE_CHALLENGES.filter(challengeLive).length === 195 && PRACTICE_CHALLENGES.filter(challengeLive).every((c) => c.level === "classic"), "the 195 Classic ones on live games are live; Hard and Expert wait");
check(PRACTICE_CHALLENGES.filter((c) => c.level === "hard").length === 30 && PRACTICE_CHALLENGES.filter((c) => c.level === "expert").length === 14, "30 Hard and 14 Expert");
const games = [...new Set(PRACTICE_CHALLENGES.map((c) => c.type))];
// Changed with Joe's approval, 13 Nov 2026: retired games' challenges are kept hidden, not deleted (Joe's rule, 13 Nov), so the catalogue still covers the
// same 92 games; every live game has its challenges.
check(games.length === 92, `the catalogue's 92 games (got ${games.length})`);
check(ACTIVE_PUZZLE_TYPES.every((t) => games.includes(t)), "every live game has challenges");
check(new Set(PRACTICE_CHALLENGES.map((c) => c.id)).size === PRACTICE_CHALLENGES.length, "challenge ids are unique");
check(new Set(PRACTICE_CHALLENGES.map((c) => c.name)).size === PRACTICE_CHALLENGES.length, "challenge names are unique");
for (const g of games) {
  const n = challengesFor(g).length;
  check(n >= 2 && n <= 4, `${g}: 2 to 4 challenges (got ${n})`);
  // Changed with Joe's approval, 13 Nov 2026: retired games' challenges are kept hidden, not deleted (Joe's rule, 13 Nov).
  check((PUZZLE_TYPES as readonly string[]).includes(g), `${g}: a registered game`);
}
// The first 40 ids are kept (their progress started fresh with C1a, but the ids stay stable).
const FIRST_40 = ["unblock.par", "unblock.speed", "lightsout.par", "lightsout.speed", "sudoku.clean", "sudoku.speed", "flood.par", "flood.speed", "tower.par", "tower.speed", "safe.clean", "safe.speed", "tiles.par", "tiles.speed", "codeword.clean", "codeword.speed", "swapword.par", "swapword.speed", "wordslide.par", "wordslide.speed", "pinball.joulz", "pinball.multiball", "skyline.perfects", "skyline.gold", "beat.gold", "beat.score180", "bubble.clear", "bubble.chests", "bintoss.finish", "bintoss.hoops", "bullseye.dead", "homerun.homers", "homerun.streak", "pool.black", "pool.streak", "blockfall.multi", "blockfall.low", "bastion.drones", "bastion.base"];
for (const id of FIRST_40) check(PRACTICE_CHALLENGES.some((c) => c.id === id), `${id} is kept`);
// The renames Joe asked for (10 Nov 2026).
check(PRACTICE_CHALLENGES.some((c) => c.type === "fivehands" && c.name === "Handsome") && !PRACTICE_CHALLENGES.some((c) => c.name === "Full house"), "Five Hands' Full house is Handsome");
check(PRACTICE_CHALLENGES.some((c) => c.type === "breaker" && c.name === "Twenty-four carat") && !PRACTICE_CHALLENGES.some((c) => c.name === "Gold rush"), "Breaker's Gold rush is Twenty-four carat");
const SPEED_RULES: Partial<Record<PuzzleType, { speed: number; fullByS: number; bonus: number }>> = {
  unblock: { speed: PATTERN_STD.unblock.speed, fullByS: PATTERN_STD.unblock.fullByS, bonus: PATTERN_STD.unblock.par ?? -1 },
  tiles: { speed: PATTERN_STD.tiles.speed, fullByS: PATTERN_STD.tiles.fullByS, bonus: PATTERN_STD.tiles.par ?? -1 },
  lightsout: LOGIC_STANDARD.lightsout,
  sudoku: LOGIC_STANDARD.sudoku,
  flood: LOGIC_STANDARD.flood,
  tower: LOGIC_STANDARD.tower,
  safe: LOGIC_STANDARD.safe,
  codeword: { speed: STD_CRYPTOGRID.speed, fullByS: STD_CRYPTOGRID.fullByS, bonus: STD_CRYPTOGRID.clean },
  swapword: { speed: STD_SWAPWORD.speed, fullByS: STD_SWAPWORD.fullByS, bonus: STD_SWAPWORD.par },
  wordslide: { speed: STD_SLIDER.speed, fullByS: STD_SLIDER.fullByS, bonus: STD_SLIDER.par },
  // The full catalogue (wave 2 C1b): every other standard puzzle with a bonus or speed goal.
  tubes: LOGIC_STANDARD.tubes,
  nonogram: LOGIC_STANDARD.nonogram,
  shikaku: LOGIC_STANDARD.shikaku,
  bomb: LOGIC_STANDARD.bomb,
  trail: { speed: NUMBER_STANDARD.trail.speed, fullByS: NUMBER_STANDARD.trail.fullByS, bonus: NUMBER_STANDARD.trail.bonus },
  fillomino: GRID_STANDARD.fillomino,
  bridges: GRID_STANDARD.bridges,
  kakuro: GRID_STANDARD.kakuro,
  blockparty: { speed: PATTERN_STD.blockparty.speed, fullByS: PATTERN_STD.blockparty.fullByS, bonus: 0 },
  gravity: { speed: PAR_MOVES_STD.speed, fullByS: PAR_STRICT_FULL_BY_S.gravity, bonus: PAR_MOVES_STD.par },
  rings: { speed: PATTERN_STD.rings.speed, fullByS: PATTERN_STD.rings.fullByS, bonus: PATTERN_STD.rings.par ?? -1 },
  laser: { speed: PATTERN_STD.laser.speed, fullByS: PATTERN_STD.laser.fullByS, bonus: 0 },
  flow: { speed: PATTERN_STD.flow.speed, fullByS: PATTERN_STD.flow.fullByS, bonus: 0 },
  pipes: { speed: PATTERN_STD.pipes.speed, fullByS: PATTERN_STD.pipes.fullByS, bonus: PATTERN_STD.pipes.par ?? -1 },
  push: { speed: PATTERN_STD.push.speed, fullByS: PATTERN_STD.push.fullByS, bonus: PATTERN_STD.push.par ?? -1 },
  numhunt: { speed: ASCEND_STD.speed, fullByS: ASCEND_STD.fullByS, bonus: ASCEND_STD.flow },
  chain: { speed: CHAIN_STD.speed, fullByS: CHAIN_STD.fullByS, bonus: 0 },
  spotdiff: { speed: SPOT_STD.speed, fullByS: SPOT_STD.fullByS, bonus: SPOT_STD.clean },
  countup: { speed: COUNT_STD.speed, fullByS: COUNT_STD.fullByS, bonus: 0 },
  pairmatch: { speed: PAIR_STD.speed, fullByS: PAIR_STD.fullByS, bonus: 0 },
  wordsearch: { speed: STD_LOOKOUT.speed, fullByS: STD_LOOKOUT.fullByS, bonus: STD_LOOKOUT.bonus },
  letterwheel: { speed: STD_ROUNDABOUT.speed, fullByS: STD_ROUNDABOUT.fullByS, bonus: STD_ROUNDABOUT.jar },
  target: NUMBER_STANDARD.target,
  equation: NUMBER_STANDARD.equation,
  balance: NUMBER_STANDARD.balance,
  measure: NUMBER_STANDARD.measure,
};
/**
 * APPROVED by Joe, 11 Nov 2026, change (5): the part goals that may target a game's core part, an explicit allow-list
 * (he named King of the swingers, Skyscraper and Moonwalker, "and any others you list": the rest are listed here and
 * in the report). Was `livePart !== live?.parts[0]` for every part goal; every other part goal must still be a feature.
 */
const CORE_PART_ALLOWED = new Set(["ricochet.moonwalker", "skyline.skyscraper", "rally.rally-king", "bullseye.one-hundred-and-twelve", "freecell.all-home", "minesweeper.bomb-disposal", "swing.king-of-the-swingers", "balltrack.lost-no-marbles", "minesweeper.light-feet", "mahjong.no-shuffle"]);
// APPROVED by Joe, 11 Nov 2026, change (4): was `s.length <= 44`; now ≤ 64, provided practice-challenge-fit-check
// proves the longest goal fits the narrowest supported phone without truncation (it does, at 320 and 375 px).
const textOk = (s: string) => s.length > 0 && s.length <= 64 && !/[·!']|"/.test(s) && /^[A-Z]/.test(s);
for (const c of PRACTICE_CHALLENGES) {
  check(textOk(c.text), `${c.id}: goal "${c.text}" is one short sentence-case line, no "·", "!" or straight quotes`);
  // APPROVED by Joe, 11 Nov 2026, change (3): was `c.reward === "Badge"`; coins on the marked challenges (100, or 250 on
  // Expert). APPROVED by Joe, 11 Nov 2026, change (9): the ones that pay no coins show no reward (""), not "Badge".
  check(c.reward === (c.coins ? `${c.coins} coins` : ""), `${c.id}: the reward reads ${c.coins ? `"${c.coins} coins"` : "nothing (no coins)"}`);
  check(c.coins === 0 || (c.level === "expert" ? c.coins === 250 : c.coins === 100), `${c.id}: ${c.level} pays ${c.level === "expert" ? 250 : 100} when marked`);
  check(!/in one run/i.test(c.text), `${c.id}: no "in one run" (the section's note says it once)`);
  const g = c.goal;
  if (g.kind === "part") {
    const live = (LIVE_BANDS as Record<string, { std?: { parts: readonly { label: string; max: number }[] } }>)[c.type]?.std;
    const livePart = live?.parts.find((p) => p.label === g.label);
    check(Boolean(livePart) && livePart!.max === g.max, `${c.id}: "${g.label}" up to ${g.max} is a part of the live spec (got ${livePart?.max})`);
    check(livePart !== live?.parts[0] || CORE_PART_ALLOWED.has(c.id), `${c.id}: a feature, not the core (or on Joe's allow-list)`);
    const spec = ARCADE_STANDARD[c.type]?.spec;
    const specPart = spec?.parts.find((p) => p.label === g.label);
    check(Boolean(specPart) && specPart!.max === g.max, `${c.id}: the reveal's parts list has "${g.label}" up to ${g.max}`);
  } else if (g.kind === "bonus" || g.kind === "speed") {
    const rule = SPEED_RULES[c.type];
    check(Boolean(rule), `${c.id}: its standard rules are known`);
    check(Boolean(STANDARD_GAMES[c.type]), `${c.id}: graded on the puzzle scoring standard`);
    if (rule && g.kind === "bonus") check(g.max === rule.bonus && g.max > 0, `${c.id}: bonus ${g.max} is the rule's ${rule.bonus}`);
    if (rule && g.kind === "speed") check(g.max === rule.speed && g.withinS === rule.fullByS && c.text.includes(`${rule.fullByS} s`), `${c.id}: speed ${g.max} within ${g.withinS} s is the rule's ${rule.speed} by ${rule.fullByS} s`);
    if (rule) check(rule.speed + rule.bonus <= 50, `${c.id}: speed and bonus both fit a finish's 50 (standardFinish never trims either)`);
  } else if (g.kind === "score") {
    // APPROVED by Joe, 11 Nov 2026, change (6): was `g.score === 180 && c.text === "Score 180 or more"`; any score the
    // catalogue gives, each checked against docs/challenges/catalogue.md in section 7.
    check(Number.isInteger(g.score) && g.score > 0 && g.score <= 200 && c.text.includes(String(g.score)), `${c.id}: one run of ${g.score}, the number in its text`);
  } else {
    // A check: every condition holds in one run (section 7 checks each number against the live game).
    check(g.all.length > 0, `${c.id}: at least one condition`);
    for (const cond of g.all) if (cond.c === "full") {
      const live = (LIVE_BANDS as Record<string, { std?: { parts: readonly { label: string; max: number }[] } }>)[c.type]?.std;
      const lp = live?.parts.find((p) => p.label === cond.label);
      check(!lp || lp !== live?.parts[0] || CORE_PART_ALLOWED.has(c.id), `${c.id}: "${cond.label}" a feature, not the core (or on Joe's allow-list)`);
    }
  }
}
// The coin pins (APPROVED by Joe, 11 Nov 2026, changes (3) and (9)): 17 Classic at 100 (live), 13 Hard at 100 and 9
// Expert at 250 (switched on with their levels), and no reward on the other 222.
const coinsOf = (level: string, coins: number) => PRACTICE_CHALLENGES.filter((c) => c.level === level && c.coins === coins).length;
check(coinsOf("classic", 100) === 17 && coinsOf("classic", 250) === 0, `17 Classic challenges at 100 coins (got ${coinsOf("classic", 100)})`);
check(coinsOf("hard", 100) === 13 && coinsOf("hard", 250) === 0, `13 Hard challenges at 100 coins (got ${coinsOf("hard", 100)})`);
check(coinsOf("expert", 250) === 9 && coinsOf("expert", 100) === 0, `9 Expert challenges at 250 coins (got ${coinsOf("expert", 250)})`);
check(PRACTICE_CHALLENGES.filter((c) => c.coins === 0).length === 261 - 17 - 13 - 9, "no coins on the other 222");
check(PRACTICE_CHALLENGES.filter((c) => c.coins === 0).every((c) => c.reward === ""), "no reward on the other 222");

/* ------------------------------------------------------------------ 4. progress from recorded results */
/** An arcade run's stored extra: its parts through the real reveal-line writer. */
function arcadeExtra(type: string, points: Record<string, number>): Record<string, unknown> {
  const spec = ARCADE_STANDARD[type]!.spec!;
  const parts: StdPart[] = spec.parts.map((p) => ({ key: p.key, label: p.label, detail: "x", points: Math.min(p.max, points[p.key] ?? 0), max: p.max }));
  const score = Math.max(1, parts.reduce((s, p) => s + p.points, 0));
  return { std: true, reveal: { lines: stdLines(parts, score) } };
}
/** A standard puzzle's stored extra, as standard/grade.server.ts stores it. */
const finishExtra = (speed: number, bonus: number) => ({ ...standardFinish({ speed, bonus, measure: "par" }), extra: { parts: standardFinish({ speed, bonus, measure: "par" }).parts, standard: 1 } });

wipe();
// Pinball: J-O-U-L-Z (20) in one run.
const joulz = PRACTICE_CHALLENGES.find((c) => c.id === "pinball.joulz")!;
recordPracticeGoals("pinball", 90, arcadeExtra("pinball", { core: 80, joulz: 8 }), 90);
let st = challengeState(joulz);
check(st.value === 8 && st.status === "progress" && Math.abs(st.progress - 0.4) < 1e-9, `J-O-U-L-Z 8 of 20 in progress (got ${st.value}, ${st.status})`);
recordPracticeGoals("pinball", 60, arcadeExtra("pinball", { core: 50, joulz: 4 }), 90);
check(challengeState(joulz).value === 8, "a weaker run never lowers a part's best");
const done1 = recordPracticeGoals("pinball", 150, arcadeExtra("pinball", { core: 120, joulz: 20 }), 150);
st = challengeState(joulz);
check(st.status === "done" && st.progress === 1 && done1.completed.some((c) => c.id === "pinball.joulz"), "a full J-O-U-L-Z completes it, reported once");
const again = recordPracticeGoals("pinball", 10, arcadeExtra("pinball", { core: 9 }), 150);
check(challengeState(joulz).status === "done" && !again.completed.some((c) => c.id === "pinball.joulz"), "done stays done and isn't reported again");
check(challengeState(PRACTICE_CHALLENGES.find((c) => c.id === "pinball.multiball")!).status === "new", "another part's challenge is untouched");
// Every part challenge reads its own line.
for (const c of PRACTICE_CHALLENGES) {
  if (c.goal.kind !== "part") continue;
  const key = ARCADE_STANDARD[c.type]!.spec!.parts.find((p) => p.label === (c.goal as { label: string }).label)!.key;
  check(challengeValueOf(c.goal, 100, arcadeExtra(c.type, { [key]: c.goal.max })) === c.goal.max, `${c.id}: read from its stored line`);
  check(challengeValueOf(c.goal, 100, arcadeExtra(c.type, {})) === 0, `${c.id}: 0 when the part earned nothing`);
  check(challengeValueOf(c.goal, 100, null) === 0, `${c.id}: 0 with no stored extra`);
}
// Puzzles: Gridlock at par and within 40 s.
const par = PRACTICE_CHALLENGES.find((c) => c.id === "unblock.par")!;
const fast = PRACTICE_CHALLENGES.find((c) => c.id === "unblock.speed")!;
let f = finishExtra(12, 20);
recordPracticeGoals("unblock", f.score, f.extra, f.score);
check(challengeState(par).status === "done" && challengeState(fast).value === 12, "a finish at par completes it; its 12 speed points count towards the speed goal");
f = finishExtra(30, 4);
recordPracticeGoals("unblock", f.score, f.extra, f.score);
check(challengeState(fast).status === "done", "a finish with full speed completes the speed goal");
wipe();
const partial = standardUnfinished(125);
recordPracticeGoals("unblock", partial.score, { parts: partial.parts, standard: 1 }, partial.score);
check(challengeState(par).status === "new" && challengeState(fast).status === "new", "an unfinished run never counts towards a finish goal");
recordPracticeGoals("unblock", 180, { parts: { kind: "finish", base: 150, efficiency: 20, speed: 10 } }, 180);
check(challengeState(par).status === "new", "an older (non-standard) puzzle's parts never count");
recordPracticeGoals("lightsout", 200, finishExtra(30, 20).extra, 200);
check(challengeState(par).status === "new", "another game's run never counts");
// One run's score (Tempo and Flightpath: 180 or more in a single run; runs never add up).
// APPROVED by Joe, 11 Nov 2026, change (7): was `["beat.score180", "bullseye.score180"]` both listed; Flightpath's score
// challenge is replaced by On a roll (the bull streak).
check(PRACTICE_CHALLENGES.some((c) => c.id === "beat.score180"), "beat.score180 is listed");
check(!PRACTICE_CHALLENGES.some((c) => c.id === "bullseye.score180") && PRACTICE_CHALLENGES.some((c) => c.id === "bullseye.on-a-roll"), "bullseye.score180 is replaced by bullseye.on-a-roll");
const tempo = PRACTICE_CHALLENGES.find((c) => c.id === "beat.score180")!;
check(challengeTarget(tempo.goal) === 180, "Tempo's target is a 180 run");
for (const [score, want, status] of [[120, 120, "progress"], [179, 179, "progress"], [150, 179, "progress"], [40, 179, "progress"]] as const) {
  recordPracticeGoals("beat", score, arcadeExtra("beat", { core: score }), 179);
  const st = challengeState(tempo);
  check(st.value === want && st.status === status, `Tempo: best run ${want} after a ${score} (got ${st.value}, ${st.status})`);
}
check(challengeState(tempo).status !== "done", "runs of 120, 179, 150 and 40 never add up to a completion");
const t180 = recordPracticeGoals("beat", 180, null, 180);
check(challengeState(tempo).status === "done" && t180.completed.some((c) => c.id === "beat.score180"), "one run of 180 completes it");
recordPracticeGoals("beat", 60, null, 180);
check(challengeState(tempo).status === "done" && challengeState(tempo).value === 180, "done stays done after a weaker run");
// Change (7): the Flightpath challenge this test reads (was bullseye.score180).
const flight = PRACTICE_CHALLENGES.find((c) => c.id === "bullseye.on-a-roll")!;
check(challengeState(flight).status === "new", "a Tempo run never counts for Flightpath");

/* ------------------------------------------------------------------ 5. storage */
wipe();
recordPracticeGoals("pinball", 165, arcadeExtra("pinball", { core: 130, joulz: 20, multiball: 15 }), 165);
const before = JSON.stringify(readGoals());
reload();
check(JSON.stringify(readGoals()) === before, "the record reads back the same after a reload");
check(store.has(PRACTICE_GOALS_KEY) && [...store.keys()].every((k) => !k.startsWith(PRACTICE_BEST_PREFIX)), "one goals key, never a practice best's");
reload();
// Changed with Joe's approval, 13 Nov 2026: the stars half (starsOf("pinball", null) === 2) dropped with the device stars; the challenge half unchanged.
check(challengeState(joulz).status === "done" && challengeState(PRACTICE_CHALLENGES.find((c) => c.id === "pinball.multiball")!).value === 15, "after a reload: challenge progress from storage alone");
store.set(PRACTICE_GOALS_KEY, "{not json");
reload();
// Changed with Joe's approval, 13 Nov 2026: the empty record no longer has a stars field (was { v: 1, stars: {}, challenges: {} }).
check(JSON.stringify(readGoals()) === JSON.stringify({ v: 1, challenges: {} }), "corrupt storage reads as an empty record");
store.set(PRACTICE_GOALS_KEY, JSON.stringify({ stars: { pinball: 9, x: "y" }, challenges: { "pinball.joulz": { value: -4 }, bad: 3 } }));
reload();
const cleaned = readGoals();
// Changed with Joe's approval, 13 Nov 2026: the stars half (cleaned.stars held to 0–3) dropped; the stored stars are now ignored, the challenges half unchanged.
check(!("stars" in cleaned) && cleaned.challenges["pinball.joulz"]?.value === 0 && !("bad" in cleaned.challenges), "stored values are held to their ranges (stored stars ignored)");
wipe();
blocked = true;
// Changed with Joe's approval, 13 Nov 2026: the blocked-storage star assertion (b.starsAfter === 2, starsOf === 2) becomes the same proof on a challenge.
recordPracticeGoals("pinball", 165, arcadeExtra("pinball", { core: 130, joulz: 20, multiball: 15 }), 165);
check(challengeState(joulz).status === "done" && !store.has(PRACTICE_GOALS_KEY), "blocked storage: the session still keeps its challenge progress");
blocked = false;

// Added with Joe's approval, 13 Nov 2026: clearing the stored device stars never disturbs the challenge record. A record
// written before the change (stars beside challenges) reads its challenges exactly; the next run's write drops only the
// stars, keeps every stored challenge (done ones with their dates) and adds the new progress; nothing else is touched.
wipe();
const oldChallenges = { "pinball.joulz": { value: 20, done: "2026-11-09" }, "pinball.multiball": { value: 7 }, "unblock.par": { value: 4 } };
store.set(PRACTICE_GOALS_KEY, JSON.stringify({ v: 1, stars: { pinball: 3, unblock: 2 }, challenges: oldChallenges }));
reload();
check(JSON.stringify(readGoals().challenges) === JSON.stringify(oldChallenges), "a record stored with stars reads its challenges exactly");
recordPracticeGoals("lightsout", 120, null, 120);
const rewritten = JSON.parse(store.get(PRACTICE_GOALS_KEY) ?? "{}") as Record<string, unknown>;
const kept = rewritten["challenges"] as Record<string, unknown>;
check(!("stars" in rewritten) && rewritten["v"] === 1 && Object.entries(oldChallenges).every(([id, c]) => JSON.stringify(kept[id]) === JSON.stringify(c)) && Object.keys(kept).every((id) => id in oldChallenges || id.startsWith("lightsout.")), `the next write drops the stars and keeps every stored challenge as it was, adding only the run's game (${JSON.stringify(rewritten)})`);
recordPracticeGoals("pinball", 150, arcadeExtra("pinball", { core: 110, joulz: 0, multiball: 15 }), 150);
const after = readGoals().challenges;
check(after["pinball.joulz"]?.done === "2026-11-09" && after["pinball.multiball"]?.value === 15 && after["unblock.par"]?.value === 4, "a later run still keeps done challenges and their dates and raises progress");

/* ------------------------------------------------------------------ 6. wiring */
const practice = readFileSync("src/routes/practice.tsx", "utf8");
check(/recordPracticeGoals\(puzzle\.type, result\.score, extra, record\.best\)/.test(practice), "practice records every graded run's goals from the server's score and extra");
// Wave 2 C1a: the star line is the server's (175+ on Classic).
// Changed with Joe's approval, 11 Nov 2026 (wave 2 C1a): was /setEarnedStar\(starLine\(reached\)\)/ (message unchanged).
check(/starLine=\{earnedStar\}/.test(practice) && /setEarnedStar\(runStarLine\(result\.progress\)\)/.test(practice), "the reveal gets the run's star line");
check(/<RowStars type=\{key\} \/>/.test(practice) && /data-practice-stars/.test(practice) && /<PracticeChallenges/.test(practice), "rows, the total and the Challenges section are drawn");
const queue = readFileSync("src/lib/offline/queue.ts", "utf8");
check(/recordPracticeGoals\(run\.type, score, extra, best\.best\)/.test(queue), "the offline queue records confirmed runs' goals");
const reveal = readFileSync("src/components/duel/AnswerReveal.tsx", "utf8");
check(/practice && \(personalBest \|\| starLine\) && myScore !== null \? <NewBestMoment starLine=\{starLine\} \/>/.test(reveal), "the new-best moment plays with the star line, practice only");
const intro = readFileSync("src/components/duel/RoundIntro.tsx", "utf8");
// Changed with Joe's approval, 11 Nov 2026 (wave 2 C1a): was /<Stars tier=\{starsOf\(type, deviceBest\)\} \/>/ (message unchanged).
check(/<Stars levels=\{levelStarsOf\(practiceProgressNow\(\), type\)\} \/>/.test(intro), "the intro shows the game's stars");
const ui = readFileSync("src/components/app/PracticeChallenges.tsx", "utf8");
check(/Each challenge is completed in a single Practice run\./.test(ui), "the line under the Challenges heading");
check(/Unlocks with your account/.test(ui) && /"In progress"/.test(ui) && /"New"/.test(ui) && /"Done"/.test(ui), "filters In progress, New, Done; rewards unlock with an account");
// Change (9) (Joe, 11 Nov 2026): the list's quiet line, and a reward drawn only for a coin challenge.
check(/Every challenge counts towards your Challenger badges\./.test(ui), "the line under the Challenges heading: Challenger badges");
check(/challenge\.coins > 0 \? \(\s*<span data-challenge-reward/.test(ui) && !/challenge\.reward\}/.test(ui), "a reward is drawn only for a challenge that pays coins");
// Nothing outside practice, the queue, the intro, the reveal's moment and the goals UI imports the goals.
// APPROVED by Joe, 11 Nov 2026, change (8): the allow-list gains, by name only, the server's challenge checker and the
// Profile challenges section (it held the first five files before).
const allowed = new Set(["src/routes/practice.tsx", "src/lib/offline/queue.ts", "src/components/duel/RoundIntro.tsx", "src/components/app/PracticeChallenges.tsx", "src/lib/duel/practiceGoals.ts", "src/lib/challenges/challenges.server.ts", "src/components/app/ProfileChallenges.tsx"]);
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
for (const file of walk("src")) {
  if (allowed.has(file)) continue;
  const src = readFileSync(file, "utf8");
  check(!/practiceGoals"|practiceChallenges"/.test(src), `${file}: doesn't import the practice goals`);
}

/* ------------------------------------------------------------------ 7. the full catalogue's numbers */
const report = await numbersReport();
for (const r of report.results) check(r.ok, r.label);
check(report.challenges === 261, `the numbers check covers all 261 challenges (got ${report.challenges})`);

if (failures.length) {
  for (const m of failures) console.log(`FAIL ${m}`);
  console.log(`FAIL practice-goals-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS practice-goals-check: ${passes} assertions`);
