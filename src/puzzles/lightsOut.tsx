import { gameDisplayName } from "@/lib/duel/gameNames";
import { Undo2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { solvedMovesText } from "@/lib/duel/scoring";
import { playCorrect } from "@/lib/sound";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

import { decodePresses, encodePresses, lightsAllOff, replayLights } from "@/lib/duel/logic";
import {
  LIGHTS_COLS,
  LIGHTS_CELLS,
  LIGHTS_TIME_MS,
  type LightsOutPuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";

import { soundCue, useSolveFx } from "./logicFx";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** One glass bulb in its socket: dark glass and a grey filament off, a warm glow on. */
function Bulb({ on, ids }: { on: boolean; ids: string }) {
  return (
    <svg viewBox="7 2.5 26 36" className="logic-bulb-art" aria-hidden="true">
      <circle className="logic-bulb-halo" cx="20" cy="17" r="18" fill={`url(#${ids}-halo)`} style={{ opacity: on ? 1 : 0 }} />
      <path className="logic-bulb-glass" d="M20 4.5a12 12 0 0 0-7.4 21.5c1.6 1.3 2.4 2.7 2.4 4.2h10c0-1.5.8-2.9 2.4-4.2A12 12 0 0 0 20 4.5Z" fill={`url(#${ids}-off)`} />
      <path className="logic-bulb-lit" d="M20 4.5a12 12 0 0 0-7.4 21.5c1.6 1.3 2.4 2.7 2.4 4.2h10c0-1.5.8-2.9 2.4-4.2A12 12 0 0 0 20 4.5Z" fill={`url(#${ids}-on)`} style={{ opacity: on ? 1 : 0 }} />
      <path className="logic-bulb-wire" d="M17.4 29.6V21.5M22.6 29.6V21.5" stroke={on ? "#FFE7A3" : "#5D616C"} strokeWidth="0.9" fill="none" />
      <path className="logic-bulb-filament" d="M17.4 21.5l1-2 1 2 1-2 1 2 1-2" stroke={on ? "#FFFFFF" : "#8A8E99"} strokeWidth={on ? 1.3 : 1} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="15.6" cy="11.4" rx="2.6" ry="4" transform="rotate(28 15.6 11.4)" fill="#FFFFFF" opacity={on ? 0.55 : 0.22} />
      <rect x="15" y="30.2" width="10" height="5.6" rx="1.2" fill={`url(#${ids}-base)`} />
      <path d="M15 32.1h10M15 34h10" stroke="#3E3A33" strokeWidth="0.7" />
      <path d="M18 35.8h4l-.8 1.6h-2.4Z" fill="#2B2A2E" />
    </svg>
  );
}

/** Shared gradients for one grid of bulbs (one set per grid, not per bulb). */
function BulbDefs({ ids }: { ids: string }) {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <radialGradient id={`${ids}-off`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#3A3E49" />
          <stop offset="0.7" stopColor="#1E2028" />
          <stop offset="1" stopColor="#14151B" />
        </radialGradient>
        <radialGradient id={`${ids}-on`} cx="0.5" cy="0.62" r="0.7">
          <stop offset="0" stopColor="#FFFBEA" />
          <stop offset="0.35" stopColor="#FFE38A" />
          <stop offset="0.8" stopColor="#F5B82E" />
          <stop offset="1" stopColor="#D08A12" />
        </radialGradient>
        <radialGradient id={`${ids}-halo`}>
          <stop offset="0.35" stopColor="#F5B82E" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F5B82E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${ids}-base`} x1="0" x2="1">
          <stop offset="0" stopColor="#6E6A60" />
          <stop offset="0.45" stopColor="#D6D0C2" />
          <stop offset="1" stopColor="#5A564D" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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
  const ids = `lo${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rows = Math.ceil(lights.length / cols);
  return (
    <div
      className="logic-bulb-grid relative mx-auto grid aspect-square w-full max-w-full"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gap,
        containerType: "inline-size",
      }}
    >
      <BulbDefs ids={ids} />
      {lights.map((on, cell) => {
        const row = Math.floor(cell / cols);
        const col = cell % cols;
        // Completion stagger: from the centre outwards, 0–150 ms.
        const reach = Math.hypot(row - (rows - 1) / 2, col - (cols - 1) / 2) / Math.hypot((rows - 1) / 2, (cols - 1) / 2 || 1);
        return (
          <button
            key={cell}
            type="button"
            disabled={!onPress}
            onClick={onPress ? () => onPress(cell) : undefined}
            className={`lightsout-bulb logic-bulb relative ${on ? "lightsout-bulb-on" : "lightsout-bulb-off"} ${flash === cell ? "logic-bulb-press" : ""}`}
            style={{ "--logic-delay": `${Math.round(reach * 150)}ms` } as CSSProperties}
            aria-label={`Light ${cell + 1} ${on ? "on" : "off"}`}
          >
            <Bulb on={on} ids={ids} />
            {numbers?.[cell] !== undefined && (
              <span
                className="logic-bulb-number absolute inset-0 flex items-center justify-center font-mono font-bold"
                style={{
                  fontSize: `max(13px, calc((100cqw - ${(cols - 1) * gap}px) / ${cols} * 0.42))`,
                }}
              >
                <span>{numbers[cell]}</span>
              </span>
            )}
          </button>
        );
      })}
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
  const solved = presses.some((cell) => cell >= 0) && lightsAllOff(lights);
  const solving = useSolveFx("lightsout", solved);

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
    soundCue("lightsout.toggle");
    setFlash(cell);
    window.setTimeout(() => setFlash(null), 180);
    setPresses((current) => [...current, cell]);
  };

  return (
    <div data-logic-stage="lightsout" data-logic-solved={solving ? "" : undefined} data-stage-column="3" className="relative flex min-h-0 flex-1 flex-col gap-3">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        <p className="logic-status text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          presses <span className="text-primary">{presses.filter((cell) => cell >= 0).length}</span>
        </p>
        <div className="logic-square logic-bulb-panel">
          <LightsGrid lights={lights} flash={flash} onPress={locked ? undefined : press} />
        </div>
      </div>
      <div data-game-controls="actions" className="flex shrink-0 items-center justify-center gap-3">
        <Button type="button" variant="outline" aria-label="Undo" title="Undo"
          onClick={() => setPresses((current) => [...current, -1])}
          disabled={locked || presses.length === 0} className="puzzle-secondary-control">
          <Undo2 aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" aria-label="Reset" title="Reset"
          onClick={() => setPresses((current) => [...current, -2])}
          disabled={locked || presses.length === 0} className="puzzle-secondary-control">
          <RotateCcw aria-hidden="true" />
        </Button>
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
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-square-bare logic-bulb-panel" style={{ maxWidth: 320 }}>
          <LightsGrid lights={myCorrect ? new Array(puzzle.lights.length).fill(false) : puzzle.lights} numbers={numbers} gap={6} />
        </div>
      </div>
      <p className="logic-reveal-text text-center font-mono uppercase tracking-widest text-muted-foreground">
        {myCorrect ? "✓" : "✗"} your presses <span className="text-primary">{mine}</span> · min{" "}
        {min}
      </p>
      {myCorrect ? (
        <p className="logic-reveal-text text-center font-mono text-primary">
          {solvedMovesText(mine, min, myMsRemaining, timeLimitMs)}
        </p>
      ) : null}
    </div>
  );
}

/** Patterns are built from a hidden press set; the true minimum stays server-side. */
export const lightsOutPuzzle: PuzzleDefinition = {
  key: "lightsout",
  name: gameDisplayName("lightsout"),
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
