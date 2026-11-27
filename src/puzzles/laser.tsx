import { gameDisplayName } from "@/lib/duel/gameNames";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRevealHosted, useRevealViews } from "@/components/duel/revealContext";
import { useRevealBoardWidth } from "@/components/puzzles/pattern/revealBoard";

import {
  gridCellAt,
  gridCellCentre,
  useGridMetrics,
} from "@/components/puzzles/GridDrag";
import {
  decodeLaserAnswer,
  encodeLaserAnswer,
  flipMirror,
  isSplitter,
  laserShotsOf,
  traceBeam,
  verifyLaser,
  type BeamTrace,
} from "@/lib/duel/laser";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { appendAction, decodeActionLog, encodeActionLog, usesActionLog, type LoggedAction } from "@/lib/duel/actionLog";
import { laserAction, replayLaserActions, replayLaserLog } from "@/lib/duel/laserLog";
import { HudPills, type HudPillItem } from "@/components/puzzles/HudPills";
import { serverNow } from "@/lib/duel/clock";
import { usesPatternNov15 } from "@/lib/duel/patternNov15";
import { usesStandard } from "@/lib/duel/standard/stamps";
import { soundCue } from "@/lib/fx/patternFx";
import {
  LASER_BEAM_MS,
  LASER_CELLS,
  LASER_COLS,
  LASER_FADE_MS,
  LASER_TIME_MS,
  type BeamDir,
  type LaserPuzzleData,
  type MirrorPlacement,
  type MirrorKind,
} from "@/lib/duel/types";
import { playCorrect, playSound, playWrong } from "@/lib/sound";

import {
  directionalChevronPoints,
  gemsInBeamOrder,
  LaserBeam,
  LaserBomb,
  LaserEmitter,
  LaserGem,
  LaserGemBursts,
  LaserMirror,
  LaserSplitter,
  laserArtUrl,
  useLaserCues,
} from "@/components/puzzles/pattern/laserArt";
import { useInFrame } from "@/components/puzzles/batchP/LiveSummary";
import {
  LASER_NEAR_MISS_MS,
  laserCellArt,
  laserDarkGem,
  laserNearMissFx,
  laserRefuseFx,
  laserSplitterCells,
  useLaserPieceFx,
} from "@/components/puzzles/pattern/laserFx";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import { useSolveMoment } from "@/lib/fx/patternFx";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

export { directionalChevronPoints };

/**
 * The Gems pill (Joe, 15 Nov 2026: Lightbender's near miss in the Gems pill). Its content is the count ("Gems 5/6") or,
 * for the near miss's 2.2 s, "1 gem dark" in the category accent, in the pill's own place: both are laid in one grid
 * cell and only one is visible, so the pill keeps the width of the wider and the pills row never shifts.
 */
export function laserGemsPill(label: string, count: string, dark: boolean): HudPillItem {
  return {
    id: "gems",
    ...(dark ? { tone: "gold" as const } : {}),
    value: (
      <span className="laser-gems-swap" data-laser-gems={dark ? "dark" : "count"}>
        <span className="laser-gems-count" aria-hidden={dark ? true : undefined}>
          <span className="jz-status-label hud-pill-label">{label}</span> {count}
        </span>
        <span className="laser-gems-dark" aria-hidden={dark ? undefined : true}>1 gem dark</span>
      </span>
    ),
  };
}

/** The Gems pill's count: the best shot so far, or the beam on screen if it lights more. */
export function laserGemsShown(best: number, onScreen: number): number {
  return Math.max(best, onScreen);
}

/**
 * One board change as laserRev 4's Undo (the Pattern overhaul, 15 Nov 2026) takes it back: a piece placed, turned,
 * moved, taken back to the tray, or a Reset. Undo sends the ordinary verbs that put the board back as it was (a
 * removal, a second turn, the reverse move, the piece put back, every piece put back), so the server's replay and its
 * grading are those of any other board change.
 */
export type LaserUndo =
  | { k: "place"; cell: number }
  | { k: "turn"; cell: number }
  | { k: "move"; from: number; to: number }
  | { k: "remove"; cell: number; kind: MirrorKind }
  | { k: "reset"; pieces: MirrorPlacement[] };

/** The log verbs and the board an Undo of `last` gives (pure; the stage's Undo and the check use it). */
export function laserUndoStep(placed: MirrorPlacement[], last: LaserUndo): { actions: string[]; placed: MirrorPlacement[] } {
  if (last.k === "place") return { actions: [laserAction.remove(last.cell)], placed: placed.filter((p) => p.cell !== last.cell) };
  if (last.k === "turn") {
    return {
      actions: [laserAction.turn(last.cell)],
      placed: placed.map((p) => (p.cell === last.cell ? { cell: p.cell, kind: flipMirror(p.kind) } : p)),
    };
  }
  if (last.k === "move") {
    const piece = placed.find((p) => p.cell === last.to);
    if (!piece) return { actions: [], placed };
    return { actions: [laserAction.move(last.to, last.from)], placed: [...placed.filter((p) => p.cell !== last.to), { cell: last.from, kind: piece.kind }] };
  }
  if (last.k === "remove") return { actions: [laserAction.place(last.cell, last.kind)], placed: [...placed, { cell: last.cell, kind: last.kind }] };
  return { actions: last.pieces.map((p) => laserAction.place(p.cell, p.kind)), placed: last.pieces.map((p) => ({ ...p })) };
}

