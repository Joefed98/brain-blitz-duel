import { useEffect, useRef, useState } from "react";

import { serverNow } from "@/lib/duel/clock";
import { randInt } from "@/lib/duel/random";
import {
  STOPWATCH_GAP_MS,
  STOPWATCH_MISS_MS,
  STOPWATCH_PASSES,
  STOPWATCH_ROUND_MS,
  type StopWatchPuzzleData,
  type StopWatchSpec,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** First watch starts this long after the round opens. */
const LEAD_IN_MS = 800;
const MARKER_W = 6;
const HIDE_FROM = 2 / 3;

/** Marker position, traversal index, direction and current traversal duration. */
export function markerState(
  spec: StopWatchSpec,
  elapsed: number,
): { pos: number; pass: number; dir: 1 | -1; sweepMs: number } {
  const durations = spec.passSweepMs ?? Array.from({ length: STOPWATCH_PASSES }, () => spec.sweepMs);
  let remaining = Math.max(0, elapsed);
  let pass = 0;
  while (pass < STOPWATCH_PASSES && remaining >= (durations[pass] ?? spec.sweepMs)) {
    remaining -= durations[pass] ?? spec.sweepMs;
    pass += 1;
  }
  const sweepMs = durations[Math.min(pass, STOPWATCH_PASSES - 1)] ?? spec.sweepMs;
  const frac = pass >= STOPWATCH_PASSES ? 1 : Math.min(1, remaining / sweepMs);
  const forwards = spec.reverse ? pass % 2 === 1 : pass % 2 === 0;
  return { pos: forwards ? frac : 1 - frac, pass, dir: forwards ? 1 : -1, sweepMs };
}

export function targetCentre(spec: StopWatchSpec, elapsed: number): number {
  if (!spec.moving) return spec.centre;
  const angle = 2 * Math.PI * (elapsed / spec.moving.cycleMs + spec.moving.phase);
  return spec.centre + Math.sin(angle) * spec.moving.amplitude;
}

function isHidden(spec: StopWatchSpec, pos: number): boolean {
  return spec.hidden && pos > HIDE_FROM;
}

export function buildStopWatch(): StopWatchPuzzleData {
  const c1 = randInt(30, 70) / 100;
  let c2 = c1;
  while (Math.abs(c2 - c1) < 0.2) c2 = randInt(15, 85) / 100;
  const movingAmplitude = Math.min(randInt(12, 20) / 100, c2 - 0.07, 0.93 - c2);
  const verticalCentre = randInt(68, 78) / 100;
  const verticalAmplitude = Math.min(randInt(8, 14) / 100, verticalCentre - 0.56, 0.94 - verticalCentre);
  return {
    type: "stopwatch",
    watches: [
      { centre: c1, half: 0.08, sweepMs: 1_100, hidden: false, reverse: false },
      {
        centre: c2,
        half: 0.05,
        sweepMs: 800,
        hidden: false,
        reverse: false,
        moving: { amplitude: movingAmplitude, cycleMs: 2_400, phase: randInt(0, 99) / 100 },
      },
      { centre: randInt(72, 88) / 100, half: 0.06, sweepMs: 1_000, hidden: true, reverse: false },
      {
        centre: verticalCentre,
        half: 0.06,
        sweepMs: 1_000,
        hidden: false,
        reverse: false,
        moving: { amplitude: verticalAmplitude, cycleMs: 2_000, phase: randInt(0, 99) / 100 },
        vertical: true,
        passSweepMs: [1_000, 700, 500],
      },
      { centre: randInt(72, 88) / 100, half: 0.05, sweepMs: 600, hidden: true, reverse: false },
    ],
  };
}

export function stopWatchPoints(avg: number): number {
  return 50 + Math.max(0, Math.min(100, Math.round(100 * (1 - avg / STOPWATCH_MISS_MS))));
}

function Bar({
  spec,
  marker,
  barRef,
  markerRef,
  targetRef,
  passesLeft,
}: {
  spec: StopWatchSpec;
  marker: number | null;
  barRef?: React.RefObject<HTMLDivElement | null> | undefined;
  markerRef?: React.RefObject<HTMLSpanElement | null> | undefined;
  targetRef?: React.RefObject<HTMLSpanElement | null> | undefined;
  passesLeft: number;
}) {
  const vertical = spec.vertical === true;
  return (
    <div
      ref={barRef}
      className={`relative overflow-hidden rounded-2xl border border-border bg-card ${vertical ? "h-full min-h-72 w-1/2" : "h-16 w-full"}`}
    >
      {spec.hidden && !vertical && (
        <span
          className="absolute inset-y-0 right-0 border-l border-dashed border-muted-foreground/50 bg-muted/40"
          style={{ width: `${(1 - HIDE_FROM) * 100}%` }}
        />
      )}
      <span
        ref={targetRef}
        className={`absolute ${vertical ? "inset-x-0" : "inset-y-0"} bg-primary/45`}
        style={
          vertical
            ? { bottom: `${(spec.centre - spec.half) * 100}%`, height: `${spec.half * 200}%` }
            : { left: `${(spec.centre - spec.half) * 100}%`, width: `${spec.half * 200}%` }
        }
      >
        <span
          className={`absolute rounded-full bg-primary ${vertical ? "inset-x-2 top-1/2 h-[3px] -translate-y-1/2" : "inset-y-2 left-1/2 w-[3px] -translate-x-1/2"}`}
        />
      </span>
      {markerRef ? (
        <span
          ref={markerRef}
          className={`absolute rounded-full bg-foreground will-change-transform ${vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0"}`}
          style={vertical ? { height: MARKER_W } : { width: MARKER_W }}
        />
      ) : (
        marker !== null && (
          <span
            className={`absolute rounded-full bg-foreground ${vertical ? "inset-x-0" : "inset-y-0"}`}
            style={
              vertical
                ? { height: MARKER_W, bottom: `${marker * 100}%`, transform: "translateY(50%)" }
                : { width: MARKER_W, left: `${marker * 100}%`, transform: "translateX(-50%)" }
            }
          />
        )
      )}
      <span
        aria-label={`${passesLeft} passes left`}
        className={`absolute right-2 top-2 z-10 font-mono text-sm font-bold tabular-nums ${passesLeft === 1 ? "text-warn" : "text-foreground"}`}
      >
        {passesLeft}
      </span>
    </div>
  );
}

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Five watches, each one trickier. Tap to stop the marker on the zone's centre line.
      </p>
      <Bar spec={{ centre: 0.62, half: 0.07, sweepMs: 1_100, hidden: false, reverse: false }} marker={0.58} passesLeft={3} />
      <p className="text-center text-xs text-muted-foreground">
        Some targets move — stop when the marker and the target line up. Watches 3 and 5 hide the marker over the
        shaded end, and Watch 4 is vertical and accelerates. Score: 50 at 400 ms average error, up to 150 for perfect
        stops.
      </p>
    </div>
  );
}

