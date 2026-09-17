import { useCallback, useEffect, useRef, useState } from "react";

import { gridCellAt, hapticTick } from "@/components/puzzles/GridDrag";
import {
  decodeLaserAnswer,
  encodeLaserAnswer,
  flipMirror,
  traceBeam,
  verifyLaser,
  type BeamTrace,
} from "@/lib/duel/laser";
import { useStageState } from "@/lib/duel/stageState";
import {
  LASER_BEAM_MS,
  LASER_CELLS,
  LASER_COLS,
  LASER_FADE_MS,
  LASER_MAX_FIRES,
  LASER_TIME_MS,
  type BeamDir,
  type LaserPuzzleData,
  type MirrorPlacement,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

/** A faceted diamond, dim until the beam passes through it. */
function Gem({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      <polygon
        points="12,2 22,9 12,22 2,9"
        fill={lit ? GOLD : "transparent"}
        stroke={lit ? GOLD : "hsl(var(--muted-foreground))"}
        strokeWidth={2}
        opacity={lit ? 1 : 0.65}
      />
      <polyline
        points="2,9 22,9"
        fill="none"
        stroke={lit ? "rgba(0,0,0,0.35)" : "hsl(var(--muted-foreground))"}
        strokeWidth={1.4}
        opacity={0.7}
      />
      <polyline
        points="7,9 12,22 17,9"
        fill="none"
        stroke={lit ? "rgba(0,0,0,0.35)" : "hsl(var(--muted-foreground))"}
        strokeWidth={1.4}
        opacity={0.6}
      />
    </svg>
  );
}

/** The grid, the fired beam and the mirrors, drawn in cell units so it scales freely. */
function LaserBoard({
  source,
  dir,
  gems,
  bombs,
  blocks,
  placed,
  beam = null,
  litGems = [],
  bombFlash = false,
  cols = LASER_COLS,
  cells = LASER_CELLS,
  onCell,
  boxRef,
}: {
  source: number;
  dir: BeamDir;
  gems: number[];
  bombs: number[];
  blocks: number[];
  placed: MirrorPlacement[];
  /** The cells the beam has drawn so far, or null before the first shot. */
  beam?: number[] | null;
  litGems?: number[];
  bombFlash?: boolean;
  cols?: number;
  cells?: number;
  onCell?: ((cell: number) => void) | undefined;
  boxRef?: React.RefObject<HTMLDivElement | null> | undefined;
}) {
  const rows = Math.ceil(cells / cols);
  const wall = new Set(blocks);
  const gemSet = new Set(gems);
  const bombSet = new Set(bombs);
  const litSet = new Set(litGems);
  const inner = useRef<HTMLDivElement | null>(null);
  const box = boxRef ?? inner;
  const mirrorAt = new Map(placed.map((mirror) => [mirror.cell, mirror.kind]));

  // Measured from the live board on every event, so taps land on the cell touched.
  const cellAt = (clientX: number, clientY: number): number | null =>
    gridCellAt(box.current, clientX, clientY, cols, rows);

  const centre = (cell: number) => `${(cell % cols) + 0.5},${Math.floor(cell / cols) + 0.5}`;
  const arrow: Record<BeamDir, string> = { U: "▲", D: "▼", L: "◀", R: "▶" };

  return (
    <div
      ref={box}
      className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full select-none"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => {
        if (!onCell) return;
        event.preventDefault();
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
          if (gemSet.has(cell)) {
            return (
              <div key={cell} aria-label={litSet.has(cell) ? "Gem lit" : "Gem"} className="p-[1px]">
                <Gem lit={litSet.has(cell)} />
              </div>
            );
          }
          if (bombSet.has(cell)) {
            return (
              <div
                key={cell}
                aria-label="Bomb"
                className={`flex items-center justify-center rounded-full border-2 ${
                  bombFlash ? "border-destructive bg-destructive/40" : "border-destructive/70"
                }`}
              >
                <span className="h-1/2 w-1/2 rounded-full bg-foreground/85" />
              </div>
            );
          }
          if (cell === source) {
            return (
              <div
                key={cell}
                aria-label="Laser"
                className="flex items-center justify-center rounded-md bg-primary/25 text-[8px] leading-none text-primary"
              >
                {arrow[dir]}
              </div>
            );
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
        {beam && beam.length > 1 ? (
          <polyline
            points={beam.map(centre).join(" ")}
            fill="none"
            stroke={bombFlash ? "hsl(var(--destructive))" : GOLD}
            strokeWidth={0.14}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: bombFlash
                ? "drop-shadow(0 0 3px rgba(255,80,80,0.9))"
                : "drop-shadow(0 0 3px rgba(245,198,76,0.85))",
            }}
          />
        ) : null}
        {placed.map((mirror) => {
          const col = mirror.cell % cols;
          const row = Math.floor(mirror.cell / cols);
          const forward = mirror.kind === "/";
          return (
            <line
              key={`m-${mirror.cell}`}
              x1={col + 0.18}
              y1={row + (forward ? 0.82 : 0.18)}
              x2={col + 0.82}
              y2={row + (forward ? 0.18 : 0.82)}
              stroke="#FFFFFF"
              strokeWidth={0.12}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const gems = [5, 14];
  const solution: MirrorPlacement[] = [
    { cell: 1, kind: "\\" },
    { cell: 13, kind: "/" },
  ];
  const trace = traceBeam(0, "R", solution, [], [7], gems);
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Place all four mirrors so one shot lights both gems — and never touches a bomb.
      </p>
      <div style={{ width: 132 }}>
        <LaserBoard
          cols={4}
          cells={16}
          source={0}
          dir="R"
          gems={gems}
          bombs={[7]}
          blocks={[]}
          placed={solution}
          beam={trace.cells}
          litGems={trace.gemsLit}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Three shots. Fewer shots scores more. You have 75 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "laser" }: PuzzleStageProps) {
  const isLaser = puzzle.type === "laser";
  const source = isLaser ? puzzle.source : 0;
  const dir: BeamDir = isLaser ? puzzle.dir : "R";
  const gems = isLaser ? puzzle.gems : [];
  const bombs = isLaser ? puzzle.bombs : [];
  const blocks = isLaser ? puzzle.blocks : [];
  const total = isLaser ? puzzle.mirrors : 0;

  const [placed, setPlaced] = useStageState<MirrorPlacement[]>(stateKey, "mirrors", () => []);
  const [fires, setFires] = useStageState<number>(stateKey, "fires", () => 0);
  const [shot, setShot] = useState<{ trace: BeamTrace; step: number; done: boolean } | null>(null);
  const submitted = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  useEffect(() => {
    onDraftAnswer?.(encodeLaserAnswer(placed, Math.max(1, fires)));
  }, [placed, fires, onDraftAnswer]);

  const revealed = shot ? shot.trace.cells.slice(0, shot.step + 1) : null;
  const litGems = shot ? shot.trace.gemsLit.filter((gem) => revealed?.includes(gem)) : [];
  const bombFlash = Boolean(shot?.done && shot.trace.hitBomb);
  const solved = submitted.current;
  const firesLeft = Math.max(0, LASER_MAX_FIRES - fires);

  const fire = useCallback(() => {
    if (locked || submitted.current || firesLeft === 0 || shot) return;
    const verdict = verifyLaser({ source, dir, gems, bombs, blocks, mirrors: total }, placed);
    const attempt = fires + 1;
    setFires(attempt);
    clearTimers();
    setShot({ trace: verdict.trace, step: 0, done: false });

    const cells = verdict.trace.cells.length;
    const per = Math.max(24, Math.round(LASER_BEAM_MS / Math.max(1, cells - 1)));
    for (let step = 1; step < cells; step++) {
      timers.current.push(
        window.setTimeout(
          () => setShot((current) => (current ? { ...current, step } : current)),
          per * step,
        ),
      );
    }
    timers.current.push(
      window.setTimeout(
        () => {
          setShot((current) => (current ? { ...current, step: cells - 1, done: true } : current));
          if (verdict.solved) {
            if (submitted.current) return;
            submitted.current = true;
            playCorrect();
            onSubmit(encodeLaserAnswer(placed, attempt));
            return;
          }
          buzz(20);
          playWrong();
          timers.current.push(window.setTimeout(() => setShot(null), LASER_FADE_MS));
        },
        per * Math.max(1, cells - 1),
      ),
    );
  }, [
    locked,
    firesLeft,
    shot,
    source,
    dir,
    gems,
    bombs,
    blocks,
    total,
    placed,
    fires,
    setFires,
    onSubmit,
  ]);

  const tapCell = (cell: number) => {
    if (locked || submitted.current || shot) return;
    if (cell === source || gems.includes(cell) || bombs.includes(cell) || blocks.includes(cell))
      return;
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
      <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        mirrors <span className="text-primary">{placed.length}</span> / {total}
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <LaserBoard
          source={source}
          dir={dir}
          gems={gems}
          bombs={bombs}
          blocks={blocks}
          placed={placed}
          beam={revealed}
          litGems={litGems}
          bombFlash={bombFlash}
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
          disabled={locked || solved || !placed.length || Boolean(shot)}
          onClick={() => setPlaced([])}
          className="h-11 rounded-xl border border-border px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          disabled={locked || solved || firesLeft === 0 || Boolean(shot)}
          onClick={fire}
          className="h-12 flex-1 rounded-xl bg-primary font-mono text-sm uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          Fire
        </button>
        <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Fires left: {firesLeft}
        </span>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  const isLaser = puzzle.type === "laser";
  if (!isLaser) return null;
  const solution = puzzle.solution ?? [];
  const mine = decodeLaserAnswer(myAnswer ?? "", puzzle.mirrors);
  const solutionTrace = traceBeam(
    puzzle.source,
    puzzle.dir,
    solution,
    puzzle.blocks,
    puzzle.bombs,
    puzzle.gems,
  );
  const myTrace = traceBeam(
    puzzle.source,
    puzzle.dir,
    mine.mirrors,
    puzzle.blocks,
    puzzle.bombs,
    puzzle.gems,
  );
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((LASER_TIME_MS - myMsRemaining) / 100) / 10;
  const ordinal = mine.fires === 1 ? "1st" : mine.fires === 2 ? "2nd" : "3rd";
  const result = myCorrect
    ? `Both gems · ${ordinal} shot${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
    : myTrace.gemsLit.length >= 1
      ? "1 gem"
      : "Missed";

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-end justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <div style={{ width: 150 }}>
            <LaserBoard
              source={puzzle.source}
              dir={puzzle.dir}
              gems={puzzle.gems}
              bombs={puzzle.bombs}
              blocks={puzzle.blocks}
              placed={solution}
              beam={solutionTrace.cells}
              litGems={solutionTrace.gemsLit}
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
              gems={puzzle.gems}
              bombs={puzzle.bombs}
              blocks={puzzle.blocks}
              placed={mine.mirrors}
              beam={mine.mirrors.length ? myTrace.cells : null}
              litGems={myTrace.gemsLit}
              bombFlash={myTrace.hitBomb}
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">{result}</p>
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
      gems: [],
      bombs: [],
      blocks: [],
      mirrors: 0,
    }) satisfies LaserPuzzleData,
  check: () => false,
  revealHeading: "The mirror placement",
  IntroExample,
  Stage,
  Reveal,
};
