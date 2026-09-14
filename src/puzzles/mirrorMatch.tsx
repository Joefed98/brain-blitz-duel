import { useEffect, useState } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { pick, randInt, shuffled } from "@/lib/duel/random";
import {
  ROTATION_COLS as N,
  type MirrorAxis,
  type MirrorCandidateKind,
  type MirrorPuzzleData,
  type MirrorShape,
  type StroopColour,
} from "@/lib/duel/types";

import { SHAPE_BANK } from "./rotationMatch";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                   */
/* -------------------------------------------------------------------------- */

const PALETTE: StroopColour[] = ["RED", "BLUE", "GREEN", "PURPLE", "PINK"];

interface Pt {
  r: number;
  c: number;
  colour: StroopColour;
}

function toPts(shape: MirrorShape): Pt[] {
  return shape.cells.map((i, k) => ({
    r: Math.floor(i / N),
    c: i % N,
    colour: shape.colours[k]!,
  }));
}

/** Shift a coloured shape to the top-left so shapes compare by what is drawn. */
function normalise(pts: Pt[]): MirrorShape {
  const minR = Math.min(...pts.map((p) => p.r));
  const minC = Math.min(...pts.map((p) => p.c));
  const shifted = pts
    .map((p) => ({ ...p, r: p.r - minR, c: p.c - minC }))
    .sort((a, b) => a.r * N + a.c - (b.r * N + b.c));
  return {
    cells: shifted.map((p) => p.r * N + p.c),
    colours: shifted.map((p) => p.colour),
  };
}

/** Reflection across the dashed line: right edge, bottom edge, or main diagonal. */
function reflect(pts: Pt[], axis: MirrorAxis): Pt[] {
  if (axis === "vertical") return pts.map((p) => ({ ...p, c: -p.c }));
  if (axis === "horizontal") return pts.map((p) => ({ ...p, r: -p.r }));
  return pts.map((p) => ({ ...p, r: p.c, c: p.r }));
}

function rotate(pts: Pt[], quarters: number): Pt[] {
  let out = pts;
  for (let i = 0; i < quarters; i++) out = out.map((p) => ({ ...p, r: p.c, c: -p.r }));
  return out;
}

const shapeKey = (shape: MirrorShape) => `${shape.cells.join(",")}|${shape.colours.join(",")}`;

/** Side of the square box the shape (and its dashed line) is drawn in. */
function boxSize(shape: MirrorShape): number {
  const rows = shape.cells.map((i) => Math.floor(i / N));
  const cols = shape.cells.map((i) => i % N);
  return Math.max(Math.max(...rows) + 1, Math.max(...cols) + 1);
}

const AXES: MirrorAxis[] = ["vertical", "horizontal", "diagonal"];

/** 40% vertical, 30% horizontal, 30% diagonal. */
function pickAxis(): MirrorAxis {
  const roll = Math.random();
  if (roll < 0.4) return "vertical";
  return roll < 0.7 ? "horizontal" : "diagonal";
}

/* -------------------------------------------------------------------------- */
/*  Drawing                                                                    */
/* -------------------------------------------------------------------------- */

