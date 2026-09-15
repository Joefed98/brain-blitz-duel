import { useEffect, useMemo, useRef, useState } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import {
  encodePatternCell,
  parsePatternCell,
  PATTERN_COLOURS,
  PATTERN_COUNTS,
  PATTERN_ROTATIONS,
  PATTERN_SHAPES,
  patternAttributeLabel,
  patternMistakes,
  buildPatternCompletion,
  checkPatternAnswer,
} from "@/lib/duel/pattern";
import {
  PATCOMP_TIME_MS,
  type PatternAttribute,
  type PatternCell,
  type PatternPuzzleData,
  type PatternRotation,
  type PatternShape,
  type StroopColour,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/* -------------------------------------------------------------------------- */
/*  Drawing                                                                   */
/* -------------------------------------------------------------------------- */

const STAR =
  "12,2 14.9,8.9 22.4,9.5 16.7,14.4 18.5,21.7 12,17.8 5.5,21.7 7.3,14.4 1.6,9.5 9.1,8.9";
const HEX = "12,2 21,7 21,17 12,22 3,17 3,7";
const ARROW = "12,2 20,12 14.5,12 14.5,22 9.5,22 9.5,12 4,12";

/** Every shape this puzzle uses, drawn inline so rotation is free. */
function Glyph({
  shape,
  colour,
  rot = 0,
  size = 26,
}: {
  shape: PatternShape;
  colour: StroopColour;
  rot?: PatternRotation;
  size?: number;
}) {
  const fill = GLYPH_COLOURS[colour];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <g transform={`rotate(${rot} 12 12)`}>
        {shape === "circle" && <circle cx="12" cy="12" r="9.5" fill={fill} />}
        {shape === "square" && <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill={fill} />}
        {shape === "triangle" && <polygon points="12,2.5 22,21 2,21" fill={fill} />}
        {shape === "star" && <polygon points={STAR} fill={fill} />}
        {shape === "hexagon" && <polygon points={HEX} fill={fill} />}
        {shape === "arrow" && <polygon points={ARROW} fill={fill} />}
      </g>
    </svg>
  );
}

function CellFace({ cell, size }: { cell: PatternCell; size: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-[3px]">
      {Array.from({ length: cell.count }, (_, i) => (
        <Glyph key={i} shape={cell.shape} colour={cell.colour} rot={cell.rot} size={size} />
      ))}
    </div>
  );
}

function Cell({
  cell,
  marked = false,
  pending = false,
  cellSize = 96,
  glyphSize = 26,
}: {
  cell?: PatternCell | undefined;
  /** Solid gold outline (the reveal). */
  marked?: boolean;
  /** Dashed gold outline (the live answer slot). */
  pending?: boolean;
  cellSize?: number;
  glyphSize?: number;
}) {
  const border = marked
    ? "border-primary"
    : pending
      ? "border-primary border-dashed"
      : "border-border";
  return (
    <div
      className={`flex items-center justify-center rounded-xl border-2 bg-card ${border}`}
      style={{ width: cellSize, height: cellSize }}
    >
      {cell ? (
        <CellFace cell={cell} size={glyphSize} />
      ) : (
        <span className="font-mono text-2xl font-bold text-muted-foreground">?</span>
      )}
    </div>
  );
}

