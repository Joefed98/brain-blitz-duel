/**
 * Pipeline art. Presentation only. Since the polish plan (Joe's pick of 20 Nov 2026, earlier E1.4) the board draws the
 * old SVG pipework of the 13 Oct polish again (steel tubes, flanges and rivets, a hub, the blue lit network, the red
 * source pump, a red drip at each open end), at today's bigger pipe size: each arm runs into the board gap, so tubes
 * meet their neighbours'. The Blender sprites of the Pattern overhaul (15 Nov 2026) stay on disk and listed
 * (`pipeArtUrls`); the board no longer draws them. Nothing here reads or changes what the stage grades; water
 * directions come from the presentation-only BFS.
 */
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { PIPE_E, PIPE_N, PIPE_S, PIPE_W } from "@/lib/duel/logic";
import { PIPE_DRAIN_STEP_MS, PIPE_DRAIN_TILE_MS, PIPE_FLOW_TOTAL_MS, pipeTurnFx } from "./pipesFx";

/** How long a drained pipe keeps its wet layers, so the drain (pipesFx.ts) has water to run out: every drain ends by then. */
const PIPE_DRAIN_HOLD_MS = PIPE_FLOW_TOTAL_MS + PIPE_DRAIN_TILE_MS + PIPE_DRAIN_STEP_MS;

/** Each open side, as a rotation of the canonical north arm. */
export const PIPE_ARMS: { bit: number; turn: number; dx: number; dy: number }[] = [
  { bit: PIPE_N, turn: 0, dx: 0, dy: -1 },
  { bit: PIPE_E, turn: 90, dx: 1, dy: 0 },
  { bit: PIPE_S, turn: 180, dx: 0, dy: 1 },
  { bit: PIPE_W, turn: 270, dx: -1, dy: 0 },
];

/** The sprites (public/pattern-art/pipes/). */
export const PIPE_ART_BASE = "/pattern-art/pipes";
export const PIPE_SHAPES = ["end", "straight", "corner", "tee", "cross"] as const;
export type PipeShape = (typeof PIPE_SHAPES)[number];

/** Each shape's side-set as its sprite draws it: the open sides from north, clockwise. */
const CANONICAL: Record<PipeShape, number> = {
  end: PIPE_N,
  straight: PIPE_N | PIPE_S,
  corner: PIPE_N | PIPE_E,
  tee: PIPE_N | PIPE_E | PIPE_S,
  cross: PIPE_N | PIPE_E | PIPE_S | PIPE_W,
};

function turnMask(mask: number, turns: number): number {
  let out = 0;
  for (let bit = 0; bit < 4; bit++) if (mask & (1 << bit)) out |= 1 << ((bit + turns) % 4);
  return out;
}

/** The sprite and its quarter turns clockwise for a side-set (null for a tile with no pipe). */
export function pipeSprite(mask: number): { shape: PipeShape; turns: number } | null {
  for (const shape of PIPE_SHAPES) {
    for (let turns = 0; turns < 4; turns++) if (turnMask(CANONICAL[shape], turns) === (mask & 15)) return { shape, turns };
  }
  return null;
}

/** Each shape's distinct turns, each rendered with the key light top left (the richness pass, 15 Nov 2026). */
export const PIPE_TURNS: Record<PipeShape, number> = { end: 4, straight: 2, corner: 4, tee: 4, cross: 1 };

/** A pipe sprite's URL: the shape in its turn, dry or wet. */
export function pipeSpriteUrl(shape: PipeShape, turns: number, wet: boolean): string {
  return `${PIPE_ART_BASE}/${shape}-${turns % PIPE_TURNS[shape]}-${wet ? "wet" : "dry"}.webp`;
}

/**
 * How far each pipe sprite runs past every tile edge, as a share of the tile (pipes.py BLEED, 12 of 100). The board
 * crops it at half its gap (`--pipe-gap`), so a tube meets its neighbour's in the middle of the gap with no seam.
 * Presentation only: the tile button, its hit area and its box are unchanged.
 */
export const PIPE_BLEED = 0.12;

/** Every sprite the board draws (checks and preloading). */
export function pipeArtUrls(): string[] {
  return [
    `${PIPE_ART_BASE}/tile.webp`,
    `${PIPE_ART_BASE}/valve.webp`,
    `${PIPE_ART_BASE}/spill.webp`,
    ...PIPE_SHAPES.flatMap((shape) =>
      Array.from({ length: PIPE_TURNS[shape] }, (_, t) => [pipeSpriteUrl(shape, t, false), pipeSpriteUrl(shape, t, true)]).flat(),
    ),
  ];
}

