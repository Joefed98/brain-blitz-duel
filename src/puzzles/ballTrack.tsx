import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/components/puzzles/GridDrag";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { btDecode, btEncode, btReplay, btRun, BT_COLS, BT_ROWS, type BtBoard, type BtEvent, type BtPathPoint } from "@/lib/duel/ballTrack";
import { useStageState } from "@/lib/duel/stageState";
import { BALLTRACK_TIME_MS, type BallTrackPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const BALL_COLOURS = ["var(--color-ball-red)", "var(--color-ball-blue)", "var(--color-ball-green)", "var(--color-ball-purple)", "var(--color-ball-pink)", "var(--color-ball-orange)", "var(--color-ball-brown)", "var(--color-ball-yellow)"];
const STEP_MS = 130;
const BALL_NAMES = ["red", "blue", "green", "purple", "pink", "orange", "brown", "yellow"];

function Tube({ orientation, small }: { orientation: number; small: boolean }) {
  const line = orientation === 1 ? [-5, -5, 105, 105] : orientation === 3 ? [105, -5, -5, 105] : orientation === 2 ? [-5, 30, 105, 70] : orientation === 4 ? [105, 30, -5, 70] : [50, -5, 50, 105];
  const width = small ? 34 : 42;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 z-20 size-full overflow-hidden">
      <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-foreground)" strokeOpacity=".3" strokeWidth={width + 8} strokeLinecap="square" />
      <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-card)" strokeWidth={width} strokeLinecap="square" />
      <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-foreground)" strokeOpacity=".22" strokeWidth={7} strokeLinecap="square" transform="translate(7 7)" />
      <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-foreground)" strokeOpacity=".65" strokeWidth={4} strokeLinecap="square" transform="translate(-7 -7)" />
    </svg>
  );
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

