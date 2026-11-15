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
import { scanStandard } from "@/lib/duel/standard/attention";
import { playEagleTakeoff } from "./eagleEyeArt";
import { eagleSprite } from "@/components/puzzles/attention/attentionArt";
import { RevealLegend, RevealStats, RevealTabs } from "@/components/puzzles/attention/RevealParts";
import { attnSound } from "@/components/puzzles/attention/attentionFx";
import { gameFx } from "@/lib/fx/kit";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

/** Compass order, so "adjacent" directions are simply the neighbours here. */
const DIRECTIONS: ArrowDir[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

type CellState = "plain" | "selected" | "target" | "wrong" | "missed";

export function CellBox({
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
      <EagleIcon dir={dir} gold={state === "selected" || state === "target"} size={size ? Math.round(size * 0.78) : undefined} />
    </Tag>
  );
}

/**
 * The Attention overhaul (15 Nov 2026): the eagle is a Blender render of the app's own outline (pewter, or gold once
 * marked), with the bald eagle's white head and tail and a gold beak, so its facing reads at grid size. `size` unset:
 * it fills its cell (78 %).
 */
function EagleIcon({ dir, gold = false, size }: { dir: ArrowDir; gold?: boolean; size?: number | undefined }) {
  return (
    <img
      src={eagleSprite(dir, gold)}
      alt=""
      draggable={false}
      aria-hidden="true"
      data-eye-dir={dir}
      className="eye-eagle eye-sprite shrink-0 select-none"
      style={size ? { width: size, height: size } : undefined}
    />
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
          <EagleIcon dir={EXAMPLE_TARGET} gold size={30} />
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
function TargetBadge({ stage, size = 46 }: { stage: SymbolScanStage; size?: number }) {
  // The Attention overhaul: the target chips are larger (56 px) so the facing reads before the grid does.
  const box = size >= 40 ? "eye-target-lg" : size >= 30 ? "h-12 w-12" : "h-9 w-9";
  const badge = (dir: ArrowDir) => (
    <div className={`eye-target flex ${box} items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary`}>
      <EagleIcon dir={dir} gold size={size} />
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

/** How long Submit waits after a grid appears (attention review fixes, 15 Nov 2026). */
export const SCAN_SUBMIT_HOLD_MS = 400;

/** Submit takes a grid only once it has been up SCAN_SUBMIT_HOLD_MS and has at least one mark. */
export function scanSubmitAllowed(frozen: boolean, marks: number, holding: boolean): boolean {
  return !frozen && !holding && marks > 0;
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
  // The Attention overhaul: all sixteen eagle sprites are fetched when the round starts, so a new grid never shows a
  // blank tile while a facing it hasn't drawn yet loads.
  useEffect(() => {
    for (const dir of DIRECTIONS) for (const gold of [false, true]) new Image().src = eagleSprite(dir, gold);
  }, []);

  useBeforePaint(() => {
    const el = stageRef.current;
    const top = topRef.current;
    const submit = submitRef.current;
    if (!el || !top || !submit) return;
    const read = () => {
      const availableHeight = el.clientHeight - top.offsetHeight - submit.offsetHeight - 20;
      // The Attention overhaul: no height floor, so the grid fits short phones without being cut off.
      setGridSide(Math.max(0, Math.floor(Math.min(availableHeight, el.clientWidth))));
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

  // Attention review fixes (15 Nov 2026, input only): Submit waits SCAN_SUBMIT_HOLD_MS after each grid appears, so
  // a double tap can't skip the next grid unseen, and needs at least one eagle marked.
  const [holding, setHolding] = useState(true);
  useEffect(() => {
    setHolding(true);
    const id = window.setTimeout(() => setHolding(false), SCAN_SUBMIT_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [stage]);

  // Desktop keys: Enter = Submit (this grid, then the next).
  useGameKeys((kind, key, event) => {
    if (!data || !current || key !== "Enter") return false;
    if (kind === "down" && !event.repeat && scanSubmitAllowed(frozen, (selections[stage] ?? []).length, holding)) advance(selections);
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

  /** The Attention overhaul: a grid submitted mid-round: its marked matching eagles fly off; a clean grid sparkles. */
  const gridCleared = (marked: number[]) => {
    const grid = gridRef.current;
    const area = stageRef.current;
    if (!grid || !area) return;
    const kids = Array.from(grid.children);
    const facing = matchesOf(current);
    const birds = current.cells.flatMap((dir, i) => (facing.includes(i) && marked.includes(i) && kids[i] ? [{ cell: kids[i]!, dir }] : []));
    if (birds.length > 0) {
      playEagleTakeoff(area, birds, true);
      attnSound("symscan.gridClear");
    }
    if (marked.length > 0 && marked.every((i) => facing.includes(i))) {
      attnSound("symscan.cleanGrid", { volume: 0.55 });
      gameFx("combo", area.querySelector("[data-eye-targets], .eye-target"), { count: 1, silent: true });
    }
  };

  const advance = (all: number[][]) => {
    if (stage < STAGE_COUNT - 1) gridCleared(all[stage] ?? []);
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
    // The Attention overhaul: the tapped eagle alone answers (a soft press; the gold ring is its marked state).
    gameFx("tap", gridRef.current?.children[index], { silent: true });
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
        onClick={() => scanSubmitAllowed(frozen, selected.length, holding) && advance(selections)}
        disabled={!scanSubmitAllowed(frozen, selected.length, holding)}
        data-game-controls="actions" data-attn-action="primary" className="attn-action tap-target mt-3 w-full shrink-0 rounded-xl font-display text-base font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
      >
        Submit
      </Button>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const [shown, setShown] = useState<number | null>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  return puzzle.type === "symscan" ? <EagleReveal puzzle={puzzle} myAnswer={myAnswer} shown={shown} setShown={setShown} revealRef={revealRef} /> : null;
}

function EagleReveal({
  puzzle,
  myAnswer,
  shown,
  setShown,
  revealRef,
}: {
  puzzle: SymbolScanPuzzleData;
  myAnswer: string | null | undefined;
  shown: number | null;
  setShown: (s: number) => void;
  revealRef: { current: HTMLDivElement | null };
}) {
  const parts = splitStages(myAnswer);
  const grids = puzzle.stages.map((stage, s) => {
    const targets = usesScanRev1(puzzle) ? matchesOf(stage) : (puzzle.targets?.[s] ?? matchesOf(stage));
    const selected = parseSelection(parts[s] ?? "");
    return { stage, targets, selected, result: gridResult(puzzle, s, selected, targets) };
  });
  // The Attention overhaul's reveal (15 Nov 2026): one grid at a time, large, a tab for each; the eagles you found ringed
  // gold, wrong taps red, the ones you missed dashed; the grid's numbers as tiles. The first grid with a slip opens first.
  const open = shown ?? Math.max(0, grids.findIndex((g) => !g.result.perfect));
  const grid = grids[open]!;
  const missed = Math.max(0, grid.result.targets - grid.result.found);
  // The Attention overhaul: the eagles you missed pulse once when their grid opens (never in the round itself).
  useEffect(() => {
    const cells = Array.from(revealRef.current?.querySelectorAll('[data-eye-state="missed"]') ?? []);
    if (cells.length === 0) return;
    attnSound("symscan.missed", { volume: 0.5 });
    cells.forEach((cell, i) => gameFx("nearMiss", cell, { inGame: false, silent: true, noHaptic: true, delayMs: Math.min(i, 8) * 40 }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={revealRef} className="eye-reveal attn-rv" data-attn-reveal="symscan">
      <RevealTabs
        label="Grids"
        value={open}
        onChange={(s) => {
          soundCue("symscan.revealGrid");
          setShown(s);
        }}
        options={grids.map((g, s) => ({ value: s, label: `Grid ${s + 1}`, tone: g.result.perfect ? "good" : "bad" }))}
      />
      <div className="flex items-center gap-2" data-eye-reveal-target="">
        <span className="text-sm font-semibold text-muted-foreground">{grid.stage.alsoTarget ? "Targets" : "Target"}</span>
        <EagleIcon dir={grid.stage.target} gold size={36} />
        {grid.stage.alsoTarget ? (
          <>
            <span className="text-sm font-semibold text-muted-foreground">or</span>
            <EagleIcon dir={grid.stage.alsoTarget} gold size={36} />
          </>
        ) : null}
      </div>
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
      <RevealLegend
        items={[
          { mark: "found", label: "Found" },
          { mark: "wrong", label: "Wrong tap" },
          { mark: "missed", label: "Missed" },
        ]}
      />
      <RevealStats
        game="symscan"
        items={[
          // A grid with none to find says so (4 Nov 2026: it read "0 / 0 found").
          { id: "found", label: "Found", value: grid.result.targets > 0 ? `${grid.result.found} of ${grid.result.targets}` : "None to find", tone: grid.result.perfect ? "good" : undefined },
          { id: "wrong", label: "Wrong taps", value: grid.result.wrong, tone: grid.result.wrong ? "bad" : undefined },
          { id: "missed", label: "Missed", value: missed, tone: missed ? "bad" : undefined },
        ]}
      />
      {/* The scoring standard (scanRev 4) scores clean grids from the round's history instead, so the count is not shown. */}
      {usesScanDepth(puzzle) && !scanStandard(puzzle) && scanCorrections(myAnswer) > 0 ? (
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
