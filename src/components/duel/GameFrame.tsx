import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { AnimatedScore } from "./AnimatedScore";
import { boardBox } from "@/lib/boardBox";
import { PUZZLE_INSTRUCTIONS } from "@/lib/duel/instructions";
import type { PuzzleCategory, PuzzleType } from "@/lib/duel/types";

/**
 * The game frame (Polish 2, 24 Oct 2026, display only; docs/design-system.md "Game screens"): one
 * 60px header for every game's live round (GameLayout), the puzzles' goal line under it, and the
 * score block. Nothing here reads or writes a sim, a grade or a stamp.
 */

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  numhunt: "Tap the numbers lowest to highest",
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
  gravity: "Roll every ball into its hole",
  tiles: "Slide lines to rebuild the gradient",
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
 * Puzzles whose arena may grow past its design cap to the whole height between the goal line and the
 * dock (data-board-fill, game-frame.css): their board sizes itself from the arena's height, so it
 * grows (keeping its aspect ratio) where every other board would stay at main's size. Chosen by
 * measuring every puzzle on main and with the cap lifted (scripts/shots/frame-probe.ts --fill): six
 * boxes grew, but only Tally's shapes and Don't Break the Chain's charms spread over the taller area;
 * Nucleus, Double Take, Roundabout and Checkout only grew an empty panel round a board of the same size,
 * so they keep main's cap.
 */
export const BOARD_FILL: ReadonlySet<PuzzleType> = new Set<PuzzleType>(["countup", "chain"]);

/** The tray's padding round the board, its smallest side padding and screen margin, and its gap test. */
const TRAY_PAD = 10;
const TRAY_SIDE_MIN = 4;
const TRAY_MARGIN = 8;
/** Below this, the tray's 40px drop shadow would reach the game region's clipping bottom edge. */
const TRAY_SHADOW_REACH = 58;

/**
 * The tray (Polish 2): a plate drawn behind the puzzle board, hugging it. It is its own layer
 * ([data-game-tray], pointer-events none, under the stage in the game region), so the board's layout,
 * size and input are exactly main's. It is the board's box (boardBox) plus 10px all round, 8px clear
 * of the screen's sides; beside a board too wide for that, the side padding and margin shrink, the
 * padding to 4px, then the margin to 0 (a full-width board keeps main's width and the tray runs to the
 * screen's edge). Measured before the first paint and again whenever the board's box changes size.
 */
export function useBoardTray(region: { current: HTMLElement | null }, tray: { current: HTMLElement | null }, enabled: boolean) {
  useIsoLayoutEffect(() => {
    const host = region.current;
    const plate = tray.current;
    if (!enabled || !host || !plate) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const arena = host.querySelector<HTMLElement>("[data-game-stage] [data-game-arena]");
      if (!arena) {
        delete plate.dataset["placed"];
        return;
      }
      const b = boardBox(arena);
      const r = host.getBoundingClientRect();
      const room = Math.max(0, Math.min(b.left, window.innerWidth - b.right));
      const side = room >= TRAY_PAD + TRAY_MARGIN ? TRAY_PAD : room >= TRAY_SIDE_MIN * 2 ? Math.min(TRAY_PAD, room - TRAY_SIDE_MIN) : Math.min(room, TRAY_SIDE_MIN);
      const top = Math.max(r.top, b.top - TRAY_PAD);
      const bottom = Math.min(r.bottom, b.bottom + TRAY_PAD);
      plate.dataset["placed"] = "";
      plate.style.left = `${b.left - side - r.left}px`;
      plate.style.top = `${top - r.top}px`;
      plate.style.width = `${b.right - b.left + side * 2}px`;
      plate.style.height = `${bottom - top}px`;
      plate.toggleAttribute("data-tray-low", r.bottom - bottom < TRAY_SHADOW_REACH);
    };
    place();
    const later = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const resize = new ResizeObserver(later);
    const watch = () => {
      resize.disconnect();
      resize.observe(host);
      const arena = host.querySelector("[data-game-stage] [data-game-arena]");
      if (!arena) return;
      resize.observe(arena);
      for (const child of Array.from(arena.children)) {
        resize.observe(child);
        for (const inner of Array.from(child.children)) resize.observe(inner);
      }
    };
    watch();
    // A board whose rows arrive or leave (a new stage): watch its new boxes and place again.
    const mutations = new MutationObserver(() => {
      watch();
      later();
    });
    const stage = host.querySelector("[data-game-stage]");
    if (stage) mutations.observe(stage, { childList: true, subtree: true });
    // A board that animates into place (Tally's shapes landing) is placed again when it settles.
    stage?.addEventListener("animationend", later);
    stage?.addEventListener("transitionend", later);
    window.addEventListener("resize", later);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      stage?.removeEventListener("animationend", later);
      stage?.removeEventListener("transitionend", later);
      window.removeEventListener("resize", later);
    };
  }, [enabled]);
}

export interface GoalProgress {
  /** Stages done (0-based index of the current one). */
  done: number;
  total: number;
  /** The text on the line's right, e.g. "Stage 2 of 3". */
  text: string;
}

/** Set inside a live round's frame: a stage publishes its progress to the goal line instead of drawing its own bar. */
export const GoalLineContext = createContext<((progress: GoalProgress | null) => void) | null>(null);


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
