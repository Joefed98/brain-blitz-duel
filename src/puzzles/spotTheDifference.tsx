import { useEffect, useMemo, useRef, useState } from "react";

import { pick, randInt, shuffled } from "@/lib/duel/random";
import {
  SPOT_CELLS,
  SPOT_COLS,
  SPOT_DIFFERENCES,
  SPOT_MAX_SHAPES,
  SPOT_MIN_SHAPES,
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

const COLOURS: Record<StroopColour, string> = {
  RED: "#FF4D4D",
  BLUE: "#4D8CFF",
  GREEN: "#3DDC84",
  PURPLE: "#B26BFF",
  PINK: "#FF6BD6",
};

const COLOUR_KEYS = Object.keys(COLOURS) as StroopColour[];
/** The two pairs that read as the same colour at a glance — never swapped. */
const TOO_CLOSE: [StroopColour, StroopColour][] = [
  ["RED", "PINK"],
  ["BLUE", "PURPLE"],
];

const KINDS: SpotShapeKind[] = ["circle", "square", "triangle", "star", "hexagon", "arrow"];
/** Shapes whose turn or mirror is unmistakable. */
const TURNABLE: SpotShapeKind[] = ["triangle", "arrow"];
/** A shape's kind can only change into its listed partner. */
const KIND_SWAP: Partial<Record<SpotShapeKind, SpotShapeKind>> = {
  circle: "hexagon",
  square: "star",
};

/* -------------------------------------------------------------------------- */
/*  Drawing — both panels use this same code, so nothing but the stored        */
/*  differences can tell them apart.                                          */
/* -------------------------------------------------------------------------- */

const CELL_W = 48;
const CELL_H = 48;
const PANEL_W = SPOT_COLS * CELL_W;
const PANEL_H = SPOT_ROWS * CELL_H;
const SHAPE = 34;

function cellCentre(cell: number): { x: number; y: number } {
  const col = cell % SPOT_COLS;
  const row = Math.floor(cell / SPOT_COLS);
  return { x: col * CELL_W + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}

function neighbours(cell: number): number[] {
  const col = cell % SPOT_COLS;
  const row = Math.floor(cell / SPOT_COLS);
  const out: number[] = [];
  for (const [dc, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const c = col + dc;
    const r = row + dr;
    if (c >= 0 && c < SPOT_COLS && r >= 0 && r < SPOT_ROWS) out.push(r * SPOT_COLS + c);
  }
  return out;
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

function DrawnShape({ shape }: { shape: SpotShape }) {
  const { x, y } = cellCentre(shape.cell);
  const scale = SHAPE / 40;
  const turns = [
    `translate(${x} ${y})`,
    shape.rot ? `rotate(${shape.rot})` : "",
    shape.flip ? "scale(-1 1)" : "",
    `scale(${scale})`,
    "translate(-20 -20)",
  ]
    .filter(Boolean)
    .join(" ");
  return <g transform={turns}>{shapePath(shape.kind, COLOURS[shape.colour])}</g>;
}

function Panel({
  shapes,
  found = [],
  wrongCell,
  onTap,
  height,
  rows = SPOT_ROWS,
}: {
  shapes: SpotShape[];
  /** Cells ringed in gold. */
  found?: number[];
  wrongCell?: number | null;
  onTap?: (cell: number) => void;
  height?: number;
  /** Crop the panel to the first rows — used by the small intro example. */
  rows?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${PANEL_W} ${rows * CELL_H}`}
      width="100%"
      {...(height ? { height } : {})}
      className="block w-full select-none"
      style={{ touchAction: "manipulation" }}
    >
      {shapes.map((shape) => (
        <DrawnShape key={`${shape.cell}-${shape.kind}`} shape={shape} />
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

/** Groups of cells, one group per difference between the panels. */
export function differenceGroups(top: SpotShape[], bottom: SpotShape[]): number[][] {
  const byTop = new Map(top.map((s) => [s.cell, s]));
  const byBottom = new Map(bottom.map((s) => [s.cell, s]));
  const groups: number[][] = [];
  const usedBottom = new Set<number>();

  for (const shape of top) {
    const other = byBottom.get(shape.cell);
    if (other) {
      if (!sameShape(shape, other)) groups.push([shape.cell]);
      continue;
    }
    // Gone from this cell: either moved next door, or removed altogether.
    const moved = neighbours(shape.cell).find((cell) => {
      if (usedBottom.has(cell) || byTop.has(cell)) return false;
      const candidate = byBottom.get(cell);
      return candidate ? sameShape(shape, candidate) : false;
    });
    if (moved !== undefined) {
      usedBottom.add(moved);
      groups.push([shape.cell, moved]);
    } else {
      groups.push([shape.cell]);
    }
  }
  return groups;
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                     */
/* -------------------------------------------------------------------------- */

const EXAMPLE_TOP: SpotShape[] = [
  { cell: 1, kind: "square", colour: "GREEN" },
  { cell: 4, kind: "circle", colour: "RED" },
  { cell: 10, kind: "triangle", colour: "BLUE" },
  { cell: 13, kind: "star", colour: "PURPLE" },
];
const EXAMPLE_BOTTOM: SpotShape[] = [
  { cell: 1, kind: "square", colour: "GREEN" },
  { cell: 4, kind: "circle", colour: "BLUE" },
  { cell: 10, kind: "triangle", colour: "BLUE" },
  { cell: 13, kind: "star", colour: "PURPLE" },
];

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Find the three differences between the top and bottom pictures.
      </p>
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
        <Panel shapes={EXAMPLE_TOP} found={[4]} rows={2} />
        <div className="h-[2px] w-full bg-primary" />
        <Panel shapes={EXAMPLE_BOTTOM} found={[4]} rows={2} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tap each difference in either picture. You have 45 seconds.
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

  // All three found locks the round in; otherwise the taps so far go up just
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
      setTaps((prev) => (prev.includes(cell) ? prev : [...prev, cell]));
    } else {
      setTaps((prev) => (prev.includes(cell) ? prev : [...prev, cell]));
      setWrong(cell);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="font-mono text-sm uppercase tracking-widest text-primary">
        {foundGroups.length} / {total} found
      </p>
      <div
        className={`w-full overflow-hidden rounded-2xl border border-border bg-card ${
          wrong !== null ? "animate-shake" : ""
        }`}
      >
        <Panel
          shapes={puzzle.top}
          found={foundCells}
          wrongCell={wrong}
          onTap={tap}
        />
        <div className="h-[2px] w-full bg-primary" />
        <Panel
          shapes={puzzle.bottom}
          found={foundCells}
          wrongCell={wrong}
          onTap={tap}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tap each difference in either picture.
      </p>
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
    <>
      <div className="w-full overflow-hidden rounded-2xl border border-border bg-card">
        <Panel shapes={puzzle.top} found={cells} />
        <div className="h-[2px] w-full bg-primary" />
        <Panel shapes={puzzle.bottom} found={cells} />
      </div>
      <div className="flex w-full flex-col gap-1">
        {differences.map((difference, index) => {
          const got = found.includes(difference);
          return (
            <div key={index} className="flex items-center justify-between text-sm">
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
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Generation (server-side)                                                  */
/* -------------------------------------------------------------------------- */

function otherColour(colour: StroopColour): StroopColour {
  const banned = TOO_CLOSE.flatMap(([a, b]) =>
    colour === a ? [b] : colour === b ? [a] : [],
  );
  const options = COLOUR_KEYS.filter((c) => c !== colour && !banned.includes(c));
  return pick(options);
}

function scatter(count: number): SpotShape[] {
  const cells = shuffled(Array.from({ length: SPOT_CELLS }, (_, i) => i)).slice(0, count);
  return cells.map((cell) => {
    const kind = pick(KINDS);
    const shape: SpotShape = { cell, kind, colour: pick(COLOUR_KEYS) };
    if (TURNABLE.includes(kind) && Math.random() < 0.4) shape.rot = 90;
    return shape;
  });
}

function applyDifference(
  kind: SpotDifferenceKind,
  shape: SpotShape,
  occupied: Set<number>,
  usedCells: number[],
): { bottom: SpotShape | null; difference: SpotDifference } | null {
  switch (kind) {
    case "colour": {
      const colour = otherColour(shape.colour);
      return {
        bottom: { ...shape, colour },
        difference: {
          kind,
          cells: [shape.cell],
          label: `A shape changed colour`,
        },
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
        difference: {
          kind,
          cells: [shape.cell],
          label: `A ${shape.kind} was turned round`,
        },
      };
    }
    case "move": {
      const free = neighbours(shape.cell).filter(
        (cell) =>
          !occupied.has(cell) &&
          // The square it moves into must also stay clear of the other two.
          usedCells.every((used) => cellsApart(used, cell) >= 2),
      );
      if (free.length === 0) return null;
      const cell = pick(free);
      occupied.add(cell);
      return {
        bottom: { ...shape, cell },
        difference: {
          kind,
          cells: [shape.cell, cell],
          label: `A shape moved one square`,
        },
      };
    }
    case "remove": {
      return {
        bottom: null,
        difference: { kind, cells: [shape.cell], label: `A shape is missing` },
      };
    }
    default: {
      const swap = KIND_SWAP[shape.kind];
      if (!swap) return null;
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
  const ALL: SpotDifferenceKind[] = ["colour", "turn", "move", "remove", "kind"];

  for (let attempt = 0; attempt < 400; attempt++) {
    const top = scatter(randInt(SPOT_MIN_SHAPES, SPOT_MAX_SHAPES));
    const occupied = new Set(top.map((s) => s.cell));
    // One of each kind where the scene allows it, never two of the same.
    const wanted = shuffled(ALL).slice(0, SPOT_DIFFERENCES);
    const candidates = shuffled(top);

    const bottom = new Map(top.map((s) => [s.cell, { ...s }]));
    const differences: SpotDifference[] = [];
    const usedCells: number[] = [];

    for (const kind of wanted) {
      const shape = candidates.find(
        (s) =>
          !usedCells.includes(s.cell) &&
          // Keep the differences spread out so they never cluster.
          usedCells.every((cell) => cellsApart(cell, s.cell) >= 2),
      );
      if (!shape) break;
      const applied = applyDifference(kind, shape, occupied, usedCells);
      if (!applied) continue;
      bottom.delete(shape.cell);
      if (applied.bottom) bottom.set(applied.bottom.cell, applied.bottom);
      differences.push(applied.difference);
      usedCells.push(...applied.difference.cells);
    }

    if (differences.length !== SPOT_DIFFERENCES) continue;

    const bottomShapes = [...bottom.values()].sort((a, b) => a.cell - b.cell);
    // The panels must differ in exactly the three stored ways.
    const groups = differenceGroups(top, bottomShapes);
    if (groups.length !== SPOT_DIFFERENCES) continue;

    return {
      type: "spotdiff",
      top: [...top].sort((a, b) => a.cell - b.cell),
      bottom: bottomShapes,
      differences,
    };
  }

  // Fallback: one plain colour change on a tiny scene (only if generation fails).
  const top = scatter(SPOT_MIN_SHAPES);
  const first = top[0]!;
  const second = top[4]!;
  const third = top[8]!;
  const bottom = top
    .filter((s) => s.cell !== third.cell)
    .map((s) =>
      s.cell === first.cell
        ? { ...s, colour: otherColour(s.colour) }
        : s.cell === second.cell
          ? { ...s, kind: (KIND_SWAP[s.kind] ?? "hexagon") as SpotShapeKind }
          : s,
    );
  return {
    type: "spotdiff",
    top,
    bottom,
    differences: [
      { kind: "colour", cells: [first.cell], label: "A shape changed colour" },
      { kind: "kind", cells: [second.cell], label: "A shape changed shape" },
      { kind: "remove", cells: [third.cell], label: "A shape is missing" },
    ],
  };
}

export const spotDifferencePuzzle: PuzzleDefinition = {
  key: "spotdiff",
  name: "Spot the Difference",
  category: "attention",
  timeLimitMs: SPOT_TIME_MS,
  generate: buildSpotDifference,
  // Scored from how many of the three stored differences were tapped.
  check: () => true,
  revealHeading: "The three differences",
  IntroExample,
  Stage,
  Reveal,
};
