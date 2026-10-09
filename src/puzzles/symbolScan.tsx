import { EagleIcon } from "@/components/puzzles/refreshIcons";
import { Button } from "@/components/ui/button";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState } from "react";

import { StageProgress } from "@/components/puzzles/StageProgress";
import { pick, randInt, shuffled } from "@/lib/duel/random";
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

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

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
}: {
  dir: ArrowDir;
  state: CellState;
  size?: number;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
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
            : "border-border eagle-sky text-foreground";
  const Tag = onClick ? Button : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, disabled, "aria-label": label } : {})}
      className={`eagle-cell min-w-0 p-0 flex aspect-square w-full items-center justify-center rounded-lg border ${style}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <EagleIcon dir={dir} size={size ? Math.round(size * 0.66) : 32} />
    </Tag>
  );
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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary">
          <EagleIcon dir={EXAMPLE_TARGET} size={30} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {EXAMPLE_CELLS.map((dir, index) => (
          <CellBox
            key={index}
            dir={dir}
            size={40}
            state={EXAMPLE_MATCHES.includes(index) ? "selected" : "plain"}
          />
        ))}
      </div>
    </div>
  );
}

function matchesOf(stage: SymbolScanStage): number[] {
  return stage.cells.flatMap((dir, i) => (dir === stage.target ? [i] : []));
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "symscan" }: PuzzleStageProps) {
  const data = puzzle.type === "symscan" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "scanStage", () => 0);
  const [selections, setSelections] = useStageState<number[][]>(stateKey, "scanSel", () => [[], [], []]);
  const done = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [gridSide, setGridSide] = useState(280);

  useEffect(() => {
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

  const draft = joinStages(selections.map((sel) => [...sel].sort((a, b) => a - b).join(",")));
  useEffect(() => {
    onDraftAnswer?.(draft);
  }, [draft, onDraftAnswer]);

  const current = data?.stages[Math.min(stage, STAGE_COUNT - 1)];
  if (!data || !current) return null;
  const frozen = locked || done.current;
  const selected = selections[stage] ?? [];

  const advance = (all: number[][]) => {
    if (stage >= STAGE_COUNT - 1) {
      done.current = true;
      onSubmit(joinStages(all.map((sel) => [...sel].sort((a, b) => a - b).join(","))));
      return;
    }
    setStage(stage + 1);
  };

  const toggle = (index: number) => {
    if (frozen) return;
    const nextSel = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index];
    const all = selections.map((sel, i) => (i === stage ? nextSel : sel));
    setSelections(all);
  };

  return (
    <div ref={stageRef} data-stage-column="0" className="flex min-h-0 flex-1 flex-col items-center">
      <div ref={topRef} className="flex w-full shrink-0 flex-col items-center gap-2">
        <StageProgress stage={stage} />
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Grid {stage + 1} of 3 · target
          </span>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary">
            <EagleIcon dir={current.target} size={30} />
          </div>
        </div>
      </div>

      <div data-game-arena="board" className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden pt-2">
        <div
          className="grid shrink-0 gap-1"
          style={{ width: gridSide, height: gridSide, gridTemplateColumns: `repeat(${current.cols}, minmax(0, 1fr))` }}
        >
          {current.cells.map((dir, index) => (
            <CellBox
              key={`${stage}-${index}`}
              dir={dir}
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
  if (puzzle.type !== "symscan") return null;
  const parts = splitStages(myAnswer);
  return (
    <div className="flex w-full flex-col items-center gap-4">
      {puzzle.stages.map((stage, s) => {
        const targets = puzzle.targets?.[s] ?? matchesOf(stage);
        const selected = parseSelection(parts[s] ?? "");
        const result = scanStageResult(s, selected, targets);
        const size = Math.floor(240 / stage.cols);
        return (
          <div key={s} className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-3 py-3">
            <div className="flex items-center gap-2 text-primary">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Grid {s + 1}</span>
              <EagleIcon dir={stage.target} size={20} />
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${stage.cols}, minmax(0, 1fr))` }}>
              {stage.cells.map((dir, index) => {
                const isTarget = targets.includes(index);
                const isSelected = selected.includes(index);
                const state: CellState = isTarget ? (isSelected ? "target" : "missed") : isSelected ? "wrong" : "plain";
                return <CellBox key={index} dir={dir} size={size} state={state} />;
              })}
            </div>
            <p className={`font-mono text-base font-bold ${result.perfect ? "text-primary" : "text-warn"}`}>
              {result.found} / {result.targets} found{result.wrong ? ` · ${result.wrong} wrong` : ""} {result.perfect ? "✓" : "✗"}
            </p>
          </div>
        );
      })}
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

export function buildSymbolScan(): SymbolScanPuzzleData {
  const built = SYMSCAN_STAGE_COLS.map((cols) => buildStage(cols));
  return { type: "symscan", stages: built.map((b) => b.stage), targets: built.map((b) => b.targets) };
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
      scanStageResult(i, parseSelection(parts[i] ?? ""), puzzle.targets?.[i] ?? matchesOf(stage)).perfect,
    );
  },
  IntroExample,
  Stage,
  Reveal,
};