/** laserRev 4 (the Pattern overhaul): Undo takes back any change, and the board locks once every shot is used. */
export function laserOverhaul(puzzle: unknown): boolean {
  return usesPatternNov15(puzzle, "laser");
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
export function LaserBoard({
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
  live = false,
  solved = false,
  outOfShots = false,
  marks = null,
  beamDrawing = false,
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
  /** The playable stage board (animations and cues); intro and reveal boards are still. */
  live?: boolean;
  /** The stage has submitted a solve (starts the completion effect). */
  solved?: boolean;
  /** laserRev 4: every shot used without a solve; the board is locked and says so. */
  outOfShots?: boolean;
  /** The reveal's highlights on the player's board (presentation only). */
  marks?: LaserMarks | null;
  /** The live beam is still travelling (its leading point drawn; stage 2 effects). */
  beamDrawing?: boolean;
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
  // Presentation only: the completion flare and cues read what is already drawn.
  const solveFx = useSolveMoment(live && solved, "laser.solve");
  const firing = Boolean(beam);
  useLaserCues({ live, placed, firing, litCount: litGems.length, bombHit: bombFlash });
  // Stage 2 effects (laserFx.ts): the pieces' own art moves; nothing here touches the board's state.
  const boardRef = useRef<HTMLDivElement | null>(null);
  useLaserPieceFx({
    live,
    board: boardRef,
    placed,
    firing,
    litGems,
    reached: beam ? [...new Set(beam.flat())].join(",") : "",
    splitterCells: laserSplitterCells(splitters, placed).join(","),
    bombHit: bombFlash,
  });
  const burstOrder = solveFx && beam ? gemsInBeamOrder(beam, beamBranchOffsets(beam), litGems) : [];

  return (
    <div
      ref={boardRef}
      className={`laser-board relative mx-auto aspect-square h-full max-h-full w-full max-w-full select-none ${
        shake ? "animate-shake" : ""
      } ${solveFx ? "laser-board-solved" : ""} ${outOfShots ? "laser-board-spent" : ""}`}
      style={{ touchAction: "none" }}
      data-laser-art=""
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
          if (wall.has(cell)) return <div key={cell} aria-label="Wall" className="laser-block rounded-md bg-foreground/60" />;
          const piece = mirrorAt.get(cell);
          if (piece && isSplitter(piece)) return <div key={cell} data-laser-cell={cell} aria-label={`Splitter ${piece === "S|" ? "vertical" : "horizontal"} input`} className="laser-piece-cell flex items-center justify-center"><LaserSplitter kind={piece} /></div>;
          if (splitters.includes(cell)) return <div key={cell} data-laser-cell={cell} aria-label="Splitter" className="laser-piece-cell flex items-center justify-center"><LaserSplitter /></div>;
          if (gemSet.has(cell)) {
            const directional = directionalGems.find((gem) => gem.cell === cell);
            return (
              <div
                key={cell}
                data-laser-cell={cell}
                aria-label={litSet.has(cell) ? "Gem lit" : "Gem"}
                className="laser-piece-cell flex items-center justify-center"
              >
                <div className="h-full w-full">
                  <LaserGem lit={litSet.has(cell)} from={directional?.from} />
                </div>
              </div>
            );
          }
          if (bombSet.has(cell)) {
            return (
              <div key={cell} data-laser-cell={cell} aria-label="Bomb" className="laser-piece-cell flex items-center justify-center">
                <LaserBomb flash={bombFlash} />
              </div>
            );
          }
          if (cell === source) {
            return <div key={cell} aria-label="Laser" className="laser-source-cell rounded-md bg-primary/25"><LaserEmitter dir={dir} firing={live && firing} /></div>;
          }
          return (
            <div
              key={cell}
              data-laser-cell={cell}
              className={`laser-cell rounded-[3px] border bg-card ${
                mirrorAt.has(cell) ? "border-primary/50" : "border-border/50"
              }`}
            />
          );
        })}
      </div>

      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {metrics ? (
          <>
            {beam ? (
              <LaserBeam
                branches={beam.map((path) => path.map(at))}
                unit={unit}
                danger={bombFlash}
                solved={solveFx}
                drawing={live && beamDrawing}
              />
            ) : null}
            {placed.filter((piece) => !isSplitter(piece.kind)).map((mirror) => {
              const centre = at(mirror.cell);
              return (
                <LaserMirror
                  key={`m-${mirror.cell}-${mirror.kind}`}
                  x={centre.x}
                  y={centre.y}
                  unit={unit}
                  kind={mirror.kind}
                  cell={mirror.cell}
                />
              );
            })}
            {burstOrder.length ? <LaserGemBursts centres={burstOrder.map(at)} unit={unit} /> : null}
            {marks ? <LaserRevealMarks marks={marks} at={at} unit={unit} /> : null}
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
      {outOfShots ? (
        <div className="laser-spent pointer-events-none absolute inset-0 flex items-center justify-center" data-laser-spent="" role="status">
          <span className="laser-spent-badge">Out of shots</span>
        </div>
      ) : null}
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

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "laser", phaseStartedAt }: PuzzleStageProps) {
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
  // The round's shots: 3, or a level's own (laser.levels.ts: Easy 5, Expert 2).
  const shotsGiven = laserShotsOf(isLaser ? puzzle : null);
  const [selected, setSelected] = useState<MirrorKind>("/");

  const [placed, setPlaced] = useStageState<MirrorPlacement[]>(stateKey, "mirrors", () => []);
  const [history, setHistory] = useStageState<number[]>(stateKey, "history", () => []);
  const [fires, setFires] = useStageState<number>(stateKey, "fires", () => 0);
  // laserRev 4 (the Pattern overhaul): every board change, newest last, for Undo.
  const overhaul = laserOverhaul(puzzle);
  const [undoStack, setUndoStack] = useStageState<LaserUndo[]>(stateKey, "undo", () => []);
  const pushUndo = useCallback(
    (entry: LaserUndo) => {
      if (overhaul) setUndoStack((stack) => [...stack, entry]);
    },
    [overhaul, setUndoStack],
  );
  // Stamped rounds (alogRev 1) answer with every change and FIRE on the round clock (laserLog.ts).
  const logged = usesActionLog(puzzle);
  const [log, setLog] = useStageState<LoggedAction[]>(stateKey, "alog", () => []);
  const record = useCallback(
    (action: string) => {
      if (logged) setLog((current) => appendAction(current, action, serverNow() - phaseStartedAt));
    },
    [logged, setLog, phaseStartedAt],
  );
  const [shot, setShot] = useState<{ trace: BeamTrace; step: number; done: boolean } | null>(null);
  const [ghost, setGhost] = useState<number | null>(null);
  // The near miss (Joe, 15 Nov 2026): the gem a shot left dark and the moment, shown as "1 gem dark" for a moment.
  const [nearMiss, setNearMiss] = useState<{ gem: number; at: number } | null>(null);
  const submitted = useRef(false);
  const timers = useRef<number[]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Live copies for the window-level drag handlers.
  const placedRef = useRef(placed);
  placedRef.current = placed;
  const ghostRef = useRef<number | null>(null);
  const dragRef = useRef<{ kind: "tray" | "move"; from: number | null; piece?: MirrorKind } | null>(null);
  const busyRef = useRef(false);
  // laserRev 4: once the last shot has faded without a solve the board locks (nothing left to fire it with).
  const outOfShots = overhaul && fires >= shotsGiven && !submitted.current && !shot;
  busyRef.current = Boolean(locked || submitted.current || shot || outOfShots);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  useEffect(() => {
    onDraftAnswer?.(logged ? encodeActionLog(log) : encodeLaserAnswer(placed, Math.max(1, fires)));
  }, [logged, log, placed, fires, onDraftAnswer]);

  const offsets = shot ? beamBranchOffsets(shot.trace.paths) : [];
  const revealed = shot ? shot.trace.paths.map((path, index) =>
    path.slice(0, Math.max(0, shot.step - (offsets[index] ?? 0) + 1))) : null;
  const visibleCells = revealed?.flat() ?? [];
  const litGems = shot ? shot.trace.gemsLit.filter((gem) => visibleCells.includes(gem)) : [];
  // Pattern review fixes (15 Nov 2026, display only): the Gems pill keeps the best shot's count, so it no longer
  // falls back to 0 when a beam fades (the board still lights only the shot on screen).
  const [bestLit, setBestLit] = useStageState<number>(stateKey, "bestLit", () => 0);
  useEffect(() => {
    if (litGems.length > bestLit) setBestLit(litGems.length);
  }, [litGems.length, bestLit, setBestLit]);
  const gemsShown = laserGemsShown(bestLit, litGems.length);
  const bombFlash = Boolean(shot?.done && shot.trace.hitBomb);
  const solved = submitted.current;
  const firesLeft = Math.max(0, shotsGiven - fires);
  const inFrame = useInFrame();
  // The near miss's moment: two soft pulses on the dark gem (a piece, so allowed over the board) and on the pill.
  useEffect(() => {
    if (!nearMiss) return;
    const pill = typeof document === "undefined" ? null : document.querySelector('[data-hud-pills="laser"] [data-hud-pill="gems"]');
    laserNearMissFx(laserCellArt(gridRef.current?.parentElement, nearMiss.gem), pill);
  }, [nearMiss]);

  // A refused drop: the quiet wrong and the kit's shake on that square's own art (never the board, which takes the
  // presses).
  const refuse = useCallback((cell: number | null) => {
    playWrong();
    if (cell !== null) laserRefuseFx(laserCellArt(gridRef.current?.parentElement, cell));
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
        record(laserAction.remove(drag.from));
        const removed = current.find((mirror) => mirror.cell === drag.from);
        if (removed) pushUndo({ k: "remove", cell: removed.cell, kind: removed.kind });
        setPlaced(current.filter((mirror) => mirror.cell !== drag.from));
        setHistory((order) => order.filter((cell) => cell !== drag.from));
        return;
      }
      // Dropped where it started — a tap, so flip it.
      if (target === drag.from) {
        record(laserAction.turn(drag.from));
        pushUndo({ k: "turn", cell: drag.from });
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
        refuse(target);
        return;
      }
      const kind = current.find((mirror) => mirror.cell === drag.from)?.kind ?? "/";
      record(laserAction.move(drag.from, target));
      pushUndo({ k: "move", from: drag.from, to: target });
      setPlaced([...current.filter((mirror) => mirror.cell !== drag.from), { cell: target, kind }]);
      setHistory((order) => order.map((cell) => (cell === drag.from ? target : cell)));
      return;
    }

    // From the tray onto the board.
    if (target === null) return;
    if (taken(target) || current.some((mirror) => mirror.cell === target)) {
      refuse(target);
      return;
    }
    const kind = drag.piece ?? selected;
    if (current.filter((piece) => isSplitter(piece.kind) === isSplitter(kind)).length >= (isSplitter(kind) ? splitterTotal : total)) {
      refuse(target);
      return;
    }
    record(laserAction.place(target, kind));
    pushUndo({ k: "place", cell: target });
    setPlaced([...current, { cell: target, kind }]);
    setHistory((order) => [...order.filter((cell) => cell !== target), target]);
  }, [refuse, record, pushUndo, setHistory, setPlaced, taken, total, splitterTotal, selected]);

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
    const firedLog = logged ? appendAction(log, laserAction.fire(), serverNow() - phaseStartedAt) : log;
    if (logged) setLog(firedLog);
    clearTimers();
    setNearMiss(null);
    setShot({ trace: verdict.trace, step: 0, done: false });

    const offsets = beamBranchOffsets(verdict.trace.paths);
    const lastStep = Math.max(0, ...verdict.trace.paths.map((path, index) => (offsets[index] ?? 0) + path.length - 1));
    const per = 2 * Math.max(30, Math.round((LASER_BEAM_MS * 1.25) / Math.max(1, lastStep)));
    // Sound only: each gem (rising pitch) and each splitter once, at the step the beam reaches it.
    const GEM_RATES = [1, 1.06, 1.12, 1.19, 1.26, 1.33];
    const splitterCells = new Set([...splitters, ...placed.filter((piece) => isSplitter(piece.kind)).map((piece) => piece.cell)]);
    const reached = new Map<number, number>();
    verdict.trace.paths.forEach((path, index) => path.forEach((cell, i) => {
      const at = (offsets[index] ?? 0) + i;
      if (!reached.has(cell) || at < reached.get(cell)!) reached.set(cell, at);
    }));
    const cues: { at: number; play: () => void }[] = [];
    [...verdict.trace.gemsLit].sort((a, b) => (reached.get(a) ?? 0) - (reached.get(b) ?? 0)).forEach((gem, n) => {
      const rate = GEM_RATES[Math.min(n, GEM_RATES.length - 1)];
      cues.push({ at: reached.get(gem) ?? 0, play: () => playSound("pz_laser_gem", 1, rate, true) });
    });
    for (const cell of splitterCells) if (reached.has(cell)) cues.push({ at: reached.get(cell)!, play: () => playSound("pz_laser_split", 1, 1, true) });
    for (const cue of cues) timers.current.push(window.setTimeout(cue.play, per * cue.at));
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
            onSubmit(logged ? encodeActionLog(firedLog) : encodeLaserAnswer(placed, attempt));
            return;
          }
          // One sound for a miss: the bomb's own blast (laser.bomb, from the board's cues), the near miss's "1 gem
          // dark", or the plain wrong; then, after the last shot on laserRev 4, "out of shots" as the beam fades.
          if (verdict.trace.hitBomb) {
            /* laser.bomb plays from the board */
          } else if (verdict.gemsLit === gems.length - 1 && gems.length > 1) {
            soundCue("laser.nearMiss");
            const dark = laserDarkGem(gems, verdict.trace.gemsLit, verdict.trace.hitBomb);
            if (dark !== null) {
              setNearMiss({ gem: dark, at: Date.now() });
              timers.current.push(window.setTimeout(() => setNearMiss(null), LASER_NEAR_MISS_MS));
            }
          } else playWrong();
          timers.current.push(
            window.setTimeout(() => {
              setShot(null);
              if (overhaul && attempt >= shotsGiven) soundCue("laser.outOfShots");
            }, LASER_FADE_MS),
          );
        },
        per * Math.max(1, lastStep),
      ),
    );
  }, [
    locked,
    firesLeft,
    shotsGiven,
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
    logged,
    log,
    setLog,
    phaseStartedAt,
    overhaul,
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
      refuse(cell);
      return;
    }
    if (placed.filter((piece) => isSplitter(piece.kind) === isSplitter(selected)).length >= (isSplitter(selected) ? splitterTotal : total)) {
      refuse(cell);
      return;
    }
    record(laserAction.place(cell, selected));
    pushUndo({ k: "place", cell });
    setPlaced([...placed, { cell, kind: selected }]);
    setHistory((order) => [...order.filter((placedCell) => placedCell !== cell), cell]);
  };

  const undo = () => {
    if (overhaul) {
      // laserRev 4: take back the last change of any kind, with the verbs that put the board back.
      const last = undoStack.at(-1);
      if (!last) return;
      const step = laserUndoStep(placed, last);
      for (const action of step.actions) record(action);
      setUndoStack((stack) => stack.slice(0, -1));
      setPlaced(step.placed);
      setHistory(step.placed.map((piece) => piece.cell));
      return;
    }
    if (!history.length) return;
    const last = history.at(-1);
    if (last === undefined) return;
    record(laserAction.remove(last));
    setHistory((current) => current.slice(0, -1));
    setPlaced((current) => current.filter((mirror) => mirror.cell !== last));
  };

  const reset = () => {
    if (placed.length) pushUndo({ k: "reset", pieces: placed.map((piece) => ({ ...piece })) });
    record(laserAction.reset());
    setPlaced([]);
    setHistory([]);
  };

  const canUndo = overhaul ? undoStack.length > 0 : history.length > 0;

  // Desktop keys: Enter or Space = Fire, Z or Backspace = Undo, R = Reset, M = mirror, S = splitter.
  useGameKeys((kind, key, event) => {
    if (!isLaser) return false;
    const piece: MirrorKind | null = key === "m" ? "/" : key === "s" && splitterTotal > 0 ? "S-" : null;
    const used = piece !== null || key === "Enter" || key === " " || key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (piece !== null) {
      const left = isSplitter(piece)
        ? splitterTotal - placed.filter((p) => isSplitter(p.kind)).length
        : total - placed.filter((p) => !isSplitter(p.kind)).length;
      if (!(left <= 0 || busyRef.current)) setSelected(piece);
    } else if (key === "Enter" || key === " ") {
      if (!(locked || solved || firesLeft === 0 || Boolean(shot))) fire();
    } else if (key === "r") {
      if (!(locked || solved || !placed.length || Boolean(shot) || outOfShots)) reset();
    } else if (!(locked || solved || !canUndo || Boolean(shot) || outOfShots)) undo();
    return true;
  });

  if (!isLaser) return null;

  const mirrorsPlaced = placed.filter((piece) => !isSplitter(piece.kind)).length;
  const elegantPar = puzzle.type === "laser" && (puzzle.laserRev ?? 0) >= 1 ? (puzzle.par ?? 0) : 0;
  const splitterPlaced = placed.filter((piece) => isSplitter(piece.kind)).length;

  return (
    <div data-stage-column="2" data-polish="laser" className="flex min-h-0 flex-1 flex-col gap-2">
      {inFrame ? null : (
        <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          mirrors <span className="text-primary">{mirrorsPlaced}</span> / {total}
          {splitterTotal > 0 ? <> · splitter <span className="text-opponent">{splitterPlaced}</span> / {splitterTotal}</> : null}
        </p>
      )}

      <div data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
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
          beamDrawing={Boolean(shot && !shot.done)}
          gridRef={gridRef}
          pointer={{ onPointerDown: onBoardDown }}
          live
          solved={solved}
          outOfShots={outOfShots}
        />
      </div>

      <FramePills
        testId="laser"
        items={elegantPar > 0
          ? [
              // laserRev 1 (depth batch 4): the elegant beam's par mirrors.
              ...parPills("Mirrors", mirrorsPlaced, elegantPar, "mirrors"),
              splitterTotal > 0 ? { id: "splitter", label: "Splitter", value: `${splitterPlaced}/${splitterTotal}` } : null,
              laserGemsPill("Gems", `${gemsShown}/${gems.length}`, Boolean(nearMiss)),
            ]
          : [
              { id: "mirrors", label: "Mirrors", value: `${mirrorsPlaced} / ${total}` },
              splitterTotal > 0 ? { id: "splitter", label: "Splitter", value: `${splitterPlaced} / ${splitterTotal}` } : null,
              laserGemsPill("Gems lit", `${gemsShown} / ${gems.length}`, Boolean(nearMiss)),
            ]}
      />
      <div data-game-controls="pieces" className="flex shrink-0 items-center justify-center gap-2">
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
              <span className="flex h-7 w-7 items-center justify-center [&_svg]:size-6">{isSplitter(kind) ? <LaserSplitter kind={kind} /> : <img src={laserArtUrl("mirror-slash")} alt="" draggable={false} className="laser-tray-mirror pointer-events-none h-7 w-7" />}</span>
              <span className="font-mono text-xs">{left}</span>
            </Button>
          );
        })}
        <Button
          type="button"
          disabled={locked || solved || !placed.length || Boolean(shot) || outOfShots}
          onClick={reset}
          variant="outline"
          className="h-11 rounded-md border border-border px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </Button>
      </div>

      <div data-game-controls="actions" className="flex shrink-0 items-center gap-2">
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
          disabled={locked || solved || !canUndo || Boolean(shot) || outOfShots}
          onClick={undo}
          variant="outline"
          className="h-12 shrink-0 rounded-md border border-border px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </Button>
        {/* The Pattern overhaul (15 Nov 2026): the shots left as a big number, gold at none. */}
        <span
          className="laser-shots-left flex shrink-0 flex-col items-center text-[11px] font-semibold uppercase leading-tight tracking-wider"
          data-laser-shots-left={firesLeft}
          data-none={firesLeft === 0 ? "" : undefined}
        >
          Shots left
          <span className="text-xl font-extrabold leading-none tabular-nums">{firesLeft}</span>
        </span>
      </div>
    </div>
  );
}

