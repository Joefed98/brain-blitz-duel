import { useEffect, useRef, useState, type CSSProperties } from "react";

import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { Button } from "@/components/ui/button";
import { trCanStep, trComplete, trCorrectTiles, trDecode, trDragPath, trEncode, trTapPath, trUndoPlayer, trSlots, TR_SIZE } from "@/lib/duel/trail";
import { useStageState } from "@/lib/duel/stageState";
import { TRAIL_TIME_MS, type TrailPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const NO_TOUCH: CSSProperties = {
  touchAction: "none",
  overscrollBehavior: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
};
const GAP = 4;

function Grid({
  size,
  givens,
  path,
  cell,
  marks,
  shakeCell,
  endCell,
}: {
  size: number;
  givens: readonly (number | null)[];
  path: readonly number[];
  cell: number;
  /** Reveal: solution cell at each numbered step. */
  marks?: readonly number[];
  shakeCell?: number | null;
  endCell?: number | undefined;
}) {
  const stepOf = new Map<number, number>();
  path.forEach((c, i) => { if (c >= 0) stepOf.set(c, i + 1); });
  const end = endCell ?? path[path.length - 1];
  const centre = (c: number) => ({
    x: (c % size) * (cell + GAP) + cell / 2,
    y: Math.floor(c / size) * (cell + GAP) + cell / 2,
  });
  const span = size * cell + (size - 1) * GAP;
  return (
    <div className="relative" style={{ width: span, height: span }}>
      <svg className="pointer-events-none absolute inset-0" width={span} height={span}>
        {path.slice(1).map((c, i) => {
          const previous = path[i];
          if (previous === undefined || previous < 0 || c < 0) return null;
          const a = centre(previous);
          const b = centre(c);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--primary)"
              strokeOpacity={0.35}
              strokeWidth={Math.max(3, cell * 0.14)}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)`, gap: GAP }}>
        {givens.map((g, c) => {
          const step = stepOf.get(c);
          const wrong = marks !== undefined && step !== undefined && marks[step - 1] !== c;
          const cls =
            g != null
              ? "bg-foreground text-background"
              : step !== undefined
                ? `border-2 bg-card text-primary ${wrong ? "border-destructive text-destructive" : "border-primary"}`
                : "border-2 border-dashed border-border bg-background/60";
          return (
            <div
              key={c}
              className={`relative flex items-center justify-center rounded-md font-mono font-bold ${cls} ${
                c === end && marks === undefined ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
              } ${shakeCell === c ? "animate-shake" : ""}`}
              style={{ width: cell, height: cell, fontSize: cell * 0.4 }}
            >
              {g ?? step ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A real 6×6 board: ten fixed numbers, the path drawn once a step at a time. */
const EX_GIVENS: (number | null)[] = [null,null,null,null,null,null,null,17,null,null,null,28,null,null,null,null,30,1,null,23,35,null,31,null,11,null,null,36,null,null,null,null,null,null,4,null];
const EX_PATH = [17,23,29,34,35,28,33,32,31,30,24,25,18,12,6,0,7,1,2,3,8,13,19,14,9,4,5,11,10,16,22,15,21,26,20,27];

function IntroExample() {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (n >= EX_PATH.length) return;
    const t = setTimeout(() => setN((v) => v + 1), n === 1 ? 700 : 150);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div className="flex flex-col items-center gap-2">
      <Grid size={TR_SIZE} givens={EX_GIVENS} path={EX_PATH.slice(0, n)} cell={28} />
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        Ten numbers are fixed; you fill the other 26. Diagonal steps count, and the path must hit each fixed number on its step.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: TrailPuzzleData | null = puzzle.type === "trail" ? puzzle : null;
  const startCell = data ? data.givens.indexOf(1) : 0;
  const [path, setPath] = useStageState<number[]>(stateKey ?? "trail", "trailPath", () => [startCell]);
  const [shakeCell, setShakeCell] = useState<number | null>(null);
  const drawing = useRef(false);
  const press = useRef<{ cell: number; x: number; y: number; moved: boolean } | null>(null);
  const lastRefused = useRef<number | null>(null);
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const [space, setSpace] = useState({ w: 360, h: 420 });
  const encoded = trEncode(path);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const read = () => setSpace({ w: node.clientWidth, h: node.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(node);
    read();
    return () => ro.disconnect();
  }, []);

  // Non-passive: stop the page scrolling while a finger is on the grid.
  useEffect(() => {
    const node = grid.current;
    if (!node) return;
    const stop = (e: TouchEvent) => e.cancelable && e.preventDefault();
    node.addEventListener("touchmove", stop, { passive: false });
    node.addEventListener("touchstart", stop, { passive: false });
    return () => {
      node.removeEventListener("touchmove", stop);
      node.removeEventListener("touchstart", stop);
    };
  }, []);

  const slots = data ? trSlots(data.givens, path) : path;
  const complete = data ? trComplete(data.givens, slots) : false;
  useEffect(() => {
    if (!complete || submitted.current || locked) return;
    submitted.current = true;
    playCorrect();
    onSubmit(trEncode(slots));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, locked]);

  if (!data) return null;
  const busy = locked || complete;
  // Count, two gaps, top inset and 44px controls; no tray. Keep 36px squares.
  const fit = Math.min(space.w - 8, space.h - 84);
  const cell = Math.max(36, Math.min(60, Math.floor((fit - (TR_SIZE - 1) * GAP) / TR_SIZE)));

  const refuse = (c: number) => {
    if (lastRefused.current === c) return;
    lastRefused.current = c;
    setShakeCell(null);
    requestAnimationFrame(() => setShakeCell(c));
    buzz([10, 30, 10]);
  };

  /** The cell under the finger, only near its centre so diagonals are easy to hit. */
  const cellAt = (x: number, y: number, strict: boolean): number | null => {
    const rect = grid.current?.getBoundingClientRect();
    if (!rect) return null;
    // Screen px → layout px, so a scaled-down intro demo hits the same cells.
    const scale = grid.current && grid.current.offsetWidth > 0 ? rect.width / grid.current.offsetWidth : 1;
    const px = (x - rect.left) / scale;
    const py = (y - rect.top) / scale;
    const pitch = cell + GAP;
    const col = Math.floor(px / pitch);
    const row = Math.floor(py / pitch);
    if (col < 0 || row < 0 || col >= TR_SIZE || row >= TR_SIZE) return null;
    if (strict) {
      const dx = px - (col * pitch + cell / 2);
      const dy = py - (row * pitch + cell / 2);
      if (dx * dx + dy * dy > (cell * 0.42) ** 2) return null;
    }
    return row * TR_SIZE + col;
  };

  const visit = (c: number) => {
    const dragPath = trDragPath(data.givens, path);
    const end = dragPath[dragPath.length - 1];
    if (c === end) return;
    if (dragPath.length > 1 && c === dragPath[dragPath.length - 2]) {
      const next = path.length < data.givens.length ? path.slice(0, -1) : [...slots];
      if (path.length === data.givens.length) {
        if (end !== undefined && data.givens[end] == null) next[dragPath.length - 1] = -1;
        else { drawing.current = false; return; }
      }
      setPath(next);
      lastRefused.current = null;
      buzz(4);
      return;
    }
    if (trCanStep(data.givens, dragPath, c) && (!slots.includes(c) || slots[dragPath.length] === c)) {
      const next = path.length < data.givens.length ? [...dragPath, c] : [...slots];
      if (path.length === data.givens.length) next[dragPath.length] = c;
      setPath(next);
      lastRefused.current = null;
      buzz(6);
    } else refuse(c);
  };

  const down = (e: React.PointerEvent) => {
    if (busy) return;
    e.preventDefault();
    const c = cellAt(e.clientX, e.clientY, false);
    if (c === null) return;
    lastRefused.current = null;
    press.current = { cell: c, x: e.clientX, y: e.clientY, moved: false };
    const dragPath = trDragPath(data.givens, path);
    drawing.current = c === dragPath[dragPath.length - 1];
  };

  const move = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.moved = true;
    if (!drawing.current || busy) return;
    const c = cellAt(e.clientX, e.clientY, true);
    if (c !== null) visit(c);
  };

  const up = () => {
    const p = press.current;
    press.current = null;
    drawing.current = false;
    if (!p || p.moved || busy) return;
    const next = trTapPath(data.givens, path, p.cell);
    if (!next) return;
    setPath(next);
    lastRefused.current = null;
    buzz(next.length < trDragPath(data.givens, path).length ? 4 : 6);
  };
  const cancel = () => { drawing.current = false; press.current = null; };

  const undo = () => {
    if (busy) return;
    setPath(trUndoPlayer(data.givens, path));
    lastRefused.current = null;
    buzz(4);
  };
  const reset = () => {
    if (busy) return;
    setPath([startCell]);
    lastRefused.current = null;
    buzz(6);
  };

  return (
    <div
      ref={box}
      data-play-area
      data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 pt-1 select-none"
      style={NO_TOUCH}
    >
      <p className="shrink-0 font-mono text-sm text-muted-foreground">
        {slots.filter((c, i) => c >= 0 && !data.givens.includes(i + 1)).length} / 26
      </p>
      <div
        ref={grid}
        data-game-arena="fixed" className="shrink-0"
        style={NO_TOUCH}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
      >
        <Grid size={TR_SIZE} givens={data.givens} path={slots} cell={cell} shakeCell={shakeCell} endCell={trDragPath(data.givens, path).at(-1)} />
      </div>
      <div data-game-controls="actions" className="flex shrink-0 gap-3 px-2" style={{ width: TR_SIZE * cell + (TR_SIZE - 1) * GAP }}>
        <Button variant="outline"
          type="button"
          disabled={busy || slots.every((c, i) => c < 0 || data.givens.includes(i + 1))}
          onClick={undo}
          className="h-11 flex-1 rounded-lg border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground disabled:opacity-40"
        >
          Undo
        </Button>
        <Button variant="outline"
          type="button"
          disabled={busy || slots.every((c, i) => c < 0 || data.givens.includes(i + 1))}
          onClick={reset}
          className="h-11 flex-1 rounded-lg border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  if (puzzle.type !== "trail") return null;
  const solution = puzzle.solution ?? [];
  const mine = trDecode(myAnswer ?? "", puzzle.givens.length);
  const correctTiles = trCorrectTiles(puzzle.givens, mine, solution);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
          <Grid size={TR_SIZE} givens={puzzle.givens} path={solution} cell={24} marks={solution} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <Grid size={TR_SIZE} givens={puzzle.givens} path={mine} cell={24} marks={solution} />
        </div>
      </div>
      <p className="font-mono text-base text-primary">{`${correctTiles} / 26 tiles correct`}</p>
      {dev && <p className="max-w-[340px] break-all font-mono text-[10px] text-muted-foreground">dev · solution [{solution.join(", ")}]</p>}
    </div>
  );
}

export const trailPuzzle: PuzzleDefinition = {
  key: "trail",
  name: "Trail",
  category: "number",
  timeLimitMs: TRAIL_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "trail", givens: [1, ...new Array(34).fill(null), 36] }) satisfies TrailPuzzleData,
  check: (answer, puzzle) => puzzle.type === "trail" && trComplete(puzzle.givens, trDecode(answer, puzzle.givens.length)),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
