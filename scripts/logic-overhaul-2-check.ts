/**
 * logic-overhaul-2-check (15 Nov 2026): the Logic overhaul's session 2 (Tents and Trees, Shikaku, Lamplighter, Trail,
 * Loopline, Regions, Island Link).
 *
 *  1. Deals: rooms deal Trail depthRev 3 and Regions fillominoRev 2; pinPreLogic2(true) deals the stamps before; the help
 *     and intro texts follow the stamp.
 *  2. Trail depthRev 3: the clean bonus costs 2.5 an undo (an Undo, a step back, a reset, each one), not all of it;
 *     depthRev 2 keeps "any undo, no bonus"; no timeline, no clean bonus.
 *  3. Regions fillominoRev 2: one stroke over three wrong squares is one mistake (fillominoRev 1: three); a clean finish
 *     is still 200; unfinished credit is unchanged.
 *  4. Shikaku: the four jewel colours never touch alike on 200 dealt solutions and the example; the intro example is a
 *     real 6 × 6 board with exactly one solution, its drawn rectangles part of it.
 *  5. The boards (rendered to markup): Tents' lonely-tent ring and pill, the signs turning gold; Lamplighter's 0 ticked
 *     only once its neighbours are lit or dotted; Loopline's met numbers gold; Island Link's met coin; Regions' enamel
 *     by size; every sprite the boards name is a real file.
 *  6. The rules for every level of the seven games: at most 120 s, and every dealt board exactly one solution (sampled
 *     seeds through each game's own solver).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreLogic2, TRAIL_REV_UNDO_EACH, FILLOMINO_REV_STROKE } from "../src/lib/duel/logicOverhaul2";
import { trEncode, trSlots, trCountSolutions } from "../src/lib/duel/trail";
import { encodeFillomino } from "../src/lib/duel/fillomino";
import { countFillominoSolutions } from "../src/lib/duel/fillomino.server";
import { countShikakuSolutions, rectArea, rectHas, shikakuSolved } from "../src/lib/duel/shikaku";
import { countTentSolutions } from "../src/lib/duel/tents";
import { countLightUpSolutions } from "../src/lib/duel/lightUp";
import { countFencesSolutions } from "../src/lib/duel/fences.server";
import { countBridgesSolutions } from "../src/lib/duel/bridges.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { puzzleDef } from "../src/lib/duel/registry";
import type { FillominoPuzzleData, PuzzleData, ShikakuPuzzleData, TrailPuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SHIKAKU_EXAMPLE } from "../src/puzzles/shikaku";
import { rectsTouch, shikakuColours } from "../src/puzzles/shikakuColours";
import { Board as TentsBoard } from "../src/puzzles/tents";
import { Board as LampBoard } from "../src/puzzles/lightUp";
import { FencesBoard } from "../src/puzzles/fences";
import { BridgesBoard } from "../src/puzzles/bridges";
import { FillominoBoard } from "../src/puzzles/fillomino";
import { LOGIC_ART_URLS } from "../src/puzzles/logicArt.data";
import { sentAnswer } from "./standard-lib";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) {
  checks++;
  if (!cond) {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
}

const GAMES: PuzzleType[] = ["tents", "shikaku", "lightup", "trail", "fences", "fillomino", "bridges"];
const deal = <T extends PuzzleData>(type: PuzzleType, seed: number) => generatePuzzle(type, { bankSeed: seed, unblockRow: null }) as T;

// 1. Deals and texts.
{
  for (const seed of [11, 22, 33]) {
    ok((deal<TrailPuzzleData>("trail", seed) as { depthRev?: number }).depthRev === TRAIL_REV_UNDO_EACH, `trail seed ${seed}: depthRev 3`);
    ok(deal<FillominoPuzzleData>("fillomino", seed).fillominoRev === FILLOMINO_REV_STROKE, `fillomino seed ${seed}: fillominoRev 2`);
  }
  const liveTrailHelp = PUZZLE_INSTRUCTIONS.trail.score;
  const liveRegionsHelp = PUZZLE_INSTRUCTIONS.fillomino.score;
  ok(/each undo/.test(liveTrailHelp), "Trail's help states the undo cost");
  ok(/one stroke or tap counts once/.test(liveRegionsHelp), "Regions' help states a stroke counts once");
  pinPreLogic2(true);
  ok((deal<TrailPuzzleData>("trail", 11) as { depthRev?: number }).depthRev === 2, "pinned: Trail deals depthRev 2");
  ok(deal<FillominoPuzzleData>("fillomino", 11).fillominoRev === 1, "pinned: Regions deals fillominoRev 1");
  ok(/never take a placed number back/.test(PUZZLE_INSTRUCTIONS.trail.score), "pinned: Trail's help as before");
  pinPreLogic2(false);
  const tentsHelp = PUZZLE_INSTRUCTIONS.tents.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  ok(/“\?” signpost/.test(tentsHelp), "Tents' help explains the ? signposts");
  ok(PUZZLE_INSTRUCTIONS.shikaku.how.some((l) => /remove/.test(l.detail)), "Shikaku's help says a tap removes a rectangle");
  ok(PUZZLE_INSTRUCTIONS.bridges.how.some((l) => /Tap a bridge/.test(l.action)), "Island Link's help says a tap cycles a bridge");
}

// 2. Trail's undo cost.
function trailRuns(p: TrailPuzzleData, undos: number) {
  const g = p.givens;
  const sol = p.solution!;
  const finish = trEncode(trSlots(g, sol));
  const pathWith = (k: number) => {
    let n = 0;
    let end = 0;
    while (end < sol.length && n < k) {
      if (g[sol[end]!] === null) n++;
      end++;
    }
    return sol.slice(0, end);
  };
  const half = pathWith(13);
  const off = Array.from({ length: 36 }, (_, c) => c).find((c) => !half.includes(c) && c !== sol[half.length] && g[c] === null)!;
  const drafts: { answer: string; atMs: number }[] = [{ answer: trEncode(half), atMs: 20_000 }];
  for (let u = 0; u < undos; u++) {
    drafts.push({ answer: trEncode([...half, off]), atMs: 21_000 + u * 1000 });
    drafts.push({ answer: trEncode(half), atMs: 21_500 + u * 1000 });
  }
  drafts.push({ answer: finish, atMs: 50_000 });
  return drafts;
}
{
  for (const seed of [11, 22]) {
    const p = deal<TrailPuzzleData>("trail", seed);
    const limit = puzzleDef("trail").timeLimitMs;
    const score = (q: TrailPuzzleData, undos: number) => gradeAnswer(q, sentAnswer(q, trailRuns(q, undos)), limit - 50_000).score;
    ok(score(p, 0) === 200, `trail ${seed}: clean fast finish 200 (${score(p, 0)})`);
    ok(score(p, 1) === 198, `trail ${seed}: one undo 198 (150 + 40 + 7.5, rounded) (${score(p, 1)})`);
    ok(score(p, 2) === 195, `trail ${seed}: two undos 195 (${score(p, 2)})`);
    ok(score(p, 4) === 190, `trail ${seed}: four undos 190, the bonus gone (${score(p, 4)})`);
    ok(score(p, 6) === 190, `trail ${seed}: six undos never below 190 (${score(p, 6)})`);
    const old = { ...p, depthRev: 2 } as TrailPuzzleData;
    ok(score(old, 0) === 200 && score(old, 1) === 190, `trail ${seed}: depthRev 2 keeps any undo = no bonus (${score(old, 0)}, ${score(old, 1)})`);
    ok(gradeAnswer(p, trEncode(trSlots(p.givens, p.solution!)), limit - 50_000).score === 190, `trail ${seed}: no timeline, no clean bonus`);
  }
}

// 3. Regions' stroke rule.
{
  for (const seed of [11, 22]) {
    const p = deal<FillominoPuzzleData>("fillomino", seed);
    const sol = p.solution!;
    const blanks = p.givens.flatMap((g, c) => (g ? [] : [c]));
    const enc = (f: (c: number) => number) => encodeFillomino(p.givens.map((g, c) => (g ? g : f(c))));
    const wrong = (c: number) => (sol[c] === 1 ? 2 : 1);
    const three = new Set(blanks.slice(0, 3));
    const strokeOfThree = enc((c) => (three.has(c) ? wrong(c) : 0));
    const finished = enc((c) => sol[c]!);
    const drafts = [{ answer: strokeOfThree, atMs: 2_000 }, { answer: enc(() => 0), atMs: 3_000 }, { answer: finished, atMs: 20_000 }];
    const limit = puzzleDef("fillomino").timeLimitMs;
    const rev2 = gradeAnswer(p, sentAnswer(p, drafts), limit - 20_000);
    const rev1p = { ...p, fillominoRev: 1 } as FillominoPuzzleData;
    const rev1 = gradeAnswer(rev1p, sentAnswer(rev1p, drafts), limit - 20_000);
    ok(rev2.isCorrect && rev2.score === 198, `fillomino ${seed}: a stroke of three wrong squares is one mistake (198, got ${rev2.score})`);
    ok(rev1.isCorrect && rev1.score === 193, `fillomino ${seed}: fillominoRev 1 counts three (193, got ${rev1.score})`);
    const clean = gradeAnswer(p, sentAnswer(p, [{ answer: finished, atMs: 20_000 }]), limit - 20_000);
    ok(clean.score === 200, `fillomino ${seed}: a clean finish 200 (${clean.score})`);
    // Two separate strokes are two mistakes.
    const a = blanks[0]!;
    const b = blanks[5]!;
    const two = [{ answer: enc((c) => (c === a ? wrong(c) : 0)), atMs: 1_000 }, { answer: enc((c) => (c === a || c === b ? wrong(c) : 0)), atMs: 2_000 }, { answer: finished, atMs: 20_000 }];
    ok(gradeAnswer(p, sentAnswer(p, two), limit - 20_000).score === 195, `fillomino ${seed}: two strokes are two mistakes`);
    const part = enc((c) => (blanks.indexOf(c) < blanks.length / 2 ? sol[c]! : 0));
    ok(gradeAnswer(p, part, 0).score === gradeAnswer(rev1p, part, 0).score, `fillomino ${seed}: unfinished credit unchanged`);
  }
}

// 4. Shikaku's colours and example.
{
  let clashes = 0;
  for (let seed = 0; seed < 200; seed++) {
    const p = deal<ShikakuPuzzleData>("shikaku", 5000 + seed);
    const rects = p.solution ?? [];
    const col = shikakuColours(rects);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (rectsTouch(rects[i]!, rects[j]!) && col[i] === col[j]) clashes++;
    if (col.some((c) => c < 0 || c > 3)) clashes++;
  }
  ok(clashes === 0, `Shikaku: 200 dealt solutions, no two touching rectangles alike (${clashes})`);
  const ex = SHIKAKU_EXAMPLE;
  ok(shikakuSolved(ex.rects, ex.clues, ex.size, ex.size), "Shikaku example: its rectangles solve it");
  ok(countShikakuSolutions(ex.clues, 2, ex.size, ex.size) === 1, "Shikaku example: exactly one solution");
  ok(ex.rects.every((r) => ex.clues.filter((c) => rectHas(r, c.cell, ex.size)).length === 1 && ex.clues.some((c) => rectHas(r, c.cell, ex.size) && c.n === rectArea(r))), "Shikaku example: one number each, its area");
  const col = shikakuColours(ex.rects);
  ok(ex.rects.every((r, i) => ex.rects.every((q, j) => i === j || !rectsTouch(r, q) || col[i] !== col[j])), "Shikaku example: colours never touch alike");
}

// 5. The boards.
{
  const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
  // Tents: a tent with no tree beside it rings red in play; one beside a tree doesn't; a met count's sign turns gold.
  const marks = new Array(16).fill(0);
  marks[1] = 1; // beside the tree at 0
  marks[15] = 1; // no tree beside it
  const tents = html(createElement(TentsBoard, { size: 4, trees: [0], rowCounts: [1, 0, 0, 1], colCounts: [0, 1, 0, 1], marks, onTap: () => {} }));
  ok((tents.match(/data-lonely/g) ?? []).length === 1, "Tents: one lonely tent ringed");
  ok(/Tent with no tree beside it/.test(tents), "Tents: the lonely tent is named for screen readers");
  ok((tents.match(/data-met/g) ?? []).length >= 2, "Tents: met counts' signs turn gold");
  const reveal = html(createElement(TentsBoard, { size: 4, trees: [0], rowCounts: [1, 0, 0, 1], colCounts: [0, 1, 0, 1], marks }));
  ok(!/data-lonely/.test(reveal), "Tents: no lonely ring outside live play");
  // Lamplighter: a 0 wall is ticked only once every square beside it is lit or dotted.
  const board = { size: 3, walls: [4], wallNumbers: [0] };
  const none = html(createElement(LampBoard, { board, marks: new Array(9).fill(0) }));
  ok(!/logic2-tick/.test(none), "Lamplighter: a 0 opens unticked");
  const lit = html(createElement(LampBoard, { board, marks: [1, 0, 0, 0, 0, 0, 0, 0, 1] }));
  ok(/logic2-tick/.test(lit), "Lamplighter: a 0 is ticked once its neighbours are lit");
  ok(/data-lit/.test(lit) && /lightup-lamp/.test(lit), "Lamplighter: lit squares fill and lamps are the bulb sprite");
  // Loopline: a met number takes the met tone (drawn gold).
  const fences = html(createElement(FencesBoard, { size: 2, clues: [0, -1, -1, -1], states: new Array(12).fill(0) }));
  ok(/data-tone="met"/.test(fences) && /fences-slate/.test(fences) && /fences-peg/.test(fences), "Loopline: a met 0, the slate and the pegs");
  // Island Link: a met island draws the gold coin.
  const bridges = html(createElement(BridgesBoard, { size: 3, islands: [{ cell: 0, n: 1 }, { cell: 2, n: 1 }], counts: [1] }));
  ok((bridges.match(/bridges-coin-met/g) ?? []).length === 2, "Island Link: met islands are gold coins");
  // Regions: a finished region carries its size for the enamel.
  const regions = html(createElement(FillominoBoard, { size: 2, values: [1, 3, 3, 3], tones: ["entry", "entry", "entry", "entry"] }));
  ok(/data-size="3"/.test(regions) && /data-size="1"/.test(regions), "Regions: finished regions carry their size");
  // Every sprite a board names exists.
  const missing = Object.entries(LOGIC_ART_URLS).filter(([, url]) => !existsSync(join(import.meta.dir, "..", "public", url.split("?")[0]!)));
  ok(missing.length === 0, `every Logic sprite is on disk (${missing.map(([n]) => n).join(", ")})`);
}

// 6. Level rules: at most 120 s and exactly one solution.
{
  for (const type of GAMES) ok(puzzleDef(type).timeLimitMs <= 120_000, `${type}: at most 120 s (${puzzleDef(type).timeLimitMs})`);
  const seeds = [101, 202, 303];
  for (const seed of seeds) {
    const t = deal<PuzzleData & { type: "tents" }>("tents", seed);
    ok(countTentSolutions(t as never, 2) === 1, `tents ${seed}: one solution`);
    const s = deal<ShikakuPuzzleData>("shikaku", seed);
    ok(countShikakuSolutions(s.clues, 2, s.size, (s as { height?: number }).height ?? s.size) === 1, `shikaku ${seed}: one solution`);
    const l = deal<PuzzleData & { type: "lightup" }>("lightup", seed);
    ok(countLightUpSolutions(l as never, 2) === 1, `lightup ${seed}: one solution`);
    const tr = deal<TrailPuzzleData>("trail", seed);
    ok(trCountSolutions(tr.givens, 2) === 1, `trail ${seed}: one solution`);
    const f = deal<PuzzleData & { type: "fences"; size: number; clues: number[] }>("fences", seed);
    ok(countFencesSolutions(f.size, f.clues, 2) === 1, `fences ${seed}: one solution`);
    const fi = deal<FillominoPuzzleData>("fillomino", seed);
    ok(countFillominoSolutions(fi.size, fi.givens, 2) === 1, `fillomino ${seed}: one solution`);
    const b = deal<PuzzleData & { type: "bridges"; size: number; islands: { cell: number; n: number }[] }>("bridges", seed);
    ok(countBridgesSolutions(b.size, b.islands, 2) === 1, `bridges ${seed}: one solution`);
  }
}

console.log(failures.length ? `FAIL logic-overhaul-2-check: ${failures.length} of ${checks} checks failed` : `logic-overhaul-2-check: ${checks} passed`);
process.exit(failures.length ? 1 : 0);
