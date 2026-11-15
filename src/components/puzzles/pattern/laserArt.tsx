/**
 * Lightbender (laser) art — presentation only. Nothing here reads or writes the
 * stage's shots, fires, history or submission: every piece is drawn from the
 * props the board already has, inside the cell (or the cell-sized overlay box)
 * it belongs to, so hit areas and what the tracer counts are unchanged.
 */
import { memo, useEffect, useRef } from "react";

import { soundCue } from "@/lib/fx/patternFx";
import type { BeamDir, MirrorKind, MirrorPlacement } from "@/lib/duel/types";

/** The chevron on a directional gem, pointing the way the beam must arrive from. */
export function directionalChevronPoints(dir: BeamDir): string {
  if (dir === "R") return "3,10 6,12 3,14";
  if (dir === "L") return "21,10 18,12 21,14";
  if (dir === "D") return "10,3 12,6 14,3";
  return "10,21 12,18 14,21";
}

/** The rendered sprites (docs/design/game-art/pattern/source/laser.py; public/pattern-art/laser/), one cell box each. */
export const LASER_ART_BASE = "/pattern-art/laser";
export const LASER_SPRITES = ["floor", "brick", "mirror-slash", "mirror-back", "splitter", "gem-dark", "gem-lit", "bomb", "bomb-hit", "emitter"] as const;
export type LaserSprite = (typeof LASER_SPRITES)[number];
export function laserArtUrl(name: LaserSprite): string {
  return `${LASER_ART_BASE}/${name}.webp`;
}
/** Every sprite the board draws (checks and preloading). */
export function laserArtUrls(): string[] {
  return LASER_SPRITES.map(laserArtUrl);
}

/** One sprite filling a 24×24 box (or the given box), never taking a pointer. */
function Sprite({ name, x = 0, y = 0, size = 24 }: { name: LaserSprite; x?: number; y?: number; size?: number }) {
  return <image href={laserArtUrl(name)} x={x} y={y} width={size} height={size} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />;
}

/**
 * A gem cell's art: the rendered cut crystal, dark until the beam passes through it, then the same stone burning gold
 * (the Pattern overhaul, 15 Nov 2026). A gem that lights from one side only is drawn a little smaller with a bold
 * arrow on the side the beam must arrive from, so it still shows which side, dark or lit.
 */
export const LaserGem = memo(function LaserGem({ lit, from }: { lit: boolean; from?: BeamDir | undefined }) {
  const name: LaserSprite = lit ? "gem-lit" : "gem-dark";
  return (
    <svg viewBox="0 0 24 24" className="laser-gem h-full w-full" aria-hidden="true" data-gem-state={lit ? "lit" : "dark"} data-gem-from={from}>
      <g className={lit ? "laser-gem-lit" : undefined} key={lit ? "lit" : "dim"}>
        {from ? <Sprite name={name} x={4} y={4} size={16} /> : <Sprite name={name} />}
      </g>
      {from ? (
        <>
          <polyline points={directionalChevronPoints(from)} fill="none" stroke="#0b0a10" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={directionalChevronPoints(from)} fill="none" stroke={lit ? "#ffd36a" : "#ffffff"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
    </svg>
  );
});

/** A round black bomb with a red band and a lit fuse; red hot when the beam touches it. */
export const LaserBomb = memo(function LaserBomb({ flash }: { flash: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`laser-bomb h-full w-full ${flash ? "laser-bomb-hit" : ""}`} aria-hidden="true">
      {flash ? <circle cx="12" cy="12" r="11" className="laser-bomb-danger" /> : null}
      <Sprite name={flash ? "bomb-hit" : "bomb"} />
    </svg>
  );
});

/** The splitter: a rendered violet glass prism; the arrows over it show which way it splits the beam. */
export const LaserSplitter = memo(function LaserSplitter({ kind = "S-" }: { kind?: MirrorKind }) {
  const turn = kind === "S|" ? "" : "rotate(90 12 12)";
  return (
    <svg viewBox="0 0 24 24" className="laser-splitter h-full w-full" aria-hidden="true">
      <Sprite name="splitter" />
      <path transform={turn} d="M12 19V12M5 12H19M5 12L8 9M5 12L8 15M19 12L16 9M19 12L16 15" fill="none" stroke="#2a1260" strokeOpacity="0.7" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path transform={turn} d="M12 19V12M5 12H19M5 12L8 9M5 12L8 15M19 12L16 9M19 12L16 15" fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

const DIR_ANGLE: Record<BeamDir, number> = { R: 0, D: 90, L: 180, U: 270 };

/** The emitter: the rendered gunmetal housing with its gold lens, nozzle facing the stored beam direction. */
export const LaserEmitter = memo(function LaserEmitter({ dir, firing = false }: { dir: BeamDir; firing?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`laser-emitter h-full w-full ${firing ? "laser-emitter-firing" : ""}`} aria-hidden="true" data-emitter-dir={dir}>
      <g transform={`rotate(${DIR_ANGLE[dir]} 12 12)`}>
        <Sprite name="emitter" />
      </g>
    </svg>
  );
});

/** A mirror's sprite for its diagonal. */
export function mirrorSprite(kind: MirrorKind): LaserSprite {
  return kind === "/" ? "mirror-slash" : "mirror-back";
}

/**
 * One placed mirror on its diagonal: the rendered silvered glass pane in its slim frame (the Pattern overhaul), drawn
 * exactly on its cell's box (`unit` square round the centre), so nothing leaves the square.
 */
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
  return (
    <g transform={`translate(${x} ${y})`} data-mirror={kind}>
      <g className={animate ? "laser-mirror-in" : undefined}>
        <image href={laserArtUrl(mirrorSprite(kind))} x={-unit / 2} y={-unit / 2} width={unit} height={unit} pointerEvents="none" />
      </g>
    </g>
  );
}

/** "M x y L x y …" through the given points. */
function pathData(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
}

/**
 * The beam: a solid golden line with a pale core, as plain stroke layers (the Pattern overhaul, 15 Nov 2026: no
 * blurred neon copy and no wide halo, so nothing glares over the board). `solved` adds a flare that brightens the
 * whole beam for the completion moment.
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
  const core = danger ? "#FFE1E1" : "#FFF3C8";
  const lines = branches.filter((points) => points.length > 1).map(pathData);
  if (!lines.length) return null;
  return (
    <g className={`laser-beam ${solved ? "laser-beam-solved" : ""}`} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {solved
        ? lines.map((d, i) => <path key={`f${i}`} d={d} className="laser-beam-flare" stroke={colour} strokeWidth={unit * 0.45} />)
        : null}
      {lines.map((d, i) => <path key={`e${i}`} d={d} stroke="#3a2600" strokeOpacity={0.55} strokeWidth={Math.max(3, unit * 0.22)} />)}
      {lines.map((d, i) => <path key={`g${i}`} d={d} stroke={colour} strokeWidth={Math.max(2, unit * 0.16)} />)}
      {lines.map((d, i) => <path key={`c${i}`} d={d} className="laser-beam-core" stroke={core} strokeWidth={Math.max(1, unit * 0.055)} />)}
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
