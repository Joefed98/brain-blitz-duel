/**
 * Lightbender (laser) art — presentation only. Nothing here reads or writes the
 * stage's shots, fires, history or submission: every piece is drawn from the
 * props the board already has, inside the cell (or the cell-sized overlay box)
 * it belongs to, so hit areas and what the tracer counts are unchanged.
 */
import { memo, useEffect, useId, useRef } from "react";

import { soundCue } from "@/lib/fx/patternFx";
import type { BeamDir, MirrorKind, MirrorPlacement } from "@/lib/duel/types";

/** The chevron on a directional gem, pointing the way the beam must arrive from. */
export function directionalChevronPoints(dir: BeamDir): string {
  if (dir === "R") return "3,10 6,12 3,14";
  if (dir === "L") return "21,10 18,12 21,14";
  if (dir === "D") return "10,3 12,6 14,3";
  return "10,21 12,18 14,21";
}

/* Facet shades for a cut diamond: top-left (lightest) to bottom-right (darkest). */
const LIT_FACETS = ["#FFF1BD", "#F7CC55", "#E0A622", "#B07A0E"];
const DIM_FACETS = ["#A9AEC4", "#7D8399", "#62687D", "#474C5E"];

/** A cut diamond in a 24×24 box; dim crystal until the beam passes through it. */
function GemShape({ lit }: { lit: boolean }) {
  const f = lit ? LIT_FACETS : DIM_FACETS;
  return (
    <g className={lit ? "laser-gem-lit" : undefined} key={lit ? "lit" : "dim"}>
      {lit ? <circle cx="12" cy="12" r="11" className="laser-gem-aura" /> : null}
      <polygon points="12,1.5 12,12 1.5,12" fill={f[0]} />
      <polygon points="12,1.5 22.5,12 12,12" fill={f[1]} />
      <polygon points="1.5,12 12,12 12,22.5" fill={f[2]} />
      <polygon points="12,12 22.5,12 12,22.5" fill={f[3]} />
      {/* The table: a lighter kite across the crown. */}
      <polygon points="12,5 17,10 12,12 7,10" fill="#FFFFFF" fillOpacity={lit ? 0.42 : 0.18} />
      <polygon
        points="12,1.5 22.5,12 12,22.5 1.5,12"
        fill="none"
        stroke={lit ? "#FFF6D8" : "#C9A24A"}
        strokeOpacity={lit ? 0.95 : 0.55}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      {lit ? (
        <path className="laser-gem-sparkle" d="M19 2.2L19.7 4.3L21.8 5L19.7 5.7L19 7.8L18.3 5.7L16.2 5L18.3 4.3Z" fill="#FFFFFF" />
      ) : null}
    </g>
  );
}

/** A gem cell's art; directional gems are half size with the arrival chevron. */
export const LaserGem = memo(function LaserGem({ lit, from }: { lit: boolean; from?: BeamDir | undefined }) {
  return (
    <svg viewBox="0 0 24 24" className="laser-gem h-full w-full" aria-hidden="true">
      {from ? (
        <>
          <g transform="translate(6 6) scale(.5)"><GemShape lit={lit} /></g>
          <polyline points={directionalChevronPoints(from)} fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <GemShape lit={lit} />
      )}
    </svg>
  );
});

/** A classic round bomb with a lit fuse — red-hot when the beam touches it. */
export const LaserBomb = memo(function LaserBomb({ flash }: { flash: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`laser-bomb h-full w-full ${flash ? "laser-bomb-hit" : ""}`} aria-hidden="true">
      <circle cx="11" cy="13.5" r="9.2" className="laser-bomb-danger" />
      <circle cx="11" cy="14" r="7.4" fill={flash ? "#5A1414" : "#1B1D24"} stroke={flash ? "#FF4D4D" : "#000000"} strokeOpacity={0.7} strokeWidth="0.8" />
      <ellipse cx="8.4" cy="11.2" rx="2.6" ry="1.7" transform="rotate(-35 8.4 11.2)" fill="#FFFFFF" fillOpacity="0.32" />
      <rect x="13.6" y="5.2" width="4" height="3.4" rx="0.8" transform="rotate(40 15.6 6.9)" fill="#6A6F7D" stroke="#2A2D36" strokeWidth="0.6" />
      <path d="M16.6 5.2C17.6 3.6 18.8 3.2 20 3.4" fill="none" stroke="#C9A36B" strokeWidth="1.2" strokeLinecap="round" />
      <g className="laser-bomb-spark">
        <path d="M20.4 1.2L21 2.8L22.6 3.4L21 4L20.4 5.6L19.8 4L18.2 3.4L19.8 2.8Z" fill="#FFD25A" />
        <circle cx="20.4" cy="3.4" r="0.9" fill="#FFFFFF" />
      </g>
    </svg>
  );
});