type Cursor = { index: number; startAt: number; result: number | null; signed: number | null; shownUntil: number };

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const watches = puzzle.type === "stopwatch" ? (puzzle.watches ?? []) : [];
  const key = `${phaseStartedAt}:${watches.map((w) => w.centre).join(",")}`;
  const [errors, setErrors] = useState<number[]>([]);
  const [cursor, setCursor] = useState<Cursor>({
    index: 0,
    startAt: phaseStartedAt + LEAD_IN_MS,
    result: null,
    signed: null,
    shownUntil: 0,
  });
  const submitted = useRef("");
  const barRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const targetRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setErrors([]);
    setCursor({ index: 0, startAt: phaseStartedAt + LEAD_IN_MS, result: null, signed: null, shownUntil: 0 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const spec = watches[cursor.index];
  const done = errors.length >= watches.length && watches.length > 0;
  const live = !!spec && cursor.result === null && !done;

  const record = (error: number, signed: number | null) => {
    const at = serverNow();
    setErrors((prev) => (prev.length > cursor.index ? prev : [...prev, error]));
    setCursor((c) => ({ ...c, result: error, signed, shownUntil: at + STOPWATCH_GAP_MS }));
  };

  // Advance after the result has shown; record a miss after three passes.
  useEffect(() => {
    if (!spec || done) return;
    if (cursor.result !== null) {
      if (now >= cursor.shownUntil && cursor.index + 1 < watches.length) {
        setCursor({ index: cursor.index + 1, startAt: now, result: null, signed: null, shownUntil: 0 });
      }
      return;
    }
    if (markerState(spec, now - cursor.startAt).pass >= STOPWATCH_PASSES) record(STOPWATCH_MISS_MS, null);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (watches.length) onDraftAnswer?.(errors.join(","));
  }, [errors]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!done || locked || submitted.current === key) return;
    if (now < cursor.shownUntil) return;
    submitted.current = key;
    const avg = Math.round(errors.reduce((a, b) => a + b, 0) / errors.length);
    onSubmit(errors.join(","), { reactionAvgMs: avg });
  }, [done, now, locked, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // The marker glides: positioned every frame from the watch's start time.
  useEffect(() => {
    if (!live || !spec) return;
    let raf = 0;
    const frame = () => {
      const bar = barRef.current;
      const el = markerRef.current;
      const target = targetRef.current;
      const elapsed = serverNow() - cursor.startAt;
      const { pos } = markerState(spec, elapsed);
      if (bar && el) {
        el.style.transform = spec.vertical
          ? `translate3d(0, ${-(pos * bar.clientHeight - MARKER_W / 2)}px, 0)`
          : `translate3d(${pos * bar.clientWidth - MARKER_W / 2}px, 0, 0)`;
        el.style.opacity = isHidden(spec, pos) ? "0" : "1";
      }
      if (bar && target && spec.moving) {
        const centre = targetCentre(spec, elapsed);
        if (spec.vertical) target.style.bottom = `${(centre - spec.half) * 100}%`;
        else target.style.left = `${(centre - spec.half) * 100}%`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, cursor.index, cursor.startAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "stopwatch" || !spec) return null;

  const handleTap = () => {
    if (locked || !live) return;
    const elapsed = serverNow() - cursor.startAt;
    if (elapsed < 0) return;
    const { pos, pass, dir, sweepMs } = markerState(spec, elapsed);
    if (pass >= STOPWATCH_PASSES) return;
    const centre = targetCentre(spec, elapsed);
    const offset = (pos - centre) * dir * sweepMs;
    const error = Math.min(STOPWATCH_MISS_MS, Math.round(Math.abs(offset)));
    record(error, Math.round(offset));
  };

  const waiting = now < cursor.startAt;
  const label =
    cursor.result !== null
      ? cursor.signed === null
        ? "Missed"
        : `${cursor.signed >= 0 ? "+" : "−"}${Math.abs(cursor.signed)} ms`
      : waiting
        ? "Get ready"
        : "Tap to stop";
  const currentPass = live ? markerState(spec, Math.max(0, now - cursor.startAt)).pass : STOPWATCH_PASSES - 1;
  const passesLeft = Math.max(1, STOPWATCH_PASSES - currentPass);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Stop the marker"
      onPointerDown={handleTap}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7"
    >
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        Watch {Math.min(cursor.index + 1, watches.length)} / {watches.length}
      </p>
      <div className={`flex min-h-0 w-full ${spec.vertical ? "flex-1 justify-end" : ""}`}>
        <Bar
          key={cursor.index}
          spec={spec}
          marker={null}
          barRef={live ? barRef : undefined}
          markerRef={live ? markerRef : undefined}
          targetRef={live && spec.moving ? targetRef : undefined}
          passesLeft={passesLeft}
        />
      </div>
      <p
        className={`font-mono text-3xl font-bold tabular-nums ${
          cursor.result !== null ? (cursor.signed === null ? "text-warn" : "text-primary") : "text-muted-foreground"
        }`}
      >
        {done && now >= cursor.shownUntil ? "All five done" : label}
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "stopwatch") return null;
  const parsed = (myAnswer ?? "")
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
  const errors = Array.from({ length: puzzle.watches?.length ?? 5 }, (_, i) => parsed[i] ?? STOPWATCH_MISS_MS);
  const avg = Math.round(errors.reduce((a, b) => a + b, 0) / errors.length);

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {errors.map((ms, index) => (
          <p key={index} className="font-mono text-xl tabular-nums text-foreground">
            Watch {index + 1} — {ms >= STOPWATCH_MISS_MS ? "missed (400 ms)" : `${ms} ms off`}
          </p>
        ))}
      </div>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-5">
        <p className="text-base uppercase tracking-[0.2em] text-muted-foreground">Average error</p>
        <p className="font-mono text-4xl font-bold tabular-nums text-primary">{avg} ms</p>
        <p className="font-mono text-base text-muted-foreground">{stopWatchPoints(avg)} points</p>
      </div>
    </>
  );
}

export const stopWatchPuzzle: PuzzleDefinition = {
  key: "stopwatch",
  name: "Stop Watch",
  category: "speed",
  timeLimitMs: STOPWATCH_ROUND_MS,
  generate: buildStopWatch,
  // Scored from the average distance, not from correctness.
  check: () => true,
  revealHeading: "Your stops",
  IntroExample,
  Stage,
  Reveal,
};
