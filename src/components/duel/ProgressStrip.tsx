import { AnimatedScore } from "./AnimatedScore";
import type { ReactNode } from "react";

/** Shared row used by score HUDs; preserves their original dimensions. */
export function ProgressStrip({ name, value, opponent = false, alignRight = false, trailing, compact = false }: {
  name: string; value: number; opponent?: boolean; alignRight?: boolean; trailing?: ReactNode; compact?: boolean;
}) {
  return <div className={`min-w-0 flex-1 rounded-lg border ${compact ? "flex h-9 items-center justify-between gap-1 px-2" : "px-3 py-2"} ${trailing ? "flex items-center justify-between" : ""} ${opponent ? "border-opponent/40 bg-opponent/10 text-opponent" : "border-me/40 bg-me/10 text-me"} ${alignRight ? "text-right" : ""}`}>
    <div className={`min-w-0 ${compact ? "flex flex-1 items-baseline justify-between gap-1" : ""}`}>
    <p className={`truncate uppercase tracking-widest ${compact ? "text-[10px]" : "text-[11px]"}`}>{name}</p>
    <AnimatedScore value={value} className={`shrink-0 font-mono font-bold tabular-nums ${compact ? "text-sm" : "text-xl"}`} />
    </div>{trailing}
  </div>;
}