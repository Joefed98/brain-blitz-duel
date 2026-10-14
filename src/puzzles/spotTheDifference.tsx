import { SWEET_NAMES } from "@/components/puzzles/refreshIcons";
import { registerFxPreview, soundCue } from "@/components/puzzles/speedFx";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { playCorrect, playWrong } from "@/lib/sound";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { pick, shuffled } from "@/lib/duel/random";
import {
  SPOT_CELLS,
  SPOT_COLS,
  SPOT_DIFFERENCES,
  SPOT_ROWS,
  SPOT_TIME_MS,
  type SpotDifference,
  type SpotDifferenceKind,
  type SpotPuzzleData,
  type SpotShape,
  type SpotShapeKind,
  type StroopColour,
} from "@/lib/duel/types";

import { ShopBackdrop, SweetArt, playDifferenceGlow } from "./doubleTakeArt";
import { ATTENTION_REWORK_TIME_MS, SPOT_REV, SPOT_TWO_WRONG_LIMIT, parseSpotTaps, spotScenes, type SpotTheme } from "@/lib/duel/attentionRev";
import { ReefArt, ReefBackdrop, reefLabel } from "./doubleTakeReef";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const COLOURS: Record<Exclude<StroopColour, "YELLOW">, string> = {
  RED: "var(--sweet-red)", BLUE: "var(--sweet-blue)", GREEN: "var(--sweet-green)",
  PURPLE: "var(--sweet-purple)", PINK: "var(--sweet-pink)", ORANGE: "var(--sweet-orange)", BROWN: "var(--sweet-brown)",
};

const COLOUR_KEYS = Object.keys(COLOURS) as Exclude<StroopColour, "YELLOW">[];
/** The two pairs that read as the same colour at a glance — never swapped. */
const TOO_CLOSE: [StroopColour, StroopColour][] = [
  ["RED", "PINK"],
  ["BLUE", "PURPLE"],
  ["RED", "ORANGE"],
  ["ORANGE", "BROWN"],
];

const KINDS: SpotShapeKind[] = ["circle", "square", "triangle", "star", "hexagon", "arrow"];
/** Shapes whose turn or mirror is unmistakable. */
const TURNABLE: SpotShapeKind[] = ["triangle", "arrow"];
/** A shape's kind can only change into its listed partner. */
const KIND_SWAP: Record<SpotShapeKind, SpotShapeKind> = {
  circle: "hexagon",
  hexagon: "circle",
  square: "star",
  star: "square",
  triangle: "arrow",
  arrow: "triangle",
};

/* -------------------------------------------------------------------------- */
/*  Drawing — both panels use this same code, so nothing but the stored        */
/*  differences can tell them apart.                                          */
/* -------------------------------------------------------------------------- */

const CELL_W = 48;
const CELL_H = 48;
const PANEL_W = SPOT_COLS * CELL_W;
const PANEL_H = SPOT_ROWS * CELL_H;
const SHAPE = 36;

