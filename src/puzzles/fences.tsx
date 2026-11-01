import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { useEffect, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { useStageState } from "@/lib/duel/stageState";
import {
  FENCES_CROSS,
  FENCES_EMPTY,
  FENCES_LINE,
  cellLineCount,
  decodeFences,
  edgeBetween,
  edgeDots,
  encodeFences,
  fencesEdgeCount,
  fencesLines,
  fencesSolved,
  hEdge,
  isHorizontal,
  vEdge,
} from "@/lib/duel/fences";
import { FENCES_SIZE, FENCES_TIME_MS, type FencesPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** SVG units: one cell, and the margin round the dots. */
const U = 100;
const PAD = 22;

const view = (size: number) => size * U + 2 * PAD;
const dotXY = (size: number, dot: number): [number, number] => {
  const w = size + 1;
  return [PAD + (dot % w) * U, PAD + Math.floor(dot / w) * U];
};

/** The edge nearest a point (SVG units): the closer grid line, the cell span it sits in. */
function nearestEdge(size: number, x: number, y: number): number {
  const fx = (x - PAD) / U;
  const fy = (y - PAD) / U;
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  const dy = Math.abs(fy - Math.round(fy));
  const dx = Math.abs(fx - Math.round(fx));
  if (dy <= dx) return hEdge(size, clamp(Math.round(fy), size), clamp(Math.floor(fx), size - 1));
  return vEdge(size, clamp(Math.floor(fy), size - 1), clamp(Math.round(fx), size));
}

/** The dot nearest a point, and its distance in cells. */
function nearestDot(size: number, x: number, y: number): { dot: number; dist: number } {
  const fx = (x - PAD) / U;
  const fy = (y - PAD) / U;
  const c = Math.max(0, Math.min(size, Math.round(fx)));
  const r = Math.max(0, Math.min(size, Math.round(fy)));
  return { dot: r * (size + 1) + c, dist: Math.hypot(fx - c, fy - r) };
}

/** The edges on the straight run between two dots on one grid line (empty when they are not in line). */
function edgesAlong(size: number, a: number, b: number): number[] {
  const w = size + 1;
  const [ar, ac, br, bc] = [Math.floor(a / w), a % w, Math.floor(b / w), b % w];
  if (ar !== br && ac !== bc) return [];
  const step = ar === br ? Math.sign(bc - ac) : Math.sign(br - ar) * w;
  const out: number[] = [];
  for (let d = a; d !== b; d += step) {
    const e = edgeBetween(size, d, d + step);
    if (e === null) break;
    out.push(e);
  }
  return out;
}

export function FencesBoard({
  size,
  clues,
  states,
  small = false,
  solved = false,
  handlers,
  svgRef,
}: {
  size: number;
  clues: readonly number[];
  states: readonly number[];
  small?: boolean;
  solved?: boolean;
  handlers?: {
    onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<SVGSVGElement>) => void;
  };
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const vb = view(size);
  const lines = useMemo(() => new Set(states.flatMap((s, e) => (s === FENCES_LINE ? [e] : []))), [states]);
  const edges = fencesEdgeCount(size);
  const dots = (size + 1) * (size + 1);
  const stroke = small ? 14 : 12;
  let order = 0;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${vb} ${vb}`}
      className={`fences-board block h-full w-full select-none ${small ? "fences-small" : ""}`}
      data-fences-solved={solved ? "" : undefined}
      style={handlers ? { touchAction: "none", overscrollBehavior: "none" } : undefined}
      {...(handlers ?? {})}
      role="img"
      aria-label="Fences board"
    >
      {/* Cell wells. */}
      {Array.from({ length: size * size }, (_, cell) => (
        <rect
          key={`c${cell}`}
          className="fences-cell"
          x={PAD + (cell % size) * U + 6}
          y={PAD + Math.floor(cell / size) * U + 6}
          width={U - 12}
          height={U - 12}
          rx={10}
        />
      ))}
      {/* Empty edges: faint guides. */}
      {Array.from({ length: edges }, (_, e) => {
        if (states[e] === FENCES_LINE) return null;
        const [a, b] = edgeDots(size, e).map((d) => dotXY(size, d));
        if (states[e] === FENCES_CROSS) {
          const mx = (a![0] + b![0]) / 2;
          const my = (a![1] + b![1]) / 2;
          const k = small ? 10 : 9;
          return (
            <g key={`x${e}`} className="fences-cross">
              <line x1={mx - k} y1={my - k} x2={mx + k} y2={my + k} />
              <line x1={mx - k} y1={my + k} x2={mx + k} y2={my - k} />
            </g>
          );
        }
        return <line key={`g${e}`} className="fences-guide" x1={a![0]} y1={a![1]} x2={b![0]} y2={b![1]} />;
      })}
      {/* Lines. */}
      {Array.from({ length: edges }, (_, e) => {
        if (states[e] !== FENCES_LINE) return null;
        const [a, b] = edgeDots(size, e).map((d) => dotXY(size, d));
        return (
          <line
            key={`l${e}`}
            className="fences-line"
            x1={a![0]}
            y1={a![1]}
            x2={b![0]}
            y2={b![1]}
            strokeWidth={stroke}
            style={{ "--fences-i": order++ % 40, "--fences-h": isHorizontal(size, e) ? 0 : 1 } as CSSProperties}
          />
        );
      })}
      {/* Dots. */}
      {Array.from({ length: dots }, (_, d) => {
        const [x, y] = dotXY(size, d);
        return <circle key={`d${d}`} className="fences-dot" cx={x} cy={y} r={small ? 8 : 7} />;
      })}
      {/* Numbers. */}
      {clues.map((n, cell) => {
        if (n < 0) return null;
        const k = cellLineCount(size, cell, lines);
        const tone = k === n ? "met" : k > n ? "over" : "open";
        return (
          <text
            key={`n${cell}`}
            className="fences-clue"
            data-tone={tone}
            x={PAD + (cell % size) * U + U / 2}
            y={PAD + Math.floor(cell / size) * U + U / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={small ? 58 : 50}
          >
            {n}
          </text>
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------------- the fixed intro example */

/** A fixed loop (the outline of these cells) on the real 6 × 6 board, half drawn, with a few numbers. */
const EXAMPLE_CELLS = [7, 8, 9, 13, 14, 15, 19, 20, 21, 22, 25, 26];

function exampleOutline(size: number, cells: readonly number[]): number[] {
  const inside = new Set(cells);
  const out: number[] = [];
  for (let e = 0; e < fencesEdgeCount(size); e++) {
    const [a, b] = edgeDots(size, e);
    const w = size + 1;
    const ar = Math.floor(a / w);
    const ac = a % w;
    const sides: number[] = [];
    if (isHorizontal(size, e)) {
      if (ar > 0) sides.push((ar - 1) * size + ac);
      if (ar < size) sides.push(ar * size + ac);
    } else {
      if (ac > 0) sides.push(ar * size + ac - 1);
      if (ac < size) sides.push(ar * size + ac);
    }
    void b;
    if (sides.filter((c) => inside.has(c)).length === 1) out.push(e);
  }
  return out;
}

function IntroExample() {
  const size = FENCES_SIZE;
  const loop = exampleOutline(size, EXAMPLE_CELLS);
  const on = new Set(loop);
  const clues = Array.from({ length: size * size }, (_, cell) =>
    [1, 8, 14, 15, 20, 28, 33].includes(cell) ? cellLineCount(size, cell, on) : -1,
  );
  // About two thirds of the loop drawn, and one ✕.
  const states = new Array<number>(fencesEdgeCount(size)).fill(FENCES_EMPTY);
  loop.slice(0, Math.ceil(loop.length * 0.65)).forEach((e) => (states[e] = FENCES_LINE));
  states[hEdge(size, 0, 0)] = FENCES_CROSS;
  return (
    <div style={{ width: 164 }}>
      <FencesBoard size={size} clues={clues} states={states} small />
    </div>
  );
}

/* --------------------------------------------------------------- the stage */

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: FencesPuzzleData | null = puzzle.type === "fences" ? puzzle : null;
  const size = data?.size ?? FENCES_SIZE;
  const clues = data?.clues ?? [];
  const [states, setStates] = useStageState<number[]>(stateKey ?? "fences", "fencesEdges", () =>
    new Array<number>(fencesEdgeCount(size)).fill(FENCES_EMPTY),
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const submitted = useRef(false);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    edge: number;
    dot: number;
    dragging: boolean;
    mode: number | null;
  } | null>(null);

  const encoded = encodeFences(states);
  const solved = Boolean(data && fencesSolved(data, encoded));
  const solving = useSolveFx("fences", solved);
  const lineCount = states.filter((s) => s === FENCES_LINE).length;
  const lineSet = new Set(fencesLines(encoded, size));
  const met = clues.filter((n, cell) => n >= 0 && cellLineCount(size, cell, lineSet) === n).length;
  const numbered = clues.filter((n) => n >= 0).length;
  const inFrame = useFrameProgress(met, numbered, "numbers met");

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current || !solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked]);

  const active = !locked && data !== null;

  const point = (e: ReactPointerEvent<SVGSVGElement>): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const vb = view(size);
    return [((e.clientX - rect.left) / rect.width) * vb, ((e.clientY - rect.top) / rect.height) * vb];
  };

  /** Sets edges to a state (a drag's draw or erase). */
  const paint = (edges: number[], to: number) => {
    if (!edges.length) return;
    setStates((current) => {
      if (edges.every((e) => current[e] === to)) return current;
      const next = [...current];
      for (const e of edges) next[e] = to;
      return next;
    });
    soundCue(to === FENCES_LINE ? "fences.draw" : "fences.cross");
  };

  const handlers = {
    onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!active || submitted.current) return;
      const p = point(e);
      if (!p) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Capture is a nicety.
      }
      gesture.current = { id: e.pointerId, x: p[0], y: p[1], edge: nearestEdge(size, p[0], p[1]), dot: nearestDot(size, p[0], p[1]).dot, dragging: false, mode: null };
    },
    onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId || !active) return;
      const p = point(e);
      if (!p) return;
      if (!g.dragging && Math.hypot(p[0] - g.x, p[1] - g.y) < U * 0.35) return;
      g.dragging = true;
      const near = nearestDot(size, p[0], p[1]);
      if (near.dist > 0.36 || near.dot === g.dot) return;
      const along = edgesAlong(size, g.dot, near.dot);
      if (!along.length) return;
      // The first edge decides: dragging over a line erases, anything else draws.
      if (g.mode === null) g.mode = states[along[0]!] === FENCES_LINE ? FENCES_EMPTY : FENCES_LINE;
      paint(along, g.mode);
      g.dot = near.dot;
    },
    onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => {
      const g = gesture.current;
      gesture.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Already released.
      }
      if (!g || g.dragging || !active || submitted.current) return;
      // A tap cycles the nearest edge: empty → line → ✕ → empty.
      const now = states[g.edge] ?? FENCES_EMPTY;
      const next = now === FENCES_EMPTY ? FENCES_LINE : now === FENCES_LINE ? FENCES_CROSS : FENCES_EMPTY;
      setStates((current) => current.map((s, i) => (i === g.edge ? next : s)));
      soundCue(next === FENCES_LINE ? "fences.draw" : "fences.cross");
    },
    onPointerCancel: () => {
      gesture.current = null;
    },
  };

  if (!data) return null;

  return (
    <div data-logic-stage="fences" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        {inFrame ? null : (
          <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
            numbers met <span className="text-primary">{met}</span> / {numbered}
          </p>
        )}
        <div className="logic-square logic-glass-frame fences-frame">
          <FencesBoard size={size} clues={clues} states={states} solved={solving} handlers={handlers} svgRef={svgRef} />
        </div>
        <LiveSummary inArena className="logic-status" items={[<SummaryItem key="lines" label="Lines" value={lineCount} />]} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the reveal */

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "fences") return null;
  const n = fencesEdgeCount(puzzle.size);
  const solution = new Array<number>(n).fill(FENCES_EMPTY);
  for (const e of puzzle.solution ?? []) solution[e] = FENCES_LINE;
  // The player's lines only (their ✕ notes are not shown).
  const mine = decodeFences(myAnswer ?? "", puzzle.size).map((s) => (s === FENCES_LINE ? FENCES_LINE : FENCES_EMPTY));
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  const lines = mine.filter((s) => s === FENCES_LINE).length;
  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-pair">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
            <div className="logic-glass-frame fences-frame w-full" style={{ aspectRatio: "1" }}>
              <FencesBoard size={puzzle.size} clues={puzzle.clues} states={solution} small />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
            <div className="logic-glass-frame fences-frame w-full" style={{ aspectRatio: "1" }}>
              <FencesBoard size={puzzle.size} clues={puzzle.clues} states={mine} small />
            </div>
          </div>
        </div>
      </div>
      <p className="logic-reveal-text text-center font-mono text-primary">
        {myCorrect ? `Solved · ${(elapsed / 1000).toFixed(1)}s` : (solutionProgress(puzzle, myAnswer ?? "")?.text ?? `${lines} lines drawn`)}
      </p>
    </div>
  );
}

export const fencesPuzzle: PuzzleDefinition = {
  key: "fences",
  name: gameDisplayName("fences"),
  category: "logic",
  timeLimitMs: FENCES_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "fences", fencesRev: 1, size: FENCES_SIZE, clues: new Array(FENCES_SIZE * FENCES_SIZE).fill(-1) }) satisfies FencesPuzzleData,
  check: (answer, puzzle) => puzzle.type === "fences" && fencesSolved(puzzle, answer),
  revealHeading: "The loop",
  IntroExample,
  Stage,
  Reveal,
};
