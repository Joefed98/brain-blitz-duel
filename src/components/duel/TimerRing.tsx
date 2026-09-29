import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/motion";
import { playTick, startMusic, stopMusic } from "@/lib/sound";
import type { PuzzleType } from "@/lib/duel/types";

interface TimerRingProps {
  msRemaining: number;
  totalMs: number;
  /** false while a puzzle is still being presented (e.g. sequence playback) */
  active: boolean;
}

const SIZE = 132;
const STROKE = 11;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Dense stages reserve a smaller, collision-safe timer slot on short phones. */
const COMPACT_TIMER_TYPES = new Set<PuzzleType>([
  "target",
  "countup",
  "blockparty",
  "chaincalc",
  "wordsmith",
  "wordhunt",
  "spotdiff",
  "sudoku",
  "lightsout",
  "pipes",
  "patcomp",
  "flow",
  "iceslide",
  "laser",
  "tower",
  "maze",
  "push",
  "tubes",
  "safe",
  "bomb",
  "gravity",
  "chain",
  "intruder",
  "nonogram",
  "pairmatch",
  "flood",
  "stroke",
  "tiles",
  "rings",
  "tilegrid",
  "wordslide",
  "sumhunt",
  "balance",
]);

export function timerSlotClass(type: PuzzleType): string {
  if (type === "rings") return "h-[80px] scale-[0.6]";
  if (type === "tilegrid") return "h-[72px] scale-[0.54] [@media(max-height:700px)]:h-[60px] [@media(max-height:700px)]:scale-[0.45]";
  if (type === "countup") return "h-[72px] scale-[0.54] [@media(max-height:700px)]:h-[60px] [@media(max-height:700px)]:scale-[0.45]";
  return COMPACT_TIMER_TYPES.has(type)
    ? "h-[94px] scale-[0.7] [@media(max-height:700px)]:h-[80px] [@media(max-height:700px)]:scale-[0.6]"
    : "h-[104px] scale-[0.78] [@media(max-height:700px)]:h-[88px] [@media(max-height:700px)]:scale-[0.66]";
}

function format(ms: number): string {
  const clamped = Math.max(0, ms);
  return `${Math.floor(clamped / 1000)}.${Math.floor((clamped % 1000) / 100)}`;
}

/**
 * Countdown ring: gold, amber with a third of the time left, red with a sixth
 * left — both measured against this puzzle type's own limit. The last three
 * seconds tick.
 */
export function TimerRing({ msRemaining, totalMs, active }: TimerRingProps) {
  const reduced = useReducedMotion();
  const lastTick = useRef(-1);
  const seconds = msRemaining / 1000;
  const limit = totalMs > 0 ? totalMs : 1;
  const danger = active && msRemaining <= limit / 6;
  const warn = active && !danger && msRemaining <= limit / 3;

  useEffect(() => {
    if (!active) return;
    const whole = Math.ceil(seconds);
    if (whole > 3 || whole < 1) return;
    if (lastTick.current === whole) return;
    lastTick.current = whole;
    playTick();
  }, [active, seconds]);

  // The tension bed rides the last sixth of the round, speeding up as it goes.
  const tensionRemaining = useRef(0);
  if (danger) tensionRemaining.current = msRemaining;
  useEffect(() => {
    if (!danger) return;
    startMusic("tension_loop", {
      rate: 1,
      rampToRate: 1.15,
      rampMs: Math.max(400, tensionRemaining.current),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [danger]);

  // The instant the round ends — submission, auto-lock or timeout — it stops.
  useEffect(() => {
    if (active) return;
    stopMusic(200);
  }, [active]);

  useEffect(() => () => stopMusic(200), []);

  const stroke = !active
    ? "var(--muted-foreground)"
    : danger
      ? "var(--warn)"
      : warn
        ? "var(--primary)"
        : "var(--me)";
  const textColor = !active ? "text-muted-foreground" : danger ? "text-warn" : "text-foreground";

  const progress = Math.max(0, Math.min(1, msRemaining / totalMs));

  return (
    <div
      className={`relative rounded-full ${danger && !reduced ? "animate-timer-pulse-strong" : ""}`}
      style={{
        width: SIZE,
        height: SIZE,
        background: "var(--card)",
        boxShadow:
          "0 0 0 1px var(--border), 0 0 18px 2px color-mix(in oklab, var(--primary) 32%, transparent)",
      }}
      aria-label="Time remaining"
      role="timer"
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
          style={{ transition: "stroke-dashoffset 100ms linear, stroke 200ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-mono text-[3rem] font-bold leading-none tabular-nums ${textColor}`}
          style={active && !danger ? { color: "#FFD166" } : undefined}
        >
          {format(msRemaining)}
        </span>
      </div>
    </div>
  );
}
