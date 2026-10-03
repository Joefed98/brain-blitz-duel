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

function PipeBoard({ board, tiles, dropped, active, onRotate, onDrop, small = false }: {
  board: BtBoard;
  tiles: string;
  dropped: readonly number[];
  active?: { ball: number; row: number; column: number } | null;
  onRotate?: ((cell: number) => void) | undefined;
  onDrop?: ((ball: number) => void) | undefined;
  small?: boolean;
}) {
  const pipe = ["│", "╲", "╱"];
  const activeBall = active?.ball;
  return (
    <div className="relative w-full select-none" data-play-area>
      <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: board.cols }, (_, ball) => (
          <Button key={ball} type="button" variant="ghost" aria-label={`Drop ${["red", "blue", "green", "purple", "pink", "orange", "brown", "yellow"][ball] ?? `ball ${ball + 1}`}`} disabled={!onDrop || dropped.includes(ball) || activeBall !== undefined} onClick={() => onDrop?.(ball)} className={`${small ? "h-6" : "h-[44px]"} min-w-0 rounded-none p-0 disabled:opacity-30`}>
            {!dropped.includes(ball) && activeBall !== ball && <span className={`block rounded-full border border-foreground/30 ${small ? "size-4" : "size-7"}`} style={{ backgroundColor: BALL_COLOURS[ball % 8] }} />}
          </Button>
        ))}
      </div>
      <div className="grid w-full gap-px" style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: board.rows * board.cols }, (_, cell) => (
          <Button key={cell} type="button" variant="outline" disabled={!onRotate} aria-label={`Rotate pipe row ${Math.floor(cell / board.cols) + 1}, column ${cell % board.cols + 1}`} onClick={() => onRotate?.(cell)} className="min-w-0 rounded-sm border-border bg-card p-0 text-foreground disabled:opacity-100" style={{ aspectRatio: "1 / 1" }}>
            <span className={`${small ? "text-sm" : "text-[27px]"} font-medium leading-none`}>{pipe[Number(tiles[cell]) % 3] ?? "│"}</span>
          </Button>
        ))}
      </div>
      <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}>
        {board.buckets.map((colour, column) => (
          <div key={column} className={`flex items-center justify-center ${small ? "h-6" : "h-[44px]"}`} aria-label={`Bucket ${column + 1}`}>
            <span className={`flex items-center justify-center rounded-b-md border-x-2 border-b-2 ${small ? "h-4 w-5" : "h-7 w-9"}`} style={{ borderColor: BALL_COLOURS[colour % 8] }}>
              <span className={`${small ? "size-1.5" : "size-2"} rounded-full`} style={{ backgroundColor: BALL_COLOURS[colour % 8] }} />
            </span>
          </div>
        ))}
      </div>
      {active && <span aria-hidden="true" className={`pointer-events-none absolute z-10 rounded-full border border-foreground/40 shadow-md ${small ? "size-4" : "size-7"}`} style={{ left: `${(active.column + .5) * 100 / board.cols}%`, top: `${(active.row + 1.5) * 100 / (board.rows + 2)}%`, transform: "translate(-50%, -50%)", backgroundColor: BALL_COLOURS[active.ball % 8], transition: `left ${STEP_MS}ms linear, top ${STEP_MS}ms linear` }} />}
    </div>
  );
}

const EXAMPLE: BtBoard = { cols: 3, rows: 3, tiles: "100000000", buckets: [2, 0, 1] };

function IntroExample() {
  const [row, setRow] = useState(-1);
  useEffect(() => {
    const timer = setInterval(() => setRow((current) => current >= 3 ? -1 : current + 1), 450);
    return () => clearInterval(timer);
  }, []);
  const column = row < 0 ? 0 : 1;
  return <div className="mx-auto w-[150px]"><PipeBoard board={EXAMPLE} tiles={EXAMPLE.tiles} dropped={[1, 2]} active={row >= 0 && row <= 3 ? { ball: 0, row, column } : null} small /></div>;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data = puzzle.type === "balltrack" ? puzzle : null;
  const [events, setEvents] = useStageState<BtEvent[]>(stateKey ?? "balltrack", "ballTrackEvents", () => []);
  const [anim, setAnim] = useState<{ ball: number; path: number[]; bucket: number | null; step: number } | null>(null);
  const reduced = usePrefersReducedMotion();
  const submitted = useRef(false);
  const encoded = btEncode(events);
  const replay = data ? btReplay(data, events) : null;

  useEffect(() => { onDraftAnswer?.(encoded); }, [encoded, onDraftAnswer]);
  useEffect(() => {
    if (!anim) return;
    const delay = reduced ? 50 : STEP_MS;
    const timer = setTimeout(() => {
      if (anim.step < anim.path.length + 1) setAnim({ ...anim, step: anim.step + 1 });
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
    const run = btRun(data, replay.tiles, ball);
    setAnim({ ball, path: run.path, bucket: run.bucket, step: -1 });
    setEvents((current) => [...current, { k: "d", ball }]);
  };
  let active: { ball: number; row: number; column: number } | null = null;
  if (anim) {
    const row = anim.step;
    const column = row < 0 ? anim.ball : row >= anim.path.length ? anim.bucket ?? (anim.path.at(-1) ?? anim.ball) % data.cols + (replay.tiles[anim.path.at(-1) ?? 0] === "1" ? 1 : -1) : anim.path[row]! % data.cols;
    active = { ball: anim.ball, row, column };
  }
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-1 pt-1">
      <p className="shrink-0 font-mono text-xs text-muted-foreground">{replay.home} / 8 home · {replay.dropped.length} / 8 dropped · {replay.rotations} turns</p>
      <div className="w-full max-w-[540px]">
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
  generate: () => ({ type: "balltrack", cols: BT_COLS, rows: BT_ROWS, tiles: "0".repeat(BT_COLS * BT_ROWS), buckets: [1, 2, 3, 4, 5, 6, 7, 0] }) satisfies BallTrackPuzzleData,
  check: (answer, puzzle) => puzzle.type === "balltrack" && btReplay(puzzle, btDecode(answer)).home === BT_COLS,
  revealHeading: "Ball Track",
  IntroExample,
  Stage,
  Reveal,
};