function Grid({
  cells,
  answerCell,
  marked = false,
  pending = false,
  cellSize = 96,
  glyphSize = 26,
}: {
  cells: PatternCell[];
  /** What to draw in the bottom-right slot; undefined shows "?". */
  answerCell?: PatternCell | undefined;
  marked?: boolean;
  pending?: boolean;
  cellSize?: number;
  glyphSize?: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.slice(0, 8).map((cell, index) => (
        <Cell key={index} cell={cell} cellSize={cellSize} glyphSize={glyphSize} />
      ))}
      <Cell
        cell={answerCell}
        marked={marked}
        pending={pending}
        cellSize={cellSize}
        glyphSize={glyphSize}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro                                                                     */
/* -------------------------------------------------------------------------- */

// Shape changes down the rows, colour across the columns, count +1 across each row.
const EXAMPLE_SHAPES: PatternShape[] = ["circle", "square", "star"];
const EXAMPLE_COLOURS: StroopColour[] = ["RED", "BLUE", "GREEN"];
const EXAMPLE_CELLS: PatternCell[] = Array.from({ length: 9 }, (_, index) => ({
  shape: EXAMPLE_SHAPES[Math.floor(index / 3)]!,
  colour: EXAMPLE_COLOURS[index % 3]!,
  count: ((index % 3) + 1) as 1 | 2 | 3,
  rot: 0 as PatternRotation,
}));

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Work out the rules and build the missing piece.
      </p>
      <Grid
        cells={EXAMPLE_CELLS}
        answerCell={EXAMPLE_CELLS[8]!}
        marked
        cellSize={64}
        glyphSize={15}
      />
      <p className="text-center text-xs text-muted-foreground">
        Set the shape, colour and count to match. You have 45 seconds.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Play                                                                      */
/* -------------------------------------------------------------------------- */

function PickerButton({
  selected,
  label,
  onPress,
  children,
  width,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onPress}
      style={width ? { width } : undefined}
      className={`tap-target flex h-[46px] min-w-[46px] flex-1 items-center justify-center rounded-xl border-2 bg-card ${
        selected ? "border-primary" : "border-border"
      }`}
    >
      {children}
    </button>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const data = puzzle.type === "patcomp" ? (puzzle as PatternPuzzleData) : null;
  const key = data ? data.cells.slice(0, 8).map(encodePatternCell).join("|") : "";
  const fixed = data?.cells[0];

  const [shape, setShape] = useState<PatternShape | null>(null);
  const [colour, setColour] = useState<StroopColour | null>(null);
  const [count, setCount] = useState<1 | 2 | 3 | null>(null);
  const [rot, setRot] = useState<PatternRotation | null>(null);
  const submitted = useRef("");

  useEffect(() => {
    setShape(null);
    setColour(null);
    setCount(null);
    setRot(null);
    submitted.current = "";
  }, [key]);

  const active = data?.active ?? [];
  const showRotation = Boolean(data?.rotatable);
  const composed: PatternCell | undefined = useMemo(() => {
    if (!fixed) return undefined;
    const chosen: PatternCell = {
      shape: active.includes("shape") ? (shape ?? fixed.shape) : fixed.shape,
      colour: active.includes("colour") ? (colour ?? fixed.colour) : fixed.colour,
      count: active.includes("count") ? (count ?? fixed.count) : fixed.count,
      rot: showRotation ? (rot ?? 0) : 0,
    };
    const touched = shape !== null || colour !== null || count !== null || rot !== null;
    return touched ? chosen : undefined;
  }, [fixed, key, shape, colour, count, rot]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready =
    (!active.includes("shape") || shape !== null) &&
    (!active.includes("colour") || colour !== null) &&
    (!active.includes("count") || count !== null) &&
    (!showRotation || rot !== null);

  function send() {
    if (!composed || submitted.current === key) return;
    submitted.current = key;
    onSubmit(encodePatternCell(composed));
  }

  // Whatever is composed goes up just before the clock runs out.
  useEffect(() => {
    if (!data || locked || submitted.current === key) return;
    if (now < phaseStartedAt + PATCOMP_TIME_MS - 400) return;
    submitted.current = key;
    onSubmit(composed ? encodePatternCell(composed) : "");
  }, [now, locked, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !fixed) return null;

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-between gap-3">
      <Grid cells={data.cells} answerCell={composed} pending={!locked} cellSize={92} glyphSize={22} />

      <div className="flex w-full flex-col gap-2">
        {active.includes("shape") ? (
          <div className="flex w-full gap-1.5">
            {PATTERN_SHAPES.map((option) => (
              <PickerButton
                key={option}
                label={`Shape ${option}`}
                selected={shape === option}
                onPress={() => !locked && setShape(option)}
              >
                <Glyph shape={option} colour={shape === option ? "PINK" : "BLUE"} size={24} />
              </PickerButton>
            ))}
          </div>
        ) : null}

        {active.includes("colour") ? (
          <div className="flex w-full gap-1.5">
            {PATTERN_COLOURS.map((option) => (
              <PickerButton
                key={option}
                label={`Colour ${option}`}
                selected={colour === option}
                onPress={() => !locked && setColour(option)}
              >
                <span
                  className="block h-6 w-6 rounded-full"
                  style={{ backgroundColor: GLYPH_COLOURS[option] }}
                />
              </PickerButton>
            ))}
          </div>
        ) : null}

        {active.includes("count") ? (
          <div className="flex w-full gap-1.5">
            {PATTERN_COUNTS.map((option) => (
              <PickerButton
                key={option}
                label={`Count ${option}`}
                selected={count === option}
                onPress={() => !locked && setCount(option)}
              >
                <span className="font-mono text-lg font-bold text-foreground">{option}</span>
              </PickerButton>
            ))}
          </div>
        ) : null}

        {showRotation ? (
          <div className="flex w-full gap-1.5">
            {PATTERN_ROTATIONS.map((option) => (
              <PickerButton
                key={option}
                label={`Rotation ${option}`}
                selected={rot === option}
                onPress={() => !locked && setRot(option)}
              >
                <Glyph shape="arrow" colour={rot === option ? "PINK" : "BLUE"} rot={option} size={24} />
              </PickerButton>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          disabled={locked || !ready}
          onClick={send}
          className="tap-target h-[52px] w-full rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground disabled:opacity-40"
        >
          {locked ? "Locked" : "Submit"}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reveal                                                                    */
/* -------------------------------------------------------------------------- */

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "patcomp") return null;
  const data = puzzle as PatternPuzzleData;
  const mine = parsePatternCell(myAnswer);
  const wrong = patternMistakes(data, myAnswer);

  return (
    <>
      <Grid
        cells={data.cells}
        answerCell={data.answer ?? data.cells[8]!}
        marked
        cellSize={72}
        glyphSize={18}
      />
      <div className="flex w-full flex-col gap-1">
        {(data.rules ?? []).map((rule) => (
          <p key={rule.attr} className="text-center text-sm text-muted-foreground">
            {rule.text}
          </p>
        ))}
      </div>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your piece</p>
        {!mine ? (
          <p className="font-display text-2xl font-bold text-warn">No answer</p>
        ) : (
          <div className="flex items-center gap-4">
            <Cell cell={mine} marked={myCorrect} cellSize={72} glyphSize={18} />
            <span
              className={`font-display text-2xl font-bold ${myCorrect ? "text-primary" : "text-warn"}`}
            >
              {myCorrect ? "✓" : "✗"}
            </span>
          </div>
        )}
        {!myCorrect && wrong.length > 0 ? (
          <p className="text-center text-sm font-bold text-warn">
            {wrong.map(patternAttributeLabel).join(", ")} wrong
          </p>
        ) : null}
      </div>
    </>
  );
}

export const patternCompletionPuzzle: PuzzleDefinition = {
  key: "patcomp",
  name: "Pattern Completion",
  category: "pattern",
  timeLimitMs: PATCOMP_TIME_MS,
  generate: buildPatternCompletion,
  check: (answer, puzzle) =>
    puzzle.type === "patcomp" ? checkPatternAnswer(answer, puzzle as PatternPuzzleData) : false,
  revealHeading: "The missing piece",
  IntroExample,
  Stage,
  Reveal,
};
