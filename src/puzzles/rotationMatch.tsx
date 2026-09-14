import { useEffect, useState } from "react";

import { pick, shuffled } from "@/lib/duel/random";
import { ROTATION_COLS as N, type RotationPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

type Cells = number[];
type Coord = [number, number];

export function toCoords(cells: Cells): Coord[] {
  return cells.map((i) => [Math.floor(i / N), i % N]);
}

/** Shift a shape's bounding box to the top-left so shapes compare by form only. */
export function normalise(coords: Coord[]): Cells {
  const minR = Math.min(...coords.map((c) => c[0]));
  const minC = Math.min(...coords.map((c) => c[1]));
  return coords.map(([r, c]) => (r - minR) * N + (c - minC)).sort((a, b) => a - b);
}

function rotate90(cells: Cells): Cells {
  return normalise(toCoords(cells).map(([r, c]) => [c, N - 1 - r] as Coord));
}

export function mirror(cells: Cells): Cells {
  return normalise(toCoords(cells).map(([r, c]) => [r, N - 1 - c] as Coord));
}

export function rotations(cells: Cells): Cells[] {
  const out: Cells[] = [normalise(toCoords(cells))];
  for (let i = 0; i < 3; i++) out.push(rotate90(out[out.length - 1]!));
  return out;
}

export const shapeKey = (cells: Cells) => cells.join(",");

/** Chiral: no rotation of the shape equals its own mirror image. */
export function isChiral(cells: Cells): boolean {
  const mirrored = shapeKey(mirror(cells));
  return !rotations(cells).some((r) => shapeKey(r) === mirrored);
}

/** Four genuinely different rotations, so distractors are never duplicates. */
export function hasFourRotations(cells: Cells): boolean {
  return new Set(rotations(cells).map(shapeKey)).size === 4;
}

/**
 * Source shapes, written as filled cells of a 5x5 grid: eight six-cell shapes
 * and eight seven-cell shapes. Every one is chiral and has four distinct
 * rotations — see the checks below.
 */
const SOURCE: Cells[] = [
  [0, 1, 2, 3, 5, 6],
  [0, 1, 5, 6, 11, 12],
  [0, 1, 2, 5, 7, 10],
  [0, 1, 2, 3, 5, 10],
  [0, 5, 6, 7, 10, 15],
  [0, 5, 10, 11, 16, 17],
  [0, 5, 6, 7, 8, 11],
  [0, 5, 6, 11, 12, 16],
  [0, 1, 2, 3, 5, 6, 7],
  [0, 1, 2, 5, 6, 11, 12],
  [0, 1, 2, 3, 5, 7, 12],
  [0, 1, 2, 3, 5, 8, 10],
  [0, 5, 6, 7, 10, 12, 15],
  [0, 5, 7, 10, 11, 12, 16],
  [0, 2, 3, 5, 6, 7, 11],
  [0, 5, 6, 7, 11, 15, 16],
];

/** Only chiral shapes with four distinct rotations make fair puzzles. */
export const SHAPE_BANK: Cells[] = (() => {
  const seen = new Set<string>();
  const bank: Cells[] = [];
  for (const shape of SOURCE) {
    for (const variant of [shape, mirror(shape)]) {
      if (!isChiral(variant) || !hasFourRotations(variant)) continue;
      const k = shapeKey(normalise(toCoords(variant)));
      if (seen.has(k)) continue;
      seen.add(k);
      bank.push(normalise(toCoords(variant)));
    }
  }
  return bank;
})();

export function ShapeSvg({
  cells,
  size = 84,
  tone = "grey",
  rotateDeg = 0,
  animate = false,
}: {
  cells: Cells;
  size?: number;
  tone?: "gold" | "grey";
  rotateDeg?: number;
  animate?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${N} ${N}`}
      aria-hidden="true"
      className={animate ? "transition-transform duration-1000 ease-in-out" : undefined}
      style={{ transform: `rotate(${rotateDeg}deg)`, width: size, height: size }}
    >
      {Array.from({ length: N * N }, (_, i) => {
        if (!cells.includes(i)) return null;
        const r = Math.floor(i / N);
        const c = i % N;
        return (
          <rect
            key={i}
            x={c + 0.06}
            y={r + 0.06}
            width={0.88}
            height={0.88}
            rx={0.14}
            fill={tone === "gold" ? "var(--primary)" : "var(--muted-foreground)"}
            opacity={tone === "gold" ? 1 : 0.75}
          />
        );
      })}
    </svg>
  );
}

/** Fixed intro example — a six-cell shape, with the true rotation highlighted. */
const EXAMPLE_TARGET: Cells = [0, 1, 2, 3, 5, 6];
const EXAMPLE_CANDIDATES: Cells[] = [
  rotate90(EXAMPLE_TARGET),
  mirror(EXAMPLE_TARGET),
  rotate90(mirror(EXAMPLE_TARGET)),
  rotate90(rotate90(mirror(EXAMPLE_TARGET))),
];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        One of these is the target turned round. The others are flipped. Find the real one.
      </p>
      <ShapeSvg cells={EXAMPLE_TARGET} size={56} tone="gold" />
      <div className="grid grid-cols-2 gap-2">
        {EXAMPLE_CANDIDATES.map((cells, index) => (
          <div
            key={index}
            className={`flex h-[54px] w-[54px] items-center justify-center rounded-xl border ${
              index === 0 ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <ShapeSvg cells={cells} size={40} tone={index === 0 ? "gold" : "grey"} />
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
  if (puzzle.type !== "rotmatch") return null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Target</span>
        <ShapeSvg cells={puzzle.target} size={88} tone="gold" />
      </div>

      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Which one is it, turned?
      </p>

      <div className="grid grid-cols-2 gap-3">
        {puzzle.candidates.map((cells, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Candidate ${index + 1}`}
            disabled={locked}
            onClick={() => !locked && onSubmit(String(index))}
            className="tap-target flex h-[92px] w-[92px] items-center justify-center rounded-xl border border-border bg-card disabled:opacity-50"
          >
            <ShapeSvg cells={cells} size={70} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  const rotationDeg = puzzle.type === "rotmatch" ? puzzle.rotationDeg : 0;

  // When wrong, the correct candidate turns back into the target over a second.
  const [hintDeg, setHintDeg] = useState(0);
  useEffect(() => {
    if (myCorrect) return;
    const id = setTimeout(() => setHintDeg(-rotationDeg), 400);
    return () => clearTimeout(id);
  }, [myCorrect, rotationDeg]);

  if (puzzle.type !== "rotmatch") return null;
  const chosen = Number.parseInt(myAnswer ?? "", 10);
  const picked = Number.isFinite(chosen) ? chosen : -1;

  return (
    <>
      <ShapeSvg cells={puzzle.target} size={72} tone="gold" />
      <div className="grid grid-cols-2 gap-3">
        {puzzle.candidates.map((cells, index) => {
          const correct = index === puzzle.correctIndex;
          return (
            <div
              key={index}
              className={`flex h-[76px] w-[76px] flex-col items-center justify-center rounded-xl border ${
                correct ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <ShapeSvg
                cells={cells}
                size={54}
                tone={correct ? "gold" : "grey"}
                rotateDeg={correct && !myCorrect ? hintDeg : 0}
                animate={correct && !myCorrect}
              />
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
      {picked < 0 && <p className="font-display text-xl font-bold text-warn">No answer</p>}
    </>
  );
}

export function buildRotationMatch(): RotationPuzzleData {
  const shape = pick(SHAPE_BANK);
  const rots = rotations(shape);
  const rotIndex = pick([1, 2, 3]);
  const target = rots[0]!;
  const correct = rots[rotIndex]!;

  const mirrorRots = rotations(mirror(shape));
  const seen = new Set([shapeKey(correct)]);
  const distractors: Cells[] = [];
  for (const cells of shuffled(mirrorRots)) {
    if (seen.has(shapeKey(cells))) continue;
    seen.add(shapeKey(cells));
    distractors.push(cells);
    if (distractors.length === 3) break;
  }

  const options = shuffled([correct, ...distractors]);
  const correctIndex = options.findIndex((o) => shapeKey(o) === shapeKey(correct));
  return {
    type: "rotmatch",
    target,
    candidates: options,
    correctIndex,
    rotationDeg: rotIndex * 90,
  };
}

export const rotationMatchPuzzle: PuzzleDefinition = {
  key: "rotmatch",
  name: "Rotation Match",
  category: "pattern",
  timeLimitMs: 30_000,
  generate: buildRotationMatch,
  check: (answer, puzzle) => {
    if (puzzle.type !== "rotmatch") return false;
    return Number.parseInt(answer, 10) === puzzle.correctIndex;
  },
  IntroExample,
  Stage,
  Reveal,
};
