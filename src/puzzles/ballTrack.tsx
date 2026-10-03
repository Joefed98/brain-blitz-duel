import { useEffect, useRef, useState } from "react";
import { Bomb, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/components/puzzles/GridDrag";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { btDecode, btEncode, btReplay, btDrop, BT_COLS, BT_ROWS, type BtBoard, type BtEvent, type BtPathPoint, type BtRun } from "@/lib/duel/ballTrack";
import { useStageState } from "@/lib/duel/stageState";
import { BALLTRACK_TIME_MS, type BallTrackPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const BALL_COLOURS = ["var(--color-ball-red)", "var(--color-ball-blue)", "var(--color-ball-green)", "var(--color-ball-purple)", "var(--color-ball-pink)", "var(--color-ball-orange)", "var(--color-ball-brown)", "var(--color-ball-yellow)"];
const STEP_MS = 130;
const BALL_NAMES = ["red", "blue", "green", "purple", "pink", "orange", "brown", "yellow"];

function Tube({ orientation }: { orientation: number; small: boolean }) {
  // Ball diameter is 33% of a tile; inner pipe width 41.25% (ball = 80%).
  const diagonal = orientation !== 0;
  const offset = diagonal ? 29.17 : 20.625;
  const lines = orientation === 1
    ? [[-100, -100 - offset, 200, 200 - offset], [-100, -100 + offset, 200, 200 + offset]]
    : orientation === 2
      ? [[-100, 200 - offset, 200, -100 - offset], [-100, 200 + offset, 200, -100 + offset]]
      : [[50 - offset, 0, 50 - offset, 100], [50 + offset, 0, 50 + offset, 100]];
  return <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full overflow-hidden">
    {lines.map((line, index) => <line key={index} x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-foreground)" strokeOpacity=".7" strokeWidth={3} />)}
  </svg>;
}

function LinkMarks({ pairs, small }: { pairs: readonly [number, number][]; small: boolean }) {
  const sorted = [...pairs].sort((a, b) => Math.abs(b[1] - b[0]) - Math.abs(a[1] - a[0]));
  return sorted.map(([a, b], index) => {
    const left = (Math.min(a, b) + .5) * 12.5;
    const right = (Math.max(a, b) + .5) * 12.5;
    const nested = sorted.some(([x, y], outer) => outer < index && Math.min(x, y) < Math.min(a, b) && Math.max(x, y) > Math.max(a, b));
    const colour = index === 0 ? "var(--color-opponent)" : "var(--color-primary)";
    return <span key={`${a}-${b}`} aria-hidden="true" className="pointer-events-none absolute z-30 border-x-[3px] border-t-[3px] rounded-t-full" style={{ left: `${left}%`, width: `${right - left}%`, top: nested ? (small ? 7 : 12) : 1, height: nested ? (small ? 8 : 12) : (small ? 12 : 19), borderColor: colour }}><span className="absolute -bottom-1 -left-1.5 size-2 rounded-full border-2" style={{ borderColor: colour }} /><span className="absolute -bottom-1 -right-1.5 size-2 rounded-full border-2" style={{ borderColor: colour }} /></span>;
  });
}

function PipeBoard({ board, tiles, dropped, active, destroyed = [], exploded = [], flashing = [], onRotate, onDrop, small = false }: {
  board: BtBoard;
  tiles: string;
  dropped: readonly number[];
  active?: readonly { ball: number; point: BtPathPoint }[];
  onRotate?: ((cell: number) => void) | undefined;
  onDrop?: ((ball: number) => void) | undefined;
  small?: boolean;
  destroyed?: readonly number[];
  exploded?: readonly number[];
  flashing?: readonly number[];
}) {
  const blocks = new Set([...(board.blocks ?? []), ...destroyed]);
  const bombs = new Set((board.bombs ?? []).map(b => b.cell));
  const gateMap = new Map((board.gates ?? []).map((gate) => [gate.cell, gate.colour]));
  const activeBalls = new Set(active?.map((item) => item.ball) ?? []);
  return (
    <div className="relative w-full select-none" data-play-area>
      <div className={`relative grid w-full ${small ? "pt-3" : "pt-6"}`} style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        <LinkMarks pairs={board.pairs ?? []} small={small} />
        {Array.from({ length: board.cols }, (_, ball) => (
          <Button key={ball} type="button" variant="ghost" aria-label={`Drop ${BALL_NAMES[ball] ?? `ball ${ball + 1}`}`} disabled={!onDrop || dropped.includes(ball) || activeBalls.size > 0} onClick={() => onDrop?.(ball)} className={`${small ? "h-5" : "h-7"} min-w-0 rounded-none p-0 disabled:opacity-30`}>
            {!dropped.includes(ball) && !activeBalls.has(ball) && <span className={`${small ? "size-1.5" : "w-[33%] max-w-none"} block aspect-square rounded-full border border-foreground/30 shadow-sm`} style={{ backgroundColor: BALL_COLOURS[ball % 8] }} />}
          </Button>
        ))}
      </div>
      <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: board.rows * board.cols }, (_, cell) => {
          const blocked = blocks.has(cell);
          const bomb = bombs.has(cell) && !exploded.includes(cell) && !blocked;
          const gate = gateMap.get(cell);
          return (
            <Button key={cell} type="button" variant="outline" disabled={!onRotate || blocked || bomb || cell < board.cols} aria-label={bomb ? `Bomb row ${Math.floor(cell / board.cols) + 1}, column ${cell % board.cols + 1}` : blocked ? `Broken tile row ${Math.floor(cell / board.cols) + 1}, column ${cell % board.cols + 1}` : `Rotate pipe row ${Math.floor(cell / board.cols) + 1}, column ${cell % board.cols + 1}`} onClick={() => onRotate?.(cell)} className={`relative h-auto w-full min-w-0 overflow-hidden rounded-none border-0 p-0 disabled:opacity-100 ${flashing.includes(cell) ? "bg-ball-red animate-tile-flash" : blocked ? "bg-background" : cell < board.cols ? "bg-card opacity-65" : "bg-card"}`} style={{ aspectRatio: "1 / 1" }}>
              {!blocked && !bomb && <Tube orientation={Number(tiles[cell]) % 3} small={small} />}
              {bomb && <Bomb aria-hidden="true" className="size-[55%] text-ball-red" />}
              {blocked && <X aria-hidden="true" className="size-[45%] text-muted-foreground/40" />}
              {gate !== undefined && !blocked && !bomb && <span aria-hidden="true" className="absolute inset-[14%] rounded-full border-[3px]" style={{ borderColor: BALL_COLOURS[gate % 8] }} />}
            </Button>
          );
        })}
      </div>
      <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        {board.buckets.map((colour, column) => (
          <div key={column} className={`flex items-center justify-center ${small ? "h-5" : "h-7"}`} aria-label={`Bucket ${column + 1}`}>
            <span className={`flex items-center justify-center rounded-b-md border-x-2 border-b-2 ${small ? "h-3 w-4" : "h-5 w-[70%]"}`} style={{ borderColor: BALL_COLOURS[colour % 8] }}><span className={`${small ? "size-1" : "size-1.5"} rounded-full`} style={{ backgroundColor: BALL_COLOURS[colour % 8] }} /></span>
          </div>
        ))}
      </div>
      {active?.map((item) => <span key={item.ball} aria-hidden="true" className={`${small ? "size-1.5" : "w-[4.125%] max-w-none"} pointer-events-none absolute z-10 aspect-square rounded-full border border-foreground/50 `} style={{ left: `${item.point.x * 100 / board.cols}%`, top: `calc(${small ? 32 : 52}px + (100% - ${small ? 52 : 80}px) * ${item.point.y / board.rows})`, transform: `translate(-50%, -50%) rotate(${item.point.angle}deg)`, backgroundColor: BALL_COLOURS[item.ball % 8], transition: `left ${STEP_MS}ms linear, top ${STEP_MS}ms linear, transform ${STEP_MS}ms linear` }}><span className="absolute left-1/2 top-[8%] h-[30%] w-px bg-foreground/80" /></span>)}
    </div>
  );
}
const EXAMPLE: BtBoard = { cols: 3, rows: 3, tiles: "000100000", buckets: [2, 0, 1], bombs: [{ cell: 5, neighbour: 8 }], pairs: [], gates: [{ cell: 4, colour: 0 }] };

