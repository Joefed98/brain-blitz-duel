import { useGameKeys } from "@/lib/desktop";
import { playWrong } from "@/lib/sound";
import { useCallback, useEffect, useRef, useState } from "react";
import { AcceptedWordChip } from "./AcceptedWordChip";
import { extendWordHuntPath, wordHuntInnerCell } from "./wordInput";

import {
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
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { scoreWordHunt } from "@/lib/duel/scoring";
import { goldPulse, playFinish, rippleDelay, useWordFinish, wordCue, WORD_FINISH_SCORE, type FinishStep } from "./wordFinish";

interface Found {
  word: string;
  points: number;
  path: number[];
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
            stroke="var(--category-accent)"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.5}
          />
        )}
        {path.length > 0 && pointer && (
          <line
            x1={centre(path[path.length - 1] ?? 0).x}
            y1={centre(path[path.length - 1] ?? 0).y}
            x2={pointer.x}
            y2={pointer.y}
            stroke="var(--category-accent)"
            strokeWidth={2.6}
            strokeLinecap="round"
            opacity={0.5}
          />
        )}
      </svg>
      <div ref={gridRef} className="puzzle-board grid h-full w-full gap-1.5"
        style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
        {grid.map((letter, cell) => {
          const lit = path.includes(cell);
          return (
            <div
              key={cell}
              data-cell={cell}
              onPointerDown={
                interactive && onPathStart ? (event) => onPathStart(cell, event) : undefined
              }
              className={`word-letter-tile flex items-center justify-center rounded-lg border font-display font-bold uppercase transition-colors duration-100 ${
                lit
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border bg-card text-foreground"
              }`}
              style={{
                fontSize: `max(10px, calc((100cqw - ${(N - 1) * 6}px) / ${N} * 0.55))`,
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
  const [acceptedWord, setAcceptedWord] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tracing = useRef(false);
  const activePointer = useRef<number | null>(null);
  const dragging = useRef(false);
  const pointerStart = useRef<{ cell: number; x: number; y: number } | null>(null);
  const livePath = useRef<number[]>([]);
  const foundRef = useRef<Found[]>([]);
  const submitted = useRef(false);
  const [runEnded, setRunEnded] = useState(false);
  foundRef.current = found;

  const points = found.reduce((sum, entry) => sum + entry.points, 0);

  const lockIn = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    setRunEnded(true);
    onSubmit(foundRef.current.map((entry) => `${entry.word}:${entry.path.join("-")}`).join(","));
  }, [onSubmit]);

  // A run worth 120+ on this phone's count: a ripple runs out across the letter grid (display only).
  useWordFinish(runEnded && scoreWordHunt(points, puzzle.wordHuntRev) >= WORD_FINISH_SCORE, () => {
    wordCue("wordhunt.finish");
    const mid = (N - 1) / 2;
    const steps: FinishStep[] = [...(gridRef.current?.children ?? [])].map((el, cell) => ({
      el,
      keyframes: goldPulse(1.1),
      delay: rippleDelay(cell, N, mid, mid, 150),
      duration: 460,
    }));
    return playFinish(steps);
  });

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
      puzzleReject(gridRef.current);
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
      setFlash("good");
      setMessage(null);
      setAcceptedWord(verdict.word);
      hapticTick();
    } else {
      setFlash("bad");
      puzzleReject(gridRef.current);
      setMessage(verdict.reason ?? "Not a word");
    }
  }, [checkWord, wordOf]);

  // Desktop keys: typing a letter taps a cell with it next to the path's end (the first such cell; anywhere to
  // start), Backspace taps the end again (taking it off), Enter submits the word.
  useGameKeys((kind, key, event) => {
    if (/^[a-z]$/.test(key)) {
      if (kind === "down" && !locked && !tracing.current) {
        const current = livePath.current;
        const last = current[current.length - 1];
        const letter = key.toUpperCase();
        for (let cell = 0; cell < N * N; cell++) {
          if (String(grid[cell] ?? "").toUpperCase() !== letter || current.includes(cell)) continue;
          if (last !== undefined && (Math.abs(Math.floor(cell / N) - Math.floor(last / N)) > 1 || Math.abs((cell % N) - (last % N)) > 1)) continue;
          tapCell(cell);
          break;
        }
      }
      return true;
    }
    if (key === "Backspace") {
      const last = livePath.current[livePath.current.length - 1];
      if (kind === "down" && !locked && !tracing.current && last !== undefined) tapCell(last);
      return true;
    }
    if (key === "Enter") {
      if (kind === "down" && !event.repeat && !locked && !tracing.current && livePath.current.length > 0) void finish();
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 420);
    return () => clearTimeout(id);
  }, [flash]);

  const cellAt = (x: number, y: number): number | null => wordHuntInnerCell(gridGeometry(gridRef.current, x, y, N, N), N, N);

  const startTrace = (cell: number, event: React.PointerEvent) => {
    if (locked || tracing.current) return;
    const hit = cellAt(event.clientX, event.clientY);
    if (hit === null || hit !== cell) return;
    event.preventDefault();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is a nicety; the window listeners still follow the finger.
    }
    tracing.current = true;
    activePointer.current = event.pointerId;
    dragging.current = false;
    pointerStart.current = { cell, x: event.clientX, y: event.clientY };
    setPointer(centre(cell));
    setMessage(null);
  };

  const tapCell = useCallback((cell: number) => {
    const current = livePath.current;
    const last = current[current.length - 1];
    const next = last === cell ? current.slice(0, -1) : extendWordHuntPath(current, cell, N);
    livePath.current = next;
    setPath(next);
    setPointer(centre(cell));
    hapticTick();
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!tracing.current || activePointer.current !== event.pointerId) return;
      const origin = pointerStart.current;
      if (!dragging.current) {
        if (!origin || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 8) return;
        dragging.current = true;
        livePath.current = [origin.cell];
        setPath([origin.cell]);
        hapticTick();
      }
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
      const cell = wordHuntInnerCell(geometry, N, N);
      if (cell === null) return;
      const next = extendWordHuntPath(current, cell, N);
      if (next.length === current.length) return;
      livePath.current = next;
      setPath(next);
      hapticTick();
    };
    const up = (event: PointerEvent) => {
      if (!tracing.current || activePointer.current !== event.pointerId) return;
      const origin = pointerStart.current;
      tracing.current = false;
      activePointer.current = null;
      pointerStart.current = null;
      if (event.type === "pointercancel") {
        dragging.current = false;
        livePath.current = [];
        setPath([]);
        setPointer(null);
        return;
      }
      if (dragging.current) {
        dragging.current = false;
        void finish();
      } else if (origin) {
        tapCell(origin.cell);
      }
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [finish, tapCell]);

  return (
    <div data-polish="wordhunt" data-stage-column="2" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid grid-cols-2 items-center font-mono text-base font-semibold uppercase text-foreground">
        <span>
          points <span className="text-primary">{points}</span>
        </span>
        <span className="text-right">words: {found.length}</span>
      </div>

      <div
        data-game-arena="word" className={`flex min-h-0 flex-1 flex-col items-center rounded-xl transition-colors duration-150 ${
          flash === "good" ? "bg-ok/25" : "bg-transparent"
        }`}
      >
        <AcceptedWordChip word={acceptedWord} />
        <div className="word-confirmation-board-space">
        <div className="word-confirmation-board">
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
      </div>

      <p data-game-controls="status" className="h-4 shrink-0 truncate text-center font-mono text-xs text-warn">{message ?? ""}</p>

      <button
        type="button"
        onClick={() => void finish()}
        disabled={locked || path.length === 0}
        data-game-controls="actions" className="press tap-target rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
