import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { AnimatedScore } from "./AnimatedScore";
import { PUZZLE_INSTRUCTIONS } from "@/lib/duel/instructions";
import type { PuzzleCategory, PuzzleType } from "@/lib/duel/types";

/**
 * The game frame (Polish 2, 24 Oct 2026, display only; docs/design-system.md "Game screens"): one
 * 60px header for every game's live round (GameLayout), the puzzles' goal line under it, and the
 * score block. Nothing here reads or writes a sim, a grade or a stamp.
 */

export const CATEGORY_NAMES: Record<PuzzleCategory, string> = {
  word: "Word",
  number: "Number",
  speed: "Speed",
  attention: "Attention",
  pattern: "Pattern",
  logic: "Logic",
  arcade: "Arcade",
};

/**
 * The goal line's text: each game's intro goal, shortened where it would not fit on one 13px line
 * beside its progress at 375px. Every other game shows its intro goal without the full stop.
 */
const SHORT_GOALS: Partial<Record<PuzzleType, string>> = {
  wordslide: "Make every row a word",
  numhunt: "Tap 1 to 24 in order",
  spotdiff: "Find six differences in each",
  stopwatch: "Stop in the gold zone, ten times",
  flow: "Join every pair, fill every square",
  tubes: "Sort each flask to one colour",
  safe: "Find the code that fits every clue",
  nonogram: "Fill cells to match the numbers",
  rings: "Make every spoke one colour",
  shikaku: "Cut rectangles, one number each",
  lightup: "Light every white square",
  wordsearch: "Find the six hidden words",
  strikeout: "Reveal five long words",
  codeword: "Each number is one letter",
  swapword: "Swap tiles until every word reads",
  numpyramid: "Each cell is the sum of the two below",
  trail: "One path from 1 to 36 through every square",
  gravity: "Park each ball on its target",
  tilegrid: "Build a mini crossword",
  target: "Use the numbers to make the target",
  equation: "Make each equation true",
  symscan: "Find every matching eagle",
  countup: "Count the shapes asked for",
  unblock: "Slide the gold block out",
  blockparty: "Fit all nine pieces",
  maze: "Draw a path to the exit",
  tower: "Move the tower to the gold post",
  checkout: "Score exactly the target",
  measure: "Measure out the target amount",
  laser: "Light all six gems with one beam",
  push: "Push every crate onto a mark",
  wordsmith: "Make words with the centre letter",
  letterwheel: "Fill the crossword from the wheel",
  flood: "Flood the board with one colour",
};

export function frameGoal(type: PuzzleType): string {
  return SHORT_GOALS[type] ?? PUZZLE_INSTRUCTIONS[type]?.goal.replace(/\.$/, "") ?? "";
}

/**
 * Games whose goal line carries a 6px stage bar (they publish their stages through StageProgress).
 * Known before the first paint, so the line's height never changes.
 */
export const GOAL_BAR_GAMES: ReadonlySet<PuzzleType> = new Set<PuzzleType>([
  "equation",
  "countup",
  "numpyramid",
  "measure",
  "symscan",
  "numline",
]);

/**
 * Puzzles that keep today's board size and no tray (data-tray="off"): their board doesn't size from
 * its arena box, so the tray's 14px padding would push it past the tray. The category batches move
 * them onto the tray in their own code. Each entry says why.
 */
export const TRAY_SKIP: ReadonlyMap<PuzzleType, string> = new Map<PuzzleType, string>([
  ["wordslide", "Slider measures its whole stage column's width for its cells, so the board and padlocks ran 59px past the tray at 375px"],
  ["balance", "Counterweight's scale is laid out from the column's width (352px at 375px), past a 315px tray"],
  ["countup", "Tally scatters its shapes over the column's width, so shapes sat on and past the tray's edge at 375px"],
  ["trail", "Trail's grid is sized from the column (100cqw), so it was wider than its tray and the screen"],
  ["numline", "Ballpark's number line is drawn across the column's width, past the tray's padding"],
]);

export interface GoalProgress {
  /** Stages done (0-based index of the current one). */
  done: number;
  total: number;
  /** The text on the line's right, e.g. "Stage 2 of 3". */
  text: string;
}

/** Set inside a live round's frame: a stage publishes its progress to the goal line instead of drawing its own bar. */
export const GoalLineContext = createContext<((progress: GoalProgress | null) => void) | null>(null);

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A stage's progress for the goal line. Returns true when the frame shows it (the stage then draws
 * nothing of its own); false outside a live round (intros, demos, reveals keep their own bar).
 * Published before the first paint, so the line never fills in late.
 */
export function useGoalProgress(progress: GoalProgress): boolean {
  const publish = useContext(GoalLineContext);
  const { done, total, text } = progress;
  useIsoLayoutEffect(() => {
    if (!publish) return;
    publish({ done, total, text });
  }, [publish, done, total, text]);
  useIsoLayoutEffect(() => (publish ? () => publish(null) : undefined), [publish]);
  return Boolean(publish);
}

/** The puzzles' goal line: the goal left, the progress right, a stage bar under both where the game has stages. */
export function GoalLine({ type, children }: { type: PuzzleType; children: ReactNode }) {
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const bar = GOAL_BAR_GAMES.has(type);
  return (
    <GoalLineContext.Provider value={setProgress}>
      <div data-goal-line data-goal-bar={bar ? "" : undefined} className="game-goal-line">
        <div className="game-goal-row">
          <span data-goal-text className="game-goal-text">{frameGoal(type)}</span>
          {progress ? <span data-goal-progress className="game-goal-progress">{progress.text}</span> : null}
        </div>
        {bar ? (
          <div className="game-goal-bar" aria-label={progress ? progress.text : undefined}>
            {progress
              ? Array.from({ length: progress.total }, (_, i) => (
                  <span key={i} data-done={i < progress.done ? "" : undefined} data-current={i === progress.done ? "" : undefined} />
                ))
              : null}
          </div>
        ) : null}
      </div>
      {children}
    </GoalLineContext.Provider>
  );
}

/** The header's score block: a small label over the number, and an optional note under it (a room's place). */
export function FrameScore({ label = "Score", value, note, extra }: {
  label?: ReactNode;
  value: number | null;
  note?: ReactNode;
  /** Drawn over the block's corner (a room's unread-chat dot); takes no space. */
  extra?: ReactNode;
}) {
  return (
    <div data-frame-score className="game-frame-score">
      <span className="game-frame-score-label">{label}</span>
      {value === null ? (
        <span className="game-frame-score-value">–</span>
      ) : (
        <AnimatedScore value={value} className="game-frame-score-value" />
      )}
      {note ? <span className="game-frame-score-note">{note}</span> : null}
      {extra}
    </div>
  );
}
