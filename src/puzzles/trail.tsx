import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { Button } from "@/components/ui/button";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { trCanStep, trComplete, trCorrectTiles, trDecode, trDragPath, trEncode, trTapPath, trUndoPlayer, trSlots, TR_SIZE } from "@/lib/duel/trail";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { TRAIL_TIME_MS, type TrailPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { useGoalProgress } from "@/components/duel/GameFrame";
import { LiveSummary } from "@/components/puzzles/batchW/LiveSummary";
import "@/polish-layout/batch-w-trail.css";

const NO_TOUCH: CSSProperties = {
  touchAction: "none",
  overscrollBehavior: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
};
const GAP = 4;

/*
 * Number polish (13 Oct 2026): a worn footpath over mossy ground, stepping stones on each step and
 * carved milestones for the fixed numbers. Display only: every tile is exactly its cell (the hit box),
 * and the art classes avoid the shared surface adapter's tile and route selectors.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36'%3E${[
  "4,5,.9,000,.22", "11,2,.6,fff,.08", "19,7,1.1,000,.18", "28,4,.7,fff,.1", "33,12,1,000,.2", "7,15,.7,fff,.09",
  "15,18,1.2,000,.16", "24,14,.6,fff,.1", "30,22,.9,000,.2", "3,26,1.1,000,.18", "12,29,.7,fff,.08", "21,27,1,000,.2",
  "27,33,.6,fff,.1", "34,30,.8,000,.16", "8,34,.9,000,.14", "18,33,.6,fff,.09",
].map((d) => { const [x, y, r, c, a] = d.split(","); return `%3Ccircle cx='${x}' cy='${y}' r='${r}' fill='%23${c}' fill-opacity='${a}'/%3E`; }).join("")}%3C/svg%3E")`;
const TR_CSS = `
.tr-ground { border-radius: 6px; background-color: #1f2a1c; background-image: ${GRAIN}, radial-gradient(circle at 30% 25%, rgba(120,150,80,.22), rgba(120,150,80,0) 60%), linear-gradient(160deg, #263322 0%, #1c2619 60%, #161e13 100%); box-shadow: inset 0 1px 0 rgba(190,220,150,.08), inset 0 -2px 3px rgba(0,0,0,.35); }
.tr-cell { position: relative; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-family: var(--font-mono); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: 0; }
.tr-milestone { background-color: #67635c; background-image: ${GRAIN}, linear-gradient(165deg, #8a857c 0%, #66615a 50%, #4b4741 100%); color: #f8f3ea; box-shadow: inset 2px 2px 0 rgba(255,255,255,.18), inset -2px -3px 0 rgba(0,0,0,.36), 0 2px 0 rgba(0,0,0,.45); text-shadow: 0 -1px 0 rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.12); }
.tr-step { display: flex; align-items: center; justify-content: center; border-radius: 46% 54% 50% 50% / 52% 46% 54% 48%; background-color: #d9d0bd; background-image: ${GRAIN}, linear-gradient(160deg, #eee6d4 0%, #d4c9b2 55%, #b3a68b 100%); color: #231c12; box-shadow: inset 1px 2px 0 rgba(255,255,255,.55), inset -1px -2px 0 rgba(80,64,40,.35), 0 2px 3px rgba(0,0,0,.5); }
.tr-step.tr-wrong { background-color: #efc3b8; background-image: linear-gradient(160deg, #f6d6ce, #e1a596); color: #560c0c; box-shadow: inset 0 0 0 2px #c0262d, 0 2px 3px rgba(0,0,0,.5); }
.tr-end { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--primary); }
.tr-cell.tr-end { box-shadow: inset 0 0 0 2px var(--primary); }
.tr-pop { animation: tr-pop 200ms cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes tr-pop { from { opacity: 0; transform: scale(.55); } to { opacity: 1; transform: none; } }
.tr-seg { transform-box: fill-box; transform-origin: 0% 50%; }
.tr-draw { animation: tr-draw 190ms ease-out both; }
@keyframes tr-draw { from { transform: scaleX(0); } to { transform: none; } }
.tr-glow { pointer-events: none; animation: tr-glow-out 1150ms linear both; }
.tr-step { position: relative; }
.tr-lit .tr-step::after { content: ""; position: absolute; inset: -2px; border-radius: inherit; pointer-events: none; box-shadow: 0 0 0 2px #ffd56e, 0 0 10px 2px rgba(255,196,72,.65); opacity: 0; animation: tr-rim 1000ms ease-out var(--tr-delay, 0ms) both; }
@keyframes tr-rim { 0% { opacity: 0; } 15% { opacity: 1; } 60% { opacity: .85; } 100% { opacity: 0; } }
@keyframes tr-glow-out { 0%, 72% { opacity: 1; } 100% { opacity: 0; } }
.tr-glow .tr-seg { animation: tr-glow-in 150ms ease-out both; }
@keyframes tr-glow-in { from { opacity: 0; transform: scaleX(0); } to { opacity: 1; transform: none; } }
.game-column [data-polish="trail"] > .tr-spacer { flex: 1 1 0 !important; min-height: 0; margin: 0 !important; }
.tr-label { color: #d9d2c4; }
@media (prefers-reduced-motion: reduce) {
  .tr-pop, .tr-draw, .tr-glow, .tr-glow .tr-seg { animation: none; }
  .tr-lit .tr-step::after { animation: none; opacity: .8; }
}
`;

/** A capsule from a to b (cell-centre coordinates), drawn as a rect rotated about a. */
function Capsule({ a, b, width, className, fill, delay }: { a: { x: number; y: number }; b: { x: number; y: number }; width: number; className: string; fill: string; delay?: number }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return (
    <g transform={`translate(${a.x} ${a.y}) rotate(${angle})`}>
      <rect className={className} x={-width / 2} y={-width / 2} width={len + width} height={width} rx={width / 2} fill={fill} style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined} />
    </g>
  );
}

