import { gameDisplayName } from "@/lib/duel/gameNames";
import { STOPWATCH_REV4_KNEE_MS, STOPWATCH_REV4_ZERO_MS } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef, useState } from "react";

import { serverNow } from "@/lib/duel/clock";
import { randInt } from "@/lib/duel/random";
import { markerState, targetCentre } from "@/lib/duel/stopWatch";
import {
  TAP_LOG_MAX,
  TAP_LOG_PREFIX,
  TAP_REV_ONE_CURVE,
  tapRevOf,
  decodeTapTimes,
  encodeTapTimes,
  replayBangOn,
  usesTapLog,
} from "@/lib/duel/tapLog";
import {
  STOPWATCH_GAP_MS,
  STOPWATCH_LEAD_IN_MS,
  STOPWATCH_MISS_MS,
  STOPWATCH_ROUND_MS,
  type StopWatchPuzzleData,
  type StopWatchSpec,
} from "@/lib/duel/types";

import { registerFxPreview } from "@/components/puzzles/speedFx";
import { useGoalProgress } from "@/components/duel/GameFrame";
import { wrongMoveFlash } from "@/lib/fx/gameToolkit";
import { playSound } from "@/lib/sound";
import { bangOnEarnsGoldFaces, fireBangOnGoldFaces, localBangOnScore } from "@/components/puzzles/stopWatchFx";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

export { markerState, targetCentre } from "@/lib/duel/stopWatch";

/** First watch starts this long after the round opens. */
const LEAD_IN_MS = STOPWATCH_LEAD_IN_MS;
const MARKER_W = 6;
const HIDE_FROM = 2 / 3;

function isHidden(spec: StopWatchSpec, pos: number): boolean {
  return (spec.hidden && pos > HIDE_FROM) || (spec.blind?.some(([from, to]) => pos >= from && pos <= to) ?? false);
}

/** tapRev 3: blind-spot width by watch (watch 2 small, growing gently to watch 10). */
const BLIND_WIDTH = [0, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13] as const;
/** tapRev 3: these watches sweep about 40 % slower (longer sweeps). */
const LONG_SWEEPS = new Set([1, 3, 6]);
/** tapRev 3: these watches run corner to corner. */
const DIAGONAL_WATCHES = new Set([5, 8]);

/** Blind spots for one watch: clear of the target band (and of the hidden final third). */
function blindSpots(index: number, centre: number, half: number, reach: number, hidden: boolean): [number, number][] {
  const width = BLIND_WIDTH[index] ?? 0;
  if (width <= 0) return [];
  const count = index >= 5 ? 2 : 1;
  const lo = centre - half - reach - 0.04;
  const hi = centre + half + reach + 0.04;
  const top = hidden ? HIDE_FROM : 0.94;
  const spots: [number, number][] = [];
  for (let attempt = 0; attempt < 200 && spots.length < count; attempt++) {
    const from = randInt(6, Math.floor((top - width) * 100)) / 100;
    const to = Math.round((from + width) * 100) / 100;
    if (to > lo && from < hi) continue;
    if (spots.some(([a, b]) => to > a - 0.06 && from < b + 0.06)) continue;
    spots.push([from, to]);
  }
  return spots.sort((a, b) => a[0] - b[0]);
}