/**
 * The board's shared clip for the ripples in the water channel (the old look, Joe's pick of 20 Nov 2026; earlier E1.4).
 * `id` keeps two boards' defs apart (the reveal draws two).
 */
export function PipeDefs({ id }: { id: string }) {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="pointer-events-none absolute">
      <defs>
        <clipPath id={`${id}-channel`} clipPathUnits="userSpaceOnUse">
          <rect x={PIPE_SVG.channelX} y={-PIPE_SVG.reach} width={PIPE_SVG.channelW} height={50 + PIPE_SVG.reach} />
        </clipPath>
      </defs>
    </svg>
  );
}

/**
 * The old pipework's geometry in its 0–100 tile box, drawn at today's pipe size (Joe: "the old look, with the bigger
 * pipes"): the tube 38 % of the tile across, as the old one, and each arm runs past the tile edge into the board gap,
 * cropped at its middle by `.pipe-turn` (the tile plus half the gap each side), so tubes meet their neighbours' as
 * today's do. Presentation only: the tile button, its box and hit area are unchanged.
 */
export const PIPE_SVG = {
  tubeX: 31,
  tubeW: 38,
  channelX: 41,
  channelW: 18,
  /** How far an arm runs past the tile edge, in tile units (as the sprites' PIPE_BLEED); cropped at half the gap. */
  reach: 12,
} as const;

/* The tile art as cached SVG images (one element a tile, so a 49-tile board paints at once: first-paint-check; the
   same drawing as the old inline SVG, its colours written in). Keyed by side-set, source and which layer. */
const GRADIENTS =
  '<linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#56606e"/><stop offset="0.22" stop-color="#adb8c5"/><stop offset="0.42" stop-color="#f6f9fc"/><stop offset="0.6" stop-color="#c8d1db"/><stop offset="1" stop-color="#5e6876"/></linearGradient>' +
  '<linearGradient id="w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d4f86"/><stop offset="0.22" stop-color="#2f9be6"/><stop offset="0.42" stop-color="#d4f2ff"/><stop offset="0.6" stop-color="#66c4f5"/><stop offset="1" stop-color="#11568f"/></linearGradient>' +
  '<linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f86e0"/><stop offset="0.45" stop-color="#6fd8ff"/><stop offset="0.6" stop-color="#b5ecff"/><stop offset="1" stop-color="#1f86e0"/></linearGradient>' +
  '<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d2dc"/><stop offset="0.55" stop-color="#8a95a3"/><stop offset="1" stop-color="#4a525e"/></linearGradient>' +
  '<radialGradient id="h" cx="0.4" cy="0.36" r="0.7"><stop offset="0" stop-color="#f1f5f9"/><stop offset="0.45" stop-color="#9ba7b5"/><stop offset="1" stop-color="#3b434e"/></radialGradient>' +
  '<radialGradient id="p" cx="0.4" cy="0.35" r="0.72"><stop offset="0" stop-color="#ffb39a"/><stop offset="0.5" stop-color="#e2483a"/><stop offset="1" stop-color="#7c1d18"/></radialGradient>';

function armsOf(mask: number) {
  return PIPE_ARMS.filter((arm) => mask & arm.bit);
}

function tubesSvg(mask: number, wet: boolean): string {
  const r = PIPE_SVG.reach;
  return armsOf(mask)
    .map(
      (arm) =>
        `<g transform="rotate(${arm.turn} 50 50)"><rect x="${PIPE_SVG.tubeX}" y="${-r}" width="${PIPE_SVG.tubeW}" height="${52 + r}" fill="url(#${wet ? "w" : "t"})"/>` +
        `<rect x="${PIPE_SVG.channelX}" y="${-r}" width="${PIPE_SVG.channelW}" height="${50 + r}" fill="${wet ? "url(#a)" : "#34404e"}"/></g>`,
    )
    .join("");
}