/** The reveal's highlights on the player's board: their pieces off the solution, the solution's pieces they lack, gems left dark. */
export interface LaserMarks {
  wrong: number[];
  missing: MirrorPlacement[];
  unlit: number[];
}

/** What the reveal's Yours board shows and the numbers that explain the score (the Pattern overhaul, 15 Nov 2026). */
export interface LaserRevealView {
  /** The layout drawn on Yours: the solving shot, else the best shot (or the board at the buzzer when it counted more). */
  layout: MirrorPlacement[];
  trace: BeamTrace;
  /** Which shot that layout was fired on (1–3), or null for a board never fired. */
  shot: number | null;
  solved: boolean;
  /** Gems the score counts: all on a solve, else the best shot without a bomb (as the grader). */
  gems: number;
  shotsUsed: number;
  /** Each shot: gems lit, bomb. */
  shots: { gems: number; bomb: boolean }[];
  /** On a solve: the mirrors used and the par. */
  mirrors: number | null;
  par: number;
  marks: LaserMarks | null;
}

function numberOf(extra: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = extra?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pure: the player's pieces against the stored solution, and the gems the drawn shot left dark (never on a solve). */
export function laserRevealMarks(solution: MirrorPlacement[], layout: MirrorPlacement[], gems: number[], lit: number[], solved: boolean): LaserMarks | null {
  if (solved) return null;
  const want = new Map(solution.map((m) => [m.cell, m.kind]));
  const have = new Map(layout.map((m) => [m.cell, m.kind]));
  return {
    wrong: layout.filter((m) => want.get(m.cell) !== m.kind).map((m) => m.cell),
    missing: solution.filter((m) => have.get(m.cell) !== m.kind),
    unlit: gems.filter((g) => !lit.includes(g)),
  };
}

/**
 * The reveal's view of the player's round. Action-log rounds replay the log on the stored board: a solve shows the
 * solving shot; otherwise the best shot without a bomb (its layout is the board as it stood at that FIRE), or the
 * board at the buzzer when it lit more and a shot was left (the grader counts that layout then). Older "fires|layout"
 * answers show their one layout. The numbers come from the stored grade (`myExtra`) where it has them.
 */
export function laserRevealView(
  puzzle: LaserPuzzleData,
  answer: string,
  correct: boolean,
  timeLimitMs: number,
  extra?: Record<string, unknown> | null,
): LaserRevealView {
  const trace = (layout: MirrorPlacement[], shot: number) => verifyLaser(puzzle, layout, shot).trace;
  const par = numberOf(extra, "par") ?? puzzle.par ?? 0;
  const mirrorCount = (layout: MirrorPlacement[]) => layout.filter((m) => !isSplitter(m.kind)).length;
  const finish = (layout: MirrorPlacement[], shot: number | null, gems: number, shotsUsed: number, shots: { gems: number; bomb: boolean }[]): LaserRevealView => {
    const t = trace(layout, shot ?? 1);
    return {
      layout,
      trace: t,
      shot,
      solved: correct,
      gems,
      shotsUsed,
      shots,
      mirrors: correct ? (numberOf(extra, "solveMirrors") ?? mirrorCount(layout)) : null,
      par,
      marks: laserRevealMarks(puzzle.solution ?? [], layout, puzzle.gems, t.gemsLit, correct),
    };
  };
  if (!usesActionLog(puzzle)) {
    const mine = decodeLaserAnswer(answer, puzzle.mirrors + (puzzle.splitterPieces ?? 0));
    const lit = verifyLaser(puzzle, mine.mirrors, mine.fires).gemsLit;
    const used = numberOf(extra, "fires") ?? mine.fires;
    return finish(mine.mirrors, mine.fires, correct ? puzzle.gems.length : (numberOf(extra, "gemsLit") ?? lit), used, []);
  }
  const replay = replayLaserLog(puzzle, answer, timeLimitMs);
  const storedShots = Array.isArray(extra?.["shots"])
    ? (extra!["shots"] as { gems?: unknown; bomb?: unknown }[]).filter((s) => typeof s.gems === "number").map((s) => ({ gems: s.gems as number, bomb: s.bomb === true }))
    : replay.shotLog.map((s) => ({ gems: s.gemsLit, bomb: s.hitBomb }));
  const used = storedShots.length;
  // The board as it stood at FIRE number k (1-based).
  const layoutAtShot = (k: number): MirrorPlacement[] => {
    const { actions, diag } = decodeActionLog(answer, timeLimitMs);
    let fires = 0;
    const prefix: LoggedAction[] = [];
    for (const a of actions) {
      prefix.push(a);
      if (a.a === "f" && ++fires === k) break;
    }
    return replayLaserActions(puzzle, prefix, diag).layout;
  };
  if (correct && replay.solvedShot !== null) return finish(replay.layout, replay.solvedShot, puzzle.gems.length, used, storedShots);
  // Before the scoring standard the unfinished credit counted the board at the buzzer (grade.ts's gemsLit).
  if (!usesStandard(puzzle)) return finish(replay.layout, null, numberOf(extra, "gemsLit") ?? replay.gemsLit, used, storedShots);
  let best = -1;
  storedShots.forEach((s, i) => {
    if (!s.bomb && (best < 0 || s.gems > storedShots[best]!.gems)) best = i;
  });
  const bestGems = best >= 0 ? storedShots[best]!.gems : 0;
  const finalGems = numberOf(extra, "gemsLit") ?? replay.gemsLit;
  const finalHitBomb = extra?.["hitBomb"] === true || replay.hitBomb;
  // The grader also counts the layout at the buzzer when a shot was left (laserBestGems).
  if (used < laserShotsOf(puzzle) && !finalHitBomb && finalGems > bestGems) return finish(replay.layout, null, finalGems, used, storedShots);
  if (best >= 0) return finish(layoutAtShot(best + 1), best + 1, bestGems, used, storedShots);
  // Every shot hit a bomb, or none was fired: the last shot's board (else the board at the buzzer).
  return finish(used ? layoutAtShot(used) : replay.layout, used || null, 0, used, storedShots);
}

/** Draws the reveal's highlights over the board (inside each cell's own box). */
function LaserRevealMarks({ marks, at, unit }: { marks: LaserMarks; at: (cell: number) => { x: number; y: number }; unit: number }) {
  const half = unit * 0.46;
  return (
    <g className="laser-reveal-marks" aria-hidden="true">
      {marks.missing.map((m) => {
        const c = at(m.cell);
        return (
          <g key={`m${m.cell}`} data-mark="missing" data-cell={m.cell}>
            {isSplitter(m.kind) ? null : (
              <image href={laserArtUrl(m.kind === "/" ? "mirror-slash" : "mirror-back")} x={c.x - unit / 2} y={c.y - unit / 2} width={unit} height={unit} opacity={0.4} pointerEvents="none" />
            )}
            <rect x={c.x - half} y={c.y - half} width={half * 2} height={half * 2} rx={unit * 0.1} fill="none" stroke="var(--jz-gold)" strokeWidth={Math.max(1.5, unit * 0.06)} strokeDasharray={`${unit * 0.14} ${unit * 0.1}`} />
          </g>
        );
      })}
      {marks.wrong.map((cell) => {
        const c = at(cell);
        return <rect key={`w${cell}`} data-mark="wrong" data-cell={cell} x={c.x - half} y={c.y - half} width={half * 2} height={half * 2} rx={unit * 0.1} fill="rgba(255, 77, 77, 0.14)" stroke="#ff5a5a" strokeWidth={Math.max(2, unit * 0.08)} />;
      })}
      {marks.unlit.map((cell) => {
        const c = at(cell);
        return <circle key={`u${cell}`} data-mark="unlit" data-cell={cell} cx={c.x} cy={c.y} r={unit * 0.47} fill="none" stroke="#ff5a5a" strokeWidth={Math.max(1.5, unit * 0.07)} strokeDasharray={`${unit * 0.12} ${unit * 0.09}`} />;
      })}
    </g>
  );
}

const ORDINAL = ["1st", "2nd", "3rd"];

/** One shot as a chip: its gems as dots (lit gold, dark grey), a bomb marked. */
function ShotChip({ index, gems, bomb, total, best }: { index: number; gems: number; bomb: boolean; total: number; best: boolean }) {
  return (
    <span className="laser-shot-chip" data-shot={index + 1} data-best={best ? "" : undefined} data-bomb={bomb ? "" : undefined}>
      <span className="laser-shot-chip-label">{ORDINAL[index] ?? `${index + 1}th`}</span>
      {bomb ? (
        <img src={laserArtUrl("bomb-hit")} alt="Bomb" className="laser-shot-chip-bomb" draggable={false} />
      ) : (
        <span className="laser-shot-chip-gems" aria-label={`${gems} of ${total} gems`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="laser-shot-dot" data-lit={i < gems ? "" : undefined} />
          ))}
        </span>
      )}
    </span>
  );
}

