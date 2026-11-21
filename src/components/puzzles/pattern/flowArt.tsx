/**
 * Chroma Lines (flow) art — presentation only. The tubes and dots are drawn
 * from the paths the stage already holds; nothing here changes a path, the
 * draft answer or the submission. Every tube runs through measured cell
 * centres, so it stays inside the cells the grader counts.
 */
import { useEffect, useId, useLayoutEffect, useRef, type RefObject } from "react";

import { gameFx, gameFxVariant } from "@/lib/fx/kit";

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
  // Levels (16 Nov 2026): Expert's two extra colours, a hexagon and two bars.
  CYAN: "M6.2 3.4 H13.8 L17.6 10 L13.8 16.6 H6.2 L2.4 10 Z",
  TAN: "M4.5 3.5 H8.5 V16.5 H4.5 Z M11.5 3.5 H15.5 V16.5 H11.5 Z",
};

/** One bead: the rendered marble, its symbol on top; it fills its box (the dot, 72 % of a cell). */
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

function hexToHsl(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
    return Math.round(v * 255);
  };
  const [r, g, b] = s === 0 ? [l, l, l].map((v) => Math.round(v * 255)) : [ch(h + 1 / 3), ch(h), ch(h - 1 / 3)];
  return `#${((r! << 16) | (g! << 8) | b!).toString(16).padStart(6, "0")}`;
}

/**
 * The tube's body colour: the line's own colour (the old look, Joe's pick of 20 Nov 2026, earlier E1.3). The deep
 * pigment of 15 Nov 2026 is gone with the glossy tube.
 */
export function tubeBody(hex: string): string {
  return hex;
}
/** One stroke of a tube, bottom to top. `shift` moves it towards the top-left light (the highlight stripe). */
export interface TubeLayer {
  stroke: string;
  width: number;
  opacity?: number;
  shift?: number;
  /** The neon halo under the line (a blurred copy, the board's filter; live round only, batch-p.css). */
  halo?: boolean;
}

/**
 * The old neon line (Joe's pick of 20 Nov 2026, earlier E1.3): a blurred halo in the line's colour under it (brighter
 * once its pair is joined), a dark rim, the colour body and a soft light streak along it.
 */
export function tubeLayers(colour: string, width: number, joined = true): TubeLayer[] {
  return [
    { stroke: colour, width: width * 1.5, opacity: joined ? 0.95 : 0.55, halo: true },
    { stroke: shadeHex(colour, -0.55), width: width + 3, opacity: 0.85 },
    { stroke: colour, width },
    { stroke: shadeHex(colour, 0.6), width: Math.max(1, width * 0.3), opacity: 0.55 },
  ];
}

