import { playCorrect, playWrong } from "@/lib/sound";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  adjacentGridCellAt,
  gridCellAt,
  gridGeometry,
  hapticTick,
} from "@/components/puzzles/GridDrag";
import {
  WORDHUNT_COLS as N,
  WORDHUNT_MIN_LENGTH,
  WORDHUNT_TIME_MS,
  type WordHuntPuzzleData,
} from "@/lib/duel/types";
import type { CheckWord } from "@/puzzles/types";

interface Found {
  word: string;
  points: number;
  path: number[];
}

function adjacent(a: number, b: number): boolean {
  const dr = Math.abs(Math.floor(a / N) - Math.floor(b / N));
  const dc = Math.abs((a % N) - (b % N));
  return dr <= 1 && dc <= 1 && a !== b;
}

const centre = (cell: number) => ({
  x: ((cell % N) + 0.5) * (100 / N),
  y: (Math.floor(cell / N) + 0.5) * (100 / N),
});

/** The letter grid, with an optional gold path drawn through it. */
export function WordHuntBoard({
  grid,
  path = [],
  size,
  interactive = false,
  onPathStart,
  gridRef,
  pointer,
}: {
  grid: string[];
  path?: number[];
  size?: number;
  interactive?: boolean;
  onPathStart?: (cell: number, event: React.PointerEvent) => void;
  gridRef?: React.Ref<HTMLDivElement>;
  pointer?: { x: number; y: number } | null;
}) {
  return (
    <div
      className="relative aspect-square w-full select-none"
      style={{
        ...(size ? { width: size, height: size } : {}),
        containerType: "inline-size",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        aria-hidden="true"
      >
        {path.length > 1 && (
          <polyline
            points={path.map((cell) => `${centre(cell).x},${centre(cell).y}`).join(" ")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}
        {path.length > 0 && pointer && (
          <line
            x1={centre(path[path.length - 1] ?? 0).x}
            y1={centre(path[path.length - 1] ?? 0).y}
            x2={pointer.x}
            y2={pointer.y}
            stroke="var(--primary)"
            strokeWidth={2.6}
            strokeLinecap="round"
            opacity={0.9}
          />
        )}
      </svg>
      <div
        ref={gridRef}
        className="grid h-full w-full grid-cols-4 gap-2"
        className="puzzle-board"
      >
        {grid.map((letter, cell) => {
          const lit = path.includes(cell);
          return (
            <div
              key={cell}
              data-cell={cell}
              onPointerDown={
                interactive && onPathStart ? (event) => onPathStart(cell, event) : undefined
              }
              className={`flex items-center justify-center rounded-lg border font-display font-bold uppercase transition-colors duration-100 ${
                lit
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-card text-foreground"
              }`}
              style={{
                fontSize: "max(10px, calc((100cqw - 24px) / 4 * 0.6))",
                lineHeight: 1,
                touchAction: "none",
              }}
            >
              {letter === "QU" ? "Qu" : letter}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface WordHuntPuzzleProps {
  puzzle: WordHuntPuzzleData;
  phaseStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string) => void;
  checkWord?: CheckWord;
}

export function WordHuntPuzzle({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  checkWord,
}: WordHuntPuzzleProps) {
  const grid = puzzle.grid;
  const [path, setPath] = useState<number[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tracing = useRef(false);
  const livePath = useRef<number[]>([]);
  const foundRef = useRef<Found[]>([]);
  const submitted = useRef(false);
  foundRef.current = found;

  const points = found.reduce((sum, entry) => sum + entry.points, 0);

  const lockIn = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    onSubmit(foundRef.current.map((entry) => `${entry.word}:${entry.path.join("-")}`).join(","));
  }, [onSubmit]);

  // The round runs the full minute; the traced words go in just before it ends.
  useEffect(() => {
    if (locked) return;
    const remaining = phaseStartedAt + WORDHUNT_TIME_MS - now;
    if (remaining <= 600) lockIn();
  }, [locked, now, phaseStartedAt, lockIn]);

  const wordOf = useCallback(
    (cells: number[]) =>
      cells
        .map((cell) => grid[cell] ?? "")
        .join("")
        .toUpperCase(),
    [grid],
  );

  const finish = useCallback(async () => {
    const cells = livePath.current;
    tracing.current = false;
    livePath.current = [];
    setPath([]);
    setPointer(null);
    if (cells.length < 2) return;
    const word = wordOf(cells);
    if (word.length < WORDHUNT_MIN_LENGTH) {
      playWrong();
      setFlash("bad");
      setMessage(`${WORDHUNT_MIN_LENGTH} letters or more`);
      return;
    }
    if (!checkWord) return;
    const verdict = await checkWord(
      word,
      foundRef.current.map((entry) => entry.word),
      cells,
    );
    if (verdict.valid) {
      setFound((current) => [
        { word: verdict.word, points: verdict.points, path: cells },
        ...current,
      ]);
      playCorrect();
      setFlash("good");
      setMessage(null);
      hapticTick();
    } else {
      setFlash("bad");
      setMessage(verdict.reason ?? "Not a word");
    }
  }, [checkWord, wordOf]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 420);
    return () => clearTimeout(id);
  }, [flash]);

  const cellAt = (x: number, y: number): number | null => gridCellAt(gridRef.current, x, y, N, N);

  const startTrace = (cell: number, event: React.PointerEvent) => {
    if (locked) return;
    event.preventDefault();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is a nicety; the window listeners still follow the finger.
    }
    tracing.current = true;
    livePath.current = [cell];
    setPath([cell]);
    setPointer(centre(cell));
    setMessage(null);
    hapticTick();
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!tracing.current) return;
      const current = livePath.current;
      const last = current[current.length - 1];
      if (last === undefined) return;
      const geometry = gridGeometry(gridRef.current, event.clientX, event.clientY, N, N);
      if (geometry) {
        setPointer({
          x: (geometry.x / geometry.width) * 100,
          y: (geometry.y / geometry.height) * 100,
        });
      }
      const direct = cellAt(event.clientX, event.clientY);
      const cell =
        direct === last
          ? last
          : adjacentGridCellAt(gridRef.current, event.clientX, event.clientY, N, N, last);
      if (cell === null) return;
      if (cell === last) return;
      if (current.length > 1 && cell === current[current.length - 2]) {
        livePath.current = current.slice(0, -1);
        setPath(livePath.current);
        return;
      }
      if (current.includes(cell) || last === undefined || !adjacent(last, cell)) return;
      livePath.current = [...current, cell];
      setPath(livePath.current);
      hapticTick();
    };
    const up = () => {
      if (!tracing.current) return;
      void finish();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [finish]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          points <span className="text-primary">{points}</span>
        </span>
        <span>words: {found.length}</span>
      </div>

      <div
        className={`-mx-1 flex min-h-0 flex-1 items-center justify-center rounded-xl p-1 transition-colors duration-150 ${
          flash === "good" ? "bg-ok/25" : flash === "bad" ? "bg-warn/25" : "bg-transparent"
        }`}
      >
        <div className="aspect-square h-auto max-h-full w-auto max-w-full flex-1">
          <WordHuntBoard
            grid={grid}
            path={path}
            interactive={!locked}
            onPathStart={startTrace}
            gridRef={gridRef}
            pointer={pointer}
          />
        </div>
      </div>

      {message && <p className="text-center font-mono text-xs text-warn">{message}</p>}

      <button
        type="button"
        onClick={lockIn}
        disabled={locked}
        className="press tap-target rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
      >
        Done
      </button>
    </div>
  );
}