/** The reveal's two views on the template's control (the polish plan's G4). */
const LASER_REVEAL_VIEWS = [
  { id: "solution", label: "Solution" },
  { id: "yours", label: "Yours" },
] as const;

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, myExtra, onWin }: PuzzleRevealProps) {
  // The solve's payoff: the reveal's win moment, once (the template plays the effects kit's win; the polish plan's G4,
  // 27 Nov 2026: a callback, so the board never reaches outside its own reveal).
  const winRef = useRef<HTMLDivElement>(null);
  const won = Boolean(myCorrect && puzzle.type === "laser");
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;
  useEffect(() => {
    if (won) onWinRef.current?.();
  }, [won]);
  // Solution and Yours on the template's views control (G4), one board at a time, each at the stage's size.
  const shown = useRevealViews(LASER_REVEAL_VIEWS);
  // Outside the template (a replay, a bare render) there is no control: both boards are drawn, as before G4.
  const hosted = useRevealHosted();
  const colRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fitWidth = useRevealBoardWidth(colRef, boardRef);
  const fitStyle = fitWidth ? { width: fitWidth } : undefined;
  if (puzzle.type !== "laser") return null;
  const solution = puzzle.solution ?? [];
  const solutionTrace = traceBeam(puzzle.source, puzzle.dir, solution, puzzle.blocks, puzzle.bombs, puzzle.gems, puzzle.splitters, puzzle.directionalGems);
  const view = laserRevealView(puzzle, myAnswer ?? "", myCorrect, timeLimitMs, myExtra);
  const total = puzzle.gems.length;
  const timeLeft = myCorrect && myMsRemaining !== undefined ? Math.round(myMsRemaining / 1000) : null;
  const solutionMirrors = solution.filter((m) => !isSplitter(m.kind)).length;
  const board = (layout: MirrorPlacement[], trace: BeamTrace, marks: LaserMarks | null) => (
    <LaserBoard
      source={puzzle.source}
      dir={puzzle.dir}
      gems={puzzle.gems}
      bombs={puzzle.bombs}
      blocks={puzzle.blocks}
      splitters={puzzle.splitters ?? []}
      directionalGems={puzzle.directionalGems ?? []}
      placed={layout}
      beam={trace.paths.some((path) => path.length > 1) ? trace.paths : null}
      litGems={trace.gemsLit}
      bombFlash={trace.hitBomb}
      marks={marks}
    />
  );
  // The player's line: the shot drawn and what it lit ("You: …", shown only under Yours).
  const result = view.solved
    ? `You: ${total} of ${total} gems · ${ORDINAL[(view.shot ?? 1) - 1] ?? ""} shot`
    : view.shot === null
      ? view.gems > 0
        ? `You: ${view.gems} of ${total} gems at the buzzer`
        : "You: Missed, no shot fired"
      : view.trace.hitBomb
        ? `You: Missed, ${ORDINAL[view.shot - 1]} shot hit a bomb`
        : view.gems > 0
          ? `You: best shot ${ORDINAL[view.shot - 1]}, ${view.gems} of ${total} gems`
          : `You: Missed, no gems lit`;

  return (
    <div ref={winRef} className="laser-reveal flex w-full min-h-0 flex-col items-center gap-2" data-laser-reveal="">
      <div className="laser-reveal-boards flex min-h-0 w-full flex-1 items-start justify-center gap-3">
        <div ref={shown === "solution" ? colRef : undefined} hidden={hosted && shown !== "solution"} className="laser-reveal-col flex min-w-0 flex-1 flex-col items-center gap-1" data-laser-solution="">
          <div ref={shown === "solution" ? boardRef : undefined} className="laser-reveal-board aspect-square" style={fitStyle}>{board(solution, solutionTrace, null)}</div>
          <span className={`laser-reveal-label${hosted ? " sr-only" : ""}`}>Solution</span>
          <span className="laser-reveal-caption">
            Lights all {total} gems with {solutionMirrors} mirror{solutionMirrors === 1 ? "" : "s"}
          </span>
        </div>
        <div ref={shown === "yours" ? colRef : undefined} hidden={hosted && shown !== "yours"} className="laser-reveal-col flex min-w-0 flex-1 flex-col items-center gap-1" data-laser-yours="">
          <div ref={shown === "yours" ? boardRef : undefined} className="laser-reveal-board aspect-square" style={fitStyle}>{board(view.layout, view.trace, view.marks)}</div>
          <span className={`laser-reveal-label${hosted ? " sr-only" : ""}`}>Yours</span>
          <span className="laser-reveal-caption" data-laser-result="">{result}</span>
          {/* The numbers that explain the score, from the stored grade (the player's own, so under Yours). */}
          <HudPills
            testId="laser-reveal"
            className="laser-reveal-pills"
            items={[
              { id: "gems", label: "Gems", value: `${view.gems}/${total}`, tone: view.solved ? "good" : undefined },
              { id: "shots", label: "Shots", value: `${view.shotsUsed}/${laserShotsOf(puzzle)}` },
              view.mirrors !== null ? { id: "mirrors", label: "Mirrors", value: view.mirrors, tone: view.par > 0 && view.mirrors > view.par ? "warn" : undefined } : null,
              view.par > 0 ? { id: "par", label: "Par", value: view.par, tone: "gold" } : null,
              timeLeft !== null ? { id: "time", label: "Time left", value: `${timeLeft} s` } : null,
            ]}
          />
          {view.shots.length ? (
            <span className="laser-shot-strip" aria-label="Your shots">
              {view.shots.map((s, i) => (
                <ShotChip key={i} index={i} gems={s.gems} bomb={s.bomb} total={total} best={view.shot === i + 1} />
              ))}
            </span>
          ) : null}
          {view.marks && (view.marks.wrong.length || view.marks.missing.length || view.marks.unlit.length) ? (
            <span className="laser-reveal-key" data-laser-key="">
              {view.marks.wrong.length ? <span data-key="wrong">Red square: not in the solution</span> : null}
              {view.marks.missing.length ? <span data-key="missing">Gold dashes: the solution’s mirror</span> : null}
              {view.marks.unlit.length ? <span data-key="unlit">Red ring: gem left dark</span> : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Layouts and the mirror placement are built server-side and stay there. */
export const laserPuzzle: PuzzleDefinition = {
  key: "laser",
  name: gameDisplayName("laser"),
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