/** A glass prism splitter; its arrows show which way it splits the beam. */
export const LaserSplitter = memo(function LaserSplitter({ kind = "S-" }: { kind?: MirrorKind }) {
  return (
    <svg viewBox="0 0 24 24" className="laser-splitter h-full w-full" aria-hidden="true">
      <polygon points="12,0.9 23.1,12 12,23.1 0.9,12" fill="color-mix(in oklab, var(--opponent) 18%, #10151C)" stroke="var(--opponent)" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="12,2.6 21.4,12 2.6,12" fill="#FFFFFF" fillOpacity="0.1" />
      <path transform={kind === "S|" ? "" : "rotate(90 12 12)"} d="M12 22V12M2 12H22M2 12L6 8M2 12L6 16M22 12L18 8M22 12L18 16" fill="none" stroke="var(--opponent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path transform={kind === "S|" ? "" : "rotate(90 12 12)"} d="M12 21V12M3 12H21" fill="none" stroke="#E9FFFB" strokeOpacity="0.55" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
});

const DIR_ANGLE: Record<BeamDir, number> = { R: 0, D: 90, L: 180, U: 270 };

/** The emitter housing, nozzle facing the stored beam direction. */
export const LaserEmitter = memo(function LaserEmitter({ dir, firing = false }: { dir: BeamDir; firing?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`laser-emitter h-full w-full ${firing ? "laser-emitter-firing" : ""}`} aria-hidden="true">
      <g transform={`rotate(${DIR_ANGLE[dir]} 12 12)`}>
        <rect x="1.5" y="3" width="15" height="18" rx="3.5" fill="#2A2E39" stroke="#555B6B" strokeWidth="0.9" />
        <rect x="2.6" y="4" width="12.8" height="3.2" rx="1.6" fill="#FFFFFF" fillOpacity="0.1" />
        <rect x="15" y="8" width="7.5" height="8" rx="1.4" fill="#3A3F4D" stroke="#666C7D" strokeWidth="0.8" />
        <circle cx="9" cy="12" r="5" fill="#120F08" stroke="#8A6A1E" strokeWidth="0.9" />
        <circle cx="9" cy="12" r="3.4" className="laser-emitter-lens" />
        <circle cx="8" cy="11" r="1" fill="#FFFFFF" fillOpacity="0.85" />
        <polygon points="20,10.2 23,12 20,13.8" fill="var(--primary)" />
      </g>
    </svg>
  );
});

/** One placed mirror: a silvered bar with a dark backing, on its diagonal. */
export function LaserMirror({
  x,
  y,
  unit,
  kind,
  animate,
}: {
  x: number;
  y: number;
  unit: number;
  kind: MirrorKind;
  animate: boolean;
}) {
  const length = unit * 1.12;
  const thick = Math.max(3, unit * 0.2);
  const angle = kind === "/" ? -45 : 45;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <g className={animate ? "laser-mirror-in" : undefined}>
        <rect x={-length / 2} y={-thick / 2} width={length} height={thick} rx={thick / 2} fill="#30343F" />
        <rect x={-length / 2 + thick * 0.2} y={-thick / 2 + thick * 0.08} width={length - thick * 0.4} height={thick * 0.62} rx={thick * 0.31} fill="#F4F7FF" />
        <rect x={-length / 2 + thick * 0.6} y={-thick / 2 + thick * 0.16} width={length * 0.38} height={thick * 0.18} rx={thick * 0.09} fill="#FFFFFF" />
        <rect x={-length / 2 + thick * 0.2} y={-thick / 2 + thick * 0.5} width={length - thick * 0.4} height={thick * 0.2} fill="#AEB7CC" fillOpacity="0.7" />
      </g>
    </g>
  );
}

/** "M x y L x y …" through the given points. */
function pathData(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}

/**
 * The beam: a wide soft halo, a glow and a hot white core, as plain stroke
 * layers (no filters on the moving beam). `solved` adds a flare that brightens
 * the whole beam to full for the completion moment.
 */