function pathData(points: readonly { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}

export interface FlowTube {
  colour: string;
  points: { x: number; y: number }[];
  joined: boolean;
}

type Pt = { x: number; y: number };

/** The box the line's newest square is drawn in (its head), from the square before it to past the head's cap. */
function headBox(p: Pt, q: Pt, width: number): { x: number; y: number; w: number; h: number } {
  const ext = width * 0.62 + 2.5;
  const half = Math.max(width / 2 + 2, width * 0.62 + 1.5);
  if (Math.abs(q.x - p.x) >= Math.abs(q.y - p.y)) {
    const x0 = q.x >= p.x ? p.x : q.x - ext;
    const x1 = q.x >= p.x ? q.x + ext : p.x;
    return { x: x0, y: p.y - half, w: x1 - x0, h: 2 * half };
  }
  const y0 = q.y >= p.y ? p.y : q.y - ext;
  const y1 = q.y >= p.y ? q.y + ext : p.y;
  return { x: p.x - half, y: y0, w: 2 * half, h: y1 - y0 };
}

/**
 * The drawn paths as glossy tubes. Each tube's newest square (its head) is drawn layer by layer in its own clipped
 * group, so on the live board the head can slide into the new square while the rest of the tube stays still; drawn
 * still, the layers join exactly as one path would. A loose end gets a small cap so it reads as "carry on from here".
 *
 * `live` (the playable board) runs the effects (presentation only, the effects kit, transform and opacity): the head
 * grows into each new square (kit `slide`), a pair joined sends one light along its tube, a line cut back retracts
 * into the cut, and the solve pulses every line together (kit `win`). Sounds stay the stage's own cues.
 */
export function FlowTubes({
  tubes,
  width,
  live = false,
  solved = false,
  solveFx = false,
}: {
  tubes: FlowTube[];
  width: number;
  live?: boolean;
  /** Every pair joined and every square filled (the solving join plays the solve, not a join light). */
  solved?: boolean;
  /** True while the solve moment runs (useSolveMoment): every line pulses together once. */
  solveFx?: boolean;
}) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const root = useRef<SVGGElement | null>(null);
  const ghosts = useRef<SVGGElement | null>(null);
  const fxTop = useRef<SVGGElement | null>(null);
  useFlowTubeFx({ tubes, width, live, solved, solveFx, root, ghosts, fxTop });
  const neon = `${uid}-neon`;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* The neon halo's blur (live round only: batch-p.css shows .flow-halo there). */}
      <defs>
        <filter id={neon} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={Math.max(2, width * 0.45)} />
        </filter>
      </defs>
      <g ref={ghosts} data-flow-ghosts="" />
      <g ref={root}>
        {tubes.map((tube, index) => {
          const n = tube.points.length;
          if (n < 2) return null;
          const layers = tubeLayers(tube.colour, width, tube.joined);
          const bodyD = n > 2 ? pathData(tube.points.slice(0, n - 1)) : null;
          const p = tube.points[n - 2]!;
          const q = tube.points[n - 1]!;
          const headD = pathData([p, q]);
          const box = headBox(p, q, width);
          const clip = `${uid}-h${index}`;
          const clipShift = `${uid}-s${index}`;
          const shift = 0;
          const body = tubeBody(tube.colour);
          return (
            <g key={index} className="flow-tube" data-flow-tube={index}>
              <defs>
                <clipPath id={clip}>
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} />
                </clipPath>
                <clipPath id={clipShift}>
                  <rect x={box.x + shift} y={box.y + shift} width={box.w} height={box.h} />
                </clipPath>
              </defs>
              {/* The halo runs the whole line unclipped (its blur spreads past the head's box). */}
              {layers.filter((layer) => layer.halo).map((layer, li) => (
                <path key={`halo${li}`} d={pathData(tube.points)} className="flow-halo" filter={`url(#${neon})`} stroke={layer.stroke} strokeOpacity={layer.opacity} strokeWidth={layer.width} />
              ))}
              {layers.filter((layer) => !layer.halo).map((layer, li) => {
                const move = layer.shift ? `translate(${layer.shift.toFixed(2)} ${layer.shift.toFixed(2)})` : undefined;
                return (
                  <g key={li}>
                    {bodyD ? <path d={bodyD} stroke={layer.stroke} strokeOpacity={layer.opacity} strokeWidth={layer.width} transform={move} /> : null}
                    <g clipPath={`url(#${layer.shift ? clipShift : clip})`}>
                      <g className="flow-tube-head" data-flow-head="">
                        <path d={headD} stroke={layer.stroke} strokeOpacity={layer.opacity} strokeWidth={layer.width} transform={move} />
                      </g>
                    </g>
                  </g>
                );
              })}
              {!tube.joined ? (
                <g clipPath={`url(#${clip})`}>
                  <g className="flow-tube-head" data-flow-head="">
                    <circle cx={q.x} cy={q.y} r={width * 0.62} className="flow-loose-end" fill={body} stroke={shadeHex(body, 0.7)} strokeWidth={1.2} />
                  </g>
                </g>
              ) : null}
            </g>
          );
        })}
      </g>
      <g ref={fxTop} data-flow-fx="" />
    </g>
  );
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** A plain copy of a tube (its layers on `points`) for a passing effect: the retracting cut, the solve's light. */
function tubeCopy(points: readonly Pt[], layers: readonly TubeLayer[]): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g");
  const d = pathData(points);
  for (const layer of layers) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("stroke", layer.stroke);
    path.setAttribute("stroke-width", String(layer.width));
    if (layer.opacity !== undefined) path.setAttribute("stroke-opacity", String(layer.opacity));
    if (layer.shift) path.setAttribute("transform", `translate(${layer.shift} ${layer.shift})`);
    g.appendChild(path);
  }
  return g;
}

