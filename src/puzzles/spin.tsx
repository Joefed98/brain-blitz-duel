import { useEffect, useRef, useState } from "react";

import { ColourShape, RunProgress } from "@/components/puzzles/ColourShape";
import { pick, shuffled } from "@/lib/duel/random";
import {
  boxSize,
  normalise,
  orientations,
  randomColouring,
  reflect,
  rotate,
  SHAPE_BANK,
  shapeKey,
  toPts,
} from "@/lib/duel/shapes";
import {
  SPIN_ITEMS,
  SPIN_MAX_STREAK,
  SPIN_TIME_MS,
  SPIN_TRANSFORMS,
  type MirrorShape,
  type SpinItem,
  type SpinPuzzleData,
  type SpinTransform,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

export const SPIN_LABELS: Record<SpinTransform, string> = {
  cw: "↻ 90°",
  half: "180°",
  ccw: "↺ 90°",
  flip: "FLIPPED",
};

function SpinLabel({ transform }: { transform: SpinTransform }) {
  if (transform === "cw" || transform === "ccw") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-[2em] leading-none">{transform === "cw" ? "↻" : "↺"}</span>
        <span>90°</span>
      </span>
    );
  }
  return <>{SPIN_LABELS[transform]}</>;
}

/* -------------------------------------------------------------------------- */
/*  Generation (server side)                                                   */
/* -------------------------------------------------------------------------- */

/** At least one of each transform, shuffled, never three of a kind in a row. */
function buildTransforms(): SpinTransform[] {
  for (;;) {
    const pool = shuffled([
      ...SPIN_TRANSFORMS,
      ...Array.from({ length: SPIN_ITEMS - SPIN_TRANSFORMS.length }, () => pick(SPIN_TRANSFORMS)),
    ]);
    let streak = 1;
    let ok = true;
    for (let i = 1; i < pool.length; i++) {
      streak = pool[i] === pool[i - 1] ? streak + 1 : 1;
      if (streak > SPIN_MAX_STREAK) {
        ok = false;
        break;
      }
    }
    if (ok) return pool;
  }
}

/** Applies the stored transform to the coloured shape. */
function apply(shape: MirrorShape, transform: SpinTransform): MirrorShape {
  const pts = toPts(shape);
  if (transform === "cw") return normalise(rotate(pts, 1));
  if (transform === "half") return normalise(rotate(pts, 2));
  if (transform === "ccw") return normalise(rotate(pts, 3));
  // Mirrored, then turned by a random quarter so a flip can't be spotted by
  // orientation alone.
  return normalise(rotate(reflect(pts, "vertical"), pick([0, 1, 2, 3])));
}

function buildItem(transform: SpinTransform): SpinItem {
  for (let attempt = 0; attempt < 400; attempt++) {
    // `strict` keeps all eight orientations distinct, so exactly one of the
    // four answers can be right.
    const target = randomColouring(pick(SHAPE_BANK), true);
    if (!target) continue;
    const shown = apply(target, transform);
    const eight = orientations(target).map(shapeKey);
    if (new Set(eight).size !== 8) continue;
    if (shapeKey(shown) === shapeKey(normalise(toPts(target)))) continue;
    return { target, shown };
  }
  throw new Error("Could not build a Spin item.");
}

function buildSpin(): SpinPuzzleData {
  const answers = buildTransforms();
  return { type: "spin", items: answers.map(buildItem), answers };
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                      */
/* -------------------------------------------------------------------------- */

const EXAMPLE: MirrorShape = {
  cells: [0, 5, 10, 11],
  colours: ["RED", "RED", "RED", "BLUE"],
};
const EXAMPLE_SHOWN = normalise(rotate(toPts(EXAMPLE), 1));

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        How was the shape turned? Tap the answer — or FLIPPED if it&apos;s been mirrored.
      </p>
      <div className="flex items-end justify-center gap-4">
        <ColourShape shape={EXAMPLE} size={78} box={3} />
        <span className="pb-6 font-mono text-xs text-muted-foreground">→</span>
        <ColourShape shape={EXAMPLE_SHOWN} size={78} box={3} />
      </div>
      <div className="grid w-full grid-cols-4 gap-1.5">
        {SPIN_TRANSFORMS.map((t) => (
          <span
            key={t}
            className={`rounded-lg border-2 py-1 text-center font-mono text-[10px] ${
              t === "cw"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {SPIN_LABELS[t]}
          </span>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Eight in a row. Get them all right to earn the speed bonus.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stage                                                                      */
/* -------------------------------------------------------------------------- */

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const items: SpinItem[] = puzzle.type === "spin" ? puzzle.items : [];
  const key = items.map((i) => shapeKey(i.shown)).join("|");
  const [picks, setPicks] = useState<SpinTransform[]>([]);
  const submitted = useRef("");

  useEffect(() => {
    setPicks([]);
  }, [key]);

  useEffect(() => {
    if (items.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + SPIN_TIME_MS - 400;
    if (picks.length < items.length && !timeUp) return;
    submitted.current = key;
    onSubmit(picks.join(","));
  }, [picks, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "spin") return null;

  const index = picks.length;
  const item = puzzle.items[index];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <RunProgress total={puzzle.items.length} done={picks.length} />
      {item ? (
        <div className="flex flex-1 flex-col items-center justify-between gap-5">
          <div className="flex flex-col items-center gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {index + 1} of {puzzle.items.length}
            </p>
            <div className="flex items-end justify-center gap-3">
              {(() => {
                const box = Math.max(boxSize(item.target), boxSize(item.shown));
                return (
                  <>
                    <ColourShape shape={item.target} size={150} box={box} />
                    <ColourShape shape={item.shown} size={150} box={box} />
                  </>
                );
              })()}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-3">
            {SPIN_TRANSFORMS.map((t) => (
              <button
                key={t}
                type="button"
                disabled={locked}
                onClick={() => setPicks((prev) => [...prev, t])}
                className="min-h-[56px] rounded-2xl bg-card font-mono text-base font-bold text-foreground active:scale-95"
              >
                <SpinLabel transform={t} />
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

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "spin") return null;
  const answers = puzzle.answers ?? [];
  const picks = (myAnswer ?? "").split(",").filter(Boolean) as SpinTransform[];
  const correctCount = answers.filter((a, i) => picks[i] === a).length;

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-3xl font-bold text-primary">
        {correctCount} / {puzzle.items.length} correct
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {puzzle.items.map((item, i) => {
          const answer = answers[i];
          const mine = picks[i];
          const ok = mine !== undefined && mine === answer;
          return (
            <div key={i} className="flex min-w-0 items-center gap-1 rounded-lg bg-card px-1.5 py-1">
              <ColourShape shape={item.target} size={25} />
              <ColourShape shape={item.shown} size={25} />
              <span className="font-mono text-[9px] text-primary">
                {answer ? SPIN_LABELS[answer] : "—"}
              </span>
              <span className="ml-auto truncate font-mono text-[9px] text-muted-foreground">
                {mine ? SPIN_LABELS[mine] : "no answer"}
              </span>
              <span className={`text-lg ${ok ? "text-primary" : "text-destructive"}`}>
                {ok ? "✓" : "✕"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const spinPuzzle: PuzzleDefinition = {
  key: "spin",
  name: "Spin",
  category: "pattern",
  timeLimitMs: SPIN_TIME_MS,
  generate: buildSpin,
  // Scored from how many items were right, not from a single answer.
  check: () => true,
  IntroExample,
  Stage,
  Reveal,
};