export function buildStopWatch(): StopWatchPuzzleData {
  return {
    type: "stopwatch",
    watches: Array.from({ length: 10 }, (_, index) => {
      const centre = randInt(index < 3 ? 25 : 60, index < 3 ? 75 : 88) / 100;
      const moving = index === 2 || index === 5 || index === 8;
      const vertical = index === 4 || index === 7;
      const accelerating = index >= 6;
      const base = Math.max(560, 1_180 - index * 55);
      const sweepMs = LONG_SWEEPS.has(index) ? Math.round(base * 1.4) : base;
      const half = Math.max(0.035, 0.085 - index * 0.005);
      const hidden = index >= 3 && index % 2 === 1;
      const spec: StopWatchSpec = {
        centre,
        half,
        sweepMs,
        hidden,
        wrap: index >= 7,
        passes: index + 2,
      };
      if (vertical) spec.vertical = true;
      if (DIAGONAL_WATCHES.has(index)) spec.diagonal = true;
      if (moving) spec.moving = { amplitude: 0.1, cycleMs: 2_200 - index * 70, phase: randInt(0, 99) / 100 };
      if (accelerating) spec.passSweepMs = Array.from({ length: index + 2 }, (_, pass) => Math.max(420, sweepMs - pass * 55));
      const blind = blindSpots(index, centre, half, moving ? 0.1 : 0, hidden);
      if (blind.length) spec.blind = blind;
      return spec;
    }),
    tapRev: TAP_REV_ONE_CURVE,
  };
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
  const diagonal = !vertical && spec.diagonal === true;
  const face = (
    <div
      ref={barRef}
      data-bangon-face=""
      data-vertical={vertical ? "" : undefined}
      data-diagonal={diagonal ? "" : undefined}
      className={`bangon-face relative overflow-hidden rounded-2xl border border-border bg-card ${vertical ? "h-full min-h-72 w-1/2" : diagonal ? "bangon-face-diagonal" : "h-20 w-full"}`}
    >
      <span aria-hidden="true" className="bangon-ticks" />
      {spec.hidden && !vertical && (
        <span
          className="absolute inset-y-0 right-0 border-l border-dashed border-muted-foreground/50 bg-muted/40"
          style={{ width: `${(1 - HIDE_FROM) * 100}%` }}
        />
      )}
      <span
        ref={targetRef}
        className={`bangon-target absolute ${vertical ? "inset-x-0" : "inset-y-0"} bg-primary/45`}
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
      {spec.blind?.map(([from, to]) => (
        <span
          key={from}
          aria-hidden="true"
          data-bangon-blind=""
          className={`bangon-blind absolute ${vertical ? "inset-x-0" : "inset-y-0"}`}
          style={vertical ? { bottom: `${from * 100}%`, height: `${(to - from) * 100}%` } : { left: `${from * 100}%`, width: `${(to - from) * 100}%` }}
        />
      ))}
      {markerRef ? (
        <span
          ref={markerRef}
          className={`bangon-marker absolute rounded-full bg-foreground will-change-transform ${vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0"}`}
          style={vertical ? { height: MARKER_W } : { width: MARKER_W }}
        />
      ) : (
        marker !== null && (
          <span
            className={`bangon-marker absolute rounded-full bg-foreground ${vertical ? "inset-x-0" : "inset-y-0"}`}
            style={
              vertical
                ? { height: MARKER_W, bottom: `${marker * 100}%`, transform: "translateY(50%)" }
                : { width: MARKER_W, left: `${marker * 100}%`, transform: "translateX(-50%)" }
            }
          />
        )
      )}
      <span aria-hidden="true" className="bangon-crystal" />
      <span
        aria-label={`${passesLeft} passes left`}
        className={`absolute right-2 top-2 z-10 font-mono text-sm font-bold tabular-nums ${passesLeft === 1 ? "text-warn" : "text-foreground"}`}
      >
        {passesLeft}
      </span>
    </div>
  );
  // A diagonal watch is the same bar turned corner to corner inside a square.
  return diagonal ? <div className="bangon-diagonal relative mx-auto aspect-square w-full">{face}</div> : face;
}

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Ten watches, each one trickier. Tap to stop the marker on the zone's centre line.
      </p>
      <Bar spec={{ centre: 0.62, half: 0.07, sweepMs: 1_100, hidden: false, wrap: false, passes: 2, blind: [[0.26, 0.34]] }} marker={0.58} passesLeft={2} />
      <p className="text-center text-xs text-muted-foreground">
        From Watch 2, black blind spots hide the marker (wider later on); some sweeps are slower, two watches run corner
        to corner, and targets move, hide, turn vertical or accelerate. The counter starts at 2 on Watch 1 and reaches 11
        on Watch 10; watches 8-10 wrap. Score: 150 at 5 ms average error or closer, 137 at 20 ms, 101 at 200 ms, then
        falling faster to 0 at 325 ms; a missed watch counts 500 ms.
      </p>
    </div>
  );
}

type Cursor = { index: number; startAt: number; result: number | null; signed: number | null; shownUntil: number };

