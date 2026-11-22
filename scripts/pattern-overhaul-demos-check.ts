/**
 * pattern-overhaul-demos-check (15 Nov 2026, the Pattern overhaul stage 2): the intro demos bundled with the app
 * (src/lib/duel/bundledDemos/) for the five Pattern games whose live demos stopped on the overhaul's stamps (Tessellate
 * blockRev 4, Pipeline pipesRev 5, Chroma Lines flowRev 3, Skid slideRev 5, Topsy-Turvy gravityRev 8).
 *
 * For each demo it proves:
 *   1. it parses as an intro_demos row (a puzzle demo log, the fixed intro example's id, at most 30 KB);
 *   2. it carries today's stamp and presentation: its puzzle is exactly the public half of the fixed intro example
 *      practice deals today (practiceGenerateFn's example path), getIntroDemoFn's own stamp rules accept it, the phone's
 *      presentation rule (puzzleInputDemoCompatible) accepts it, and it is on today's game column layout;
 *   3. getIntroDemoFn's choice (pickIntroDemo): with no live row, or a live row refused for an older stamp or recorded
 *      on an older presentation, the bundled demo plays; a live row recorded on today's stamp and presentation wins;
 *   4. its touches, decoded against the recorded play area (the arrow pad's order, the board's grid fitted to the
 *      touches), replay through the game's own rules to a solved board, showing the overhaul's mechanic (Skid an Undo
 *      that gives the slide back, Topsy-Turvy every ball home on all three boards, Pipeline turns both ways, Chroma
 *      Lines a crossed line cut, Tessellate a flip and clean drops).
 *
 *   bun scripts/pattern-overhaul-demos-check.ts
 */
import { readFileSync } from "node:fs";

import { PATTERN_BUNDLED_INTRO_DEMOS, bundledIntroDemo } from "../src/lib/duel/bundledDemos";
import { acceptIntroDemo, pickIntroDemo, type IntroDemoRow } from "../src/lib/duel/introDemo.functions";
import { puzzleInputDemoCompatible, puzzlePresentation, REVISED_PUZZLE_DEMOS } from "../src/components/puzzles/wordInput";
import { DEMO_FRAME_ATTRS, expandActions, GAME_COLUMN_LAYOUT, INTRO_EXAMPLE_ID, INTRO_EXAMPLE_SEED, isPuzzleDemoLog, type DemoAction, type PuzzleDemoLog } from "../src/lib/duel/puzzleDemo";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { bankedIntroExample } from "../src/lib/duel/puzzleBank.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { PATTERN_NOV15_STAMPS } from "../src/lib/duel/patternNov15";
import { TOPSY_LINE_REV } from "../src/lib/duel/topsyLine"; // Changed with Joe's approval, 22 Nov 2026
import { slideBoard, replaySlide, type SlideDir } from "../src/lib/duel/slide";
import { replayTopsyPuzzle, isTopsy } from "../src/lib/duel/topsy";
import { pipesAfterTurns, type PipesTurn } from "../src/lib/duel/depth4/pipesTaps";
import { pipesState } from "../src/lib/duel/logic";
import { flowDrawStep, verifyFlow } from "../src/lib/duel/flow";
import { absoluteCells, blockGeometry, orientationOffsets, tapPose, verifyPlacements } from "../src/lib/duel/blockParty";
import { PIPES_LONG_PRESS_MS } from "../src/puzzles/pipes";
import { DOUBLE_TAP_MS } from "../src/components/puzzles/BlockPartyPuzzle";
import type { BlockPlacement, GravityDir, PuzzleData, PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, what: string): void {
  if (cond) passes++;
  else failures.push(what);
}

const GAMES = ["blockparty", "pipes", "flow", "iceslide", "gravity"] as const;
type Game = (typeof GAMES)[number];
const MAX_BYTES = 30 * 1024;

