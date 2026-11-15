import { gameDisplayName } from "@/lib/duel/gameNames";
import { WordHuntBoard, WordHuntPuzzle } from "@/components/puzzles/WordHuntPuzzle";
import { WORDHUNT_TIME_MS, wordHuntPoints, type WordHuntPuzzleData } from "@/lib/duel/types";
import { wordHuntDepth, wordHuntLongHalves } from "@/lib/duel/wordHunt";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import "@/polish-layout/polish-nov3-word.css";
import { wordHuntCols } from "@/lib/duel/types";
import { RevealChips, RevealHeadline, RevealLabel, RevealNumbers, type RevealChip, dropEndsMs } from "@/components/puzzles/WordReveal";
import { overhaulReveal } from "@/lib/duel/wordOverhaul";

/** Fixed intro example — never randomised: a 6×6 board (wordHuntRev 3) with its golden tile on the A. */
const EXAMPLE_GRID = "TAPLEDNSROINEMCKUGGBEAHTWYTRSOLINESA".split("");
/** P → A → N → E, through touching letters and the golden A. */
const EXAMPLE_PATH = [2, 1, 6, 12];
const EXAMPLE_GOLDEN = 1;
/** Example words with their points: through the golden tile ×2, 7+ letters ×2. */
const EXAMPLE_FOUND: { word: string; mark: string; points: number }[] = [
  { word: "PANE", mark: "★", points: 2 },
  { word: "SNARE", mark: "", points: 2 },
  { word: "PLANETS", mark: "×2", points: 14 },
];
/** Words listed on the reveal before the rest are summed up. */
const REVEAL_WORDS = 30;

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Drag through touching letters to make words. Four letters or more.
      </p>
      <div className="flex items-center gap-4">
        <WordHuntBoard grid={EXAMPLE_GRID} path={EXAMPLE_PATH} size={150} golden={EXAMPLE_GOLDEN} />
        <ul className="flex flex-col gap-1">
          {EXAMPLE_FOUND.map((entry) => (
            <li
              key={entry.word}
              className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest"
            >
              <span>{entry.word}{entry.mark ? ` ${entry.mark}` : ""}</span>
              <span className="text-primary">{entry.points}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">6+ letters and the gold tile multiply a word. Plurals count. You have 100 seconds.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, checkWord, stateKey }: PuzzleStageProps) {
  if (puzzle.type !== "wordhunt") return null;
  return (
    <WordHuntPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
      onDraftAnswer={onDraftAnswer}
      {...(checkWord ? { checkWord } : {})}
      {...(stateKey ? { stateKey } : {})}
    />
  );
}

/** A path of touching cells (diagonals too, each cell once; a Qu tile reads two letters) that spells `word`, or []. */
export function wordHuntPathOf(grid: readonly string[], word: string): number[] {
  const n = wordHuntCols(grid);
  const target = word.toUpperCase();
  const walk = (cell: number, at: number, used: number[]): number[] | null => {
    const tile = (grid[cell] ?? "").toUpperCase();
    if (!tile || !target.startsWith(tile, at) || used.includes(cell)) return null;
    const next = [...used, cell];
    const to = at + tile.length;
    if (to === target.length) return next;
    const r = Math.floor(cell / n);
    const c = cell % n;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const found = walk(rr * n + cc, to, next);
        if (found) return found;
      }
    return null;
  };
  for (let cell = 0; cell < grid.length; cell++) {
    const found = walk(cell, 0, []);
    if (found) return found;
  }
  return [];
}

/**
 * The Word overhaul's reveal (wordHuntRev 4+): the board with your best word traced on it (the golden tile gold), your
 * words as chips (the best gold), the best words you missed, and the numbers the score is made of: word points, the
 * value with the long-word and golden-tile boosts, and misses past the free allowance.
 */
function RevealOverhaul({ puzzle, myAnswer, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "wordhunt") return null;
  const depth = wordHuntDepth(puzzle);
  const goldWords = new Set(Array.isArray(myExtra?.["goldWords"]) ? (myExtra["goldWords"] as unknown[]).map(String) : []);
  const wordValue = (word: string) => (depth ? (wordHuntPoints(word) * wordHuntLongHalves(word.length) * (goldWords.has(word) ? 2 : 1)) / 2 : wordHuntPoints(word));
  const mine = (myAnswer ?? "").split(",").map((w) => w.trim().toUpperCase()).filter((w) => w.length > 0);
  const num = (k: string) => (typeof myExtra?.[k] === "number" ? (myExtra[k] as number) : null);
  const sorted = [...mine].sort((a, b) => wordValue(b) - wordValue(a) || b.length - a.length);
  const best = sorted[0] ?? "";
  const path = best ? wordHuntPathOf(puzzle.grid, best) : [];
  const yours: RevealChip[] = sorted.slice(0, REVEAL_WORDS).map((w, i) => ({ text: goldWords.has(w) ? `★ ${w}` : w, sub: wordValue(w), kind: i === 0 && mine.length > 1 ? "longest" : "found" }));
  const missed = (puzzle.words ?? []).filter((entry) => !mine.includes(entry.word)).sort((a, b) => b.word.length - a.word.length || b.points - a.points).slice(0, 8);
  const misses = num("misses");
  return (
    <div data-word-reveal="wordhunt" data-wr-version="overhaul" className="wr">
      <RevealHeadline>{mine.length} {mine.length === 1 ? "word" : "words"}</RevealHeadline>
      <RevealNumbers
        countAfterMs={dropEndsMs(yours.length)}
        items={[
          { id: "points", label: "Word points", value: num("points") ?? 0, tone: "gold" },
          num("value") !== null ? { id: "value", label: "With boosts", value: num("value") } : null,
          misses !== null ? { id: "misses", label: "Misses", value: misses, tone: (num("missCutPct") ?? 0) > 0 ? "warn" : undefined } : null,
        ]}
      />
      <div className="flex flex-col items-center gap-1" style={{ width: "min(84vw, 320px)" }}>
        {best ? <RevealLabel>Your best word: {best}</RevealLabel> : null}
        <WordHuntBoard grid={puzzle.grid} path={path} golden={puzzle.golden} />
      </div>
      {yours.length > 0 ? (
        <div className="flex w-full flex-col items-center gap-1.5">
          <RevealLabel>Your words</RevealLabel>
          <RevealChips id="yours" items={yours} drop />
          {mine.length > yours.length ? <p className="wr-label">+ {mine.length - yours.length} more</p> : null}
        </div>
      ) : null}
      {missed.length > 0 ? (
        <div className="flex w-full flex-col items-center gap-1.5">
          <RevealLabel>Best words you missed</RevealLabel>
          <RevealChips id="missed" items={missed.map((entry) => ({ text: entry.word, sub: entry.points, kind: "missed" as const }))} />
        </div>
      ) : null}
    </div>
  );
}

function Reveal(props: PuzzleRevealProps) {
  if (overhaulReveal(props.puzzle)) return <RevealOverhaul {...props} />;
  return <RevealOlder {...props} />;
}

function RevealOlder({ puzzle, myAnswer, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "wordhunt") return null;
  // wordHuntRev 3: each word's points with its long-word and golden multipliers (golden words from the stored grade).
  const depth = wordHuntDepth(puzzle);
  const goldWords = new Set(Array.isArray(myExtra?.["goldWords"]) ? (myExtra["goldWords"] as unknown[]).map(String) : []);
  const wordValue = (word: string) => (depth ? (wordHuntPoints(word) * wordHuntLongHalves(word.length) * (goldWords.has(word) ? 2 : 1)) / 2 : wordHuntPoints(word));
  const mine = (myAnswer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const missed = (puzzle.words ?? []).filter((entry) => !mine.includes(entry.word)).sort((a, b) => b.word.length - a.word.length || b.points - a.points).slice(0, 5);

  // Compact columns (14 px text) so a strong run fits one 375×667 screen; past
  // 30 words the shortest are summed up in a "+N more" line.
  const shown = [...mine].sort((a, b) => wordValue(b) - wordValue(a) || b.length - a.length).slice(0, REVEAL_WORDS);
  const more = mine.length - shown.length;
  return (
    <div data-word-reveal="wordhunt" className="flex w-full flex-col items-center gap-3">
      <p className="font-mono text-base uppercase tracking-widest text-foreground">{mine.length} {mine.length === 1 ? "word" : "words"}</p>

      {shown.length > 0 && (
        <ul className="word-reveal-list w-full">
          {shown.map((word) => (
            <li key={word}>
              <span>{goldWords.has(word) ? `${word} ★` : word}</span>
              <span className="text-primary">{wordValue(word)}</span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="font-mono text-sm text-muted-foreground">+ {more} more</p>}

      {missed.length > 0 && (
        <div className="flex w-full flex-col items-center gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Missed</p>
          {/* 3 Nov 2026: wrapping chips (the fixed columns ran past the screen's right edge). */}
          <ul data-word-missed="" className="word-reveal-chips w-full">
            {missed.map((entry) => (
              <li key={entry.word}>
                <span>{entry.word}</span>
                <span>{entry.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Word Hunt is built, checked and scored on the server: the dictionary and the
 * board's word list never reach a device.
 */
export const wordHuntPuzzle: PuzzleDefinition = {
  key: "wordhunt",
  name: gameDisplayName("wordhunt"),
  category: "word",
  timeLimitMs: WORDHUNT_TIME_MS,
  generate: () => ({ type: "wordhunt", grid: [] }) satisfies WordHuntPuzzleData,
  check: () => false,
  revealHeading: "Your words",
  IntroExample,
  Stage,
  Reveal,
};
