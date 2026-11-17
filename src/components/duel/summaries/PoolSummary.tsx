/**
 * Cue Ball's run summary on the answer reveal (the Sports overhaul; display only): the table from above, big, with
 * every pot beside its pocket in order, fouls in red where they happened, and the run's key numbers in plain words.
 * Built by replaying this player's own stored log on the phone (poolRunEvents); the server's replay scored the run.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RunSummaryProps } from "@/components/duel/runSummary";
import { poolPenalty, POOL_SPOTS, poolSetName, POOL_SET_SPOTS } from "@/lib/arcade/pool";
import { poolRunEvents, type PoolRunEvents } from "@/lib/arcade/poolRunEvents";
import { drawPoolSummary, poolSummaryHeight, type PoolSummaryLanding } from "@/lib/arcade/poolSummary.renderer";
import { FxCountUp } from "@/components/fx/GameFx";
import { gameFxVariant, type GameFxVariant } from "@/lib/fx/kit";

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
  out.push({ label: "Fouls", value: fouls === 0 ? "0" : `${fouls} (−${poolPenalty(ev.state)})`, ...(fouls > 0 ? { tone: "bad" as const } : {}) });
  return out;
}

/** Each pot's landing on the summary table (ms), and the gap before the next starts. */
export const POOL_LAND_MS = 260;
export const POOL_LAND_GAP_MS = 140;

/** The landing's plan for a number of pots and the kit's variant: null for the final state at once (no pots, reduced, calm). */
export function poolLandingPlan(pots: number, variant: GameFxVariant): { pots: number; land: number; gap: number } | null {
  if (pots === 0 || variant === "reduced" || variant === "calm") return null;
  const lite = variant === "lite";
  return { pots, land: lite ? POOL_LAND_MS / 2 : POOL_LAND_MS, gap: lite ? POOL_LAND_GAP_MS / 2 : POOL_LAND_GAP_MS };
}

/** Where the landing is at `ms`: the pots fully down and the next one's share in, or null once every pot is down. */
export function poolLandingAt(plan: { pots: number; land: number; gap: number }, ms: number): PoolSummaryLanding | null {
  if (ms >= (plan.pots - 1) * plan.gap + plan.land) return null;
  const n = Math.max(0, Math.min(plan.pots - 1, Math.floor(ms / plan.gap)));
  return { pots: n, land: Math.max(0, Math.min(1, (ms - n * plan.gap) / plan.land)) };
}

/**
 * A tile's value with its leading number counting up (the kit's FxCountUp; the final number is in the markup), the rest
 * of the words as they are ("6 of 7", "2 pots", "1 (−10)"). A value with no leading number shows as it is.
 */
function StatValue({ value, className }: { value: string; className: string }) {
  const m = /^(\d+)(.*)$/.exec(value);
  if (!m) return <span className={className}>{value}</span>;
  return (
    <span className={className} data-pool-stat-value={value}>
      <FxCountUp value={Number(m[1])} silent />
      {m[2]}
    </span>
  );
}

export default function PoolSummary({ puzzle, myAnswer }: RunSummaryProps) {
  const rev = puzzle.type === "pool" ? (puzzle.poolRev ?? 1) : 1;
  const events = useMemo(() => (puzzle.type === "pool" && myAnswer ? poolRunEvents(puzzle.seed, myAnswer, puzzle.poolRev, (puzzle as { level?: unknown }).level) : null), [puzzle, myAnswer]);
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
    // The payoff (stage 2): the pots land on the table one by one, by the kit's count-up rules (lighter on a slow phone
    // or with the battery saver; the final table at once under reduced motion or with celebrations off). Bounded.
    const plan = poolLandingPlan(events.pots.length, gameFxVariant("countUp"));
    if (!plan || typeof requestAnimationFrame === "undefined") {
      drawPoolSummary(ctx, w, h, events);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const at = poolLandingAt(plan, now - start);
      drawPoolSummary(ctx, w, h, events, at ?? undefined);
      if (at) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      drawPoolSummary(ctx, w, h, events);
    };
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
            <StatValue value={s.value} className={`text-xl font-extrabold tabular-nums ${s.tone === "bad" ? "text-destructive" : "text-foreground"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
