import { useEffect, useRef, useState } from "react";

import { ShapeGlyph } from "@/components/duel/ShapeGlyph";
import { serverNow } from "@/lib/duel/clock";
import { pick, shuffled } from "@/lib/duel/random";
import {
  GONOGO_ITEMS,
  GONOGO_ITEM_MS,
  GONOGO_RUN_MS,
  GONOGO_SLOT_MS,
  GONOGO_TARGETS,
  type GlyphShape,
  type GoNoGoItem,
  type GoNoGoPuzzleData,
  type StroopColour,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const DISTRACTOR_COLOURS: StroopColour[] = ["RED", "BLUE", "GREEN", "PURPLE"];
const GOLD_SHAPES: GlyphShape[] = ["square", "triangle", "star"];

/** One entry per item: the tap time in ms after that item appeared, or null. */
type Taps = (number | null)[];

function parseTaps(answer: string): Taps {
  return answer.split(",").map((v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  });
}

export function summarise(items: GoNoGoItem[], taps: Taps) {
  let hits = 0;
  let correctRejections = 0;
  let hitTotal = 0;
  items.forEach((item, index) => {
    const tap = taps[index] ?? null;
    if (item.target && tap !== null) {
      hits += 1;
      hitTotal += tap;
    }
    if (!item.target && tap === null) correctRejections += 1;
  });
  const correct = hits + correctRejections;
  const averageHitMs = hits > 0 ? Math.round(hitTotal / hits) : null;
  return { hits, correctRejections, correct, averageHitMs };
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Tap only when you see the gold circle. Ignore everything else.
      </p>
      <div className="flex items-end gap-4">
        {[
          { shape: "circle" as GlyphShape, colour: "RED" as const, target: false },
          { shape: "circle" as GlyphShape, colour: "GOLD" as const, target: true },
          { shape: "square" as GlyphShape, colour: "GOLD" as const, target: false },
          { shape: "circle" as GlyphShape, colour: "BLUE" as const, target: false },
        ].map((item, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${
                item.target ? "border-primary bg-primary/10" : "border-transparent"
              }`}
            >
              <ShapeGlyph shape={item.shape} colour={item.colour} size={28} />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {item.target ? "TAP" : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Twelve shapes. Tap a wrong one and you lose the speed bonus.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const items = puzzle.type === "gonogo" ? puzzle.items : [];
  const key = items.map((i) => `${i.colour}${i.shape}`).join("|");
  const [taps, setTaps] = useState<Taps>(() => items.map(() => null));
  const submitted = useRef("");

  useEffect(() => {
    setTaps(items.map(() => null));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = now - phaseStartedAt;
  const index = Math.floor(elapsed / GONOGO_SLOT_MS);
  const withinItem = elapsed - index * GONOGO_SLOT_MS < GONOGO_ITEM_MS;
  const running = index >= 0 && index < items.length;
  const item = running ? items[index] : undefined;

  // Submit once the whole run has played out.
  useEffect(() => {
    if (items.length === 0 || locked || submitted.current === key) return;
    if (now < phaseStartedAt + GONOGO_RUN_MS) return;
    submitted.current = key;
    const { correct, averageHitMs } = summarise(items, taps);
    onSubmit(taps.map((t) => (t === null ? "-" : t)).join(","), {
      reactionAvgMs: averageHitMs ?? undefined,
      correctCount: correct,
    });
  }, [taps, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "gonogo") return null;

  // A tap is attributed to the item whose slot it lands in — no feedback given.
  const handleTap = () => {
    if (locked || !running) return;
    const offset = serverNow() - phaseStartedAt - index * GONOGO_SLOT_MS;
    setTaps((prev) => {
      if (prev[index] !== null && prev[index] !== undefined) return prev;
      const next = [...prev];
      next[index] = Math.max(1, Math.round(offset));
      return next;
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="flex gap-1.5">
        {items.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${i < index ? "bg-border" : "bg-muted/40"}`}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Go / No-Go area"
        onClick={handleTap}
        className="flex h-64 w-full items-center justify-center rounded-2xl border border-border bg-muted/20"
      >
        {!running ? (
          <span className="text-sm text-muted-foreground">
            {elapsed < 0 ? "Get ready…" : "Run complete"}
          </span>
        ) : item && withinItem ? (
          <ShapeGlyph shape={item.shape} colour={item.colour} size={132} />
        ) : null}
      </button>

      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Tap gold circles only
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "gonogo") return null;
  const taps = parseTaps(myAnswer ?? "");
  const { correct, averageHitMs } = summarise(puzzle.items, taps);

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-3xl font-bold tabular-nums text-primary">
        {correct} / {puzzle.items.length} correct
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {puzzle.items.map((item, index) => {
          const tap = taps[index] ?? null;
          const ok = item.target ? tap !== null : tap === null;
          return (
            <div key={index} className="flex items-center justify-center gap-2">
              <ShapeGlyph shape={item.shape} colour={item.colour} size={20} />
              <span
                className={`font-display text-xs font-bold ${ok ? "text-primary" : "text-warn"}`}
              >
                {ok ? "✓" : "✗"}
              </span>
            </div>
          );
        })}
      </div>
      </div>
      {averageHitMs !== null && <p className="text-center font-mono text-xs text-muted-foreground">avg {averageHitMs} ms</p>}
    </div>
  );
}

/** Shuffled run of twelve, six targets, never more than two targets in a row. */
export function buildGoNoGo(): GoNoGoPuzzleData {
  const distractors: GoNoGoItem[] = Array.from({ length: GONOGO_ITEMS - GONOGO_TARGETS }, (_, i) =>
    i % 2 === 0
      ? { shape: "circle", colour: pick(DISTRACTOR_COLOURS), target: false }
      : { shape: pick(GOLD_SHAPES), colour: "GOLD", target: false },
  );
  const targets: GoNoGoItem[] = Array.from({ length: GONOGO_TARGETS }, () => ({
    shape: "circle",
    colour: "GOLD",
    target: true,
  }));

  for (let attempt = 0; attempt < 200; attempt++) {
    const items = shuffled([...targets, ...distractors]);
    const runOfThree = items.some(
      (item, i) => i >= 2 && item.target && items[i - 1]!.target && items[i - 2]!.target,
    );
    if (runOfThree) continue;
    return { type: "gonogo", items };
  }
  return { type: "gonogo", items: [...targets, ...distractors] };
}

export const goNoGoPuzzle: PuzzleDefinition = {
  key: "gonogo",
  name: "Go / No-Go",
  category: "speed",
  timeLimitMs: 30_000,
  generate: buildGoNoGo,
  // Scored from hits and correct rejections, not from a single answer.
  check: () => true,
  durationMs: () => GONOGO_RUN_MS + 1_500,
  showTimer: false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
