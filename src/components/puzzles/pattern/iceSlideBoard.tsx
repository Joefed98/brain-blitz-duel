/**
 * Skid (iceslide) board art — presentation only (Pattern polish, 13 Oct 2026).
 * The grid keeps one cell per square with 2 px gaps, exactly as before, so the
 * Stage's travelling ball still lands on cell centres. Nothing here reads or
 * writes moves, masks or timing; the Stage passes in what it already decided.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { soundCue } from "@/lib/fx/patternFx";
import { SLIDE_CELLS, SLIDE_COLS, type SlideArrow, type SlideDir } from "@/lib/duel/types";
import type { SlideOutcome } from "@/lib/duel/slide";

const GOLD = "var(--ice-exit)";
const PORTAL_COLOURS = ["var(--ice-portal-one)", "var(--ice-portal-two)"] as const;

/**
 * The Pattern overhaul (15 Nov 2026, look A): every piece is a Blender render (docs/design/game-art/pattern/source/
 * iceslide.py): frosted ice, dark granite blocks, the glossy blue ball, holes, a magenta and a teal portal pair, a navy
 * chevron per direction, thin ice intact and broken, the gold exit. Each image is exactly its cell (100 × 100 points),
 * so it sits on the cell box the slide maths uses and nothing leaves it.
 */
export const ICE_ART_BASE = "/pattern-art/iceslide";
export const ICE_SPRITES = [
  "rink", "block", "ball", "hole", "portal-a", "portal-b", "thin", "broken", "exit",
  "arrow-U", "arrow-D", "arrow-L", "arrow-R",
] as const;
export type IceSprite = (typeof ICE_SPRITES)[number];
export const iceSprite = (name: IceSprite): string => `${ICE_ART_BASE}/${name}.webp`;

/** One rendered piece filling its box (decorative: the cell or wrapper carries the label). */
export function IceArt({ name, className }: { name: IceSprite; className?: string }) {
  return <img src={iceSprite(name)} alt="" aria-hidden="true" draggable={false} className={`ice-art${className ? ` ${className}` : ""}`} />;
}

/** A one-way cell: a navy chevron raised on a frosted plate, pointing the way the ball is sent. */
function Chevron({ dir }: { dir: SlideDir }) {
  const d = dir === "U" || dir === "D" || dir === "L" || dir === "R" ? dir : "R";
  return (
    <span aria-label={`One way ${dir}`} className="ice-piece ice-arrow">
      <IceArt name={`arrow-${d}`} />
    </span>
  );
}

/** Where thin ice gave way: a jagged black hole with shards (opening when fresh). */
function BrokenHole({ fresh }: { fresh: boolean }) {
  return (
    <span aria-label="Hole" className={`ice-piece ice-broken${fresh ? " is-fresh" : ""}`}>
      <IceArt name="broken" />
    </span>
  );
}

/** Deterministic glint positions (fractions of the board), for the completion shatter. */
const GLINTS = [
  [0.14, 0.12, 1], [0.62, 0.08, 0.8], [0.86, 0.3, 1.1], [0.32, 0.4, 0.7], [0.08, 0.66, 0.9],
  [0.55, 0.58, 1], [0.78, 0.74, 0.8], [0.24, 0.88, 1], [0.9, 0.92, 0.7], [0.44, 0.22, 0.6],
] as const;

/** Completion glints: the spots plus a rotated copy. */
const SHATTER: (readonly [number, number, number])[] = [...GLINTS, ...GLINTS.map(([x, y, s]) => [1 - y, x, s] as const)];

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
  /** One slide from the exit with the finish still at par: the exit glows softly (display only). */
  nearExit?: boolean;
  /** Reveal only: cells where the ball fell, ringed red (display only). */
  fallen?: number[] | undefined;
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
  nearExit = false,
  fallen,
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
  const fellSet = useMemo(() => new Set(fallen ?? []), [fallen]);
  const thinBit = useMemo(() => new Map(thin.map((cell, bit) => [cell, bit])), [thin]);
  const exitCol = exit % cols;
  const exitRow = Math.floor(exit / cols);

  return (
    <div
      className={`ice-board ice-rink relative mx-auto aspect-square h-full max-h-full w-full max-w-full${solving ? " is-solving" : ""}`}
      style={{ ["--ice-cols" as string]: cols }}
    >
      <IceArt name="rink" className="ice-sheet-art" />
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
          if (wall.has(cell)) return <div key={cell} className="ice-rock"><IceArt name="block" /></div>;
          const isBall = cell === ball;
          const turn = turns.get(cell);
          const bit = thinBit.get(cell);
          const brokenHole = bit !== undefined && (broken & (1 << bit)) !== 0;
          const pair = portalPair.get(cell);
          const isExit = cell === exit;
          const piece = isBall ? (
            <span aria-label="Ball" className="ice-piece ice-ball"><IceArt name="ball" /></span>
          ) : pit.has(cell) ? (
            <span aria-label="Hole" className="ice-piece ice-hole"><IceArt name="hole" /></span>
          ) : brokenHole ? (
            <BrokenHole fresh={(fresh & (1 << bit!)) !== 0} />
          ) : pair !== undefined ? (
            <span
              aria-label="Portal"
              className={`ice-piece ice-portal${flare === pair || (flare === -1) ? " is-flaring" : ""}`}
              style={{ ["--portal" as string]: PORTAL_COLOURS[pair === 0 ? 0 : 1] }}
            >
              <IceArt name={pair === 0 ? "portal-a" : "portal-b"} />
            </span>
          ) : bit !== undefined ? null : turn ? (
            <Chevron dir={turn} />
          ) : isExit ? (
            <IceArt name="exit" className="ice-exit-art" />
          ) : cell === start ? (
            <span className="ice-start" />
          ) : null;

          const kind = isExit
            ? `ice-tile ice-goal${nearExit ? " is-near" : ""}`
            : bit !== undefined && !brokenHole
              ? "ice-tile ice-thin"
              : brokenHole
                ? "ice-tile ice-gone"
                : "ice-tile";
          return (
            <div key={cell} className={kind} aria-label={isExit ? "Exit" : undefined}>
              {bit !== undefined && !brokenHole ? (
                <span aria-label="Thin ice" className="ice-piece ice-thin-art"><IceArt name="thin" /></span>
              ) : null}
              {piece}
              {fellSet.has(cell) ? <span className="ice-fell-mark" data-reveal-fell={cell} aria-label="You fell here" /> : null}
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
/** Slides longer than this many squares play the long hiss. */
export const ICE_LONG_SLIDE_CELLS = 4;

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
 * iceslide.slide / slideLong / portal / crack / fall cues.
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
    // The ice hiss: a short one for a slide of up to four squares, a longer one past that (sound only), so the sound
    // lasts about as long as the slide; the stop's thump is the Stage's (it knows where the ball comes to rest).
    soundCue(outcome.path.length > ICE_LONG_SLIDE_CELLS ? "iceslide.slideLong" : "iceslide.slide");
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
