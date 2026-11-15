/**
 * Apex's run summary on the answer reveal (the Sports overhaul, 15 Nov 2026; display only): the circuit from above,
 * drawn large, with the sectors driven clean in green and red marks where the car went off or hit the wall; under it
 * the numbers that explain the score in plain labels (each lap's time, the average speed, the clean sectors). Built by
 * stepping this player's own stored log through the sim (racingRunMoments); nothing is sent or stored.
 */
import { useEffect, useMemo, useRef } from "react";

import type { RunSummaryProps } from "@/components/duel/runSummary";
import { canvasRatio } from "@/lib/battery";
import { racingCircuitOf, RACING_CIRCUITS, RACING_REV_4, RACING_SECTORS, racingTrackFor } from "@/lib/arcade/racing";
import { racingRunMoments } from "@/lib/arcade/racingMap";
import { drawRacingRunMap } from "@/lib/arcade/racingMap.renderer";
import { decodeRacingRun } from "@/lib/duel/racing";

const SIZE = 300;
const secs = (ticks: number) => `${(ticks / 60).toFixed(1)} s`;

function Stat({ label, value }: { label: string; value: string }) {
  const unit = /^(\S+) (s|km\/h)$/.exec(value);
  return (
    <div data-run-stat={label} className="flex min-w-0 flex-col items-center">
      {/* The number big and its unit smaller on the same line ("54.0 km/h" never wraps in three columns). */}
      <span className="whitespace-nowrap text-2xl font-extrabold tabular-nums text-foreground">
        {unit ? (
          <>
            {unit[1]}
            <span className="ml-1 text-base font-bold">{unit[2]}</span>
          </>
        ) : (
          value
        )}
      </span>
      <span className="reveal-meta">{label}</span>
    </div>
  );
}

export default function RacingSummary({ puzzle, myAnswer }: RunSummaryProps) {
  const data = puzzle.type === "racing" ? puzzle : null;
  const run = useMemo(() => {
    if (!data || !myAnswer) return null;
    try {
      const decoded = decodeRacingRun(myAnswer);
      return racingRunMoments(data.seed, data.racingRev, decoded.events);
    } catch {
      return null;
    }
  }, [data, myAnswer]);
  const track = data ? racingTrackFor(data.seed, data.racingRev) : null;
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx || !track) return;
    const ratio = canvasRatio();
    node.width = SIZE * ratio;
    node.height = SIZE * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawRacingRunMap(ctx, track, run, 0, 0, SIZE);
  }, [track, run]);
  if (!data || !run || !track) return null;
  const circuit = (data.racingRev ?? 1) >= RACING_REV_4 ? RACING_CIRCUITS[racingCircuitOf(data.seed)]!.name : null;
  const lapLabel = (i: number) => `Lap ${i + 1}`;
  const trips = run.offs.length;
  const walls = run.walls.length;
  const incidents = [trips ? `${trips} ${trips === 1 ? "trip" : "trips"} off the track` : null, walls ? `${walls} ${walls === 1 ? "wall hit" : "wall hits"}` : null].filter(Boolean).join(" · ");
  return (
    <div data-racing-summary="" className="flex w-full flex-col items-center gap-3">
      {circuit ? <p className="reveal-meta">{circuit}</p> : null}
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`Circuit map: ${run.clean} of ${RACING_SECTORS} sectors clean${incidents ? `, ${incidents}` : ""}`}
        className="w-full max-w-xs"
        style={{ aspectRatio: "1 / 1" }}
      />
      {/* Two by two after a finish (each lap's time, the average speed, the clean sectors); three across otherwise. */}
      <div className={`grid w-full gap-x-4 gap-y-3 ${run.lapTicks.length >= 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {run.lapTicks.length >= 2 ? (
          run.lapTicks.slice(0, 2).map((t, i) => <Stat key={i} label={lapLabel(i)} value={secs(t)} />)
        ) : (
          <Stat label="Distance" value={`${Math.floor(run.covered * 100)}%`} />
        )}
        <Stat label="Average speed" value={`${(run.pace10 / 10).toFixed(1)} km/h`} />
        <Stat label="Clean sectors" value={`${run.clean} of ${RACING_SECTORS}`} />
      </div>
      <p data-run-incidents="" className="reveal-meta">{incidents || "No grass or wall all race"}</p>
    </div>
  );
}
