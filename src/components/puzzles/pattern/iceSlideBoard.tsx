/**
 * Skid (iceslide) board art — presentation only (Pattern polish, 13 Oct 2026).
 * The grid keeps one cell per square with 2 px gaps, exactly as before, so the
 * Stage's travelling ball still lands on cell centres. Nothing here reads or
 * writes moves, masks or timing; the Stage passes in what it already decided.
 */
import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { soundCue } from "@/lib/fx/patternFx";
import { SLIDE_CELLS, SLIDE_COLS, type SlideArrow, type SlideDir } from "@/lib/duel/types";
import type { SlideOutcome } from "@/lib/duel/slide";

const GOLD = "var(--ice-exit)";
const PORTAL_COLOURS = ["var(--ice-portal-one)", "var(--ice-portal-two)"] as const;

/** A one-way cell: a chevron etched into the ice, pointing the way the ball is sent. */
function Chevron({ dir }: { dir: SlideDir }) {
  const turn = dir === "U" ? 270 : dir === "D" ? 90 : dir === "L" ? 180 : 0;
  return (
    <svg
      viewBox="0 0 10 10"
      aria-label={`One way ${dir}`}
      className="ice-etch block"
      style={{ width: "80%", height: "80%", transform: `rotate(${turn}deg)` }}
    >
      <polyline points="2.6,2.2 6.6,5 2.6,7.8" className="ice-etch-light" />
      <polyline points="2.2,2 6.2,4.8 2.2,7.6" className="ice-etch-groove" />
      <polyline points="5,2.6 8.4,5 5,7.4" className="ice-etch-tip" />
    </svg>
  );
}

/** Thin ice: a clouded tile with a white impact star and dark cracks. */
function Crack() {
  return (
    <svg viewBox="0 0 10 10" aria-label="Thin ice" className="ice-crack block h-full w-full">
      <path className="ice-crack-shine" d="M4.6 5.4 1.2 2.4M4.6 5.4 8.8 1.4M4.6 5.4 2 8.8M4.6 5.4 8.6 7.6M4.6 5.4 5.4 9.4" />
      <path className="ice-crack-line" d="M4.8 5.2 3.2 3.8 1 2.6M3.2 3.8 3.4 1.2M4.8 5.2 6.6 3.4 8.8 1.2M6.6 3.4 8.6 4M4.8 5.2 3.4 7 2 8.8M4.8 5.2 6.8 6.4 8.8 7.4M6.8 6.4 6.2 8.6" />
      <circle className="ice-crack-core" cx="4.8" cy="5.2" r="0.55" />
    </svg>
  );
}

/** Where thin ice gave way: a jagged hole with a few shards (flying out when fresh). */
function BrokenHole({ fresh }: { fresh: boolean }) {
  return (
    <span aria-label="Hole" className={`ice-broken${fresh ? " is-fresh" : ""}`}>
      <svg viewBox="0 0 10 10" className="block h-full w-full" aria-hidden="true">
        <polygon className="ice-broken-pit" points="1.6,3.2 3,1.6 4.4,2.2 5.6,1.2 7.4,2 8.6,3.6 8.2,5 9,6.4 7.8,8.2 6.2,8.4 5,9 3.4,8.4 1.8,7.6 1.4,6 1.9,4.8" />
        <polygon className="ice-broken-deep" points="3,3.6 4.6,3 6.4,3.2 7.2,4.8 6.8,6.6 5,7.2 3.4,6.6 2.8,5" />
        <g className="ice-shards">
          <polygon className="ice-shard s1" points="1.2,1.2 2.6,1.6 1.8,2.6" />
          <polygon className="ice-shard s2" points="8.4,1.4 9,2.8 7.8,2.4" />
          <polygon className="ice-shard s3" points="8.6,8.6 7.4,9 8,7.8" />
          <polygon className="ice-shard s4" points="1.4,8.6 1.2,7.4 2.4,8.2" />
        </g>
      </svg>
    </span>
  );
}

