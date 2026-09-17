import { useEffect, useMemo, useRef } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import {
  decodeMirrors,
  encodeMirrors,
  flipMirror,
  traceBeam,
  verifyLaser,
} from "@/lib/duel/laser";
import { useStageState } from "@/lib/duel/stageState";
import {
  LASER_CELLS,
  LASER_COLS,
  LASER_TIME_MS,
  type BeamDir,
  type LaserPuzzleData,
  type MirrorPlacement,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

/** The grid, the beam and the mirrors, drawn in cell units so it scales freely. */
function LaserBoard({
  source,
  dir,
  target,
  blocks,
  placed,
  cols = LASER_COLS,
  cells = LASER_CELLS,
  onCell,
  boxRef,
}: {
  source: number;
  dir: BeamDir;
  target: number;
  blocks: number[];
  placed: MirrorPlacement[];
  cols?: number;
  cells?: number;
  onCell?: ((cell: number) => void) | undefined;
  boxRef?: React.RefObject<HTMLDivElement | null> | undefined;
}) {
  const rows = Math.ceil(cells / cols);
  const wall = new Set(blocks);
  const inner = useRef<HTMLDivElement | null>(null);
  const box = boxRef ?? inner;
  const trace = traceBeam(source, dir, placed, blocks, target);
  const hit = trace.hitTarget;
  const mirrorAt = new Map(placed.map((mirror) => [mirror.cell, mirror.kind]));

  const cellAt = (clientX: number, clientY: number): number | null => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * cols);
    const row = Math.floor(((clientY - rect.top) / rect.height) * rows);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return row * cols + col;
  };

  const centre = (cell: number) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`;

  return (
    <div
      ref={box}
      className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full select-none"
      style={{ touchAction: "manipulation" }}
      onPointerDown={(event) => {
        if (!onCell) return;
        const cell = cellAt(event.clientX, event.clientY);
        if (cell !== null) onCell(cell);
      }}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {Array.from({ length: cols * rows }, (_, cell) => {
          if (wall.has(cell)) return <div key={cell} className="rounded-md bg-foreground/75" />;
          if (cell === target) {
            return (
              <div
                key={cell}
                aria-label="Target"
                className={`rounded-full border-2 ${
                  hit ? "border-primary bg-primary/50" : "border-primary/60 bg-primary/10"
                }`}
              />
            );
          }
          if (cell === source) {
            return <div key={cell} aria-label="Laser" className="rounded-md bg-primary/25" />;
          }
          return (
            <div
              key={cell}
              className={`rounded-[3px] border bg-card ${
                mirrorAt.has(cell) ? "border-primary/50" : "border-border/50"
              }`}
            />
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${cols} ${rows}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {trace.segments.map((run, index) =>
          run.length > 1 ? (
            <polyline
              key={index}
              points={run.map(centre).join(" ")}
              fill="none"
              stroke={GOLD}
              strokeWidth={0.14}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 3px rgba(245,198,76,0.85))" }}
            />
          ) : null,
        )}
        {placed.map((mirror) => {
          const col = mirror.cell % cols;
          const row = Math.floor(mirror.cell / cols);
          const forward = mirror.kind === "/";
          return (
            <line
              key={`m-${mirror.cell}`}
              x1={col + (forward ? 0.18 : 0.18)}
              y1={row + (forward ? 0.82 : 0.18)}
              x2={col + 0.82}
              y2={row + (forward ? 0.18 : 0.82)}
              stroke="#FFFFFF"
              strokeWidth={0.12}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={(source % cols) + 0.5} cy={Math.floor(source / cols) + 0.5} r={0.18} fill={GOLD} />
      </svg>
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Place the mirrors so the laser reaches the target.
      </p>
      <div style={{ width: 132 }}>
        <LaserBoard
          cols={4}
          cells={16}
          source={0}
          dir="R"
          target={14}
          blocks={[3]}
          placed={[{ cell: 2, kind: "\\" }]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Tap a mirror to flip it. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "laser" }: PuzzleStageProps) {
  const isLaser = puzzle.type === "laser";
  const source = isLaser ? puzzle.source : 0;
  const dir: BeamDir = isLaser ? puzzle.dir : "R";
  const target = isLaser ? puzzle.target : 0;
  const blocks = isLaser ? puzzle.blocks : [];
  const total = isLaser ? puzzle.mirrors : 0;
  const [placed, setPlaced] = useStageState<MirrorPlacement[]>(stateKey, "mirrors", () => []);
  const submitted = useRef(false);

  const verdict = useMemo(
    () => verifyLaser({ source, dir, target, blocks, mirrors: total }, placed),
    [source, dir, target, blocks, total, placed],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeMirrors(placed));
  }, [placed, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !verdict.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeMirrors(placed));
  }, [verdict.solved, placed, locked, onSubmit]);

  const tapCell = (cell: number) => {
    if (locked || submitted.current || verdict.solved) return;
    if (cell === source || cell === target || blocks.includes(cell)) return;
    const existing = placed.find((mirror) => mirror.cell === cell);
    if (existing) {
      hapticTick();
      setPlaced((current) =>
        current.map((mirror) =>
          mirror.cell === cell ? { cell, kind: flipMirror(mirror.kind) } : mirror,
        ),
      );
      return;
    }
    if (placed.length >= total) {
      buzz(20);
      playWrong();
      return;
    }
    hapticTick();
    setPlaced((current) => [...current, { cell, kind: "/" }]);
  };

  if (!isLaser) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        mirrors placed <span className="text-primary">{placed.length}</span> / {total}
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <LaserBoard
          source={source}
          dir={dir}
          target={target}
          blocks={blocks}
          placed={placed}
          onCell={tapCell}
        />
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2">
        {Array.from({ length: total }, (_, index) => {
          const used = index < placed.length;
          return (
            <div
              key={index}
              aria-label={used ? "Mirror placed" : "Mirror in the tray"}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                used ? "border-border/40 opacity-30" : "border-primary/60 bg-card"
              }`}
            >
              <span className="text-lg text-foreground">/</span>
            </div>
          );
        })}
        <button
          type="button"
          disabled={locked || !placed.length}
          onClick={() => setPlaced([])}
          className="h-11 rounded-xl border border-border px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        Tap a square to place a mirror · tap it again to flip it
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  const isLaser = puzzle.type === "laser";
  if (!isLaser) return null;
  const solution = puzzle.solution ?? [];
  const mine = decodeMirrors(myAnswer ?? "", puzzle.mirrors);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((LASER_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-end justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div style={{ width: 150 }}>
            <LaserBoard
              source={puzzle.source}
              dir={puzzle.dir}
              target={puzzle.target}
              blocks={puzzle.blocks}
              placed={solution}
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            solution
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div style={{ width: 110 }}>
            <LaserBoard
              source={puzzle.source}
              dir={puzzle.dir}
              target={puzzle.target}
              blocks={puzzle.blocks}
              placed={mine}
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `Solved${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
          : "Not solved"}
      </p>
    </div>
  );
}

/** Layouts and the mirror placement are built server-side and stay there. */
export const laserPuzzle: PuzzleDefinition = {
  key: "laser",
  name: "Laser and Mirrors",
  category: "pattern",
  timeLimitMs: LASER_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "laser",
      source: 0,
      dir: "R",
      target: 0,
      blocks: [],
      mirrors: 0,
    }) satisfies LaserPuzzleData,
  check: () => false,
  revealHeading: "The mirror placement",
  IntroExample,
  Stage,
  Reveal,
};
