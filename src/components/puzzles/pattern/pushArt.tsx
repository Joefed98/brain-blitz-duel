/**
 * Heave art (Pattern polish, 13 Oct 2026; the Pattern overhaul, 15 Nov 2026: Blender-rendered sprites, look A).
 * Presentation only: a brick warehouse (stone floor, brick walls, dark taped marks, the gold mark, lamps), wooden
 * crates, the gold crate and the worker, each image drawn inside its own cell and moved with CSS transforms between
 * the cells the shared push rules already decided. Nothing here reads or changes moves, pushes or the solved verdict.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { SlideDir } from "@/lib/duel/types";
import { pushCrateHome, pushGoldDim, pushMarkGlow } from "./pushFx";

const U = 20; // one cell in SVG units

/** Heave's rendered sprites (docs/design/game-art/pattern/source/push.py; the Pattern overhaul, 15 Nov 2026). */
export const PUSH_ART_BASE = "/pattern-art/push";
const art = (name: string) => `${PUSH_ART_BASE}/${name}.webp`;
export const PUSH_SPRITES = {
  floor: art("floor"),
  wall: art("wall"),
  mark: art("mark"),
  goldMark: art("gold-mark"),
  crate: art("crate"),
  goldCrate: art("gold-crate"),
  worker: { U: art("worker-u"), R: art("worker-r"), D: art("worker-d"), L: art("worker-l") } as Record<SlideDir, string>,
} as const;
/** Every sprite file name (the check proves each exists). */
export const PUSH_SPRITE_NAMES = ["floor", "wall", "mark", "gold-mark", "crate", "gold-crate", "worker-u", "worker-r", "worker-d", "worker-l"] as const;

/** The fixed warehouse: stone floor, brick walls, the marks (the gold one gold) and unlit lamps. Rendered once per layout. */
function WarehouseFloor({
  id,
  walls,
  targets,
  goldTarget,
  cols,
  rows,
}: {
  id: string;
  walls: number[];
  targets: number[];
  goldTarget: number | undefined;
  cols: number;
  rows: number;
}) {
  const wall = new Set(walls);
  const cells = Array.from({ length: cols * rows }, (_, cell) => cell);
  const lamps = pushLampXs(cols);
  // Floor and wall tiles are drawn a hair larger than their cell, so no seam shows between neighbours at any scale.
  const tile = (href: string, cell: number, key: string, inset = -0.15, className?: string) => (
    <image
      key={key}
      href={href}
      x={(cell % cols) * U + inset}
      y={Math.floor(cell / cols) * U + inset}
      width={U - 2 * inset}
      height={U - 2 * inset}
      preserveAspectRatio="none"
      {...(className ? { className } : {})}
    />
  );
  return (
    <svg
      viewBox={`0 0 ${cols * U} ${rows * U}`}
      className="push-floor absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`${id}-cast`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(0,0,0,.4)" />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <rect width={cols * U} height={rows * U} fill="#3a2a22" />
      {cells.map((cell) => (wall.has(cell) ? null : tile(PUSH_SPRITES.floor, cell, `f${cell}`)))}
      {/* The walls' soft shadow on the floor below them (the light comes from the top left). */}
      {cells.map((cell) =>
        !wall.has(cell) && cell >= cols && wall.has(cell - cols) ? (
          <rect key={`c${cell}`} x={(cell % cols) * U} y={Math.floor(cell / cols) * U} width={U} height="4.5" fill={`url(#${id}-cast)`} />
        ) : null,
      )}
      {targets.map((cell) =>
        tile(cell === goldTarget ? PUSH_SPRITES.goldMark : PUSH_SPRITES.mark, cell, `t${cell}`, 0, cell === goldTarget ? "push-marking push-marking-gold" : "push-marking"),
      )}
      {walls.map((cell) => tile(PUSH_SPRITES.wall, cell, `w${cell}`))}
      {lamps.map((x, index) => (
        <g key={`l${index}`}>
          <rect x={x - 5} y="0.8" width="10" height="3.4" rx="1.2" fill="#2a2d33" stroke="#0e0f12" strokeWidth="0.5" />
          <rect x={x - 4} y="2.1" width="8" height="1.4" rx="0.7" className="push-lamp-bulb" />
          {/* The lit bulb over it: unseen until the solve switches the lights on (its opacity only). */}
          <rect
            x={x - 4}
            y="2.1"
            width="8"
            height="1.4"
            rx="0.7"
            className="push-lamp-lit"
            style={{ "--lamp": index } as CSSProperties}
          />
        </g>
      ))}
    </svg>
  );
}

/** Lamp positions along the top wall, in SVG units. */
function pushLampXs(cols: number): number[] {
  const count = Math.max(2, Math.floor(cols / 2));
  return Array.from({ length: count }, (_, index) => ((index + 0.5) * cols * U) / count);
}

