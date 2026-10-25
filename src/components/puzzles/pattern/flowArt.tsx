/**
 * Chroma Lines (flow) art — presentation only. The tubes and dots are drawn
 * from the paths the stage already holds; nothing here changes a path, the
 * draft answer or the submission. Every tube runs through measured cell
 * centres, so it stays inside the cells the grader counts.
 */
import { useEffect, useId, useRef } from "react";

import { soundCue } from "@/lib/fx/patternFx";

/** `hex` mixed towards black (amount < 0) or white (amount > 0). */
export function shadeHex(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function pathData(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}

export interface FlowTube {
  colour: string;
  points: { x: number; y: number }[];
  joined: boolean;
}

/**
 * The drawn paths as glossy rounded tubes: a dark rim, the colour body and a
 * soft specular streak. A loose end gets a small glowing cap so it reads as
 * "carry on from here". `pulse` lists tubes that just joined; `solved` runs a
 * light pulse end to end along every tube.
 */
export function FlowTubes({
  tubes,
  width,
  pulse,
  solved,
}: {
  tubes: FlowTube[];
  width: number;
  pulse: ReadonlySet<number>;
  solved: boolean;
}) {
  const step = tubes.length > 1 ? Math.min(40, 300 / (tubes.length - 1)) : 0;
  const neon = `flow-neon-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Batch P (live round only): a blurred copy under each path, so the lines glow like neon. */}
      <defs>
        <filter id={neon} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={Math.max(2, width * 0.45)} />
        </filter>
      </defs>
      {tubes.map((tube, index) => {
        if (tube.points.length < 2) return null;
        const d = pathData(tube.points);
        const end = tube.points[tube.points.length - 1]!;
        return (
          <g key={index} className="flow-tube">
            <path d={d} className="flow-halo" stroke={tube.colour} strokeOpacity={tube.joined ? 0.95 : 0.55} strokeWidth={width * 1.5} filter={`url(#${neon})`} />
            <path d={d} stroke={shadeHex(tube.colour, -0.55)} strokeOpacity={0.85} strokeWidth={width + 3} />
            <path d={d} stroke={tube.colour} strokeWidth={width} />
            <path d={d} stroke={shadeHex(tube.colour, 0.6)} strokeOpacity={0.55} strokeWidth={Math.max(1, width * 0.3)} />
            {!tube.joined ? (
              <circle cx={end.x} cy={end.y} r={width * 0.62} className="flow-loose-end" fill={tube.colour} stroke={shadeHex(tube.colour, 0.7)} strokeWidth={1.2} />
            ) : null}
            {solved || pulse.has(index) ? (
              <path
                key={solved ? "solve" : "join"}
                d={d}
                pathLength={1}
                className={solved ? "flow-pulse flow-pulse-solve" : "flow-pulse"}
                stroke={shadeHex(tube.colour, 0.75)}
                strokeWidth={width * 1.05}
                style={solved ? { animationDelay: `${Math.round(index * step)}ms` } : undefined}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Live board cues (no audio): `flow.connect` when a colour joins its partner
 * (not on the solving join, which is `flow.solve`). Returns the pairs that
 * joined on this render, for a one-shot pulse along that tube.
 */
export function useFlowJoins(joined: boolean[], live: boolean, solved: boolean): ReadonlySet<number> {
  const prev = useRef<boolean[] | null>(null);
  const fresh = useRef<Set<number>>(new Set());
  const key = joined.map((j) => (j ? 1 : 0)).join("");
  const was = prev.current;
  if (was === null || was.join() !== joined.join()) {
    const next = new Set<number>();
    if (was && live && !solved) joined.forEach((j, i) => { if (j && !was[i]) next.add(i); });
    // Keep a pulse running until another pair changes.
    if (next.size || was === null) fresh.current = next;
    else fresh.current = new Set([...fresh.current].filter((i) => joined[i]));
    prev.current = joined;
  }
  const cueKey = useRef(key);
  useEffect(() => {
    if (cueKey.current === key) return;
    cueKey.current = key;
    if (live && !solved && fresh.current.size) soundCue("flow.connect");
  }, [key, live, solved]);
  return fresh.current;
}
