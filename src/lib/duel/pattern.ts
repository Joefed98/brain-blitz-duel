/**
 * Pattern Completion: rules, generation and answer checking. Lives here so the
 * server (generation, grading, round summaries) and the puzzle's screens share
 * exactly one definition of the rules.
 */
import { pick, shuffled } from "./random";
import type {
  PatternAttribute,
  PatternCell,
  PatternPuzzleData,
  PatternRoundItem,
  PatternRotation,
  PatternRule,
  PatternRuleKind,
  PatternShape,
  StroopColour,
} from "./types";

export const PATTERN_SHAPES: PatternShape[] = [
  "circle",
  "square",
  "triangle",
  "star",
  "hexagon",
  "arrow",
];
export const PATTERN_COLOURS: StroopColour[] = [
  "RED",
  "BLUE",
  "GREEN",
  "PURPLE",
  "PINK",
  "ORANGE",
  "BROWN",
];
export const PATTERN_COUNTS: (1 | 2 | 3)[] = [1, 2, 3];
export const PATTERN_ROTATIONS: PatternRotation[] = [0, 90, 180, 270];
/** Rotation only reads as rotation on these two. */
export const ROTATABLE_SHAPES: PatternShape[] = ["triangle", "arrow"];
/** Share of puzzles that put rotation in play. */
const ROTATION_SHARE = 0.45;

const ATTR_LABEL: Record<PatternAttribute, string> = {
  shape: "Shape",
  colour: "Colour",
  count: "Count",
  rot: "Rotation",
};

type Value = PatternShape | StroopColour | 1 | 2 | 3 | PatternRotation;

function valueOf(cell: PatternCell, attr: PatternAttribute): Value {
  if (attr === "shape") return cell.shape;
  if (attr === "colour") return cell.colour;
  if (attr === "count") return cell.count;
  return cell.rot;
}

function withValue(cell: PatternCell, attr: PatternAttribute, value: Value): PatternCell {
  if (attr === "shape") return { ...cell, shape: value as PatternShape };
  if (attr === "colour") return { ...cell, colour: value as StroopColour };
  if (attr === "count") return { ...cell, count: value as 1 | 2 | 3 };
  return { ...cell, rot: value as PatternRotation };
}

function ruleText(attr: PatternAttribute, kind: PatternRuleKind): string {
  const label = ATTR_LABEL[attr];
  if (kind === "latin") return `${label}: each once per row and column`;
  if (kind === "row") return `${label}: same across each row`;
  return attr === "rot" ? `${label}: +90° across each row` : `${label}: +1 across each row`;
}

function poolFor(attr: PatternAttribute, shapes: PatternShape[]): Value[] {
  if (attr === "shape") return shapes;
  if (attr === "colour") return PATTERN_COLOURS;
  if (attr === "count") return PATTERN_COUNTS;
  return PATTERN_ROTATIONS;
}

/* -------------------------------------------------------------------------- */
/*  Answers as text                                                           */
/* -------------------------------------------------------------------------- */

/** A composed cell travels as "shape:colour:count:rot". */
export function encodePatternCell(cell: PatternCell): string {
  return `${cell.shape}:${cell.colour}:${cell.count}:${cell.rot}`;
}

export function parsePatternCell(answer: string | null | undefined): PatternCell | null {
  const parts = (answer ?? "").split(":");
  if (parts.length !== 4) return null;
  const [shape, colour, count, rot] = parts;
  if (!PATTERN_SHAPES.includes(shape as PatternShape)) return null;
  if (!PATTERN_COLOURS.includes(colour as StroopColour)) return null;
  const n = Number.parseInt(count ?? "", 10);
  const r = Number.parseInt(rot ?? "", 10);
  if (![1, 2, 3].includes(n)) return null;
  if (![0, 90, 180, 270].includes(r)) return null;
  return {
    shape: shape as PatternShape,
    colour: colour as StroopColour,
    count: n as 1 | 2 | 3,
    rot: r as PatternRotation,
  };
}

