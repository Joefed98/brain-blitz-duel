interface CountdownTimerProps {
  msRemaining: number;
  /** false while a puzzle is still being presented (e.g. sequence playback) */
  active: boolean;
}

function format(ms: number): string {
  const clamped = Math.max(0, ms);
  const seconds = Math.floor(clamped / 1000);
  const tenths = Math.floor((clamped % 1000) / 100);
  return `${seconds}.${tenths}`;
}

export function CountdownTimer({ msRemaining, active }: CountdownTimerProps) {
  const seconds = msRemaining / 1000;
  const danger = active && seconds <= 5;
  const warn = active && !danger && seconds <= 10;

  const color = !active
    ? "text-muted-foreground"
    : danger
      ? "text-warn"
      : warn
        ? "text-primary"
        : "text-foreground";

  return (
    <div
      className={`font-mono text-6xl font-bold tabular-nums leading-none ${color} ${
        danger ? "animate-timer-pulse" : ""
      }`}
      aria-label="Time remaining"
    >
      {format(msRemaining)}
    </div>
  );
}