/** The fixed intro example exactly as practiceGenerateFn's example path deals it today. */
function introExample(type: Game): PuzzleData {
  const liveFromBank = type === "iceslide" || type === "flow" || type === "blockparty";
  return liveFromBank
    ? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { bankSeed: INTRO_EXAMPLE_SEED }))
    : bankedIntroExample(type) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type));
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/* ------------------------------------------------------------------ geometry: touches to the board */

type Pt = { x: number; y: number };
const px = (log: PuzzleDemoLog, p: Pt) => ({ x: p.x * log.w, y: p.y * log.h });

/**
 * A square grid of n × n fitted to touches that land on cell centres (the outermost touched columns and rows are the
 * grid's first and last, asserted by the replay solving). Returns the cell under any point, and how far the fitting
 * touches sat from a centre (in cells).
 */
function fitGrid(log: PuzzleDemoLog, centres: Pt[], n: number) {
  const pts = centres.map((p) => px(log, p));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const cell = (Math.max(...xs) - x0) / (n - 1);
  const y0 = Math.min(...ys);
  const at = (p: Pt) => {
    const q = px(log, p);
    const col = Math.round((q.x - x0) / cell);
    const row = Math.round((q.y - y0) / cell);
    return col < 0 || col >= n || row < 0 || row >= n ? -1 : row * n + col;
  };
  const off = Math.max(
    ...pts.map((p) => {
      const c = (p.x - x0) / cell;
      const r = (p.y - y0) / cell;
      return Math.max(Math.abs(c - Math.round(c)), Math.abs(r - Math.round(r)));
    }),
  );
  return { at, off, cell };
}

