/**
 * d3-speed-ladder-check (22 Nov 2026, the polish plan's D3): the six Speed games' Normal scoring stamps and ladders.
 *
 *   1. Older rounds: every run of the D3 legacy fixture (scripts/fixtures/d3-speed-legacy.json.gz, recorded on the
 *      stamps before D3) grades exactly as it did (score, verdict and stored extra; the replay's wall-clock time aside).
 *   2. The stamps: Normal deals Flash tapRev 8, Bonk whackRev 5, the Chain chainDepthRev 4, Tenfall tenRev 7 and Pull!
 *      clayRev 11 (Ascend unchanged); with the era pin preD3Speed the deal is the one before; a Normal deal is byte for
 *      byte the deal with no level asked.
 *   3. Joe's ladder test (100 deals a level, d3-ladder-lib.ts): the average player steps down clearly Easy > Normal >
 *      Hard > Expert (each at least 5 points or a fifth lower), and the realistic elite under the human limits reaches
 *      200 strictly less often each level up, on Expert on at least a fifth of boards.
 *   4. 200 is proved reachable at the limits (d3-speed-oracles.ts, a person exactly at 0.25 s and 0.15 s, no slip):
 *      Flash, Ascend and the Chain on every dealt board at every level; Pull! on every level deal; Bonk's and Tenfall's
 *      level deals draw only proved seeds (d3SpeedDeals.server.ts rebuilds byte for byte).
 *   5. The levels' new settings are stamped on the deal and read by the grade (removed, the same run grades otherwise).
 *
 *   bun scripts/d3-speed-ladder-check.ts
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { withDealOptions } from "../src/lib/duel/dealEra";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { D3_SPEED_DEALS } from "../src/lib/duel/d3SpeedDeals.server";
import { dealAt } from "./level-tune";
import { ALL_LEVELS, SPEED_GAMES, measure, playAs, type LadderRow } from "./d3-ladder-lib";
import { proofAnswer, proofChain as proofChainRun, proofScore, tapProofScore } from "./d3-speed-oracles";
import { buildDeals, D3_SPEED_DEALS_FILE } from "./d3-speed-deal";
import { D3_SPEED_LEGACY, type LegacyCase } from "./d3-speed-legacy-record";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

let passes = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);
const stable = (x: unknown) => JSON.stringify(x ?? null, (k, v) => (k === "replayMs" ? undefined : v));

section("1. Older rounds grade exactly as before");
{
  const cases = JSON.parse(gunzipSync(readFileSync(D3_SPEED_LEGACY)).toString()) as LegacyCase[];
  ok(cases.length === 576, `the legacy fixture holds 576 runs (${cases.length})`);
  let same = 0;
  for (const c of cases) {
    const g = gradeAnswer(c.puzzle, c.answer, c.msRemaining);
    if (g.score === c.score && g.isCorrect === c.isCorrect && stable(g.extra) === stable(c.extra)) same++;
    else ok(false, `${c.game} ${c.level} ${c.who}: ${c.score} → ${g.score}`);
  }
  ok(same === cases.length, `${same} of ${cases.length} legacy runs grade as recorded`);
}

section("2. The stamps");
{
  const STAMP: Record<string, [string, number, number]> = {
    reaction: ["tapRev", 7, 8],
    whack: ["whackRev", 4, 5],
    chain: ["chainDepthRev", 3, 4],
    tendrop: ["tenRev", 6, 7],
    clayshoot: ["clayRev", 10, 11],
  };
  const deal = (type: string, level: Level | null, seed: number) =>
    withSeededRandom(seed, () => generatePuzzle(type as PuzzleType, { bankSeed: seed, ...(level ? { level } : {}) }));
  for (const [type, [key, before, after]] of Object.entries(STAMP)) {
    for (const seed of [11, 4242, 987001]) {
      const now = deal(type, null, seed) as unknown as Record<string, unknown>;
      const pinned = withDealOptions({ pins: ["preD3Speed"] }, () => deal(type, null, seed)) as unknown as Record<string, unknown>;
      ok(now[key] === after, `${type} ${seed}: Normal deals ${key} ${after} (${now[key]})`);
      ok(pinned[key] === before, `${type} ${seed}: with preD3Speed pinned, ${key} ${before} (${pinned[key]})`);
      ok(JSON.stringify({ ...pinned, [key]: after }) === JSON.stringify(now), `${type} ${seed}: the D3 stamp is the only change to the Normal deal`);
    }
  }
  for (const type of SPEED_GAMES) {
    for (const seed of [7, 99]) ok(JSON.stringify(deal(type, null, seed)) === JSON.stringify(deal(type, "normal", seed)), `${type} ${seed}: a Normal deal is the deal with no level`);
  }
}

section("3. Joe's ladder test (100 deals a level)");
const table: LadderRow[][] = [];
for (const game of SPEED_GAMES) {
  const avg = ALL_LEVELS.map((level) => measure(game, level, "average", 100));
  const elite = ALL_LEVELS.map((level) => measure(game, level, "elite", 100));
  table.push([...avg, ...elite]);
  console.log(`  ${game}: average ${avg.map((r) => r.average).join(" > ")}; elite at 200 ${elite.map((r) => `${Math.round(r.at200 * 100)} %`).join(" > ")} (elite averages ${elite.map((r) => r.average).join(", ")})`);
  for (let i = 1; i < 4; i++) {
    const [a, b] = [avg[i - 1]!.average, avg[i]!.average];
    ok(a - b >= 5 || b <= 0.8 * a, `${game}: the average player steps down from ${ALL_LEVELS[i - 1]} (${a}) to ${ALL_LEVELS[i]} (${b})`);
    ok(elite[i]!.at200 < elite[i - 1]!.at200, `${game}: the elite reaches 200 less often on ${ALL_LEVELS[i]} (${Math.round(elite[i]!.at200 * 100)} %) than ${ALL_LEVELS[i - 1]} (${Math.round(elite[i - 1]!.at200 * 100)} %)`);
  }
  ok(elite[3]!.at200 >= 0.2, `${game}: the elite reaches 200 on at least a fifth of Expert boards (${Math.round(elite[3]!.at200 * 100)} %)`);
}

section("4. 200 is reachable at the human limits");
for (const game of ["reaction", "numhunt", "chain"] as const) {
  for (const level of ALL_LEVELS) {
    let at = 0;
    for (let n = 0; n < 100; n++) if (tapProofScore(dealAt(game, level, n)) >= 200) at++;
    ok(at === 100, `${game} ${level}: a person exactly at the limits scores 200 on ${at} of 100 boards`);
  }
}
for (const level of ["easy", "hard", "expert"] as const) {
  let at = 0;
  for (let n = 0; n < 60; n++) if (proofScore(dealAt("clayshoot", level, n)).score >= 200) at++;
  ok(at === 60, `clayshoot ${level}: the limits proof scores 200 on ${at} of 60 level deals`);
}
{
  ok(readFileSync(D3_SPEED_DEALS_FILE, "utf8") === buildDeals(160), "d3SpeedDeals.server.ts rebuilds byte for byte (every listed seed proved at 200)");
  for (const game of ["whack", "tendrop"] as const) {
    for (const level of ["easy", "hard", "expert"] as const) {
      const list = D3_SPEED_DEALS[game][level];
      ok(list.length >= 60, `${game} ${level}: ${list.length} proved seeds`);
      const seeds = Array.from({ length: 12 }, (_, n) => (dealAt(game, level, n) as { seed: number }).seed);
      ok(seeds.every((s) => list.includes(s)), `${game} ${level}: every level deal plays a proved seed`);
    }
  }
}

section("5. The level settings are stamped and read");
{
  const strip = (p: PuzzleData, keys: string[]): PuzzleData => {
    const out = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
    for (const k of keys) {
      const [a, b] = k.split(".");
      if (b) delete (out[a!] as Record<string, unknown> | undefined)?.[b];
      else delete out[a!];
    }
    return out as unknown as PuzzleData;
  };
  const quiet = <T,>(fn: () => T): T => {
    const error = console.error;
    console.error = () => {};
    try {
      return fn();
    } finally {
      console.error = error;
    }
  };
  // The same answer graded on the deal and on the deal without the level's new field.
  const gradeBoth = (p: PuzzleData, keys: readonly string[], answer: string, msLeft: number): [number, number] => {
    const full = gradeAnswer(p, answer, msLeft).score;
    const without = quiet(() => gradeAnswer(strip(p, [...keys]), answer, msLeft).score);
    return [full, without];
  };
  {
    // Flash Expert: two trap taps (forgiven on Expert) and every gold at 0.27 s (full on Expert's own curve).
    const p = dealAt("reaction", "expert", 3) as Extract<PuzzleData, { type: "reaction" }>;
    const taps = [...p.flashes.map((f) => f + 270), p.decoys[0]!.at + 200, p.decoys[p.decoys.length - 1]!.at + 200].sort((x, y) => x - y);
    const [full, without] = gradeBoth(p, ["flashCurve", "flashFree"], `log1:${taps.join(",")}`, 0);
    ok(full === 200 && without < 200, `reaction expert: the curve and forgiven false starts are read (${full}; without them ${without})`);
  }
  {
    // The Chain Hard: the board size (a new board every six links) and Expert's full-by.
    const hard = dealAt("chain", "hard", 3);
    const run = proofChainRun(hard);
    const [full, without] = gradeBoth(hard, ["chainLevel.block"], run.answer, Math.max(0, 60_000 - run.atMs));
    ok(full === 200 && without !== full, `chain hard: the board size is read (${full}; without it ${without})`);
    const expert = dealAt("chain", "expert", 3);
    const late = proofChainRun(expert);
    const [f2, w2] = gradeBoth(expert, ["chainLevel.fullByS"], late.answer, Math.max(0, 70_000 - late.atMs));
    ok(f2 === 200 && w2 < 200, `chain expert: the full-by is read (${f2}; without it ${w2})`);
  }
  for (const [game, level, keys] of [["whack", "expert", ["bonkLevel.cols"]], ["tendrop", "hard", ["tenLevel"]], ["clayshoot", "expert", ["pullLevel.quickFullPct"]]] as const) {
    const p = dealAt(game, level, 3);
    // Pull!: the realistic elite's run (its quick credit is partial, so the level's quick line shows); else the proof.
    const answer = game === "clayshoot" ? playAs("elite", p, "d3-speed-ladder-check:quick").steps.at(-1)!.answer : proofAnswer(p);
    const full = gradeAnswer(p, answer, 0);
    const without = quiet(() => gradeAnswer(strip(p, [...keys]), answer, 0));
    const flagged = (g: { extra?: unknown }) => !!(g.extra as { flagged?: unknown } | undefined)?.flagged;
    ok(full.score !== without.score || flagged(full) !== flagged(without), `${game} ${level}: without ${keys.join(" and ")} the proof run grades otherwise (${full.score} → ${without.score})`);
  }
}

if (failures.length) {
  console.log(`\nFAIL d3-speed-ladder-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`\nd3-speed-ladder-check: ${passes} checks passed`);
