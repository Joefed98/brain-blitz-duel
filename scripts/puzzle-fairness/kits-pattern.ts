/**
 * Pattern-group player kits for the puzzle fairness audit (kit.ts): Gridlock,
 * Tessellate, Skid, Topsy-Turvy, Jumbled, Turntable, Lightbender, Chroma Lines
 * and Pipeline. Every answer is built exactly as the phone's Stage encodes it;
 * the runner grades it through gradeAnswer.
 */
import type { PuzzleData, BlockPlacement, MirrorPlacement, MirrorKind } from "../../src/lib/duel/types";
import { BLOCK_COLS, LASER_CELLS, LASER_MAX_FIRES } from "../../src/lib/duel/types";
import { applyMove, decodeMoves, encodeMoves, isSolved as unblockSolved, position, slideRange, type UnblockMove } from "../../src/lib/duel/unblock";
import { tilesLayout, tilesMovable, tilesSlide, tilesSolved, TILES_UNDO } from "../../src/lib/duel/tiles";
import { RING_TAPS, RING_UNDO, freshOffsets, ringsApply, ringsSolved } from "../../src/lib/duel/rings";
import { SLIDE_DIRS, slideBoard, slideOutcome, slideSearch, type SlideState } from "../../src/lib/duel/slide";
import { GRAVITY_DIRS, gravitySolved, tilt } from "../../src/lib/duel/gravity";
import { gravityMinimum } from "../../src/lib/duel/gravity.server";
import { BLOCK_ORIENTATIONS, BLOCK_PIECES, absoluteCells, encodePlacements, fitsOn } from "../../src/lib/duel/blockParty";
import { encodeLaserAnswer } from "../../src/lib/duel/laser";
import { appendAction, encodeActionLog, usesActionLog, type LoggedAction } from "../../src/lib/duel/actionLog";
import { laserAction } from "../../src/lib/duel/laserLog";
import { encodeFlowPaths, flowNeighbours } from "../../src/lib/duel/flow";
import { PIPE_BITS, pipeNeighbour, rotateMask, tileOpenings } from "../../src/lib/duel/logic";
import { thinkMs, type Play, type PuzzleKit, type Rng, type Skill, type Step } from "./kit";

type Of<T extends PuzzleData["type"]> = Extract<PuzzleData, { type: T }>;

/* ------------------------------------------------------------------------ */
/*  Shared move-game walker                                                  */
/* ------------------------------------------------------------------------ */

/** A replayed move game: the stored solution walked one move at a time. */
interface MoveGame<S, M> {
  start: S;
  solution: M[];
  legal(s: S): M[];
  apply(s: S, m: M): S;
  solved(s: S): boolean;
  same(a: M, b: M): boolean;
  token(m: M): string;
  sep: string;
  undo: string;
  /** The move that slides straight back (unblock, tiles, rings). */
  inverse?(before: S, m: M): M;
  /** A fresh shortest plan from here (for games with no inverse move). */
  replan?(s: S): M[] | null;
}

function encodeTokens(tokens: string[], sep: string): string {
  return tokens.join(sep);
}

/**
 * Plays the stored solution. A mistake is a random legal move other than the
 * planned one; the player then (next action) taps Undo, plays the reverse
 * slide (an extra counted move) or, with no reverse, carries on from the new
 * spot with a fresh plan. Mistake and recovery both cost think time.
 */
