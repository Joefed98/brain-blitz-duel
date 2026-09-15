import { useEffect, useRef, useState } from "react";

import { pick } from "@/lib/duel/random";
import {
  ROUND_MS,
  STROOP_ITEMS,
  STROOP_MAX_STREAK,
  STROOP_MIN_PER_INSTRUCTION,
  type StroopColour,
  type StroopInstruction,
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

const LABEL: Record<StroopInstruction, string> = {
  ink: "TAP THE INK",
  word: "TAP THE WORD",
};

/** The swatch that counts as correct for this item. */
function expected(item: StroopItem): StroopColour {
  return item.instruction === "ink" ? item.ink : item.word;
}

function InstructionPill({ instruction, small }: { instruction: StroopInstruction; small?: boolean }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full bg-foreground/90 font-mono font-bold uppercase tracking-widest text-background ${
        small ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[11px]"
      }`}
    >
      {LABEL[instruction]}
    </span>
  );
}

function Swatches({ highlight, small }: { highlight?: StroopColour; small?: boolean }) {
  return (
    <div className="grid w-full grid-cols-5 gap-1.5">
      {STROOP_COLOURS.map((c) => (
        <span
          key={c.name}
          className={`w-full rounded-lg border-2 ${small ? "h-6" : "h-9"} ${
            highlight === c.name ? "border-primary" : "border-transparent"
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}

function MiniExample({
  instruction,
  highlight,
}: {
  instruction: StroopInstruction;
  highlight: StroopColour;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 rounded-xl bg-card px-2 py-3">
      <InstructionPill instruction={instruction} small />
      <p className="font-display text-3xl font-bold" style={{ color: hexFor("RED") }}>
        BLUE
      </p>
      <Swatches highlight={highlight} small />
    </div>
  );
}

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Read the instruction, then tap the right colour.
      </p>
      <div className="flex w-full items-stretch gap-2">
        <MiniExample instruction="ink" highlight="RED" />
        <MiniExample instruction="word" highlight="BLUE" />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Twelve in a row. Every one must be right to earn the speed bonus.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const items = puzzle.type === "stroop" ? puzzle.items : [];
  const key = items.map((i) => `${i.word}:${i.ink}:${i.instruction}`).join("|");
  const [taps, setTaps] = useState<StroopColour[]>([]);
  const submitted = useRef("");

  useEffect(() => {
    setTaps([]);
  }, [key]);

  // Submit the run: once the last item is answered, or just before time is up.
  useEffect(() => {
    if (items.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + ROUND_MS - 400;
    if (taps.length < items.length && !timeUp) return;
    submitted.current = key;
    const correct = taps.filter((tap, i) => {
      const item = items[i];
      return item ? tap === expected(item) : false;
    }).length;
    onSubmit(taps.join(","), { correctCount: correct });
  }, [taps, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "stroop") return null;

  const index = taps.length;
  const item = puzzle.items[index];

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {Math.min(index + 1, puzzle.items.length)} of {puzzle.items.length}
        </p>
        {item ? (
          <>
            <InstructionPill instruction={item.instruction} />
            <p className="font-display text-5xl font-bold" style={{ color: hexFor(item.ink) }}>
              {item.word}
            </p>
          </>
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
  const correct = puzzle.items.filter((item, i) => taps[i] === expected(item)).length;

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-3xl font-bold tabular-nums text-primary">
        {correct} / {puzzle.items.length} correct
      </p>
      <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1">
        {puzzle.items.map((item, index) => {
          const ok = taps[index] === expected(item);
          return (
            <div key={index} className="flex min-w-0 items-center justify-between gap-1">
              <InstructionPill instruction={item.instruction} small />
              <span className="truncate font-display text-xs font-bold" style={{ color: hexFor(item.ink) }}>
                {item.word}
              </span>
              <span
                className={`font-display text-sm font-bold ${ok ? "text-primary" : "text-warn"}`}
              >
                {ok ? "✓" : "✗"}
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

/** At least three of each instruction, shuffled, never four of a kind in a row. */
function buildInstructions(): StroopInstruction[] {
  const inks = STROOP_MIN_PER_INSTRUCTION;
  const words = STROOP_MIN_PER_INSTRUCTION;
  const rest = STROOP_ITEMS - inks - words;

  for (;;) {
    const pool: StroopInstruction[] = [
      ...Array.from({ length: inks }, () => "ink" as const),
      ...Array.from({ length: words }, () => "word" as const),
      ...Array.from({ length: rest }, () => pick(["ink", "word"] as StroopInstruction[])),
    ];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    let streak = 1;
    let ok = true;
    for (let i = 1; i < pool.length; i += 1) {
      streak = pool[i] === pool[i - 1] ? streak + 1 : 1;
      if (streak > STROOP_MAX_STREAK) {
        ok = false;
        break;
      }
    }
    if (ok) return pool;
  }
}

export function buildStroop(): StroopPuzzleData {
  const names = STROOP_COLOURS.map((c) => c.name);
  const instructions = buildInstructions();
  const items: StroopItem[] = instructions.map((instruction) => {
    const word = pick(names);
    const ink = pick(names.filter((n) => n !== word));
    return { word, ink, instruction };
  });
  return { type: "stroop", items };
}

export const stroopPuzzle: PuzzleDefinition = {
  key: "stroop",
  name: "Colour Clash",
  category: "attention",
  timeLimitMs: 30_000,
  generate: buildStroop,
  // Scored from how many items were right, not from a single answer.
  check: () => true,
  IntroExample,
  Stage,
  Reveal,
};
