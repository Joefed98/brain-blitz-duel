import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { visualFx } from "@/lib/fx";
import { countUpDing, countUpTick } from "@/lib/fx/celebrations";

/**
 * Counts up quickly whenever the value changes. `from` starts the first count
 * somewhere else (the podium counts every total up from 0); `quiet` skips the
 * score-pop effect for counts that aren't a newly revealed score; `skip` (the results count-up's
 * tap to skip, src/lib/fx/celebrations.ts) jumps straight to the value; `countSound` (the celebrations'
 * count-up) ticks as the number changes, at most 12 a second, and dings once it lands.
 */
export function AnimatedScore({
  value,
  className,
  from: start,
  durationMs = 450,
  quiet = false,
  skip = false,
  countSound = false,
}: {
  value: number;
  className?: string;
  from?: number;
  durationMs?: number;
  quiet?: boolean;
  skip?: boolean;
  countSound?: boolean;
}) {
  const [display, setDisplay] = useState(start ?? value);
  const fromRef = useRef(start ?? value);
  const skipRef = useRef(skip);
  skipRef.current = skip;

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    if (value > from && !quiet) visualFx("onRevealScore", value - from);
    if (prefersReducedMotion() || skipRef.current) { setDisplay(value); fromRef.current = value; return; }
    const duration = durationMs;
    const start = performance.now();
    let frame = 0;

    const step = (time: number) => {
      if (skipRef.current) {
        setDisplay(value);
        fromRef.current = value;
        if (countSound) countUpDing();
        return;
      }
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (value - from) * eased);
      if (countSound && next !== fromRef.current && progress < 1) countUpTick(time);
      setDisplay(next);
      fromRef.current = next;
      if (progress < 1) frame = requestAnimationFrame(step);
      else {
        fromRef.current = value;
        if (countSound) countUpDing();
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span className={className}>{display}</span>;
}
