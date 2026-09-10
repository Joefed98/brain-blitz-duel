import { pick, randInt } from "@/lib/duel/random";
import type {
  OddShapeBase,
  OddShapeDifference,
  OddShapePuzzleData,
  StroopColour,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const COLOURS: Record<StroopColour, string> = {
  RED: "#FF4D4D",
  BLUE: "#4D8CFF",
  GREEN: "#3DDC84",
  PURPLE: "#B26BFF",
};

const BASES: OddShapeBase[] = ["circle", "square", "triangle", "star", "hexagon", "arrow"];
const DIFFERENCE_LABELS: Record<OddShapeDifference, string> = {
  rotated: "It was rotated",
  smaller: "It was slightly smaller",
  shade: "It was a different shade",
  notched: "It had a small notch",
  flipped: "It was flipped horizontally",
};

function possibleDifferences(base: OddShapeBase): OddShapeDifference[] {
  const common: OddShapeDifference[] = ["smaller", "shade", "notched"];
  if (base !== "circle") common.push("rotated");
  if (base === "arrow") common.push("flipped");
  return common;
}

function Shape({
  base,
  colour,
  difference,
  size = 38,
}: {
  base: OddShapeBase;
  colour: StroopColour;
  difference?: OddShapeDifference;
  size?: number;
}) {
  const fill = COLOURS[colour];
  const transform = [
    difference === "rotated" ? "rotate(20deg)" : "",
    difference === "smaller" ? "scale(.82)" : "",
    difference === "flipped" ? "scaleX(-1)" : "",
  ].filter(Boolean).join(" ");
  const shape = (() => {
    if (base === "circle") return <circle cx="20" cy="20" r="13" fill={fill} />;
    if (base === "square") return <rect x="7" y="7" width="26" height="26" rx="2" fill={fill} />;
    if (base === "triangle") return <polygon points="20,5 35,33 5,33" fill={fill} />;
    if (base === "star") return <polygon points="20,3 24,14 36,14 26,22 30,35 20,27 10,35 14,22 4,14 16,14" fill={fill} />;
    if (base === "hexagon") return <polygon points="12,5 28,5 36,20 28,35 12,35 4,20" fill={fill} />;
    return <path d="M4 14h18V7l14 13-14 13v-7H4z" fill={fill} />;
  })();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="shrink-0"
      style={{ transform, filter: difference === "shade" ? "brightness(0.68)" : undefined }}
    >
      {shape}
      {difference === "notched" && <rect x="17" y="2" width="7" height="11" fill="var(--background)" />}
    </svg>
  );
}

function ShapeGrid({
  base,
  colour,
  difference,
  variants,
  oddIndex,
  selectedIndex,
  reveal = false,
  compact = false,
  onSelect,
}: {
  base: OddShapeBase;
  colour: StroopColour;
  difference: OddShapeDifference;
  variants?: (OddShapeDifference | null)[];
  oddIndex: number;
  selectedIndex?: number;
  reveal?: boolean;
  compact?: boolean;
  onSelect?: (index: number) => void;
}) {
  const count = compact ? 9 : 25;
  const cols = compact ? 3 : 5;
  return (
    <div className={`grid ${compact ? "gap-1.5" : "w-full max-w-[330px] gap-2"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, index) => {
        const visibleDifference = variants?.[index] ?? (index === oddIndex ? difference : undefined);
        const isOdd = index === oddIndex;
        const wrong = reveal && selectedIndex === index && !isOdd;
        const cellClass = reveal && isOdd
          ? "border-primary bg-primary/10"
          : wrong
            ? "border-warn bg-warn/10"
            : "border-border bg-card";
        const contents = <Shape base={base} colour={colour} difference={visibleDifference ?? undefined} size={compact ? 27 : 40} />;
        return onSelect ? (
          <button
            key={index}
            type="button"
            aria-label={`Shape ${index + 1}`}
            onClick={() => onSelect(index)}
            className={`flex aspect-square min-w-0 items-center justify-center rounded-lg border ${cellClass}`}
          >
            {contents}
          </button>
        ) : (
          <span key={index} className={`flex aspect-square min-w-0 items-center justify-center rounded-lg border ${cellClass}`}>
            {contents}
          </span>
        );
      })}
    </div>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">All the shapes are the same — except one. Find it.</p>
      <ShapeGrid base="circle" colour="BLUE" difference="smaller" oddIndex={4} reveal compact />
      <p className="text-center text-xs text-muted-foreground">Tap once to lock your answer. Faster = more points.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "oddshape") return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Find the odd shape</p>
      <ShapeGrid
        base={puzzle.base}
        colour={puzzle.colour}
        difference={puzzle.difference}
        variants={puzzle.variants}
        oddIndex={-1}
        onSelect={(index) => !locked && onSubmit(String(index))}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "oddshape") return null;
  const selected = Number.parseInt(myAnswer ?? "", 10);
  return (
    <>
      <ShapeGrid
        base={puzzle.base}
        colour={puzzle.colour}
        difference={puzzle.difference}
        oddIndex={puzzle.oddIndex}
        {...(Number.isFinite(selected) ? { selectedIndex: selected } : {})}
        reveal
      />
      <p className="text-center text-sm text-muted-foreground">{puzzle.differenceLabel}</p>
      <p className={`font-display text-xl font-bold ${myCorrect ? "text-primary" : "text-warn"}`}>
        {myAnswer ? (myCorrect ? "Your tap ✓" : "Your tap ✗") : "No answer"}
      </p>
    </>
  );
}

export const oddShapeOutPuzzle: PuzzleDefinition = {
  key: "oddshape",
  name: "Odd Shape Out",
  category: "attention",
  generate: () => {
    const base = pick(BASES);
    const difference = pick(possibleDifferences(base));
    const oddIndex = randInt(0, 24);
    return {
      type: "oddshape",
      base,
      colour: pick(Object.keys(COLOURS) as StroopColour[]),
      difference,
      variants: Array.from({ length: 25 }, (_, index) => index === oddIndex ? difference : null),
      oddIndex,
      differenceLabel: DIFFERENCE_LABELS[difference],
    } satisfies OddShapePuzzleData;
  },
  check: (answer, puzzle) =>
    puzzle.type === "oddshape" && Number.parseInt(answer, 10) === puzzle.oddIndex,
  IntroExample,
  Stage,
  Reveal,
};