/** Rounds stored before tap logs (no `tapRev`): the phone's own distance summary. */
function LegacyStage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
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
    if (markerState(spec, now - cursor.startAt).pass >= spec.passes) record(STOPWATCH_MISS_MS, null);
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

  const { barRef, markerRef, targetRef } = useMarkerGlide(live, spec, cursor.startAt, cursor.index);

  if (puzzle.type !== "stopwatch" || !spec) return null;

  const handleTap = () => {
    if (locked || !live) return;
    const elapsed = serverNow() - cursor.startAt;
    if (elapsed < 0) return;
    const { pos, pass, dir, sweepMs } = markerState(spec, elapsed);
    if (pass >= spec.passes) return;
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
  const currentPass = live ? markerState(spec, Math.max(0, now - cursor.startAt)).pass : spec.passes;
  const passesLeft = Math.max(0, spec.passes - currentPass);

  return (
    <WatchView
      index={cursor.index}
      count={watches.length}
      spec={spec}
      live={live}
      refs={{ barRef, markerRef, targetRef }}
      passesLeft={passesLeft}
      result={cursor.result === null ? "none" : cursor.signed === null ? "missed" : "stopped"}
      status={done && now >= cursor.shownUntil ? "All ten done" : label}
      errors={errors}
      onTap={handleTap}
      runKey={key}
      fxScore={done && now >= cursor.shownUntil ? localBangOnScore(errors, watches.length) : null}
    />
  );
}

function useMarkerGlide(live: boolean, spec: StopWatchSpec | undefined, startAt: number, index: number) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const targetRef = useRef<HTMLSpanElement | null>(null);
  // The marker glides: positioned every frame from the watch's start time.
  useEffect(() => {
    if (!live || !spec) return;
    let raf = 0;
    const frame = () => {
      const bar = barRef.current;
      const el = markerRef.current;
      const target = targetRef.current;
      const elapsed = serverNow() - startAt;
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
  }, [live, index, startAt]); // eslint-disable-line react-hooks/exhaustive-deps
  return { barRef, markerRef, targetRef };
}

function WatchView({
  index,
  count,
  spec,
  live,
  refs,
  passesLeft,
  result,
  status,
  errors,
  onTap,
  runKey = "",
  fxScore = null,
}: {
  index: number;
  count: number;
  spec: StopWatchSpec;
  live: boolean;
  refs: ReturnType<typeof useMarkerGlide>;
  passesLeft: number;
  /** The result on show for the current watch, if any. */
  result: "none" | "missed" | "stopped";
  status: string;
  errors: number[];
  onTap: () => void;
  /** Identifies the run, so the end-of-run effect plays once per run. */
  runKey?: string;
  /** The phone's local score once all ten are done (read-only), else null. */
  fxScore?: number | null;
}) {
  const showing = result !== "none";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const flashed = useRef("");
  // End of run: the watch faces flash gold in turn when the local score reaches the threshold.
  useEffect(() => {
    if (fxScore === null || !bangOnEarnsGoldFaces(fxScore) || flashed.current === runKey) return;
    flashed.current = runKey;
    fireBangOnGoldFaces(rootRef.current);
  }, [fxScore, runKey]);
  useEffect(() => registerFxPreview("stopwatch", () => fireBangOnGoldFaces(rootRef.current)), []);
  // A missed watch plays the shared wrong sound as its "Missed" label shows (display only), once per
  // watch, never for one already missed when the stage mounts (a reload).
  const missedAt = useRef(result === "missed" ? `${runKey}:${index}` : "");
  useEffect(() => {
    const at = `${runKey}:${index}`;
    if (result !== "missed" || missedAt.current === at) return;
    missedAt.current = at;
    playSound("wrong");
    // Polish batch S: the shared wrong-move shake and red outline on the face (its sound is the one above).
    wrongMoveFlash(rootRef.current?.querySelector("[data-game-arena] .bangon-face"), false);
  }, [result, index, runKey]);
  // Polish batch S: "Watch n of 10" goes to the frame's goal line on a live round (intros keep the label).
  const framed = useGoalProgress({ done: Math.min(index, count), total: count, text: `Watch ${Math.min(index + 1, count)} of ${count}` });
  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label="Stop the marker"
      onPointerDown={onTap}
      data-polish="stopwatch" data-stage-column="7" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7"
    >
      {framed ? null : (
        <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          Watch {Math.min(index + 1, count)} / {count}
        </p>
      )}
      <div data-game-arena={spec.vertical ? "tall" : "fixed"} className={`flex min-h-0 w-full ${spec.vertical ? "flex-1 justify-center" : spec.diagonal ? "justify-center" : ""}`}>
        <Bar
          key={index}
          spec={spec}
          marker={null}
          barRef={live ? refs.barRef : undefined}
          markerRef={live ? refs.markerRef : undefined}
          targetRef={live && spec.moving ? refs.targetRef : undefined}
          passesLeft={passesLeft}
        />
      </div>
      <p data-game-controls="status"
        className={`font-mono text-3xl font-bold tabular-nums ${
          showing ? (result === "missed" ? "text-warn" : "text-primary") : "text-muted-foreground"
        }`}
      >
        {status}
      </p>
      <div data-game-controls="history" className="stopwatch-history grid h-16 w-full grid-cols-3 gap-2" aria-label="Recent results">
        {errors.slice(!showing ? -3 : -4, !showing ? undefined : -1).map((ms, i, list) => <span key={errors.length - list.length + i} data-bangon-face="" className="bangon-card flex flex-col items-center justify-center rounded-md border border-border bg-card px-1 font-mono text-sm text-foreground"><span className="text-muted-foreground">{errors.length - list.length + i + (!showing ? 1 : 0)}</span><span>{ms >= STOPWATCH_MISS_MS ? "Missed" : `${ms} ms off`}</span></span>)}
      </div>
    </div>
  );
}