/** The arrow pad's four buttons, left to right (ArrowPad): Left, Up, Down, Right; Undo and Reset in the row below. */
function padMoves(log: PuzzleDemoLog): string[] {
  const taps = log.actions.filter((a): a is Extract<DemoAction, { action: "tap" }> => a.action === "tap");
  // The pad row: the y most taps share.
  const rows = new Map<number, number>();
  for (const a of taps) rows.set(a.args.at.y, (rows.get(a.args.at.y) ?? 0) + 1);
  const padY = [...rows.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  return taps.map((a) => {
    const { x, y } = a.args.at;
    if (Math.abs(y - padY) < 0.02) return (["L", "U", "D", "R"] as const)[Math.min(3, Math.floor(x * 4))]!;
    if (y > padY) return x < 0.5 ? "X" : "Y";
    return "?";
  });
}

/* ------------------------------------------------------------------ per-game replays */

function replayIceslide(row: IntroDemoRow): void {
  const log = row.input_log as PuzzleDemoLog;
  const moves = padMoves(log);
  ok(!moves.includes("?"), "iceslide: every tap is on the pad or Undo / Reset");
  ok(log.actions.every((a) => a.action === "tap"), "iceslide: taps only");
  const r = replaySlide(slideBoard(row.puzzle as never), moves as SlideDir[]);
  ok(r.solved, `iceslide: the slides (${moves.join("")}) reach the exit`);
  ok(moves.includes("X"), "iceslide: the demo shows an Undo");
  const par = (row.puzzle as { par?: number }).par ?? 0;
  ok(r.net === par, `iceslide: Undo gives the slide back (standing ${r.net}, par ${par}, played ${r.moves})`);
  ok(r.moves > r.net, "iceslide: a slide was taken back");
}

function replayGravityDemo(row: IntroDemoRow): void {
  const log = row.input_log as PuzzleDemoLog;
  const moves = padMoves(log);
  ok(!moves.includes("?") && !moves.includes("X") && !moves.includes("Y"), "gravity: every tap is a tilt");
  const puzzle = row.puzzle;
  ok(isTopsy(puzzle), "gravity: a three-board Topsy-Turvy puzzle");
  if (!isTopsy(puzzle)) return;
  const r = replayTopsyPuzzle(puzzle, moves as GravityDir[]);
  ok(r.solved && r.cleared === 3, `gravity: the tilts (${moves.join("")}) clear all three boards (${r.cleared})`);
  ok(r.home === 18, `gravity: every ball home (${r.home} / 18)`);
}

function replayPipesDemo(row: IntroDemoRow): void {
  const log = row.input_log as PuzzleDemoLog;
  const presses = log.actions.filter((a) => a.action === "tap" || a.action === "hold") as Extract<DemoAction, { action: "tap" | "hold" }>[];
  ok(presses.length === log.actions.length, "pipes: taps and long presses only");
  const grid = fitGrid(log, presses.map((a) => a.args.at), 7);
  ok(grid.off < 0.12, `pipes: every press lands on a tile's centre (off by ${grid.off.toFixed(3)} of a tile)`);
  const turns: PipesTurn[] = presses.map((a) => ({ cell: grid.at(a.args.at), turn: a.action === "hold" && a.args.ms > PIPES_LONG_PRESS_MS ? 3 : 1 }));
  ok(turns.every((t) => t.cell >= 0), "pipes: every press is on the board");
  const p = row.puzzle as { tiles: { sides: number }[]; source: number; par?: number };
  const after = pipesAfterTurns(p.tiles, turns);
  const state = pipesState(after, p.source);
  ok(state.solved, `pipes: the turns join every pipe with no leaks (${state.connected.size} / 49 connected, ${state.leaks.size} leaking)`);
  const back = turns.filter((t) => t.turn === 3).length;
  ok(back > 0 && back < turns.length, `pipes: tiles turn both ways (${back} anticlockwise, ${turns.length - back} clockwise)`);
  ok(turns.length <= (p.par ?? Infinity), `pipes: within par (${turns.length} turns, par ${p.par})`);
}

function replayFlowDemo(row: IntroDemoRow): void {
  const log = row.input_log as PuzzleDemoLog;
  const drags = log.actions.filter((a): a is Extract<DemoAction, { action: "drag" }> => a.action === "drag");
  ok(drags.length === log.actions.length, "flow: drags only");
  const p = row.puzzle as { pairs: { colour: string; a: number; b: number }[]; walls: number[] };
  const grid = fitGrid(log, drags.flatMap((a) => [a.args.from, a.args.to]), 9);
  ok(grid.off < 0.12, `flow: every drag starts and ends on a square's centre (off by ${grid.off.toFixed(3)})`);
  // The stage's drawing rule (flow.tsx `touch`): a drag that starts on a dot draws that pair from it afresh.
  let paths: number[][] = p.pairs.map(() => []);
  let cuts = 0;
  for (const d of drags) {
    const startCell = grid.at(d.args.from);
    const pair = p.pairs.findIndex((x) => x.a === startCell || x.b === startCell);
    ok(pair !== -1, `flow: the drag at ${d.t} ms starts on a dot`);
    if (pair === -1) continue;
    const cells = [...(d.args.path ?? []).map(([x, y]) => grid.at({ x, y })), grid.at(d.args.to)];
    let restart: number | null = startCell;
    let active: number | null = pair;
    for (const cell of cells) {
      if (active === null || cell < 0) continue;
      const step = flowDrawStep(paths, active, cell, p.pairs, p.walls, restart, true);
      ok(!step.rejected, `flow: the drag at ${d.t} ms never steps where the rules refuse (square ${cell})`);
      if (!step.moved) continue;
      restart = null;
      if (step.cut !== null) cuts++;
      paths = step.paths;
      if (step.completed) active = null;
    }
  }
  const verdict = verifyFlow(p.pairs, paths, p.walls);
  ok(verdict.solved, `flow: the drags join all ${p.pairs.length} pairs and fill the board (${verdict.pairsJoined} joined, ${verdict.filled} filled)`);
  ok(cuts >= 1, `flow: the demo cuts a crossed line (${cuts} cut)`);
  ok(drags.length > p.pairs.length, "flow: a line is drawn again after its cut");
}

function replayBlockpartyDemo(row: IntroDemoRow): void {
  const log = row.input_log as PuzzleDemoLog;
  const puzzle = row.puzzle as never as { blockers: number[]; blockRev?: number };
  const geo = blockGeometry(puzzle as never);
  const n = geo.cols;
  const drags = log.actions.filter((a): a is Extract<DemoAction, { action: "drag" }> => a.action === "drag");
  // The board fills the stage's width (its columns never move); it moves down as the tray empties (the stage gives it the
  // height the tray leaves), so a drop's column comes from the width and its row from the search below.
  const xs = drags.map((a) => px(log, a.args.to).x);
  const x0 = Math.min(...xs);
  const cell = (Math.max(...xs) - x0) / (n - 1);
  const colOff = Math.max(...xs.map((x) => Math.abs((x - x0) / cell - Math.round((x - x0) / cell))));
  ok(colOff < 0.12, `blockparty: every drop lands on a column's centre (off by ${colOff.toFixed(3)} of a square)`);
  ok(drags.every((a) => a.args.from.y > a.args.to.y), "blockparty: every piece is picked up from the tray, under the board");
  // Taps before each drag pose the piece it picks up (a second tap within DOUBLE_TAP_MS of the first is a flip).
  type Step = { taps: boolean[]; col: number; y: number };
  const steps: Step[] = [];
  let pending: number[] = [];
  let flips = 0;
  for (const a of log.actions) {
    if (a.action === "tap") pending.push(a.t);
    else if (a.action === "drag") {
      const taps: boolean[] = [];
      let last: number | null = null;
      for (const t of pending) {
        const double = last !== null && t - last < DOUBLE_TAP_MS;
        taps.push(double);
        if (double) flips++;
        last = double ? null : t;
      }
      const q = px(log, a.args.to);
      steps.push({ taps, col: Math.round((q.x - x0) / cell), y: q.y });
      pending = [];
    } else ok(false, `blockparty: unexpected ${a.action}`);
  }
  ok(pending.length === 0, "blockparty: no taps after the last drop");
  ok(flips >= 1, `blockparty: the demo flips a piece with a double tap (${flips})`);
  // Each drop: a piece still in the tray, posed by its taps, grabbed by one of its squares, dropped on a row whose board
  // top never rises (the board only moves down as the tray empties), lands legally; the drops must cover the board.
  const taken = new Set(puzzle.blockers);
  const placed: BlockPlacement[] = [];
  const used = new Set<number>();
  const search = (i: number, top: number): boolean => {
    if (i === steps.length) return verifyPlacements(puzzle.blockers, placed, geo).solved;
    const step = steps[i]!;
    let pose = { rot: 0, flip: false };
    for (const double of step.taps) pose = tapPose(pose, double);
    for (let row = 0; row < n; row++) {
      const boardTop = step.y - (row + 0.5) * cell;
      if (boardTop < 0 || boardTop < top - 2) continue;
      for (let piece = 0; piece < geo.pieces.length; piece++) {
        if (used.has(piece)) continue;
        const offsets = orientationOffsets(piece, pose.rot, pose.flip, geo.pieces);
        for (const [gr, gc] of offsets) {
          const cells = absoluteCells(offsets, row - gr, step.col - gc, n);
          if (!cells || cells.some((c) => taken.has(c))) continue;
          used.add(piece);
          cells.forEach((c) => taken.add(c));
          placed.push({ piece, cells });
          if (search(i + 1, boardTop)) return true;
          placed.pop();
          cells.forEach((c) => taken.delete(c));
          used.delete(piece);
        }
      }
    }
    return false;
  };
  ok(search(0, 0), `blockparty: the ${steps.length} drops, posed by their taps, tile the board with every drop legal`);
  ok(steps.length === geo.pieces.length, `blockparty: one clean drop a piece (${steps.length} drops, ${geo.pieces.length} pieces)`);
}

const REPLAY: Record<Game, (row: IntroDemoRow) => void> = {
  iceslide: replayIceslide,
  gravity: replayGravityDemo,
  pipes: replayPipesDemo,
  flow: replayFlowDemo,
  blockparty: replayBlockpartyDemo,
};

/* ------------------------------------------------------------------ the checks */

// Gridlock (unblockRev 4) and Lightbender (laserRev 4) are bundled too since the demo packaging (15 Nov 2026): their
// rows, deals, stamp rules and runs are proved by pattern-demos-check (scripts/fixtures/pattern-demos.json), which also
// proves these five's against the fixture; the touch replays below stay for these five.
const ALSO_BUNDLED = ["unblock", "laser"] as const;
ok(
  Object.keys(PATTERN_BUNDLED_INTRO_DEMOS).sort().join() === [...GAMES, ...ALSO_BUNDLED].sort().join(),
  `the bundled demos are exactly ${[...GAMES, ...ALSO_BUNDLED].join(", ")} (have ${Object.keys(PATTERN_BUNDLED_INTRO_DEMOS).join(", ")})`,
);
ok(bundledIntroDemo("push") === null && bundledIntroDemo("toString") === null, "no bundled demo for other games (Heave's live demo plays)");
for (const game of ALSO_BUNDLED) {
  const row = bundledIntroDemo(game);
  ok(row !== null && acceptIntroDemo(game, row) === row && pickIntroDemo(game, null, row) === row, `${game}: bundled, accepted on today's stamp and chosen with no live row`);
}

for (const game of GAMES) {
  const row = bundledIntroDemo(game);
  ok(row !== null, `${game}: bundled`);
  if (!row) continue;
  const bytes = readFileSync(`src/lib/duel/bundledDemos/${game}.json`).length;
  ok(bytes <= MAX_BYTES, `${game}: ${bytes} bytes (at most ${MAX_BYTES})`);

  // 1. Parses as an intro_demos row.
  const log = row.input_log as PuzzleDemoLog & { presentation?: string };
  ok(row.game_type === game && row.puzzle.type === game, `${game}: game_type and puzzle type`);
  ok(row.example_id === INTRO_EXAMPLE_ID && row.seed === 0 && row.start_tick === 0, `${game}: the fixed intro example's row`);
  ok(isPuzzleDemoLog(log), `${game}: a puzzle demo log`);
  const lastT = Math.max(...log.actions.map((a) => a.t));
  ok(row.length_ticks === Math.round(lastT), `${game}: length is the last action's time (${row.length_ticks})`);
  ok(expandActions(log.actions).length >= log.actions.length, `${game}: the actions expand into events`);
  ok(log.actions.every((a, i, list) => i === 0 || a.t >= list[i - 1]!.t), `${game}: actions in time order`);

  // 2. Today's stamp and presentation.
  const pub = splitPuzzle(introExample(game)).pub;
  ok(JSON.stringify(row.puzzle) === JSON.stringify(pub), `${game}: the puzzle is exactly today's intro example (public half)`);
  const stamp = PATTERN_NOV15_STAMPS[game as PuzzleType]!;
  // Changed with Joe's approval, 22 Nov 2026: Topsy-Turvy's demo is on gravityRev 9, the stamp Normal deals since D4.
  const dealtRev = game === "gravity" ? TOPSY_LINE_REV : stamp.to; // Changed with Joe's approval, 22 Nov 2026
  ok((row.puzzle as unknown as Record<string, number>)[stamp.key] === dealtRev, `${game}: recorded on ${stamp.key} ${dealtRev}`); // Changed with Joe's approval, 22 Nov 2026
  ok(acceptIntroDemo(game, row) === row, `${game}: getIntroDemoFn's stamp rules accept it`);
  ok(REVISED_PUZZLE_DEMOS.has(game) && log.presentation === puzzlePresentation(game), `${game}: presentation ${log.presentation}`);
  ok(puzzleInputDemoCompatible(game, log), `${game}: the phone's presentation rule accepts it`);
  ok(log.layout === GAME_COLUMN_LAYOUT, `${game}: today's game column layout (${log.layout})`);
  // Recorded in the game frame: the player draws the stage under the same shell attributes and goal line.
  const attrs = log.frame?.attrs ?? {};
  ok(
    attrs["data-puzzle-play"] === "" && attrs["data-puzzle-screen"] === "" && attrs["data-category"] === "pattern" && attrs["data-puzzle-surface"] === game,
    `${game}: recorded in the game frame (${JSON.stringify(attrs)})`,
  );
  ok(Object.keys(attrs).every((name) => (DEMO_FRAME_ATTRS as readonly string[]).includes(name)), `${game}: only the frame's known attributes`);
  ok(!JSON.stringify(row).includes("__"), `${game}: no sealed-only fields`);

  // 3. The choice.
  ok(pickIntroDemo(game, null, row) === row, `${game}: no live row → the bundled demo`);
  const older = clone(row);
  (older.puzzle as unknown as Record<string, number>)[stamp.key] = stamp.from;
  ok(acceptIntroDemo(game, older) === null, `${game}: a live row on ${stamp.key} ${stamp.from} is refused`);
  ok(pickIntroDemo(game, acceptIntroDemo(game, older), row) === row, `${game}: a refused live row → the bundled demo`);
  const oldPresentation = clone(row);
  (oldPresentation.input_log as { presentation?: string }).presentation = "oct6-ring-controls";
  ok(pickIntroDemo(game, acceptIntroDemo(game, oldPresentation), row) === row, `${game}: a live row on an older presentation → the bundled demo`);
  const live = clone(row);
  live.input_log.actions = [...(live.input_log.actions ?? []), { t: lastT + 500, action: "tap", args: { at: { x: 0.5, y: 0.5 } } }];
  ok(pickIntroDemo(game, acceptIntroDemo(game, live), row) === live, `${game}: a live row on today's stamp and presentation wins`);
  ok(pickIntroDemo(game, null, null) === null, `${game}: nothing → nothing`);

  // 4. Replays to a solved board through the game's own rules.
  REPLAY[game](row);
  // …and the decode is sharp: the same demo without its last touch does not solve.
  const short = clone(row);
  short.input_log.actions = (short.input_log.actions ?? []).slice(0, -1);
  const before = { failed: failures.length, passed: passes };
  REPLAY[game](short);
  const caught = failures.length > before.failed;
  failures.length = before.failed;
  passes = before.passed;
  ok(caught, `${game}: without its last touch the demo no longer solves`);
}

// The player draws a frame-recorded demo as it was played (source rules: PuzzleDemo.tsx), and the recorder keeps the
// frame and a press still down when the round ends (puzzleDemo.ts).
const player = readFileSync("src/components/duel/PuzzleDemo.tsx", "utf8");
ok(/<GoalLineContext\.Provider value=\{log\.frame \? frameGoalLine : null\}>/.test(player), "player: a frame demo's stage gets the frame's goal line");
ok(/className="intro-demo [^"]*"[\s\S]{0,400}\{\.\.\.\(log\.frame\?\.attrs \?\? \{\}\)\}/.test(player), "player: a frame demo's box carries the shell's attributes (the stage stays its direct child)");
const recorder = readFileSync("src/lib/duel/puzzleDemo.ts", "utf8");
ok(/this\.frame = demoFrameOf\(el\)/.test(recorder) && /frame: this\.frame/.test(recorder), "recorder: keeps the frame it was played in");
ok(/const open = this\.down;[\s\S]{0,400}this\.finishPress\(open\)/.test(recorder), "recorder: keeps a press still down when the round ends");

// Engine and other games are untouched: a live engine row passes straight through, whatever is bundled.
const engineRow = { game_type: "tilt", seed: 1, puzzle: { type: "tilt" }, input_log: { run: "x" }, start_tick: 0, length_ticks: 1 } as unknown as IntroDemoRow;
ok(pickIntroDemo("tilt", engineRow, null) === engineRow, "an engine game's live row passes through");

if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  console.log(`pattern-overhaul-demos-check: FAIL (${failures.length} failed, ${passes} passed)`);
  process.exit(1);
}
console.log(`pattern-overhaul-demos-check: PASS (${passes} assertions)`);