function fittingsSvg(mask: number, source: boolean, eyeWet: boolean): string {
  const flanges = armsOf(mask)
    .map(
      (arm) =>
        `<g transform="rotate(${arm.turn} 50 50)"><rect x="26" y="0.5" width="48" height="8" rx="1.6" fill="url(#f)" stroke="#2a3039" stroke-width="1"/>` +
        `<circle cx="30.5" cy="4.5" r="1.9" fill="#dfe5ec" stroke="#2a3039" stroke-width="0.9"/><circle cx="69.5" cy="4.5" r="1.9" fill="#dfe5ec" stroke="#2a3039" stroke-width="0.9"/></g>`,
    )
    .join("");
  const hub = source
    ? `<circle cx="50" cy="50" r="27" fill="url(#p)" stroke="#4a1210" stroke-width="1.6"/>` +
      [0, 60, 120].map((t) => `<rect x="47.5" y="27" width="5" height="46" rx="2.5" transform="rotate(${t} 50 50)" fill="#f6d6cf" stroke="#6d1a15" stroke-width="0.8"/>`).join("") +
      `<circle cx="50" cy="50" r="10" fill="url(#h)" stroke="#2a3039" stroke-width="1.2"/><circle cx="50" cy="50" r="5" fill="#7bd8fb"/>`
    : `<circle cx="50" cy="50" r="20" fill="url(#h)" stroke="#262c34" stroke-width="1.4"/>` +
      [45, 135, 225, 315].map((t) => `<circle cx="50" cy="35.5" r="2" transform="rotate(${t} 50 50)" fill="#dfe5ec" stroke="#2a3039" stroke-width="0.9"/>`).join("") +
      `<circle cx="50" cy="50" r="8.5" fill="${eyeWet ? "#8fe0ff" : "#26303b"}" stroke="#262c34" stroke-width="1.2"/>`;
  return flanges + hub;
}

const artCache = new Map<string, string>();
/**
 * One layer of a tile's pipework as an SVG data URL, drawn in a box 12 tile units larger than the tile on every side
 * (the arms run into the board gap; `.pipe-turn` crops them at its middle): "dry" (the steel tubes with the fittings),
 * "wet" (the blue tube and its water) or "top" (the fittings again, over the water).
 */
export function pipeArtUrl(mask: number, source: boolean, layer: "dry" | "wet" | "top", eyeWet = false): string {
  const key = `${mask}|${source ? 1 : 0}|${layer}|${eyeWet ? 1 : 0}`;
  const hit = artCache.get(key);
  if (hit) return hit;
  const r = PIPE_SVG.reach;
  const body =
    layer === "dry" ? tubesSvg(mask, false) + fittingsSvg(mask, source, false) : layer === "wet" ? tubesSvg(mask, true) : fittingsSvg(mask, source, eyeWet);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-r} ${-r} ${100 + 2 * r} ${100 + 2 * r}"><defs>${GRADIENTS}</defs>${body}</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  artCache.set(key, url);
  return url;
}

/**
 * One tile's pipework: the old SVG pipes (steel tubes, a dark channel, flanges and rivets, a hub; cached SVG images,
 * `pipeArtUrl`), dry under wet (the blue tube with the rippling water, drawn only while the water is in it) in its own
 * clipping box, so water can run in and drain out (pipesFx.ts); the
 * source's red pump on top; the old red drip at each open end of the network (`leakArms`). Memoised on its primitive
 * props (a board is 49 of these and the round clocks re-render the stage ten times a second).
 */
