import { playCorrect, playWrong } from "@/lib/sound";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  WORDSMITH_MIN_LENGTH,
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
  const letters = puzzle.letters;
  const [order, setOrder] = useState(() => letters.map((_, i) => i));
  const [selectedTiles, setSelectedTiles] = useState<number[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitted = useRef(false);
  const foundRef = useRef<Found[]>([]);
  foundRef.current = found;

  const word = selectedTiles.map((index) => letters[index] ?? "").join("");
  const points = found.reduce((sum, entry) => sum + entry.points, 0);

  const lockIn = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    onSubmit(foundRef.current.map((entry) => entry.word).join(","));
  }, [onSubmit]);

  // The round always runs the full minute; the found words go in just before
  // the clock stops so nothing is lost to the timeout.
  useEffect(() => {
    if (locked) return;
    const remaining = phaseStartedAt + WORDSMITH_TIME_MS - now;
    if (remaining <= 600) lockIn();
  }, [locked, now, phaseStartedAt, lockIn]);

  const trySubmit = async () => {
    if (locked || busy) return;
    const candidate = word.trim().toUpperCase();
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
      playCorrect();
      setFound((current) => [{ word: verdict.word, points: verdict.points }, ...current]);
      setSelectedTiles([]);
      setMessage(null);
    } else {
      playWrong();
      setMessage(verdict.reason ?? "Not a word");
      setShake((n) => n + 1);
    }
  };

  const tapTile = (index: number) => {
    if (locked) return;
    const usedAt = selectedTiles.indexOf(index);
    if (usedAt >= 0) {
      removeAt(usedAt);
      return;
    }
    setMessage(null);
    setSelectedTiles((current) => [...current, index]);
  };

  const removeAt = (position: number) => {
    if (locked) return;
    setSelectedTiles((current) => current.filter((_, index) => index !== position));
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          points <span className="text-primary">{points}</span>
        </span>
        <span>words: {found.length}</span>
      </div>

      {/* The word being built. */}
      <div
        key={shake}
        className={`flex min-h-14 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 ${
          message ? "border-warn animate-shake" : ""
        }`}
      >
        {word.length === 0 ? (
          <span className="font-mono text-sm text-muted-foreground">
            {message ?? "Tap or type letters"}
          </span>
        ) : (
          selectedTiles.map((tileIndex, position) => (
            <button
              key={tileIndex}
              type="button"
              onClick={() => removeAt(position)}
              className="font-mono text-2xl font-bold uppercase tracking-[0.15em] text-primary"
            >
              {letters[tileIndex]}
            </button>
          ))
        )}
      </div>
      {message && word.length > 0 && (
        <p className="text-center font-mono text-xs text-warn">{message}</p>
      )}

      {/* Tiles — always one row, sized to fit however many letters there are. */}
      <div
        className="grid w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${letters.length || 1}, minmax(0, 1fr))` }}
      >
        {order.map((index) => {
          const spent = selectedTiles.includes(index);
          return (
            <button
              key={index}
              type="button"
              disabled={locked}
              onClick={() => tapTile(index)}
              className={`flex h-12 w-full items-center justify-center rounded-xl border font-display text-lg font-bold transition-transform duration-150 ${
                spent
                  ? "-translate-y-1 border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {letters[index]}
            </button>
          );
        })}
      </div>

      {/* Keyboard entry: highlights the matching tiles as you type. */}
      <input
        ref={inputRef}
        value={word}
        disabled={locked}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        maxLength={letters.length}
        placeholder="type here"
          onChange={(event) => {
          const next = event.target.value.toUpperCase().replace(/[^A-Z]/g, "");
            if (next === word.slice(0, -1)) {
              setSelectedTiles((current) => current.slice(0, -1));
              setMessage(null);
              return;
            }
            if (!next.startsWith(word) || next.length !== word.length + 1) return;
            const typed = next.at(-1);
            const tileIndex = order.find(
              (index) => letters[index] === typed && !selectedTiles.includes(index),
            );
            if (tileIndex === undefined) return;
          setMessage(null);
            setSelectedTiles((current) => [...current, tileIndex]);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") void trySubmit();
        }}
        className="tap-target w-full rounded-xl border border-border bg-card px-4 text-center font-mono text-base uppercase tracking-[0.2em] text-foreground placeholder:tracking-normal placeholder:text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelectedTiles((current) => current.slice(0, -1))}
          disabled={locked || word.length === 0}
          className="press tap-target rounded-xl border border-border bg-card px-3 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground disabled:opacity-35"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => void trySubmit()}
          disabled={locked || busy}
          className="press tap-target flex-1 rounded-xl bg-primary font-display text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedTiles([]);
            setOrder((current) => [...current].sort(() => Math.random() - 0.5));
            inputRef.current?.blur();
          }}
          disabled={locked}
          className="press tap-target rounded-xl border border-border bg-card px-4 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Shuffle
        </button>
        <button
          type="button"
          onClick={lockIn}
          disabled={locked}
          className="press tap-target rounded-xl border border-border bg-card px-4 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Done
        </button>
      </div>

    </div>
  );
}
