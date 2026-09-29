import { playCorrect, playWrong } from "@/lib/sound";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

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
  const pointerStart = useRef<{ x: number; y: number; index: number; initial: number[] } | null>(null);
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

  const tapTile = (index: number, from = selectedRef.current) => {
    if (locked) return;
    const usedAt = from.indexOf(index);
    if (usedAt >= 0) {
      selectedRef.current = from.slice(0, usedAt);
      setSelectedTiles(selectedRef.current);
      return;
    }
    setMessage(null);
    selectedRef.current = [...from, index];
    setSelectedTiles(selectedRef.current);
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
    const index = Number(element.dataset["wordsmithTile"]);
    return Number.isInteger(index) ? index : null;
  };

  const removeAt = (position: number) => {
    if (locked) return;
    setSelectedTiles((current) => current.slice(0, position));
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          points <span className="text-primary">{points}</span>
        </span>
        <span>words: {found.length}</span>
      </div>

      {/* The wheel uses fixed-size tiles, with pointer capture for continuous tracing. */}
      <div
        ref={wheelRef}
        className="relative mx-auto aspect-square w-[min(100%,300px)] shrink-0 select-none touch-none"
        onPointerMove={(event) => {
          if (!dragging.current) return;
          const origin = pointerStart.current;
          if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >= 8) dragged.current = true;
          if (!dragged.current) return;
          const index = tileAt(event.clientX, event.clientY);
          if (index !== null && !selectedRef.current.includes(index)) {
            addDraggedTile(index);
          }
        }}
        onPointerUp={() => {
          if (!dragging.current) return;
          dragging.current = false;
          const origin = pointerStart.current;
          pointerStart.current = null;
          if (dragged.current) void trySubmit(selectedRef.current);
          else if (origin) {
            tapTile(origin.index, origin.initial);
          }
        }}
        onPointerCancel={() => {
          const origin = pointerStart.current;
          if (origin) setSelectedTiles(origin.initial);
          pointerStart.current = null;
          dragging.current = false;
        }}
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
                 pointerStart.current = { x: event.clientX, y: event.clientY, index, initial: [...selectedRef.current] };
                 if (!selectedRef.current.includes(index)) addDraggedTile(index);
              }}
              style={{ left: `${50 + 37 * Math.cos(angle)}%`, top: `${50 + 37 * Math.sin(angle)}%` }}
              className={`absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border font-display text-xl font-bold transition-colors duration-150 ${
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
        aria-label="Word entry; tap to submit a word"
        onPointerDown={(event) => {
          if (word.length > 0) {
            event.preventDefault();
            void trySubmit();
          }
        }}
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
          if (event.key === "Enter") {
            event.preventDefault();
            void trySubmit();
          }
        }}
        key={shake}
        className={`tap-target w-full rounded-xl border bg-card px-4 text-center font-mono text-base uppercase tracking-[0.2em] text-foreground placeholder:tracking-normal placeholder:text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50 ${message ? "border-warn animate-shake" : "border-border"}`}
      />
      {message && <p className="text-center font-mono text-xs text-warn">{message}</p>}

       <div className="mt-auto flex gap-2">
         <Button
          type="button"
           variant="outline"
          onClick={() => setSelectedTiles((current) => current.slice(0, -1))}
          disabled={locked || word.length === 0}
           className="press tap-target h-11 rounded-xl border-border bg-card px-3 font-display text-xs font-semibold uppercase text-muted-foreground disabled:opacity-35"
        >
          Undo
         </Button>
         <Button
          type="button"
           variant="outline"
          onClick={() => {
            setSelectedTiles([]);
            setOrder((current) => [...current].sort(() => Math.random() - 0.5));
            inputRef.current?.blur();
          }}
          disabled={locked}
           className="press tap-target h-11 rounded-xl border-border bg-card px-4 font-display text-xs font-semibold uppercase text-muted-foreground"
        >
          Shuffle
         </Button>
         <Button
           type="button"
           onClick={() => void trySubmit()}
           disabled={locked || busy || word.length === 0}
           className="press tap-target ml-auto h-11 rounded-xl px-4 font-display text-xs font-semibold uppercase disabled:opacity-35"
         >
           Submit
         </Button>
      </div>
    </div>
  );
}
