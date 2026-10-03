import { playCorrect, playWrong } from "@/lib/sound";
import { useEffect, useMemo, useRef, useState } from "react";

import { pick, shuffled } from "@/lib/duel/random";
import {
  SPOT_CELLS,
  SPOT_COLS,
  SPOT_DIFFERENCES,
  SPOT_ROWS,
  SPOT_TIME_MS,
  type SpotDifference,
  type SpotDifferenceKind,
  type SpotPuzzleData,
  type SpotShape,
  type SpotShapeKind,
  type StroopColour,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const COLOURS: Record<Exclude<StroopColour, "YELLOW">, string> = {
  RED: "#FF4D4D",
  BLUE: "#4D8CFF",
  GREEN: "#3DDC84",
  PURPLE: "#B26BFF",
  PINK: "#FF6BD6",
  ORANGE: "#FF8A3D",
  BROWN: "#8B5A2B",
};

const COLOUR_KEYS = Object.keys(COLOURS) as Exclude<StroopColour, "YELLOW">[];
/** The two pairs that read as the same colour at a glance — never swapped. */
const TOO_CLOSE: [StroopColour, StroopColour][] = [
  ["RED", "PINK"],
  ["BLUE", "PURPLE"],
  ["RED", "ORANGE"],
  ["ORANGE", "BROWN"],
];

const KINDS: SpotShapeKind[] = ["circle", "square", "triangle", "star", "hexagon", "arrow"];
/** Shapes whose turn or mirror is unmistakable. */
const TURNABLE: SpotShapeKind[] = ["triangle", "arrow"];
/** A shape's kind can only change into its listed partner. */
const KIND_SWAP: Record<SpotShapeKind, SpotShapeKind> = {
  circle: "hexagon",
  hexagon: "circle",
  square: "star",
  star: "square",
  triangle: "arrow",
  arrow: "triangle",
};

/* -------------------------------------------------------------------------- */
/*  Drawing — both panels use this same code, so nothing but the stored        */
/*  differences can tell them apart.                                          */
/* -------------------------------------------------------------------------- */

const CELL_W = 48;
const CELL_H = 48;
const PANEL_W = SPOT_COLS * CELL_W;
const PANEL_H = SPOT_ROWS * CELL_H;
const SHAPE = 36;

function cellCentre(cell: number): { x: number; y: number } {
  const col = cell % SPOT_COLS;
  const row = Math.floor(cell / SPOT_COLS);
  return { x: col * CELL_W + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}

/** Chebyshev distance in cells — used to keep the differences apart. */
function cellsApart(a: number, b: number): number {
  const ac = a % SPOT_COLS;
  const ar = Math.floor(a / SPOT_COLS);
  const bc = b % SPOT_COLS;
  const br = Math.floor(b / SPOT_COLS);
  return Math.max(Math.abs(ac - bc), Math.abs(ar - br));
}

function shapePath(kind: SpotShapeKind, fill: string) {
  switch (kind) {
    case "circle":
      return <circle cx="20" cy="20" r="13" fill={fill} />;
    case "square":
      return <rect x="7" y="7" width="26" height="26" rx="2" fill={fill} />;
    case "triangle":
      return <polygon points="20,5 35,33 5,33" fill={fill} />;
    case "star":
      return (
        <polygon points="20,3 24,14 36,14 26,22 30,35 20,27 10,35 14,22 4,14 16,14" fill={fill} />
      );
    case "hexagon":
      return <polygon points="12,5 28,5 36,20 28,35 12,35 4,20" fill={fill} />;
    default:
      return <path d="M4 14h18V7l14 13-14 13v-7H4z" fill={fill} />;
  }
}

function DrawnShape({ shape, size = SHAPE }: { shape: SpotShape; size?: number }) {
  const { x, y } = cellCentre(shape.cell);
  const scale = size / 40;
  const turns = [
    `translate(${x} ${y})`,
    shape.rot ? `rotate(${shape.rot})` : "",
    shape.flip ? "scale(-1 1)" : "",
    `scale(${scale})`,
    "translate(-20 -20)",
  ]
    .filter(Boolean)
    .join(" ");
  const colour = COLOURS[shape.colour as keyof typeof COLOURS];
  if (!colour) return null;
  return <g transform={turns}>{shapePath(shape.kind, colour)}</g>;
}

function Panel({
  shapes,
  found = [],
  wrongCell,
  onTap,
  height,
  rows = SPOT_ROWS,
  fitHeight = false,
  shapeSize = SHAPE,
}: {
  shapes: SpotShape[];
  /** Cells ringed in gold. */
  found?: number[];
  wrongCell?: number | null;
  onTap?: (cell: number) => void;
  height?: number;
  /** Crop the panel to the first rows — used by the small intro example. */
  rows?: number;
  /** Fit inside an equal-height play area instead of sizing from the full width. */
  fitHeight?: boolean;
  shapeSize?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${PANEL_W} ${rows * CELL_H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      {...(height ? { height } : {})}
      className={`block select-none ${fitHeight ? "h-full min-h-0 w-full" : "w-full"}`}
      style={{ touchAction: "manipulation" }}
    >
      {shapes.map((shape) => (
        <DrawnShape key={`${shape.cell}-${shape.kind}`} shape={shape} size={shapeSize} />
      ))}
      {found.map((cell) => {
        const { x, y } = cellCentre(cell);
        return (
          <ellipse
            key={`f${cell}`}
            cx={x}
            cy={y}
            rx={CELL_W / 2 - 2}
            ry={CELL_H / 2 - 2}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
          />
        );
      })}
      {wrongCell !== null && wrongCell !== undefined
        ? (() => {
            const { x, y } = cellCentre(wrongCell);
            return (
              <ellipse
                cx={x}
                cy={y}
                rx={CELL_W / 2 - 2}
                ry={CELL_H / 2 - 2}
                fill="none"
                stroke="var(--warn)"
                strokeWidth="2.5"
              />
            );
          })()
        : null}
      {onTap
        ? Array.from({ length: SPOT_CELLS }, (_, cell) => {
            const { x, y } = cellCentre(cell);
            return (
              <rect
                key={`t${cell}`}
                x={x - CELL_W / 2}
                y={y - CELL_H / 2}
                width={CELL_W}
                height={CELL_H}
                fill="transparent"
                role="button"
                aria-label={`Cell ${cell + 1}`}
                onClick={() => onTap(cell)}
              />
            );
          })
        : null}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Finding the differences from the two scenes (for instant feedback only —   */
/*  the score always comes from the server's stored answers).                  */
/* -------------------------------------------------------------------------- */

function sameShape(a: SpotShape, b: SpotShape): boolean {
  return (
    a.kind === b.kind &&
    a.colour === b.colour &&
    (a.rot ?? 0) === (b.rot ?? 0) &&
    (a.flip ?? false) === (b.flip ?? false)
  );
}

/** Groups of cells, one group per difference between the panels. Both panels
 *  are full grids, so every difference is a single changed cell. */
export function differenceGroups(top: SpotShape[], bottom: SpotShape[]): number[][] {
  const byBottom = new Map(bottom.map((s) => [s.cell, s]));
  const groups: number[][] = [];
  for (const shape of top) {
    const other = byBottom.get(shape.cell);
    if (!other || !sameShape(shape, other)) groups.push([shape.cell]);
  }
  return groups;
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                     */
/* -------------------------------------------------------------------------- */

const EXAMPLE_KINDS: SpotShapeKind[] = [
  "circle",
  "square",
  "triangle",
  "star",
  "hexagon",
  "arrow",
  "circle",
  "square",
  "triangle",
  "star",
  "hexagon",
  "arrow",
  "square",
  "circle",
  "arrow",
  "triangle",
];
const EXAMPLE_COLOURS: Exclude<StroopColour, "YELLOW">[] = [
  "RED",
  "BLUE",
  "GREEN",
  "PURPLE",
  "ORANGE",
  "BROWN",
  "PINK",
  "GREEN",
  "BLUE",
  "RED",
  "PURPLE",
  "GREEN",
  "ORANGE",
  "BLUE",
  "PINK",
  "BROWN",
];
const EXAMPLE_TOP: SpotShape[] = EXAMPLE_KINDS.map((kind, cell) => ({
  cell,
  kind,
  colour: EXAMPLE_COLOURS[cell]!,
}));
const EXAMPLE_BOTTOM: SpotShape[] = EXAMPLE_TOP.map((shape) =>
  shape.cell === 4 ? { ...shape, colour: "GREEN" } : shape,
);

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Find the six differences between the top and bottom pictures.
      </p>
      <div className="flex w-full flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card">
        <Panel shapes={EXAMPLE_TOP} found={[4]} rows={2} />
        <div className="h-px w-full shrink-0 bg-border" aria-hidden="true" />
        <Panel shapes={EXAMPLE_BOTTOM} found={[4]} rows={2} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tap each difference in either picture. You have 30 seconds.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Play                                                                      */
/* -------------------------------------------------------------------------- */

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const top = puzzle.type === "spotdiff" ? puzzle.top : [];
  const bottom = puzzle.type === "spotdiff" ? puzzle.bottom : [];
  const key = top.map((s) => `${s.cell}${s.kind}${s.colour}`).join("|");
  const groups = useMemo(() => differenceGroups(top, bottom), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [taps, setTaps] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number | null>(null);
  const submitted = useRef("");

  useEffect(() => {
    setTaps([]);
    setWrong(null);
    submitted.current = "";
  }, [key]);

  const foundGroups = groups.filter((g) => g.some((cell) => taps.includes(cell)));
  const foundCells = foundGroups.flat();
  const total = Math.min(SPOT_DIFFERENCES, groups.length) || SPOT_DIFFERENCES;

  // All six found lock the round in; otherwise the taps so far go up just
  // before the clock runs out. The server re-checks every tap either way.
  useEffect(() => {
    if (groups.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + SPOT_TIME_MS - 400;
    if (foundGroups.length < total && !timeUp) return;
    submitted.current = key;
    onSubmit(taps.join(","));
  }, [foundGroups.length, total, locked, now, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (wrong === null) return;
    const timer = setTimeout(() => setWrong(null), 340);
    return () => clearTimeout(timer);
  }, [wrong]);

  if (puzzle.type !== "spotdiff") return null;

  const tap = (cell: number) => {
    if (locked) return;
    if (foundCells.includes(cell)) return;
    const hit = groups.some((g) => g.includes(cell));
    if (hit) {
      playCorrect();
      setTaps((prev) => (prev.includes(cell) ? prev : [...prev, cell]));
    } else {
      playWrong();
      setTaps((prev) => (prev.includes(cell) ? prev : [...prev, cell]));
      setWrong(cell);
    }
  };

  return (
    <div className="spot-difference-stage flex min-h-0 flex-1 flex-col items-center gap-2">
      <p className="shrink-0 font-mono text-sm uppercase tracking-widest text-primary">
        {foundGroups.length} / {total} found
      </p>
      <div
        className={`flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card ${
          wrong !== null ? "animate-shake" : ""
        }`}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <Panel
            shapes={puzzle.top}
            found={foundCells}
            wrongCell={wrong}
            onTap={tap}
            fitHeight
            shapeSize={SHAPE}
          />
        </div>
        <div className="h-px w-full shrink-0 bg-border" aria-hidden="true" />
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <Panel
            shapes={puzzle.bottom}
            found={foundCells}
            wrongCell={wrong}
            onTap={tap}
            fitHeight
            shapeSize={SHAPE}
          />
        </div>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "spotdiff") return null;
  const differences = puzzle.differences ?? [];
  const cells = differences.flatMap((d) => d.cells);
  const taps = (myAnswer ?? "")
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
  const found = differences.filter((d) => d.cells.some((cell) => taps.includes(cell)));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <Panel shapes={puzzle.top} found={cells} fitHeight />
        </div>
        <div className="h-px w-full shrink-0 bg-border" aria-hidden="true" />
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <Panel shapes={puzzle.bottom} found={cells} fitHeight />
        </div>
      </div>
      <div className="flex w-full flex-col gap-1">
        {differences.map((difference, index) => {
          const got = found.includes(difference);
          return (
            <div key={index} className="flex items-center justify-between text-base">
              <span className="text-muted-foreground">{difference.label}</span>
              <span className={`font-display font-bold ${got ? "text-primary" : "text-warn"}`}>
                {got ? "✓" : "✗"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-2xl font-bold tabular-nums text-primary">
        {found.length} / {SPOT_DIFFERENCES} found
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Generation (server-side)                                                  */
/* -------------------------------------------------------------------------- */

function otherColour(colour: StroopColour): StroopColour {
  const banned = TOO_CLOSE.flatMap(([a, b]) => (colour === a ? [b] : colour === b ? [a] : []));
  const options = COLOUR_KEYS.filter((c) => c !== colour && !banned.includes(c));
  return pick(options);
}

/** Fills every cell of the grid — both panels are complete pictures. */
function fillGrid(): SpotShape[] {
  return Array.from({ length: SPOT_CELLS }, (_, cell) => {
    const kind = pick(KINDS);
    const shape: SpotShape = { cell, kind, colour: pick(COLOUR_KEYS) };
    if (TURNABLE.includes(kind) && Math.random() < 0.4) shape.rot = 90;
    return shape;
  });
}

function applyDifference(
  kind: SpotDifferenceKind,
  shape: SpotShape,
): { bottom: SpotShape; difference: SpotDifference } | null {
  switch (kind) {
    case "colour": {
      const colour = otherColour(shape.colour);
      return {
        bottom: { ...shape, colour },
        difference: { kind, cells: [shape.cell], label: `A shape changed colour` },
      };
    }
    case "turn": {
      if (!TURNABLE.includes(shape.kind)) return null;
      const bottom: SpotShape = shape.rot
        ? { ...shape, rot: 0 }
        : Math.random() < 0.5
          ? { ...shape, rot: 90 }
          : { ...shape, flip: !shape.flip };
      return {
        bottom,
        difference: { kind, cells: [shape.cell], label: `A ${shape.kind} was turned round` },
      };
    }
    default: {
      const swap = KIND_SWAP[shape.kind];
      return {
        bottom: { ...shape, kind: swap },
        difference: {
          kind: "kind",
          cells: [shape.cell],
          label: `A ${shape.kind} became a ${swap}`,
        },
      };
    }
  }
}

export function buildSpotDifference(): SpotPuzzleData {
  // Only changes that work on a full grid: a colour, a shape, or a turn.
  const ALL: SpotDifferenceKind[] = ["colour", "kind", "turn"];

  for (let attempt = 0; attempt < 400; attempt++) {
    const top = fillGrid();
    const candidates = shuffled(top);

    const bottom = new Map(top.map((s) => [s.cell, { ...s }]));
    const differences: SpotDifference[] = [];
    const usedCells: number[] = [];

    for (const shape of candidates) {
      if (differences.length === SPOT_DIFFERENCES) break;
      // Differences never sit next to each other.
      if (usedCells.some((cell) => cellsApart(cell, shape.cell) < 2)) continue;
      const applied = applyDifference(pick(shuffled(ALL)), shape);
      if (!applied) continue;
      bottom.set(applied.bottom.cell, applied.bottom);
      differences.push(applied.difference);
      usedCells.push(shape.cell);
    }

    if (differences.length !== SPOT_DIFFERENCES) continue;

    const bottomShapes = [...bottom.values()].sort((a, b) => a.cell - b.cell);
    // The panels must differ in exactly the six stored ways.
    if (differenceGroups(top, bottomShapes).length !== SPOT_DIFFERENCES) continue;

    return {
      type: "spotdiff",
      top: [...top].sort((a, b) => a.cell - b.cell),
      bottom: bottomShapes,
      differences,
    };
  }

  // Fallback: six separated colour changes on a full grid.
  const top = fillGrid();
  const FALLBACK_CELLS = [0, 3, 6, 25, 28, 47];
  const chosen = top.filter((shape) => FALLBACK_CELLS.includes(shape.cell)).slice(0, SPOT_DIFFERENCES);
  const bottom = top.map((shape) =>
    chosen.some((candidate) => candidate.cell === shape.cell)
      ? { ...shape, colour: otherColour(shape.colour) }
      : shape,
  );
  return {
    type: "spotdiff",
    top,
    bottom,
    differences: chosen.map((shape) => ({
      kind: "colour" as const,
      cells: [shape.cell],
      label: "A shape changed colour",
    })),
  };
}

export const spotDifferencePuzzle: PuzzleDefinition = {
  key: "spotdiff",
  name: "Spot the Difference",
  category: "attention",
  timeLimitMs: SPOT_TIME_MS,
  generate: buildSpotDifference,
  // Scored from how many of the six stored differences were tapped.
  check: () => true,
  revealHeading: "The six differences",
  IntroExample,
  Stage,
  Reveal,
};
