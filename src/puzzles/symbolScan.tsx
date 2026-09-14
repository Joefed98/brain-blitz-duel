import { useEffect, useState } from "react";

import { pick, randInt, shuffled } from "@/lib/duel/random";
import {
  SYMSCAN_CELLS,
  SYMSCAN_COLS,
  SYMSCAN_MAX_TARGETS,
  SYMSCAN_MIN_TARGETS,
  type ArrowDir,
  type SymbolScanPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Compass order, so "adjacent" directions are simply the neighbours here. */
const DIRECTIONS: ArrowDir[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const ANGLE: Record<ArrowDir, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

/** One arrow shape, drawn inline and rotated — never a Unicode glyph. */
function Arrow({ dir, size = 24 }: { dir: ArrowDir; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <g
        transform={`rotate(${ANGLE[dir]} 12 12)`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="20" x2="12" y2="4.5" />
        <polyline points="6.5,10.5 12,4.5 17.5,10.5" />
      </g>
    </svg>
  );
}

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
  size: number;
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
            : "border-border bg-card text-muted-foreground";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, disabled, "aria-label": label } : {})}
      className={`flex items-center justify-center rounded-lg border ${style}`}
      style={{ width: size, height: size }}
    >
      <Arrow dir={dir} size={Math.round(size * 0.66)} />
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
      <p className="text-center text-sm text-muted-foreground">
        Find every arrow that matches the target.
      </p>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Target</span>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary">
          <Arrow dir={EXAMPLE_TARGET} size={30} />
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
      <p className="text-center text-xs text-muted-foreground">
        Tap each match, then hit Submit. Miss one and it's wrong.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  const key = puzzle.type === "symscan" ? puzzle.cells.join("") : "";
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    setSelected([]);
  }, [key]);

  if (puzzle.type !== "symscan") return null;

  const toggle = (index: number) => {
    if (locked) return;
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-5">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Target</span>
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-primary bg-primary/10 text-primary">
          <Arrow dir={puzzle.target} size={34} />
        </div>
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${SYMSCAN_COLS}, minmax(0, 1fr))` }}
      >
        {puzzle.cells.map((dir, index) => (
          <CellBox
            key={index}
            dir={dir}
            size={46}
            state={selected.includes(index) ? "selected" : "plain"}
            onClick={() => toggle(index)}
            disabled={locked}
            label={`Cell ${index + 1}`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => !locked && onSubmit([...selected].sort((a, b) => a - b).join(","))}
        disabled={locked || selected.length === 0}
        className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}

function parseSelection(answer: string): number[] {
  return answer
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "symscan") return null;
  const selected = parseSelection(myAnswer ?? "");
  const found = puzzle.targets.filter((t) => selected.includes(t)).length;

  return (
    <>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${SYMSCAN_COLS}, minmax(0, 1fr))` }}
      >
        {puzzle.cells.map((dir, index) => {
          const isTarget = puzzle.targets.includes(index);
          const isSelected = selected.includes(index);
          const state: CellState = isTarget
            ? isSelected
              ? "target"
              : "missed"
            : isSelected
              ? "wrong"
              : "plain";
          return <CellBox key={index} dir={dir} size={42} state={state} />;
        })}
      </div>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-4">
        <p className="font-mono text-lg font-bold text-primary">
          {puzzle.targets.length} targets · you found {found}
        </p>
      </div>
    </>
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

export function buildSymbolScan(): SymbolScanPuzzleData {
  const target = pick(DIRECTIONS);
  const count = randInt(SYMSCAN_MIN_TARGETS, SYMSCAN_MAX_TARGETS);
  const targets = shuffled(Array.from({ length: SYMSCAN_CELLS }, (_, i) => i))
    .slice(0, count)
    .sort((a, b) => a - b);
  const near = adjacentDirs(target);
  const far = nonAdjacentDirs(target);
  const cells = Array.from({ length: SYMSCAN_CELLS }, (_, i) =>
    targets.includes(i) ? target : Math.random() < ADJACENT_SHARE ? pick(near) : pick(far),
  );
  return { type: "symscan", target, cells, targets };
}

export const symbolScanPuzzle: PuzzleDefinition = {
  key: "symscan",
  name: "Symbol Scan",
  category: "attention",
  timeLimitMs: 30_000,
  generate: buildSymbolScan,
  check: (answer, puzzle) => {
    if (puzzle.type !== "symscan") return false;
    const selected = new Set(parseSelection(answer));
    return selected.size === puzzle.targets.length && puzzle.targets.every((t) => selected.has(t));
  },
  IntroExample,
  Stage,
  Reveal,
};