export function LaserBeam({
  branches,
  unit,
  danger,
  solved,
}: {
  branches: { x: number; y: number }[][];
  unit: number;
  danger: boolean;
  solved: boolean;
}) {
  const colour = danger ? "#FF4D4D" : "#F7C548";
  const core = danger ? "#FFE1E1" : "#FFF8E0";
  const lines = branches.filter((points) => points.length > 1).map(pathData);
  const neon = `laser-neon-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!lines.length) return null;
  return (
    <g className={`laser-beam ${solved ? "laser-beam-solved" : ""}`} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* Batch P (live round only, batch-p.css): a blurred wide copy, so the beam glows like neon. */}
      <defs>
        <filter id={neon} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={Math.max(2, unit * 0.16)} />
        </filter>
      </defs>
      {lines.map((d, i) => (
        <path key={`n${i}`} d={d} className="laser-beam-neon" stroke={colour} strokeOpacity={0.85} strokeWidth={unit * 0.45} filter={`url(#${neon})`} />
      ))}
      {solved
        ? lines.map((d, i) => <path key={`f${i}`} d={d} className="laser-beam-flare" stroke={colour} strokeWidth={unit * 0.6} />)
        : null}
      {lines.map((d, i) => <path key={`h${i}`} d={d} stroke={colour} strokeOpacity={0.16} strokeWidth={unit * 0.4} />)}
      {lines.map((d, i) => <path key={`g${i}`} d={d} stroke={colour} strokeOpacity={0.8} strokeWidth={Math.max(2, unit * 0.17)} />)}
      {lines.map((d, i) => <path key={`c${i}`} d={d} className="laser-beam-core" stroke={core} strokeWidth={Math.max(1, unit * 0.065)} />)}
    </g>
  );
}

/** Light bursting from each lit gem, one after another in beam order. */
export function LaserGemBursts({ centres, unit }: { centres: { x: number; y: number }[]; unit: number }) {
  const step = centres.length > 1 ? Math.min(110, 480 / (centres.length - 1)) : 0;
  const ray = unit * 0.62;
  return (
    <g className="laser-bursts" aria-hidden="true">
      {centres.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y})`}>
          <g className="laser-burst" style={{ animationDelay: `${Math.round(i * step)}ms` }}>
            <circle r={unit * 0.55} className="laser-burst-ring" strokeWidth={Math.max(1.5, unit * 0.08)} />
            <circle r={unit * 0.3} className="laser-burst-core" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <line
                key={a}
                x1={0}
                y1={-unit * 0.28}
                x2={0}
                y2={-(a % 90 === 0 ? ray : ray * 0.72)}
                transform={`rotate(${a})`}
                className="laser-burst-ray"
                strokeWidth={Math.max(1, unit * 0.06)}
              />
            ))}
          </g>
        </g>
      ))}
    </g>
  );
}

/** Lit gems in the order the travelling beam reached them. */
export function gemsInBeamOrder(paths: number[][], offsets: number[], lit: number[]): number[] {
  const reach = new Map<number, number>();
  paths.forEach((path, index) =>
    path.forEach((cell, i) => {
      const at = (offsets[index] ?? 0) + i;
      if (!reach.has(cell) || at < reach.get(cell)!) reach.set(cell, at);
    }),
  );
  return [...lit].sort((a, b) => (reach.get(a) ?? 0) - (reach.get(b) ?? 0));
}

/**
 * Sound cues for the live board only (no audio attached): a piece placed or
 * turned, the beam leaving the emitter, each gem lighting, a bomb hit. Reads
 * what the board already draws; the first render (seeded or remounted state)
 * never cues.
 */
export function useLaserCues({
  live,
  placed,
  firing,
  litCount,
  bombHit,
}: {
  live: boolean;
  placed: MirrorPlacement[];
  firing: boolean;
  litCount: number;
  bombHit: boolean;
}) {
  const prev = useRef<{ placed: MirrorPlacement[]; firing: boolean; litCount: number; bombHit: boolean } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { placed, firing, litCount, bombHit };
    if (!live || !before) return;
    if (placed !== before.placed) {
      const was = new Map(before.placed.map((piece) => [piece.cell, piece.kind]));
      if (placed.some((piece) => !was.has(piece.cell))) soundCue("laser.place");
      else if (placed.some((piece) => was.has(piece.cell) && was.get(piece.cell) !== piece.kind)) soundCue("laser.turn");
    }
    if (firing && !before.firing) soundCue("laser.fire");
    if (firing && litCount > before.litCount) soundCue("laser.gem");
    if (bombHit && !before.bombHit) soundCue("laser.bomb");
  }, [live, placed, firing, litCount, bombHit]);
}
