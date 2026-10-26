import { registerFxPreview, soundCue } from "@/components/puzzles/speedFx";
import { Button } from "@/components/ui/button";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { prefersReducedMotion } from "@/lib/motion";
import { useContext, useEffect, useRef, useState } from "react";

import { StageProgress } from "@/components/puzzles/StageProgress";
import { GoalLineContext } from "@/components/duel/GameFrame";
import { pick, randInt, shuffled } from "@/lib/duel/random";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { STAGE_COUNT, joinStages, parseSelection, scanStageResult, splitStages } from "@/lib/duel/stagedRounds";
import {
  SYMSCAN_MAX_TARGETS,
  SYMSCAN_MIN_TARGETS,
  SYMSCAN_STAGE_COLS,
  SYMSCAN_TIME_MS,
  type ArrowDir,
  type SymbolScanPuzzleData,
  type SymbolScanStage,
} from "@/lib/duel/types";

import { scanRev1StageResult, scanStageMatches, usesScanRev1 } from "@/lib/duel/attentionRev";
import { SCAN_DEPTH_REV, SCAN_TOPUP_REV, scanCorrections, usesScanDepth } from "@/lib/duel/depth/eagleEye";
import { dealtTopupRev } from "@/lib/duel/depthTopup";
import { EagleArt as EagleIcon, playEagleTakeoff } from "./eagleEyeArt";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

/** Compass order, so "adjacent" directions are simply the neighbours here. */
const DIRECTIONS: ArrowDir[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

type CellState = "plain" | "selected" | "target" | "wrong" | "missed";

function CellBox({
  dir,
  state,
  size,
  onClick,
  disabled,
  label,
  index = 0,
  flown = false,
}: {
  dir: ArrowDir;
  state: CellState;
  size?: number;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  /** Seeds the cell's fixed cloud wisp (display only). */
  index?: number;
  /** The eagle has taken off (finish effect): its cell shows empty sky. */
  flown?: boolean;
}) {
  const style =
    state === "selected"
      ? "border-primary bg-primary/15 text-primary"
      : state === "target"
        ? "border-primary bg-primary/25 text-primary"
        : state === "wrong"
          ? "border-warn bg-warn/10 text-warn"
          : state === "missed"
            ? "border-warn border-dashed text-warn"
            : "border-border text-foreground";
  const Tag = onClick ? Button : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, disabled, "aria-label": label, "aria-pressed": state === "selected" } : {})}
      className={`eagle-cell eye-cell min-w-0 p-0 flex aspect-square w-full items-center justify-center rounded-lg border ${style}${flown ? " eye-flown" : ""}`}
      data-eye-state={state}
      style={{ ...(size ? { width: size, height: size } : {}), ...cloudStyle(index) }}
    >
      <EagleIcon dir={dir} size={size ? Math.round(size * 0.66) : 32} />
    </Tag>
  );
}

/** Fixed per-cell cloud wisp position (deterministic by index, never random). */
function cloudStyle(index: number): Record<string, string> {
  const h = (index * 2654435761) >>> 0;
  return { "--eye-cloud-x": `${18 + (h % 64)}%`, "--eye-cloud-y": `${14 + ((h >>> 8) % 70)}%` };
}

