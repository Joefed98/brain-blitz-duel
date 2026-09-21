import { useEffect, useRef, useState } from "react";

import { serverNow } from "@/lib/duel/clock";
import { randInt } from "@/lib/duel/random";
import {
  STOPWATCH_ATTEMPTS,
  STOPWATCH_MISS_MS,
  STOPWATCH_SLOT_MS,
  stopWatchSweepMs,
  STOPWATCH_TIMEOUT_MS,
  STOPWATCH_ZONE,
  type StopWatchPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

export function stopWatchDurationMs(): number {
  return STOPWATCH_ATTEMPTS * STOPWATCH_SLOT_MS;
}

/** Where the marker sits (0–1) this far into an attempt, at that try's speed. */
export function markerAt(elapsed: number, attempt = 0): number {
  const sweep = stopWatchSweepMs(attempt);
  const cycle = ((elapsed % (sweep * 2)) + sweep * 2) % (sweep * 2);
  const phase = cycle / sweep;
  return phase <= 1 ? phase : 2 - phase;
}

/** Marker width in px — kept here so the transform can centre it exactly. */
const MARKER_W = 6;

function Bar({
  target,
  marker,
  dim = false,
  barRef,
  markerRef,
}: {
  target: number;
  marker: number | null;
  dim?: boolean;
  barRef?: React.RefObject<HTMLDivElement | null> | undefined;
  markerRef?: React.RefObject<HTMLSpanElement | null> | undefined;
}) {
  return (
    <div
      ref={barRef}
      className={`relative h-16 w-full overflow-hidden rounded-2xl border border-border bg-card ${
        dim ? "opacity-60" : ""
      }`}
    >
      <span
        className="absolute inset-y-0 bg-primary/30"
        style={{
          left: `${Math.max(0, (target - STOPWATCH_ZONE) * 100)}%`,
          width: `${STOPWATCH_ZONE * 200}%`,
        }}
      />
      <span
        className="absolute inset-y-2 w-[3px] rounded-full bg-primary"
        style={{ left: `${target * 100}%`, transform: "translateX(-50%)" }}
      />
      {markerRef ? (
        // Driven every frame by requestAnimationFrame — no transition, no stepping.
        <span
          ref={markerRef}
          className="absolute inset-y-0 left-0 rounded-full bg-foreground will-change-transform"
          style={{ width: MARKER_W }}
        />
      ) : (
        marker !== null && (
          <span
            className="absolute inset-y-0 rounded-full bg-foreground"
            style={{ width: MARKER_W, left: `${marker * 100}%`, transform: "translateX(-50%)" }}
          />
        )
      )}
    </div>
  );
}

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Stop the marker inside the gold zone. Three tries, closest average wins.
      </p>
      <Bar target={0.62} marker={0.56} />
      <p className="text-xs text-muted-foreground">Tap once per try.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const targets = puzzle.type === "stopwatch" ? puzzle.targets : [];
  const key = targets.join(",");
  const [distances, setDistances] = useState<(number | null)[]>(() =>
    Array.from({ length: STOPWATCH_ATTEMPTS }, () => null),
  );
  const submitted = useRef("");
  const barRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setDistances(Array.from({ length: STOPWATCH_ATTEMPTS }, () => null));
  }, [key]);

  const elapsedTotal = Math.max(0, now - phaseStartedAt);
  const index = Math.min(targets.length, Math.floor(elapsedTotal / STOPWATCH_SLOT_MS));
  const inSlot = elapsedTotal - index * STOPWATCH_SLOT_MS;
  const record = index < targets.length ? distances[index] : null;
  const live = index < targets.length && record === null && inSlot < STOPWATCH_TIMEOUT_MS;

  // A try that is never tapped records the miss penalty when its window closes.
  useEffect(() => {
    if (index >= targets.length || record !== null) return;
    if (inSlot < STOPWATCH_TIMEOUT_MS) return;
    setDistances((prev) => {
      if (prev[index] !== null) return prev;
      const next = [...prev];
      next[index] = STOPWATCH_MISS_MS;
      return next;
    });
  }, [inSlot, index, record, targets.length]);

  // Submit the average once every slot has run.
  useEffect(() => {
    if (targets.length === 0 || locked || submitted.current === key) return;
    if (distances.some((d) => d === null)) return;
    if (elapsedTotal < stopWatchDurationMs()) return;
    submitted.current = key;
    const values = distances as number[];
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    onSubmit(values.join(","), { reactionAvgMs: avg });
  }, [distances, elapsedTotal, locked, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = puzzle.type === "stopwatch" ? (puzzle.targets[index] ?? 0.5) : 0.5;

  // The marker glides: every frame we work its position out from the shared
  // attempt start time and write it straight to a transform.
  useEffect(() => {
    if (!live) return;
    const attemptStart = phaseStartedAt + index * STOPWATCH_SLOT_MS;
    let raf = 0;
    const frame = () => {
      const bar = barRef.current;
      const el = markerRef.current;
      if (bar && el) {
        const width = bar.clientWidth;
        const pos = markerAt(Math.max(0, serverNow() - attemptStart), index);
        el.style.transform = `translate3d(${pos * width - MARKER_W / 2}px, 0, 0)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, index, phaseStartedAt]);

  if (puzzle.type !== "stopwatch") return null;

  const handleTap = () => {
    if (locked || !live) return;
    const at = Math.max(0, serverNow() - phaseStartedAt - index * STOPWATCH_SLOT_MS);
    if (at >= STOPWATCH_TIMEOUT_MS) return;
    const distance = Math.round(Math.abs(markerAt(at, index) - target) * stopWatchSweepMs(index));
    setDistances((prev) => {
      if (prev[index] !== null) return prev;
      const next = [...prev];
      next[index] = Math.min(STOPWATCH_MISS_MS, distance);
      return next;
    });
  };

  const done = index >= puzzle.targets.length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7">
      <div className="flex gap-2">
        {puzzle.targets.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              distances[i] !== null ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      <Bar
        key={index}
        target={target}
        marker={null}
        dim={done}
        barRef={live ? barRef : undefined}
        markerRef={live ? markerRef : undefined}
      />

      <button
        type="button"
        aria-label="Stop the marker"
        onClick={handleTap}
        disabled={locked || !live}
        className="tap-target flex h-32 w-full items-center justify-center rounded-2xl border border-border bg-muted/20 font-display text-2xl font-bold uppercase tracking-wide disabled:opacity-50"
      >
        {done ? (
          <span className="text-sm font-normal normal-case text-muted-foreground">
            All three done
          </span>
        ) : record !== null ? (
          <span className="font-mono text-3xl tabular-nums text-primary">
            {record === STOPWATCH_MISS_MS && inSlot >= STOPWATCH_TIMEOUT_MS
              ? "missed"
              : `${record} ms off`}
          </span>
        ) : (
          "Stop"
        )}
      </button>

      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Try {Math.min(index + 1, puzzle.targets.length)} of {puzzle.targets.length}
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myReactionAvgMs }: PuzzleRevealProps) {
  if (puzzle.type !== "stopwatch") return null;
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
              Try {index + 1} — {ms} ms off
            </p>
          ))
        )}
      </div>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your average</p>
        <p className="font-mono text-4xl font-bold tabular-nums text-primary">
          {myReactionAvgMs ?? "—"} ms
        </p>
      </div>
    </>
  );
}

export function buildStopWatch(): StopWatchPuzzleData {
  return {
    type: "stopwatch",
    targets: Array.from({ length: STOPWATCH_ATTEMPTS }, () => randInt(18, 82) / 100),
  };
}

export const stopWatchPuzzle: PuzzleDefinition = {
  key: "stopwatch",
  name: "Stop Watch",
  category: "speed",
  timeLimitMs: 30_000,
  generate: buildStopWatch,
  // Scored from the average distance, not from correctness.
  check: () => true,
  durationMs: () => stopWatchDurationMs() + 1_500,
  showTimer: false,
  revealHeading: "Your stops",
  IntroExample,
  Stage,
  Reveal,
};