/** Which of the puzzle's attributes the player got wrong, in reading order. */
export function patternMistakes(
  puzzle: PatternRoundItem,
  answer: string | null | undefined,
): PatternAttribute[] {
  const cell = parsePatternCell(answer);
  const target = puzzle.answer;
  if (!target) return [];
  const attrs: PatternAttribute[] = ["shape", "colour", "count", "rot"];
  const checked = attrs.filter(
    (attr) => puzzle.active.includes(attr) && (attr !== "rot" || puzzle.rotatable),
  );
  if (!cell) return checked;
  return checked.filter((attr) => valueOf(cell, attr) !== valueOf(target, attr));
}

export function patternAttributeLabel(attr: PatternAttribute): string {
  return ATTR_LABEL[attr].toLowerCase();
}

/** Server-side check: every attribute the player could set has to match. */
export function checkPatternAnswer(answer: string, puzzle: PatternRoundItem): boolean {
  if (!puzzle.answer) return false;
  return parsePatternCell(answer) !== null && patternMistakes(puzzle, answer).length === 0;
}

/* -------------------------------------------------------------------------- */
/*  Solving — used to prove the rules pin the missing cell down               */
/* -------------------------------------------------------------------------- */

/**
 * Works the bottom-right cell out from the eight visible cells and the rules,
 * exactly as a player would. Returns null when the rules leave it open.
 */
export function solvePatternCell(
  visible: PatternCell[],
  rules: PatternRule[],
  fixed: PatternCell,
): PatternCell | null {
  let cell: PatternCell = { ...fixed };
  for (const rule of rules) {
    const rowLeft = [visible[6]!, visible[7]!];
    if (rule.kind === "row") {
      const a = valueOf(rowLeft[0]!, rule.attr);
      const b = valueOf(rowLeft[1]!, rule.attr);
      if (a !== b) return null;
      cell = withValue(cell, rule.attr, a);
      continue;
    }
    if (rule.kind === "prog") {
      const previous = valueOf(rowLeft[1]!, rule.attr);
      if (rule.attr === "count") {
        const next = (previous as number) + 1;
        if (next < 1 || next > 3) return null;
        cell = withValue(cell, rule.attr, next as 1 | 2 | 3);
      } else {
        cell = withValue(cell, rule.attr, (((previous as number) + 90) % 360) as PatternRotation);
      }
      continue;
    }
    // Latin square: the one value missing from both the last row and column.
    const all = new Set(visible.map((c) => valueOf(c, rule.attr)));
    const taken = new Set([
      valueOf(visible[6]!, rule.attr),
      valueOf(visible[7]!, rule.attr),
      valueOf(visible[2]!, rule.attr),
      valueOf(visible[5]!, rule.attr),
    ]);
    const left = [...all].filter((value) => !taken.has(value));
    if (left.length !== 1) return null;
    cell = withValue(cell, rule.attr, left[0]!);
  }
  return cell;
}

/* -------------------------------------------------------------------------- */
/*  Generation                                                                */
/* -------------------------------------------------------------------------- */

function sameCell(a: PatternCell, b: PatternCell): boolean {
  return a.shape === b.shape && a.colour === b.colour && a.count === b.count && a.rot === b.rot;
}

interface Plan {
  rules: PatternRule[];
  /** The attribute held constant across the whole grid. */
  fixedAttr: PatternAttribute;
  shapes: PatternShape[];
  base: PatternCell;
}

function makePlan(): Plan {
  const rotatable = Math.random() < ROTATION_SHARE;
  const shapes = rotatable ? [pick(ROTATABLE_SHAPES)] : shuffled(PATTERN_SHAPES).slice(0, 3);
  const base: PatternCell = {
    shape: shapes[0]!,
    colour: PATTERN_COLOURS[0]!,
    count: 1,
    rot: 0,
  };

  if (rotatable) {
    // One rotatable shape all over the grid; exactly two attributes vary.
    const other = pick<PatternAttribute>(["colour", "count"]);
    const otherKind: PatternRuleKind =
      other === "count" && Math.random() < 0.5 ? "prog" : pick(["row", "latin"]);
    return {
      fixedAttr: "shape",
      shapes,
      base,
      rules: [
        { attr: "rot", kind: "prog", text: ruleText("rot", "prog") },
        { attr: other, kind: otherKind, text: ruleText(other, otherKind) },
      ],
    };
  }

  // No rotation in play: exactly two of shape, colour and count carry rules.
  const active = shuffled<PatternAttribute>(["shape", "colour", "count"]).slice(0, 2);
  return {
    fixedAttr: "rot",
    shapes,
    base,
    rules: active.map((attr) => {
      const kind: PatternRuleKind = attr === "count" ? "prog" : pick(["row", "latin"]);
      return { attr, kind, text: ruleText(attr, kind) };
    }),
  };
}

