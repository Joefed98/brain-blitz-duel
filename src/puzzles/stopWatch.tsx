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

/** Marker position (0–1), traversal index and direction (+1 rightwards) at `elapsed`. */
export function markerState(spec: StopWatchSpec, elapsed: number): { pos: number; pass: number; dir: 1 | -1 } {
  const pass = Math.floor(Math.max(0, elapsed) / spec.sweepMs);
  const frac = (Math.max(0, elapsed) % spec.sweepMs) / spec.sweepMs;
  const rightwards = spec.reverse ? pass % 2 === 1 : pass % 2 === 0;
  return { pos: rightwards ? frac : 1 - frac, pass, dir: rightwards ? 1 : -1 };
}

/** The zone of a reversing watch only arms on the second traversal. */
function armed(spec: StopWatchSpec, pass: number): boolean {
  return !spec.reverse || pass >= 1;
}

function isHidden(spec: StopWatchSpec, pos: number): boolean {
  return spec.hidden && pos > HIDE_FROM;
}

export function buildStopWatch(): StopWatchPuzzleData {
  const c1 = randInt(30, 70) / 100;
  let c2 = c1;
  while (Math.abs(c2 - c1) < 0.2) c2 = randInt(15, 85) / 100;
  return {
    type: "stopwatch",
    watches: [
      { centre: c1, half: 0.08, sweepMs: 1_100, hidden: false, reverse: false },
      { centre: c2, half: 0.05, sweepMs: 800, hidden: false, reverse: false },
      { centre: randInt(72, 88) / 100, half: 0.06, sweepMs: 1_000, hidden: true, reverse: false },
      { centre: randInt(20, 80) / 100, half: 0.06, sweepMs: 1_000, hidden: false, reverse: true },
      { centre: randInt(72, 88) / 100, half: 0.05, sweepMs: 600, hidden: true, reverse: false },
    ],
  };
}

export function stopWatchPoints(avg: number): number {
  return 50 + Math.max(0, Math.min(100, Math.round(100 * (1 - avg / STOPWATCH_MISS_MS))));
}

function Bar({
  spec,
  lit,
  marker,
  barRef,
  markerRef,
}: {
  spec: StopWatchSpec;
  lit: boolean;
  marker: number | null;
  barRef?: React.RefObject<HTMLDivElement | null>;
  markerRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div ref={barRef} className="relative h-16 w-full overflow-hidden rounded-2xl border border-border bg-card">
      {spec.hidden && (
        <span
          className="absolute inset-y-0 right-0 border-l border-dashed border-muted-foreground/50 bg-muted/40"
          style={{ width: `${(1 - HIDE_FROM) * 100}%` }}
        />
      )}
      <span
        className={`absolute inset-y-0 ${lit ? "bg-primary/45" : "bg-primary/15"}`}
        style={{ left: `${(spec.centre - spec.half) * 100}%`, width: `${spec.half * 200}%` }}
      />
      <span
        className="absolute inset-y-2 w-[3px] rounded-full bg-primary"
        style={{ left: `${spec.centre * 100}%`, transform: "translateX(-50%)" }}
      />
      {markerRef ? (
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
        Five watches, each one trickier. Tap to stop the marker on the zone's centre line.
      </p>
      <Bar spec={{ centre: 0.62, half: 0.07, sweepMs: 1_100, hidden: false, reverse: false }} lit marker={0.58} />
      <p className="text-center text-xs text-muted-foreground">
        Watches 3 and 5 hide the marker over the shaded end. Watch 4 runs backwards and only counts once its zone
        lights up on the second pass. Score: 50 at 400 ms average error, up to 150 for perfect stops.
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
  const [lit, setLit] = useState(false);
  const submitted = useRef("");
  const barRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLSpanElement | null>(null);

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
    if (now - cursor.startAt >= spec.sweepMs * STOPWATCH_PASSES) record(STOPWATCH_MISS_MS, null);
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
    let wasLit = false;
    const frame = () => {
      const bar = barRef.current;
      const el = markerRef.current;
      const { pos, pass } = markerState(spec, serverNow() - cursor.startAt);
      if (bar && el) {
        el.style.transform = `translate3d(${pos * bar.clientWidth - MARKER_W / 2}px, 0, 0)`;
        el.style.opacity = isHidden(spec, pos) ? "0" : "1";
      }
      const nowLit = armed(spec, pass);
      if (nowLit !== wasLit) {
        wasLit = nowLit;
        setLit(nowLit);
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
    const { pos, pass, dir } = markerState(spec, elapsed);
    if (pass >= STOPWATCH_PASSES) return;
    if (!armed(spec, pass)) return;
    const offset = (pos - spec.centre) * dir * spec.sweepMs;
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
        : spec.reverse && !lit
          ? "Wait for it to light up"
          : "Tap to stop";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Stop the marker"
      onPointerDown={handleTap}
      className="flex flex-1 flex-col items-center justify-center gap-7"
    >
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        Watch {Math.min(cursor.index + 1, watches.length)} / {watches.length}
      </p>
      <Bar
        key={cursor.index}
        spec={spec}
        lit={armed(spec, 0) || lit}
        marker={null}
        barRef={live ? barRef : undefined}
        markerRef={live ? markerRef : undefined}
      />
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
