import { solvedMovesText } from "@/lib/duel/scoring";
import { playCorrect } from "@/lib/sound";
import { useEffect, useMemo, useRef, useState } from "react";

import { decodePresses, encodePresses, lightsAllOff, replayLights } from "@/lib/duel/logic";
import {
  LIGHTS_COLS,
  LIGHTS_CELLS,
  LIGHTS_TIME_MS,
  type LightsOutPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The grid of lights. Numbers mark the shortest solution on the reveal. */
function LightsGrid({
  lights,
  cols = LIGHTS_COLS,
  numbers,
  flash,
  onPress,
  gap = 12,
}: {
  lights: boolean[];
  cols?: number | undefined;
  numbers?: Record<number, number> | undefined;
  flash?: number | null | undefined;
  onPress?: ((cell: number) => void) | undefined;
  gap?: number | undefined;
}) {
  return (
    <div
      className="mx-auto grid aspect-square w-full max-w-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.ceil(lights.length / cols)}, minmax(0, 1fr))`,
        gap,
        containerType: "inline-size",
      }}
    >
      {lights.map((on, cell) => (
        <button
          key={cell}
          type="button"
          disabled={!onPress}
          onClick={onPress ? () => onPress(cell) : undefined}
          className={`relative rounded-xl border transition-colors duration-100 ${
            on
              ? "border-primary bg-primary shadow-[0_0_18px_var(--primary)]"
              : "border-border bg-card"
          } ${flash === cell ? "animate-pop-in" : ""}`}
          aria-label={`Light ${cell + 1} ${on ? "on" : "off"}`}
        >
          {numbers?.[cell] !== undefined && (
            <span
              className={`absolute inset-0 flex items-center justify-center font-mono font-bold ${
                on ? "text-background" : "text-primary"
              }`}
              style={{
                fontSize: `max(11px, calc((100cqw - ${(cols - 1) * gap}px) / ${cols} * 0.45))`,
              }}
            >
              {numbers[cell]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const before = [false, true, false, true, true, true, false, true, false];
  const after = new Array(9).fill(false) as boolean[];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Tap a light to flip it and its four neighbours. Turn them all off.
      </p>
      <div className="flex items-center gap-4">
        <div style={{ width: 96 }}>
          <LightsGrid lights={before} cols={3} gap={6} />
        </div>
        <svg viewBox="0 0 24 12" className="h-4 w-8" aria-hidden="true">
          <line x1={1} y1={6} x2={19} y2={6} stroke="var(--primary)" strokeWidth={1.6} />
          <polyline
            points="15,2 21,6 15,10"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.6}
          />
        </svg>
        <div style={{ width: 96 }}>
          <LightsGrid lights={after} cols={3} gap={6} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Fewer presses earns a bonus. You have 75 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const [presses, setPresses] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const submitted = useRef(false);

  const start = puzzle.type === "lightsout" ? puzzle.lights : [];
  const lights = useMemo(() => replayLights(start, presses), [start, presses]);

  useEffect(() => {
    onDraftAnswer?.(encodePresses(presses));
  }, [presses, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current) return;
    if (!presses.some((cell) => cell >= 0) || !lightsAllOff(lights)) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodePresses(presses));
  }, [lights, presses, locked, onSubmit]);

  if (puzzle.type !== "lightsout") return null;

  const press = (cell: number) => {
    if (locked || submitted.current) return;
    buzz(10);
    setFlash(cell);
    window.setTimeout(() => setFlash(null), 160);
    setPresses((current) => [...current, cell]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        presses <span className="text-primary">{presses.filter((cell) => cell >= 0).length}</span>
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        <div className="logic-square-area flex h-full w-full items-center justify-center">
          <div className="logic-square-board">
            <LightsGrid lights={lights} flash={flash} onPress={locked ? undefined : press} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => setPresses((current) => [...current, -1])}
          disabled={locked || presses.length === 0}
          className="press font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => setPresses((current) => [...current, -2])}
          disabled={locked || presses.length === 0}
          className="press font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "lightsout") return null;
  const solution = puzzle.solution ?? [];
  const numbers: Record<number, number> = {};
  solution.forEach((cell, index) => {
    numbers[cell] = index + 1;
  });
  const mine = decodePresses(myAnswer ?? "").filter((cell) => cell >= 0).length;
  const min = puzzle.minPresses ?? solution.length;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 190 }}>
        <LightsGrid lights={puzzle.lights} numbers={numbers} gap={8} />
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect ? "✓" : "✗"} your presses <span className="text-primary">{mine}</span> · min{" "}
        {min}
      </p>
      {myCorrect ? (
        <p className="font-mono text-base text-primary">
          {solvedMovesText(mine, min, myMsRemaining, timeLimitMs)}
        </p>
      ) : null}
    </div>
  );
}

/** Patterns are built from a hidden press set; the true minimum stays server-side. */
export const lightsOutPuzzle: PuzzleDefinition = {
  key: "lightsout",
  name: "Lights Out",
  category: "logic",
  timeLimitMs: LIGHTS_TIME_MS,
  generate: () =>
    ({
      type: "lightsout",
      lights: new Array(LIGHTS_CELLS).fill(false),
    }) satisfies LightsOutPuzzleData,
  check: (answer, puzzle) =>
    puzzle.type === "lightsout" &&
    lightsAllOff(replayLights(puzzle.lights, decodePresses(answer))) &&
    decodePresses(answer).length > 0,
  revealHeading: "The shortest solution",
  IntroExample,
  Stage,
  Reveal,
};