function ColourShape({
  shape,
  size = 84,
  axis,
  faded = false,
}: {
  shape: MirrorShape;
  size?: number;
  axis?: MirrorAxis;
  faded?: boolean;
}) {
  const m = boxSize(shape);
  const pad = axis ? 0.45 : 0.12;
  const span = m + pad * 2;

  let line: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (axis === "vertical") line = { x1: m + 0.2, y1: -0.1, x2: m + 0.2, y2: m + 0.1 };
  if (axis === "horizontal") line = { x1: -0.1, y1: m + 0.2, x2: m + 0.1, y2: m + 0.2 };
  if (axis === "diagonal") line = { x1: -0.15, y1: -0.15, x2: m + 0.15, y2: m + 0.15 };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-pad} ${-pad} ${span} ${span}`}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      {shape.cells.map((i, k) => (
        <rect
          key={i}
          x={(i % N) + 0.06}
          y={Math.floor(i / N) + 0.06}
          width={0.88}
          height={0.88}
          rx={0.14}
          fill={GLYPH_COLOURS[shape.colours[k]!]}
          opacity={faded ? 0.45 : 1}
        />
      ))}
      {line && (
        <line
          {...line}
          stroke="var(--primary)"
          strokeWidth={0.09}
          strokeLinecap="round"
          strokeDasharray="0.3 0.22"
        />
      )}
    </svg>
  );
}

const FLIP_TRANSFORM: Record<MirrorAxis, string> = {
  vertical: "scaleX(-1)",
  horizontal: "scaleY(-1)",
  diagonal: "rotate(90deg) scaleY(-1)",
};

const AXIS_LABEL: Record<MirrorAxis, string> = {
  vertical: "vertical",
  horizontal: "horizontal",
  diagonal: "diagonal",
};

const WRONG_LINE: Record<MirrorCandidateKind, string> = {
  correct: "",
  otherAxis: "That was the flip across the other axis",
  rotation: "That was a rotation, not a flip",
  swap: "Right shape — two colours were swapped",
};

/* -------------------------------------------------------------------------- */
/*  Generation                                                                 */
/* -------------------------------------------------------------------------- */

/** A random asymmetric colouring: two or three colours, all of them used. */
function randomColouring(cells: number[]): MirrorShape | null {
  const count = randInt(2, 3);
  const palette = shuffled(PALETTE).slice(0, count);
  const colours: StroopColour[] = cells.map(() => pick(palette));
  // Every chosen colour must actually appear, and never one colour only.
  const used = new Set(colours);
  if (used.size !== count) return null;

  const shape: MirrorShape = { cells, colours };
  const pts = toPts(shape);
  const key = shapeKey(normalise(pts));
  // Asymmetric: the colouring must survive neither a flip nor a turn unchanged.
  for (const axis of AXES) {
    if (shapeKey(normalise(reflect(pts, axis))) === key) return null;
  }
  for (const q of [1, 2, 3]) {
    if (shapeKey(normalise(rotate(pts, q))) === key) return null;
  }
  return shape;
}

/** Same shape as the correct reflection, with two differently-coloured cells swapped. */
function swapTwoColours(shape: MirrorShape): MirrorShape | null {
  const pairs: [number, number][] = [];
  for (let a = 0; a < shape.colours.length; a++) {
    for (let b = a + 1; b < shape.colours.length; b++) {
      if (shape.colours[a] !== shape.colours[b]) pairs.push([a, b]);
    }
  }
  if (pairs.length === 0) return null;
  const [a, b] = pick(pairs);
  const colours = [...shape.colours];
  colours[a] = shape.colours[b]!;
  colours[b] = shape.colours[a]!;
  return { cells: [...shape.cells], colours };
}

export function buildMirrorMatch(): MirrorPuzzleData {
  for (let attempt = 0; attempt < 400; attempt++) {
    const axis = pickAxis();
    const target = randomColouring(pick(SHAPE_BANK));
    if (!target) continue;
    const pts = toPts(target);

    const correct = normalise(reflect(pts, axis));
    const otherAxis = pick(AXES.filter((a) => a !== axis));
    const otherFlip = normalise(reflect(pts, otherAxis));
    const rotated = normalise(rotate(pts, pick([1, 2, 3])));
    const swapped = swapTwoColours(correct);
    if (!swapped) continue;

    const entries: { shape: MirrorShape; kind: MirrorCandidateKind }[] = [
      { shape: correct, kind: "correct" },
      { shape: otherFlip, kind: "otherAxis" },
      { shape: rotated, kind: "rotation" },
      { shape: swapped, kind: "swap" },
    ];

    // All four must look different, so exactly one is the true reflection.
    const keys = new Set(entries.map((e) => shapeKey(e.shape)));
    if (keys.size !== 4) continue;

    const options = shuffled(entries);
    return {
      type: "mirmatch",
      axis,
      target,
      candidates: options.map((o) => o.shape),
      correctIndex: options.findIndex((o) => o.kind === "correct"),
      kinds: options.map((o) => o.kind),
    };
  }

  // Fallback: a fixed, valid puzzle (never reached in practice).
  return buildFixed();
}

function buildFixed(): MirrorPuzzleData {
  const target: MirrorShape = {
    cells: [0, 5, 10, 11],
    colours: ["RED", "BLUE", "RED", "BLUE"],
  };
  const pts = toPts(target);
  const correct = normalise(reflect(pts, "vertical"));
  const entries: { shape: MirrorShape; kind: MirrorCandidateKind }[] = [
    { shape: correct, kind: "correct" },
    { shape: normalise(reflect(pts, "horizontal")), kind: "otherAxis" },
    { shape: normalise(rotate(pts, 1)), kind: "rotation" },
    { shape: swapTwoColours(correct)!, kind: "swap" },
  ];
  return {
    type: "mirmatch",
    axis: "vertical",
    target,
    candidates: entries.map((e) => e.shape),
    correctIndex: 0,
    kinds: entries.map((e) => e.kind),
  };
}

/* -------------------------------------------------------------------------- */
/*  Screens                                                                    */
/* -------------------------------------------------------------------------- */

/** Fixed intro example — the same L-shape, line and answer every time. */
const EXAMPLE = buildFixed();

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Flip the shape across the dashed line, colours and all. Tap the result.
      </p>
      <ColourShape shape={EXAMPLE.target} size={64} axis={EXAMPLE.axis} />
      <div className="grid grid-cols-2 gap-2">
        {EXAMPLE.candidates.map((shape, index) => (
          <div
            key={index}
            className={`flex h-[54px] w-[54px] items-center justify-center rounded-xl border ${
              index === EXAMPLE.correctIndex
                ? "border-primary bg-primary/10"
                : "border-border bg-card"
            }`}
          >
            <ColourShape shape={shape} size={40} />
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tap once to lock your answer. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "mirmatch") return null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Flip across the dashed line
        </span>
        <ColourShape shape={puzzle.target} size={104} axis={puzzle.axis} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {puzzle.candidates.map((shape, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Candidate ${index + 1}`}
            disabled={locked}
            onClick={() => !locked && onSubmit(String(index))}
            className="tap-target flex h-[88px] w-[88px] items-center justify-center rounded-xl border border-border bg-card disabled:opacity-50"
          >
            <ColourShape shape={shape} size={66} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  // The target flips across the dashed line over a second.
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), 400);
    return () => clearTimeout(id);
  }, []);

  if (puzzle.type !== "mirmatch") return null;
  const chosen = Number.parseInt(myAnswer ?? "", 10);
  const picked = Number.isFinite(chosen) ? chosen : -1;
  const pickedKind = puzzle.kinds?.[picked];

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="transition-transform duration-1000 ease-in-out"
        style={{ transform: flipped ? FLIP_TRANSFORM[puzzle.axis] : "none" }}
      >
        <ColourShape shape={puzzle.target} size={72} />
      </div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {AXIS_LABEL[puzzle.axis]} flip
      </p>
      <div className="grid grid-cols-2 gap-3">
        {puzzle.candidates.map((shape, index) => {
          const correct = index === puzzle.correctIndex;
          return (
            <div
              key={index}
              className={`flex h-[76px] w-[76px] flex-col items-center justify-center rounded-xl border ${
                correct ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <ColourShape shape={shape} size={50} faded={!correct} />
              {index === picked && (
                <span
                  className={`font-display text-xs font-bold ${
                    myCorrect ? "text-primary" : "text-warn"
                  }`}
                >
                  {myCorrect ? "✓" : "✗"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {picked < 0 ? (
        <p className="font-display text-xl font-bold text-warn">No answer</p>
      ) : (
        !myCorrect &&
        pickedKind && <p className="text-center text-sm text-warn">{WRONG_LINE[pickedKind]}</p>
      )}
    </div>
  );
}

export const mirrorMatchPuzzle: PuzzleDefinition = {
  key: "mirmatch",
  name: "Mirror Match",
  category: "pattern",
  generate: buildMirrorMatch,
  check: (answer, puzzle) => {
    if (puzzle.type !== "mirmatch") return false;
    return Number.parseInt(answer, 10) === puzzle.correctIndex;
  },
  IntroExample,
  Stage,
  Reveal,
};