function buildGrid(plan: Plan): PatternCell[] | null {
  const cells: PatternCell[] = [];
  const perRule = plan.rules.map((rule) => {
    const pool = shuffled(poolFor(rule.attr, plan.shapes)) as Value[];
    if (rule.kind === "prog") {
      // Count can only run 1 → 2 → 3; rotation may start anywhere per row.
      const starts =
        rule.attr === "count"
          ? [1, 1, 1]
          : [pick(PATTERN_ROTATIONS), pick(PATTERN_ROTATIONS), pick(PATTERN_ROTATIONS)];
      return { rule, values: pool.slice(0, 3), starts };
    }
    return { rule, values: pool.slice(0, 3), starts: [] as number[] };
  });

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let cell: PatternCell = { ...plan.base };
      for (const { rule, values, starts } of perRule) {
        if (rule.kind === "row") {
          cell = withValue(cell, rule.attr, values[r]!);
        } else if (rule.kind === "latin") {
          cell = withValue(cell, rule.attr, values[(r + c) % 3]!);
        } else if (rule.attr === "count") {
          cell = withValue(cell, rule.attr, (starts[r]! + c) as 1 | 2 | 3);
        } else {
          cell = withValue(cell, rule.attr, ((starts[r]! + 90 * c) % 360) as PatternRotation);
        }
      }
      cells.push(cell);
    }
  }

  // The rules have to pin the missing cell down on their own.
  const solved = solvePatternCell(cells.slice(0, 8), plan.rules, plan.base);
  if (!solved || !sameCell(solved, cells[8]!)) return null;
  // And it must not simply copy a neighbour.
  if (sameCell(cells[8]!, cells[7]!) || sameCell(cells[8]!, cells[5]!)) return null;
  return cells;
}

function buildPatternItem(): PatternRoundItem {
  for (let attempt = 0; attempt < 200; attempt++) {
    const plan = makePlan();
    const cells = buildGrid(plan);
    if (!cells) continue;
    const active = plan.rules.map((rule) => rule.attr);
    return {
      cells,
      active,
      rotatable: ROTATABLE_SHAPES.includes(cells[0]!.shape) && active.includes("rot"),
      rules: plan.rules,
      answer: cells[8]!,
    };
  }
  // Fallback: the plainest possible grid (shape per row, colour per column-ish).
  const cells: PatternCell[] = [];
  const shapes: PatternShape[] = ["circle", "square", "star"];
  const colours: StroopColour[] = ["RED", "BLUE", "GREEN"];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push({
        shape: shapes[r]!,
        colour: colours[(r + c) % 3]!,
        count: 1,
        rot: 0,
      });
    }
  }
  const rules: PatternRule[] = [
    { attr: "shape", kind: "row", text: ruleText("shape", "row") },
    { attr: "colour", kind: "latin", text: ruleText("colour", "latin") },
  ];
  return {
    cells,
    active: ["shape", "colour"],
    rotatable: false,
    rules,
    answer: cells[8]!,
  };
}

export function buildPatternCompletion(): PatternPuzzleData {
  return {
    type: "patcomp",
    puzzles: Array.from({ length: 3 }, buildPatternItem),
  };
}

export function decodePatternAnswers(answer: string | null | undefined): string[] {
  return (answer ?? "").split("|").slice(0, 3);
}

export function countPatternAnswers(
  puzzle: PatternPuzzleData,
  answer: string | null | undefined,
): number {
  const answers = decodePatternAnswers(answer);
  return puzzle.puzzles.reduce(
    (count, item, index) => count + (checkPatternAnswer(answers[index] ?? "", item) ? 1 : 0),
    0,
  );
}
