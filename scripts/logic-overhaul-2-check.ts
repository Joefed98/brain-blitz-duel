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
 *  8. Stage 2's effects: the markup they read, Trail's rising notes, every listed sound slot in the manifest.
 *  7. The answer reveals: one board, your answer marked (wrong, missed), the tally and chips; solved and locked rounds.
 *  6. The rules for every level of the seven games: at most 120 s, and every dealt board exactly one solution (sampled
 *     seeds through each game's own solver).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPreLogic2, TRAIL_REV_UNDO_EACH, FILLOMINO_REV_STROKE } from "../src/lib/duel/logicOverhaul2";
import { trEncode, trSlots, trCountSolutions } from "../src/lib/duel/trail";
import { encodeFillomino } from "../src/lib/duel/fillomino";
import { encodeTents } from "../src/lib/duel/tents";
import { encodeShikaku } from "../src/lib/duel/shikaku";
import { encodeBulbs } from "../src/lib/duel/lightUp";
import { encodeFences, fencesEdgeCount, FENCES_EMPTY, FENCES_LINE } from "../src/lib/duel/fences";
import { encodeBridges } from "../src/lib/duel/bridges";
import { countFillominoSolutions } from "../src/lib/duel/fillomino.server";
import { countShikakuSolutions, rectArea, rectHas, shikakuSolved } from "../src/lib/duel/shikaku";
import { countTentSolutions } from "../src/lib/duel/tents";
import { countLightUpSolutions } from "../src/lib/duel/lightUp";
import { countFencesSolutions } from "../src/lib/duel/fences.server";
import { countBridgesSolutions } from "../src/lib/duel/bridges.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { puzzleDef } from "../src/lib/duel/registry";
import type { FillominoPuzzleData, PuzzleData, ShikakuPuzzleData, TrailPuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SHIKAKU_EXAMPLE, shikakuFills as shikakuColours, shikakuRectsTouch as rectsTouch } from "../src/puzzles/shikaku";
import { Board as TentsBoard, tentTreePairs } from "../src/puzzles/tents";
import { Board as ShikakuBoard } from "../src/puzzles/shikaku";
import { trailStepRate } from "../src/puzzles/trail";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { Board as LampBoard, lightUpPuzzle } from "../src/puzzles/lightUp";
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
  ok(/A \? sign/.test(tentsHelp) && /no tree beside it/.test(tentsHelp), "Tents' help explains the ? signs and the lonely-tent ring");
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
  // The "N squares dark" hint's line is held (hidden) from the first frame, so the board never moves when it shows
  // (the intro demo's taps landed a row off when it pushed the board up, 15 Nov 2026).
  const stage = html(createElement(lightUpPuzzle.Stage, { puzzle: { type: "lightup", size: 3, walls: [4], wallNumbers: [0] } as never, phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {}, stateKey: "logic2-check-lightup" }));
  ok(/class="logic2-hint"[^>]*data-hint-hidden/.test(stage), "Lamplighter: the dark-squares hint's line is kept from the start");
  // The light is one soft glow layer under the squares (Joe, 15 Nov 2026): a pool for every lit square, at its falloff.
  const glow = lit.match(/class="logic2-glow"[^>]*>(.*?)<\/i><\/i>/)?.[1] ?? "";
  const pools = (glow.match(/<i /g) ?? []).length;
  const litSquares = (lit.match(/data-lit=""/g) ?? []).length;
  ok(pools > 0 && pools === litSquares && (glow.match(/--logic2-light/g) ?? []).length === pools, `Lamplighter: one glow pool for each lit square (${pools} of ${litSquares})`);
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
  // Image budget (Joe, 15 Nov 2026): each game's art and tile under about 400 KB.
  const prefixes: Record<string, string[]> = { tents: ["tents-"], shikaku: ["shikaku-", "logic-cell"], lightup: ["lightup-", "logic-cell"], trail: ["trail-"], fences: ["fences-"], fillomino: ["fillomino-"], bridges: ["bridges-"] };
  for (const [game, pre] of Object.entries(prefixes)) {
    const bytes = Object.entries(LOGIC_ART_URLS)
      .filter(([n]) => pre.some((x) => n.startsWith(x)))
      .reduce((sum, [, url]) => sum + statSync(join(import.meta.dir, "..", "public", url.split("?")[0]!)).size, 0) + statSync(join(import.meta.dir, "..", "public", "tiles", `${game}.webp`)).size;
    ok(bytes < 400 * 1024, `${game}: art and tile ${Math.round(bytes / 1024)} KB, under 400 KB`);
  }
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

// 7. The answer reveal (the Logic overhaul, 15 Nov 2026): one board at a time, the player's answer marked against the
// solution (wrong ringed, missed dashed), a right / wrong / missed tally, plain chips; a solved round shows "Your
// solution" with no switch; a locked solution (a Daily or challenge before it closes) shows only the player's board.
{
  const wrongAnswers: Record<string, (p: any) => { half: string; full: string }> = {
    tents: (p) => {
      const sol: number[] = p.solution;
      const off = Array.from({ length: p.size * (p.height ?? p.size) }, (_, c) => c).find((c) => !sol.includes(c) && !p.trees.includes(c))!;
      return { half: encodeTents([...sol.slice(0, Math.floor(sol.length / 2)), off]), full: encodeTents(sol) };
    },
    shikaku: (p) => ({ half: encodeShikaku(p.solution.slice(0, Math.floor(p.solution.length / 2))), full: encodeShikaku(p.solution) }),
    lightup: (p) => {
      const sol: number[] = p.solution;
      const off = Array.from({ length: p.size * (p.height ?? p.size) }, (_, c) => c).find((c) => !sol.includes(c) && !p.walls.includes(c))!;
      return { half: encodeBulbs([...sol.slice(0, Math.floor(sol.length / 2)), off]), full: encodeBulbs(sol) };
    },
    trail: (p) => {
      const sol: number[] = p.solution;
      const path = sol.slice(0, 12);
      return { half: trEncode(path), full: trEncode(trSlots(p.givens, sol)) };
    },
    fences: (p) => {
      const n = fencesEdgeCount(p.size);
      const sol: number[] = p.solution;
      const states = new Array<number>(n).fill(FENCES_EMPTY);
      sol.slice(0, Math.floor(sol.length / 2)).forEach((e) => (states[e] = FENCES_LINE));
      const off = Array.from({ length: n }, (_, e) => e).find((e) => !sol.includes(e))!;
      states[off] = FENCES_LINE;
      const full = new Array<number>(n).fill(FENCES_EMPTY);
      sol.forEach((e) => (full[e] = FENCES_LINE));
      return { half: encodeFences(states), full: encodeFences(full) };
    },
    fillomino: (p) => {
      const sol: number[] = p.solution;
      const blanks = p.givens.flatMap((g: number, c: number) => (g ? [] : [c]));
      const half = new Set(blanks.slice(0, Math.floor(blanks.length / 2)));
      const wrongCell = blanks[blanks.length - 1];
      return {
        half: encodeFillomino(p.givens.map((g: number, c: number) => (g ? g : half.has(c) ? sol[c] : c === wrongCell ? (sol[c] === 1 ? 2 : 1) : 0))),
        full: encodeFillomino(sol),
      };
    },
    bridges: (p) => {
      const sol: number[] = p.solution;
      const mine = sol.map((k, i) => (i % 2 === 0 ? k : 0));
      const extra = sol.findIndex((k) => k === 1);
      if (extra >= 0) mine[extra] = 2;
      return { half: encodeBridges(mine), full: encodeBridges(sol) };
    },
  };
  const strip = (p: any) => {
    const { solution, ...rest } = p;
    void solution;
    return rest;
  };
  for (const type of GAMES) {
    const p = deal<any>(type, 7001);
    const Reveal = puzzleDef(type).Reveal!;
    const { half, full } = wrongAnswers[type]!(p);
    const props = { puzzle: p, myReactionAvgMs: null, timeLimitMs: puzzleDef(type).timeLimitMs, myExtra: { mistakes: 2, undos: 1 } };
    const partly = renderToStaticMarkup(createElement(Reveal, { ...props, myAnswer: half, myCorrect: false }));
    ok(/data-logic2-reveal-switch/.test(partly) && />Your answer</.test(partly) && />Solution</.test(partly), `${type} reveal: a switch, Your answer / Solution`);
    ok(/data-reveal-view="yours"/.test(partly), `${type} reveal: opens on the player's answer`);
    ok(/data-missed|logic2-bridge-missed/.test(partly), `${type} reveal: missed pieces drawn as ghosts`);
    ok(/data-logic2-tally/.test(partly) && /<b>\d+<\/b> of \d+ [a-z]+ right/.test(partly), `${type} reveal: the right / wrong / missed tally`);
    ok(!/×/.test(partly.replace(/<[^>]+>/g, " ")), `${type} reveal: no stray ×`);
    ok(/data-logic2-facts/.test(partly), `${type} reveal: number chips`);
    if (type !== "shikaku" && type !== "trail") ok(/data-wrong|data-clash|fillomino-over|logic2-bridge-wrong/.test(partly), `${type} reveal: wrong pieces marked`);
    ok((partly.match(/data-logic2=/g) ?? []).length === 1, `${type} reveal: one board at a time (${(partly.match(/data-logic2=/g) ?? []).length})`);
    const solved = renderToStaticMarkup(createElement(Reveal, { ...props, myAnswer: full, myCorrect: true }));
    ok(!/data-logic2-reveal-switch/.test(solved) && />Your solution</.test(solved) && !/data-logic2-tally/.test(solved), `${type} reveal: a solved round shows Your solution, no switch or tally`);
    const locked = renderToStaticMarkup(createElement(Reveal, { ...props, puzzle: strip(p), myAnswer: half, myCorrect: false }));
    ok(!/data-logic2-reveal-switch/.test(locked) && !/data-logic2-tally/.test(locked) && !/data-missed|logic2-bridge-missed/.test(locked), `${type} reveal: a locked solution shows only the player's board`);
  }
}

// 8. Stage 2, the effects (15 Nov 2026, the effects kit): the markup the effects read, the pitch helpers, and every
// sound slot in the ElevenLabs list present in the manifest with a file (a library placeholder until Joe's arrives).
{
  const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
  const marks = new Array(16).fill(0);
  marks[1] = 1;
  const camp = html(createElement(TentsBoard, { size: 4, trees: [0], rowCounts: [1, 0, 0, 0], colCounts: [0, 1, 0, 0], marks, onTap: () => {} }));
  ok((camp.match(/logic2-pair-line/g) ?? []).length === 2, "Tents: a paired tent and its tree each draw half the joining line");
  ok(/data-tent-cell="1"/.test(camp) && /data-sign="r0"/.test(camp) && /data-sign="c1"/.test(camp), "Tents: squares and signs are named for the effects");
  const pairs = tentTreePairs([1, 4], new Set([0]), 4, 4);
  ok(pairs.size === 1, "Tents: two tents beside one tree pair only one of them");
  const shik = html(createElement(ShikakuBoard, { size: 3, clues: [{ cell: 0, n: 3 }], rects: [{ r0: 0, c0: 0, r1: 0, c1: 2 }], bad: { r0: 1, c0: 0, r1: 1, c1: 1 } }));
  ok(/data-bad-rect/.test(shik) && /data-rect="0,0,0,2"/.test(shik), "Shikaku: the refused outline and each pane's rectangle are drawn for the effects");
  const lamps = html(createElement(LampBoard, { board: { size: 3, walls: [4], wallNumbers: [1] }, marks: [0, 1, 0, 0, 0, 0, 0, 0, 0] }));
  ok(/data-bulb="1"/.test(lamps) && /data-wall="4"/.test(lamps), "Lamplighter: bulbs and walls are named for the effects");
  ok(Math.abs(trailStepRate(1) - 1) < 1e-9 && trailStepRate(2) > 1 && Math.abs(trailStepRate(8) - 1) < 1e-9, "Trail: each step's note climbs a major scale and wraps every octave");
  const isl = html(createElement(BridgesBoard, { size: 3, islands: [{ cell: 0, n: 1 }, { cell: 2, n: 1 }], counts: [1], justBuilt: { pair: 0, key: 1 } }));
  ok(/logic2-lay/.test(isl) && /pathLength="1"/.test(isl) && /data-island="0"/.test(isl), "Island Link: a bridge just built lays in, islands are named for the effects");
  const doc = readFileSync(join(import.meta.dir, "..", "docs/sound-cues/logic-elevenlabs-2.md"), "utf8");
  const slots = [...doc.matchAll(/^\| \d+ \| `([a-z]+\.[A-Za-z]+)`/gm)].map((m) => m[1]!);
  const missing = slots.filter((slot) => !(slot in SOUND_MANIFEST));
  ok(slots.length >= 45 && missing.length === 0, `every slot in the ElevenLabs list is in the manifest (${slots.length} listed; missing ${missing.join(", ")})`);
  const silent = slots.filter((slot) => !(SOUND_MANIFEST as Record<string, { url: string | null }>)[slot]?.url && !["tents.pitch", "tents.grass", "shikaku.place", "shikaku.remove", "lightup.lamp", "lightup.dot", "trail.step", "lightup.clear", "tents.clear"].includes(slot));
  ok(silent.length === 0, `every new slot plays a placeholder file until Joe's arrives (silent: ${silent.join(", ")})`);
}

console.log(failures.length ? `FAIL logic-overhaul-2-check: ${failures.length} of ${checks} checks failed` : `logic-overhaul-2-check: ${checks} passed`);
process.exit(failures.length ? 1 : 0);
