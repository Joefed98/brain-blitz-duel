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
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragged = useRef(false);
  const suppressClick = useRef(false);
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

  // The round always runs the full minute; the found words go in just before
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

  const addDraggedTile = (index: number) => {
    if (selectedRef.current.includes(index)) return;
    selectedRef.current = [...selectedRef.current, index];
    setSelectedTiles(selectedRef.current);
    setMessage(null);
  };

  const tileAt = (x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-wordsmith-tile]");
    if (!element || !wheelRef.current?.contains(element)) return null;
    const index = Number(element.dataset.wordsmithTile);
    return Number.isInteger(index) ? index : null;
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
        role="button"
        tabIndex={0}
        aria-label="Submit word"
        onClick={() => void trySubmit()}
        onKeyDown={(event) => { if (event.key === "Enter") void trySubmit(); }}
        className={`flex min-h-14 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 ${
          message ? "border-warn animate-shake" : ""
        }`}
      >
        {word.length === 0 ? (
          <span className="font-mono text-base text-muted-foreground">{message ?? ""}</span>
        ) : (
          selectedTiles.map((tileIndex, position) => (
            <button
              key={tileIndex}
              type="button"
              onClick={(event) => { event.stopPropagation(); removeAt(position); }}
              className="font-mono text-[1.2rem] font-bold uppercase text-primary"
            >
              {letters[tileIndex]}
            </button>
          ))
        )}
      </div>
      {message && word.length > 0 && (
        <p className="text-center font-mono text-xs text-warn">{message}</p>
      )}

      {/* The wheel uses fixed-size tiles, with pointer capture for continuous tracing. */}
      <div
        ref={wheelRef}
        className="relative mx-auto aspect-square w-[min(100%,260px)] shrink-0 select-none touch-none"
        onPointerMove={(event) => {
          if (!dragging.current) return;
          const index = tileAt(event.clientX, event.clientY);
          if (index !== null && !selectedRef.current.includes(index)) {
            dragged.current = true;
            addDraggedTile(index);
          }
        }}
        onPointerUp={() => {
          if (!dragging.current) return;
          dragging.current = false;
          if (dragged.current) void trySubmit(selectedRef.current);
        }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {order.map((index, position) => {
          const spent = selectedTiles.includes(index);
          const angle = -Math.PI / 2 + (position * 2 * Math.PI) / order.length;
          return (
            <button
              key={index}
              type="button"
              data-wordsmith-tile={index}
              disabled={locked}
              onPointerDown={(event) => {
                event.preventDefault();
                wheelRef.current?.setPointerCapture(event.pointerId);
                dragging.current = true;
                dragged.current = false;
                suppressClick.current = true;
                addDraggedTile(index);
              }}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } tapTile(index); }}
              style={{ left: `${50 + 37 * Math.cos(angle)}%`, top: `${50 + 37 * Math.sin(angle)}%` }}
              className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border font-display text-xl font-bold transition-colors duration-150 ${
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
      </div>
    </div>
  );
}
