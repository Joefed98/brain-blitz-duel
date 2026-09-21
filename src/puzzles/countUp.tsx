import { GLYPH_COLOURS, ShapeGlyph } from "@/components/duel/ShapeGlyph";
import { NumberEntry } from "@/components/puzzles/NumberEntry";
import { pick, randInt, shuffled } from "@/lib/duel/random";
import {
  COUNTUP_COLS,
  COUNTUP_TIME_MS,
  COUNTUP_MAX_COUNT,
  COUNTUP_MAX_SHAPES,
  COUNTUP_MIN_COUNT,
  COUNTUP_MIN_SHAPES,
  COUNTUP_ROWS,
  type CountUpPuzzleData,
  type CountUpShape,
  type GlyphColour,
  type GlyphShape,
} from "@/lib/duel/types";

import { MyAnswerLine } from "@/components/puzzles/MyAnswerLine";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const SHAPES: GlyphShape[] = ["circle", "square", "triangle", "star"];
const COLOURS: GlyphColour[] = ["RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "BROWN"];

/** Colours too alike to tell apart at a glance — never the near-miss pair. */
const TOO_CLOSE: [GlyphColour, GlyphColour][] = [
  ["RED", "ORANGE"],
  ["ORANGE", "BROWN"],
  ["BLUE", "PURPLE"],
];

function tooClose(a: GlyphColour, b: GlyphColour): boolean {
  return TOO_CLOSE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

const PLURAL: Record<GlyphShape, string> = {
  circle: "circles",
  square: "squares",
  triangle: "triangles",
  star: "stars",
};

export function countUpQuestion(colour: GlyphColour, shape: GlyphShape): string {
  return `How many ${colour.toLowerCase()} ${PLURAL[shape]}?`;
}

function Field({
  shapes,
  highlight,
  height,
  size = 22,
}: {
  shapes: CountUpShape[];
  highlight?: { shape: GlyphShape; colour: GlyphColour };
  height?: number;
  size?: number;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-border bg-card ${height ? "" : "min-h-0 flex-1"}`}
      style={height ? { height } : undefined}
    >
      {shapes.map((item, index) => {
        const lit =
          highlight !== undefined &&
          item.shape === highlight.shape &&
          item.colour === highlight.colour;
        return (
          <span
            key={index}
            className="absolute flex items-center justify-center rounded-full"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: "translate(-50%, -50%)",
              padding: lit ? 3 : 0,
              boxShadow: lit ? `0 0 0 2px ${GLYPH_COLOURS.GOLD}` : undefined,
            }}
          >
            <ShapeGlyph shape={item.shape} colour={item.colour} size={size} />
          </span>
        );
      })}
    </div>
  );
}

/** Fixed intro example — three gold stars among other shapes, every time. */
const EXAMPLE_SHAPES: CountUpShape[] = [
  { shape: "star", colour: "GOLD", x: 18, y: 24 },
  { shape: "circle", colour: "BLUE", x: 42, y: 18 },
  { shape: "star", colour: "GOLD", x: 68, y: 34 },
  { shape: "triangle", colour: "GREEN", x: 84, y: 20 },
  { shape: "square", colour: "PURPLE", x: 30, y: 58 },
  { shape: "star", colour: "PINK", x: 54, y: 62 },
  { shape: "star", colour: "GOLD", x: 78, y: 74 },
  { shape: "circle", colour: "RED", x: 16, y: 80 },
  { shape: "triangle", colour: "BLUE", x: 46, y: 84 },
];

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Count the shapes that match the question.
      </p>
      <p className="font-display text-base font-bold">How many gold stars?</p>
      <Field shapes={EXAMPLE_SHAPES} height={140} size={20} />
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">3</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Type the number on the keypad and hit ENTER. You have 20 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "countup") return null;
  return (
    <NumberEntry
      label={countUpQuestion(puzzle.targetColour, puzzle.targetShape)}
      resetKey={`${puzzle.targetColour}-${puzzle.targetShape}-${puzzle.shapes.length}`}
      locked={locked}
      maxLength={2}
      placeholder="How many?"
      keypad
      onSubmit={onSubmit}
    >
      <div className="flex min-h-0 w-full flex-1">
        <Field shapes={puzzle.shapes} size={20} />
      </div>
    </NumberEntry>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "countup") return null;
  return (
    <>
      <p className="font-display text-sm font-bold">
        {countUpQuestion(puzzle.targetColour, puzzle.targetShape)}
      </p>
      <Field
        shapes={puzzle.shapes}
        highlight={{ shape: puzzle.targetShape, colour: puzzle.targetColour }}
        height={260}
        size={18}
      />
      <p className="font-mono text-5xl font-bold text-primary">{puzzle.count ?? "—"}</p>
      <MyAnswerLine myAnswer={myAnswer} myCorrect={myCorrect} />
    </>
  );
}

interface Slot {
  shape: GlyphShape;
  colour: GlyphColour;
}

export function buildCountUp(): CountUpPuzzleData {
  const targetShape = pick(SHAPES);
  const targetColour = pick(COLOURS);
  const count = randInt(COUNTUP_MIN_COUNT, COUNTUP_MAX_COUNT);

  // Two near-miss populations with similar counts, so a rough impression fails.
  const otherShape = pick(SHAPES.filter((s) => s !== targetShape));
  const otherColour = pick(COLOURS.filter((c) => c !== targetColour && !tooClose(c, targetColour)));
  const near = () => Math.max(3, count + pick([-2, -1, 1, 2]));
  const nearA = near();
  const nearB = near();

  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) slots.push({ shape: targetShape, colour: targetColour });
  for (let i = 0; i < nearA; i++) slots.push({ shape: otherShape, colour: targetColour });
  for (let i = 0; i < nearB; i++) slots.push({ shape: targetShape, colour: otherColour });

  const total = Math.max(
    slots.length,
    randInt(Math.max(COUNTUP_MIN_SHAPES, slots.length), COUNTUP_MAX_SHAPES),
  );
  while (slots.length < total) {
    const shape = pick(SHAPES);
    const colour = pick(COLOURS);
    if (shape === targetShape && colour === targetColour) continue; // never inflate the answer
    // A near-identical colour on the target shape would make counting a guess.
    if (shape === targetShape && tooClose(colour, targetColour)) continue;
    slots.push({ shape, colour });
  }

  // One shape per grid cell, jittered inside it, so nothing ever overlaps.
  const cells = shuffled(Array.from({ length: COUNTUP_COLS * COUNTUP_ROWS }, (_, i) => i)).slice(
    0,
    slots.length,
  );

  const shapes: CountUpShape[] = shuffled(slots).map((slot, index) => {
    const cell = cells[index]!;
    const col = cell % COUNTUP_COLS;
    const row = Math.floor(cell / COUNTUP_COLS);
    const jitterX = (randInt(-16, 16) / 100) * (100 / COUNTUP_COLS);
    const jitterY = (randInt(-16, 16) / 100) * (100 / COUNTUP_ROWS);
    return {
      shape: slot.shape,
      colour: slot.colour,
      x: Number((((col + 0.5) * 100) / COUNTUP_COLS + jitterX).toFixed(2)),
      y: Number((((row + 0.5) * 100) / COUNTUP_ROWS + jitterY).toFixed(2)),
    };
  });

  return { type: "countup", shapes, targetShape, targetColour, count };
}

export const countUpPuzzle: PuzzleDefinition = {
  key: "countup",
  name: "Count Up",
  category: "attention",
  timeLimitMs: COUNTUP_TIME_MS,
  generate: buildCountUp,
  check: (answer, puzzle) => {
    if (puzzle.type !== "countup") return false;
    const parsed = Number.parseInt(answer.trim(), 10);
    return Number.isFinite(parsed) && parsed === puzzle.count;
  },
  IntroExample,
  Stage,
  Reveal,
};
