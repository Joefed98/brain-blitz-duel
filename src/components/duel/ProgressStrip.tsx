import { AnimatedScore } from "./AnimatedScore";
import type { ReactNode } from "react";

/** Shared row used by score HUDs; preserves their original dimensions. */
export function ProgressStrip({ name, value, opponent = false, alignRight = false, trailing, compact = false, stacked = false }: {
  name: string; value: number; opponent?: boolean; alignRight?: boolean; trailing?: ReactNode; compact?: boolean;
  /** One 20px line (12px name, 14px score) for the arcade play header, two stacked in its 44px row. */
  stacked?: boolean;
}) {
  if (stacked) return <div className={`flex h-5 min-w-0 items-center justify-between gap-1 rounded-md border px-1.5 leading-none ${opponent ? "border-opponent/40 bg-opponent/10 text-opponent" : "border-me/40 bg-me/10 text-me"}`}>
    <p className="min-w-0 truncate text-xs uppercase tracking-wider">{name}</p>
    <AnimatedScore value={value} className="shrink-0 font-mono text-sm font-bold tabular-nums" />
  </div>;
  return <div className={`min-w-0 flex-1 rounded-lg border ${compact ? "flex h-9 items-center justify-between gap-1 px-2" : "px-3 py-2"} ${trailing ? "flex items-center justify-between" : ""} ${opponent ? "border-opponent/40 bg-opponent/10 text-opponent" : "border-me/40 bg-me/10 text-me"} ${alignRight ? "text-right" : ""}`}>
    <div className={`min-w-0 ${compact ? "flex flex-1 items-baseline justify-between gap-1" : ""}`}>
    <p className={`truncate uppercase tracking-widest ${compact ? "text-[10px]" : "text-[11px]"}`}>{name}</p>
    <AnimatedScore value={value} className={`shrink-0 font-mono font-bold tabular-nums ${compact ? "text-sm" : "text-xl"}`} />
    </div>{trailing}
  </div>;
}