export const PipeArt = memo(function PipeArt({
  defs,
  mask,
  wet,
  source,
  leakArms = 0,
  turnKey,
  turnDir = 1,
  inflow = 0,
}: {
  /** The board's PipeDefs id. */
  defs: string;
  mask: number;
  wet: boolean;
  source: boolean;
  /** Open sides of a wet pipe that nothing joins: the water drips there. */
  leakArms?: number;
  /** Changes on every turn; plays the quarter-turn. */
  turnKey: number;
  /** The last turn's direction: 1 clockwise, -1 anticlockwise. */
  turnDir?: 1 | -1;
  /** The arms water enters through (towards the source): their ripples run inwards. */
  inflow?: number;
}) {
  const turnRef = useRef<HTMLSpanElement>(null);
  const lastTurn = useRef(turnKey);
  const sprite = pipeSprite(mask);

  useLayoutEffect(() => {
    if (turnKey === lastTurn.current) return;
    lastTurn.current = turnKey;
    // The pipework ratchets in from where the tile was, in two clicks (pipesFx.ts; a crossfade under reduced motion).
    // Only the art turns; the tile button, its box and hit area never move.
    pipeTurnFx(turnRef.current, turnDir);
  }, [turnKey, turnDir]);

  // The wet layers are drawn only while the water is in the pipe, and for a moment after it leaves (the drain runs on
  // them, pipesFx.ts): a dry tile is one SVG, so a 49-tile board stays light enough to paint at once (first-paint-check).
  const [wetShown, setWetShown] = useState(wet);
  useEffect(() => {
    if (wet) {
      setWetShown(true);
      return;
    }
    const t = setTimeout(() => setWetShown(false), PIPE_DRAIN_HOLD_MS);
    return () => clearTimeout(t);
  }, [wet]);
  const showWet = wet || wetShown;

  const arms = PIPE_ARMS.filter((arm) => mask & arm.bit);
  const r = PIPE_SVG.reach;
  return (
    <span className="pipe-art" aria-hidden="true">
      {sprite ? (
        <span ref={turnRef} className="pipe-turn" data-pipe-turns={sprite.turns}>
          <span className="pipe-frame">
            <img className="pipe-svg" data-pipe-layer="dry" src={pipeArtUrl(mask, source, "dry")} alt="" draggable={false} />
          </span>
          {/* The water: the blue tube and its rippling water in their own clipping box, so water can run in from the
              side it enters by (pipesFx); the fittings drawn again over it. */}
          <span className="pipe-wet" data-wet={wet ? "true" : undefined}>
            <span className="pipe-wet-in">
              {showWet ? (
                <span className="pipe-frame">
                  <img className="pipe-svg" data-pipe-layer="wet" src={pipeArtUrl(mask, source, "wet")} alt="" draggable={false} />
                  <svg viewBox={`${-r} ${-r} ${100 + 2 * r} ${100 + 2 * r}`} className="pipe-svg" aria-hidden="true">
                    {arms.map((arm) => (
                      <g key={arm.bit} transform={`rotate(${arm.turn} 50 50)`} clipPath={`url(#${defs}-channel)`}>
                        <g className={inflow & arm.bit ? "pipe-ripple pipe-ripple-in" : "pipe-ripple"}>
                          {[-24, -12, 0, 12, 24, 36, 48, 60].map((y) => (
                            <rect key={y} x="47" y={y} width="6" height="5" rx="2.5" className="pipe-ripple-dot" />
                          ))}
                        </g>
                      </g>
                    ))}
                  </svg>
                </span>
              ) : null}
            </span>
          </span>
          {showWet ? (
            <span className="pipe-frame">
              <img className="pipe-svg" data-pipe-layer="top" src={pipeArtUrl(mask, source, "top", wet)} alt="" draggable={false} />
            </span>
          ) : null}
        </span>
      ) : null}
      {/* The old red drip at each open end of the network, at that arm's mouth (north, turned to its side). */}
      {PIPE_ARMS.filter((arm) => leakArms & arm.bit).map((arm) => (
        <span key={arm.bit} className="pipe-spill" data-pipe-leak={arm.bit} style={{ transform: `rotate(${arm.turn}deg)` }}>
          <span className="pipe-leak" />
        </span>
      ))}
    </span>
  );
});

/**
 * The solve-time rush through one tile: a bright water front in through its inflow arms, out of the rest. Each arm is a
 * bar that grows from its start (a scale, transform only), so the rush runs along the path.
 */
export function PipeSurge({
  mask,
  inflow,
  delay,
  step,
}: {
  mask: number;
  inflow: number;
  delay: number;
  step: number;
}) {
  const half = step / 2;
  return (
    <svg viewBox="0 0 100 100" className="pipe-surge pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {PIPE_ARMS.filter((arm) => mask & arm.bit).map((arm) => {
        const into = Boolean(inflow & arm.bit);
        const style = {
          "--surge-delay": `${Math.round(into ? delay : delay + half)}ms`,
          "--surge-ms": `${Math.max(30, Math.round(half))}ms`,
          // In through the edge: grows from the edge towards the centre; out: from the centre towards the edge.
          transformOrigin: into ? "50% 0%" : "50% 100%",
        } as CSSProperties;
        return (
          <g key={arm.bit} transform={`rotate(${arm.turn} 50 50)`}>
            <rect x="45.5" y="0" width="9" height="50" rx="4.5" className="pipe-surge-line" style={style} />
          </g>
        );
      })}
      <circle
        cx="50"
        cy="50"
        r="12"
        className="pipe-surge-hub"
        style={{ "--surge-delay": `${Math.round(delay + half * 0.8)}ms` } as CSSProperties}
      />
    </svg>
  );
}
