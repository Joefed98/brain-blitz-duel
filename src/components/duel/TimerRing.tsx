import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/motion";
import { playTick, startMusic, stopMusic } from "@/lib/sound";

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
  const finalThird = active && progress <= 1 / 3;
  const middleThird = active && !finalThird && progress <= 2 / 3;

  useEffect(() => {
    if (!finalTen || seconds < 1 || lastTick.current === seconds) return;
    lastTick.current = seconds;
    if (seconds <= 3) playTick();
  }, [finalTen, seconds]);

  const tensionRemaining = useRef(0);
  if (finalThird) tensionRemaining.current = remaining;
  useEffect(() => {
    if (!finalThird) return;
    startMusic("tension_loop", {
      rate: 1,
      rampToRate: 1.15,
      rampMs: Math.max(400, tensionRemaining.current),
    });
  }, [finalThird]);

  useEffect(() => {
    if (active) return;
    stopMusic(200);
  }, [active]);

  useEffect(() => () => stopMusic(200), []);

  const fill = !active
    ? "bg-muted-foreground"
    : finalThird
      ? "bg-destructive"
      : middleThird
        ? "bg-timer-orange"
        : "bg-timer-green";
  const digits = !active
    ? "text-muted-foreground"
    : finalThird
      ? "text-destructive"
      : middleThird
        ? "text-timer-orange"
        : "text-timer-green";
  const pulse = finalTen && !reduced ? "animate-timer-second-pulse" : "";

  return (
    <div
      className={`grid h-5 w-full shrink-0 grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-1 ${pulse}`}
      aria-label={`${seconds} seconds remaining`}
      role="timer"
    >
      <div className="h-1.5 w-full overflow-hidden bg-muted">
        <div
          className={`h-full origin-left transition-[width,background-color] duration-100 ease-linear ${fill}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className={`text-right font-mono text-[11px] font-bold leading-none tabular-nums ${digits}`}>
        {seconds}
      </span>
    </div>
  );
}