function cellCentre(cell: number): { x: number; y: number } {
  const col = cell % SPOT_COLS;
  const row = Math.floor(cell / SPOT_COLS);
  return { x: col * CELL_W + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
}

/** Chebyshev distance in cells — used to keep the differences apart. */
function cellsApart(a: number, b: number): number {
  const ac = a % SPOT_COLS;
  const ar = Math.floor(a / SPOT_COLS);
  const bc = b % SPOT_COLS;
  const br = Math.floor(b / SPOT_COLS);
  return Math.max(Math.abs(ac - bc), Math.abs(ar - br));
}

function shapePath(kind: SpotShapeKind, fill: string, theme: SpotTheme = "shop") {
  return theme === "reef" ? <ReefArt kind={kind} fill={fill} /> : <SweetArt kind={kind} fill={fill} />;
}

/** A difference's label for the picture it belongs to (display only). */
function themedLabel(label: string, theme: SpotTheme): string {
  return theme === "reef" ? reefLabel(label) : sweetLabel(label);
}

/** Translate saved labels at display time; never rewrite generated or stored differences. */
function sweetLabel(label: string): string {
  return label.replace(/\b(circle|square|triangle|star|hexagon|arrow)\b/g, kind => SWEET_NAMES[kind as SpotShapeKind]).replace('A shape', 'A sweet');
}

function DrawnShape({ shape, size = SHAPE, theme = "shop" }: { shape: SpotShape; size?: number; theme?: SpotTheme }) {
  const { x, y } = cellCentre(shape.cell);
  const scale = size / 40;
  const turns = [
    `translate(${x} ${y})`,
    shape.rot ? `rotate(${shape.rot})` : "",
    shape.flip ? "scale(-1 1)" : "",
    `scale(${scale})`,
    "translate(-20 -20)",
  ]
    .filter(Boolean)
    .join(" ");
  const colour = COLOURS[shape.colour as keyof typeof COLOURS];
  if (!colour) return null;
  return <g transform={turns}>{shapePath(shape.kind, colour, theme)}</g>;
}

/** The sweets of one picture; re-rendered only when the picture itself changes. */
const SweetLayer = memo(function SweetLayer({ shapes, size, theme }: { shapes: SpotShape[]; size: number; theme: SpotTheme }) {
  return (
    <g pointerEvents="none">
      {shapes.map((shape) => (
        <DrawnShape key={`${shape.cell}-${shape.kind}`} shape={shape} size={size} theme={theme} />
      ))}
    </g>
  );
});

function Panel({
  shapes,
  found = [],
  missed = [],
  wrongCell,
  onTap,
  height,
  rows = SPOT_ROWS,
  fitHeight = false,
  shapeSize = SHAPE,
  theme = "shop",
}: {
  /** Which picture: the sweet shop or (spotRev 1, picture 2) the rock pool. */
  theme?: SpotTheme;
  shapes: SpotShape[];
  /** Cells ringed in gold. */
  found?: number[];
  /** Reveal only: differences not found, ringed dashed in the warning colour. */
  missed?: number[];
  wrongCell?: number | null;
  onTap?: (cell: number) => void;
  height?: number;
  /** Crop the panel to the first rows — used by the small intro example. */
  rows?: number;
  /** Fit inside an equal-height play area instead of sizing from the full width. */
  fitHeight?: boolean;
  shapeSize?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${PANEL_W} ${rows * CELL_H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      {...(height ? { height } : {})}
      className={`sweet-panel dt-panel block select-none ${fitHeight ? "h-full min-h-0 w-full" : "w-full"}`}
      style={{ touchAction: "manipulation" }}
      data-dt-panel=""
      data-dt-theme={theme}
    >
      {theme === "reef" ? <ReefBackdrop cols={SPOT_COLS} rows={rows} cell={CELL_H} /> : <ShopBackdrop cols={SPOT_COLS} rows={rows} cell={CELL_H} />}
      <SweetLayer shapes={shapes} size={shapeSize} theme={theme} />
      {missed.map((cell) => {
        const { x, y } = cellCentre(cell);
        return (
          <ellipse
            key={`m${cell}`}
            cx={x}
            cy={y}
            rx={CELL_W / 2 - 2}
            ry={CELL_H / 2 - 2}
            fill="none"
            stroke="var(--dt-missed)"
            strokeWidth="2.5"
            strokeDasharray="5 3.5"
          />
        );
      })}
      {found.map((cell) => {
        const { x, y } = cellCentre(cell);
        return (
          <ellipse
            key={`f${cell}`}
            className="dt-ring-found"
            cx={x}
            cy={y}
            rx={CELL_W / 2 - 2}
            ry={CELL_H / 2 - 2}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            style={{ filter: "drop-shadow(0 0 2px var(--primary))" }}
          />
        );
      })}
      {wrongCell !== null && wrongCell !== undefined
        ? (() => {
            const { x, y } = cellCentre(wrongCell);
            return (
              <ellipse
                cx={x}
                cy={y}
                rx={CELL_W / 2 - 2}
                ry={CELL_H / 2 - 2}
                fill="none"
                stroke="var(--warn)"
                strokeWidth="2.5"
              />
            );
          })()
        : null}
      {onTap
        ? Array.from({ length: SPOT_CELLS }, (_, cell) => {
            const { x, y } = cellCentre(cell);
            return (
              <rect
                key={`t${cell}`}
                x={x - CELL_W / 2}
                y={y - CELL_H / 2}
                width={CELL_W}
                height={CELL_H}
                fill="transparent"
                role="button"
                aria-label={`Cell ${cell + 1}`}
                onClick={() => onTap(cell)}
              />
            );
          })
        : null}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Finding the differences from the two scenes (for instant feedback only —   */
/*  the score always comes from the server's stored answers).                  */
/* -------------------------------------------------------------------------- */

function sameShape(a: SpotShape, b: SpotShape): boolean {
  return (
    a.kind === b.kind &&
    a.colour === b.colour &&
    (a.rot ?? 0) === (b.rot ?? 0) &&
    (a.flip ?? false) === (b.flip ?? false)
  );
}

/** Groups of cells, one group per difference between the panels. Both panels
 *  are full grids, so every difference is a single changed cell. */
export function differenceGroups(top: SpotShape[], bottom: SpotShape[]): number[][] {
  const byBottom = new Map(bottom.map((s) => [s.cell, s]));
  const groups: number[][] = [];
  for (const shape of top) {
    const other = byBottom.get(shape.cell);
    if (!other || !sameShape(shape, other)) groups.push([shape.cell]);
  }
  return groups;
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                     */
/* -------------------------------------------------------------------------- */

const EXAMPLE_KINDS: SpotShapeKind[] = [
  "circle",
  "square",
  "triangle",
  "star",
  "hexagon",
  "arrow",
  "circle",
  "square",
  "triangle",
  "star",
  "hexagon",
  "arrow",
  "square",
  "circle",
  "arrow",
  "triangle",
];
const EXAMPLE_COLOURS: Exclude<StroopColour, "YELLOW">[] = [
  "RED",
  "BLUE",
  "GREEN",
  "PURPLE",
  "ORANGE",
  "BROWN",
  "PINK",
  "GREEN",
  "BLUE",
  "RED",
  "PURPLE",
  "GREEN",
  "ORANGE",
  "BLUE",
  "PINK",
  "BROWN",
];
const EXAMPLE_TOP: SpotShape[] = EXAMPLE_KINDS.map((kind, cell) => ({
  cell,
  kind,
  colour: EXAMPLE_COLOURS[cell]!,
}));
const EXAMPLE_BOTTOM: SpotShape[] = EXAMPLE_TOP.map((shape) =>
  shape.cell === 4 ? { ...shape, colour: "GREEN" } : shape,
);

/** Rock-pool example: the fish in cell 6 (1-based) turns round. */
const EXAMPLE_REEF_TOP: SpotShape[] = EXAMPLE_TOP.slice(0, SPOT_COLS).map((shape, i) => ({ ...shape, colour: EXAMPLE_COLOURS[(i + 3) % EXAMPLE_COLOURS.length]! }));
const EXAMPLE_REEF_BOTTOM: SpotShape[] = EXAMPLE_REEF_TOP.map((shape) => (shape.cell === 5 ? { ...shape, flip: true } : shape));

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Six differences in the sweet shop, then six more in the rock pool.
      </p>
      <div className="flex w-full flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card">
        <Panel shapes={EXAMPLE_TOP} found={[4]} rows={1} />
        <Panel shapes={EXAMPLE_BOTTOM} found={[4]} rows={1} />
      </div>
      <div className="flex w-full flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card" data-dt-theme="reef">
        <Panel shapes={EXAMPLE_REEF_TOP} theme="reef" found={[5]} rows={1} />
        <Panel shapes={EXAMPLE_REEF_BOTTOM} theme="reef" found={[5]} rows={1} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tap each difference in either panel. 60 seconds for both pictures.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Play                                                                      */
/* -------------------------------------------------------------------------- */

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const data = puzzle.type === "spotdiff" ? puzzle : null;
  const scenes = useMemo(() => (data ? spotScenes(data) : []), [data]);
  const twoPictures = scenes.length > 1;
  const key = scenes.map((sc) => sc.top.map((s) => `${s.cell}${s.kind}${s.colour}`).join("|")).join("/");
  const allGroups = useMemo(() => scenes.map((sc) => differenceGroups(sc.top, sc.bottom)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [scene, setScene] = useState(0);
  const [taps, setTaps] = useState<number[][]>(() => scenes.map(() => []));
  const [wrong, setWrong] = useState<number | null>(null);
  const submitted = useRef("");
  const arenaRef = useRef<HTMLDivElement>(null);
  const groups = allGroups[scene] ?? [];
  const glow = useRef<() => void>(() => undefined);
  glow.current = () => {
    if (arenaRef.current) playDifferenceGlow(arenaRef.current, groups.flat(), { cols: SPOT_COLS, cell: CELL_W, width: PANEL_W, height: PANEL_H });
  };
  useEffect(() => registerFxPreview("spotdiff", () => glow.current()), []);

  useEffect(() => {
    setScene(0);
    setTaps(scenes.map(() => []));
    setWrong(null);
    submitted.current = "";
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const sceneTaps = taps[scene] ?? [];
  const foundGroups = groups.filter((g) => g.some((cell) => sceneTaps.includes(cell)));
  const foundCells = foundGroups.flat();
  const total = Math.min(SPOT_DIFFERENCES, groups.length) || SPOT_DIFFERENCES;
  const groupCells = new Set(groups.flat());
  const misses = sceneTaps.filter((c) => !groupCells.has(c)).length;
  const limitMs = data?.timeLimitMs ?? SPOT_TIME_MS;
  const lastScene = scene >= scenes.length - 1;
  // Stored rounds send "c1,c2,…"; spotRev 1 sends one list per picture, "picture1|picture2".
  const answer = twoPictures ? taps.map((t) => t.join(",")).join("|") : (taps[0] ?? []).join(",");

  // All six found in the last picture lock the round in (in picture 1 they bring on
  // picture 2); otherwise the taps so far go up just before the clock runs out. The
  // server re-checks every tap either way.
  useEffect(() => {
    if (groups.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + limitMs - 400;
    const sceneDone = foundGroups.length >= total;
    if (!sceneDone && !timeUp) return;
    if (sceneDone && !lastScene && !timeUp) return;
    submitted.current = key;
    // Finish effect when all six are found (display only, never awaited).
    if (sceneDone) glow.current();
    onSubmit(answer);
  }, [foundGroups.length, total, locked, now, key, lastScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Picture 1 finished: a short glow, then picture 2 slides in (the clock keeps running).
  useEffect(() => {
    if (!twoPictures || lastScene || locked || foundGroups.length < total || groups.length === 0) return;
    glow.current();
    const timer = setTimeout(() => setScene((s) => Math.min(s + 1, scenes.length - 1)), 700);
    return () => clearTimeout(timer);
  }, [foundGroups.length, total, lastScene, twoPictures, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (wrong === null) return;
    const timer = setTimeout(() => setWrong(null), 340);
    return () => clearTimeout(timer);
  }, [wrong]);

  if (!data) return null;
  const current = scenes[scene]!;
  const sceneFinished = foundGroups.length >= total;

  const tap = (cell: number) => {
    if (locked || sceneFinished) return;
    if (foundCells.includes(cell)) return;
    const hit = groups.some((g) => g.includes(cell));
    const add = (prev: number[][]) => prev.map((t, i) => (i === scene && !t.includes(cell) ? [...t, cell] : t));
    if (hit) {
      playCorrect();
      soundCue("spotdiff.found");
      setTaps(add);
    } else {
      playWrong();
      soundCue("spotdiff.miss");
      setTaps(add);
      setWrong(cell);
    }
  };

  const skip = () => {
    if (locked || lastScene) return;
    soundCue("spotdiff.nextPicture");
    setScene(scene + 1);
  };

  return (
    <div data-stage-column="2" data-polish="spotdiff" className="spot-difference-stage flex min-h-0 flex-1 flex-col items-center gap-2">
      <div className="flex w-full shrink-0 items-center justify-center gap-3 font-mono text-sm uppercase tracking-widest">
        {twoPictures ? <span className="text-muted-foreground" data-dt-picture={scene + 1}>Picture {scene + 1} / {scenes.length}</span> : null}
        <span className="text-primary">{foundGroups.length} / {total} found</span>
        {twoPictures ? (
          <span className={misses > SPOT_TWO_WRONG_LIMIT ? "text-warn" : "text-muted-foreground"} data-dt-misses={misses}>
            Misses {misses} / {SPOT_TWO_WRONG_LIMIT}
          </span>
        ) : null}
      </div>
      <div
        ref={arenaRef}
        key={scene}
        data-dt-theme={current.theme}
        data-game-arena="tall" className={`dt-arena flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card ${
          scene > 0 ? "dt-scene-in" : ""
        } ${wrong !== null ? "animate-shake" : ""}`}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <Panel shapes={current.top} theme={current.theme} found={foundCells} wrongCell={wrong} onTap={tap} fitHeight shapeSize={SHAPE} />
        </div>
        <div className="h-px w-full shrink-0 bg-border" aria-hidden="true" />
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <Panel shapes={current.bottom} theme={current.theme} found={foundCells} wrongCell={wrong} onTap={tap} fitHeight shapeSize={SHAPE} />
        </div>
      </div>
      {twoPictures && !lastScene ? (
        <button
          type="button"
          onClick={skip}
          disabled={locked || sceneFinished}
          data-game-controls="actions"
          className="tap-target w-full shrink-0 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-wide text-foreground disabled:opacity-40"
        >
          Next picture
        </button>
      ) : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const [shown, setShown] = useState<number | null>(null);
  if (puzzle.type !== "spotdiff") return null;
  const scenes = spotScenes(puzzle);
  const twoPictures = scenes.length > 1;
  const differences = puzzle.differences ?? [];
  const tapsByScene = twoPictures
    ? parseSpotTaps(myAnswer, scenes.length)
    : [
        (myAnswer ?? "")
          .split(",")
          .map((v) => Number.parseInt(v, 10))
          .filter((v) => Number.isFinite(v)),
      ];
  const pictures = scenes.map((sc, i) => {
    const own = differences.filter((d) => (d.scene ?? 0) === i);
    const taps = tapsByScene[i] ?? [];
    const found = own.filter((d) => d.cells.some((cell) => taps.includes(cell)));
    const foundCells = found.flatMap((d) => d.cells);
    const missedCells = own.flatMap((d) => d.cells).filter((cell) => !foundCells.includes(cell));
    return { scene: sc, own, found, foundCells, missedCells };
  });
  // One picture at a time on spotRev 1; the first with a miss opens first.
  const open = shown ?? Math.max(0, pictures.findIndex((p) => p.found.length < p.own.length));
  const pic = pictures[open]!;
  const totalFound = pictures.reduce((n, p) => n + p.found.length, 0);
  const totalDiffs = twoPictures ? differences.length : SPOT_DIFFERENCES;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5">
      {twoPictures ? (
        <div className="flex w-full gap-1" role="tablist" aria-label="Pictures">
          {pictures.map((p, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === open}
              onClick={() => setShown(i)}
              className={`min-h-11 flex-1 rounded-xl border px-2 font-mono text-sm font-bold ${i === open ? "border-primary/70 bg-card" : "border-transparent bg-card/60"} ${
                p.found.length === p.own.length ? "text-primary" : "text-warn"
              }`}
            >
              Picture {i + 1} · {p.found.length} / {p.own.length}
            </button>
          ))}
        </div>
      ) : null}
      {/* Side by side: each picture is larger than when stacked on a short phone. */}
      <div className="dt-reveal-panels dt-arena flex w-full flex-row gap-1 overflow-hidden rounded-2xl border border-border bg-card p-1" data-dt-theme={pic.scene.theme}>
        <div className="min-w-0 flex-1 overflow-hidden rounded-lg">
          <Panel shapes={pic.scene.top} theme={pic.scene.theme} found={pic.foundCells} missed={pic.missedCells} />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden rounded-lg">
          <Panel shapes={pic.scene.bottom} theme={pic.scene.theme} found={pic.foundCells} missed={pic.missedCells} />
        </div>
      </div>
      <div className="flex w-full flex-col gap-0.5">
        {pic.own.map((difference, index) => {
          const got = pic.found.includes(difference);
          return (
            <div key={index} className="flex items-center justify-between text-base leading-6">
              <span className="text-foreground/80">{themedLabel(difference.label, pic.scene.theme)}</span>
              <span className={`font-display font-bold ${got ? "text-primary" : "text-warn"}`}>
                {got ? "✓" : "✗"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-2xl font-bold tabular-nums text-primary">
        {totalFound} / {totalDiffs} found
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Generation (server-side)                                                  */
/* -------------------------------------------------------------------------- */

function otherColour(colour: StroopColour): StroopColour {
  const banned = TOO_CLOSE.flatMap(([a, b]) => (colour === a ? [b] : colour === b ? [a] : []));
  const options = COLOUR_KEYS.filter((c) => c !== colour && !banned.includes(c));
  return pick(options);
}

/** Fills every cell of the grid — both panels are complete pictures. */
function fillGrid(): SpotShape[] {
  return Array.from({ length: SPOT_CELLS }, (_, cell) => {
    const kind = pick(KINDS);
    const shape: SpotShape = { cell, kind, colour: pick(COLOUR_KEYS) };
    if (TURNABLE.includes(kind) && Math.random() < 0.4) shape.rot = 90;
    return shape;
  });
}

function applyDifference(
  kind: SpotDifferenceKind,
  shape: SpotShape,
): { bottom: SpotShape; difference: SpotDifference } | null {
  switch (kind) {
    case "colour": {
      const colour = otherColour(shape.colour);
      return {
        bottom: { ...shape, colour },
        difference: { kind, cells: [shape.cell], label: `A shape changed colour` },
      };
    }
    case "turn": {
      if (!TURNABLE.includes(shape.kind)) return null;
      const bottom: SpotShape = shape.rot
        ? { ...shape, rot: 0 }
        : Math.random() < 0.5
          ? { ...shape, rot: 90 }
          : { ...shape, flip: !shape.flip };
      return {
        bottom,
        difference: { kind, cells: [shape.cell], label: `A ${shape.kind} was turned round` },
      };
    }
    default: {
      const swap = KIND_SWAP[shape.kind];
      return {
        bottom: { ...shape, kind: swap },
        difference: {
          kind: "kind",
          cells: [shape.cell],
          label: `A ${shape.kind} became a ${swap}`,
        },
      };
    }
  }
}

/** One picture pair with six stored differences (the generator every revision uses). */
function buildPicture(): Pick<SpotPuzzleData, "top" | "bottom"> & { differences: SpotDifference[] } {
  const { top, bottom, differences = [] } = buildSpotPicture();
  return { top, bottom, differences };
}

/**
 * spotRev 1 (14 Oct 2026): two pictures, each with its own six differences — the sweet
 * shop, then the rock pool (the same shape kinds, drawn as sea creatures) — on a 60 s
 * clock stored on the puzzle.
 */
export function buildSpotDifference(): SpotPuzzleData {
  const shop = buildPicture();
  const reef = buildPicture();
  return {
    type: "spotdiff",
    top: shop.top,
    bottom: shop.bottom,
    reef: { top: reef.top, bottom: reef.bottom },
    differences: [
      ...shop.differences.map((d) => ({ ...d, scene: 0 })),
      ...reef.differences.map((d) => ({ ...d, scene: 1 })),
    ],
    spotRev: SPOT_REV,
    timeLimitMs: ATTENTION_REWORK_TIME_MS,
  };
}

function buildSpotPicture(): SpotPuzzleData {
  // Only changes that work on a full grid: a colour, a shape, or a turn.
  const ALL: SpotDifferenceKind[] = ["colour", "kind", "turn"];

  for (let attempt = 0; attempt < 400; attempt++) {
    const top = fillGrid();
    const candidates = shuffled(top);

    const bottom = new Map(top.map((s) => [s.cell, { ...s }]));
    const differences: SpotDifference[] = [];
    const usedCells: number[] = [];

    for (const shape of candidates) {
      if (differences.length === SPOT_DIFFERENCES) break;
      // Differences never sit next to each other.
      if (usedCells.some((cell) => cellsApart(cell, shape.cell) < 2)) continue;
      const applied = applyDifference(pick(shuffled(ALL)), shape);
      if (!applied) continue;
      bottom.set(applied.bottom.cell, applied.bottom);
      differences.push(applied.difference);
      usedCells.push(shape.cell);
    }

    if (differences.length !== SPOT_DIFFERENCES) continue;

    const bottomShapes = [...bottom.values()].sort((a, b) => a.cell - b.cell);
    // The panels must differ in exactly the six stored ways.
    if (differenceGroups(top, bottomShapes).length !== SPOT_DIFFERENCES) continue;

    return {
      type: "spotdiff",
      top: [...top].sort((a, b) => a.cell - b.cell),
      bottom: bottomShapes,
      differences,
    };
  }

  // Fallback: six separated colour changes on a full grid.
  const top = fillGrid();
  const FALLBACK_CELLS = [0, 3, 6, 25, 28, 47];
  const chosen = top.filter((shape) => FALLBACK_CELLS.includes(shape.cell)).slice(0, SPOT_DIFFERENCES);
  const bottom = top.map((shape) =>
    chosen.some((candidate) => candidate.cell === shape.cell)
      ? { ...shape, colour: otherColour(shape.colour) }
      : shape,
  );
  return {
    type: "spotdiff",
    top,
    bottom,
    differences: chosen.map((shape) => ({
      kind: "colour" as const,
      cells: [shape.cell],
      label: "A shape changed colour",
    })),
  };
}

export const spotDifferencePuzzle: PuzzleDefinition = {
  key: "spotdiff",
  name: gameDisplayName("spotdiff"),
  category: "attention",
  timeLimitMs: SPOT_TIME_MS,
  generate: buildSpotDifference,
  // Scored from how many of the six stored differences were tapped.
  check: () => true,
  revealHeading: "The differences",
  IntroExample,
  Stage,
  Reveal,
};