function IntroExample() {
  const [row, setRow] = useState(-1);
  useEffect(() => {
    const timer = setInterval(() => setRow((current) => current >= 3 ? -1 : current + 1), 450);
    return () => clearInterval(timer);
  }, []);
  const column = row < 0 ? 0 : 1;
  return <div className="mx-auto w-[150px]"><PipeBoard board={EXAMPLE} tiles={EXAMPLE.tiles} dropped={[1, 2]} active={row >= 0 && row <= 3 ? [{ ball: 0, point: { x: column + .5, y: row, angle: row * 60 } }] : []} small /></div>;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data = puzzle.type === "balltrack" ? puzzle : null;
  const [events, setEvents] = useStageState<BtEvent[]>(stateKey ?? "balltrack", "ballTrackEvents", () => []);
  const [anim, setAnim] = useState<{ runs: BtRun[]; step: number; beforeDestroyed: number[]; beforeExploded: number[] } | null>(null);
  const [flashing, setFlashing] = useState<number[]>([]);
  const sounded = useRef(new Set<number>());
  const reduced = usePrefersReducedMotion();
  const submitted = useRef(false);
  const encoded = btEncode(events);
  const replay = data ? btReplay(data, events) : null;

  useEffect(() => { onDraftAnswer?.(encoded); }, [encoded, onDraftAnswer]);
  useEffect(() => {
    if (!anim) return;
    const blasts = anim.runs.flatMap(run => run.explosions).filter(blast => blast.step <= anim.step && !sounded.current.has(blast.cell));
    if (!blasts.length) return;
    for (const blast of blasts) sounded.current.add(blast.cell);
    setFlashing(blasts.flatMap(blast => [blast.cell, blast.neighbour]));
    playWrong(); buzz([35, 20, 65]);
  }, [anim?.step]);
  useEffect(() => {
    if (!flashing.length) return;
    const timer = setTimeout(() => setFlashing([]), 320);
    return () => clearTimeout(timer);
  }, [flashing]);
  useEffect(() => {
    if (!anim) return;
    const delay = reduced ? 50 : STEP_MS;
    const timer = setTimeout(() => {
      if (anim.step < Math.max(...anim.runs.map((run) => run.points.length - 1))) setAnim({ ...anim, step: anim.step + 1 });
      else setAnim(null);
    }, delay);
    return () => clearTimeout(timer);
  }, [anim, reduced]);
  useEffect(() => {
    if (!replay || anim || locked || submitted.current || replay.dropped.length !== BT_COLS) return;
    submitted.current = true;
    if (replay.home === BT_COLS) playCorrect();
    onSubmit(encoded);
  }, [replay, anim, locked, encoded, onSubmit]);

  if (!data || !replay) return null;
  const busy = locked || !!anim || replay.dropped.length === BT_COLS;
  const drop = (ball: number) => {
    if (busy || replay.dropped.includes(ball)) return;
    const pair = data.pairs.find(([a, b]) => a === ball || b === ball);
    const balls = pair ?? [ball];
    const { runs } = btDrop(data, replay.tiles, balls.filter(item => !replay.dropped.includes(item)), replay.destroyed, replay.exploded);
    sounded.current.clear();
    setAnim({ runs, step: -1, beforeDestroyed: replay.destroyed, beforeExploded: replay.exploded });
    setEvents((current) => [...current, { k: "d", ball }]);
  };
  const active = anim?.runs.map((run) => ({ ball: run.ball, point: run.points[Math.min(Math.max(anim.step, 0), run.points.length - 1)] ?? { x: run.ball + .5, y: -.15, angle: 0 } })) ?? [];
  const visibleBlasts = anim?.runs.flatMap(run => run.explosions).filter(blast => blast.step <= anim.step) ?? [];
  const destroyed = anim ? [...anim.beforeDestroyed, ...visibleBlasts.flatMap(blast => [blast.cell, blast.neighbour])] : replay.destroyed;
  const exploded = anim ? [...anim.beforeExploded, ...visibleBlasts.map(blast => blast.cell)] : replay.exploded;
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-1 pt-7">
      <p className="shrink-0 font-mono text-xs text-muted-foreground">{replay.home} / 8 home · {replay.dropped.length} / 8 dropped · {replay.rotations} turns</p>
      <div className={`w-full ${flashing.length && !reduced ? "animate-shake" : ""}`}>
        <PipeBoard board={data} tiles={replay.tiles} dropped={replay.dropped} active={active} destroyed={destroyed} exploded={exploded} flashing={flashing} onRotate={busy ? undefined : (cell) => { buzz(8); setEvents((current) => [...current, { k: "r", cell }]); }} onDrop={busy ? undefined : drop} />
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  if (puzzle.type !== "balltrack") return null;
  const mine = btReplay(puzzle, btDecode(myAnswer ?? ""));
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="font-display text-xl font-bold text-primary">{mine.home} / 8 home</p>
      <p className="text-xs text-muted-foreground">Same puzzle for everyone</p>
      <div className="flex w-full justify-center gap-3">
        <div className="w-[46%] max-w-[170px]"><p className="mb-1 text-center text-xs text-muted-foreground">Solution</p><PipeBoard board={puzzle} tiles={puzzle.solution ?? puzzle.tiles} dropped={[]} small /></div>
        <div className="w-[46%] max-w-[170px]"><p className="mb-1 text-center text-xs text-muted-foreground">Yours</p><PipeBoard board={puzzle} tiles={mine.tiles} dropped={[]} destroyed={mine.destroyed} exploded={mine.exploded} small /></div>
      </div>
      <p className="font-mono text-xs text-muted-foreground">{mine.rotations} rotations · fewest {puzzle.minRotations ?? "—"}</p>
      {dev && <p className="font-mono text-[10px] text-muted-foreground">Stored minimum {puzzle.minRotations ?? "—"}</p>}
    </div>
  );
}

export const ballTrackPuzzle: PuzzleDefinition = {
  key: "balltrack",
  name: "Ball Track",
  category: "pattern",
  timeLimitMs: BALLTRACK_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "balltrack", cols: BT_COLS, rows: BT_ROWS, tiles: "0".repeat(BT_COLS * BT_ROWS), buckets: [1, 0, 3, 2, 5, 4, 7, 6], bombs: [{ cell: 18, neighbour: 19 }, { cell: 29, neighbour: 28 }, { cell: 34, neighbour: 35 }, { cell: 45, neighbour: 44 }], pairs: [[0, 3], [1, 2]], gates: [{ cell: 16, colour: 0 }, { cell: 47, colour: 7 }] }) satisfies BallTrackPuzzleData,
  check: (answer, puzzle) => puzzle.type === "balltrack" && btReplay(puzzle, btDecode(answer)).home === BT_COLS,
  revealHeading: "Ball Track",
  IntroExample,
  Stage,
  Reveal,
};