/** Deterministic glint positions (fractions of the board). */
const GLINTS = [
  [0.14, 0.12, 1], [0.62, 0.08, 0.8], [0.86, 0.3, 1.1], [0.32, 0.4, 0.7], [0.08, 0.66, 0.9],
  [0.55, 0.58, 1], [0.78, 0.74, 0.8], [0.24, 0.88, 1], [0.9, 0.92, 0.7], [0.44, 0.22, 0.6],
] as const;

/** Completion glints: the twinkle spots plus a rotated copy. */
const SHATTER: (readonly [number, number, number])[] = [...GLINTS, ...GLINTS.map(([x, y, s]) => [1 - y, x, s] as const)];

/** The ice sheet under the grid: gradient, frost grain, reflections, scratches, glints. Built once. */
const IceSheet = memo(function IceSheet() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg className="ice-sheet-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4FBFF" />
          <stop offset="0.45" stopColor="#DCEFF9" />
          <stop offset="1" stopColor="#C9E3F1" />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="0.3" cy="0.22" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-cool`} cx="0.78" cy="0.8" r="0.45">
          <stop offset="0" stopColor="#9CCBE6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#9CCBE6" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.1" />
        </filter>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-base)`} />
      <rect width="100" height="100" filter={`url(#${id}-grain)`} opacity="0.35" />
      <rect width="100" height="100" fill={`url(#${id}-cool)`} />
      <ellipse cx="30" cy="22" rx="46" ry="30" fill={`url(#${id}-sheen)`} transform="rotate(-24 30 22)" />
      <g className="ice-scratch">
        <path d="M2 30 L40 36 M66 2 L80 46 M4 82 L42 64 M58 94 L96 70 M20 8 L34 20 M72 58 L98 52" />
      </g>
      <g className="ice-scratch-fine">
        <path d="M10 46 L28 50 M48 12 L60 30 M82 12 L92 24 M36 74 L50 92 M64 40 L74 44" />
      </g>
    </svg>
  );
});

/** Twinkling glints over the ice (opacity only). */
const Glints = memo(function Glints() {
  return (
    <div className="ice-glints" aria-hidden="true">
      {GLINTS.map(([x, y, s], index) => (
        <span
          key={index}
          className="ice-glint"
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, ["--s" as string]: s, animationDelay: `${(index * 730) % 4100}ms` }}
        />
      ))}
    </div>
  );
});

export interface IceBoardProps {
  walls: number[];
  holes?: number[];
  arrows?: SlideArrow[];
  portals?: [number, number][];
  thin?: number[];
  /** Broken thin-ice mask (bit i = thin[i] is now a hole). */
  broken?: number;
  /** Thin-ice bits that only just broke (play the break). */
  fresh?: number;
  /** Portal pair index flaring as the ball passes through; -1 = all (solve). */
  flare?: number | null;
  start: number;
  exit: number;
  ball: number;
  cols?: number;
  cells?: number;
  /** Cells of a route to draw as a dotted gold line. */
  route?: number[] | undefined;
  dotted?: boolean;
  /** The completion moment is playing. */
  solving?: boolean;
  children?: ReactNode;
}

