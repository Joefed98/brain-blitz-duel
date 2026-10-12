/**
 * Plays a puzzle's real phone Stage (React, in happy-dom) on a fake clock, with
 * scripted taps, and returns exactly what the phone would have submitted.
 *
 * Used by tap-log-record.tsx (the honest-run fixture, recorded from main before
 * the tap-log change) and tap-log-check.tsx (the same players against today's
 * Stage, legacy and stamped). Frames run every 16–17 ms; taps land between them
 * on whole milliseconds, as `Date.now()` reads them. `serverNow()` is
 * `Date.now()` here (no clock offset).
 */
import { Window } from "happy-dom";
import type { ComponentType } from "react";

import type { PuzzleStageProps, SubmitMeta } from "../src/puzzles/types";
import type { PuzzleData } from "../src/lib/duel/types";

const win = new Window({ url: "http://localhost/", width: 390, height: 700 });
const g = globalThis as Record<string, unknown>;
for (const key of [
  "window", "document", "navigator", "Node", "Element", "HTMLElement", "HTMLIFrameElement", "SVGElement",
  "Text", "Event", "MouseEvent", "PointerEvent", "KeyboardEvent", "FocusEvent", "getComputedStyle", "MutationObserver",
]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["IS_REACT_ACT_ENVIRONMENT"] = true;

let clock = 0;
Date.now = () => clock;
const rafQueue = new Map<number, (t: number) => void>();
let rafId = 0;
g["requestAnimationFrame"] = (cb: (t: number) => void) => {
  rafQueue.set(++rafId, cb);
  return rafId;
};
g["cancelAnimationFrame"] = (id: number) => {
  rafQueue.delete(id);
};

// Quiet React's act() warnings for the visual-only timers the Stages start.
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && /not wrapped in act|act\(\.\.\.\)/.test(args[0])) return;
  originalError(...args);
};

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;

/** One scripted tap: round-clock ms, the element and the DOM event. */
export interface ScriptedTap {
  t: number;
  selector: string;
  event: "pointerdown" | "click";
}

export interface DrivePlayer {
  /** Taps known before the round starts. */
  initial?: ScriptedTap[];
  /** Called after every frame with the round-clock time; may add later taps. */
  onFrame?: (rel: number, container: HTMLElement, schedule: (tap: ScriptedTap) => void) => void;
}

export interface DriveResult {
  /** The answer the room would have sent: onSubmit's, or the last draft at the buzzer. */
  answer: string;
  meta: SubmitMeta | null;
  /** As the room computes it: deadline − serverNow() at onSubmit; 0 at the buzzer. */
  msRemaining: number;
  submitted: boolean;
  /** Round-clock time of the submit, or the limit at the buzzer. */
  submittedAt: number;
  /** Every tap actually dispatched, in order. */
  taps: { t: number; selector: string }[];
}

const PHASE_START = 1_000_000;
const CADENCE = [16, 17, 17];

export async function drive(
  Stage: ComponentType<PuzzleStageProps>,
  puzzle: PuzzleData,
  limitMs: number,
  player: DrivePlayer,
): Promise<DriveResult> {
  const container = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.appendChild(container as unknown as never);
  const root = createRoot(container);
  const queue: ScriptedTap[] = [...(player.initial ?? [])].sort((a, b) => a.t - b.t);
  const schedule = (tap: ScriptedTap) => {
    queue.push(tap);
    queue.sort((a, b) => a.t - b.t);
  };
  let submitted: { answer: string; meta: SubmitMeta | null; at: number } | null = null;
  let draft = "";
  const onSubmit = (answer: string, meta?: SubmitMeta) => {
    if (!submitted) submitted = { answer, meta: meta ?? null, at: Date.now() };
  };
  const onDraftAnswer = (answer: string) => {
    draft = answer;
  };
  const render = (now: number) =>
    act(() => {
      root.render(
        <Stage
          key="run"
          stateKey="run"
          puzzle={puzzle}
          phaseStartedAt={PHASE_START}
          now={now}
          locked={submitted !== null}
          onSubmit={onSubmit}
          onDraftAnswer={onDraftAnswer}
        />,
      );
    });

  const taps: { t: number; selector: string }[] = [];
  clock = PHASE_START;
  await render(PHASE_START);
  let frame = PHASE_START;
  let cadence = 0;
  const end = PHASE_START + limitMs;
  while (true) {
    const nextFrame = frame + CADENCE[cadence % CADENCE.length]!;
    const tap = queue[0];
    if (tap && PHASE_START + tap.t < nextFrame && PHASE_START + tap.t <= end) {
      queue.shift();
      clock = Math.max(clock, PHASE_START + tap.t);
      const element = container.querySelector(tap.selector);
      if (element) {
        taps.push({ t: clock - PHASE_START, selector: tap.selector });
        await act(() => {
          const EventType = tap.event === "click" ? win.MouseEvent : win.PointerEvent;
          element.dispatchEvent(new EventType(tap.event, { bubbles: true, cancelable: true }) as unknown as Event);
        });
      }
      continue;
    }
    if (nextFrame > end) break;
    frame = nextFrame;
    cadence += 1;
    clock = frame;
    await act(() => {
      const callbacks = [...rafQueue.values()];
      rafQueue.clear();
      for (const cb of callbacks) cb(frame);
    });
    await render(frame);
    player.onFrame?.(frame - PHASE_START, container, schedule);
  }
  clock = end;
  await act(() => root.unmount());
  container.remove();
  const done = submitted as { answer: string; meta: SubmitMeta | null; at: number } | null;
  return done
    ? {
        answer: done.answer,
        meta: done.meta,
        msRemaining: Math.max(0, end - done.at),
        submitted: true,
        submittedAt: done.at - PHASE_START,
        taps,
      }
    : { answer: draft, meta: null, msRemaining: 0, submitted: false, submittedAt: limitMs, taps };
}

/** Small seeded generator for the scripted players. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
