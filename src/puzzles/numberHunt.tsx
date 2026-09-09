import { useEffect, useRef, useState } from "react";

import { serverNow } from "@/lib/duel/clock";
import {
  NUMHUNT_CIRCLE_PX,
  NUMHUNT_COUNT,
  NUMHUNT_FLASH_MS,
  ROUND_MS,
  type HuntSpot,
  type NumberHuntPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Reference size of the puzzle area on a 390px-wide phone, used for spacing. */
const AREA_W = 340;
const AREA_H = 320;
const MIN_GAP_PX = NUMHUNT_CIRCLE_PX + 8;
const CONSECUTIVE_GAP_PX = 120;

function distancePx(a: HuntSpot, b: HuntSpot): number {
  const dx = ((a.x - b.x) / 100) * AREA_W;
  const dy = ((a.y - b.y) / 100) * AREA_H;
  return Math.sqrt(dx * dx + dy * dy);
}

/** "reached,errors,elapsedMs" — everything the reveal needs. */
export function parseRun(answer: string | null) {
  const [reached, errors, elapsed] = (answer ?? "")
    .split(",")
    .map((v) => Number.parseInt(v, 10));
  return {
    reached: Number.isFinite(reached) ? reached! : 0,
    errors: Number.isFinite(errors) ? errors! : 0,
    elapsedMs: Number.isFinite(elapsed) ? elapsed! : 0,
  };
}

const EXAMPLE_SPOTS: HuntSpot[] = [
  { x: 20, y: 22 },
  { x: 74, y: 32 },
  { x: 38, y: 62 },
  { x: 82, y: 74 },
  { x: 16, y: 84 },
  { x: 54, y: 12 },
];

function Circle({
  n,
  done,
  wrong = false,
  size = NUMHUNT_CIRCLE_PX,
}: {
  n: number;
  done: boolean;
  wrong?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`flex items-center justify-center rounded-full border-2 font-mono font-bold ${
        wrong
          ? "border-warn bg-warn/25 text-warn"
          : done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground"
      }`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {n}
    </span>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Tap the numbers in order, 1 to 12, as fast as you can.
      </p>
      <div className="relative h-40 w-56">
        {EXAMPLE_SPOTS.map((spot, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <Circle n={index + 1} done={index < 3} size={34} />
          </span>
        ))}
        {/* Finger pointing at 4 — drawn inline, never a Unicode glyph. */}
        <svg
          className="absolute text-primary"
          style={{ left: `${EXAMPLE_SPOTS[3]!.x + 6}%`, top: `${EXAMPLE_SPOTS[3]!.y}%` }}
          width="26"
          height="26"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M10 21v-5l-3 1c-1 .3-1.8-.8-1.1-1.6l3.6-4.2V4.6a1.6 1.6 0 0 1 3.2 0v4.6h1a4 4 0 0 1 4 4V21z"
            fill="currentColor"
          />
        </svg>
      </div>
      <p className="text-center text-xs text-muted-foreground">Wrong taps cost you points.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const spots = puzzle.type === "numhunt" ? puzzle.spots : [];
  const key = spots.map((s) => `${s.x}:${s.y}`).join("|");
  const [next, setNext] = useState(0);
  const [errors, setErrors] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const submitted = useRef("");

  useEffect(() => {
    setNext(0);
    setErrors(0);
    setFlash(null);
  }, [key]);

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), NUMHUNT_FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  if (puzzle.type !== "numhunt") return null;

  const handleTap = (index: number) => {
    if (locked || index < next) return;
    if (index !== next) {
      setErrors((e) => e + 1);
      setFlash(index);
      return;
    }
    const done = index + 1;
    setNext(done);
    if (done === spots.length && submitted.current !== key) {
      submitted.current = key;
      const remaining = Math.max(0, ROUND_MS - (serverNow() - phaseStartedAt));
      onSubmit(`${done},${errors},${Math.round(ROUND_MS - remaining)}`, { errors });
    }
  };

  const elapsed = Math.max(0, now - phaseStartedAt);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Next: {Math.min(next + 1, spots.length)}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {errors} {errors === 1 ? "error" : "errors"}
        </span>
      </div>

      <div className="relative min-h-[320px] flex-1 rounded-2xl border border-border bg-muted/10">
        {spots.map((spot, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Circle ${index + 1}`}
            disabled={locked}
            onClick={() => handleTap(index)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <Circle n={index + 1} done={index < next} wrong={flash === index} />
          </button>
        ))}
      </div>

      <p className="text-center font-mono text-xs text-muted-foreground">
        {(elapsed / 1000).toFixed(1)}s
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "numhunt") return null;
  const { reached, errors, elapsedMs } = parseRun(myAnswer);
  const finished = reached >= puzzle.spots.length;

  return (
    <>
      <div className="relative h-64 w-full rounded-2xl border border-border bg-muted/10">
        {puzzle.spots.map((spot, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <Circle n={index + 1} done size={40} />
          </span>
        ))}
      </div>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-4">
        <p className="font-mono text-lg font-bold text-primary">
          {finished
            ? `Finished with ${errors} ${errors === 1 ? "error" : "errors"} · ${(
                elapsedMs / 1000
              ).toFixed(1)}s`
            : `Did not finish · reached ${Math.max(reached, 0)}`}
        </p>
      </div>
    </>
  );
}

/**
 * Positions are stored as percentages, so both phones lay the circles out
 * identically. No two circles touch, and consecutive numbers are never close.
 */
export function buildNumberHunt(): NumberHuntPuzzleData {
  for (let attempt = 0; attempt < 400; attempt++) {
    const spots: HuntSpot[] = [];
    let ok = true;
    for (let i = 0; i < NUMHUNT_COUNT; i++) {
      let placed = false;
      for (let tries = 0; tries < 300; tries++) {
        const spot: HuntSpot = {
          x: Math.round(10 + Math.random() * 80),
          y: Math.round(9 + Math.random() * 82),
        };
        if (spots.some((s) => distancePx(s, spot) < MIN_GAP_PX)) continue;
        const previous = spots[i - 1];
        if (previous && distancePx(previous, spot) < CONSECUTIVE_GAP_PX) continue;
        spots.push(spot);
        placed = true;
        break;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return { type: "numhunt", spots };
  }
  // Fallback grid — spaced widely enough that it can never overlap.
  return {
    type: "numhunt",
    spots: Array.from({ length: NUMHUNT_COUNT }, (_, i) => ({
      x: 18 + (i % 3) * 32,
      y: 12 + Math.floor(i / 3) * 25,
    })),
  };
}

export const numberHuntPuzzle: PuzzleDefinition = {
  key: "numhunt",
  name: "Number Hunt",
  category: "speed",
  generate: buildNumberHunt,
  revealHeading: "Your run",
  check: (answer, puzzle) =>
    puzzle.type === "numhunt" && parseRun(answer).reached >= puzzle.spots.length,
  IntroExample,
  Stage,
  Reveal,
};
