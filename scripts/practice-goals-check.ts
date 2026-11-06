/**
 * practice-goals-check (6 Nov 2026): Practice's mastery stars and challenges (src/lib/duel/practiceGoals.ts,
 * practiceChallenges.ts; device storage and presentation only).
 *
 *  1. Star thresholds: bronze at 120, silver at 160, gold at 190, from the practice best; every active game can reach
 *     gold (its round maximum is 200); the total is 3 for each active game (92 games: 276).
 *  2. A star once earned is kept: a fresh best under new stamps (or none) never lowers it; the star line names only a
 *     newly earned star.
 *  3. The challenge list: 2 for each of 20 active games, unique ids, built only from what each game already measures:
 *     an arcade part's label and maximum are the live spec's (LIVE_BANDS std and ARCADE_STANDARD), a puzzle's bonus and
 *     speed are its standard rules' (patternRules.ts, logicRules.ts, word.ts), the speed goal's seconds the rule's
 *     "full by" time, and every puzzle is graded on the standard (STANDARD_GAMES).
 *  4. Progress from recorded results, in the server's own stored formats (stdLines for arcade parts, standardFinish
 *     and the standard grader's extra for puzzles): a part's best in one run, a finish's bonus and speed, runs over a
 *     score counted; partial runs, older (non-standard) puzzles and other games' runs never count; done stays done.
 *  5. Storage survives a reload (the record is read back from storage alone); corrupt or blocked storage falls back
 *     safely; the record is one key, never a practice best's.
 *  6. Wiring: practice and the offline queue record every graded run's goals from the server's score and extra; the
 *     list, rows and intro show stars; the new-best moment carries the star line; nothing in rooms or the server
 *     imports the goals.
 *
 *   bun scripts/practice-goals-check.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { stdLines, type StdPart } from "../src/lib/arcade/arcadeStandard";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { PRACTICE_CHALLENGES, challengeTarget, challengesFor, challengeValueOf } from "../src/lib/duel/practiceChallenges";
import {
  PRACTICE_GOALS_KEY,
  STAR_THRESHOLDS,
  challengeState,
  readGoals,
  recordPracticeGoals,
  resetGoalsMemoryForChecks,
  starLine,
  starTotal,
  starsFor,
  starsOf,
} from "../src/lib/duel/practiceGoals";
import { PRACTICE_BEST_PREFIX } from "../src/lib/duel/practiceBest";
import { ACTIVE_PUZZLE_TYPES } from "../src/lib/duel/registry";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
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

/* ------------------------------------------------------------------ 1. thresholds */
check(STAR_THRESHOLDS.join() === "120,160,190", "thresholds are bronze 120, silver 160, gold 190");
const cases: [number | null, number][] = [[null, 0], [0, 0], [119, 0], [120, 1], [159, 1], [160, 2], [189, 2], [190, 3], [200, 3], [NaN, 0]];
for (const [score, tier] of cases) check(starsFor(score) === tier, `starsFor(${score}) is ${tier} (got ${starsFor(score)})`);
for (let s = 0; s <= 200; s++) check(starsFor(s) === (s >= 190 ? 3 : s >= 160 ? 2 : s >= 120 ? 1 : 0), `starsFor(${s})`);
for (const t of ACTIVE_PUZZLE_TYPES) check(ROUND_MAX[t] >= 190, `${t}: its round maximum (${ROUND_MAX[t]}) reaches gold`);
wipe();
const total = starTotal(ACTIVE_PUZZLE_TYPES, () => null);
check(total.total === ACTIVE_PUZZLE_TYPES.length * 3 && total.earned === 0, `the total is 3 a game: 0 / ${total.total}`);
check(ACTIVE_PUZZLE_TYPES.length === 92 && total.total === 276, `92 active games, 276 stars (got ${ACTIVE_PUZZLE_TYPES.length}, ${total.total})`);
const some = starTotal(ACTIVE_PUZZLE_TYPES, (t) => (t === "unblock" ? 165 : t === "pinball" ? 190 : t === "flood" ? 120 : null));
check(some.earned === 6, `bests 165, 190 and 120 earn 2 + 3 + 1 = 6 (got ${some.earned})`);