export function IceBoard({
  walls,
  holes = [],
  arrows = [],
  portals = [],
  thin = [],
  broken = 0,
  fresh = 0,
  flare = null,
  start,
  exit,
  ball,
  cols = SLIDE_COLS,
  cells = SLIDE_CELLS,
  route,
  dotted,
  solving = false,
  children,
}: IceBoardProps) {
  const rows = Math.ceil(cells / cols);
  const wall = useMemo(() => new Set(walls), [walls]);
  const pit = useMemo(() => new Set(holes), [holes]);
  const turns = useMemo(() => new Map(arrows.map((arrow) => [arrow.cell, arrow.dir])), [arrows]);
  const portalPair = useMemo(() => {
    const pair = new Map<number, number>();
    portals.forEach(([a, b], index) => {
      pair.set(a, index);
      pair.set(b, index);
    });
    return pair;
  }, [portals]);
  const thinBit = useMemo(() => new Map(thin.map((cell, bit) => [cell, bit])), [thin]);
  const exitCol = exit % cols;
  const exitRow = Math.floor(exit / cols);

  return (
    <div
      className={`ice-board ice-rink relative mx-auto aspect-square h-full max-h-full w-full max-w-full${solving ? " is-solving" : ""}`}
      style={{ ["--ice-cols" as string]: cols }}
    >
      <IceSheet />
      <Glints />
      <div
        className="ice-board-grid puzzle-board grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {/* The ball is a centred child of the cell it occupies — never drawn from
            pointer or pixel maths — so a slide moves it whole cells at a time. */}
        {Array.from({ length: cols * rows }, (_, cell) => {
          if (wall.has(cell)) return <div key={cell} className="ice-rock" />;
          const isBall = cell === ball;
          const turn = turns.get(cell);
          const bit = thinBit.get(cell);
          const brokenHole = bit !== undefined && (broken & (1 << bit)) !== 0;
          const pair = portalPair.get(cell);
          const isExit = cell === exit;
          const piece = isBall ? (
            <span aria-label="Ball" className="ice-ball" />
          ) : pit.has(cell) ? (
            <span aria-label="Hole" className="ice-hole" />
          ) : brokenHole ? (
            <BrokenHole fresh={(fresh & (1 << bit!)) !== 0} />
          ) : pair !== undefined ? (
            <span
              aria-label="Portal"
              className={`ice-portal${flare === pair || (flare === -1) ? " is-flaring" : ""}`}
              style={{ ["--portal" as string]: PORTAL_COLOURS[pair === 0 ? 0 : 1] }}
            >
              <span className="ice-portal-swirl" />
            </span>
          ) : bit !== undefined ? null : turn ? (
            <Chevron dir={turn} />
          ) : isExit ? (
            <svg viewBox="0 0 20 20" className="ice-exit-door h-[74%] w-[74%]" aria-hidden="true">
              <path d="M8 3H3v14h5M8 10h9m-4-4 4 4-4 4" />
            </svg>
          ) : cell === start ? (
            <span className="ice-start" />
          ) : null;

          const kind = isExit
            ? "ice-tile ice-goal"
            : bit !== undefined && !brokenHole
              ? "ice-tile ice-thin"
              : brokenHole
                ? "ice-tile ice-gone"
                : "ice-tile";
          return (
            <div key={cell} className={kind} aria-label={isExit ? "Exit" : undefined}>
              {bit !== undefined && !brokenHole ? <Crack /> : null}
              {piece}
            </div>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {route && route.length > 1 && (
          <polyline
            points={route.map((cell) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`).join(" ")}
            fill="none"
            stroke={GOLD}
            strokeWidth={0.12}
            strokeLinecap="round"
            strokeDasharray={dotted === false ? undefined : "0.25 0.2"}
          />
        )}
      </svg>

      {solving ? (
        <div
          className="ice-solve"
          aria-hidden="true"
          style={{
            ["--ex" as string]: `${((exitCol + 0.5) / cols) * 100}%`,
            ["--ey" as string]: `${((exitRow + 0.5) / rows) * 100}%`,
          }}
        >
          <span className="ice-solve-frost" />
          <span className="ice-solve-ring" />
          {SHATTER.map(([x, y, s], index) => (
            <span
              key={index}
              className="ice-solve-shard"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                ["--s" as string]: s,
                animationDelay: `${180 + ((index * 53) % 260)}ms`,
              }}
            />
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** A short frost trail behind the sliding ball (cells it has already crossed). */
export function IceTrail({ cells, cols, rows, fading }: { cells: number[]; cols: number; rows: number; fading: boolean }) {
  let d = "";
  let previous: number | null = null;
  for (const cell of cells) {
    const x = (cell % cols) + 0.5;
    const y = Math.floor(cell / cols) + 0.5;
    const adjacent =
      previous !== null &&
      Math.abs((previous % cols) - (cell % cols)) + Math.abs(Math.floor(previous / cols) - Math.floor(cell / cols)) === 1;
    d += `${adjacent ? "L" : "M"}${x} ${y} `;
    previous = cell;
  }
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      className={`ice-trail pointer-events-none absolute inset-0 h-full w-full${fading ? " is-fading" : ""}`}
      aria-hidden="true"
    >
      <path className="ice-trail-haze" d={d} />
      <path className="ice-trail-core" d={d} />
    </svg>
  );
}

const TRAIL_CELLS = 4;

interface SlideRun {
  from: number;
  fromMask: number;
  path: number[];
  fell: boolean;
  idx: number;
}

/**
 * Display-only effects of a slide, derived from the Stage's own visual ball:
 * which thin ice shows as broken (it breaks as the ball leaves it), the break,
 * portal flares, the fall into a hole and the frost trail. Dispatches the
 * iceslide.slide / portal / crack / fall cues.
 */
export function useIceSlideFx({
  portals,
  pairs,
  thin,
  visualBall,
  animating,
  restCell,
  restMask,
}: {
  portals: Map<number, number>;
  pairs: [number, number][];
  thin: Map<number, number>;
  visualBall: { cell: number; jump: boolean } | null;
  animating: boolean;
  restCell: number;
  restMask: number;
}) {
  const run = useRef<SlideRun | null>(null);
  const [idx, setIdx] = useState(-1);
  const [flare, setFlare] = useState<number | null>(null);
  const [fall, setFall] = useState<{ cell: number; key: number } | null>(null);
  const [fresh, setFresh] = useState(0);
  const shown = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const begin = (from: number, fromMask: number, outcome: SlideOutcome) => {
    run.current = { from, fromMask, path: outcome.path, fell: outcome.fell, idx: -1 };
    setIdx(-1);
    soundCue("iceslide.slide");
  };

  useEffect(() => {
    const r = run.current;
    if (!r || !visualBall) return;
    let i = r.idx + 1;
    while (i < r.path.length && r.path[i] !== visualBall.cell) i++;
    if (i >= r.path.length) return;
    r.idx = i;
    setIdx(i);
    const cell = r.path[i]!;
    const before = i > 0 ? r.path[i - 1]! : r.from;
    if (visualBall.jump && portals.get(before) === cell) {
      setFlare(pairs.findIndex(([a, b]) => a === cell || b === cell));
      soundCue("iceslide.portal");
    }
    if (r.fell && i === r.path.length - 1) {
      setFall({ cell, key: Date.now() });
      soundCue("iceslide.fall");
    }
  }, [visualBall, portals, pairs]);

  useEffect(() => {
    if (flare === null) return;
    const timer = setTimeout(() => setFlare(null), 450);
    return () => clearTimeout(timer);
  }, [flare]);
  useEffect(() => {
    if (!fall) return;
    const timer = setTimeout(() => setFall(null), 420);
    return () => clearTimeout(timer);
  }, [fall]);

  const bitOf = (cell: number) => {
    const bit = thin.get(cell);
    return bit === undefined ? 0 : 1 << bit;
  };
  const r = run.current;
  let mask: number;
  if (animating && r) {
    mask = r.fromMask;
    for (let j = 0; j < idx && j < r.path.length; j++) mask |= bitOf(r.path[j]!);
    const here = idx >= 0 ? r.path[idx]! : r.from;
    // A fall ends on the broken cell itself: show it open.
    if (!(r.fell && idx === r.path.length - 1)) mask &= ~bitOf(here);
  } else {
    mask = restMask & ~bitOf(restCell);
  }

  useEffect(() => {
    const previous = shown.current;
    shown.current = mask;
    if (previous === null) return;
    const added = mask & ~previous;
    if (!added) return;
    setFresh((current) => current | added);
    soundCue("iceslide.crack");
    timers.current.push(setTimeout(() => setFresh((current) => current & ~added), 520));
  }, [mask]);

  // The trail: the last few cells already crossed in this slide.
  let trail: number[] = [];
  if (r) {
    const crossed = [r.from, ...r.path.slice(0, Math.max(0, animating ? idx : r.path.length - 1))];
    trail = crossed.slice(-TRAIL_CELLS - 1);
  }

  return { begin, mask, fresh, flare, fall, trail, trailFading: !animating };
}
