import { useEffect, useState } from "react";

import { useReducedMotion } from "@/lib/motion";

/** How often the lit dot moves on (ms). */
export const DOTS_STEP_MS = 400;

/**
 * The one waiting / loading indicator used everywhere. Battery (31 Oct 2026, display only): one dot at a
 * time lifts and lights, stepping every DOTS_STEP_MS, so a screen waiting on other players draws about
 * 2.5 frames a second instead of an endless 60 fps bounce. Reduced motion: three still dots.
 */
export function Dots({ className = "bg-muted-foreground" }: { className?: string }) {
  const reduced = useReducedMotion();
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setLit((n) => (n + 1) % 3), DOTS_STEP_MS);
    return () => window.clearInterval(id);
  }, [reduced]);
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {[0, 1, 2].map((i) => {
        const on = !reduced && i === lit;
        return (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${className}`}
            style={{ opacity: reduced ? 0.6 : on ? 1 : 0.25, transform: on ? "translateY(-3px)" : undefined }}
          />
        );
      })}
    </span>
  );
}

export function WaitingLine({ label, className = "" }: { label: string; className?: string }) {
  return (
    <p
      className={`flex items-center justify-center gap-2 text-sm text-muted-foreground ${className}`}
    >
      <span>{label}</span>
      <Dots />
    </p>
  );
}
