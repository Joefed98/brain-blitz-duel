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
  PATCOMP_ITEMS,
  type PatternAttribute,
  type PatternCell,
  type PatternPuzzleData,
  type PatternRoundItem,
  type PatternRotation,
  type PatternShape,
  type StroopColour,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/* -------------------------------------------------------------------------- */
/*  Drawing                                                                   */
/* -------------------------------------------------------------------------- */

const STAR = "12,2 14.9,8.9 22.4,9.5 16.7,14.4 18.5,21.7 12,17.8 5.5,21.7 7.3,14.4 1.6,9.5 9.1,8.9";
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
  /** Game colours, or "WHITE" for the plain white picker icons. */
  colour: StroopColour | "WHITE";
  rot?: PatternRotation;
  size?: number;
}) {
  const fill = colour === "WHITE" ? "#FFFFFF" : GLYPH_COLOURS[colour];
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
  fluid = false,
  cellSize = 96,
  glyphSize = 26,
}: {
  cell?: PatternCell | undefined;
  /** Solid gold outline (the reveal). */
  marked?: boolean;
  /** Dashed gold outline (the live answer slot). */
  pending?: boolean;
  fluid?: boolean;
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
      className={`flex items-center justify-center rounded-xl border-2 bg-card ${border} ${fluid ? "aspect-square min-h-0 w-full" : ""}`}
      style={fluid ? undefined : { width: cellSize, height: cellSize }}
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
  fluid = false,
  cellSize = 96,
  glyphSize = 26,
}: {
  cells: PatternCell[];
  /** What to draw in the bottom-right slot; undefined shows "?". */
  answerCell?: PatternCell | undefined;
  marked?: boolean;
  pending?: boolean;
  fluid?: boolean;
  cellSize?: number;
  glyphSize?: number;
}) {
  return (
    <div
      className={`grid grid-cols-3 gap-2 ${fluid ? "aspect-square h-auto max-h-full w-auto max-w-full" : ""}`}
    >
      {cells.slice(0, 8).map((cell, index) => (
        <Cell key={index} cell={cell} fluid={fluid} cellSize={cellSize} glyphSize={glyphSize} />
      ))}
      <Cell
        cell={answerCell}
        marked={marked}
        pending={pending}
        fluid={fluid}
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
const EXAMPLE_COLOURS: StroopColour[] = ["RED", "ORANGE", "GREEN"];
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
        Solve three patterns in 30 seconds. Each uses two changing attributes; you can skip.
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
  const roundKey = data
    ? data.puzzles.map((item) => item.cells.slice(0, 8).map(encodePatternCell).join(",")).join("|")
    : "";
  const [index, setIndex] = useState(0);
  const item: PatternRoundItem | undefined = data?.puzzles[index];
  const key = item ? `${index}:${item.cells.slice(0, 8).map(encodePatternCell).join(",")}` : "";
  const fixed = item?.cells[0];

  const [shape, setShape] = useState<PatternShape | null>(null);
  const [colour, setColour] = useState<StroopColour | null>(null);
  const [count, setCount] = useState<1 | 2 | 3 | null>(null);
  const [rot, setRot] = useState<PatternRotation | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const submitted = useRef(false);

  useEffect(() => {
    setShape(null);
    setColour(null);
    setCount(null);
    setRot(null);
  }, [key]);

  useEffect(() => {
    setIndex(0);
    setAnswers([]);
    submitted.current = false;
  }, [roundKey]);

  const active = item?.active ?? [];
  const showRotation = Boolean(item?.rotatable);
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

  function advance(answer: string) {
    if (!data || submitted.current) return;
    const next = [...answers, answer];
    if (index >= data.puzzles.length - 1) {
      submitted.current = true;
      onSubmit(next.join("|"));
      return;
    }
    setAnswers(next);
    setIndex((current) => current + 1);
  }

  // Whatever is composed goes up just before the clock runs out.
  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + PATCOMP_TIME_MS - 400) return;
    submitted.current = true;
    const final = [...answers];
    final[index] = composed ? encodePatternCell(composed) : "";
    while (final.length < PATCOMP_ITEMS) final.push("");
    onSubmit(final.join("|"));
  }, [now, locked, roundKey, index, answers, composed, data, phaseStartedAt, onSubmit]);

  if (!data || !item || !fixed) return null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2">
      <div
        className="flex w-full shrink-0 gap-1.5"
        aria-label={`Pattern ${index + 1} of ${data.puzzles.length}`}
      >
        {data.puzzles.map((_, progressIndex) => (
          <span
            key={progressIndex}
            className={`h-1.5 flex-1 rounded-full ${progressIndex <= index ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        <Grid cells={item.cells} answerCell={composed} pending={!locked} fluid glyphSize={22} />
      </div>

      <div className="flex w-full shrink-0 flex-col gap-1.5">
        {active.includes("shape") ? (
          <div className="flex w-full gap-1.5">
            {PATTERN_SHAPES.map((option) => (
              <PickerButton
                key={option}
                label={`Shape ${option}`}
                selected={shape === option}
                onPress={() => !locked && setShape(option)}
              >
                <Glyph shape={option} colour="WHITE" size={24} />
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
                <Glyph
                  shape="arrow"
                  colour={rot === option ? "PINK" : "BLUE"}
                  rot={option}
                  size={24}
                />
              </PickerButton>
            ))}
          </div>
        ) : null}

        <div className="flex w-full gap-2">
          <button
            type="button"
            disabled={locked}
            onClick={() => advance("")}
            className="tap-target h-[52px] flex-1 rounded-xl border border-border bg-card font-display text-base font-bold text-foreground disabled:opacity-40"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={locked || !ready}
            onClick={() => composed && advance(encodePatternCell(composed))}
            className="tap-target h-[52px] flex-[2] rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground disabled:opacity-40"
          >
            {locked ? "Locked" : "Submit"}
          </button>
        </div>
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
  const answers = (myAnswer ?? "").split("|");
  const correctCount = data.puzzles.filter((item, index) =>
    checkPatternAnswer(answers[index] ?? "", item),
  ).length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2">
      <p className={`font-mono text-2xl font-bold ${myCorrect ? "text-primary" : "text-warn"}`}>
        {correctCount} / {PATCOMP_ITEMS} correct
      </p>
      <div className="grid min-h-0 w-full flex-1 grid-cols-3 items-center gap-2">
        {data.puzzles.map((item, index) => {
          const mine = parsePatternCell(answers[index]);
          const ok = checkPatternAnswer(answers[index] ?? "", item);
          const wrong = patternMistakes(item, answers[index]);
          return (
            <div key={index} className="flex min-w-0 flex-col items-center gap-1">
              <Grid
                cells={item.cells}
                answerCell={item.answer ?? item.cells[8]}
                marked
                cellSize={28}
                glyphSize={7}
              />
              <span
                className={`font-display text-lg font-bold ${ok ? "text-primary" : "text-warn"}`}
              >
                {ok ? "✓" : "✗"}
              </span>
              <span className="text-center text-[10px] text-muted-foreground">
                {!mine
                  ? "Skipped"
                  : wrong.length
                    ? `${wrong.map(patternAttributeLabel).join(", ")} wrong`
                    : "Correct"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const patternCompletionPuzzle: PuzzleDefinition = {
  key: "patcomp",
  name: "Pattern Completion",
  category: "pattern",
  timeLimitMs: PATCOMP_TIME_MS,
  generate: buildPatternCompletion,
  check: (answer, puzzle) =>
    puzzle.type === "patcomp" &&
    puzzle.puzzles.every((item, index) => checkPatternAnswer(answer.split("|")[index] ?? "", item)),
  revealHeading: "The three patterns",
  IntroExample,
  Stage,
  Reveal,
};
