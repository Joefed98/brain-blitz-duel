import { gameDisplayName } from "@/lib/duel/gameNames";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";

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
  traceBeam,
  verifyLaser,
  type BeamTrace,
} from "@/lib/duel/laser";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { appendAction, encodeActionLog, usesActionLog, type LoggedAction } from "@/lib/duel/actionLog";
import { laserAction, replayLaserLog } from "@/lib/duel/laserLog";
import { serverNow } from "@/lib/duel/clock";
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
  useLaserCues,
} from "@/components/puzzles/pattern/laserArt";
import { parItems } from "@/components/puzzles/depth4/ParMeter";
import { LiveSummary, SummaryItem, useInFrame } from "@/components/puzzles/batchP/LiveSummary";
import { useSolveMoment } from "@/lib/fx/patternFx";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GOLD = "var(--primary)";

export { directionalChevronPoints };

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
  const burstOrder = solveFx && beam ? gemsInBeamOrder(beam, beamBranchOffsets(beam), litGems) : [];

  return (
    <div
      className={`laser-board relative mx-auto aspect-square h-full max-h-full w-full max-w-full select-none ${
        shake ? "animate-shake" : ""
      } ${solveFx ? "laser-board-solved" : ""}`}
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
          if (wall.has(cell)) return <div key={cell} className="laser-block rounded-md bg-foreground/60" />;
          const piece = mirrorAt.get(cell);
          if (piece && isSplitter(piece)) return <div key={cell} aria-label={`Splitter ${piece === "S|" ? "vertical" : "horizontal"} input`} className="laser-piece-cell flex items-center justify-center"><LaserSplitter kind={piece} /></div>;
          if (splitters.includes(cell)) return <div key={cell} aria-label="Splitter" className="laser-piece-cell flex items-center justify-center"><LaserSplitter /></div>;
          if (gemSet.has(cell)) {
            const directional = directionalGems.find((gem) => gem.cell === cell);
            return (
              <div
                key={cell}
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
              <div key={cell} aria-label="Bomb" className="laser-piece-cell flex items-center justify-center">
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
                  animate={live}
                />
              );
            })}
            {burstOrder.length ? <LaserGemBursts centres={burstOrder.map(at)} unit={unit} /> : null}
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
  const [selected, setSelected] = useState<MirrorKind>("/");

  const [placed, setPlaced] = useStageState<MirrorPlacement[]>(stateKey, "mirrors", () => []);
  const [history, setHistory] = useStageState<number[]>(stateKey, "history", () => []);
  const [fires, setFires] = useStageState<number>(stateKey, "fires", () => 0);
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
    onDraftAnswer?.(logged ? encodeActionLog(log) : encodeLaserAnswer(placed, Math.max(1, fires)));
  }, [logged, log, placed, fires, onDraftAnswer]);

  const offsets = shot ? beamBranchOffsets(shot.trace.paths) : [];
  const revealed = shot ? shot.trace.paths.map((path, index) =>
    path.slice(0, Math.max(0, shot.step - (offsets[index] ?? 0) + 1))) : null;
  const visibleCells = revealed?.flat() ?? [];
  const litGems = shot ? shot.trace.gemsLit.filter((gem) => visibleCells.includes(gem)) : [];
  const bombFlash = Boolean(shot?.done && shot.trace.hitBomb);
  const solved = submitted.current;
  const firesLeft = Math.max(0, LASER_MAX_FIRES - fires);
  const inFrame = useInFrame();

  const refuse = useCallback(() => {
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
        record(laserAction.remove(drag.from));
        setPlaced(current.filter((mirror) => mirror.cell !== drag.from));
        setHistory((order) => order.filter((cell) => cell !== drag.from));
        return;
      }
      // Dropped where it started — a tap, so flip it.
      if (target === drag.from) {
        record(laserAction.turn(drag.from));
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
      record(laserAction.move(drag.from, target));
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
    record(laserAction.place(target, kind));
    setPlaced([...current, { cell: target, kind }]);
    setHistory((order) => [...order.filter((cell) => cell !== target), target]);
  }, [refuse, record, setHistory, setPlaced, taken, total, splitterTotal, selected]);

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
    logged,
    log,
    setLog,
    phaseStartedAt,
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
    record(laserAction.place(cell, selected));
    setPlaced([...placed, { cell, kind: selected }]);
    setHistory((order) => [...order.filter((placedCell) => placedCell !== cell), cell]);
  };

  const undo = () => {
    if (!history.length) return;
    const last = history.at(-1);
    if (last === undefined) return;
    record(laserAction.remove(last));
    setHistory((current) => current.slice(0, -1));
    setPlaced((current) => current.filter((mirror) => mirror.cell !== last));
  };

  const reset = () => {
    record(laserAction.reset());
    setPlaced([]);
    setHistory([]);
  };

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
      if (!(locked || solved || !placed.length || Boolean(shot))) reset();
    } else if (!(locked || solved || !history.length || Boolean(shot))) undo();
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
          shake={shake > 0}
          gridRef={gridRef}
          pointer={{ onPointerDown: onBoardDown }}
          live
          solved={solved}
        />
      </div>

      <LiveSummary
        items={elegantPar > 0
          ? [
              // laserRev 1 (depth batch 4): the elegant beam's par mirrors on the par meter.
              ...parItems("Mirrors", mirrorsPlaced, elegantPar),
              splitterTotal > 0 ? <SummaryItem key="splitter" label="Splitter" value={`${splitterPlaced}/${splitterTotal}`} /> : null,
              <SummaryItem key="gems" label="Gems" value={`${litGems.length}/${gems.length}`} />,
            ]
          : [
              <SummaryItem key="mirrors" label="Mirrors" value={`${mirrorsPlaced} / ${total}`} />,
              splitterTotal > 0 ? <SummaryItem key="splitter" label="Splitter" value={`${splitterPlaced} / ${splitterTotal}`} /> : null,
              <SummaryItem key="gems" label="Gems lit" value={`${litGems.length} / ${gems.length}`} />,
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
              <span className="flex h-7 w-7 items-center justify-center [&_svg]:size-6">{isSplitter(kind) ? <LaserSplitter kind={kind} /> : <span className="text-lg">/</span>}</span>
              <span className="font-mono text-xs">{left}</span>
            </Button>
          );
        })}
        <Button
          type="button"
          disabled={locked || solved || !placed.length || Boolean(shot)}
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
  const logReplay = usesActionLog(puzzle) ? replayLaserLog(puzzle, myAnswer ?? "", timeLimitMs) : null;
  const mine = logReplay
    ? { mirrors: logReplay.layout, fires: logReplay.solvedShot ?? logReplay.shots }
    : decodeLaserAnswer(myAnswer ?? "", puzzle.mirrors + (puzzle.splitterPieces ?? 0));
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
    <div className="laser-reveal flex w-full min-h-0 flex-col items-center gap-3">
      <div className="laser-reveal-boards flex min-h-0 w-full flex-1 items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="laser-reveal-board aspect-square">
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
          <div className="laser-reveal-board aspect-square">
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