/** A wooden crate (gold for the gold crate) inside its cell; a crate on a mark carries a green tick. */
export function CrateArt({ home, gold = false }: { home: boolean; gold?: boolean }) {
  return (
    <span className="push-crate relative block h-full w-full" role="img" aria-label={home ? "Crate home" : "Crate"}>
      <img className="push-sprite" src={gold ? PUSH_SPRITES.goldCrate : PUSH_SPRITES.crate} alt="" draggable={false} decoding="async" />
      {home && (
        <svg viewBox="0 0 20 20" className="push-home-tick" aria-hidden="true">
          <circle cx="10" cy="10" r="8.6" fill="#1f8a4c" stroke="#0d2a18" strokeWidth="1.4" />
          <path d="M6 10.3l2.7 2.7 5.3-5.6" fill="none" stroke="#f4fff8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/** The warehouse worker seen from above, facing the last step (its own render per facing, so the light never turns). */
export function WorkerArt({ facing = "U" }: { facing?: SlideDir | undefined }) {
  return <img className="push-worker push-sprite" src={PUSH_SPRITES.worker[facing] ?? PUSH_SPRITES.worker.U} alt="You" draggable={false} decoding="async" />;
}

/** The warehouse board: static floor plus crates and the worker sliding between cells. */
export function WarehouseBoard({
  walls,
  targets,
  crates,
  pusher,
  cols,
  cells,
  facing,
  solveFx = false,
  gold,
  missed,
  lit = false,
  goldOff = 0,
  moveFx = false,
  stuck,
}: {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  cols: number;
  cells: number;
  facing?: SlideDir | undefined;
  solveFx?: boolean;
  /** pushRev 1 (depth batch 4): the gold crate (an index into `crates`) and its gold mark. */
  gold?: { crate: number; target: number } | undefined;
  /** The answer reveal (the Pattern overhaul, 15 Nov 2026): a player's crates not home (indices into `crates`), outlined
   *  red, and the marks left empty (cells), ringed; display only. */
  missed?: { crates: number[]; marks: number[] } | undefined;
  /** Stage 2: the warehouse lights stay on once the board is solved (the solve switches them on). */
  lit?: boolean;
  /** Stage 2: a new key dims the gold mark (the stage's moment: a push took the gold crate off it). */
  goldOff?: number;
  /** Stage 2: the last change was a push (a crate landing then thumps and its mark glows; not after Undo or Reset). */
  moveFx?: boolean;
  /** Stage 3, the stuck hint (Easy and Normal; display only): crates (indices into `crates`) on a square from which
   *  they can never reach a mark (pushStuck.ts), tinted red. */
  stuck?: readonly number[] | undefined;
}) {
  const id = useId().replace(/:/g, "");
  const rows = Math.ceil(cells / cols);
  const floor = useMemo(
    () => <WarehouseFloor id={id} walls={walls} targets={targets} goldTarget={gold?.target} cols={cols} rows={rows} />,
    [id, walls, targets, gold?.target, cols, rows],
  );
  const lamps = useMemo(() => pushLampXs(cols), [cols]);

  // A playback jump of more than one cell (the reveal's push-to-push steps) snaps
  // instead of sliding, so the worker never glides through walls.
  const lastPusher = useRef(pusher);
  const workerJumps =
    Math.abs((lastPusher.current % cols) - (pusher % cols)) +
      Math.abs(Math.floor(lastPusher.current / cols) - Math.floor(pusher / cols)) >
    1;
  useLayoutEffect(() => {
    lastPusher.current = pusher;
  }, [pusher]);

  // A crate that lands on a marking thumps down (the kit's drop) with a puff of dust, and the mark glows.
  const crateNodes = useRef<(HTMLDivElement | null)[]>([]);
  const wasHome = useRef<boolean[] | null>(null);
  const [puffs, setPuffs] = useState<number[]>([]);
  const [glows, setGlows] = useState<{ cell: number; key: number }[]>([]);
  const glowKey = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const homeFlags = crates.map((cell) => targets.includes(cell));
  const homeKey = homeFlags.map((home) => (home ? 1 : 0)).join("");
  useLayoutEffect(() => {
    const before = wasHome.current;
    wasHome.current = homeFlags;
    if (!before) return;
    const landed = homeFlags.map((home, index) => home && !before[index]);
    if (!moveFx || !landed.some(Boolean)) return;
    landed.forEach((hit, index) => hit && pushCrateHome(crateNodes.current[index]));
    setPuffs((current) => homeFlags.map((_, index) => (current[index] ?? 0) + (landed[index] ? 1 : 0)));
    const fresh = crates.flatMap((cell, index) => (landed[index] ? [{ cell, key: ++glowKey.current }] : []));
    setGlows((current) => [...current, ...fresh]);
    const keys = new Set(fresh.map((g) => g.key));
    timers.current.push(setTimeout(() => setGlows((current) => current.filter((g) => !keys.has(g.key))), 900));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- homeKey summarises homeFlags
  }, [homeKey]);

  // The solve: every crate thumps in turn (the kit's drop), then the lights come on along the row.
  useLayoutEffect(() => {
    if (!solveFx) return;
    crateNodes.current.forEach((node, index) => timers.current.push(setTimeout(() => pushCrateHome(node), 140 + index * 90)));
    setPuffs((current) => crates.map((_, index) => (current[index] ?? 0) + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per solve moment
  }, [solveFx]);

  return (
    <div
      className="push-board relative mx-auto aspect-square h-full max-h-full w-full max-w-full overflow-hidden rounded-[6px]"
      data-solve-fx={solveFx ? "true" : undefined}
      data-lit={solveFx || lit ? "true" : undefined}
    >
      {floor}
      {/* The solve: the warehouse lights come on, a wash of light over the floor (under the pieces; opacity only). */}
      {solveFx || lit ? (
        <div className="push-lights pointer-events-none absolute inset-0" aria-hidden="true">
          {lamps.map((x, index) => (
            <span
              key={index}
              className="push-light-pool"
              style={{ left: `${(x / (cols * U)) * 100}%`, "--lamp": index } as CSSProperties}
            />
          ))}
        </div>
      ) : null}
      {gold && goldOff > 0 ? <GoldDim key={goldOff} style={pieceStyle(gold.target, cols, rows)} /> : null}
      {crates.map((cell, index) => (
        <div
          key={index}
          data-push-crate=""
          className={`push-piece${gold?.crate === index ? " d4-gold-crate" : ""}`}
          data-gold-home={gold?.crate === index && cell === gold.target ? "" : undefined}
          data-push-missed={missed?.crates.includes(index) ? "" : undefined}
          data-push-stuck={stuck?.includes(index) ? "" : undefined}
          style={pieceStyle(cell, cols, rows)}
        >
          <div ref={(node) => void (crateNodes.current[index] = node)} className="push-piece-inner">
            <CrateArt home={targets.includes(cell)} gold={gold?.crate === index} />
            {(puffs[index] ?? 0) > 0 && <DustPuff key={puffs[index]} />}
          </div>
        </div>
      ))}
      {/* A mark a crate just landed on lights up round the crate (over its edges, inside the cell). */}
      {glows.map((g) => (
        <MarkGlow key={g.key} style={pieceStyle(g.cell, cols, rows)} gold={g.cell === gold?.target} />
      ))}
      {missed?.marks.map((cell) => (
        <div key={`m${cell}`} className="push-piece push-missed-mark" data-push-empty-mark={cell} style={pieceStyle(cell, cols, rows)} aria-hidden="true" />
      ))}
      {!crates.includes(pusher) && (
        <div
          className="push-piece push-piece-worker"
          style={{ ...pieceStyle(pusher, cols, rows), ...(workerJumps ? { transition: "none" } : {}) }}
        >
          <div className="push-piece-inner">
            <WorkerArt facing={facing} />
          </div>
        </div>
      )}
    </div>
  );
}

function pieceStyle(cell: number, cols: number, rows: number): CSSProperties {
  return {
    width: `${100 / cols}%`,
    height: `${100 / rows}%`,
    transform: `translate(${(cell % cols) * 100}%, ${Math.floor(cell / cols) * 100}%)`,
  };
}

function DustPuff() {
  return (
    <span className="push-dust pointer-events-none absolute inset-0" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <span key={index} className="push-dust-mote" style={{ "--mote": index } as CSSProperties} />
      ))}
    </span>
  );
}

/** The glow of a mark a crate just landed on (pushMarkGlow on mount): a warm light round the crate's edges, inside the mark's cell. */
function MarkGlow({ style, gold }: { style: CSSProperties; gold: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    pushMarkGlow(ref.current?.firstElementChild);
  }, []);
  return (
    <div ref={ref} className="push-piece push-mark-glow-cell" style={style} aria-hidden="true">
      <span className={`push-mark-glow${gold ? " is-gold" : ""}`} />
    </div>
  );
}

/** The gold mark dimming as the gold crate is pushed off it (pushGoldDim on mount: a shade over the mark, then gone). */
function GoldDim({ style }: { style: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    pushGoldDim(ref.current?.firstElementChild);
  }, []);
  return (
    <div ref={ref} className="push-piece push-gold-dim-cell" style={style} aria-hidden="true">
      <span className="push-gold-dim" />
    </div>
  );
}
