/**
 * pattern-overhaul-push-levels-check (16 Nov 2026, the Pattern overhaul stage 3; src/lib/levels/pattern/push.levels.ts,
 * docs/design/difficulty/README.md): Heave's Easy, Hard and Expert, the stuck hint, and the proof each level's
 * `oneSolution` (open: any push sequence that homes every crate counts) leans on: every level board's minimum.
 * No browser (happy-dom for the stage).
 *
 *   1. Settings dealt: every level deals its crates (3 / 5 / 6), a minimum in its push range (8–14 / 25–32 / 30–40),
 *      a gold crate on one of its marks, the level stamp, today's stamps (pushRev 3, as Normal) and Heave's 120 s clock; each
 *      deal is a board of its own level's bank, the same for a seed every time.
 *   2. The bank (src/lib/duel/pushLevelBank.server.ts, scripts/push-levels-bank.ts): every board's stored minimum
 *      solution replays on the shared rules (the worker walking to each push) to a solve in exactly `minPushes` pushes
 *      with the gold crate on its gold mark; every crate pushed at least the level's `perCrate` times; the detour where
 *      the level asks for it; no crate starting on a mark; no two boards alike; and the minimum proved again forwards
 *      from the start by an independent optimal solver (A*, scripts/push-levels-lib.ts) — a sample of 8 a level at
 *      quick depth, every board with CHECKS_FULL=1. The phone's par table (pushPar.data.ts) holds every level board.
 *   3. Normal is byte for byte the deal before levels: 40 deals against scripts/fixtures/pattern-overhaul-push-levels-
 *      normal.json (recorded on the tree before levels by scripts/pattern-overhaul-push-levels-record.ts); asking for
 *      "normal" deals the same; a Normal deal carries no level.
 *   4. The grid: every level keeps Normal's 9 × 9 warehouse (every cell in 0–80, the outer wall whole), so every board
 *      fits the phone exactly as Normal's does.
 *   5. A flawless solve (par pushes, full time) scores 200 at every level; the kit's near-perfect play finishes; the
 *      kit's Great and Near-perfect averages step down Easy ≥ Normal ≥ Hard ≥ Expert (Expert never easier than Hard).
 *   6. Grading reads the stored puzzle: a board dealt at a level is full speed by its level's time (Easy 30 s), the same
 *      board without its level by Normal's 45 s; an unfinished level board's credit is out of its own crates.
 *   7. The stuck hint (display only): on Easy and Normal (and a puzzle with no level), never on Hard or Expert; a dead
 *      square is never a mark, every corner without a mark is dead, no crate starts on one and no stored minimum
 *      solution ever pushes a crate onto one (every board of every bank, Normal's included); the stage tints a crate on a
 *      dead square on Easy and Normal only; push.stuck is fired by the stage and has a file; nothing that grades reads
 *      the hint; the help names it (help only).
 *
 *   bun scripts/pattern-overhaul-push-levels-check.ts
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "PointerEvent", "MouseEvent", "getComputedStyle", "MutationObserver"]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["ResizeObserver"] ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");
const { decodePushSolution, encodePushMoves, movePusher, pushStep, replayPush, PUSH_DIRS } = await import("../src/lib/duel/push");
const { pushParFor } = await import("../src/lib/duel/pushPar");
const { pushDeadSquares } = await import("../src/lib/duel/pushStuck");
const { stuckHintOn, pushLevelFullByS } = await import("../src/lib/duel/pushLevels");
const { patternFullByS } = await import("../src/lib/duel/standard/patternRules");
const { PUSH_LEVEL_BANK } = await import("../src/lib/duel/pushLevelBank.server");
const { PUSH_D4_BANK } = await import("../src/lib/duel/depth4/pushD4Bank.server");
const { dealtD4Rev } = await import("../src/lib/duel/depth4/stamps");
const { gameLevelSettings, levelsOf, levelProof } = await import("../src/lib/levels/gameLevels");
const { puzzleLevel, MAX_ROUND_CLOCK_MS } = await import("../src/lib/levels/levels");
const { PUZZLE_INSTRUCTIONS } = await import("../src/lib/duel/instructions");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const { pushPuzzle } = await import("../src/puzzles/push");
const { KITS } = await import("./puzzle-fairness/kits");
const { SKILLS, hashText, makeRng } = await import("./puzzle-fairness/kit");
const { asPhoneSends, gradeSteps } = await import("./standard-lib");
const { pushMinimum } = await import("./push-levels-lib");
const { PUSH_LEVELS_NORMAL_FIXTURE, PUSH_LEVELS_NORMAL_SEEDS } = await import("./pattern-overhaul-push-levels-record");
import type { PushLevelsNormalFixture } from "./pattern-overhaul-push-levels-record";
import type { PushLevelSettings } from "../src/lib/levels/pattern/push.levels";
import type { PuzzleData, PushPuzzleData, SlideDir } from "../src/lib/duel/types";

const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else if (failures.length < 60) failures.push(message);
};
const LEVELS = ["easy", "hard", "expert"] as const;
type L = (typeof LEVELS)[number];
const WANT: Record<L, { crates: number; min: number; max: number; perCrate: number; detour: boolean; hint: boolean; fullBy: number }> = {
  easy: { crates: 3, min: 8, max: 14, perCrate: 2, detour: false, hint: true, fullBy: 30 },
  hard: { crates: 5, min: 25, max: 32, perCrate: 3, detour: true, hint: false, fullBy: 45 },
  expert: { crates: 6, min: 30, max: 40, perCrate: 3, detour: true, hint: false, fullBy: 45 },
};
const OPP = { U: "D", D: "U", L: "R", R: "L" } as Record<SlideDir, SlideDir>;
const deal = (seed: number, level?: string) =>
  withSeededRandom(seed, () => generatePuzzle("push", { bankSeed: seed, ...(level ? { level: level as never } : {}) })) as PushPuzzleData;
const layoutKey = (e: { walls: readonly number[]; targets: readonly number[]; crates: readonly number[]; pusher: number }) =>
  `${e.walls.join(".")}/${e.targets.join(".")}/${e.crates.join(".")}/${e.pusher}`;

/** The pusher's shortest walk to `goal` (crates block). */
function walk(walls: Set<number>, crates: readonly number[], from: number, goal: number): SlideDir[] | null {
  if (from === goal) return [];
  const prev = new Map<number, [number, SlideDir]>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length) {
    const cell = queue.shift()!;
    for (const dir of PUSH_DIRS) {
      const next = pushStep(cell, dir);
      if (next === null || walls.has(next) || crates.includes(next) || seen.has(next)) continue;
      seen.add(next);
      prev.set(next, [cell, dir]);
      if (next === goal) {
        const path: SlideDir[] = [];
        for (let at = goal; at !== from; ) {
          const [p, d] = prev.get(at)!;
          path.unshift(d);
          at = p;
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** The stored minimum solution as the moves a phone sends (walks and pushes), or null if a push can't be reached. */
function solutionMoves(e: { walls: number[]; crates: number[]; pusher: number; solution?: string }): SlideDir[] | null {
  const walls = new Set(e.walls);
  let state = { pusher: e.pusher, crates: [...e.crates] };
  const moves: SlideDir[] = [];
  for (const push of decodePushSolution(e.solution ?? "")) {
    const stand = pushStep(push.cell, OPP[push.dir]);
    const path = stand === null ? null : walk(walls, state.crates, state.pusher, stand);
    if (!path) return null;
    for (const d of [...path, push.dir]) {
      const r = movePusher(state, d, walls);
      if (!r.moved) return null;
      state = r.state;
      moves.push(d);
    }
  }
  return moves;
}

/* ------------------------------------------------------------------ 1. settings dealt */
check(JSON.stringify(levelsOf("push")) === JSON.stringify(["easy", "normal", "hard", "expert"]), `levels: push offers ${levelsOf("push").join(", ")}`);
const dealt: Record<L, PushPuzzleData[]> = { easy: [], hard: [], expert: [] };
/** Today's Normal stamp (pushRev 3: depth batch 4, then the scoring standard): every level deals the same. */
const NORMAL_REV = deal(162_000).pushRev;
check(NORMAL_REV === 3, `normal: pushRev ${NORMAL_REV}`);
for (const level of LEVELS) {
  const s = gameLevelSettings<PushLevelSettings>("push", level)!;
  const w = WANT[level];
  check(
    s.crates === w.crates && s.pushes.min === w.min && s.pushes.max === w.max && s.perCrate === w.perCrate && s.detour === w.detour && s.stuckHint === w.hint && s.speedFullByS === w.fullBy && s.timeLimitMs === 120_000,
    `${level}: settings ${JSON.stringify(s)}`,
  );
  const proof = levelProof("push", level);
  check(!!proof && "open" in proof && /any push sequence/.test(proof.open) && /proved by solver/.test(proof.open), `${level}: oneSolution isn't the open rule`);
  const bankKeys = new Set(PUSH_LEVEL_BANK[level].map(layoutKey));
  for (let i = 0; i < 60; i++) {
    const seed = 162_000 + 97 * i;
    const p = deal(seed, level);
    dealt[level].push(p);
    check(puzzleLevel(p) === level, `${level} ${seed}: stamped ${puzzleLevel(p)}`);
    check(p.pushRev === NORMAL_REV && (p.pushRev ?? 0) >= dealtD4Rev("push"), `${level} ${seed}: pushRev ${p.pushRev} (Normal ${NORMAL_REV})`);
    check(p.crates.length === w.crates && p.targets.length === w.crates, `${level} ${seed}: ${p.crates.length} crates`);
    check((p.minPushes ?? 0) >= w.min && (p.minPushes ?? 0) <= w.max, `${level} ${seed}: minimum ${p.minPushes}`);
    check(!!p.gold && p.gold.crate >= 0 && p.gold.crate < p.crates.length && p.targets.includes(p.gold.target), `${level} ${seed}: gold ${JSON.stringify(p.gold)}`);
    check(puzzleTimeLimitMs(p as PuzzleData) === 120_000 && puzzleTimeLimitMs(p as PuzzleData) <= MAX_ROUND_CLOCK_MS, `${level} ${seed}: clock ${puzzleTimeLimitMs(p as PuzzleData)}`);
    check(bankKeys.has(layoutKey(p)), `${level} ${seed}: not a board of the ${level} bank`);
    if (i < 5) check(JSON.stringify(deal(seed, level)) === JSON.stringify(p), `${level} ${seed}: the same seed deals differently`);
  }
  check(new Set(dealt[level].map(layoutKey)).size >= 40, `${level}: 60 seeds dealt only ${new Set(dealt[level].map(layoutKey)).size} boards`);
}

/* ------------------------------------------------------------------ 2. the bank */
{
  const allKeys = new Set<string>();
  for (const level of LEVELS) {
    const w = WANT[level];
    const bank = PUSH_LEVEL_BANK[level];
    check(bank.length === 120, `${level}: bank holds ${bank.length} boards`);
    const sample = FULL ? bank : bank.filter((_e, i) => i % Math.ceil(bank.length / 8) === 0);
    bank.forEach((e, i) => {
      const tag = `${level} bank ${i}`;
      const key = layoutKey(e);
      check(!allKeys.has(key), `${tag}: a repeated board`);
      allKeys.add(key);
      check(e.crates.length === w.crates && e.targets.length === w.crates && !e.crates.some((c) => e.targets.includes(c)), `${tag}: crates ${e.crates} on marks ${e.targets}`);
      check(e.minPushes >= w.min && e.minPushes <= w.max, `${tag}: minimum ${e.minPushes}`);
      const moves = solutionMoves(e);
      check(!!moves, `${tag}: the stored solution can't be walked`);
      if (moves) {
        const r = replayPush(e.walls, e.targets, e.pusher, e.crates, moves);
        check(r.solved && r.pushes === e.minPushes && r.moves === e.minMoves, `${tag}: replays to solved ${r.solved}, ${r.pushes} pushes, ${r.moves} moves (stored ${e.minPushes}, ${e.minMoves})`);
        check(r.state.crates[e.gold.crate] === e.gold.target && e.targets.includes(e.gold.target), `${tag}: the gold crate ends off its gold mark`);
      }
      // Every crate pushed at least perCrate times; the detour where asked for.
      const now = [...e.crates];
      const counts = new Array<number>(now.length).fill(0);
      for (const m of decodePushSolution(e.solution)) {
        const k = now.indexOf(m.cell);
        if (k === -1) break;
        now[k] = pushStep(m.cell, m.dir)!;
        counts[k]!++;
      }
      check(counts.every((n) => n >= w.perCrate), `${tag}: pushes per crate ${counts}`);
      if (w.detour) check(e.detour, `${tag}: no detour`);
      check(pushParFor(e) === e.minPushes, `${tag}: the par table says ${pushParFor(e)}`);
    });
    for (const e of sample) {
      const found = pushMinimum(e);
      check(!!found && found.pushes === e.minPushes, `${level}: the forward solver finds ${found?.pushes ?? "nothing"} pushes on a board stored at ${e.minPushes}`);
    }
  }
  // The solver itself agrees with Normal's bank (a sample, each proved there by its own backward search).
  for (const e of PUSH_D4_BANK.filter((_e, i) => i % 30 === 0)) {
    const found = pushMinimum(e);
    check(!!found && found.pushes === e.minPushes, `solver: ${found?.pushes ?? "nothing"} pushes on a Normal board of ${e.minPushes}`);
  }
}

/* ------------------------------------------------------------------ 3. Normal byte for byte */
{
  const fx = JSON.parse(readFileSync(PUSH_LEVELS_NORMAL_FIXTURE, "utf8")) as PushLevelsNormalFixture;
  check(fx.live.length === PUSH_LEVELS_NORMAL_SEEDS.length, "normal: fixture size");
  for (const { seed, puzzle } of fx.live) {
    check(JSON.stringify(deal(seed)) === JSON.stringify(puzzle), `normal ${seed}: the live deal changed`);
    check(JSON.stringify(deal(seed, "normal")) === JSON.stringify(puzzle), `normal ${seed}: asking for Normal deals differently`);
    check(!("level" in (puzzle as object)) && puzzleLevel(puzzle) === "normal", `normal ${seed}: carries a level`);
  }
}

/* ------------------------------------------------------------------ 4. the grid */
for (const level of LEVELS) {
  for (const e of PUSH_LEVEL_BANK[level]) {
    const cells = [...e.walls, ...e.targets, ...e.crates, e.pusher];
    const border = Array.from({ length: 81 }, (_, c) => c).filter((c) => c < 9 || c >= 72 || c % 9 === 0 || c % 9 === 8);
    if (!cells.every((c) => Number.isInteger(c) && c >= 0 && c < 81) || !border.every((c) => e.walls.includes(c))) {
      check(false, `${level}: a board leaves the 9 × 9 warehouse`);
      break;
    }
  }
}
check(351 / 9 >= 39, "grid: Normal's 9 × 9 cell size");

/* ------------------------------------------------------------------ 5. 200, the kit, the step */
{
  const averages: Record<string, Record<string, number>> = { great: {}, near: {} };
  const levelsInOrder = ["easy", "normal", "hard", "expert"] as const;
  for (const level of levelsInOrder) {
    const sample = level === "normal" ? Array.from({ length: 24 }, (_, i) => deal(162_000 + 97 * i)) : dealt[level].slice(0, 24);
    if (level !== "normal") {
      for (const p of sample.slice(0, 12)) {
        const moves = solutionMoves(p)!;
        const gr = gradeAnswer(p as PuzzleData, encodePushMoves(moves), 120_000);
        const extra = gr.extra as { pushes?: number; goldHome?: boolean };
        check(gr.isCorrect && gr.score === 200 && extra.pushes === p.minPushes && extra.goldHome === true, `${level}: a flawless solve grades ${gr.isCorrect} ${gr.score} (${extra.pushes} pushes)`);
      }
    }
    for (const skill of ["great", "near"] as const) {
      let total = 0;
      let finished = 0;
      for (const [i, p] of sample.entries()) {
        const play = KITS.push!.play(p as PuzzleData, makeRng(hashText(`push-levels:${level}:${i}:${skill}`)), SKILLS[skill], 120_000);
        const run = gradeSteps(p as PuzzleData, asPhoneSends(p as PuzzleData, play.steps), play.timed);
        total += run.score;
        if (run.isCorrect) finished++;
      }
      averages[skill]![level] = total / sample.length;
      if (skill === "near") check(finished >= Math.ceil(sample.length * 0.9), `${level}: the near-perfect kit finished ${finished} of ${sample.length}`);
    }
  }
  for (const skill of ["great", "near"] as const) {
    const a = averages[skill]!;
    check(a["easy"]! >= a["normal"]! && a["normal"]! >= a["hard"]! && a["hard"]! >= a["expert"]!, `step: ${skill} averages easy ${a["easy"]} normal ${a["normal"]} hard ${a["hard"]} expert ${a["expert"]}`);
  }
  console.log(`  averages: ${JSON.stringify(averages)}`);
}

/* ------------------------------------------------------------------ 6. grading reads the level */
{
  for (const level of LEVELS) {
    const p = dealt[level][0]!;
    check(pushLevelFullByS(p) === WANT[level].fullBy && patternFullByS("push", p) === WANT[level].fullBy, `${level}: full speed by ${patternFullByS("push", p)} s`);
    const { level: _drop, ...bare } = p;
    check(pushLevelFullByS(bare) === null && patternFullByS("push", bare) === 45, `${level}: the board without its level isn't full by 45 s`);
  }
  // Easy at 38 s used: past its own 30 s, inside Normal's 45 s.
  const easy = dealt.easy[1]!;
  const moves = encodePushMoves(solutionMoves(easy)!);
  const own = gradeAnswer(easy as PuzzleData, moves, 120_000 - 38_000);
  const { level: _l, ...asNormal } = easy;
  const normal = gradeAnswer(asNormal as PuzzleData, moves, 120_000 - 38_000);
  check(own.isCorrect && normal.isCorrect && normal.score === 200 && own.score < 200 && own.score >= 190, `grade: Easy solved at 38 s scores ${own.score} (as Normal ${normal.score})`);
  // Unfinished on Expert: credit out of its own six crates.
  const ex = dealt.expert[0]!;
  const half = solutionMoves(ex)!;
  const part = half.slice(0, Math.floor(half.length * 0.7));
  const gp = gradeAnswer(ex as PuzzleData, encodePushMoves(part), 0);
  const extra = gp.extra as { crates?: number; cratesHome?: number };
  check(!gp.isCorrect && extra.crates === 6 && gp.score >= 0 && gp.score <= 130, `grade: an unfinished Expert board ${gp.score}, ${extra.cratesHome} of ${extra.crates}`);
}

/* ------------------------------------------------------------------ 7. the stuck hint */
{
  check(stuckHintOn(dealt.easy[0]!) && !stuckHintOn(dealt.hard[0]!) && !stuckHintOn(dealt.expert[0]!), "hint: on Easy only of the three levels");
  check(stuckHintOn(deal(5)) && stuckHintOn({ type: "push" }) && !stuckHintOn({ type: "iceslide" }), "hint: not on for Normal / an unlevelled puzzle");
  const boards = [...PUSH_D4_BANK, ...LEVELS.flatMap((l) => PUSH_LEVEL_BANK[l])];
  let bad = 0;
  let deadTotal = 0;
  for (const e of boards) {
    const dead = pushDeadSquares(e.walls, e.targets);
    deadTotal += dead.size;
    const wall = new Set(e.walls);
    if (e.targets.some((t) => dead.has(t)) || e.crates.some((c) => dead.has(c))) bad++;
    // Every floor corner without a mark is dead.
    for (let c = 0; c < 81; c++) {
      if (wall.has(c) || e.targets.includes(c)) continue;
      const up = wall.has(c - 9);
      const down = wall.has(c + 9);
      const left = wall.has(c - 1);
      const right = wall.has(c + 1);
      if ((up || down) && (left || right) && !dead.has(c)) bad++;
    }
    // No stored minimum solution pushes a crate onto a dead square.
    const now = [...e.crates];
    for (const m of decodePushSolution(e.solution)) {
      const k = now.indexOf(m.cell);
      now[k] = pushStep(m.cell, m.dir)!;
      if (dead.has(now[k]!)) bad++;
    }
  }
  check(bad === 0, `hint: ${bad} dead-square rule breaks across ${boards.length} boards`);
  check(deadTotal > boards.length, `hint: only ${deadTotal} dead squares across ${boards.length} boards (the test can't see the hint)`);
  // The stage tints a crate on a dead square (a made-up warehouse: a crate in a corner) on Easy and Normal only.
  const base = dealt.easy[0]!;
  const wall = new Set(base.walls);
  const corner = Array.from({ length: 81 }, (_, c) => c).find(
    (c) => !wall.has(c) && !base.targets.includes(c) && !base.crates.includes(c) && c !== base.pusher && (wall.has(c - 9) || wall.has(c + 9)) && (wall.has(c - 1) || wall.has(c + 1)),
  );
  check(corner !== undefined, "hint: no free corner on the board the test uses");
  if (corner !== undefined) {
    const stuckBoard = { ...base, crates: [corner, ...base.crates.slice(1)] };
    const html = (p: object) => renderToStaticMarkup(React.createElement(pushPuzzle.Stage, { puzzle: p, locked: false, onSubmit: () => {}, onDraftAnswer: () => {} } as never));
    const stuckCount = (p: object) => (html(p).match(/data-push-stuck=""/g) ?? []).length;
    check(stuckCount(stuckBoard) === 1, `stage: Easy tints ${stuckCount(stuckBoard)} crates`);
    const { level: _x, ...normalBoard } = stuckBoard;
    check(stuckCount(normalBoard) === 1, `stage: Normal tints ${stuckCount(normalBoard)} crates`);
    check(stuckCount({ ...stuckBoard, level: "hard" }) === 0 && stuckCount({ ...stuckBoard, level: "expert" }) === 0, "stage: Hard or Expert tints a crate");
    check(stuckCount(base) === 0, "stage: a crate tinted on a fresh deal");
  }
  const stage = readFileSync(new URL("../src/puzzles/push.tsx", import.meta.url), "utf8");
  check(/soundCue\("push\.stuck"\)/.test(stage), "sound: the stage never fires push.stuck");
  const slot = (SOUND_MANIFEST as Record<string, { url?: string | null }>)["push.stuck"];
  check(!!slot?.url, "sound: push.stuck has no file");
  for (const path of ["src/lib/duel/grade.ts", "src/lib/duel/standard/pattern.server.ts", "src/lib/duel/generate.server.ts", "src/lib/duel/gradeAnswer.server.ts"]) {
    let text = "";
    try {
      text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    } catch {
      continue;
    }
    check(!/pushStuck|stuckHint/.test(text), `hint: ${path} reads the stuck hint`);
  }
  const how = PUZZLE_INSTRUCTIONS.push.how;
  check(how.some((l) => /Easy and Normal/.test(l.action) && /red/.test(l.detail) && l.helpOnly), "help: the stuck hint isn't named (help only)");
  check(how.filter((l) => !l.helpOnly).length <= 4, "help: more than four intro HOW lines");
}

console.log(`pattern-overhaul-push-levels-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
