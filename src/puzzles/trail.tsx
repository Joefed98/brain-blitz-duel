import { useEffect, useRef, useState, type CSSProperties } from "react";

import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { trCanStep, trComplete, trCorrectPrefix, trDecode, trEncode, TR_SIZE } from "@/lib/duel/trail";
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
}: {
  size: number;
  givens: readonly (number | null)[];
  path: readonly number[];
  cell: number;
  /** Reveal: steps (1-based) at or below this count are right; above are wrong. */
  marks?: number;
  shakeCell?: number | null;
}) {
  const stepOf = new Map<number, number>();
  path.forEach((c, i) => stepOf.set(c, i + 1));
  const end = path[path.length - 1];
  const centre = (c: number) => ({
    x: (c % size) * (cell + GAP) + cell / 2,
    y: Math.floor(c / size) * (cell + GAP) + cell / 2,
  });
  const span = size * cell + (size - 1) * GAP;
  return (
    <div className="relative" style={{ width: span, height: span }}>
      <svg className="pointer-events-none absolute inset-0" width={span} height={span}>
        {path.slice(1).map((c, i) => {
          const a = centre(path[i]!);
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
          const wrong = marks !== undefined && step !== undefined && step > marks;
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

/** 4×4 mini: givens 1, 7, 12, 16; the path is drawn once, a step at a time. */
const EX_GIVENS: (number | null)[] = [1, null, null, null, null, null, 7, null, null, 12, null, null, null, 16, null, null];
const EX_PATH = [0, 5, 1, 2, 3, 7, 6, 10, 11, 15, 14, 9, 4, 8, 12, 13];

function IntroExample() {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (n >= EX_PATH.length) return;
    const t = setTimeout(() => setN((v) => v + 1), n === 1 ? 700 : 260);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div className="flex flex-col items-center gap-2">
      <Grid size={4} givens={EX_GIVENS} path={EX_PATH.slice(0, n)} cell={36} />
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        Diagonal steps count. The path hits 7, 12 and 16 exactly on time.
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

  const complete = data ? trComplete(data.givens, path) : false;
  useEffect(() => {
    if (!complete || submitted.current || locked) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, locked]);

  if (!data) return null;
  const busy = locked || complete;
  const fit = Math.min(space.w - 8, space.h - 40);
  const cell = Math.max(48, Math.min(60, Math.floor((fit - (TR_SIZE - 1) * GAP) / TR_SIZE)));

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
    const px = x - rect.left;
    const py = y - rect.top;
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
    const end = path[path.length - 1];
    if (c === end) return;
    if (path.length > 1 && c === path[path.length - 2]) {
      setPath(path.slice(0, -1));
      lastRefused.current = null;
      buzz(4);
      return;
    }
    if (trCanStep(data.givens, path, c)) {
      setPath([...path, c]);
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
    if (c === path[path.length - 1]) drawing.current = true;
    else refuse(c);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || busy) return;
    const c = cellAt(e.clientX, e.clientY, true);
    if (c !== null) visit(c);
  };

  const up = () => {
    drawing.current = false;
  };

  return (
    <div
      ref={box}
      data-play-area
      className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 py-1 select-none"
      style={NO_TOUCH}
    >
      <p className="font-mono text-sm text-muted-foreground">
        {path.length} / {data.givens.length}
      </p>
      <div
        ref={grid}
        style={NO_TOUCH}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      >
        <Grid size={TR_SIZE} givens={data.givens} path={path} cell={cell} shakeCell={shakeCell} />
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  if (puzzle.type !== "trail") return null;
  const solution = puzzle.solution ?? [];
  const mine = trDecode(myAnswer ?? "", puzzle.givens.length);
  const prefix = trCorrectPrefix(mine, solution);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
          <Grid size={TR_SIZE} givens={puzzle.givens} path={solution} cell={24} marks={36} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <Grid size={TR_SIZE} givens={puzzle.givens} path={mine} cell={24} marks={prefix} />
        </div>
      </div>
      <p className="font-mono text-base text-primary">{myCorrect ? "Complete" : `${prefix} / 36 steps correct`}</p>
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
