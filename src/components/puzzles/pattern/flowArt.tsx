/**
 * Chroma Lines (flow) art — presentation only. The tubes and dots are drawn
 * from the paths the stage already holds; nothing here changes a path, the
 * draft answer or the submission. Every tube runs through measured cell
 * centres, so it stays inside the cells the grader counts.
 */
import { useEffect, useRef } from "react";

import { soundCue } from "@/lib/fx/patternFx";
import type { FlowColour } from "@/lib/duel/types";

/**
 * The Pattern overhaul (15 Nov 2026, look A): each dot is a glossy marble bead rendered in Blender
 * (docs/design/game-art/pattern/source/flow.py, public/pattern-art/flow/bead-<colour>.webp), one per line colour.
 */
export function flowBeadUrl(colour: FlowColour): string {
  return `/pattern-art/flow/bead-${colour.toLowerCase()}.webp`;
}
export const FLOW_WALL_URL = "/pattern-art/flow/wall.webp";
export const FLOW_CELL_URL = "/pattern-art/flow/cell.webp";

/**
 * A small symbol in each bead, so colours close to each other (white and silver, yellow and lime) are told apart
 * at a glance. Paths on a 20 x 20 box, drawn white over a dark outline so they read on every bead.
 */
export const FLOW_SYMBOL_PATH: Record<FlowColour, string> = {
  RED: "M10 3 L17.5 16 H2.5 Z",
  BLUE: "M4 4 H16 V16 H4 Z",
  GREEN: "M8 3 H12 V8 H17 V12 H12 V17 H8 V12 H3 V8 H8 Z",
  PURPLE: "M10 2.5 L17.5 10 L10 17.5 L2.5 10 Z",
  PINK: "M10 2.5 L12.2 7.4 L17.5 7.9 L13.5 11.4 L14.7 16.6 L10 13.9 L5.3 16.6 L6.5 11.4 L2.5 7.9 L7.8 7.4 Z",
  ORANGE: "M3.5 4 H16.5 L10 10 L16.5 16 H3.5 L10 10 Z",
  BROWN: "M3 7.5 H17 V12.5 H3 Z",
  YELLOW: "M10 3.5 A6.5 6.5 0 1 1 9.99 3.5 Z",
  TEAL: "M3 5 L10 12 L17 5 L17 9.5 L10 16.5 L3 9.5 Z",
  WHITE: "M5 3 L10 8 L15 3 L17 5 L12 10 L17 15 L15 17 L10 12 L5 17 L3 15 L8 10 L3 5 Z",
  LIME: "M3 4 H17 L10 16.5 Z",
  SILVER: "M10 3 A7 7 0 1 1 9.99 3 Z M10 6.6 A3.4 3.4 0 1 0 10.01 6.6 Z",
};

/** One bead: the rendered marble, its symbol on top; it fills its box (the dot's 64 % of a cell, as before). */
export function FlowBead({ colour }: { colour: FlowColour }) {
  return (
    <>
      <img className="flow-bead" src={flowBeadUrl(colour)} alt="" aria-hidden="true" draggable={false} />
      <svg className="flow-symbol" viewBox="0 0 20 20" aria-hidden="true">
        <path d={FLOW_SYMBOL_PATH[colour]} fillRule="evenodd" />
      </svg>
    </>
  );
}

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
 * The drawn paths as rich rounded tubes in their vivid colours: a dark rim, the colour body and a soft
 * specular streak (no glow since the Pattern overhaul). A loose end gets a small cap so it reads as
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
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {tubes.map((tube, index) => {
        if (tube.points.length < 2) return null;
        const d = pathData(tube.points);
        const end = tube.points[tube.points.length - 1]!;
        return (
          <g key={index} className="flow-tube">
            <path d={d} stroke={shadeHex(tube.colour, -0.6)} strokeOpacity={0.9} strokeWidth={width + 3} />
            <path d={d} stroke={shadeHex(tube.colour, -0.18)} strokeWidth={width} />
            <path d={d} stroke={tube.colour} strokeWidth={width * 0.72} />
            <path d={d} stroke={shadeHex(tube.colour, 0.55)} strokeOpacity={0.5} strokeWidth={Math.max(1, width * 0.2)} transform={`translate(${(-width * 0.12).toFixed(2)} ${(-width * 0.12).toFixed(2)})`} />
            {!tube.joined ? (
              <circle cx={end.x} cy={end.y} r={width * 0.62} className="flow-loose-end" fill={tube.colour} stroke={shadeHex(tube.colour, -0.6)} strokeWidth={1.5} />
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
