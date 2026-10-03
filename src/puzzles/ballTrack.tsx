import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/components/puzzles/GridDrag";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { btDecode, btEncode, btReplay, btRun, BT_COLS, BT_ROWS, type BtBoard, type BtEvent } from "@/lib/duel/ballTrack";
import { useStageState } from "@/lib/duel/stageState";
import { BALLTRACK_TIME_MS, type BallTrackPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const BALL_COLOURS = ["var(--color-ball-red)", "var(--color-ball-blue)", "var(--color-ball-green)", "var(--color-ball-purple)", "var(--color-ball-pink)", "var(--color-ball-orange)", "var(--color-ball-brown)", "var(--color-ball-yellow)"];
const STEP_MS = 130;
const BALL_NAMES = ["red", "blue", "green", "purple", "pink", "orange", "brown", "yellow"];

function Tube({ orientation, small }: { orientation: number; small: boolean }) {
  const line = orientation === 1 ? [0, 0, 100, 100] : orientation === 2 ? [100, 0, 0, 100] : [50, -4, 50, 104];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full overflow-hidden">
      <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-foreground)" strokeOpacity=".28" strokeWidth={small ? 23 : 27} strokeLinecap="butt" />
      <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-card)" strokeWidth={small ? 17 : 21} strokeLinecap="butt" />
      <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-foreground)" strokeOpacity=".16" strokeWidth={small ? 4 : 5} strokeLinecap="butt" transform="translate(4 4)" />
      <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="var(--color-foreground)" strokeOpacity=".6" strokeWidth={small ? 2 : 2.5} strokeLinecap="butt" transform="translate(-4 -4)" />
    </svg>
  );
}

function LinkMarks({ pairs, small }: { pairs: readonly [number, number][]; small: boolean }) {
  return pairs.map(([a, b]) => {
    const left = (Math.min(a, b) + .5) * 12.5;
    const right = (Math.max(a, b) + .5) * 12.5;
    return <span key={`${a}-${b}`} aria-hidden="true" className="pointer-events-none absolute top-0 z-10 border-t border-dashed border-primary" style={{ left: `${left}%`, width: `${right - left}%`, height: small ? 4 : 7 }}><span className="absolute left-1/2 top-[-6px] -translate-x-1/2 bg-background px-0.5 text-[9px] leading-none text-primary">↔</span></span>;
  });
}