/* ------------------------------------------------------------------ 2. stars kept */
wipe();
let r = recordPracticeGoals("unblock", 125, null, 125);
check(r.starsBefore === 0 && r.starsAfter === 1 && starLine(r) === "Bronze star earned", "a first run of 125 earns bronze, with its star line");
r = recordPracticeGoals("unblock", 110, null, 125);
check(r.starsAfter === 1 && starLine(r) === null, "a lower run earns nothing and shows no star line");
r = recordPracticeGoals("unblock", 195, null, 195);
check(r.starsBefore === 1 && r.starsAfter === 3 && starLine(r) === "Gold star earned", "a jump to 195 names the gold star");
check(starsOf("unblock", null) === 3 && starsOf("unblock", 130) === 3, "a fresh best under new stamps (or none) keeps the stars earned");
r = recordPracticeGoals("unblock", 140, null, 140);
check(r.starsAfter === 3 && starLine(r) === null, "a run under new stamps never lowers the stars or repeats a line");
check(starsOf("lightsout", 170) === 2, "a best kept before goals existed still shows its stars");

/* ------------------------------------------------------------------ 3. the list */
check(PRACTICE_CHALLENGES.length === 40, `40 challenges (got ${PRACTICE_CHALLENGES.length})`);
const games = [...new Set(PRACTICE_CHALLENGES.map((c) => c.type))];
check(games.length === 20, `20 games (got ${games.length})`);
check(new Set(PRACTICE_CHALLENGES.map((c) => c.id)).size === PRACTICE_CHALLENGES.length, "challenge ids are unique");
for (const g of games) {
  check(challengesFor(g).length === 2, `${g}: 2 challenges`);
  check((ACTIVE_PUZZLE_TYPES as readonly string[]).includes(g), `${g}: an active game`);
}
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
};
const textOk = (s: string) => s.length > 0 && s.length <= 44 && !/[·!']|"/.test(s) && /^[A-Z]/.test(s);
for (const c of PRACTICE_CHALLENGES) {
  check(textOk(c.text), `${c.id}: goal "${c.text}" is one short sentence-case line, no "·", "!" or straight quotes`);
  check(c.reward.length > 0, `${c.id}: has a reward`);
  const g = c.goal;
  if (g.kind === "part") {
    const live = (LIVE_BANDS as Record<string, { std?: { parts: readonly { label: string; max: number }[] } }>)[c.type]?.std;
    const livePart = live?.parts.find((p) => p.label === g.label);
    check(Boolean(livePart) && livePart!.max === g.max, `${c.id}: "${g.label}" up to ${g.max} is a part of the live spec (got ${livePart?.max})`);
    check(livePart !== live?.parts[0], `${c.id}: a feature, not the core`);
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
  } else {
    check(g.score >= 120 && g.score <= 200 && g.runs >= 2, `${c.id}: a run count over a real score`);
  }
}

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
// Runs over a score, counted.
const tempo = PRACTICE_CHALLENGES.find((c) => c.id === "beat.runs150")!;
for (const [score, want] of [[149, 0], [150, 1], [190, 2], [40, 2]] as const) {
  recordPracticeGoals("beat", score, arcadeExtra("beat", { core: score }), 190);
  check(challengeState(tempo).value === want, `Tempo: ${want} runs of 150+ after a ${score}`);
}
recordPracticeGoals("beat", 175, null, 190);
check(challengeState(tempo).status === "done" && challengeTarget(tempo.goal) === 3, "the third run of 150+ completes it");
recordPracticeGoals("beat", 175, null, 190);
check(challengeState(tempo).value === 3, "a done count stops at its target");

/* ------------------------------------------------------------------ 5. storage */
wipe();
recordPracticeGoals("pinball", 165, arcadeExtra("pinball", { core: 130, joulz: 20, multiball: 15 }), 165);
const before = JSON.stringify(readGoals());
reload();
check(JSON.stringify(readGoals()) === before, "the record reads back the same after a reload");
check(store.has(PRACTICE_GOALS_KEY) && [...store.keys()].every((k) => !k.startsWith(PRACTICE_BEST_PREFIX)), "one goals key, never a practice best's");
reload();
check(starsOf("pinball", null) === 2 && challengeState(joulz).status === "done" && challengeState(PRACTICE_CHALLENGES.find((c) => c.id === "pinball.multiball")!).value === 15, "after a reload: stars and challenge progress from storage alone");
store.set(PRACTICE_GOALS_KEY, "{not json");
reload();
check(JSON.stringify(readGoals()) === JSON.stringify({ v: 1, stars: {}, challenges: {} }), "corrupt storage reads as an empty record");
store.set(PRACTICE_GOALS_KEY, JSON.stringify({ stars: { pinball: 9, x: "y" }, challenges: { "pinball.joulz": { value: -4 }, bad: 3 } }));
reload();
const cleaned = readGoals();
check(cleaned.stars["pinball"] === 3 && !("x" in cleaned.stars) && cleaned.challenges["pinball.joulz"]?.value === 0 && !("bad" in cleaned.challenges), "stored values are held to their ranges");
wipe();
blocked = true;
const b = recordPracticeGoals("unblock", 170, null, 170);
check(b.starsAfter === 2 && starsOf("unblock", null) === 2, "blocked storage: the session still keeps its stars");
blocked = false;

/* ------------------------------------------------------------------ 6. wiring */
const practice = readFileSync("src/routes/practice.tsx", "utf8");
check(/recordPracticeGoals\(puzzle\.type, result\.score, extra, record\.best\)/.test(practice), "practice records every graded run's goals from the server's score and extra");
check(/starLine=\{earnedStar\}/.test(practice) && /setEarnedStar\(starLine\(reached\)\)/.test(practice), "the reveal gets the run's star line");
check(/<RowStars type=\{key\} \/>/.test(practice) && /data-practice-stars/.test(practice) && /<PracticeChallenges/.test(practice), "rows, the total and the Challenges section are drawn");
const queue = readFileSync("src/lib/offline/queue.ts", "utf8");
check(/recordPracticeGoals\(run\.type, score, extra, best\.best\)/.test(queue), "the offline queue records confirmed runs' goals");
const reveal = readFileSync("src/components/duel/AnswerReveal.tsx", "utf8");
check(/practice && \(personalBest \|\| starLine\) && myScore !== null \? <NewBestMoment starLine=\{starLine\} \/>/.test(reveal), "the new-best moment plays with the star line, practice only");
const intro = readFileSync("src/components/duel/RoundIntro.tsx", "utf8");
check(/<Stars tier=\{starsOf\(type, deviceBest\)\} \/>/.test(intro), "the intro shows the game's stars");
const ui = readFileSync("src/components/app/PracticeChallenges.tsx", "utf8");
check(/Unlocks with your account/.test(ui) && /"In progress"/.test(ui) && /"New"/.test(ui) && /"Done"/.test(ui), "filters In progress, New, Done; rewards unlock with an account");
// Nothing outside practice, the queue, the intro, the reveal's moment and the goals UI imports the goals.
const allowed = new Set(["src/routes/practice.tsx", "src/lib/offline/queue.ts", "src/components/duel/RoundIntro.tsx", "src/components/app/PracticeChallenges.tsx", "src/lib/duel/practiceGoals.ts"]);
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

if (failures.length) {
  for (const m of failures) console.log(`FAIL ${m}`);
  console.log(`FAIL practice-goals-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS practice-goals-check: ${passes} assertions`);