function resultLabel(signed: number | null): string {
  return signed === null ? "Missed" : `${signed >= 0 ? "+" : "−"}${Math.abs(signed)} ms`;
}

/**
 * Tap-log rounds (`tapRev`): every tap is logged on the round clock and sent
 * raw. Watches run on the fixed schedule the server replays (each starts 600 ms
 * after the last was stopped or ran out), and what the phone shows comes from
 * that same replay.
 */
function LoggedStage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const watches = puzzle.type === "stopwatch" ? (puzzle.watches ?? []) : [];
  const key = `${phaseStartedAt}:${watches.map((w) => w.centre).join(",")}`;
  const taps = useRef<number[]>([]);
  const [logLength, setLogLength] = useState(0);
  const submitted = useRef("");

  useEffect(() => {
    taps.current = [];
    setLogLength(0);
  }, [key]);

  const rel = now - phaseStartedAt;
  const lastTap = taps.current[taps.current.length - 1] ?? 0;
  const upTo = Math.max(rel, lastTap);
  const replay = useMemo(
    () => replayBangOn(watches, taps.current, upTo),
    [watches, logLength, upTo], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const results = replay.results;
  const last = results[results.length - 1];
  const errors = results.map((r) => r.distance ?? STOPWATCH_MISS_MS);
  const current = replay.current;
  // Between watches the one just settled stays on screen with its result.
  const showingResult = !!last && (!current || upTo < current.start);
  const shownIndex = showingResult ? results.length - 1 : (current?.index ?? 0);
  const spec = watches[shownIndex];
  const start = current?.start ?? STOPWATCH_LEAD_IN_MS;
  const live = !!spec && !showingResult && !!current;
  const done = !current && watches.length > 0;

  useEffect(() => {
    if (watches.length) onDraftAnswer?.(encodeTapTimes(taps.current));
  }, [logLength]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!done || locked || submitted.current === key || !last) return;
    if (upTo < last.at + STOPWATCH_GAP_MS) return;
    submitted.current = key;
    const avg = Math.round(errors.reduce((a, b) => a + b, 0) / errors.length);
    onSubmit(encodeTapTimes(taps.current), { reactionAvgMs: avg });
  }, [done, now, locked, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const refs = useMarkerGlide(live, spec, phaseStartedAt + start, shownIndex);

  if (puzzle.type !== "stopwatch" || !spec) return null;

  const handleTap = () => {
    if (locked) return;
    const log = taps.current;
    // Whole ms on the round clock, never earlier than the tap before.
    const stamp = Math.max(Math.round(serverNow() - phaseStartedAt), log[log.length - 1] ?? 0);
    if (stamp < 0 || log.length >= TAP_LOG_MAX) return;
    // Nothing counts after the last watch.
    if (!replayBangOn(watches, log, stamp).current) return;
    taps.current = [...log, stamp];
    setLogLength(taps.current.length);
  };

  const waiting = !showingResult && upTo < start;
  const label = showingResult ? resultLabel(last!.signed) : waiting ? "Get ready" : "Tap to stop";
  const currentPass = live ? markerState(spec, Math.max(0, upTo - start)).pass : spec.passes;
  const passesLeft = Math.max(0, spec.passes - currentPass);

  return (
    <WatchView
      index={shownIndex}
      count={watches.length}
      spec={spec}
      live={live}
      refs={refs}
      passesLeft={passesLeft}
      result={showingResult ? (last!.signed === null ? "missed" : "stopped") : "none"}
      status={done && last && upTo >= last.at + STOPWATCH_GAP_MS ? "All ten done" : label}
      errors={errors}
      onTap={handleTap}
      runKey={key}
      fxScore={done && last && upTo >= last.at + STOPWATCH_GAP_MS ? localBangOnScore(errors, watches.length, tapRevOf(puzzle)) : null}
    />
  );
}

