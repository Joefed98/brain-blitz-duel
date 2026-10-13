/**
 * Heave art (Pattern polish, 13 Oct 2026). Presentation only: a warehouse
 * board (concrete floor, brick walls, hatched floor markings, lamps), wooden
 * crates and the worker, moved with CSS transforms between the cells the
 * shared push rules already decided. Nothing here reads or changes moves,
 * pushes or the solved verdict.
 */
import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { SlideDir } from "@/lib/duel/types";

const U = 20; // one cell in SVG units

const FACING: Partial<Record<SlideDir, number>> = { U: 0, R: 90, D: 180, L: 270 };

/** Small deterministic hash for per-cell texture variation (never gameplay). */
function hash(n: number): number {
  let x = (n + 1) * 2654435761;
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The fixed warehouse: floor, walls, markings and unlit lamps. Rendered once per layout. */
function WarehouseFloor({
  id,
  walls,
  targets,
  cols,
  rows,
}: {
  id: string;
  walls: number[];
  targets: number[];
  cols: number;
  rows: number;
}) {
  const wall = new Set(walls);
  const cells = Array.from({ length: cols * rows }, (_, cell) => cell);
  const lamps = pushLampXs(cols);
  return (
    <svg
      viewBox={`0 0 ${cols * U} ${rows * U}`}
      className="push-floor absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={`${id}-speckle`} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="2" r="0.35" fill="rgba(40,32,24,.35)" />
          <circle cx="4.6" cy="5.1" r="0.3" fill="rgba(255,250,240,.28)" />
          <circle cx="5.8" cy="1.1" r="0.25" fill="rgba(40,32,24,.28)" />
        </pattern>
        <pattern id={`${id}-brick`} width="20" height="10" patternUnits="userSpaceOnUse">
          <rect width="20" height="10" fill="#2a1d19" />
          <rect x="0.5" y="0.5" width="9" height="4" rx="0.4" fill="#743628" />
          <rect x="10.5" y="0.5" width="9" height="4" rx="0.4" fill="#682f23" />
          <rect x="-4.5" y="5.5" width="9" height="4" rx="0.4" fill="#612b20" />
          <rect x="5.5" y="5.5" width="9" height="4" rx="0.4" fill="#7b3b2b" />
          <rect x="15.5" y="5.5" width="9" height="4" rx="0.4" fill="#612b20" />
          <path d="M0.5 0.9h9M10.5 0.9h9M5.5 5.9h9" stroke="rgba(255,210,180,.16)" strokeWidth="0.5" />
        </pattern>
        <linearGradient id={`${id}-wallshade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,235,220,.22)" />
          <stop offset="0.18" stopColor="rgba(255,235,220,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,.38)" />
        </linearGradient>
        <linearGradient id={`${id}-cast`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(0,0,0,.42)" />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <pattern id={`${id}-hazard`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="#17191c" />
          <rect width="2" height="4" fill="#f5c518" />
        </pattern>
      </defs>
      {cells.map((cell) => {
        const x = (cell % cols) * U;
        const y = Math.floor(cell / cols) * U;
        if (wall.has(cell)) return null;
        const tone = 0.06 * (hash(cell) - 0.5);
        return (
          <g key={cell}>
            <rect x={x} y={y} width={U} height={U} fill="#8e877c" />
            {tone !== 0 && (
              <rect x={x} y={y} width={U} height={U} fill={tone > 0 ? "#fff" : "#000"} opacity={Math.abs(tone)} />
            )}
            <rect x={x} y={y} width={U} height={U} fill={`url(#${id}-speckle)`} />
            <path d={`M${x} ${y + 0.3}h${U}M${x + 0.3} ${y}v${U}`} stroke="rgba(45,35,25,.28)" strokeWidth="0.6" />
            {wall.has(cell - cols) && cell >= cols && (
              <rect x={x} y={y} width={U} height="5" fill={`url(#${id}-cast)`} />
            )}
          </g>
        );
      })}
      {targets.map((cell) => {
        const x = (cell % cols) * U;
        const y = Math.floor(cell / cols) * U;
        return (
          <g key={`t${cell}`} className="push-marking">
            <rect x={x + 2} y={y + 2} width={U - 4} height={U - 4} fill="rgba(245,197,24,.16)" />
            <rect
              x={x + 2.4}
              y={y + 2.4}
              width={U - 4.8}
              height={U - 4.8}
              fill="none"
              stroke={`url(#${id}-hazard)`}
              strokeWidth="2.6"
            />
            <path
              d={`M${x + 7} ${y + 10}h6M${x + 10} ${y + 7}v6`}
              stroke="rgba(245,197,24,.55)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {walls.map((cell) => {
        const x = (cell % cols) * U;
        const y = Math.floor(cell / cols) * U;
        return (
          <g key={`w${cell}`}>
            <rect x={x} y={y} width={U} height={U} fill={`url(#${id}-brick)`} />
            <rect x={x} y={y} width={U} height={U} fill={`url(#${id}-wallshade)`} />
          </g>
        );
      })}
      {lamps.map((x, index) => (
        <g key={`l${index}`}>
          <rect x={x - 5} y="0.8" width="10" height="3.4" rx="1.2" fill="#2a2d33" stroke="#0e0f12" strokeWidth="0.5" />
          <rect
            x={x - 4}
            y="2.1"
            width="8"
            height="1.4"
            rx="0.7"
            className="push-lamp-bulb"
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

/** Wooden crate: planks, frame, cross brace and nails; a green light when home. */
export function CrateArt({ home }: { home: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="push-crate block h-[88%] w-[88%]" aria-label={home ? "Crate home" : "Crate"}>
      <rect x="1.4" y="2.2" width="18" height="17.4" rx="1.4" fill="rgba(0,0,0,.32)" />
      <rect x="0.6" y="0.6" width="18.2" height="18.2" rx="1.2" className="push-crate-body" />
      <path d="M1.4 6.7h16.6M1.4 12.7h16.6" stroke="var(--crate-dark)" strokeWidth="0.7" />
      <path d="M4 3.6h5M11 9.6h5M5 15.6h6" stroke="rgba(80,45,20,.35)" strokeWidth="0.45" strokeLinecap="round" />
      <rect x="1.5" y="1.5" width="16.4" height="16.4" rx="0.8" fill="none" stroke="var(--crate-dark)" strokeWidth="2" />
      <path d="M3.2 16.2 16.2 3.2" stroke="var(--crate-dark)" strokeWidth="3" strokeLinecap="round" />
      <path d="M3.2 15.6 15.6 3.2" stroke="var(--crate-light)" strokeWidth="0.9" strokeLinecap="round" opacity="0.8" />
      <path d="M1.2 1.2h17" stroke="var(--crate-light)" strokeWidth="0.6" opacity="0.9" />
      {[
        [2.6, 2.6],
        [16.8, 2.6],
        [2.6, 16.8],
        [16.8, 16.8],
        [9.7, 9.7],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.75" className="push-nail" />
      ))}
      {home && (
        <>
          <circle cx="15" cy="5" r="3.6" fill="var(--home-light)" stroke="var(--hazard-dark)" strokeWidth="0.8" />
          <path
            d="M13.3 5l1.2 1.2 2.2-2.4"
            fill="none"
            stroke="var(--hazard-dark)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

/** Top-down warehouse worker facing up: hard hat, hi-vis vest, arms out to push. */
export function WorkerArt() {
  return (
    <svg viewBox="0 0 20 20" className="push-worker block h-[86%] w-[86%]" aria-label="You">
      <ellipse cx="10.4" cy="12.4" rx="7.4" ry="5.2" fill="rgba(0,0,0,.3)" />
      <rect x="4.6" y="3.2" width="2.6" height="7" rx="1.3" fill="var(--worker-body)" stroke="var(--hazard-dark)" strokeWidth="0.6" />
      <rect x="12.8" y="3.2" width="2.6" height="7" rx="1.3" fill="var(--worker-body)" stroke="var(--hazard-dark)" strokeWidth="0.6" />
      <circle cx="5.9" cy="3.4" r="1.3" fill="#e7b48f" stroke="var(--hazard-dark)" strokeWidth="0.5" />
      <circle cx="14.1" cy="3.4" r="1.3" fill="#e7b48f" stroke="var(--hazard-dark)" strokeWidth="0.5" />
      <ellipse cx="10" cy="11.6" rx="7.2" ry="4.8" fill="var(--worker-vest)" stroke="var(--hazard-dark)" strokeWidth="0.8" />
      <path d="M4.2 10.4h11.6M4.6 13h10.8" stroke="#eef3f6" strokeWidth="0.9" opacity="0.9" />
      <circle cx="10" cy="11" r="4.3" fill="var(--worker-hat)" stroke="var(--hazard-dark)" strokeWidth="0.8" />
      <path d="M10 6.9v8.2" stroke="rgba(120,90,0,.55)" strokeWidth="0.9" />
      <circle cx="8.6" cy="9.4" r="1.3" fill="rgba(255,255,255,.55)" />
    </svg>
  );
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
}: {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  cols: number;
  cells: number;
  facing?: SlideDir | undefined;
  solveFx?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const rows = Math.ceil(cells / cols);
  const floor = useMemo(
    () => <WarehouseFloor id={id} walls={walls} targets={targets} cols={cols} rows={rows} />,
    [id, walls, targets, cols, rows],
  );
  const lamps = useMemo(() => pushLampXs(cols), [cols]);

  // Turn the worker the short way round to face the last step.
  const angle = useRef(FACING[facing ?? "U"] ?? 0);
  const target = FACING[facing ?? "U"] ?? angle.current;
  const delta = ((((target - angle.current) % 360) + 540) % 360) - 180;
  angle.current += delta;

  // A crate that lands on a marking thumps down with a puff of dust.
  const crateNodes = useRef<(HTMLDivElement | null)[]>([]);
  const wasHome = useRef<boolean[] | null>(null);
  const [puffs, setPuffs] = useState<number[]>([]);
  const homeFlags = crates.map((cell) => targets.includes(cell));
  const homeKey = homeFlags.map((home) => (home ? 1 : 0)).join("");
  useLayoutEffect(() => {
    const before = wasHome.current;
    wasHome.current = homeFlags;
    if (!before) return;
    const landed = homeFlags.map((home, index) => home && !before[index]);
    if (!landed.some(Boolean)) return;
    landed.forEach((hit, index) => hit && thump(crateNodes.current[index], 120));
    setPuffs((current) => homeFlags.map((_, index) => (current[index] ?? 0) + (landed[index] ? 1 : 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- homeKey summarises homeFlags
  }, [homeKey]);

  // The solve: every crate thumps in turn, then the lights come on along the row.
  useLayoutEffect(() => {
    if (!solveFx) return;
    crateNodes.current.forEach((node, index) => thump(node, 140 + index * 90));
    setPuffs((current) => crates.map((_, index) => (current[index] ?? 0) + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per solve moment
  }, [solveFx]);

  return (
    <div
      className="push-board relative mx-auto aspect-square h-full max-h-full w-full max-w-full overflow-hidden rounded-[6px]"
      data-solve-fx={solveFx ? "true" : undefined}
    >
      {floor}
      {crates.map((cell, index) => (
        <div
          key={index}
          className="push-piece"
          style={pieceStyle(cell, cols, rows)}
        >
          <div ref={(node) => void (crateNodes.current[index] = node)} className="push-piece-inner">
            <CrateArt home={targets.includes(cell)} />
            {(puffs[index] ?? 0) > 0 && <DustPuff key={puffs[index]} />}
          </div>
        </div>
      ))}
      {!crates.includes(pusher) && (
        <div className="push-piece push-piece-worker" style={pieceStyle(pusher, cols, rows)}>
          <div className="push-piece-inner push-worker-turn" style={{ transform: `rotate(${angle.current}deg)` }}>
            <WorkerArt />
          </div>
        </div>
      )}
      {solveFx && (
        <div className="push-lights pointer-events-none absolute inset-0" aria-hidden="true">
          {lamps.map((x, index) => (
            <span
              key={index}
              className="push-light-pool"
              style={{ left: `${(x / (cols * U)) * 100}%`, "--lamp": index } as CSSProperties}
            />
          ))}
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

function thump(node: HTMLDivElement | null | undefined, delay: number) {
  if (!node?.animate || reducedMotion()) return;
  node.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.12)", offset: 0.35 },
      { transform: "scale(0.93)", offset: 0.7 },
      { transform: "scale(1)" },
    ],
    { duration: 300, delay, easing: "ease-out" },
  );
}
