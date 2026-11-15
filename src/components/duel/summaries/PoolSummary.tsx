/**
 * Cue Ball's run summary on the answer reveal (the Sports overhaul; display only): the table from above, big, with
 * every pot beside its pocket in order, fouls in red where they happened, and the run's key numbers in plain words.
 * Built by replaying this player's own stored log on the phone (poolRunEvents); the server's replay scored the run.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RunSummaryProps } from "@/components/duel/runSummary";
import { poolPenalty, POOL_SPOTS, poolSetName, POOL_SET_SPOTS } from "@/lib/arcade/pool";
import { poolRunEvents, type PoolRunEvents } from "@/lib/arcade/poolRunEvents";
import { drawPoolSummary, poolSummaryHeight } from "@/lib/arcade/poolSummary.renderer";

/** The run's key numbers, as short labelled tiles (no "×", nothing that reads as describing the solution). */
export function poolSummaryStats(ev: PoolRunEvents, rev: number): { label: string; value: string; tone?: "good" | "bad" }[] {
  const set = rev >= 4 ? poolSetName(ev.state.set ?? POOL_SET_SPOTS) : "spots";
  const out: { label: string; value: string; tone?: "good" | "bad" }[] = [
    { label: `Your ${set} potted`, value: `${ev.spots} of ${POOL_SPOTS}`, ...(ev.spots >= POOL_SPOTS ? { tone: "good" as const } : {}) },
    {
      label: "The black",
      value: ev.black === "down" ? (ev.clearedAt !== null ? `Down at ${ev.clearedAt.toFixed(1)} s` : "Down") : ev.black === "early" ? "Too soon" : "Not down",
      ...(ev.black === "down" ? { tone: "good" as const } : ev.black === "early" ? { tone: "bad" as const } : {}),
    },
    { label: "Best streak", value: ev.streakBest === 1 ? "1 pot" : `${ev.streakBest} pots` },
  ];
  const fouls = ev.fouls.length;
  out.push({ label: "Fouls", value: fouls === 0 ? "None" : `${fouls} (−${poolPenalty(ev.state)})`, ...(fouls > 0 ? { tone: "bad" as const } : {}) });
  return out;
}

export default function PoolSummary({ puzzle, myAnswer }: RunSummaryProps) {
  const rev = puzzle.type === "pool" ? (puzzle.poolRev ?? 1) : 1;
  const events = useMemo(() => (puzzle.type === "pool" && myAnswer ? poolRunEvents(puzzle.seed, myAnswer, puzzle.poolRev) : null), [puzzle, myAnswer]);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setW(Math.floor(el.clientWidth));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = w > 0 ? poolSummaryHeight(w) : 0;
  useEffect(() => {
    const c = canvas.current;
    if (!c || !events || w <= 0) return;
    const dpr = Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPoolSummary(ctx, w, h, events);
  }, [events, w, h]);
  if (!events) return null;
  const stats = poolSummaryStats(events, rev);
  const label = `The table at the end: ${events.pots.length} ${events.pots.length === 1 ? "ball" : "balls"} potted, ${events.fouls.length} ${events.fouls.length === 1 ? "foul" : "fouls"}`;
  return (
    <div data-pool-summary="" className="flex w-full flex-col gap-2">
      <div ref={box} className="w-full">
        <canvas ref={canvas} role="img" aria-label={label} data-pool-summary-table="" style={{ width: w, height: h, display: "block" }} />
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} data-pool-stat={s.label} className="flex flex-col rounded-lg bg-black/30 px-3 py-2">
            <span className="text-sm font-semibold text-muted-foreground">{s.label}</span>
            <span className={`text-xl font-extrabold tabular-nums ${s.tone === "bad" ? "text-destructive" : "text-foreground"}`}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