function playMoves<S, M>(g: MoveGame<S, M>, rng: Rng, skill: Skill, base: number): Play {
  const steps: Step[] = [];
  const tokens: string[] = [];
  const history: S[] = [g.start];
  let state = g.start;
  let plan = [...g.solution];
  let at = 0;
  const push = (tok: string) => {
    tokens.push(tok);
    steps.push({ answer: encodeTokens(tokens, g.sep), atMs: at });
  };
  for (let guard = 0; guard < 400 && !g.solved(state); guard++) {
    const next = plan[0];
    if (next === undefined) {
      const fresh = g.replan?.(state);
      if (!fresh || !fresh.length) break;
      plan = fresh;
      continue;
    }
    if (rng.chance(skill.err)) {
      const options = g.legal(state).filter((m) => !g.same(m, next));
      if (options.length) {
        const wrong = rng.pick(options);
        const before = state;
        at += thinkMs(rng, base, skill);
        state = g.apply(state, wrong);
        history.push(state);
        push(g.token(wrong));
        if (g.solved(state)) break;
        // Recovery: noticed on the next action.
        at += thinkMs(rng, base * 0.6, skill);
        const roll = rng.next();
        if (roll < 0.5 || (!g.inverse && !g.replan)) {
          history.pop();
          state = history[history.length - 1]!;
          push(g.undo);
        } else if (g.inverse) {
          const back = g.inverse(before, wrong);
          state = g.apply(state, back);
          history.push(state);
          push(g.token(back));
        } else {
          const fresh = g.replan!(state);
          if (fresh && fresh.length) {
            plan = fresh;
            // The re-plan itself is the thinking: the first fresh move goes now.
            const m = plan.shift()!;
            state = g.apply(state, m);
            history.push(state);
            push(g.token(m));
          } else {
            history.pop();
            state = history[history.length - 1]!;
            push(g.undo);
          }
        }
        continue;
      }
    }
    at += thinkMs(rng, base, skill);
    plan.shift();
    state = g.apply(state, next);
    history.push(state);
    push(g.token(next));
  }
  return { steps };
}

/** Random legal moves at `perSecond` for the whole round (stops once solved, as the phone does). */
function spamMoves<S, M>(g: MoveGame<S, M>, rng: Rng, limitMs: number, perSecond: number): string {
  const n = Math.floor((limitMs / 1000) * perSecond);
  const tokens: string[] = [];
  let state = g.start;
  for (let i = 0; i < n && !g.solved(state); i++) {
    const options = g.legal(state);
    if (!options.length) break;
    const m = rng.pick(options);
    state = g.apply(state, m);
    tokens.push(g.token(m));
  }
  return encodeTokens(tokens, g.sep);
}

function moveKit<S, M>(
  type: PuzzleData["type"],
  build: (p: PuzzleData) => MoveGame<S, M>,
  base: number,
): PuzzleKit {
  return {
    type,
    nothing: () => "",
    spam: (p, rng, limitMs) => {
      const g = build(p);
      return [
        { label: "random-1.5/s", answer: spamMoves(g, rng, limitMs, 1.5) },
        { label: "random-3/s", answer: spamMoves(g, rng, limitMs, 3) },
      ];
    },
    play: (p, rng, skill) => playMoves(build(p), rng, skill, base),
  };
}

/* ------------------------------------------------------------------------ */
/*  Gridlock (unblock)                                                       */
/* ------------------------------------------------------------------------ */

type Vehicles = Of<"unblock">["vehicles"];
function unblockGame(p: PuzzleData): MoveGame<Vehicles, UnblockMove> {
  const q = p as Of<"unblock">;
  return {
    start: q.vehicles.map((v) => ({ ...v })),
    solution: decodeMoves(q.solution ?? ""),
    legal: (s) => {
      const out: UnblockMove[] = [];
      for (const v of s) {
        const { min, max } = slideRange(s, v.id);
        for (let to = min; to <= max; to++) if (to !== position(v)) out.push({ id: v.id, to });
      }
      return out;
    },
    apply: (s, m) => applyMove(s, m) ?? s,
    solved: unblockSolved,
    same: (a, b) => a.id === b.id && a.to === b.to,
    token: (m) => encodeMoves([m]),
    sep: ",",
    undo: "-1:0",
    inverse: (before, m) => ({ id: m.id, to: position(before.find((v) => v.id === m.id)!) }),
  };
}
// BASE 2.2 s per slide: Rush Hour on a phone, spotting which car to clear next.
const unblockKit = moveKit("unblock", unblockGame, 2.2);

/* ------------------------------------------------------------------------ */
/*  Jumbled (tiles)                                                          */
/* ------------------------------------------------------------------------ */

