import { ShapeGlyph } from "@/components/duel/ShapeGlyph";
import { pick, shuffled } from "@/lib/duel/random";
import type {
  GlyphShape,
  PatternCell,
  PatternPuzzleData,
  StroopColour,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

type Attribute = "shape" | "colour" | "count";

const SHAPES: GlyphShape[] = ["circle", "square", "triangle", "star"];
const COLOURS: StroopColour[] = ["RED", "BLUE", "GREEN", "PURPLE"];
const COUNTS: (1 | 2 | 3)[] = [1, 2, 3];
const ATTRIBUTES: Attribute[] = ["shape", "colour", "count"];
const LABEL: Record<Attribute, string> = {
  shape: "Shape",
  colour: "Colour",
  count: "Count",
};

function Cell({
  cell,
  marked = false,
  question = false,
  size = 20,
}: {
  cell?: PatternCell;
  marked?: boolean;
  question?: boolean;
  size?: number;
}) {
  return (
    <div
      className={`flex h-[62px] w-[62px] flex-wrap items-center justify-center gap-0.5 rounded-xl border bg-card ${
        marked ? "border-primary" : "border-border"
      }`}
    >
      {question || !cell ? (
        <span className="font-mono text-xl font-bold text-muted-foreground">?</span>
      ) : (
        Array.from({ length: cell.count }, (_, i) => (
          <ShapeGlyph key={i} shape={cell.shape} colour={cell.colour} size={size} />
        ))
      )}
    </div>
  );
}

function Grid({ cells, revealLast = false }: { cells: PatternCell[]; revealLast?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((cell, index) => (
        <Cell
          key={index}
          cell={cell}
          question={index === 8 && !revealLast}
          marked={index === 8 && revealLast}
        />
      ))}
    </div>
  );
}

const EXAMPLE_CELLS: PatternCell[] = [
  { shape: "circle", colour: "RED", count: 1 },
  { shape: "circle", colour: "BLUE", count: 1 },
  { shape: "circle", colour: "GREEN", count: 1 },
  { shape: "square", colour: "RED", count: 1 },
  { shape: "square", colour: "BLUE", count: 1 },
  { shape: "square", colour: "GREEN", count: 1 },
  { shape: "triangle", colour: "RED", count: 1 },
  { shape: "triangle", colour: "BLUE", count: 1 },
  { shape: "triangle", colour: "GREEN", count: 1 },
];

const EXAMPLE_CANDIDATES: PatternCell[] = [
  { shape: "triangle", colour: "GREEN", count: 1 },
  { shape: "circle", colour: "GREEN", count: 1 },
  { shape: "triangle", colour: "RED", count: 1 },
  { shape: "triangle", colour: "GREEN", count: 2 },
];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Work out the pattern and tap the piece that completes it.
      </p>
      <div className="scale-[0.72]">
        <Grid cells={EXAMPLE_CELLS} />
      </div>
      <div className="grid scale-[0.72] grid-cols-2 gap-2">
        {EXAMPLE_CANDIDATES.map((cell, index) => (
          <Cell key={index} cell={cell} marked={index === 0} />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Tap once to lock your answer. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "patcomp") return null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <Grid cells={puzzle.cells} />

      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Which piece completes it?
      </p>

      <div className="grid grid-cols-2 gap-3">
        {puzzle.candidates.map((cell, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Candidate ${index + 1}`}
            disabled={locked}
            onClick={() => !locked && onSubmit(String(index))}
            className="tap-target flex h-[82px] w-[82px] flex-wrap items-center justify-center gap-0.5 rounded-xl border border-border bg-card disabled:opacity-50"
          >
            {Array.from({ length: cell.count }, (_, i) => (
              <ShapeGlyph key={i} shape={cell.shape} colour={cell.colour} size={26} />
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "patcomp") return null;
  const chosen = Number.parseInt(myAnswer ?? "", 10);
  const pickedCell = Number.isFinite(chosen) ? puzzle.candidates[chosen] : undefined;

  return (
    <>
      <Grid cells={puzzle.cells} revealLast />
      <p className="text-center text-sm text-muted-foreground">{puzzle.rule}</p>
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
        {!pickedCell ? (
          <p className="font-display text-2xl font-bold text-warn">No answer</p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Cell cell={pickedCell} marked={myCorrect} />
            <span
              className={`font-display text-xl font-bold ${
                myCorrect ? "text-primary" : "text-warn"
              }`}
            >
              {myCorrect ? "✓" : "✗"}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function valuesFor(attr: Attribute): (GlyphShape | StroopColour | 1 | 2 | 3)[] {
  if (attr === "shape") return shuffled(SHAPES).slice(0, 3);
  if (attr === "colour") return shuffled(COLOURS).slice(0, 3);
  return shuffled(COUNTS);
}

function withAttribute(
  cell: PatternCell,
  attr: Attribute,
  value: GlyphShape | StroopColour | 1 | 2 | 3,
): PatternCell {
  if (attr === "shape") return { ...cell, shape: value as GlyphShape };
  if (attr === "colour") return { ...cell, colour: value as StroopColour };
  return { ...cell, count: value as 1 | 2 | 3 };
}

function otherValue(attr: Attribute, cell: PatternCell): GlyphShape | StroopColour | 1 | 2 | 3 {
  if (attr === "shape") return pick(SHAPES.filter((s) => s !== cell.shape));
  if (attr === "colour") return pick(COLOURS.filter((c) => c !== cell.colour));
  return pick(COUNTS.filter((c) => c !== cell.count));
}

export function buildPatternCompletion(): PatternPuzzleData {
  const [rowAttr, colAttr] = shuffled(ATTRIBUTES);
  const thirdAttr = ATTRIBUTES.find((a) => a !== rowAttr && a !== colAttr)!;
  const rowValues = valuesFor(rowAttr!);
  const colValues = valuesFor(colAttr!);
  const thirdValues = valuesFor(thirdAttr);
  const latin = Math.random() < 0.5;

  const cells: PatternCell[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let cell: PatternCell = { shape: "circle", colour: "RED", count: 1 };
      cell = withAttribute(cell, rowAttr!, rowValues[r]!);
      cell = withAttribute(cell, colAttr!, colValues[c]!);
      cell = withAttribute(
        cell,
        thirdAttr,
        latin ? thirdValues[(r + c) % 3]! : thirdValues[0]!,
      );
      cells.push(cell);
    }
  }

  const answer = cells[8]!;
  // Each distractor differs from the answer in exactly one attribute.
  const distractors = ATTRIBUTES.map((attr) =>
    withAttribute(answer, attr, otherValue(attr, answer)),
  );
  const options = shuffled([answer, ...distractors]);
  const correctIndex = options.findIndex(
    (o) => o.shape === answer.shape && o.colour === answer.colour && o.count === answer.count,
  );

  const rule = `${LABEL[rowAttr!]} changes by row, ${LABEL[colAttr!].toLowerCase()} by column${
    latin
      ? `, and ${LABEL[thirdAttr].toLowerCase()} never repeats in a row or column`
      : `, while ${LABEL[thirdAttr].toLowerCase()} stays the same`
  }.`;

  return { type: "patcomp", cells, candidates: options, correctIndex, rule };
}

export const patternCompletionPuzzle: PuzzleDefinition = {
  key: "patcomp",
  name: "Pattern Completion",
  category: "pattern",
  generate: buildPatternCompletion,
  check: (answer, puzzle) => {
    if (puzzle.type !== "patcomp") return false;
    return Number.parseInt(answer, 10) === puzzle.correctIndex;
  },
  IntroExample,
  Stage,
  Reveal,
};