/** Fixed intro grid — arrows in cells 2 and 7 (1-based) match the target. */
const EXAMPLE_TARGET: ArrowDir = "N";
const EXAMPLE_CELLS: ArrowDir[] = ["NE", "N", "E", "SE", "NW", "SW", "N", "W", "NE"];
const EXAMPLE_MATCHES = [1, 6];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Target</span>
        <div className="eye-target flex h-12 w-12 items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary">
          <EagleIcon dir={EXAMPLE_TARGET} size={30} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {EXAMPLE_CELLS.map((dir, index) => (
          <CellBox
            key={index}
            index={index}
            dir={dir}
            size={40}
            state={EXAMPLE_MATCHES.includes(index) ? "selected" : "plain"}
          />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Grid 3 has two targets: tap eagles facing either.</p>
    </div>
  );
}

/** Eagles facing the target (or, on scanRev 1's grid 3, either target). */
function matchesOf(stage: SymbolScanStage): number[] {
  return scanStageMatches(stage);
}

/** The target eagle(s) for a grid: one, or two side by side with "or" on scanRev 1's grid 3. */
function TargetBadge({ stage, size = 30 }: { stage: SymbolScanStage; size?: number }) {
  const box = size >= 30 ? "h-12 w-12" : "h-9 w-9";
  const badge = (dir: ArrowDir) => (
    <div className={`eye-target flex ${box} items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary`}>
      <EagleIcon dir={dir} size={size} />
    </div>
  );
  if (!stage.alsoTarget) return badge(stage.target);
  return (
    <div className="flex items-center gap-1.5" data-eye-targets="2">
      {badge(stage.target)}
      <span className="font-display text-xs font-bold uppercase tracking-wide text-primary">or</span>
      {badge(stage.alsoTarget)}
    </div>
  );
}

/** One grid's result: scanRev 1 weights on stamped rounds, the stored weights otherwise. */
function gridResult(puzzle: SymbolScanPuzzleData, s: number, selected: number[], targets: number[]) {
  return usesScanRev1(puzzle) ? scanRev1StageResult(s, selected, targets) : scanStageResult(s, selected, targets);
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "symscan" }: PuzzleStageProps) {
  const data = puzzle.type === "symscan" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "scanStage", () => 0);
  const [selections, setSelections] = useStageState<number[][]>(stateKey, "scanSel", () => [[], [], []]);
  const done = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridSide, setGridSide] = useState(280);
  const [flown, setFlown] = useState(false);
  const goalLine = useContext(GoalLineContext);
  const takeoff = useRef<() => void>(() => undefined);
  useEffect(() => registerFxPreview("symscan", () => takeoff.current()), []);

  useBeforePaint(() => {
    const el = stageRef.current;
    const top = topRef.current;
    const submit = submitRef.current;
    if (!el || !top || !submit) return;
    const read = () => {
      const availableHeight = el.clientHeight - top.offsetHeight - submit.offsetHeight - 20;
      setGridSide(Math.max(0, Math.floor(Math.min(Math.max(availableHeight, 332), el.clientWidth))));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // scanRev 2: taps taken back (marked, then unmarked) ride as a fourth part; they only cut the score above the old 150.
  const [corrections, setCorrections] = useStageState<number>(stateKey, "scanUndo", () => 0);
  const depth = data !== null && usesScanDepth(data);
  const encode = (all: number[][], undo: number) => {
    const grids = joinStages(all.map((sel) => [...sel].sort((a, b) => a - b).join(",")));
    return depth ? `${grids}|${undo}` : grids;
  };
  const draft = encode(selections, corrections);
  useEffect(() => {
    onDraftAnswer?.(draft);
  }, [draft, onDraftAnswer]);

  const current = data?.stages[Math.min(stage, STAGE_COUNT - 1)];

  // Desktop keys: Enter = Submit (this grid, then the next).
  useGameKeys((kind, key, event) => {
    if (!data || !current || key !== "Enter") return false;
    if (kind === "down" && !event.repeat && !frozen) advance(selections);
    return true;
  });

  if (!data || !current) return null;
  const frozen = locked || done.current;
  // Polish batch S: on a live round the goal line shows "Stage n of 3", so the label drops its own count
  // and the row carries a live count of the eagles marked instead (display only).
  const framed = goalLine !== null;
  const selected = selections[stage] ?? [];

  /** Finish effect: the eagles facing the target take off (display only, never awaited). */
  takeoff.current = () => {
    const grid = gridRef.current;
    const area = stageRef.current;
    if (!grid || !area) return;
    const kids = Array.from(grid.children);
    const facing = matchesOf(current);
    const birds = current.cells.flatMap((dir, i) => (facing.includes(i) && kids[i] ? [{ cell: kids[i]!, dir }] : []));
    playEagleTakeoff(area, birds);
    if (!prefersReducedMotion()) setFlown(true);
  };

  const advance = (all: number[][]) => {
    if (stage >= STAGE_COUNT - 1) {
      done.current = true;
      takeoff.current();
      onSubmit(encode(all, corrections));
      return;
    }
    setStage(stage + 1);
  };

  const toggle = (index: number) => {
    if (frozen) return;
    const nextSel = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index];
    soundCue(selected.includes(index) ? "symscan.unmark" : "symscan.mark");
    if (selected.includes(index)) setCorrections(corrections + 1);
    const all = selections.map((sel, i) => (i === stage ? nextSel : sel));
    setSelections(all);
  };

  return (
    <div ref={stageRef} data-stage-column="0" data-polish="symscan" className="flex min-h-0 flex-1 flex-col items-center">
      <div ref={topRef} className="flex w-full shrink-0 flex-col items-center gap-2">
        <StageProgress stage={stage} />
        <div className="flex items-center gap-3">
          <span data-eye-label="" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {framed ? "" : `Grid ${stage + 1} of 3 · `}{current.alsoTarget ? "targets" : "target"}
          </span>
          <TargetBadge stage={current} />
          {framed ? (
            <span data-eye-summary="" className="eye-summary font-mono text-xs tabular-nums text-muted-foreground">
              {selected.length} marked
            </span>
          ) : null}
        </div>
      </div>

      <div data-game-arena="board" className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden pt-2">
        <div
          ref={gridRef}
          className="eye-grid grid shrink-0 gap-1"
          style={{ width: gridSide, height: gridSide, gridTemplateColumns: `repeat(${current.cols}, minmax(0, 1fr))` }}
        >
          {current.cells.map((dir, index) => (
            <CellBox
              key={`${stage}-${index}`}
              index={index}
              dir={dir}
              flown={flown && (dir === current.target || dir === current.alsoTarget)}
              state={selected.includes(index) ? "selected" : "plain"}
              onClick={() => toggle(index)}
              disabled={frozen}
              label={`Cell ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <Button
        ref={submitRef}
        type="button"
        onClick={() => !frozen && advance(selections)}
        disabled={frozen}
        data-game-controls="actions" className="tap-target mt-3 w-full shrink-0 rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
      >
        Submit
      </Button>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const [shown, setShown] = useState<number | null>(null);
  if (puzzle.type !== "symscan") return null;
  const parts = splitStages(myAnswer);
  const grids = puzzle.stages.map((stage, s) => {
    const targets = usesScanRev1(puzzle) ? matchesOf(stage) : (puzzle.targets?.[s] ?? matchesOf(stage));
    const selected = parseSelection(parts[s] ?? "");
    return { stage, targets, selected, result: gridResult(puzzle, s, selected, targets) };
  });
  // One grid at a time, large enough to read; the first grid with a slip opens first.
  const open = shown ?? Math.max(0, grids.findIndex((g) => !g.result.perfect));
  const grid = grids[open]!;
  return (
    <div className="eye-reveal flex w-full flex-col items-center gap-2">
      <div
        className="eye-reveal-grid grid gap-1"
        style={{ gridTemplateColumns: `repeat(${grid.stage.cols}, minmax(0, 1fr))` }}
        aria-label={`Grid ${open + 1}`}
      >
        {grid.stage.cells.map((dir, index) => {
          const isTarget = grid.targets.includes(index);
          const isSelected = grid.selected.includes(index);
          const state: CellState = isTarget ? (isSelected ? "target" : "missed") : isSelected ? "wrong" : "plain";
          return <CellBox key={`${open}-${index}`} index={index} dir={dir} state={state} />;
        })}
      </div>
      <div className="flex w-full flex-col gap-1" role="tablist" aria-label="Grids">
        {grids.map(({ stage, result }, s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={s === open}
            onClick={() => {
              soundCue("symscan.revealGrid");
              setShown(s);
            }}
            className={`eye-reveal-row flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left ${
              s === open ? "border-primary/70 bg-card" : "border-transparent bg-card/60"
            }`}
          >
            <span className="flex shrink-0 items-center gap-1.5 text-primary">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Grid {s + 1}</span>
              <EagleIcon dir={stage.target} size={20} />
              {stage.alsoTarget ? <><span className="text-[10px] font-bold uppercase">or</span><EagleIcon dir={stage.alsoTarget} size={20} /></> : null}
            </span>
            <span className={`ml-auto font-mono text-base font-bold ${result.perfect ? "text-primary" : "text-warn"}`}>
              {result.found} / {result.targets} found{result.wrong ? ` · ${result.wrong} wrong` : ""} {result.perfect ? "✓" : "✗"}
            </span>
          </button>
        ))}
      </div>
      {usesScanDepth(puzzle) && scanCorrections(myAnswer) > 0 ? (
        <p data-eye-undone="" className="text-center font-mono text-xs text-muted-foreground">
          {scanCorrections(myAnswer)} {scanCorrections(myAnswer) === 1 ? "tap" : "taps"} taken back
        </p>
      ) : null}
    </div>
  );
}

function adjacentDirs(target: ArrowDir): ArrowDir[] {
  const i = DIRECTIONS.indexOf(target);
  return [DIRECTIONS[(i + 1) % 8]!, DIRECTIONS[(i + 7) % 8]!];
}

/** Six in ten non-target cells use one of the two neighbouring directions. */
const ADJACENT_SHARE = 0.6;

function nonAdjacentDirs(target: ArrowDir): ArrowDir[] {
  const adjacent = adjacentDirs(target);
  return DIRECTIONS.filter((d) => d !== target && !adjacent.includes(d));
}

function buildStage(cols: number): { stage: SymbolScanStage; targets: number[] } {
  const cellCount = cols * cols;
  const target = pick(DIRECTIONS);
  const count = randInt(SYMSCAN_MIN_TARGETS, SYMSCAN_MAX_TARGETS);
  const targets = shuffled(Array.from({ length: cellCount }, (_, i) => i))
    .slice(0, count)
    .sort((a, b) => a - b);
  const near = adjacentDirs(target);
  const far = nonAdjacentDirs(target);
  const cells = Array.from({ length: cellCount }, (_, i) =>
    targets.includes(i) ? target : Math.random() < ADJACENT_SHARE ? pick(near) : pick(far),
  );
  return { stage: { target, cols, cells }, targets };
}

/** scanRev 1 grid 3: eagles facing either of two directions at least 90° apart, SCAN_TWO_EACH of each. */
export const SCAN_TWO_EACH: [number, number] = [4, 6];

function buildTwoTargetStage(cols: number): { stage: SymbolScanStage; targets: number[] } {
  const cellCount = cols * cols;
  const target = pick(DIRECTIONS);
  const ti = DIRECTIONS.indexOf(target);
  // Never a neighbour: the two targets must read as clearly different facings.
  const alsoTarget = pick(DIRECTIONS.filter((_, i) => Math.min((i - ti + 8) % 8, (ti - i + 8) % 8) >= 2));
  const first = randInt(SCAN_TWO_EACH[0], SCAN_TWO_EACH[1]);
  const second = randInt(SCAN_TWO_EACH[0], SCAN_TWO_EACH[1]);
  const order = shuffled(Array.from({ length: cellCount }, (_, i) => i));
  const firstCells = order.slice(0, first);
  const secondCells = order.slice(first, first + second);
  const targets = [...firstCells, ...secondCells].sort((a, b) => a - b);
  const others = DIRECTIONS.filter((d) => d !== target && d !== alsoTarget);
  const near = others.filter((d) => adjacentDirs(target).includes(d) || adjacentDirs(alsoTarget).includes(d));
  const far = others.filter((d) => !near.includes(d));
  const cells = Array.from({ length: cellCount }, (_, i) =>
    firstCells.includes(i) ? target : secondCells.includes(i) ? alsoTarget : far.length === 0 || Math.random() < ADJACENT_SHARE ? pick(near) : pick(far),
  );
  return { stage: { target, alsoTarget, cols, cells }, targets };
}

export function buildSymbolScan(): SymbolScanPuzzleData {
  // scanRev 1 (14 Oct 2026): the third grid has two target directions.
  const built = SYMSCAN_STAGE_COLS.map((cols, i) => (i === SYMSCAN_STAGE_COLS.length - 1 ? buildTwoTargetStage(cols) : buildStage(cols)));
  // scanRev 2 (25 Oct 2026, depth/eagleEye.ts): the same grids, scored to {max}; the answer adds the taps taken back.
  return { type: "symscan", stages: built.map((b) => b.stage), targets: built.map((b) => b.targets), scanRev: dealtTopupRev(SCAN_TOPUP_REV, SCAN_DEPTH_REV) };
}

export const symbolScanPuzzle: PuzzleDefinition = {
  key: "symscan",
  name: gameDisplayName("symscan"),
  category: "attention",
  timeLimitMs: SYMSCAN_TIME_MS,
  generate: buildSymbolScan,
  check: (answer, puzzle) => {
    if (puzzle.type !== "symscan") return false;
    const parts = splitStages(answer);
    return puzzle.stages.every((stage, i) =>
      gridResult(puzzle, i, parseSelection(parts[i] ?? ""), usesScanRev1(puzzle) ? matchesOf(stage) : (puzzle.targets?.[i] ?? matchesOf(stage))).perfect,
    );
  },
  IntroExample,
  Stage,
  Reveal,
};
