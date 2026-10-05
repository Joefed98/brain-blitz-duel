import { AnimatedScore } from "./AnimatedScore";
import type { ReactNode } from "react";

/** Shared row used by score HUDs; preserves their original dimensions. */
export function ProgressStrip({ name, value, opponent = false, alignRight = false, trailing }: {
  name: string; value: number; opponent?: boolean; alignRight?: boolean; trailing?: ReactNode;
}) {
  return <div className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${trailing ? "flex items-center justify-between" : ""} ${opponent ? "border-opponent/40 bg-opponent/10 text-opponent" : "border-me/40 bg-me/10 text-me"} ${alignRight ? "text-right" : ""}`}>
    <div className="min-w-0">
    <p className="truncate text-[11px] uppercase tracking-widest">{name}</p>
    <AnimatedScore value={value} className="font-mono text-xl font-bold tabular-nums" />
    </div>{trailing}
  </div>;
}