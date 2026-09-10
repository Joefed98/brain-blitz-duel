import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/motion";
import { playTick } from "@/lib/sound";

interface TimerRingProps {
  msRemaining: number;
  totalMs: number;
  /** false while a puzzle is still being presented (e.g. sequence playback) */
  active: boolean;
}

const SIZE = 132;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function format(ms: number): string {
  const clamped = Math.max(0, ms);
  return `${Math.floor(clamped / 1000)}.${Math.floor((clamped % 1000) / 100)}`;
}

/** Countdown ring: gold, amber under 10s, red under 5s with a soft tick. */
export function TimerRing({ msRemaining, totalMs, active }: TimerRingProps) {
  const reduced = useReducedMotion();
  const lastTick = useRef(-1);
  const seconds = msRemaining / 1000;
  const danger = active && seconds <= 5;
  const warn = active && !danger && seconds <= 10;

  useEffect(() => {
    if (!active) return;
    const whole = Math.ceil(seconds);
    if (whole > 3 || whole < 1) return;
    if (lastTick.current === whole) return;
    lastTick.current = whole;
    playTick();
  }, [active, seconds]);

  const stroke = !active
    ? "var(--muted-foreground)"
    : danger
      ? "var(--warn)"
      : warn
        ? "var(--primary)"
        : "var(--me)";
  const textColor = !active
    ? "text-muted-foreground"
    : danger
      ? "text-warn"
      : "text-foreground";

  const progress = Math.max(0, Math.min(1, msRemaining / totalMs));

  return (
    <div
      className={`relative ${danger && !reduced ? "animate-timer-pulse" : ""}`}
      style={{ width: SIZE, height: SIZE }}
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
        <span className={`font-mono text-4xl font-bold tabular-nums ${textColor}`}>
          {format(msRemaining)}
        </span>
      </div>
    </div>
  );
}
