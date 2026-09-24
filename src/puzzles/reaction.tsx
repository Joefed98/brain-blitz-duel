import { useEffect, useRef, useState } from "react";

import { serverNow } from "@/lib/duel/clock";
import { random } from "@/lib/duel/random";
import {
  REACTION_ATTEMPTS,
  REACTION_FEEDBACK_MS,
  REACTION_PENALTY_MS,
  REACTION_RESPONSE_MS,
  type ReactionPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const DELAY_BANDS = [
  { weight: 0.3, min: 600, max: 1_200 },
  { weight: 0.4, min: 1_200, max: 3_000 },
  { weight: 0.3, min: 3_000, max: 5_500 },
] as const;

function drawDelay(): number {
  const roll = random();
  const band =
    roll < DELAY_BANDS[0].weight ? DELAY_BANDS[0] : roll < 0.7 ? DELAY_BANDS[1] : DELAY_BANDS[2];
  return Math.round(band.min + random() * (band.max - band.min));
}

export function buildReactionDelays(): number[] {
  for (let attempt = 0; attempt < 1_000; attempt++) {
    const delays = Array.from({ length: REACTION_ATTEMPTS }, drawDelay);
    if (
      delays.every((delay, index) =>
        delays.slice(0, index).every((other) => Math.abs(delay - other) >= 400),
      )
    ) {
      return delays;
    }
  }
  return [900, 2_100, 4_300];
}

/** Each attempt occupies a fixed-length slot so both phones stay in step. */
function slotLength(delay: number): number {
  return delay + REACTION_RESPONSE_MS + REACTION_FEEDBACK_MS;
}

export function reactionDurationMs(delays: number[]): number {
  return delays.reduce((sum, d) => sum + slotLength(d), 0);
}

function attemptStart(delays: number[], index: number): number {
  return delays.slice(0, index).reduce((sum, d) => sum + slotLength(d), 0);
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        When the screen turns gold, tap as fast as you can. Three tries, best average wins.
      </p>
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-24 items-center justify-center rounded-xl border border-border bg-card font-mono text-xs text-muted-foreground">
          Wait…
        </span>
        <span className="font-mono text-lg text-muted-foreground">→</span>
        <span className="flex h-16 w-24 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
          TAP!
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Tap too early and that try counts as 1,000 ms. Score: 50 at 650 ms average, up to 150 at 50 ms.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const delays = puzzle.type === "reaction" ? puzzle.delays : [];
  const key = delays.join(",");
  const [times, setTimes] = useState<(number | null)[]>(() =>
    Array.from({ length: REACTION_ATTEMPTS }, () => null),
  );
  const [early, setEarly] = useState<boolean[]>(() =>
    Array.from({ length: REACTION_ATTEMPTS }, () => false),
  );
  const submitted = useRef("");

  useEffect(() => {
    setTimes(Array.from({ length: REACTION_ATTEMPTS }, () => null));
    setEarly(Array.from({ length: REACTION_ATTEMPTS }, () => false));
  }, [key]);

  // Which attempt slot are we in right now?
  let index = delays.length;
  for (let i = 0; i < delays.length; i++) {
    if (now < phaseStartedAt + attemptStart(delays, i) + slotLength(delays[i]!)) {
      index = i;
      break;
    }
  }

  const flashAt =
    index < delays.length ? phaseStartedAt + attemptStart(delays, index) + delays[index]! : null;
  const record = index < delays.length ? times[index] : null;

  // A missed attempt is recorded as the penalty once its window closes.
  useEffect(() => {
    if (flashAt === null || record !== null) return;
    if (now < flashAt + REACTION_RESPONSE_MS) return;
    setTimes((prev) => {
      if (prev[index] !== null) return prev;
      const next = [...prev];
      next[index] = REACTION_PENALTY_MS;
      return next;
    });
  }, [now, flashAt, record, index]);

  // Submit the average once every slot has finished.
  useEffect(() => {
    if (delays.length === 0 || locked || submitted.current === key) return;
    if (times.some((t) => t === null)) return;
    if (now < phaseStartedAt + reactionDurationMs(delays)) return;
    submitted.current = key;
    const values = times as number[];
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    onSubmit(values.join(","), { reactionAvgMs: avg });
  }, [times, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "reaction") return null;

  const handleTap = () => {
    if (locked || flashAt === null || record !== null) return;
    const stamp = serverNow();
    const tooEarly = stamp < flashAt;
    setTimes((prev) => {
      if (prev[index] !== null) return prev;
      const next = [...prev];
      next[index] = tooEarly ? REACTION_PENALTY_MS : Math.max(1, Math.round(stamp - flashAt));
      return next;
    });
    if (tooEarly) {
      setEarly((prev) => {
        const next = [...prev];
        next[index] = true;
        return next;
      });
    }
  };

  const waiting = flashAt !== null && record === null && now < flashAt;
  const live = flashAt !== null && record === null && now >= flashAt;
  const done = index >= delays.length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="flex gap-2">
        {delays.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${times[i] !== null ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Reaction area"
        onClick={handleTap}
        className={`flex h-64 w-full items-center justify-center rounded-2xl border transition-colors ${
          live ? "border-primary bg-primary" : "border-border bg-muted/20"
        }`}
      >
        {done ? (
          <span className="text-sm text-muted-foreground">All three done</span>
        ) : record !== null ? (
          early[index] ? (
            <span className="font-display text-2xl font-bold text-warn">Too early!</span>
          ) : (
            <span className="font-mono text-4xl font-bold tabular-nums text-primary">
              {record} ms
            </span>
          )
        ) : live ? (
          <span className="font-display text-4xl font-bold text-primary-foreground">TAP!</span>
        ) : waiting ? (
          <span className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
            Wait for gold…
          </span>
        ) : null}
      </button>

      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Try {Math.min(index + 1, delays.length)} of {delays.length}
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myReactionAvgMs }: PuzzleRevealProps) {
  if (puzzle.type !== "reaction") return null;
  const attempts = (myAnswer ?? "")
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {attempts.length === 0 ? (
          <p className="font-display text-2xl font-bold text-warn">No attempts</p>
        ) : (
          attempts.map((ms, index) => (
            <p key={index} className="font-mono text-xl tabular-nums text-foreground">
              Try {index + 1} — {ms} ms
            </p>
          ))
        )}
      </div>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your average</p>
        <p className="font-mono text-4xl font-bold tabular-nums text-primary">
          {myReactionAvgMs ?? "—"} ms
        </p>
        {myReactionAvgMs !== undefined && myReactionAvgMs !== null && (
          <p className="font-mono text-sm text-muted-foreground">
            50 + {Math.max(0, Math.min(100, Math.round((650 - myReactionAvgMs) / 6)))} = {50 + Math.max(0, Math.min(100, Math.round((650 - myReactionAvgMs) / 6)))} points
          </p>
        )}
      </div>
    </>
  );
}

export const reactionPuzzle: PuzzleDefinition = {
  key: "reaction",
  name: "Reaction Time",
  category: "speed",
  timeLimitMs: 30_000,
  generate: () =>
    ({
      type: "reaction",
      delays: buildReactionDelays(),
    }) satisfies ReactionPuzzleData,
  // Scored from the average reaction time, not from correctness.
  check: () => true,
  durationMs: (puzzle) =>
    puzzle.type === "reaction" ? reactionDurationMs(puzzle.delays) + 1_500 : 0,
  showTimer: false,
  revealHeading: "Your reactions",
  IntroExample,
  Stage,
  Reveal,
};