function PipeBoard({ board, tiles, dropped, active, onRotate, onDrop, small = false }: {
  board: BtBoard;
  tiles: string;
  dropped: readonly number[];
  active?: readonly { ball: number; row: number; column: number }[];
  onRotate?: ((cell: number) => void) | undefined;
  onDrop?: ((ball: number) => void) | undefined;
  small?: boolean;
}) {
  const blocks = new Set(board.blocks ?? []);
  const gateMap = new Map((board.gates ?? []).map((gate) => [gate.cell, gate.colour]));
  const activeBalls = new Set(active?.map((item) => item.ball) ?? []);
  return (
    <div className="relative w-full select-none" data-play-area>
      <div className={`relative grid w-full ${small ? "pt-1" : "pt-2"}`} style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        <LinkMarks pairs={board.pairs ?? []} small={small} />
        {Array.from({ length: board.cols }, (_, ball) => (
          <Button key={ball} type="button" variant="ghost" aria-label={`Drop ${BALL_NAMES[ball] ?? `ball ${ball + 1}`}`} disabled={!onDrop || dropped.includes(ball) || activeBalls.size > 0} onClick={() => onDrop?.(ball)} className={`${small ? "h-5" : "h-7"} min-w-0 rounded-none p-0 disabled:opacity-30`}>
            {!dropped.includes(ball) && !activeBalls.has(ball) && <span className={`${small ? "size-2.5" : "w-[55%] max-w-6"} block aspect-square rounded-full border border-foreground/30 shadow-sm`} style={{ backgroundColor: BALL_COLOURS[ball % 8] }} />}
          </Button>
        ))}
      </div>
      <div className="grid w-full gap-px" style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: board.rows * board.cols }, (_, cell) => {
          const blocked = blocks.has(cell);
          const gate = gateMap.get(cell);
          return (
            <Button key={cell} type="button" variant="outline" disabled={!onRotate || blocked} aria-label={blocked ? `Blocked tile row ${Math.floor(cell / board.cols) + 1}, column ${cell % board.cols + 1}` : `Rotate pipe row ${Math.floor(cell / board.cols) + 1}, column ${cell % board.cols + 1}`} onClick={() => onRotate?.(cell)} className={`relative h-auto w-full min-w-0 overflow-hidden rounded-none border-border p-0 disabled:opacity-100 ${blocked ? "bg-foreground/80" : "bg-card"}`} style={{ aspectRatio: "1 / 1" }}>
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
      {active?.map((item) => <span key={item.ball} aria-hidden="true" className={`${small ? "size-2.5" : "w-[6.875%] max-w-6"} pointer-events-none absolute z-20 aspect-square rounded-full border border-foreground/40 shadow-md`} style={{ left: `${(item.column + .5) * 100 / board.cols}%`, top: item.row < 0 ? (small ? "14px" : "20px") : item.row >= board.rows ? `calc(100% - ${small ? 10 : 14}px)` : `calc(${small ? 24 : 36}px + (100% - ${small ? 44 : 64}px) * ${(item.row + .5) / board.rows})`, transform: "translate(-50%, -50%)", backgroundColor: BALL_COLOURS[item.ball % 8], transition: `left ${STEP_MS}ms linear, top ${STEP_MS}ms linear` }} />)}
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
  return <div className="mx-auto w-[150px]"><PipeBoard board={EXAMPLE} tiles={EXAMPLE.tiles} dropped={[1, 2]} active={row >= 0 && row <= 3 ? [{ ball: 0, row, column }] : []} small /></div>;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data = puzzle.type === "balltrack" ? puzzle : null;
  const [events, setEvents] = useStageState<BtEvent[]>(stateKey ?? "balltrack", "ballTrackEvents", () => []);
  const [anim, setAnim] = useState<{ runs: { ball: number; path: number[]; bucket: number | null }[]; step: number } | null>(null);
  const reduced = usePrefersReducedMotion();
  const submitted = useRef(false);
  const encoded = btEncode(events);
  const replay = data ? btReplay(data, events) : null;

  useEffect(() => { onDraftAnswer?.(encoded); }, [encoded, onDraftAnswer]);
  useEffect(() => {
    if (!anim) return;
    const delay = reduced ? 50 : STEP_MS;
    const timer = setTimeout(() => {
      if (anim.step < Math.max(...anim.runs.map((run) => run.path.length))) setAnim({ ...anim, step: anim.step + 1 });
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
  const active = anim?.runs.map((run) => {
    const row = anim.step;
    const lastCell = run.path.at(-1) ?? run.ball;
    const column = row < 0 ? run.ball : row >= run.path.length ? run.bucket ?? lastCell % data.cols + (replay.tiles[lastCell] === "1" ? 1 : replay.tiles[lastCell] === "2" ? -1 : 0) : run.path[row]! % data.cols;
    return { ball: run.ball, row: row >= run.path.length && run.bucket === null ? run.path.length - 1 : row, column };
  }) ?? [];
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-1 pt-1">
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
  generate: () => ({ type: "balltrack", cols: BT_COLS, rows: BT_ROWS, tiles: "0".repeat(BT_COLS * BT_ROWS), buckets: [1, 2, 3, 4, 5, 6, 7, 0], blocks: [9, 22, 43, 52], pairs: [[0, 3], [4, 7]], gates: [{ cell: 16, colour: 0 }, { cell: 47, colour: 7 }] }) satisfies BallTrackPuzzleData,
  check: (answer, puzzle) => puzzle.type === "balltrack" && btReplay(puzzle, btDecode(answer)).home === BT_COLS,
  revealHeading: "Ball Track",
  IntroExample,
  Stage,
  Reveal,
};