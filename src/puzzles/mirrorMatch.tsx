import { useEffect, useState } from "react";

import { pick, shuffled } from "@/lib/duel/random";
import type { MirrorPuzzleData } from "@/lib/duel/types";

import {
  SHAPE_BANK,
  ShapeSvg,
  mirror,
  rotations,
  shapeKey,
} from "./rotationMatch";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — an L-shape with its mirror highlighted, every time. */
const EXAMPLE_TARGET = [0, 1, 2, 3, 5, 6];
const EXAMPLE_MIRROR = mirror(EXAMPLE_TARGET);
const EXAMPLE_ROTS = rotations(EXAMPLE_TARGET);
const EXAMPLE_CANDIDATES = [
  EXAMPLE_ROTS[1]!,
  EXAMPLE_MIRROR,
  EXAMPLE_ROTS[2]!,
  EXAMPLE_ROTS[3]!,
];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        One of these is the target flipped in a mirror. The others are only turned round. Find the
        flipped one.
      </p>
      <ShapeSvg cells={EXAMPLE_TARGET} size={56} tone="gold" />
      <div className="grid grid-cols-2 gap-2">
        {EXAMPLE_CANDIDATES.map((cells, index) => (
          <div
            key={index}
            className={`flex h-[54px] w-[54px] items-center justify-center rounded-xl border ${
              index === 1 ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <ShapeSvg cells={cells} size={40} tone={index === 1 ? "gold" : "grey"} />
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tap once to lock your answer.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "mirmatch") return null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Target
        </span>
        <ShapeSvg cells={puzzle.target} size={88} tone="gold" />
      </div>

      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Which one is mirrored?
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
  if (puzzle.type !== "mirmatch") return null;
  const chosen = Number.parseInt(myAnswer ?? "", 10);
  const picked = Number.isFinite(chosen) ? chosen : -1;

  // The target flips into the correct candidate over a second.
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFlipped(true), 400);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <div
        className="transition-transform duration-1000 ease-in-out"
        style={{ transform: flipped ? "scaleX(-1)" : "scaleX(1)" }}
      >
        <ShapeSvg cells={puzzle.target} size={72} tone="gold" />
      </div>
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
              <ShapeSvg cells={cells} size={54} tone={correct ? "gold" : "grey"} />
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

export function buildMirrorMatch(): MirrorPuzzleData {
  const shape = pick(SHAPE_BANK);
  const rots = rotations(shape);
  const target = rots[0]!;
  // Exactly one mirror: the shapes are chiral, so no rotation of the target
  // can ever be a mirror image of it.
  const correct = pick(rotations(mirror(shape)));
  const distractors = [rots[1]!, rots[2]!, rots[3]!];

  const options = shuffled([correct, ...distractors]);
  const correctIndex = options.findIndex((o) => shapeKey(o) === shapeKey(correct));
  return { type: "mirmatch", target, candidates: options, correctIndex };
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
