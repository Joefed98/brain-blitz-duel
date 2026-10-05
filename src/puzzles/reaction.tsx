import { useEffect, useRef, useState } from "react";

import { serverNow } from "@/lib/duel/clock";
import { pick, randInt, shuffled } from "@/lib/duel/random";
import {
  REACTION_DECOY_MS,
  REACTION_MAX_FLASHES,
  REACTION_MIN_FLASHES,
  REACTION_FLASH_MS,
  REACTION_MISS_MS,
  REACTION_ROUND_MS,
  type ReactionPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const DECOY_COLOURS = ["teal", "red", "blue"] as const;

/** 5–8 gold flashes, each preceded by proportionally spaced seeded decoys. */
export function buildReaction(): ReactionPuzzleData {
  const flashCount = randInt(REACTION_MIN_FLASHES, REACTION_MAX_FLASHES);
  let flashes: number[] = [];
  let decoys: ReactionPuzzleData["decoys"] = [];
  for (let attempt = 0; attempt < 1_000; attempt++) {
    const list = [randInt(4_000, 7_000)];
    while (list.length < flashCount) list.push(list[list.length - 1]! + randInt(5_000, 8_000));
    if (list[list.length - 1]! + REACTION_FLASH_MS > REACTION_ROUND_MS - 500) continue;

    // Begin at two per flash, then vary to a seeded total of 8–12.
    const counts = Array.from({ length: flashCount }, () => randInt(1, 3));

    const proposed: ReactionPuzzleData["decoys"] = [];
    let valid = true;
    for (let flashIndex = 0; flashIndex < list.length; flashIndex++) {
      const segmentStart = flashIndex === 0 ? 0 : list[flashIndex - 1]! + REACTION_FLASH_MS;
      let cursor = list[flashIndex]! - randInt(1_000, 5_000);
      const backwards: ReactionPuzzleData["decoys"] = [];
      for (let n = 0; n < counts[flashIndex]!; n++) {
        if (cursor < segmentStart + 250) {
          valid = false;
          break;
        }
        backwards.push({ at: cursor, color: pick(DECOY_COLOURS) });
        cursor -= randInt(1_500, 4_000);
      }
      proposed.push(...backwards.reverse());
      if (!valid) break;
    }
    if (!valid) continue;
    flashes = list;
    decoys = proposed.sort((a, b) => a.at - b.at);
    break;
  }
  if (flashes.length === 0) {
    flashes = Array.from({ length: flashCount }, (_, index) => 6_000 + index * 7_000);
    decoys = flashes.flatMap((flash, index) => [
      { at: flash - 4_500, color: DECOY_COLOURS[index % 3]! },
      { at: flash - 2_000, color: DECOY_COLOURS[(index + 1) % 3]! },
    ]);
  }
  return { type: "reaction", flashes, decoys };
}

export function reactionAverage(times: number[], falseStarts: number, flashCount = times.length): number {
  const count = Math.max(1, flashCount);
  void falseStarts;
  const filled = Array.from({ length: count }, (_, i) => Math.min(REACTION_MISS_MS, Math.max(1, times[i] ?? REACTION_MISS_MS)));
  return Math.round(filled.reduce((a, b) => a + b, 0) / count);
}

export function reactionPoints(avg: number, falseStarts = 0): number {
  const base = avg <= 200 ? 150 : Math.max(0, Math.min(150, Math.round(150 - 0.16 * (avg - 200))));
  return Math.max(0, Math.min(150, base - 8 * falseStarts));
}

function encode(times: (number | null)[], falseStarts: number): string {
  return `${times.map((t) => t ?? REACTION_MISS_MS).join(",")}|${falseStarts}`;
}

function parseAnswer(answer: string | null): { times: number[]; falseStarts: number } {
  const [timesPart = "", falsePart = "0"] = (answer ?? "").split("|");
  const times = timesPart
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
  const falseStarts = Number.parseInt(falsePart, 10);
  return { times, falseStarts: Number.isFinite(falseStarts) ? falseStarts : 0 };
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        The screen stays dark. It flashes gold five to eight times — tap the instant it does.
      </p>
      <div className="flex items-center gap-2">
        <span className="flex h-16 w-20 items-center justify-center rounded-xl border border-border bg-card font-mono text-xs text-muted-foreground">
          Wait…
        </span>
        <span className="flex h-16 w-20 items-center justify-center rounded-xl bg-opponent font-display text-xs font-bold text-primary-foreground">
          Don't tap
        </span>
        <span className="flex h-16 w-20 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
          Gold
        </span>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Teal, red or blue is a trap: tapping it, or tapping a dark screen, is a false start (−8 points). Score: 150 at
        200 ms average or faster, −16 per 100 ms slower; a missed flash counts 1,200 ms.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const flashes = puzzle.type === "reaction" ? puzzle.flashes : [];
  const decoys = puzzle.type === "reaction" ? puzzle.decoys : [];
  const key = `${phaseStartedAt}:${flashes.join(",")}`;
  const [times, setTimes] = useState<(number | null)[]>(() => flashes.map(() => null));
  const [falseStarts, setFalseStarts] = useState(0);
  const [lastShown, setLastShown] = useState<{ text: string; until: number; bad: boolean } | null>(null);
  const [t, setT] = useState(() => serverNow() - phaseStartedAt);
  const submitted = useRef("");
  const lastFalseAt = useRef(-1_000);

  useEffect(() => {
    setTimes(flashes.map(() => null));
    setFalseStarts(0);
    setLastShown(null);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frame-accurate local clock so the flash appears the moment it starts.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      setT(serverNow() - phaseStartedAt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phaseStartedAt]);

  // A gold flash with no tap in 1.5 s records the miss value.
  useEffect(() => {
    const missed = flashes.findIndex((f, i) => times[i] === null && t >= f + REACTION_FLASH_MS);
    if (missed < 0) return;
    setTimes((prev) => {
      if (prev[missed] !== null) return prev;
      const next = [...prev];
      next[missed] = REACTION_MISS_MS;
      return next;
    });
    setLastShown({ text: "Missed", until: t + 900, bad: true });
  }, [t, times, flashes]);

  useEffect(() => {
    if (flashes.length) onDraftAnswer?.(encode(times, falseStarts));
  }, [times, falseStarts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (flashes.length === 0 || locked || submitted.current === key) return;
    if (times.some((v) => v === null)) return;
    submitted.current = key;
    const values = times as number[];
    onSubmit(encode(values, falseStarts), { reactionAvgMs: reactionAverage(values, falseStarts, flashes.length) });
  }, [times, locked, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "reaction") return null;

  const liveIndex = flashes.findIndex((f, i) => times[i] === null && t >= f && t < f + REACTION_FLASH_MS);
  const decoy = decoys.find((d) => t >= d.at && t < d.at + REACTION_DECOY_MS) ?? null;
  const done = times.every((v) => v !== null);

  const handleTap = () => {
    if (locked || done) return;
    const stamp = serverNow() - phaseStartedAt;
    const index = flashes.findIndex((f, i) => times[i] === null && stamp >= f && stamp < f + REACTION_FLASH_MS);
    if (index >= 0) {
      const ms = Math.max(1, Math.round(stamp - flashes[index]!));
      setTimes((prev) => {
        if (prev[index] !== null) return prev;
        const next = [...prev];
        next[index] = ms;
        return next;
      });
      setLastShown({ text: `${ms} ms`, until: stamp + 1_000, bad: false });
      return;
    }
    if (stamp < 0 || stamp - lastFalseAt.current < 250) return;
    lastFalseAt.current = stamp;
    setFalseStarts((n) => n + 1);
    setLastShown({ text: "False start", until: stamp + 900, bad: true });
  };

  const surface =
    liveIndex >= 0
      ? "bg-primary"
      : decoy
        ? decoy.color === "teal"
          ? "bg-opponent"
          : decoy.color === "red"
            ? "bg-destructive"
            : "bg-reaction-blue"
        : "bg-background";
  const showLast = lastShown && t < lastShown.until;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-end font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {falseStarts > 0 && <span className="text-warn">{falseStarts} false</span>}
      </div>
      <button
        type="button"
        aria-label="Reaction area"
        onPointerDown={handleTap}
        className={`flex min-h-64 w-full flex-1 items-center justify-center rounded-2xl border border-border ${surface}`}
      >
        {liveIndex >= 0 ? null : showLast ? (
          <span
            className={`font-mono text-4xl font-bold tabular-nums ${lastShown.bad ? "text-warn" : "text-primary"}`}
          >
            {lastShown.text}
          </span>
        ) : done ? (
          <span className="text-base text-muted-foreground">All flashes done</span>
        ) : decoy ? null : (
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">Wait for gold…</span>
        )}
      </button>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "reaction") return null;
  const { times, falseStarts } = parseAnswer(myAnswer);
  const avg = times.length ? reactionAverage(times, falseStarts, puzzle.flashes.length) : null;

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {times.length === 0 ? (
          <p className="font-display text-2xl font-bold text-warn">No attempts</p>
        ) : (
          times.map((ms, index) => (
            <p key={index} className="font-mono text-xl tabular-nums text-foreground">
              Flash {index + 1} — {ms >= REACTION_MISS_MS ? "missed (1,200 ms)" : `${ms} ms`}
            </p>
          ))
        )}
        <p className="font-mono text-lg text-muted-foreground">
          False starts: {falseStarts}
          {falseStarts > 0 ? ` (−${falseStarts * 8} points)` : ""}
        </p>
      </div>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-5">
        <p className="text-base uppercase tracking-[0.2em] text-muted-foreground">Your average</p>
        <p className="font-mono text-4xl font-bold tabular-nums text-primary">{avg ?? "—"} ms</p>
        {avg !== null && <p className="font-mono text-base text-muted-foreground">{reactionPoints(avg, falseStarts)} points</p>}
      </div>
    </>
  );
}

export const reactionPuzzle: PuzzleDefinition = {
  key: "reaction",
  name: "Reaction Time",
  category: "speed",
  timeLimitMs: REACTION_ROUND_MS,
  generate: buildReaction,
  // Scored from the average reaction time, not from correctness.
  check: () => true,
  revealHeading: "Your reactions",
  IntroExample,
  Stage,
  Reveal,
};
