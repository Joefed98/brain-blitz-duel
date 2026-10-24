import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/motion";
import { fx } from "@/lib/fx";
import { stopWarning10, playVoice, playWarningTick } from "@/lib/sound";

interface TimerBarProps {
  msRemaining: number;
  totalMs: number;
  /** false while a puzzle is still being presented (for example sequence playback) */
  active: boolean;
}

/**
 * One shared, low-profile countdown for every live puzzle and arcade round.
 * Round music is never touched here: the room/practice round state owns it.
 */
export function TimerBar({ msRemaining, totalMs, active }: TimerBarProps) {
  const reduced = useReducedMotion();
  const lastTick = useRef(-1);
  const limit = Math.max(1, totalMs);
  const remaining = Math.max(0, msRemaining);
  const progress = Math.max(0, Math.min(1, remaining / limit));
  const seconds = Math.ceil(remaining / 1000);
  const finalTen = active && remaining > 0 && remaining <= 10_000;
  const critical = finalTen;
  const warned10 = useRef(false);
  const warnSecond = useRef<number | null>(null);
  useEffect(() => {
    // Round ended early (submit, all-active-submitted, arcade game over) or
    // the timer unmounted: cut the countdown cue immediately.
    if (!active) {
      stopWarning10();
      return;
    }
    // Fire exactly as the clock crosses 10.0 s; a player joining inside the
    // last 10 s starts the cue offset so it still ends at 0.
    if (remaining > 0 && remaining <= 10_000 && !warned10.current) {
      warned10.current = true;
      fx.onTimerWarning10((10_000 - remaining) / 1000);
    }
    // Ticks fire as the clock crosses each whole second (10–4 normal, 3–1 final);
    // the first reading (e.g. a rejoin) only arms them for the next second.
    if (warnSecond.current !== seconds) {
      const first = warnSecond.current === null;
      warnSecond.current = seconds;
      if (!first && remaining > 0) {
        if (seconds >= 4 && seconds <= 10) playWarningTick("warning_tick");
        else if (seconds >= 1 && seconds <= 3) playWarningTick("warning_tick_final");
      }
    }
    if (lastTick.current === seconds) return;
    lastTick.current = seconds;
    if (seconds === 5) fx.onTimerWarning5();
    if (seconds === 0) {
      fx.onTimeUp();
      playVoice("voice.timesUp");
    }
  }, [active, seconds, remaining]);
  useEffect(() => () => stopWarning10(), []);
  // The game frame's ring (Polish 2, 24 Oct 2026, display only): 48px, a #26262C track and the
  // category-colour arc with a round cap, the seconds inside (polish-layout/game-frame.css).
  return (
    <div
      className={`game-timer ${finalTen && !reduced ? "fx-timer-pulse" : ""} ${critical ? "fx-timer-critical" : ""}`}
      aria-label={`${seconds} seconds remaining`}
      role="timer"
    >
      <svg key={seconds} viewBox="0 0 48 48" className="game-timer-ring fx-timer-ring" aria-hidden="true">
        <circle cx="24" cy="24" r="22" className="timer-ring-track" />
        <circle
          cx="24"
          cy="24"
          r="22"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - progress * 100}
          transform="rotate(-90 24 24)"
          className={
            reduced
              ? "timer-ring-fill"
              : "timer-ring-fill transition-[stroke-dashoffset] duration-100"
          }
        />
      </svg>
      <span key={`digit-${seconds}`} className="game-timer-seconds">
        {seconds}
      </span>
    </div>
  );
}
