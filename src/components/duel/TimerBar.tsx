import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/motion";
import { fx } from "@/lib/fx";

interface TimerBarProps {
  msRemaining: number;
  totalMs: number;
  /** false while a puzzle is still being presented (for example sequence playback) */
  active: boolean;
}

/** One shared, low-profile countdown for every live puzzle and arcade round. */
export function TimerBar({ msRemaining, totalMs, active }: TimerBarProps) {
  const reduced = useReducedMotion();
  const lastTick = useRef(-1);
  const limit = Math.max(1, totalMs);
  const remaining = Math.max(0, msRemaining);
  const progress = Math.max(0, Math.min(1, remaining / limit));
  const seconds = Math.ceil(remaining / 1000);
  const finalTen = active && remaining > 0 && remaining <= 10_000;
  const critical = active && remaining > 0 && remaining <= 5_000;
  useEffect(() => {
    if (!active || lastTick.current === seconds) return;
    lastTick.current = seconds;
    if (seconds === 10) fx.onTimerWarning10();
    if (seconds === 5) fx.onTimerWarning5();
    if (seconds === 0) fx.onTimeUp();
  }, [active, seconds]);
  return (
    <div className={`flex h-5 w-full shrink-0 items-center justify-end gap-1 ${finalTen ? "fx-timer-pulse" : ""} ${critical ? "fx-timer-critical" : ""}`} aria-label={`${seconds} seconds remaining`} role="timer">
      <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fx-timer-ring" aria-hidden="true">
        <circle cx="10" cy="10" r="8" className="timer-ring-track" />
        <circle cx="10" cy="10" r="8" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress * 100} transform="rotate(-90 10 10)" className={reduced ? "timer-ring-fill" : "timer-ring-fill transition-[stroke-dashoffset] duration-100"} />
      </svg>
      <span className="w-9 text-right font-mono text-[11px] font-bold leading-none tabular-nums text-timer-gold">{seconds}</span>
    </div>
  );
}
