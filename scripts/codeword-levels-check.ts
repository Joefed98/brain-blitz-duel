/**
 * codeword-levels-check (the Word overhaul's levels, 15 Nov 2026; src/lib/levels/word/codeword.ts,
 * src/lib/duel/levels/codeword.server.ts). No browser, ~30 s. Proves Cryptogrid's Easy, Hard and Expert:
 *
 *  1. The registry: three levels, each clock at most 120 s, each naming this check as its proof; the ABOUT lines say
 *     what changes and use no jargon.
 *  2. Normal is today's game: a Normal deal (and one asked with no level) is byte for byte the plain deal, with no
 *     `level` field.
 *  3. Rooms: a level's deal is the same for every player (the room seed decides it), and carries `level` and its clock.
 *  4. The boards: the room seed's bank board at Easy and Hard, an Expert-list board at Expert; the givens the level's
 *     count, every given the solution's letter, Easy's a superset of Normal's six and Hard's a subset; today's stamps.
 *  5. One solution: every level's dealt board has exactly one solution (the full-dictionary solver, sampled seeds);
 *     every Expert-list board, at its four letters, too (all 666), and so every Hard board's five (a superset of four).
 *  6. Reasoning alone: every Expert-list board is decoded by the human-like solver from its four letters, to the real
 *     solution, and the list rebuilds byte for byte (scripts/codeword-expert-bank.ts).
 *  7. The tuning: the kit's near-perfect and great players on fixed seeds land in the bands tuned for each level, and
 *     the great player steps down from Normal to Hard to Expert (Joe, 16 Nov 2026: a clear step up in difficulty).
 *
 *   bun scripts/codeword-levels-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { CODEWORD_BANK } from "../src/lib/duel/codewordBank.server";
import { codewordFromEntry, countCodewordSolutions } from "../src/lib/duel/codeword.server";
import { CODEWORD_EXPERT_INDICES } from "../src/lib/duel/levels/codewordExpert.data";
import { solveCodewordLikeAHuman } from "../src/lib/duel/levels/codewordHuman.server";
import type { CodewordPuzzleData } from "../src/lib/duel/types";
import { CODEWORD_LEVELS, CODEWORD_LEVEL_ABOUT } from "../src/lib/levels/word/codeword";
import { gameLevelSettings, levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { gradeSteps } from "./standard-lib";
import { expertIndices } from "./codeword-expert-bank";

let checks = 0;
const ok = (cond: unknown, message: string) => {
  assert.ok(cond, message);
  checks++;
};

type Up = Exclude<Level, "normal">;
const UP: Up[] = ["easy", "hard", "expert"];
const deal = (seed: number, level?: Level) =>
  withSeededRandom(seed, () => generatePuzzle("codeword", { bankSeed: seed, ...(level ? { level } : {}) })) as CodewordPuzzleData;
const SEEDS = Array.from({ length: 24 }, (_, i) => 7_000 + i * 131);

// 1. The registry.
ok(JSON.stringify(levelsOf("codeword")) === JSON.stringify(["easy", "normal", "hard", "expert"]), "Cryptogrid offers all four levels");
for (const level of UP) {
  const s = gameLevelSettings<{ givens: number; clockMs: number }>("codeword", level)!;
  ok(s && s.clockMs <= MAX_ROUND_CLOCK_MS && s.clockMs > 0, `${level}: clock ${s.clockMs} ms within 120 s`);
  const proof = levelProof("codeword", level);
  ok(proof && "proof" in proof && proof.proof === "scripts/codeword-levels-check.ts", `${level}: names this check as its proof`);
  const about = CODEWORD_LEVEL_ABOUT[level] ?? "";
  ok(about.length > 0 && about.length <= 100 && !/core|units|full at|givens/i.test(about), `${level}: one plain line ("${about}")`);
  ok(about.includes(String(["", "", "", "", "Four", "Five", "", "", "Eight"][s.givens] ?? "")), `${level}: the line names the starting letters`);
}
ok(CODEWORD_LEVELS.levels.easy!.settings.givens > 6 && CODEWORD_LEVELS.levels.hard!.settings.givens < 6 && CODEWORD_LEVELS.levels.expert!.settings.givens === 4, "Easy gives more letters than Normal's six, Hard fewer, Expert the bank's own four");

// 2. Normal is today's game.
for (const seed of SEEDS.slice(0, 8)) {
  const plain = JSON.stringify(deal(seed));
  ok(JSON.stringify(deal(seed, "normal")) === plain, `seed ${seed}: Normal deals the plain board`);
  ok(puzzleLevel(deal(seed)) === "normal" && !("level" in deal(seed)), `seed ${seed}: no level field at Normal`);
}

// 3–5. Each level's deals.
const normalBySeed = new Map(SEEDS.map((seed) => [seed, deal(seed)]));
for (const level of UP) {
  const s = gameLevelSettings<{ givens: number; clockMs: number }>("codeword", level)!;
  for (const seed of SEEDS) {
    const p = deal(seed, level);
    const again = deal(seed, level);
    ok(JSON.stringify(p) === JSON.stringify(again), `${level} ${seed}: every player gets the same board`);
    ok(p.level === level && puzzleTimeLimitMs(p) === s.clockMs, `${level} ${seed}: stamped ${level}, clock ${s.clockMs}`);
    const normal = normalBySeed.get(seed)!;
    ok(p.codewordRev === normal.codewordRev, `${level} ${seed}: today's stamp (codewordRev ${normal.codewordRev})`);
    ok(p.givens.length === s.givens && new Set(p.givens.map((g) => g.n)).size === s.givens, `${level} ${seed}: ${s.givens} different numbers start decoded`);
    ok(p.givens.every((g) => p.solution![g.n - 1] === g.letter), `${level} ${seed}: every starting letter is the solution's`);
    if (level !== "expert") {
      ok(p.solution === normal.solution && p.cells.join() === normal.cells.join(), `${level} ${seed}: the room seed's own board`);
      const mine = new Set(p.givens.map((g) => g.n));
      const six = new Set(normal.givens.map((g) => g.n));
      if (level === "easy") ok([...six].every((n) => mine.has(n)), `easy ${seed}: Normal's six letters plus more`);
      else ok([...mine].every((n) => six.has(n)), `hard ${seed}: a subset of Normal's six`);
    } else {
      const index = CODEWORD_BANK.findIndex((e) => codewordFromEntry(e, 1).solution === p.solution && codewordFromEntry(e, 1).cells.join() === p.cells.join());
      ok(CODEWORD_EXPERT_INDICES.includes(index), `expert ${seed}: an Expert-list board (#${index})`);
    }
    ok(countCodewordSolutions(p.cells, p.numbers, p.givens, 2) === 1, `${level} ${seed}: exactly one solution`);
    ok(gradeAnswer(p, "", 0).score === 0, `${level} ${seed}: doing nothing scores 0`);
  }
}

// 5–6. Every Expert-list board: one solution at four letters, decoded by reasoning alone.
const list = expertIndices();
ok(JSON.stringify(list) === JSON.stringify([...CODEWORD_EXPERT_INDICES]), `the Expert list rebuilds exactly (${list.length} boards)`);
ok(list.length >= 500, `enough Expert boards (${list.length})`);
for (const index of CODEWORD_EXPERT_INDICES) {
  const p = codewordFromEntry(CODEWORD_BANK[index]!, 1);
  const r = solveCodewordLikeAHuman(p.cells, p.numbers, p.givens);
  ok(r.solved && r.letters.join("") === p.solution, `expert board ${index}: decoded by reasoning to the real solution`);
  ok(countCodewordSolutions(p.cells, p.numbers, p.givens, 2) === 1, `expert board ${index}: exactly one solution at four letters`);
}
const dataText = readFileSync("src/lib/duel/levels/codewordExpert.data.ts", "utf8");
ok(dataText.includes(`the ${list.length} of ${CODEWORD_BANK.length}`), "the data file says how many boards it lists");

// 7. The tuning (scripts/level-tune.ts's players on fixed seeds).
const BANDS: Record<Level, { near: [number, number]; great: [number, number] }> = {
  easy: { near: [190, 200], great: [185, 200] },
  normal: { near: [190, 200], great: [185, 200] },
  hard: { near: [185, 200], great: [175, 198] },
  expert: { near: [185, 200], great: [130, 190] },
};
const kit = KITS.codeword!;
const greatAvg: Partial<Record<Level, number>> = {};
for (const level of ["easy", "normal", "hard", "expert"] as Level[]) {
  const scores = { near: [] as number[], great: [] as number[] };
  for (const seed of SEEDS.slice(0, 20)) {
    const p = level === "normal" ? normalBySeed.get(seed)! : deal(seed, level);
    for (const who of ["near", "great"] as const) {
      const play = kit.play(p, makeRng(hashText(`codeword-levels:${seed}:${level}:${who}`)), SKILLS[who], puzzleTimeLimitMs(p));
      scores[who].push(gradeSteps(p, play.steps, play.timed).score);
    }
  }
  for (const who of ["near", "great"] as const) {
    const avg = scores[who].reduce((a, b) => a + b, 0) / scores[who].length;
    const [lo, hi] = BANDS[level][who];
    ok(avg >= lo && avg <= hi, `${level}: the ${who} player averages ${avg.toFixed(1)} (tuned ${lo}–${hi})`);
    if (who === "great") greatAvg[level] = avg;
  }
}
ok(greatAvg.normal! > greatAvg.hard! && greatAvg.hard! > greatAvg.expert! + 10, `a clear step up: great ${greatAvg.normal!.toFixed(1)} → ${greatAvg.hard!.toFixed(1)} → ${greatAvg.expert!.toFixed(1)}`);

console.log(`PASS codeword-levels-check: ${checks} checks (Easy 8 letters 120 s, Hard 5 letters 75 s, Expert 4 letters 65 s on ${list.length} reasoning-only boards)`);
