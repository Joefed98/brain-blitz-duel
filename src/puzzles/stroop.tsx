import { useEffect, useRef, useState } from "react";

import { pick } from "@/lib/duel/random";
import {
  ROUND_MS,
  STROOP_ITEMS,
  type StroopColour,
  type StroopItem,
  type StroopPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed button order for the whole round. */
export const STROOP_COLOURS: { name: StroopColour; hex: string }[] = [
  { name: "RED", hex: "#FF4D4D" },
  { name: "BLUE", hex: "#4D8CFF" },
  { name: "GREEN", hex: "#3DDC84" },
  { name: "PURPLE", hex: "#B26BFF" },
  { name: "PINK", hex: "#FF6BD6" },
];

function hexFor(colour: string): string {
  return STROOP_COLOURS.find((c) => c.name === colour)?.hex ?? "#FFFFFF";
}

function Swatches({ highlight }: { highlight?: StroopColour }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {STROOP_COLOURS.map((c) => (
        <span
          key={c.name}
          className={`h-9 w-full rounded-lg border-2 ${
            highlight === c.name ? "border-primary" : "border-transparent"
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Tap the colour of the ink — not the word it spells.
      </p>
      <p className="font-display text-5xl font-bold" style={{ color: hexFor("RED") }}>
        BLUE
      </p>
      <Swatches highlight="RED" />
      <p className="text-center text-xs text-muted-foreground">
        Fifteen in a row. Every one must be right to earn the speed bonus.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const items = puzzle.type === "stroop" ? puzzle.items : [];
  const key = items.map((i) => `${i.word}:${i.ink}`).join("|");
  const [taps, setTaps] = useState<StroopColour[]>([]);
  const submitted = useRef("");

  useEffect(() => {
    setTaps([]);
  }, [key]);

  // Submit the run: once the tenth item is answered, or just before time is up.
  useEffect(() => {
    if (items.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + ROUND_MS - 400;
    if (taps.length < items.length && !timeUp) return;
    submitted.current = key;
    const correct = taps.filter((tap, i) => tap === items[i]?.ink).length;
    onSubmit(taps.join(","), { correctCount: correct });
  }, [taps, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "stroop") return null;

  const index = taps.length;
  const item = puzzle.items[index];

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {Math.min(index + 1, puzzle.items.length)} of {puzzle.items.length}
        </p>
        {item ? (
          <p className="font-display text-5xl font-bold" style={{ color: hexFor(item.ink) }}>
            {item.word}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Run complete</p>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {STROOP_COLOURS.map((c) => (
          <button
            key={c.name}
            type="button"
            aria-label={c.name}
            disabled={locked || !item}
            onClick={() => item && !locked && setTaps((prev) => [...prev, c.name])}
            className="tap-target h-20 rounded-xl border border-border disabled:opacity-40"
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "stroop") return null;
  const taps = (myAnswer ?? "").split(",").filter((v) => v.length > 0);
  const correct = taps.filter((tap, i) => tap === puzzle.items[i]?.ink).length;

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1">
        {puzzle.items.map((item, index) => {
          const tap = taps[index];
          return (
            <div key={index} className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-bold" style={{ color: hexFor(item.ink) }}>
                {item.word}
              </span>
              <span
                className={`font-display text-sm font-bold ${
                  tap === item.ink ? "text-primary" : "text-warn"
                }`}
              >
                {tap === item.ink ? "✓" : "✗"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your run</p>
        <p className="font-mono text-3xl font-bold tabular-nums text-primary">
          {correct} / {puzzle.items.length} correct
        </p>
      </div>
    </>
  );
}

export function buildStroop(): StroopPuzzleData {
  const names = STROOP_COLOURS.map((c) => c.name);
  const items: StroopItem[] = Array.from({ length: STROOP_ITEMS }, () => {
    const word = pick(names);
    const ink = pick(names.filter((n) => n !== word));
    return { word, ink };
  });
  return { type: "stroop", items };
}

export const stroopPuzzle: PuzzleDefinition = {
  key: "stroop",
  name: "Colour Clash",
  category: "attention",
  generate: buildStroop,
  // Scored from how many items were right, not from a single answer.
  check: () => true,
  IntroExample,
  Stage,
  Reveal,
};