function PipeBoard({ board, tiles, dropped, active, onRotate, onDrop, small = false }: {
  board: BtBoard;
  tiles: string;
  dropped: readonly number[];
  active?: readonly { ball: number; point: BtPathPoint }[];
  onRotate?: ((cell: number) => void) | undefined;
  onDrop?: ((ball: number) => void) | undefined;
  small?: boolean;
}) {
  const blocks = new Set(board.blocks ?? []);
  const gateMap = new Map((board.gates ?? []).map((gate) => [gate.cell, gate.colour]));
  const activeBalls = new Set(active?.map((item) => item.ball) ?? []);
  return (
    <div className="relative w-full select-none" data-play-area>
      <div className={`relative grid w-full ${small ? "pt-3" : "pt-6"}`} style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        <LinkMarks pairs={board.pairs ?? []} small={small} />
        {Array.from({ length: board.cols }, (_, ball) => (
          <Button key={ball} type="button" variant="ghost" aria-label={`Drop ${BALL_NAMES[ball] ?? `ball ${ball + 1}`}`} disabled={!onDrop || dropped.includes(ball) || activeBalls.size > 0} onClick={() => onDrop?.(ball)} className={`${small ? "h-5" : "h-7"} min-w-0 rounded-none p-0 disabled:opacity-30`}>
            {!dropped.includes(ball) && !activeBalls.has(ball) && <span className={`${small ? "size-1.5" : "w-[33%] max-w-4"} block aspect-square rounded-full border border-foreground/30 shadow-sm`} style={{ backgroundColor: BALL_COLOURS[ball % 8] }} />}
          </Button>
        ))}
      </div>
      <div className="grid w-full gap-px" style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: board.rows * board.cols }, (_, cell) => {
          const blocked = blocks.has(cell);
          const gate = gateMap.get(cell);
          return (
            <Button key={cell} type="button" variant="outline" disabled={!onRotate || blocked || cell < board.cols} aria-label={blocked ? `Blocked tile row ${Math.floor(cell / board.cols) + 1}, column ${cell % board.cols + 1}` : `Rotate pipe row ${Math.floor(cell / board.cols) + 1}, column ${cell % board.cols + 1}`} onClick={() => onRotate?.(cell)} className={`relative h-auto w-full min-w-0 overflow-hidden rounded-none border-border p-0 disabled:opacity-100 ${blocked ? "bg-foreground/80" : cell < board.cols ? "bg-card opacity-65" : "bg-card"}`} style={{ aspectRatio: "1 / 1" }}>
              {!blocked && <Tube orientation={Number(tiles[cell]) % 3} small={small} />}
              {gate !== undefined && !blocked && <span aria-hidden="true" className="absolute inset-[14%] rounded-full border-[3px]" style={{ borderColor: BALL_COLOURS[gate % 8] }} />}
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
      {active?.map((item) => <span key={item.ball} aria-hidden="true" className={`${small ? "size-1.5" : "w-[4.125%] max-w-4"} pointer-events-none absolute z-10 aspect-square rounded-full border border-foreground/50 shadow-md`} style={{ left: `${item.point.x * 100 / board.cols}%`, top: `calc(${small ? 32 : 52}px + (100% - ${small ? 52 : 80}px) * ${item.point.y / board.rows})`, transform: `translate(-50%, -50%) rotate(${item.point.angle}deg)`, background: `radial-gradient(circle at 30% 25%, var(--color-foreground), ${BALL_COLOURS[item.ball % 8]} 38%)`, transition: `left ${STEP_MS}ms linear, top ${STEP_MS}ms linear, transform ${STEP_MS}ms linear` }} />)}
    </div>
  );
}
const EXAMPLE: BtBoard = { cols: 3, rows: 3, tiles: "100000000", buckets: [2, 0, 1], blocks: [5], pairs: [], gates: [{ cell: 4, colour: 0 }] };

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
  const [anim, setAnim] = useState<{ runs: { ball: number; path: number[]; points: BtPathPoint[]; bucket: number | null }[]; step: number } | null>(null);
  const reduced = usePrefersReducedMotion();
  const submitted = useRef(false);
  const encoded = btEncode(events);
  const replay = data ? btReplay(data, events) : null;

  useEffect(() => { onDraftAnswer?.(encoded); }, [encoded, onDraftAnswer]);
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
    const runs = balls.filter((item) => !replay.dropped.includes(item)).map((item) => ({ ball: item, ...btRun(data, replay.tiles, item) }));
    setAnim({ runs, step: -1 });
    setEvents((current) => [...current, { k: "d", ball }]);
  };
  const active = anim?.runs.map((run) => ({ ball: run.ball, point: run.points[Math.min(Math.max(anim.step, 0), run.points.length - 1)] ?? { x: run.ball + .5, y: -.15, angle: 0 } })) ?? [];
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-1 pt-7">
      <p className="shrink-0 font-mono text-xs text-muted-foreground">{replay.home} / 8 home · {replay.dropped.length} / 8 dropped · {replay.rotations} turns</p>
      <div className="w-full">
        <PipeBoard board={data} tiles={replay.tiles} dropped={replay.dropped} active={active} onRotate={busy ? undefined : (cell) => { buzz(8); setEvents((current) => [...current, { k: "r", cell }]); }} onDrop={busy ? undefined : drop} />
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
        <div className="w-[46%] max-w-[170px]"><p className="mb-1 text-center text-xs text-muted-foreground">Yours</p><PipeBoard board={puzzle} tiles={mine.tiles} dropped={[]} small /></div>
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
  generate: () => ({ type: "balltrack", cols: BT_COLS, rows: BT_ROWS, tiles: "0".repeat(BT_COLS * BT_ROWS), buckets: [1, 0, 3, 2, 5, 4, 7, 6], blocks: [18, 29, 43, 52], pairs: [[0, 3], [1, 2]], gates: [{ cell: 16, colour: 0 }, { cell: 47, colour: 7 }] }) satisfies BallTrackPuzzleData,
  check: (answer, puzzle) => puzzle.type === "balltrack" && btReplay(puzzle, btDecode(answer)).home === BT_COLS,
  revealHeading: "Ball Track",
  IntroExample,
  Stage,
  Reveal,
};