function tilesGame(p: PuzzleData): MoveGame<number[], number> {
  const q = p as Of<"tiles">;
  const layout = tilesLayout(q);
  return {
    start: [...q.frame],
    solution: [...(q.solution ?? [])],
    legal: (s) => tilesMovable(s, layout),
    apply: (s, m) => tilesSlide(s, m, layout) ?? s,
    solved: (s) => tilesSolved(s, layout),
    same: (a, b) => a === b,
    token: (m) => String(m),
    sep: ",",
    undo: String(TILES_UNDO),
    inverse: (_before, m) => m,
  };
}
// BASE 1.5 s per slide: 8-puzzle taps, quick but each needs a look ahead. The extra-cell board
// (tilesRev 1) is TILES_EXTRA_BASE s (1.8, a fifth longer): nine tiles and a fourth cell in one line, so each slide
// needs a longer look ahead (an assumption, like every kit's base; Joe's device testing sets it).
const TILES_EXTRA_BASE = Number(process.env["TILES_EXTRA_BASE"] ?? 1.8);
const classicTilesKit = moveKit("tiles", tilesGame, 1.5);
const extraTilesKit = moveKit("tiles", tilesGame, TILES_EXTRA_BASE);
const tilesKit: PuzzleKit = {
  type: "tiles",
  nothing: classicTilesKit.nothing,
  spam: (p, rng, limitMs) => ((p as Of<"tiles">).tilesRev ? extraTilesKit : classicTilesKit).spam(p, rng, limitMs),
  play: (p, rng, skill, limitMs) => ((p as Of<"tiles">).tilesRev ? extraTilesKit : classicTilesKit).play(p, rng, skill, limitMs),
};

/* ------------------------------------------------------------------------ */
/*  Turntable (rings)                                                        */
/* ------------------------------------------------------------------------ */

function ringsGame(p: PuzzleData): MoveGame<number[], number> {
  const q = p as Of<"rings">;
  return {
    start: freshOffsets(),
    solution: [...(q.solution ?? [])],
    legal: () => RING_TAPS,
    apply: (s, m) => ringsApply(s, m, q.pattern),
    solved: (s) => ringsSolved(q.segments, s),
    same: (a, b) => a === b,
    token: (m) => String(m),
    sep: ",",
    undo: String(RING_UNDO),
    inverse: (_before, m) => m ^ 1,
  };
}
// BASE 4 s per turn: linked rings, each turn needs working out what else moves.
const ringsKit = moveKit("rings", ringsGame, 4);

/* ------------------------------------------------------------------------ */
/*  Skid (iceslide)                                                          */
/* ------------------------------------------------------------------------ */

type Dir = "U" | "D" | "L" | "R";
function slideGame(p: PuzzleData): MoveGame<SlideState, Dir> {
  const q = p as Of<"iceslide">;
  const board = slideBoard(q);
  return {
    start: { cell: q.start, mask: 0 },
    solution: (q.solution ?? "").split("") as Dir[],
    legal: (s) => (SLIDE_DIRS as Dir[]).filter((d) => slideOutcome(board, s.cell, s.mask, d).path.length > 0),
    apply: (s, d) => {
      const out = slideOutcome(board, s.cell, s.mask, d);
      return out.path.length ? { cell: out.cell, mask: out.mask } : s;
    },
    solved: (s) => s.cell === q.exit,
    same: (a, b) => a === b,
    token: (d) => d,
    sep: "",
    undo: "X",
    replan: (s) => (slideSearch(board, s)?.route as Dir[] | undefined) ?? null,
  };
}
// BASE 3.5 s per slide: tracing where the ball stops past holes, arrows and portals.
const iceslideKit = moveKit("iceslide", slideGame, 3.5);

/* ------------------------------------------------------------------------ */
/*  Topsy-Turvy (gravity)                                                    */
/* ------------------------------------------------------------------------ */

