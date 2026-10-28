import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import {
  digCleanCollected,
  digDecode,
  digEncode,
  digInit,
  digLine,
  digReplay,
  digSettled,
  digStep,
  digWaterLeft,
  DIG_COLS,
  DIG_EVAP_STEPS,
  DIG_MAX_PER_STEP,
  DIG_ROWS,
  DIG_STEP_MS,
  DIG_STEPS,
  T_ACID,
  T_DRAIN,
  T_GAP,
  T_LAVA,
  T_ROCK,
  T_SAND,
  T_ACID_HIDDEN,
  T_EMPTY,
  T_FALLING,
  T_PACKED,
  type DigAction,
  type DigBoard,
  type DigState,
} from "@/lib/duel/dig";
import { DIG_TIME_MS, type DigPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GRID_STYLE: CSSProperties = { touchAction: "none", overscrollBehavior: "none", userSelect: "none", WebkitUserSelect: "none" };

function tileClass(t: string | undefined, onRoute: boolean): string {
  if (t === T_ROCK) return "bg-muted";
  if (t === T_PACKED) return "bg-primary/80 ring-1 ring-inset ring-background/60";
  if (t === T_FALLING) return "bg-primary/45";
  if (t === T_SAND || t === T_ACID_HIDDEN) return onRoute ? "bg-primary/60" : "bg-primary/30";
  if (t === T_DRAIN) return "bg-reaction-blue/40 ring-1 ring-inset ring-reaction-blue";
  if (t === T_GAP) return "bg-destructive/40";
  if (t === T_LAVA) return "bg-ball-red/80";
  if (t === T_ACID) return "bg-ball-green/50";
  return "bg-background";
}

export function Grid({
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
        const settled = state.settled[cell] ?? 0;
        const toxic = state.tox[cell] === 1;
        const evaporating = (state.age[cell] ?? -1) >= DIG_EVAP_STEPS;
        const below = cell + board.cols;
        const loose = t === T_SAND && below < state.tiles.length && state.tiles[below] === T_EMPTY && (state.settled[below] ?? 0) === 0;
        return (
          <div key={cell} className={`relative overflow-hidden ${small ? "" : "rounded-[2px]"} ${tileClass(t, route?.has(cell) ?? false)}`}>
            {loose && (
              <span
                className="absolute inset-x-0 bottom-0 h-1/3 opacity-70"
                style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--background) 0 1px, transparent 1px 3px)" }}
              />
            )}
            {settled > 0 && (
              <span className="absolute inset-x-0 bottom-0 bg-muted-foreground/40" style={{ height: `${Math.min(4, settled) * 25}%` }} />
            )}
            {units > 0 && (
              <span
                className={`absolute inset-x-0 bottom-0 ${toxic ? "bg-ball-green" : "bg-reaction-blue"} ${evaporating ? "animate-pulse opacity-60" : ""}`}
                style={{ height: `${units * 25}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 6×8 example: dig from the pool down. Digging the lower cell first drops the plug into the channel, where it packs. */
const EXAMPLE: DigBoard = {
  cols: 6,
  rows: 8,
  tiles: "#....#" + "#....#" + "#....#" + "##s###" + "##ss##" + "###s##" + "###D##" + "######",
  water: "000000" + "044440" + "044440" + "000000" + "000000" + "000000" + "000000" + "000000",
  budget: 4,
  minDigs: 4,
  targets: [26],
};
const EXAMPLE_DIGS = [20, 26, 27, 33];

function IntroExample() {
  const [state, setState] = useState<DigState>(() => digInit(EXAMPLE));
  useEffect(() => {
    let s = digInit(EXAMPLE);
    const id = window.setInterval(() => {
      if (s.step >= 90 || digSettled(s)) {
        window.clearInterval(id);
        return;
      }
      const n = s.step + 1;
      s = digStep(EXAMPLE, s, n >= 8 && n <= 11 ? [EXAMPLE_DIGS[n - 8]!] : []);
      setState(s);
    }, DIG_STEP_MS);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Digs left: {EXAMPLE.budget - state.dug}/{EXAMPLE.budget}</p>
      <div style={{ width: 96, height: 128 }}>
        <Grid board={EXAMPLE} state={state} small />
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        Dig the lower cell first and the sand above drops into the channel and packs hard. Dig from the pool down instead.
      </p>
    </div>
  );
}

function Legend({ state }: { state: DigState }) {
  const item = (cls: string, label: string) => (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2.5 w-2.5 rounded-[2px] ${cls}`} />
      {label}
    </span>
  );
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {item("bg-primary/30", "sand")}
      {item("bg-primary/80", "packed")}
      {item("bg-muted", "rock")}
      {item("bg-ball-green/50", "acid")}
      {item("bg-ball-red/80", "lava")}
      {state.drains.map((_, k) => (
        <span key={k} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-reaction-blue/40 ring-1 ring-inset ring-reaction-blue" />
          drain{state.drains.length > 1 ? ` ${k + 1}` : ""}{" "}
          <span className={state.drained[k]! >= state.targets[k]! ? "text-primary" : "text-foreground"}>
            {state.drained[k]}/{state.targets[k]}
          </span>
        </span>
      ))}
    </div>
  );
}

function boardOf(data: DigPuzzleData): DigBoard {
  return { cols: data.cols, rows: data.rows, tiles: data.tiles, water: data.water, budget: data.budget, minDigs: data.minDigs, targets: data.targets };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: DigPuzzleData | null = puzzle.type === "dig" ? puzzle : null;
  const board: DigBoard = data ? boardOf(data) : EXAMPLE;
  const [state, setState] = useState<DigState>(() => digInit(board));
  const stateRef = useRef(state);
  const actions = useRef<DigAction[]>([]);
  const pending = useRef<number[]>([]);
  const lastCell = useRef<number | null>(null);
  const submitted = useRef(false);
  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;
  const [dev, setDev] = useState(false);
  const [, setPendingTick] = useState(0);
  useEffect(() => setDev(devDiagnosticsOn()), []);

  useEffect(() => {
    if (!data) return;
    const b = boardOf(data);
    let s = digInit(b);
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
        while (pending.current.length && digs.length < DIG_MAX_PER_STEP && s.dug + digs.length < s.budget) {
          const cell = pending.current.shift()!;
          if (s.tiles[cell] === T_SAND && !digs.includes(cell)) {
            digs.push(cell);
            actions.current.push({ step, cell });
          }
        }
        if (s.dug + digs.length >= s.budget) pending.current = [];
        s = digStep(b, s, digs);
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
        if (s.completeStep) playCorrect();
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
            const prev = lastCell.current;
            lastCell.current = cell;
            const cells = prev === null || prev === cell ? [cell] : digLine(prev, cell, DIG_COLS);
            let added = false;
            for (const c of cells) {
              const s = stateRef.current;
              if (s.dug + pending.current.length >= s.budget) break;
              if (s.tiles[c] !== T_SAND || pending.current.includes(c)) continue;
              pending.current.push(c);
              added = true;
            }
            if (added) {
              buzz(5);
              setPendingTick((n) => n + 1);
            }
          }
        : undefined,
    onRelease: () => {
      lastCell.current = null;
    },
  });

  if (!data) return null;
  const left = Math.max(0, state.budget - state.dug - pending.current.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 py-1" style={{ overscrollBehavior: "none" }}>
      <p className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Digs left: <span className={left ? "text-primary" : "text-destructive"}>{left}</span>/{state.budget}
      </p>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div style={{ width: `min(100cqw, calc(100cqh * ${DIG_COLS} / ${DIG_ROWS}))`, aspectRatio: `${DIG_COLS} / ${DIG_ROWS}` }}>
          <Grid board={board} state={state} pointer={pointer} />
        </div>
      </div>
      <Legend state={state} />
      {dev && (
        <p className="shrink-0 text-center font-mono text-[10px] leading-tight text-muted-foreground">
          dev · pool {digWaterLeft(state)} · clean {state.drained.join("/")} · toxic {state.toxicIn} · lost {state.lost} · settled{" "}
          {state.settledUnits}
          {state.settledLog.length ? ` (${state.settledLog.slice(-4).map(([c, st]) => `${c}@${st}`).join(" ")})` : ""} · digs {state.dug}/
          {state.budget}/planned {data.minDigs} · fallen {state.sandFallen} · step {state.step}
        </p>
      )}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "dig") return null;
  const board = boardOf(puzzle);
  const mine = digReplay(board, digDecode(myAnswer ?? "", puzzle.cols * puzzle.rows)).state;
  const start = digInit(board);
  const total = mine.targets.reduce((a, b) => a + b, 0);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Route</span>
          <div style={{ width: 96, height: 128 }}>
            <Grid board={board} state={start} route={new Set(puzzle.route ?? [])} small />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <div style={{ width: 96, height: 128 }}>
            <Grid board={board} state={mine} small />
          </div>
        </div>
      </div>
      <p className="font-mono text-base text-primary">
        {digCleanCollected(mine)} / {total} clean · {mine.dug} digs (planned {puzzle.minDigs})
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
    ({
      type: "dig",
      cols: EXAMPLE.cols,
      rows: EXAMPLE.rows,
      tiles: EXAMPLE.tiles,
      water: EXAMPLE.water,
      budget: EXAMPLE.budget,
      minDigs: EXAMPLE.minDigs,
      targets: EXAMPLE.targets,
      pool: 32,
      hazards: [28],
      tier: "standard",
    }) satisfies DigPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "dig") return false;
    return digReplay(boardOf(puzzle), digDecode(answer, puzzle.cols * puzzle.rows)).state.completeStep > 0;
  },
  revealHeading: "Your dig",
  IntroExample,
  Stage,
  Reveal,
};
