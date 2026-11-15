import { gameDisplayName } from "@/lib/duel/gameNames";
import { roundMaxFor } from "@/lib/duel/roundMax";
import { WordsmithRing } from "@/components/puzzles/WordsmithRing";
import { WordsmithPuzzle } from "@/components/puzzles/WordsmithPuzzle";
import { wordsmithPoints, type WordsmithPuzzleData } from "@/lib/duel/types";
import { WORDSMITH_TIME_MS } from "@/lib/duel/types";
import { WORDSMITH_V3_PANGRAM_BONUS } from "@/lib/duel/scoring";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { WORDSMITH_REV_EVERYDAY } from "@/lib/duel/wordOverhaul";
import { WordDropList } from "@/components/puzzles/WordDropList";
import { RevealChips, RevealHeadline, RevealLabel, RevealNumbers, TileRow, type RevealChip } from "@/components/puzzles/WordReveal";

/** Fixed intro example — never randomised. Centre letter is index 4. */
const EXAMPLE_TILES = ["C", "A", "R", "E", "P", "N", "T", "E", "R"];
const EXAMPLE_WORDS = ["CARPENTER", "PARENT", "CARPET", "REPENT"];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Tap the round tiles to make words – the glowing centre letter must be in every word.
      </p>
      <div className="flex items-start gap-4">
        <div className="wordsmith-ring-example w-[160px] shrink-0">
          <WordsmithRing letters={EXAMPLE_TILES} />
        </div>
        <ul className="flex flex-col gap-1">
          {EXAMPLE_WORDS.map((word) => (
            <li key={word} className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest">
              <span>{word}</span>
              <span className="text-primary">{wordsmithPoints(word)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">No plurals. Longer words score more: 9+ letters is 15 word points. More word points, higher score; the word that uses every tile adds a {WORDSMITH_V3_PANGRAM_BONUS}-point bonus, {roundMaxFor("wordsmith")} only with it. You have 100 seconds.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, checkWord, stateKey }: PuzzleStageProps) {
  if (puzzle.type !== "wordsmith") return null;
  return (
    <WordsmithPuzzle
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

/**
 * The Word overhaul's reveal (wordsmithRev 5+): the every-tile word drawn large in gold tiles, your words as chips (the
 * longest gold, obscure ones marked bonus), the best words you missed, and the numbers the score is made of: word
 * points, the board's everyday words you found and the every-tile word.
 */
function RevealOverhaul({ puzzle, myAnswer, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "wordsmith") return null;
  const mine = (myAnswer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const everyday = new Set((puzzle.words ?? []).map((entry) => entry.word));
  const pangram = puzzle.source ?? (puzzle.words ?? []).find((entry) => entry.word.length === puzzle.letters.length)?.word ?? "";
  const pangramFound = mine.some((w) => w.length >= puzzle.letters.length);
  const points = typeof myExtra?.["points"] === "number" ? (myExtra["points"] as number) : mine.reduce((sum, w) => sum + wordsmithPoints(w), 0);
  const counted = mine.filter((w) => everyday.has(w)).length;
  const longest = mine.reduce((best, w) => (w.length > best.length ? w : best), "");
  const yours: RevealChip[] = [...mine]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map((w) => ({ text: w, sub: wordsmithPoints(w), kind: w === longest && mine.length > 1 ? "longest" : everyday.has(w) ? "found" : "bonus" }));
  const missed = (puzzle.words ?? [])
    .filter((entry) => !mine.includes(entry.word))
    .sort((a, b) => b.word.length - a.word.length || b.points - a.points)
    .slice(0, 8);
  const size = Math.max(28, Math.min(40, Math.floor((330 - (pangram.length - 1) * 4) / Math.max(1, pangram.length))));
  return (
    <div data-word-reveal="wordsmith" data-wr-version="overhaul" className="wr">
      <RevealHeadline>{mine.length} {mine.length === 1 ? "word" : "words"}</RevealHeadline>
      <RevealNumbers
        items={[
          { id: "points", label: "Word points", value: points, tone: "gold" },
          { id: "counted", label: "Board words found", value: `${counted}/${puzzle.wordCount ?? everyday.size}` },
          { id: "pangram", label: "Every-tile word", value: pangramFound ? "Found" : "Missed", tone: pangramFound ? "gold" : undefined },
        ]}
      />
      {pangram ? (
        <div className="flex flex-col items-center gap-1">
          <RevealLabel>The every-tile word</RevealLabel>
          <TileRow id="pangram" letters={[...pangram]} tones={[...pangram].map(() => (pangramFound ? "gold" : "black"))} size={size} />
        </div>
      ) : null}
      {yours.length > 0 ? (
        <div className="flex w-full flex-col items-center gap-1.5">
          <RevealLabel>Your words</RevealLabel>
          <RevealChips id="yours" items={yours} />
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
  if (props.puzzle.type === "wordsmith" && (props.puzzle.wordsmithRev ?? 0) >= WORDSMITH_REV_EVERYDAY) return <RevealOverhaul {...props} />;
  return <RevealOlder {...props} />;
}

function RevealOlder({ puzzle, myAnswer, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "wordsmith") return null;
  const mine = (myAnswer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const missed = (puzzle.words ?? [])
    .filter((entry) => !mine.includes(entry.word))
    .sort((a, b) => b.word.length - a.word.length || b.points - a.points)
    .slice(0, 5);
  const everyday = (puzzle.wordsmithRev ?? 0) >= WORDSMITH_REV_EVERYDAY && puzzle.words ? new Set(puzzle.words.map((entry) => entry.word)) : null;
  const pangram = puzzle.source ?? (puzzle.words ?? []).find((entry) => entry.word.length === puzzle.letters.length)?.word;

  // Sized so all 25-odd words of a board fit on one 375×667 screen: the ring sits
  // beside the counts, and both lists run in compact columns (14 px text).
  return (
    <div data-word-reveal="wordsmith" className="flex w-full flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        <div className="wordsmith-ring-example w-[112px] shrink-0">
          <WordsmithRing letters={puzzle.letters} />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-base font-semibold text-foreground">{mine.length} {mine.length === 1 ? "word" : "words"}</p>
          {pangram && (
            <p className="text-muted-foreground">
              {puzzle.letters.length}-letter word:
              <br />
              <span className="text-primary">{pangram}</span>
              {/* wordsmithRev 3: the stored pangram bonus (never computed here). */}
              {typeof myExtra?.["pangramBonus"] === "number" && myExtra["pangramBonus"] > 0 ? (
                <span className="text-primary"> +{myExtra["pangramBonus"]}</span>
              ) : null}
            </p>
          )}
        </div>
      </div>

      {mine.length > 0 && (
        <WordDropList
          className="word-reveal-list w-full"
          words={mine.map((word) => ({
            word,
            points: wordsmithPoints(word),
            // wordsmithRev 5: a word off the board's everyday list was a bonus word.
            bonus: everyday ? !everyday.has(word) : false,
          }))}
        />
      )}

      {missed.length > 0 && (
        <div className="flex w-full flex-col items-center gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">You missed</p>
          <ul className="word-reveal-list word-reveal-missed w-full">
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
 * Wordsmith is generated, checked and scored entirely on the server (the
 * dictionary never reaches a device), so the client definition only renders.
 */
export const wordsmithPuzzle: PuzzleDefinition = {
  key: "wordsmith",
  name: gameDisplayName("wordsmith"),
  category: "word",
  timeLimitMs: WORDSMITH_TIME_MS,
  generate: () => ({ type: "wordsmith", letters: [] }) satisfies WordsmithPuzzleData,
  check: () => false,
  revealHeading: "Your words",
  IntroExample,
  Stage,
  Reveal,
};