function Stage(props: PuzzleStageProps) {
  return usesTapLog(props.puzzle) ? <LoggedStage {...props} /> : <LegacyStage {...props} />;
}

/** tapRev 2: the stored distances, average and score curve (the server's figures). */
function storedBangOn(extra: Record<string, unknown> | null | undefined) {
  const distances = extra?.["distances"];
  const averageMs = extra?.["averageMs"];
  const kneeMs = extra?.["kneeMs"];
  const zeroMs = extra?.["zeroMs"];
  if (!Array.isArray(distances) || typeof averageMs !== "number" || typeof kneeMs !== "number" || typeof zeroMs !== "number") return null;
  return { distances: distances.filter((v): v is number => typeof v === "number"), averageMs, kneeMs, zeroMs };
}

function Reveal({ puzzle, myAnswer, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "stopwatch") return null;
  const stored = storedBangOn(myExtra);
  // Tap logs are replayed exactly as the server scored them; older rounds list their distances.
  const parsed = stored
    ? stored.distances
    : usesTapLog(puzzle)
    ? myAnswer?.startsWith(TAP_LOG_PREFIX)
      ? replayBangOn(puzzle.watches, decodeTapTimes(myAnswer, STOPWATCH_ROUND_MS).times, STOPWATCH_ROUND_MS).results.map(
          (r) => r.distance ?? STOPWATCH_MISS_MS,
        )
      : []
    : (myAnswer ?? "")
        .split(",")
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isFinite(v));
  const errors = Array.from({ length: puzzle.watches?.length ?? 5 }, (_, i) => parsed[i] ?? STOPWATCH_MISS_MS);
  const avg = stored ? stored.averageMs : Math.round(errors.reduce((a, b) => a + b, 0) / errors.length);
  // tapRev 4 scores on its own curve (scoring.ts STOPWATCH_REV4_CURVE); the stored knee is tapRev 2's.
  const curve = tapRevOf(puzzle) >= TAP_REV_ONE_CURVE ? { kneeMs: STOPWATCH_REV4_KNEE_MS, zeroMs: STOPWATCH_REV4_ZERO_MS } : stored;

  return (
    <>
      <div className="grid w-full grid-cols-1 justify-items-center gap-y-0.5">
        {errors.map((ms, index) => (
          <p key={index} className="whitespace-nowrap font-mono text-base leading-6 tabular-nums text-foreground">
            Watch {index + 1} - {ms >= STOPWATCH_MISS_MS ? "missed (500 ms)" : `${ms} ms off`}
          </p>
        ))}
      </div>
      <div className="bangon-reveal-avg flex w-full flex-col items-center gap-1 rounded-2xl bg-card px-4 py-4">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Average error</p>
        <p className="font-mono text-4xl font-bold tabular-nums text-primary">{avg} ms</p>
        {curve && avg > curve.kneeMs ? (
          <p className="text-center text-xs text-muted-foreground">
            Over {curve.kneeMs} ms the score falls faster: 0 at {curve.zeroMs} ms.
          </p>
        ) : null}
      </div>
    </>
  );
}

export const stopWatchPuzzle: PuzzleDefinition = {
  key: "stopwatch",
  name: gameDisplayName("stopwatch"),
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
