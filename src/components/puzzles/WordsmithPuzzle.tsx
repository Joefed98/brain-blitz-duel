import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AcceptedWordChip } from "./AcceptedWordChip";
import { WordsmithRing } from "./WordsmithRing";
import { toggleWordsmithTile } from "./wordInput";
import { Shuffle } from "lucide-react";
import { shuffleLetterOrder } from "./letterShuffle";

import {
  WORDSMITH_MIN_LENGTH,
  WORDSMITH_CENTRE_INDEX,
  WORDSMITH_TIME_MS,
  type WordsmithPuzzleData,
} from "@/lib/duel/types";
import type { CheckWord } from "@/puzzles/types";

interface WordsmithPuzzleProps {
  puzzle: WordsmithPuzzleData;
  phaseStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string) => void;
  checkWord?: CheckWord;
}

interface Found {
  word: string;
  points: number;
}

export function WordsmithPuzzle({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  checkWord,
}: WordsmithPuzzleProps) {
  const column = useGameColumnLayout();
  const letters = puzzle.letters;
  const [order, setOrder] = useState(() => letters.map((_, i) => i));
  const [selectedTiles, setSelectedTiles] = useState<number[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedWord, setAcceptedWord] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const selectedRef = useRef<number[]>([]);
  const submitted = useRef(false);
  const foundRef = useRef<Found[]>([]);
  foundRef.current = found;

  selectedRef.current = selectedTiles;
  const word = selectedTiles.map((index) => letters[index] ?? "").join("");
  const points = found.reduce((sum, entry) => sum + entry.points, 0);

  const lockIn = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    onSubmit(foundRef.current.map((entry) => entry.word).join(","));
  }, [onSubmit]);

  // The round always runs the full clock; the found words go in just before
  // the clock stops so nothing is lost to the timeout.
  useEffect(() => {
    if (locked) return;
    const remaining = phaseStartedAt + WORDSMITH_TIME_MS - now;
    if (remaining <= 600) lockIn();
  }, [locked, now, phaseStartedAt, lockIn]);

  const trySubmit = async (indices = selectedRef.current) => {
    if (locked || busy) return;
    const candidate = indices.map((index) => letters[index] ?? "").join("").trim().toUpperCase();
    if (candidate.length < WORDSMITH_MIN_LENGTH) {
      setMessage(`${WORDSMITH_MIN_LENGTH} letters or more`);
      setShake((n) => n + 1);
      return;
    }
    if (!checkWord) return;
    setBusy(true);
    const verdict = await checkWord(
      candidate,
      found.map((entry) => entry.word),
    );
    setBusy(false);
    if (verdict.valid) {
      setFound((current) => [{ word: verdict.word, points: verdict.points }, ...current]);
      selectedRef.current = [];
      setSelectedTiles([]);
      setMessage(null);
      setAcceptedWord(verdict.word);
    } else {
      setMessage(verdict.reason ?? "Not a word");
      setShake((n) => n + 1);
    }
  };

  const tapTile = (index: number) => {
    if (locked || busy) return;
    setMessage(null);
    selectedRef.current = toggleWordsmithTile(selectedRef.current, index);
    setSelectedTiles(selectedRef.current);
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          points <span className="text-primary">{points}</span>
        </span>
        <button
          type="button"
          onClick={() => setListOpen((open) => !open)}
          aria-expanded={listOpen}
          className="press rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-foreground"
        >
          Words {found.length} / {puzzle.wordCount ?? "?"}
        </button>
        {listOpen && (
          <>
            <div className="fixed inset-0 z-20" onPointerDown={() => setListOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full z-30 mt-2 max-h-72 w-60 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-lg">
              <p className="mb-2 text-[11px] text-muted-foreground">
                {found.length} of {puzzle.wordCount ?? "?"} possible words
              </p>
              {found.length === 0 ? (
                <p className="text-sm normal-case tracking-normal text-muted-foreground">No words yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {[...found]
                    .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word))
                    .map((entry) => (
                      <li key={entry.word} className="flex justify-between text-sm text-foreground">
                        <span>{entry.word}</span>
                        <span className="text-primary">{entry.points}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <div data-game-arena="word" className="flex min-h-0 flex-1 flex-col items-center">
        <AcceptedWordChip word={acceptedWord} hidden={listOpen} />
        <div className="word-confirmation-board-space">
          <div className="word-confirmation-board">
            <WordsmithRing letters={letters} order={order} selected={selectedTiles} disabled={locked || busy} onTap={tapTile} />
          </div>
        </div>
      </div>
      <div key={shake} aria-live="polite" aria-label="Current word"
        data-game-controls="input" className={`flex h-11 shrink-0 items-center justify-center rounded-lg border bg-card px-2 text-center font-mono text-xl uppercase text-foreground ${message ? "border-warn animate-shake" : "border-border"}`}>
        {word || " "}
      </div>
      <p data-game-controls="status" className="h-4 shrink-0 truncate text-center font-mono text-xs text-warn">{message ?? ""}</p>

      <div data-game-controls="actions" className={`${column ? "" : "mt-auto "}grid shrink-0 grid-cols-[44px_1fr_1fr] gap-2`}>
        <Button type="button" variant="outline" className="h-11 w-11 p-0" aria-label="Shuffle letters" title="Shuffle letters" disabled={locked || busy} onClick={() => setOrder(current => shuffleLetterOrder(current, WORDSMITH_CENTRE_INDEX))}><Shuffle className="h-5 w-5" /></Button>
        <Button type="button" variant="outline" onClick={() => {
          selectedRef.current = [];
          setSelectedTiles([]);
          setMessage(null);
        }} disabled={locked || busy || word.length === 0} className="h-11" >Clear</Button>
        <Button type="button" onClick={() => void trySubmit()} disabled={locked || busy || word.length === 0}
          className="h-11">Enter</Button>
      </div>
    </div>
  );
}
