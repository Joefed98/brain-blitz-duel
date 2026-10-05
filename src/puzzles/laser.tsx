import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  gridCellAt,
  gridCellCentre,
  hapticTick,
  useGridMetrics,
} from "@/components/puzzles/GridDrag";
import {
  decodeLaserAnswer,
  encodeLaserAnswer,
  flipMirror,
  isSplitter,
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
  type MirrorKind,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";
const GREY = "var(--muted-foreground)";
const RED = "var(--destructive)";

/**
 * A faceted diamond — a rotated square with a lighter facet line across it —
 * drawn inline so no icon font or emoji is involved. Dim grey until the beam
 * passes through it, then gold with a soft glow.
 */
function Gem({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full overflow-visible" aria-hidden="true">
      <polygon
        points="12,2 22,12 12,22 2,12"
        fill={lit ? GOLD : GREY}
        fillOpacity={lit ? 1 : 0.55}
        stroke={GOLD}
        strokeOpacity={lit ? 1 : 0.45}
        strokeWidth={1.6}
        style={lit ? { filter: "drop-shadow(0 0 3px rgba(245,198,76,0.95))" } : undefined}
      />
      <polyline
        points="4.5,10 19.5,10"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={lit ? 0.75 : 0.5}
        strokeWidth={1.2}
      />
    </svg>
  );
}

export function directionalChevronPoints(dir: BeamDir): string {
  if (dir === "R") return "3,10 6,12 3,14";
  if (dir === "L") return "21,10 18,12 21,14";
  if (dir === "D") return "10,3 12,6 14,3";
  return "10,21 12,18 14,21";
}

function DirectionalGem({ lit, from }: { lit: boolean; from?: BeamDir }) {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full overflow-visible" aria-hidden="true">
      <g transform="translate(6 6) scale(.5)"><Gem lit={lit} /></g>
      {from ? <polyline points={directionalChevronPoints(from)} fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

function Splitter({ kind = "S-" }: { kind?: MirrorKind }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[90%] w-[90%]" aria-hidden="true">
      <polygon points="12,1.5 22.5,12 12,22.5 1.5,12" fill="var(--card)" stroke="var(--opponent)" strokeWidth="1.8" />
      <path transform={kind === "S|" ? "" : "rotate(90 12 12)"} d="M12 22V12M2 12H22M2 12L6 8M2 12L6 16M22 12L18 8M22 12L18 16" fill="none" stroke="var(--opponent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The arrow head on the source cell, drawn from the stored beam direction. */
function sourceArrowPoints(x: number, y: number, dir: BeamDir, size: number): string {
  const half = size / 2;
  if (dir === "R") return `${x - half},${y - half} ${x + half},${y} ${x - half},${y + half}`;
  if (dir === "L") return `${x + half},${y - half} ${x - half},${y} ${x + half},${y + half}`;
  if (dir === "D") return `${x - half},${y - half} ${x},${y + half} ${x + half},${y - half}`;
  return `${x - half},${y + half} ${x},${y - half} ${x + half},${y + half}`;
}

/** Each fork starts when the travelling beam reaches its parent splitter. */
export function beamBranchOffsets(paths: number[][]): number[] {
  const offsets: number[] = [];
  paths.forEach((path, index) => {
    if (index === 0) { offsets.push(0); return; }
    for (let parent = index - 1; parent >= 0; parent--) {
      const position = paths[parent]?.indexOf(path[0]!) ?? -1;
      if (position >= 0) { offsets.push(offsets[parent]! + position); return; }
    }
    offsets.push(Number.POSITIVE_INFINITY);
  });
  return offsets;
}

interface BoardPointer {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * The grid, the fired beam and the mirrors. Everything drawn over the grid is
 * placed from the grid's own measured cell centres, so the beam, the mirrors
 * and the drag ghost always sit exactly on the squares they belong to.
 */
function LaserBoard({
  source,
  dir,
  gems,
  bombs,
  blocks,
  splitters = [],
  directionalGems = [],
  placed,
  beam = null,
  litGems = [],
  bombFlash = false,
  cols = LASER_COLS,
  cells = LASER_CELLS,
  ghostCell = null,
  shake = false,
  pointer,
  gridRef,
}: {
  source: number;
  dir: BeamDir;
  gems: number[];
  bombs: number[];
  blocks: number[];
  splitters?: number[];
  directionalGems?: { cell: number; from: BeamDir }[];
  placed: MirrorPlacement[];
  /** Separate beam branches, or null before the first shot. */
  beam?: number[][] | null;
  litGems?: number[];
  bombFlash?: boolean;
  cols?: number;
  cells?: number;
  /** The cell a drag would drop on right now. */
  ghostCell?: number | null;
  shake?: boolean;
  pointer?: BoardPointer | undefined;
  /** The grid element itself, used for hit testing. */
  gridRef?: React.RefObject<HTMLDivElement | null> | undefined;
}) {
  const rows = Math.ceil(cells / cols);
  const wall = new Set(blocks);
  const gemSet = new Set(gems);
  const bombSet = new Set(bombs);
  const litSet = new Set(litGems);
  const inner = useRef<HTMLDivElement | null>(null);
  const grid = gridRef ?? inner;
  const metrics = useGridMetrics(grid, cols, rows);
  const mirrorAt = new Map(placed.map((mirror) => [mirror.cell, mirror.kind]));
  const unit = metrics ? Math.min(metrics.cellW, metrics.cellH) : 0;
  const at = (cell: number) => (metrics ? gridCellCentre(metrics, cell, cols) : { x: 0, y: 0 });

  return (
    <div
      className={`relative mx-auto aspect-square h-full max-h-full w-full max-w-full select-none ${
        shake ? "animate-shake" : ""
      }`}
      style={{ touchAction: "none" }}
      onPointerDown={pointer?.onPointerDown}
    >
      <div
        ref={grid}
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {Array.from({ length: cols * rows }, (_, cell) => {
          if (wall.has(cell)) return <div key={cell} className="rounded-md bg-foreground/75" />;
          const piece = mirrorAt.get(cell);
          if (piece && isSplitter(piece)) return <div key={cell} aria-label={`Splitter ${piece === "S|" ? "vertical" : "horizontal"} input`} className="flex items-center justify-center"><Splitter kind={piece} /></div>;
          if (splitters.includes(cell)) return <div key={cell} aria-label="Splitter" className="flex items-center justify-center"><Splitter /></div>;
          if (gemSet.has(cell)) {
            const directional = directionalGems.find((gem) => gem.cell === cell);
            return (
              <div
                key={cell}
                aria-label={litSet.has(cell) ? "Gem lit" : "Gem"}
                className="flex items-center justify-center"
              >
                <div className="h-full w-full">
                  <DirectionalGem lit={litSet.has(cell)} {...(directional ? { from: directional.from } : {})} />
                </div>
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

      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {metrics ? (
          <>
            {/* The source arrow, from the same stored direction the beam uses. */}
            <polygon
              points={sourceArrowPoints(at(source).x, at(source).y, dir, unit * 0.5)}
              fill={GOLD}
              opacity={0.9}
            />
            {beam?.map((path, index) => path.length > 1 ? (
              <polyline
                key={`beam-${index}`}
                points={path.map((cell) => `${at(cell).x},${at(cell).y}`).join(" ")}
                fill="none"
                stroke={bombFlash ? RED : GOLD}
                strokeWidth={Math.max(1.5, unit * 0.16)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: bombFlash
                    ? "drop-shadow(0 0 3px rgba(255,80,80,0.9))"
                    : "drop-shadow(0 0 3px rgba(245,198,76,0.85))",
                }}
              />
            ) : null)}
            {placed.filter((piece) => !isSplitter(piece.kind)).map((mirror) => {
              const centre = at(mirror.cell);
              const reach = unit * 0.34;
              const forward = mirror.kind === "/";
              return (
                <line
                  key={`m-${mirror.cell}`}
                  x1={centre.x - reach}
                  y1={centre.y + (forward ? reach : -reach)}
                  x2={centre.x + reach}
                  y2={centre.y + (forward ? -reach : reach)}
                  stroke="#FFFFFF"
                  strokeWidth={Math.max(1.5, unit * 0.14)}
                  strokeLinecap="round"
                />
              );
            })}
            {ghostCell !== null ? (
              <rect
                x={at(ghostCell).x - unit * 0.44}
                y={at(ghostCell).y - unit * 0.44}
                width={unit * 0.88}
                height={unit * 0.88}
                rx={unit * 0.12}
                fill="none"
                stroke={GOLD}
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            ) : null}
          </>
        ) : null}
      </svg>
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const gems = [35, 26, 29, 55, 76, 79];
  const solution: MirrorPlacement[] = [{ cell: 45, kind: "S-" }, { cell: 25, kind: "/" }, { cell: 75, kind: "\\" }];
  const trace = traceBeam(40, "R", solution, [], [], gems);
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground">Place the splitter and mirrors to light all six gems.</p>
      <div className="h-[140px] w-[140px]">
        <LaserBoard source={40} dir="R" gems={gems} bombs={[]} blocks={[]}
          placed={solution} beam={trace.paths} litGems={trace.gemsLit} />
      </div>
      <p className="text-xs text-muted-foreground">Tap a placed piece to turn it. Three shots.</p>
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
  const splitters = isLaser ? puzzle.splitters ?? [] : [];
  const directionalGems = isLaser ? puzzle.directionalGems ?? [] : [];
  const total = isLaser ? puzzle.mirrors : 0;
  const splitterTotal = isLaser ? puzzle.splitterPieces ?? 0 : 0;
  const [selected, setSelected] = useState<MirrorKind>("/");

  const [placed, setPlaced] = useStageState<MirrorPlacement[]>(stateKey, "mirrors", () => []);
  const [history, setHistory] = useStageState<number[]>(stateKey, "history", () => []);
  const [fires, setFires] = useStageState<number>(stateKey, "fires", () => 0);
  const [shot, setShot] = useState<{ trace: BeamTrace; step: number; done: boolean } | null>(null);
  const [ghost, setGhost] = useState<number | null>(null);
  const [shake, setShake] = useState(0);
  const submitted = useRef(false);
  const timers = useRef<number[]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Live copies for the window-level drag handlers.
  const placedRef = useRef(placed);
  placedRef.current = placed;
  const ghostRef = useRef<number | null>(null);
  const dragRef = useRef<{ kind: "tray" | "move"; from: number | null; piece?: MirrorKind } | null>(null);
  const busyRef = useRef(false);
  busyRef.current = Boolean(locked || submitted.current || shot);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  useEffect(() => {
    onDraftAnswer?.(encodeLaserAnswer(placed, Math.max(1, fires)));
  }, [placed, fires, onDraftAnswer]);

  const offsets = shot ? beamBranchOffsets(shot.trace.paths) : [];
  const revealed = shot ? shot.trace.paths.map((path, index) =>
    path.slice(0, Math.max(0, shot.step - offsets[index]! + 1))) : null;
  const visibleCells = revealed?.flat() ?? [];
  const litGems = shot ? shot.trace.gemsLit.filter((gem) => visibleCells.includes(gem)) : [];
  const bombFlash = Boolean(shot?.done && shot.trace.hitBomb);
  const solved = submitted.current;
  const firesLeft = Math.max(0, LASER_MAX_FIRES - fires);

  const refuse = useCallback(() => {
    buzz(20);
    playWrong();
    setShake((count) => count + 1);
    window.setTimeout(() => setShake((count) => Math.max(0, count - 1)), 320);
  }, []);

  const taken = useCallback(
    (cell: number) => cell === source || gems.includes(cell) || bombs.includes(cell) || blocks.includes(cell) || (isLaser && puzzle.splitters?.includes(cell)),
    [source, gems, bombs, blocks, isLaser, puzzle],
  );

  const cellAt = useCallback(
    (clientX: number, clientY: number) =>
      gridCellAt(gridRef.current, clientX, clientY, LASER_COLS, LASER_COLS),
    [],
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    const target = ghostRef.current;
    dragRef.current = null;
    ghostRef.current = null;
    setGhost(null);
    if (!drag || busyRef.current) return;
    const current = placedRef.current;

    if (drag.kind === "move" && drag.from !== null) {
      // Dropped off the board — back to the tray.
      if (target === null) {
        hapticTick();
        setPlaced(current.filter((mirror) => mirror.cell !== drag.from));
        setHistory((order) => order.filter((cell) => cell !== drag.from));
        return;
      }
      // Dropped where it started — a tap, so flip it.
      if (target === drag.from) {
        hapticTick();
        setPlaced(
          current.map((mirror) =>
            mirror.cell === drag.from
              ? { cell: mirror.cell, kind: flipMirror(mirror.kind) }
              : mirror,
          ),
        );
        return;
      }
      if (taken(target) || current.some((mirror) => mirror.cell === target)) {
        refuse();
        return;
      }
      const kind = current.find((mirror) => mirror.cell === drag.from)?.kind ?? "/";
      hapticTick();
      setPlaced([...current.filter((mirror) => mirror.cell !== drag.from), { cell: target, kind }]);
      setHistory((order) => order.map((cell) => (cell === drag.from ? target : cell)));
      return;
    }

    // From the tray onto the board.
    if (target === null) return;
    if (taken(target) || current.some((mirror) => mirror.cell === target)) {
      refuse();
      return;
    }
    const kind = drag.piece ?? selected;
    if (current.filter((piece) => isSplitter(piece.kind) === isSplitter(kind)).length >= (isSplitter(kind) ? splitterTotal : total)) {
      refuse();
      return;
    }
    hapticTick();
    setPlaced([...current, { cell: target, kind }]);
    setHistory((order) => [...order.filter((cell) => cell !== target), target]);
  }, [refuse, setHistory, setPlaced, taken, total, splitterTotal, selected]);

  const trackDrag = useCallback(
    (clientX: number, clientY: number) => {
      const cell = cellAt(clientX, clientY);
      ghostRef.current = cell;
      setGhost(cell);
    },
    [cellAt],
  );

  // One set of window listeners for the whole drag, so a finger that leaves the
  // board still reports the cell it is over — and the drop uses that same cell.
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragRef.current) return;
      event.preventDefault();
      trackDrag(event.clientX, event.clientY);
    };
    const up = (event: PointerEvent) => {
      if (!dragRef.current) return;
      trackDrag(event.clientX, event.clientY);
      endDrag();
    };
    const cancel = () => {
      dragRef.current = null;
      ghostRef.current = null;
      setGhost(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [trackDrag, endDrag]);

  const fire = useCallback(() => {
    if (locked || submitted.current || firesLeft === 0 || shot) return;
    const verdict = verifyLaser({ source, dir, gems, bombs, blocks, mirrors: total, splitterPieces: splitterTotal, splitters, directionalGems }, placed);
    const attempt = fires + 1;
    setFires(attempt);
    clearTimers();
    setShot({ trace: verdict.trace, step: 0, done: false });

    const offsets = beamBranchOffsets(verdict.trace.paths);
    const lastStep = Math.max(0, ...verdict.trace.paths.map((path, index) => offsets[index]! + path.length - 1));
    const per = 2 * Math.max(30, Math.round((LASER_BEAM_MS * 1.25) / Math.max(1, lastStep)));
    for (let step = 1; step < lastStep; step++) {
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
          setShot((current) => (current ? { ...current, step: lastStep, done: true } : current));
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
        per * Math.max(1, lastStep),
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
    splitterTotal,
    splitters,
    directionalGems,
    placed,
    fires,
    setFires,
    onSubmit,
  ]);

  const onBoardDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busyRef.current) return;
    event.preventDefault();
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    if (placed.some((mirror) => mirror.cell === cell)) {
      // A press on a placed mirror: a tap flips it, a drag moves it.
      dragRef.current = { kind: "move", from: cell };
      ghostRef.current = cell;
      setGhost(cell);
      return;
    }
    if (taken(cell)) {
      refuse();
      return;
    }
    if (placed.filter((piece) => isSplitter(piece.kind) === isSplitter(selected)).length >= (isSplitter(selected) ? splitterTotal : total)) {
      refuse();
      return;
    }
    hapticTick();
    setPlaced([...placed, { cell, kind: selected }]);
    setHistory((order) => [...order.filter((placedCell) => placedCell !== cell), cell]);
  };

  const undo = () => {
    if (!history.length) return;
    const last = history[history.length - 1]!;
    hapticTick();
    setHistory((current) => current.slice(0, -1));
    setPlaced((current) => current.filter((mirror) => mirror.cell !== last));
  };

  if (!isLaser) return null;

  const mirrorsPlaced = placed.filter((piece) => !isSplitter(piece.kind)).length;
  const splitterPlaced = placed.filter((piece) => isSplitter(piece.kind)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        mirrors <span className="text-primary">{mirrorsPlaced}</span> / {total}
        {splitterTotal > 0 ? <> · splitter <span className="text-opponent">{splitterPlaced}</span> / {splitterTotal}</> : null}
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <LaserBoard
          source={source}
          dir={dir}
          gems={gems}
          bombs={bombs}
          blocks={blocks}
          splitters={splitters}
          directionalGems={directionalGems}
          placed={placed}
          beam={revealed}
          litGems={litGems}
          bombFlash={bombFlash}
          ghostCell={dragRef.current ? ghost : null}
          shake={shake > 0}
          gridRef={gridRef}
          pointer={{ onPointerDown: onBoardDown }}
        />
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2">
        {(["/", ...(splitterTotal > 0 ? ["S-"] : [])] as MirrorKind[]).map((kind) => {
          const left = isSplitter(kind) ? splitterTotal - splitterPlaced : total - mirrorsPlaced;
          return (
            <Button key={kind} variant="outline" aria-label={isSplitter(kind) ? "Select splitter" : "Select mirror"}
              aria-pressed={isSplitter(selected) === isSplitter(kind)} disabled={left <= 0 || busyRef.current}
              onClick={() => setSelected(kind)}
              onPointerDown={(event) => {
                if (left <= 0 || busyRef.current) return;
                event.preventDefault(); setSelected(kind);
                dragRef.current = { kind: "tray", from: null, piece: kind };
                trackDrag(event.clientX, event.clientY);
              }}
              className={`h-11 min-w-11 gap-2 px-2 ${isSplitter(selected) === isSplitter(kind) ? "border-primary" : ""}`}>
              <span className="flex h-7 w-7 items-center justify-center">{isSplitter(kind) ? <Splitter kind={kind} /> : <span className="text-lg">/</span>}</span>
              <span className="font-mono text-xs">{left}</span>
            </Button>
          );
        })}
        <Button
          type="button"
          disabled={locked || solved || !placed.length || Boolean(shot)}
          onClick={() => {
            setPlaced([]);
            setHistory([]);
          }}
          variant="outline"
          className="h-11 rounded-md border border-border px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          disabled={locked || solved || firesLeft === 0 || Boolean(shot)}
          onClick={fire}
          className="h-12 flex-1 rounded-md bg-primary font-mono text-sm uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          Fire
        </Button>
        <Button
          type="button"
          disabled={locked || solved || !history.length || Boolean(shot)}
          onClick={undo}
          variant="outline"
          className="h-12 shrink-0 rounded-md border border-border px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </Button>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Fires
          <br />
          left: {firesLeft}
        </span>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  const isLaser = puzzle.type === "laser";
  if (!isLaser) return null;
  const solution = puzzle.solution ?? [];
  const mine = decodeLaserAnswer(myAnswer ?? "", puzzle.mirrors + (puzzle.splitterPieces ?? 0));
  const solutionTrace = traceBeam(
    puzzle.source,
    puzzle.dir,
    solution,
    puzzle.blocks,
    puzzle.bombs,
    puzzle.gems,
    puzzle.splitters,
    puzzle.directionalGems,
  );
  const myTrace = verifyLaser(puzzle, mine.mirrors, mine.fires).trace;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;
  const ordinal = mine.fires === 1 ? "1st" : mine.fires === 2 ? "2nd" : "3rd";
  const total = puzzle.gems.length;
  const result = myCorrect
    ? `${total} / ${total} gems · ${ordinal} shot${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
    : myTrace.gemsLit.length >= 1
      ? `${myTrace.gemsLit.length} / ${total} gems`
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
              splitters={puzzle.splitters ?? []}
              directionalGems={puzzle.directionalGems ?? []}
              placed={solution}
              beam={solutionTrace.paths}
              litGems={solutionTrace.gemsLit}
            />
          </div>
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
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
              splitters={puzzle.splitters ?? []}
              directionalGems={puzzle.directionalGems ?? []}
              placed={mine.mirrors}
              beam={mine.mirrors.length ? myTrace.paths : null}
              litGems={myTrace.gemsLit}
              bombFlash={myTrace.hitBomb}
            />
          </div>
          <span className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            yours
          </span>
        </div>
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">{result}</p>
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