function gravityGame(p: PuzzleData): MoveGame<number[], Dir> {
  const q = p as Of<"gravity">;
  const walls = new Set(q.walls);
  return {
    start: [...q.starts],
    solution: (q.solution ?? "").split("") as Dir[],
    legal: (s) => (GRAVITY_DIRS as Dir[]).filter((d) => tilt(walls, s, q.targets, d).moved.some(Boolean)),
    apply: (s, d) => {
      const out = tilt(walls, s, q.targets, d);
      return out.moved.some(Boolean) ? out.balls : s;
    },
    solved: (s) => gravitySolved(s, q.targets),
    same: (a, b) => a === b,
    token: (d) => d,
    sep: "",
    undo: "X",
    replan: (s) => (gravityMinimum(walls, s, q.targets)?.solution as Dir[] | undefined) ?? null,
  };
}
// BASE 5 s per tilt: four balls move at once, so every tilt is planned for all of them.
const gravityKit = moveKit("gravity", gravityGame, 5);

/* ------------------------------------------------------------------------ */
/*  Tessellate (blockparty)                                                  */
/* ------------------------------------------------------------------------ */

function legalPlacements(piece: number, taken: Set<number>): number[][] {
  const out: number[][] = [];
  for (const offsets of BLOCK_ORIENTATIONS[piece]!) {
    for (let r = 0; r < BLOCK_COLS; r++) {
      for (let c = 0; c < BLOCK_COLS; c++) {
        const cells = absoluteCells(offsets, r, c);
        if (cells && fitsOn(cells, taken)) out.push(cells);
      }
    }
  }
  return out;
}

function takenBy(blockers: number[], placed: BlockPlacement[], skip?: number): Set<number> {
  const taken = new Set(blockers);
  for (const entry of placed) if (entry.piece !== skip) for (const c of entry.cells) taken.add(c);
  return taken;
}

