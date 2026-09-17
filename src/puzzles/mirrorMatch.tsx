import { useEffect, useRef, useState } from "react";

import { ColourShape, RunProgress } from "@/components/puzzles/ColourShape";
import { pick, shuffled } from "@/lib/duel/random";
import {
  normalise,
  randomColouring,
  reflect,
  rotate,
  SHAPE_BANK,
  shapeKey,
  toPts,
} from "@/lib/duel/shapes";
import {
  MIRMATCH_ITEMS,
  MIRMATCH_TIME_MS,
  type MirrorAxis,
  type MirrorCandidateKind,
  type MirrorItem,
  type MirrorPuzzleData,
  type MirrorShape,
  type StroopColour,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/* -------------------------------------------------------------------------- */
/*  Generation (server side)                                                   */
/* -------------------------------------------------------------------------- */

/** Vertical or horizontal, 50/50 — there is no diagonal mirror. */
function pickAxis(): MirrorAxis {
  return Math.random() < 0.5 ? "vertical" : "horizontal";
}

const otherAxis = (axis: MirrorAxis): MirrorAxis =>
  axis === "vertical" ? "horizontal" : "vertical";

const MIRROR_COLOURS: StroopColour[] = ["RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "BROWN"];

/** Keeps the reflected outline exact while changing one or two painted cells. */
function wrongColouring(shape: MirrorShape, changedCells: 1 | 2): MirrorShape {
  const indices = shuffled(shape.colours.map((_, index) => index)).slice(0, changedCells);
  return {
    cells: [...shape.cells],
    colours: shape.colours.map((colour, index) =>
      indices.includes(index) ? pick(MIRROR_COLOURS.filter((candidate) => candidate !== colour)) : colour,
    ),
  };
}

function buildItem(): MirrorItem & { kinds: MirrorCandidateKind[]; correctIndex: number } {
  for (let attempt = 0; attempt < 400; attempt++) {
    const target = randomColouring(pick(SHAPE_BANK));
    if (!target) continue;
    const axis = pickAxis();
    const pts = toPts(target);

    const correct = normalise(reflect(pts, axis));
    // Every item has a correct-outline/wrong-colouring trap. Half have two of
    // those traps (one and two changed cells), leaving one rotation distractor.
    const wrongAxis = normalise(reflect(pts, otherAxis(axis)));
    const turned = normalise(rotate(pts, pick([1, 2, 3])));
    const oneWrong = wrongColouring(correct, 1);
    const twoWrong = wrongColouring(correct, 2);
    const doubleColourTrap = Math.random() < 0.5;
    const options: { shape: MirrorShape; kind: MirrorCandidateKind }[] = [
      { shape: correct, kind: "correct" },
      { shape: turned, kind: "rotation" },
      { shape: normalise(toPts(oneWrong)), kind: "swap" },
      doubleColourTrap
        ? { shape: normalise(toPts(twoWrong)), kind: "swap" }
        : { shape: wrongAxis, kind: "otherAxis" },
    ];
    if (new Set(options.map((o) => shapeKey(o.shape))).size !== 4) continue;

    const order = shuffled(options);
    return {
      axis,
      target,
      candidates: order.map((o) => o.shape),
      kinds: order.map((o) => o.kind),
      correctIndex: order.findIndex((o) => o.kind === "correct"),
    };
  }
  throw new Error("Could not build a Mirror Match item.");
}

function buildMirrorMatch(): MirrorPuzzleData {
  const built = Array.from({ length: MIRMATCH_ITEMS }, buildItem);
  return {
    type: "mirmatch",
    items: built.map(({ axis, target, candidates }) => ({ axis, target, candidates })),
    answers: built.map((b) => b.correctIndex),
    kinds: built.map((b) => b.kinds),
  };
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                      */
/* -------------------------------------------------------------------------- */

const EXAMPLE: MirrorShape = {
  cells: [0, 1, 5, 11],
  colours: ["RED", "ORANGE", "GREEN", "PURPLE"],
};
const EXAMPLE_ANSWER = normalise(reflect(toPts(EXAMPLE), "vertical"));

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Flip the shape across the dashed line, colours and all. Tap the result.
      </p>
      <div className="flex items-center justify-center gap-4">
        <ColourShape shape={EXAMPLE} size={92} axis="vertical" />
        <span className="font-mono text-xs text-muted-foreground">→</span>
        <span className="rounded-xl border-2 border-primary p-1">
          <ColourShape shape={EXAMPLE_ANSWER} size={80} />
        </span>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Three shapes — get them all to earn the speed bonus. You have 30 seconds.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stage                                                                      */
/* -------------------------------------------------------------------------- */

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const items: MirrorItem[] = puzzle.type === "mirmatch" ? puzzle.items : [];
  const key = items.map((i) => `${i.axis}:${shapeKey(i.target)}`).join("|");
  const [picks, setPicks] = useState<number[]>([]);
  const submitted = useRef("");

  useEffect(() => {
    setPicks([]);
  }, [key]);

  // The run is sent once all three are answered, or just before time is up.
  useEffect(() => {
    if (items.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + MIRMATCH_TIME_MS - 400;
    if (picks.length < items.length && !timeUp) return;
    submitted.current = key;
    onSubmit(picks.join(","));
  }, [picks, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "mirmatch") return null;

  const index = picks.length;
  const item = puzzle.items[index];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <RunProgress total={puzzle.items.length} done={picks.length} />
      {item ? (
        <div className="flex flex-1 flex-col items-center justify-between gap-5">
          <div className="flex flex-col items-center gap-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Shape {index + 1} of {puzzle.items.length}
            </p>
            <ColourShape shape={item.target} size={130} axis={item.axis} />
          </div>
          <div className="grid w-full grid-cols-2 gap-3">
            {item.candidates.map((candidate, i) => (
              <button
                key={i}
                type="button"
                disabled={locked}
                onClick={() => setPicks((prev) => [...prev, i])}
                className="flex min-h-[44px] items-center justify-center rounded-2xl bg-card p-2 active:scale-95"
              >
                <ColourShape shape={candidate} size={86} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Run complete.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reveal                                                                     */
/* -------------------------------------------------------------------------- */

const WRONG_TEXT: Record<MirrorCandidateKind, string> = {
  correct: "",
  otherAxis: "That's the flip across the other line.",
  rotation: "That's the shape turned, not flipped.",
  swap: "Right shape, two colours swapped.",
};

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "mirmatch") return null;
  const answers = puzzle.answers ?? [];
  const kinds = puzzle.kinds ?? [];
  const picks = (myAnswer ?? "").split(",").map((v) => Number.parseInt(v, 10));
  const correctCount = answers.filter((a, i) => picks[i] === a).length;

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-center font-mono text-sm text-muted-foreground">
        {correctCount} / {puzzle.items.length} correct
      </p>
      {puzzle.items.map((item, i) => {
        const answer = answers[i];
        const mine = picks[i];
        const ok = mine === answer;
        const kind = mine === undefined ? undefined : kinds[i]?.[mine];
        return (
          <div key={i} className="flex flex-col gap-1 rounded-xl bg-card px-3 py-2">
            <div className="flex items-center gap-3">
              <ColourShape shape={item.target} size={52} axis={item.axis} />
              <span className="font-mono text-xs text-muted-foreground">→</span>
              {item.candidates.map((candidate, c) => (
                <span
                  key={c}
                  className={`rounded-lg border-2 p-0.5 ${
                    c === answer ? "border-primary" : "border-transparent"
                  }`}
                >
                  <ColourShape shape={candidate} size={34} faded={c !== answer && c !== mine} />
                </span>
              ))}
              <span className={`ml-auto text-lg ${ok ? "text-primary" : "text-destructive"}`}>
                {ok ? "✓" : "✕"}
              </span>
            </div>
            {!ok && kind && kind !== "correct" && (
              <p className="text-[11px] text-muted-foreground">{WRONG_TEXT[kind]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const mirrorMatchPuzzle: PuzzleDefinition = {
  key: "mirmatch",
  name: "Mirror Match",
  category: "pattern",
  timeLimitMs: MIRMATCH_TIME_MS,
  generate: buildMirrorMatch,
  check: (answer, puzzle) => {
    if (puzzle.type !== "mirmatch") return false;
    const answers = puzzle.answers ?? [];
    const picks = answer.split(",").map((v) => Number.parseInt(v, 10));
    return answers.length > 0 && answers.every((a, i) => picks[i] === a);
  },
  IntroExample,
  Stage,
  Reveal,
};
