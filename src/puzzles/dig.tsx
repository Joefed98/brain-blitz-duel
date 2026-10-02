import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import {
  digDecode,
  digEncode,
  digInit,
  digReplay,
  digSettled,
  digStep,
  digWaterLeft,
  DIG_COLS,
  DIG_MAX_PER_STEP,
  DIG_ROWS,
  DIG_STEP_MS,
  DIG_STEPS,
  T_DRAIN,
  T_GAP,
  T_ROCK,
  T_SAND,
  type DigAction,
  type DigBoard,
  type DigState,
} from "@/lib/duel/dig";
import { DIG_TIME_MS, type DigPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GRID_STYLE: CSSProperties = { touchAction: "none", overscrollBehavior: "none", userSelect: "none", WebkitUserSelect: "none" };

function Grid({
  board,
  state,
  pointer,
  route,
  small = false,
}: {
  board: DigBoard;
  state: DigState;
  pointer?: ReturnType<typeof useGridPointer>;
  route?: ReadonlySet<number>;
  small?: boolean;
}) {
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      data-play-area
      className="grid h-full w-full"
      style={{
        ...GRID_STYLE,
        ...(pointer?.handlers.style ?? {}),
        gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${board.rows}, minmax(0, 1fr))`,
        gap: small ? 0 : 1,
      }}
    >
      {state.tiles.map((t, cell) => {
        const units = state.water[cell] ?? 0;
        let cls = "bg-background";
        if (t === T_ROCK) cls = "bg-muted";
        else if (t === T_SAND) cls = route?.has(cell) ? "bg-primary/60" : "bg-primary/30";
        else if (t === T_DRAIN) cls = "bg-reaction-blue/40 ring-1 ring-inset ring-reaction-blue";
        else if (t === T_GAP) cls = "bg-destructive/40";
        return (
          <div key={cell} className={`relative overflow-hidden ${small ? "" : "rounded-[2px]"} ${cls}`}>
            {units > 0 && (
              <span className="absolute inset-x-0 bottom-0 bg-reaction-blue" style={{ height: `${units * 25}%` }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 6×8 example: the pool's sand plug is dug once, water falls to the drain. */
const EXAMPLE: DigBoard = {
  cols: 6,
  rows: 8,
  tiles: "#....#" + "#....#" + "#....#" + "#s####" + "#.####" + "#....#" + "####.#" + "####D#",
  water: "000000" + "044440" + "044440" + "000000" + "000000" + "000000" + "000000" + "000000",
};
// Route: plug (col 1, row 3) → shaft → along row 5 → down col 4 → drain.
const EXAMPLE_TILES = EXAMPLE.tiles;

function IntroExample() {
  const [state, setState] = useState<DigState>(() => digInit(EXAMPLE));
  useEffect(() => {
    let s = digInit(EXAMPLE);
    const id = window.setInterval(() => {
      if (s.step >= 70 || digSettled(s)) {
        window.clearInterval(id);
        return;
      }
      s = digStep(EXAMPLE, s, s.step + 1 === 10 ? [19] : []);
      setState(s);
    }, DIG_STEP_MS);
    return () => window.clearInterval(id);
  }, []);
  void EXAMPLE_TILES;
  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: 96, height: 128 }}>
        <Grid board={EXAMPLE} state={state} small />
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        One dig through the gold sand, and the water runs down to the drain.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: DigPuzzleData | null = puzzle.type === "dig" ? puzzle : null;
  const board: DigBoard = data ?? EXAMPLE;
  const [state, setState] = useState<DigState>(() => digInit(board));
  const stateRef = useRef(state);
  const actions = useRef<DigAction[]>([]);
  const pending = useRef<number[]>([]);
  const submitted = useRef(false);
  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);

  useEffect(() => {
    if (!data) return;
    let s = digInit(data);
    stateRef.current = s;
    setState(s);
    actions.current = [];
    pending.current = [];
    submitted.current = false;
    let frame = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      acc += time - last;
      last = time;
      if (submitted.current || lockedRef.current) return;
      let changed = false;
      while (acc >= DIG_STEP_MS && s.step < DIG_STEPS && !digSettled(s)) {
        acc -= DIG_STEP_MS;
        const step = s.step + 1;
        const digs: number[] = [];
        while (pending.current.length && digs.length < DIG_MAX_PER_STEP) {
          const cell = pending.current.shift()!;
          if (s.tiles[cell] === T_SAND && !digs.includes(cell)) {
            digs.push(cell);
            actions.current.push({ step, cell });
          }
        }
        s = digStep(data, s, digs);
        changed = true;
      }
      if (acc > DIG_STEP_MS * 3) acc = DIG_STEP_MS * 3;
      if (changed) {
        stateRef.current = s;
        setState(s);
        draftRef.current?.(digEncode(actions.current));
      }
      if ((digSettled(s) || s.step >= DIG_STEPS) && !submitted.current) {
        submitted.current = true;
        if (s.collected >= s.full) playCorrect();
        submitRef.current(digEncode(actions.current));
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const pointer = useGridPointer({
    cols: DIG_COLS,
    rows: DIG_ROWS,
    onCell:
      data && !locked
        ? (cell) => {
            if (submitted.current) return;
            if (stateRef.current.tiles[cell] !== T_SAND || pending.current.includes(cell)) return;
            pending.current.push(cell);
            buzz(5);
          }
        : undefined,
  });

  if (!data) return null;
  const pct = Math.round((100 * state.collected) / Math.max(1, state.target));

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 py-1" style={{ overscrollBehavior: "none" }}>
      <p className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        drained <span className="text-primary">{state.collected}</span> / {state.target}
        {state.lost > 0 && (
          <>
            {" "}· lost <span className="text-destructive">{state.lost}</span>
          </>
        )}
      </p>
      <div className="h-1.5 w-full max-w-[343px] shrink-0 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-reaction-blue transition-[width]" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div style={{ width: `min(100cqw, calc(100cqh * ${DIG_COLS} / ${DIG_ROWS}))`, aspectRatio: `${DIG_COLS} / ${DIG_ROWS}` }}>
          <Grid board={data} state={state} pointer={pointer} />
        </div>
      </div>
      {dev && (
        <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
          dev · pool {digWaterLeft(state)} · collected {state.collected} · lost {state.lost} · step {state.step}
        </p>
      )}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "dig") return null;
  const mine = digReplay(puzzle, digDecode(myAnswer ?? "", puzzle.cols * puzzle.rows)).state;
  const start = digInit(puzzle);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Route</span>
          <div style={{ width: 96, height: 128 }}>
            <Grid board={puzzle} state={start} route={new Set(puzzle.route ?? [])} small />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <div style={{ width: 96, height: 128 }}>
            <Grid board={puzzle} state={mine} small />
          </div>
        </div>
      </div>
      <p className="font-mono text-base text-primary">
        {mine.collected} / {mine.pool} drained · {mine.lost} lost
      </p>
    </div>
  );
}

export const digPuzzle: PuzzleDefinition = {
  key: "dig",
  name: "Dig",
  category: "logic",
  timeLimitMs: DIG_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "dig", cols: EXAMPLE.cols, rows: EXAMPLE.rows, tiles: EXAMPLE.tiles, water: EXAMPLE.water }) satisfies DigPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "dig") return false;
    const s = digReplay(puzzle, digDecode(answer, puzzle.cols * puzzle.rows)).state;
    return s.collected >= s.full;
  },
  revealHeading: "Your dig",
  IntroExample,
  Stage,
  Reveal,
};