const sameCells = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// BASE 5.5 s per piece: pick it, turn it (taps) and drag it into place.
const BLOCK_BASE = 5.5;
const blockpartyKit: PuzzleKit = {
  type: "blockparty",
  nothing: () => "",
  spam: (p, rng, limitMs) => {
    const q = p as Of<"blockparty">;
    // One pass: every tray piece dropped wherever it fits, random order.
    const once: BlockPlacement[] = [];
    for (const piece of rng.shuffle(BLOCK_PIECES.map((_, i) => i))) {
      const options = legalPlacements(piece, takenBy(q.blockers, once));
      if (options.length) once.push({ piece, cells: rng.pick(options) });
    }
    // Mashing for the whole round: ~1 drop a second, picking pieces back up when nothing fits.
    const mash: BlockPlacement[] = [];
    for (let i = 0; i < Math.floor(limitMs / 1000); i++) {
      const covered = mash.reduce((s, e) => s + e.cells.length, 0);
      if (covered >= 36 - q.blockers.length) break;
      const tray = BLOCK_PIECES.map((_, k) => k).filter((k) => !mash.some((e) => e.piece === k));
      const fits = tray
        .map((piece) => ({ piece, options: legalPlacements(piece, takenBy(q.blockers, mash)) }))
        .filter((x) => x.options.length);
      if (fits.length && rng.chance(0.85)) {
        const pick = rng.pick(fits);
        mash.push({ piece: pick.piece, cells: rng.pick(pick.options) });
      } else if (mash.length) {
        mash.splice(rng.below(mash.length), 1);
      }
    }
    // First fit, tray order, scanning top-left.
    const scan: BlockPlacement[] = [];
    for (let piece = 0; piece < BLOCK_PIECES.length; piece++) {
      const options = legalPlacements(piece, takenBy(q.blockers, scan));
      if (options.length) scan.push({ piece, cells: options.sort((a, b) => Math.min(...a) - Math.min(...b))[0]! });
    }
    return [
      { label: "drop-all-random", answer: encodePlacements(once) },
      { label: "mash-1/s", answer: encodePlacements(mash) },
      { label: "first-fit", answer: encodePlacements(scan) },
    ];
  },
  play: (p, rng, skill) => {
    const q = p as Of<"blockparty">;
    const solution = q.solution ?? [];
    const target = new Map(solution.map((s) => [s.piece, s.cells]));
    let placed: BlockPlacement[] = [];
    const todo = solution.map((s) => s.piece);
    const wrong = new Set<number>();
    const steps: Step[] = [];
    let at = 0;
    const put = (piece: number, cells: number[]) => {
      placed = [...placed.filter((e) => e.piece !== piece), { piece, cells }];
    };
    const blocking = (cells: number[]) => placed.find((e) => wrong.has(e.piece) && e.cells.some((c) => cells.includes(c)));
    for (let guard = 0; guard < 200 && (todo.length || wrong.size); guard++) {
      const next = todo[0];
      const nextBlock = next !== undefined ? blocking(target.get(next)!) : undefined;
      if (wrong.size && (next === undefined || nextBlock || rng.chance(0.4))) {
        // Fix a wrong piece: the one in the way, else any.
        const w = nextBlock?.piece ?? [...wrong][0]!;
        at += thinkMs(rng, BLOCK_BASE * 0.6, skill);
        const goal = target.get(w)!;
        const other = placed.find((e) => e.piece !== w && wrong.has(e.piece) && e.cells.some((c) => goal.includes(c)));
        if (other) {
          // Its home is covered by another wrong piece: lift that one back to the tray.
          placed = placed.filter((e) => e.piece !== other.piece);
          wrong.delete(other.piece);
          todo.push(other.piece);
        } else {
          put(w, goal);
          wrong.delete(w);
        }
        steps.push({ answer: encodePlacements(placed), atMs: at });
        continue;
      }
      todo.shift();
      at += thinkMs(rng, BLOCK_BASE, skill);
      const goal = target.get(next!)!;
      if (rng.chance(skill.err)) {
        const options = legalPlacements(next!, takenBy(q.blockers, placed, next)).filter((c) => !sameCells(c, goal));
        if (options.length) {
          put(next!, rng.pick(options));
          wrong.add(next!);
          steps.push({ answer: encodePlacements(placed), atMs: at });
          continue;
        }
      }
      put(next!, goal);
      steps.push({ answer: encodePlacements(placed), atMs: at });
    }
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Lightbender (laser)                                                      */
/* ------------------------------------------------------------------------ */

const FLIP: Record<MirrorKind, MirrorKind> = { "/": "\\", "\\": "/", "S|": "S-", "S-": "S|" };

function laserFree(q: Of<"laser">): number[] {
  const taken = new Set([...q.blocks, ...q.bombs, ...q.gems, ...(q.splitters ?? []), q.source]);
  return Array.from({ length: LASER_CELLS }, (_, i) => i).filter((c) => !taken.has(c));
}

function randomLayout(q: Of<"laser">, rng: Rng): MirrorPlacement[] {
  const free = rng.shuffle(laserFree(q));
  const out: MirrorPlacement[] = [];
  for (let i = 0; i < q.mirrors; i++) out.push({ cell: free[i]!, kind: rng.chance(0.5) ? "/" : "\\" });
  for (let i = 0; i < (q.splitterPieces ?? 0); i++) out.push({ cell: free[q.mirrors + i]!, kind: rng.chance(0.5) ? "S|" : "S-" });
  return out;
}

// BASE 5 s per piece: trace the beam, choose the piece and its facing, drag it on.
const LASER_BASE = 5;
/**
 * Puzzles stamped alogRev 1 (13 Oct 2026, #40) take the phone's action log (every placement,
 * removal and FIRE on the round clock); older ones the "fires|layout" answer. The play below
 * keeps both in step so stored and new rounds see the same player.
 */
class LaserLog {
  log: LoggedAction[] = [];
  constructor(private readonly on: boolean) {}
  add(a: string, t: number) { if (this.on) this.log = appendAction(this.log, a, t); }
  place(m: MirrorPlacement, t: number) { this.add(laserAction.place(m.cell, m.kind), t); }
  remove(cell: number, t: number) { this.add(laserAction.remove(cell), t); }
  fire(t: number) { this.add(laserAction.fire(), t); }
  answer(layout: MirrorPlacement[], fires: number): string { return this.on ? encodeActionLog(this.log) : encodeLaserAnswer(layout, fires); }
}

const laserKit: PuzzleKit = {
  type: "laser",
  // Legacy: the draft always carries max(1, fires), so an untouched board submits "1|". Action log: an empty log.
  nothing: (p) => (usesActionLog(p) ? encodeActionLog([]) : encodeLaserAnswer([], 1)),
  spam: (p, rng) => {
    const q = p as Of<"laser">;
    if (usesActionLog(p)) {
      const empty = new LaserLog(true);
      for (let shot = 0; shot < LASER_MAX_FIRES; shot++) empty.fire(1000 + shot * 2500);
      const random = new LaserLog(true);
      let t = 500;
      for (let shot = 0; shot < LASER_MAX_FIRES; shot++) {
        random.add(laserAction.reset(), (t += 400));
        for (const m of randomLayout(q, rng)) random.place(m, (t += 600));
        random.fire((t += 800));
      }
      const unfired = new LaserLog(true);
      t = 500;
      for (const m of randomLayout(q, rng)) unfired.place(m, (t += 600));
      return [
        { label: "fire-empty-x3", answer: empty.answer([], 0) },
        { label: "random-layout-x3", answer: random.answer([], 0) },
        { label: "random-layout-unfired", answer: unfired.answer([], 0) },
      ];
    }
    let last: MirrorPlacement[] = [];
    for (let shot = 0; shot < LASER_MAX_FIRES; shot++) last = randomLayout(q, rng);
    return [
      { label: "fire-empty-x3", answer: encodeLaserAnswer([], LASER_MAX_FIRES) },
      { label: "random-layout-x3", answer: encodeLaserAnswer(last, LASER_MAX_FIRES) },
      { label: "random-layout-unfired", answer: encodeLaserAnswer(randomLayout(q, rng), 1) },
    ];
  },
  play: (p, rng, skill) => {
    const q = p as Of<"laser">;
    const solution = q.solution ?? [];
    const free = laserFree(q);
    const placed: MirrorPlacement[] = [];
    /** Index into solution → is the placed piece wrong. */
    const wrongIdx = new Set<number>();
    const steps: Step[] = [];
    let at = 0;
    let fires = 0;
    const logged = usesActionLog(p);
    const log = new LaserLog(logged);
    const solvedLayout = () => wrongIdx.size === 0 && placed.length === solution.length;
    const draft = () => {
      // A fully right layout is only submitted by firing it; don't count the unfired draft.
      if (logged || !solvedLayout()) steps.push({ answer: log.answer(placed, Math.max(1, fires)), atMs: at });
    };
    const wrongPiece = (good: MirrorPlacement): MirrorPlacement => {
      if (rng.chance(0.5)) return { cell: good.cell, kind: FLIP[good.kind] };
      const used = new Set(placed.map((m) => m.cell).concat(solution.map((m) => m.cell)));
      const options = free.filter((c) => !used.has(c));
      return { cell: rng.pick(options), kind: good.kind };
    };
    solution.forEach((good, i) => {
      at += thinkMs(rng, LASER_BASE, skill);
      if (rng.chance(skill.err)) {
        placed.push(wrongPiece(good));
        wrongIdx.add(i);
      } else placed.push({ ...good });
      log.place(placed[placed.length - 1]!, at);
      draft();
    });
    while (fires < LASER_MAX_FIRES) {
      at += thinkMs(rng, 1, skill); // tap Fire
      fires += 1;
      log.fire(at);
      at += 1500; // watch the beam
      if (solvedLayout()) {
        steps.push({ answer: log.answer(placed, fires), atMs: at });
        break;
      }
      steps.push({ answer: log.answer(placed, fires), atMs: at });
      if (fires >= LASER_MAX_FIRES) break;
      // Read the miss, then fix what the beam showed (and maybe slip again).
      at += thinkMs(rng, 3, skill);
      for (const i of [...wrongIdx]) {
        at += thinkMs(rng, LASER_BASE * 0.7, skill);
        log.remove(placed[i]!.cell, at);
        if (rng.chance(skill.err / 2)) placed[i] = wrongPiece(solution[i]!);
        else {
          placed[i] = { ...solution[i]! };
          wrongIdx.delete(i);
        }
        log.place(placed[i]!, at + 300);
        draft();
      }
    }
    // The action log carries its own times: the last answer reached by the buzzer counts.
    return logged ? { steps, timed: true } : { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Chroma Lines (flow)                                                      */
/* ------------------------------------------------------------------------ */

/** Shortest route between a pair's dots through free cells, random tie-breaks. */
function flowRoute(q: Of<"flow">, pair: number, blocked: Set<number>, rng: Rng): number[] | null {
  const { a, b } = q.pairs[pair]!;
  const prev = new Map<number, number>([[a, -1]]);
  const queue = [a];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]!;
    if (cell === b) break;
    for (const n of rng.shuffle(flowNeighbours(cell))) {
      if (prev.has(n) || (blocked.has(n) && n !== b)) continue;
      prev.set(n, cell);
      queue.push(n);
    }
  }
  if (!prev.has(b)) return null;
  const path: number[] = [];
  for (let c = b; c !== -1; c = prev.get(c)!) path.unshift(c);
  return path;
}

function flowBlocked(q: Of<"flow">, paths: number[][], pair: number): Set<number> {
  const blocked = new Set(q.walls ?? []);
  q.pairs.forEach((pr, i) => {
    if (i !== pair) {
      blocked.add(pr.a);
      blocked.add(pr.b);
    }
  });
  paths.forEach((path, i) => {
    if (i !== pair) for (const c of path) blocked.add(c);
  });
  return blocked;
}

// BASE 5 s per pair: find the route, then drag it out cell by cell.
const FLOW_BASE = 5;
const flowKit: PuzzleKit = {
  type: "flow",
  nothing: (p) => encodeFlowPaths((p as Of<"flow">).pairs.map(() => [])),
  spam: (p, rng, limitMs) => {
    const q = p as Of<"flow">;
    // Drag each dot straight to its twin through whatever is still free.
    const direct: number[][] = q.pairs.map(() => []);
    for (const i of rng.shuffle(q.pairs.map((_, k) => k))) {
      const route = flowRoute(q, i, flowBlocked(q, direct, i), rng);
      if (route) direct[i] = route;
    }
    // Random scribbles out of each dot, ~1.5 cells a second in total.
    const scribble: number[][] = q.pairs.map(() => []);
    const budget = Math.floor((limitMs / 1000) * 1.5);
    let used = 0;
    for (const i of rng.shuffle(q.pairs.map((_, k) => k))) {
      const blocked = flowBlocked(q, scribble, i);
      const path = [q.pairs[i]!.a];
      for (let s = 0; s < 8 && used < budget; s++, used++) {
        const here = path[path.length - 1]!;
        if (here === q.pairs[i]!.b) break;
        const options = flowNeighbours(here).filter((n) => !path.includes(n) && (!blocked.has(n) || n === q.pairs[i]!.b));
        if (!options.length) break;
        path.push(rng.pick(options));
      }
      scribble[i] = path;
    }
    return [
      { label: "direct-lines", answer: encodeFlowPaths(direct) },
      { label: "scribble", answer: encodeFlowPaths(scribble) },
    ];
  },
  play: (p, rng, skill) => {
    const q = p as Of<"flow">;
    const solution = q.solution ?? [];
    const paths: number[][] = q.pairs.map(() => []);
    const order = q.pairs.map((_, i) => i).sort((x, y) => (solution[x]?.length ?? 0) - (solution[y]?.length ?? 0));
    const wrong = new Set<number>();
    const steps: Step[] = [];
    let at = 0;
    const draw = (i: number, path: number[]) => {
      // Drawing over another line cuts it away; that pair must be drawn again.
      const cells = new Set(path);
      paths.forEach((other, k) => {
        if (k !== i && other.some((c) => cells.has(c))) {
          paths[k] = [];
          wrong.delete(k);
          if (!order.includes(k)) order.push(k);
        }
      });
      paths[i] = path;
      steps.push({ answer: encodeFlowPaths(paths), atMs: at });
    };
    for (let guard = 0; guard < 200 && (order.length || wrong.size); guard++) {
      if (wrong.size && (!order.length || rng.chance(0.4))) {
        const w = [...wrong][0]!;
        at += thinkMs(rng, FLOW_BASE * 0.8, skill);
        wrong.delete(w);
        draw(w, solution[w]!);
        continue;
      }
      const i = order.shift()!;
      at += thinkMs(rng, FLOW_BASE, skill);
      if (rng.chance(skill.err)) {
        const route = flowRoute(q, i, flowBlocked(q, paths, i), rng);
        if (route && route.join() !== solution[i]!.join() && route.reverse().join() !== solution[i]!.join()) {
          route.reverse();
          paths[i] = route;
          wrong.add(i);
          steps.push({ answer: encodeFlowPaths(paths), atMs: at });
          continue;
        }
      }
      draw(i, solution[i]!);
    }
    return { steps };
  },
};

/* ------------------------------------------------------------------------ */
/*  Pipeline (pipes)                                                         */
/* ------------------------------------------------------------------------ */

const tapsTo = (from: number, to: number) => {
  for (let t = 0; t < 4; t++) if (rotateMask(from, t) === to) return t;
  return 0;
};
const sidesAnswer = (sides: number[]) => sides.map((s) => s.toString(16)).join("");

// BASE 1.6 s per tile that needs turning (find its fit from the flow so far), 0.4 s to check one already right.
const PIPE_BASE = 1.6;
const pipesKit: PuzzleKit = {
  type: "pipes",
  nothing: (p) => sidesAnswer((p as Of<"pipes">).tiles.map(tileOpenings)),
  spam: (p, rng, limitMs) => {
    const q = p as Of<"pipes">;
    const start = q.tiles.map(tileOpenings);
    const random = [...start];
    for (let i = 0; i < Math.floor((limitMs / 1000) * 2); i++) {
      const c = rng.below(random.length);
      random[c] = rotateMask(random[c]!, 1);
    }
    return [
      { label: "random-taps-2/s", answer: sidesAnswer(random) },
      { label: "tap-all-once", answer: sidesAnswer(start.map((s) => rotateMask(s, 1))) },
      { label: "random-turns", answer: sidesAnswer(start.map((s) => rotateMask(s, rng.below(4)))) },
    ];
  },
  play: (p, rng, skill) => {
    const q = p as Of<"pipes">;
    const goal = q.solution ?? q.tiles.map(tileOpenings);
    const sides = q.tiles.map(tileOpenings);
    // Work outward from the source along the solved pipes, as the water would run.
    const order: number[] = [q.source];
    const seen = new Set(order);
    for (let i = 0; i < order.length; i++) {
      for (const bit of PIPE_BITS) {
        if (!(goal[order[i]!]! & bit)) continue;
        const n = pipeNeighbour(order[i]!, bit);
        if (n !== null && !seen.has(n)) {
          seen.add(n);
          order.push(n);
        }
      }
    }
    for (let c = 0; c < sides.length; c++) if (!seen.has(c)) order.push(c);
    const wrong: number[] = [];
    const steps: Step[] = [];
    let at = 0;
    const turn = (cell: number, taps: number) => {
      at += taps * 250;
      sides[cell] = rotateMask(sides[cell]!, taps);
      steps.push({ answer: sidesAnswer(sides), atMs: at });
    };
    let k = 0;
    while (k < order.length || wrong.length) {
      if (wrong.length && (k >= order.length || rng.chance(0.35))) {
        // The water stops short: go back and turn the wrong tile right.
        const cell = wrong.shift()!;
        at += thinkMs(rng, PIPE_BASE * 0.8, skill);
        turn(cell, tapsTo(sides[cell]!, goal[cell]!));
        continue;
      }
      const cell = order[k++]!;
      const need = tapsTo(sides[cell]!, goal[cell]!);
      if (need === 0) {
        at += thinkMs(rng, 0.4, skill);
        continue;
      }
      at += thinkMs(rng, PIPE_BASE, skill);
      if (rng.chance(skill.err)) {
        // One tap too many or too few, unless that happens to look the same.
        const off = need + (rng.chance(0.5) ? 1 : 3);
        if (rotateMask(sides[cell]!, off) !== goal[cell]) {
          turn(cell, off % 4 || 4);
          wrong.push(cell);
          continue;
        }
      }
      turn(cell, need);
    }
    return { steps };
  },
};

export const KITS_PATTERN: PuzzleKit[] = [
  unblockKit,
  blockpartyKit,
  iceslideKit,
  gravityKit,
  tilesKit,
  ringsKit,
  laserKit,
  flowKit,
  pipesKit,
];