function samePoint(a: Pt | undefined, b: Pt | undefined): boolean {
  return !!a && !!b && Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05;
}

function isPrefix(short: readonly Pt[], long: readonly Pt[]): boolean {
  return short.every((p, i) => samePoint(p, long[i]));
}

/** Plays `frames` on a passing effect element and removes it when done (never throws). */
function playAndRemove(el: Element, frames: Keyframe[], ms: number, easing: string): void {
  try {
    const a = (el as HTMLElement).animate(frames, { duration: ms, easing, fill: "forwards" });
    a.onfinish = () => el.remove();
    a.oncancel = () => el.remove();
  } catch {
    el.remove();
  }
}

/** Timings of the board's own effects by the kit's variant (reduced: the 120 ms crossfade, no movement). */
export const FLOW_FX_MS = {
  retract: { full: 240, lite: 160, reduced: 120 },
  join: { perSquare: 30, min: 220, max: 560, lite: 0.6, reduced: 120 },
  solveFade: { full: 300, lite: 200, reduced: 120 },
} as const;

function useFlowTubeFx({
  tubes,
  width,
  live,
  solved,
  solveFx,
  root,
  ghosts,
  fxTop,
}: {
  tubes: FlowTube[];
  width: number;
  live: boolean;
  solved: boolean;
  solveFx: boolean;
  root: RefObject<SVGGElement | null>;
  ghosts: RefObject<SVGGElement | null>;
  fxTop: RefObject<SVGGElement | null>;
}) {
  const prev = useRef<{ tubes: FlowTube[]; width: number } | null>(null);
  const wasSolved = useRef(solveFx);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = { tubes, width };
    if (!live || !before || before.width !== width || typeof document === "undefined") return;
    tubes.forEach((tube, index) => {
      const old = before.tubes[index];
      if (!old) return;
      const now = tube.points;
      const was = old.points;
      // The head grows smoothly into the new square (kit slide, FLIP: drawn from the square before).
      if (now.length === was.length + 1 && now.length >= 2 && isPrefix(was, now)) {
        const p = now[now.length - 2]!;
        const q = now[now.length - 1]!;
        const heads = root.current?.querySelectorAll(`[data-flow-tube="${index}"] [data-flow-head]`) ?? [];
        heads.forEach((el) => gameFx("slide", el, { from: { x: p.x - q.x, y: p.y - q.y }, silent: true }));
      }
      // A line cut back (or drawn back over itself): the cut part retracts into the cut.
      if (now.length < was.length && was.length >= 2 && isPrefix(now, was)) {
        const from = Math.max(0, now.length - 1);
        const tail = was.slice(from);
        const layer = ghosts.current;
        if (layer && tail.length >= 2) {
          const ghost = tubeCopy(tail, tubeLayers(old.colour, width).filter((l) => !l.halo));
          ghost.setAttribute("data-flow-retract", "");
          const at = tail[0]!;
          ghost.style.transformBox = "view-box";
          ghost.style.transformOrigin = `${at.x}px ${at.y}px`;
          layer.appendChild(ghost);
          const variant = gameFxVariant("slide");
          const frames: Keyframe[] =
            variant === "reduced"
              ? [{ opacity: 1 }, { opacity: 0 }]
              : [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0.12)", opacity: 0 }];
          const ms = variant === "reduced" ? FLOW_FX_MS.retract.reduced : variant === "full" ? FLOW_FX_MS.retract.full : FLOW_FX_MS.retract.lite;
          playAndRemove(ghost, frames, ms, "cubic-bezier(.5,0,.75,.4)");
        }
      }
      // A pair joined (not the solving join): one light runs along its tube, end to end.
      if (tube.joined && !old.joined && !solved && now.length >= 2) {
        const variant = gameFxVariant("match");
        const group = root.current?.querySelector(`[data-flow-tube="${index}"]`);
        if (variant === "reduced") {
          if (group) playAndKeep(group, [{ opacity: 0.55 }, { opacity: 1 }], FLOW_FX_MS.join.reduced);
          return;
        }
        const top = fxTop.current;
        if (!top) return;
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", "0");
        dot.setAttribute("cy", "0");
        dot.setAttribute("r", String(Math.max(2, width * 0.3)));
        dot.setAttribute("fill", shadeHex(tubeBody(tube.colour), 0.72));
        dot.setAttribute("data-flow-join-light", "");
        top.appendChild(dot);
        const lengths = [0];
        for (let i = 1; i < now.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(now[i]!.x - now[i - 1]!.x, now[i]!.y - now[i - 1]!.y));
        const total = lengths[lengths.length - 1] || 1;
        const last = now.length - 1;
        const frames: Keyframe[] = now.map((pt, i) => {
          const at = lengths[i]! / total;
          // Kit match's swell: it grows towards the middle of the run and shrinks into the far bead.
          const s = 0.7 + 0.45 * Math.sin(Math.PI * at);
          return { offset: at, transform: `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) scale(${s.toFixed(3)})`, opacity: i === 0 || i === last ? 0 : 1 };
        });
        const base = Math.min(FLOW_FX_MS.join.max, Math.max(FLOW_FX_MS.join.min, FLOW_FX_MS.join.perSquare * now.length + 120));
        playAndRemove(dot, frames, variant === "full" ? base : Math.round(base * FLOW_FX_MS.join.lite), "ease-in-out");
      }
    });
  });
  // The solve: every line pulses together, a light copy of every tube landing on it (kit win, its gold burst and
  // haptic; the sound is the board's flow.solve), then fading.
  useLayoutEffect(() => {
    const rising = solveFx && !wasSolved.current;
    wasSolved.current = solveFx;
    if (!live || !rising || typeof document === "undefined") return;
    const top = fxTop.current;
    if (!top) return;
    const sheen = document.createElementNS(SVG_NS, "g");
    sheen.setAttribute("data-flow-solve-light", "");
    for (const tube of tubes) {
      if (tube.points.length < 2) continue;
      sheen.appendChild(tubeCopy(tube.points, [{ stroke: shadeHex(tubeBody(tube.colour), 0.6), width: width * 0.5 }]));
    }
    const svg = top.ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    sheen.style.transformBox = "view-box";
    sheen.style.transformOrigin = box ? `${box.width / 2}px ${box.height / 2}px` : "50% 50%";
    top.appendChild(sheen);
    const variant = gameFxVariant("win");
    const fade = variant === "reduced" ? FLOW_FX_MS.solveFade.reduced : variant === "full" ? FLOW_FX_MS.solveFade.full : FLOW_FX_MS.solveFade.lite;
    const win = gameFx("win", sheen, { silent: true });
    const out = () => playAndRemove(sheen, [{ opacity: 1 }, { opacity: 0 }], fade, "ease-out");
    if (win) win.finished.then(out, () => sheen.remove());
    else out();
  }, [solveFx, live, tubes, width, fxTop]);
}

/** A crossfade back to the element's own look (reduced motion). */
function playAndKeep(el: Element, frames: Keyframe[], ms: number): void {
  try {
    (el as HTMLElement).animate(frames, { duration: ms, easing: "ease-out" });
  } catch {
    /* presentation only */
  }
}

/**
 * Live board cues (no audio): `flow.connect` when a colour joins its partner
 * (not on the solving join, which is `flow.solve`). Returns the pairs that
 * joined on this render.
 */
export function useFlowJoins(joined: boolean[], live: boolean, solved: boolean): ReadonlySet<number> {
  const prev = useRef<boolean[] | null>(null);
  const fresh = useRef<Set<number>>(new Set());
  const key = joined.map((j) => (j ? 1 : 0)).join("");
  const was = prev.current;
  if (was === null || was.join() !== joined.join()) {
    const next = new Set<number>();
    if (was && live && !solved) joined.forEach((j, i) => { if (j && !was[i]) next.add(i); });
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
