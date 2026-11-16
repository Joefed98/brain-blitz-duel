/**
 * Pipeline art (the Pattern overhaul, 15 Nov 2026; SVG since the 13 Oct polish until then). Presentation only: the
 * Blender sprites (docs/design/game-art/pattern/source/pipes.py: chrome pipes on dark tiles, water in the connected
 * network's glass tube, the red source valve, a spill at each open end of the network) and the solve-time rush. Each
 * pipe sprite runs past its tile into the board gap (PIPE_BLEED), so neighbouring tubes join seamlessly.
 * Nothing here reads or changes what the stage grades; water directions come from the presentation-only BFS.
 */
import { memo, useLayoutEffect, useRef, type CSSProperties } from "react";

import { PIPE_E, PIPE_N, PIPE_S, PIPE_W } from "@/lib/duel/logic";
import { pipeTurnFx } from "./pipesFx";

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
 * One tile's pipework: the shape's sprite in its turn (each turn rendered, so the light stays top left), dry (chrome)
 * under wet (water in the sight glass), its own clipping box, so water can run in and drain out (pipesFx.ts); the source's red valve on top; a spill at each open end of the network
 * (`leakArms`). Inside the tile's box. Memoised on its primitive props (a board is 49 of these and the round clocks
 * re-render the stage ten times a second).
 */
export const PipeArt = memo(function PipeArt({
  mask,
  wet,
  source,
  leakArms = 0,
  turnKey,
  turnDir = 1,
}: {
  mask: number;
  wet: boolean;
  source: boolean;
  /** Open sides of a wet pipe that nothing joins: the water spills there. */
  leakArms?: number;
  /** Changes on every turn; plays the quarter-turn. */
  turnKey: number;
  /** The last turn's direction: 1 clockwise, -1 anticlockwise. */
  turnDir?: 1 | -1;
}) {
  const turnRef = useRef<HTMLSpanElement>(null);
  const lastTurn = useRef(turnKey);
  const sprite = pipeSprite(mask);

  useLayoutEffect(() => {
    if (turnKey === lastTurn.current) return;
    lastTurn.current = turnKey;
    // The new turn's sprite ratchets in from where the tile was, in two clicks (pipesFx.ts; a crossfade under reduced
    // motion). Only the art turns; the tile button, its box and hit area never move.
    pipeTurnFx(turnRef.current, turnDir);
  }, [turnKey, turnDir]);

  return (
    <span className="pipe-art" aria-hidden="true">
      {sprite ? (
        <span ref={turnRef} className="pipe-turn" data-pipe-turns={sprite.turns}>
          <span className="pipe-frame">
            <img className="pipe-sprite" src={pipeSpriteUrl(sprite.shape, sprite.turns, false)} alt="" draggable={false} decoding="async" />
          </span>
          {/* The water: the wet set in its own clipping box, so water can run in from the side it enters by (pipesFx). */}
          <span className="pipe-wet" data-wet={wet ? "true" : undefined}>
            <span className="pipe-wet-in">
              <span className="pipe-frame">
                <img className="pipe-sprite pipe-sprite-wet" src={pipeSpriteUrl(sprite.shape, sprite.turns, true)} alt="" draggable={false} decoding="async" />
              </span>
            </span>
          </span>
        </span>
      ) : null}
      {PIPE_ARMS.filter((arm) => leakArms & arm.bit).map((arm) => (
        <span key={arm.bit} className="pipe-spill" data-pipe-leak={arm.bit} style={{ transform: `rotate(${arm.turn}deg)` }}>
          <img src={`${PIPE_ART_BASE}/spill.webp`} alt="" draggable={false} decoding="async" />
        </span>
      ))}
      {source ? <img className="pipe-source" src={`${PIPE_ART_BASE}/valve.webp`} alt="" draggable={false} decoding="async" /> : null}
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
