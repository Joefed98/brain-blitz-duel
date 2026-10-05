import { AnimatedScore } from "./AnimatedScore";

/** Shared row used by score HUDs; preserves their original dimensions. */
export function ProgressStrip({ name, value, opponent = false, alignRight = false }: {
  name: string; value: number; opponent?: boolean; alignRight?: boolean;
}) {
  return <div className={`min-w-0 flex-1 rounded-lg border px-3 py-2 ${opponent ? "border-opponent/40 bg-opponent/10 text-opponent" : "border-me/40 bg-me/10 text-me"} ${alignRight ? "text-right" : ""}`}>
    <p className="truncate text-[11px] uppercase tracking-widest">{name}</p>
    <AnimatedScore value={value} className="font-mono text-xl font-bold tabular-nums" />
  </div>;
}