export function Grid({
  size,
  givens,
  path,
  cell,
  marks,
  shakeCell,
  endCell,
  gap = GAP,
  glow = false,
  animate = true,
}: {
  size: number;
  givens: readonly (number | null)[];
  path: readonly number[];
  cell: number;
  /** Reveal: solution cell at each numbered step. */
  marks?: readonly number[];
  shakeCell?: number | null;
  endCell?: number | undefined;
  gap?: number;
  /** Completion: a glowing line draws the whole path from 1 to 36. */
  glow?: boolean;
  animate?: boolean;
}) {
  const stepOf = new Map<number, number>();
  path.forEach((c, i) => { if (c >= 0) stepOf.set(c, i + 1); });
  const end = endCell ?? path[path.length - 1];
  const centre = (c: number) => ({
    x: (c % size) * (cell + gap) + cell / 2,
    y: Math.floor(c / size) * (cell + gap) + cell / 2,
  });
  const span = size * cell + (size - 1) * gap;
  const segments = path.slice(1).flatMap((c, i) => {
    const previous = path[i];
    return previous === undefined || previous < 0 || c < 0 ? [] : [{ from: previous, to: c, i }];
  });
  const draw = animate ? "tr-seg tr-draw" : "tr-seg";
  const disc = cell < 34 ? 0.9 : 0.74;
  const font = Math.max(12, Math.round(cell * 0.4));
  // The ground layer never changes for a board size: build it once per size.
  const ground = useMemo(
    () => Array.from({ length: size * size }, (_, c) => <div key={c} className="tr-ground" style={{ width: cell, height: cell }} />),
    [size, cell],
  );
  const layer: CSSProperties = { display: "grid", gridTemplateColumns: `repeat(${size}, ${cell}px)`, gap };
  return (
    <div className={`relative${glow ? " tr-lit" : ""}`} style={{ width: span, height: span }}>
      <PolishStyle id="trail" css={TR_CSS} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={layer}>{ground}</div>
      <svg aria-hidden className="pointer-events-none absolute inset-0" width={span} height={span}>
        {segments.map((s) => <Capsule key={`e${s.from}-${s.to}-${s.i}`} a={centre(s.from)} b={centre(s.to)} width={cell * 0.42} className={draw} fill="#4a3a26" />)}
        {segments.map((s) => <Capsule key={`t${s.from}-${s.to}-${s.i}`} a={centre(s.from)} b={centre(s.to)} width={cell * 0.3} className={draw} fill="#8f7451" />)}
      </svg>
      {/* Completion glow runs along the footpath, under the stones, so every number stays readable. */}
      {glow && (
        <svg aria-hidden className="tr-glow pointer-events-none absolute inset-0" width={span} height={span}>
          {segments.map((s) => <Capsule key={`h${s.i}`} a={centre(s.from)} b={centre(s.to)} width={cell * 0.62} className="tr-seg" fill="rgba(255,196,72,.45)" delay={s.i * 16} />)}
          {segments.map((s) => <Capsule key={`c${s.i}`} a={centre(s.from)} b={centre(s.to)} width={Math.max(4, cell * 0.2)} className="tr-seg" fill="#ffe7a3" delay={s.i * 16} />)}
        </svg>
      )}
      <div className="relative" style={layer}>
        {givens.map((g, c) => {
          const step = stepOf.get(c);
          const wrong = marks !== undefined && step !== undefined && marks[step - 1] !== c;
          const isEnd = c === end && marks === undefined;
          return (
            <div
              key={c}
              className={`tr-cell ${g != null ? "tr-milestone" : ""} ${isEnd && g != null ? "tr-end" : ""} ${shakeCell === c ? "animate-shake" : ""}`}
              style={{ width: cell, height: cell, fontSize: font }}
            >
              {g != null ? g : step !== undefined ? (
                <span key={`${c}:${step}`} className={`tr-step ${animate ? "tr-pop" : ""} ${wrong ? "tr-wrong" : ""} ${isEnd ? "tr-end" : ""}`} style={{ width: Math.round(cell * disc), height: Math.round(cell * disc), ["--tr-delay" as string]: `${(step - 1) * 16}ms` }}>{step}</span>
              ) : ""}
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
  const column = useGameColumnLayout();
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

  useBeforePaint(() => {
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
  // Sound cue for each new trail segment (the segment's draw animation); never on the first render.
  const steps = slots.filter((c) => c >= 0).length;
  const lastSteps = useRef(steps);
  useEffect(() => {
    if (steps > lastSteps.current) soundCue("trail.step");
    lastSteps.current = steps;
  }, [steps]);
  const glow = useSolveFx(complete, "trail.solve", 1150);
  // Batch W: the "12 / 26" count moves to the frame's goal line in a live round (display only).
  const placedTiles = data ? slots.filter((c, i) => c >= 0 && !data.givens.includes(i + 1)).length : 0;
  const framed = useGoalProgress({ done: placedTiles, total: 26, text: `${placedTiles} / 26` });

  // Desktop keys: Z or Backspace = Undo, R = Reset.
  useGameKeys((kind, key, event) => {
    if (!data) return false;
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (busy || slots.every((c, i) => c < 0 || data.givens.includes(i + 1))) return true;
    if (key === "r") reset();
    else undo();
    return true;
  });

  if (!data) return null;
  const busy = locked || complete;
  const nextNumber = Math.min(data.givens.length, trDragPath(data.givens, path).length + 1);
  // Count, two gaps, top inset and 44px controls; no tray. Keep 36px squares.
  const fit = Math.min(space.w - 8, space.h - 84);
  const cell = Math.max(44, Math.min(68, Math.floor((fit - (TR_SIZE - 1) * GAP) / TR_SIZE)));

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
      data-polish="trail"
      ref={box}
      data-play-area
      data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 pt-1 select-none"
      style={NO_TOUCH}
    >
      {column && <div className="tr-spacer" aria-hidden />}
      {framed ? null : (
        <p className="shrink-0 font-mono text-sm text-muted-foreground">
          {placedTiles} / 26
        </p>
      )}
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
        <Grid size={TR_SIZE} givens={data.givens} path={slots} cell={cell} shakeCell={shakeCell} endCell={trDragPath(data.givens, path).at(-1)} glow={glow} />
      </div>
      {column && <div className="tr-spacer" aria-hidden />}
      {framed ? (
        <LiveSummary
          testId="trail"
          parts={complete ? ["Trail complete"] : [`Next ${nextNumber}`, `${26 - placedTiles} to go`]}
        />
      ) : null}
      <div data-game-controls="actions" className="flex shrink-0 gap-3 px-2" style={{ width: TR_SIZE * cell + (TR_SIZE - 1) * GAP }}>
        <Button variant="outline"
          type="button"
          disabled={busy || slots.every((c, i) => c < 0 || data.givens.includes(i + 1))}
          onClick={undo}
          className="gf-glass h-11 flex-1 rounded-lg border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground disabled:opacity-40"
        >
          Undo
        </Button>
        <Button variant="outline"
          type="button"
          disabled={busy || slots.every((c, i) => c < 0 || data.givens.includes(i + 1))}
          onClick={reset}
          className="gf-glass h-11 flex-1 rounded-lg border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
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
  // Fit both boards to the space the shared reveal frame gives (side by side or stacked, whichever is larger).
  const root = useRef<HTMLDivElement | null>(null);
  const [space, setSpace] = useState({ w: 343, h: 440 });
  useBeforePaint(() => {
    const host = root.current?.parentElement;
    if (!host) return;
    const read = () => setSpace({ w: host.clientWidth, h: host.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(host); read();
    return () => ro.disconnect();
  }, []);
  if (puzzle.type !== "trail") return null;
  const solution = puzzle.solution ?? [];
  const mine = trDecode(myAnswer ?? "", puzzle.givens.length);
  const correctTiles = trCorrectTiles(puzzle.givens, mine, solution);
  const gap = 3;
  const extra = 28 + (dev ? 30 : 0);
  const side = Math.min(Math.floor(((space.w - 12) / 2 - 5 * gap) / 6), Math.floor((space.h - 22 - extra - 8 - 5 * gap) / 6));
  const stacked = Math.min(Math.floor((space.w - 8 - 5 * gap) / 6), Math.floor(((space.h - 44 - extra - 16) / 2 - 5 * gap) / 6));
  const cell = Math.max(24, Math.min(44, Math.max(side, stacked)));
  return (
    <div ref={root} className="flex w-full flex-col items-center gap-2">
      <div className={`flex w-full items-center justify-center gap-3 ${side >= stacked ? "" : "flex-col gap-1.5"}`}>
        <div className="flex flex-col items-center gap-1">
          <span className="tr-label text-xs uppercase tracking-widest">Solution</span>
          <Grid size={TR_SIZE} givens={puzzle.givens} path={solution} cell={cell} gap={gap} marks={solution} animate={false} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="tr-label text-xs uppercase tracking-widest">Yours</span>
          <Grid size={TR_SIZE} givens={puzzle.givens} path={mine} cell={cell} gap={gap} marks={solution} animate={false} />
        </div>
      </div>
      <p className="font-mono text-base text-primary">{`${correctTiles} / 26 tiles correct`}</p>
      {dev && <p className="max-w-[340px] break-all font-mono text-[10px] text-muted-foreground">dev · solution [{solution.join(", ")}]</p>}
    </div>
  );
}

export const trailPuzzle: PuzzleDefinition = {
  key: "trail",
  name: gameDisplayName("trail"),
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
