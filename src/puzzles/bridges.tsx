import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import {
  bridgePairs,
  bridgesSolvedCounts,
  crossingTable,
  decodeBridges,
  encodeBridges,
  islandDegrees,
  type BridgePair,
} from "@/lib/duel/bridges";
import { BRIDGES_SIZE, BRIDGES_TIME_MS, type BridgesIsland, type BridgesPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { puzzleReject } from "@/lib/fx/puzzleReject";

import { soundCue, useSolveFx } from "./logicFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** SVG units per grid cell. */
const CELL = 100;
const RADIUS = 36;

function centre(size: number, cell: number): [number, number] {
  return [(cell % size) * CELL + CELL / 2, Math.floor(cell / size) * CELL + CELL / 2];
}

type Tone = "open" | "done" | "over";

export function BridgesBoard({
  size,
  islands,
  counts,
  preview,
  small = false,
  boardRef,
  handlers,
}: {
  size: number;
  islands: readonly BridgesIsland[];
  counts: readonly number[];
  /** A pair the finger is dragging along (drawn as a faint guide). */
  preview?: number | null;
  small?: boolean;
  boardRef?: React.RefObject<SVGSVGElement | null>;
  handlers?: React.SVGProps<SVGSVGElement>;
}) {
  const pairs = useMemo(() => bridgePairs(islands, size), [islands, size]);
  const deg = islandDegrees(islands, pairs, counts);
  const tone = (i: number): Tone => (deg[i]! === islands[i]!.n ? "done" : deg[i]! > islands[i]!.n ? "over" : "open");
  const span = size * CELL;
  const line = (p: BridgePair, offset: number, key: string, cls: string) => {
    const [x1, y1] = centre(size, islands[p.a]!.cell);
    const [x2, y2] = centre(size, islands[p.b]!.cell);
    const dx = p.horizontal ? RADIUS : 0;
    const dy = p.horizontal ? 0 : RADIUS;
    const ox = p.horizontal ? 0 : offset;
    const oy = p.horizontal ? offset : 0;
    return <line key={key} className={cls} x1={x1 + dx + ox} y1={y1 + dy + oy} x2={x2 - dx + ox} y2={y2 - dy + oy} />;
  };
  return (
    <svg
      ref={boardRef}
      viewBox={`0 0 ${span} ${span}`}
      className={`bridges-board block h-full w-full select-none ${small ? "bridges-board-small" : ""}`}
      {...handlers}
    >
      <g className="bridges-dots">
        {Array.from({ length: size * size }, (_, cell) => {
          const [x, y] = centre(size, cell);
          return <circle key={cell} cx={x} cy={y} r={4} />;
        })}
      </g>
      {preview !== null && preview !== undefined && pairs[preview] ? line(pairs[preview]!, 0, "preview", "bridges-preview") : null}
      <g className="bridges-lines">
        {pairs.flatMap((p, i) => {
          const k = counts[i] ?? 0;
          if (k === 1) return [line(p, 0, `b${i}`, "bridges-line")];
          if (k === 2) return [line(p, -12, `b${i}a`, "bridges-line"), line(p, 12, `b${i}b`, "bridges-line")];
          return [];
        })}
      </g>
      {islands.map((isl, i) => {
        const [x, y] = centre(size, isl.cell);
        return (
          <g key={isl.cell} className={`bridges-island bridges-island-${tone(i)}`} style={{ "--logic-i": i } as CSSProperties}>
            <circle cx={x} cy={y} r={RADIUS} />
            <text x={x} y={y} dy="0.35em" textAnchor="middle">
              {isl.n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Fixed intro example: a 7 × 7 board with its solved bridges (generateBridges(20261101)'s board). */
const EXAMPLE_ISLANDS: BridgesIsland[] = [
  { cell: 6, n: 1 }, { cell: 8, n: 4 }, { cell: 12, n: 2 }, { cell: 22, n: 5 }, { cell: 25, n: 5 }, { cell: 27, n: 5 },
  { cell: 37, n: 1 }, { cell: 39, n: 3 }, { cell: 41, n: 2 }, { cell: 43, n: 3 }, { cell: 47, n: 1 },
];
const EXAMPLE_COUNTS = [1, 2, 2, 0, 1, 2, 2, 2, 2, 1, 0, 1];

function IntroExample() {
  return (
    <div className="logic-glass-frame bridges-frame" style={{ width: 164, height: 164 }}>
      <BridgesBoard size={BRIDGES_SIZE} islands={EXAMPLE_ISLANDS} counts={EXAMPLE_COUNTS} small />
    </div>
  );
}

interface Drag {
  island: number;
  x: number;
  y: number;
  pair: number | null;
  /** True once the drag has gone far enough along the pair to count. */
  reached: boolean;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: BridgesPuzzleData | null = puzzle.type === "bridges" ? puzzle : null;
  const size = data?.size ?? BRIDGES_SIZE;
  const islands = useMemo(() => data?.islands ?? [], [data]);
  const pairs = useMemo(() => bridgePairs(islands, size), [islands, size]);
  const crosses = useMemo(() => crossingTable(pairs), [pairs]);
  const [counts, setCounts] = useStageState<number[]>(stateKey ?? "bridges", "bridgesCounts", () => []);
  const current = useMemo(() => decodeBridges(encodeBridges(counts), pairs.length), [counts, pairs.length]);
  const encoded = encodeBridges(current);
  const solved = data !== null && islands.length > 0 && bridgesSolvedCounts(islands, pairs, current);
  const solving = useSolveFx("bridges", solved);
  const submitted = useRef(false);
  const svg = useRef<SVGSVGElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  /** Boards before each change (a built or removed bridge, a reset), newest last; device memory only. */
  const [history, setHistory] = useState<number[][]>([]);
  const deg = islandDegrees(islands, pairs, current);
  const done = islands.filter((isl, i) => deg[i] === isl.n).length;
  const inFrame = useFrameProgress(done, islands.length, "islands");

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current || !solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked, solved]);

  const active = !locked && data !== null;

  /** Pointer position in board units. */
  const toBoard = (clientX: number, clientY: number): [number, number] | null => {
    const el = svg.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return [((clientX - rect.left) / rect.width) * size * CELL, ((clientY - rect.top) / rect.height) * size * CELL];
  };

  /** The island under (or nearest within a cell of) a point. */
  const islandAt = (x: number, y: number): number | null => {
    let best: number | null = null;
    let bestD = CELL * 0.62;
    islands.forEach((isl, i) => {
      const [cx, cy] = centre(size, isl.cell);
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const track = (x: number, y: number) => {
    const d = drag.current;
    if (!d) return;
    const dx = x - d.x;
    const dy = y - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * 0.3) {
      d.pair = null;
      d.reached = false;
      setPreview(null);
      return;
    }
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const forward = horizontal ? dx > 0 : dy > 0;
    const pair = pairs.findIndex((p) => p.horizontal === horizontal && (forward ? p.a === d.island : p.b === d.island));
    if (pair < 0) {
      d.pair = null;
      d.reached = false;
      setPreview(null);
      return;
    }
    const p = pairs[pair]!;
    const other = p.a === d.island ? p.b : p.a;
    const [ox, oy] = centre(size, islands[other]!.cell);
    const [sx, sy] = centre(size, islands[d.island]!.cell);
    const full = horizontal ? Math.abs(ox - sx) : Math.abs(oy - sy);
    const along = horizontal ? Math.abs(x - sx) : Math.abs(y - sy);
    d.pair = pair;
    d.reached = along >= full / 2;
    setPreview(pair);
  };

  const commit = () => {
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (!d || d.pair === null || !d.reached || submitted.current || !active) return;
    const i = d.pair;
    const next = ((current[i] ?? 0) + 1) % 3;
    if ((current[i] ?? 0) === 0 && crosses[i]!.some((j) => (current[j] ?? 0) > 0)) {
      puzzleReject(svg.current?.parentElement ?? null);
      return;
    }
    soundCue(next === 0 ? "bridges.remove" : "bridges.build");
    setHistory((h) => [...h, current]);
    setCounts(current.map((v, j) => (j === i ? next : v)));
  };

  const built = current.some((v) => v > 0);
  const canUndo = active && !submitted.current && history.length > 0;
  const canReset = active && !submitted.current && built;
  const undo = () => {
    if (!canUndo) return;
    drag.current = null;
    setPreview(null);
    setCounts(history[history.length - 1]!);
    setHistory((h) => h.slice(0, -1));
  };
  const reset = () => {
    if (!canReset) return;
    drag.current = null;
    setPreview(null);
    setHistory((h) => [...h, current]);
    setCounts(current.map(() => 0));
  };

  // Desktop keys: Z or Backspace = Undo, R = Reset.
  useGameKeys((kind, key, event) => {
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (key === "r") reset();
    else undo();
    return true;
  });

  const handlers: React.SVGProps<SVGSVGElement> = active
    ? {
        style: { touchAction: "none", overscrollBehavior: "none" },
        onPointerDown: (event) => {
          const at = toBoard(event.clientX, event.clientY);
          if (!at) return;
          const island = islandAt(at[0], at[1]);
          if (island === null) return;
          event.preventDefault();
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Capture is a nicety; moves still arrive without it.
          }
          const [cx, cy] = centre(size, islands[island]!.cell);
          drag.current = { island, x: cx, y: cy, pair: null, reached: false };
        },
        onPointerMove: (event) => {
          if (!drag.current) return;
          const at = toBoard(event.clientX, event.clientY);
          if (at) track(at[0], at[1]);
        },
        onPointerUp: (event) => {
          if (!drag.current) return;
          const at = toBoard(event.clientX, event.clientY);
          if (at) track(at[0], at[1]);
          commit();
        },
        onPointerCancel: () => {
          drag.current = null;
          setPreview(null);
        },
      }
    : {};

  if (!data) return null;
  const bridgesBuilt = current.reduce((a, b) => a + b, 0);

  return (
    <div data-logic-stage="bridges" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        {inFrame ? null : (
          <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
            islands done <span className="text-primary">{done}</span> / {islands.length}
          </p>
        )}
        <div className="logic-square logic-glass-frame bridges-frame">
          <BridgesBoard size={size} islands={islands} counts={current} preview={preview} boardRef={svg} handlers={handlers} />
        </div>
        <LiveSummary
          inArena
          className="logic-status"
          items={[
            <SummaryItem key="islands" label="Islands" value={`${done} / ${islands.length}`} />,
            <SummaryItem key="bridges" label="Bridges" value={String(bridgesBuilt)} />,
          ]}
        />
      </div>
      <div data-game-controls="actions" className="flex shrink-0 gap-3 px-3">
        <Button variant="outline"
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className="gf-glass h-11 flex-1 rounded-lg border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground disabled:opacity-40"
        >
          Undo
        </Button>
        <Button variant="outline"
          type="button"
          disabled={!canReset}
          onClick={reset}
          className="gf-glass h-11 flex-1 rounded-lg border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "bridges") return null;
  const pairs = bridgePairs(puzzle.islands, puzzle.size);
  const mine = decodeBridges(myAnswer ?? "", pairs.length);
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-pair">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
            <div className="logic-glass-frame bridges-frame bridges-reveal-board">
              <BridgesBoard size={puzzle.size} islands={puzzle.islands} counts={puzzle.solution ?? []} small />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
            <div className="logic-glass-frame bridges-frame bridges-reveal-board">
              <BridgesBoard size={puzzle.size} islands={puzzle.islands} counts={mine} small />
            </div>
          </div>
        </div>
      </div>
      {/* Solved: the verdict row above says it (4 Nov 2026: no repeated "Solved · 1.6s"). */}
      {myCorrect ? null : (
        <p className="logic-reveal-text text-center font-mono text-primary">
          {(solutionProgress(puzzle, myAnswer ?? "")?.text ?? `${mine.reduce((a, b) => a + b, 0)} bridges built`)}
        </p>
      )}
    </div>
  );
}

export const bridgesPuzzle: PuzzleDefinition = {
  key: "bridges",
  name: gameDisplayName("bridges"),
  category: "logic",
  timeLimitMs: BRIDGES_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "bridges", bridgesRev: 1, size: BRIDGES_SIZE, islands: [] }) satisfies BridgesPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "bridges") return false;
    const pairs = bridgePairs(puzzle.islands, puzzle.size);
    return bridgesSolvedCounts(puzzle.islands, pairs, decodeBridges(answer, pairs.length));
  },
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
