import { useEffect, useRef, useState } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { useStageState } from "@/lib/duel/stageState";
import {
  acceptedRects,
  decodeShikaku,
  encodeShikaku,
  rectFrom,
  rectHas,
  rectsOverlap,
  rectValid,
  shikakuCovered,
  shikakuSolved,
  SHIKAKU_CELLS,
  SHIKAKU_SIZE,
  type ShikakuClue,
  type ShikakuRect,
} from "@/lib/duel/shikaku";

import { SHIKAKU_TIME_MS, type ShikakuPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const FILLS = ["var(--primary)", "var(--me)"];

function Board({
  size,
  rows = size,
  clues,
  rects,
  preview,
  small = false,
  pointer,
}: {
  size: number;
  rows?: number;
  clues: readonly ShikakuClue[];
  rects: readonly ShikakuRect[];
  preview?: ShikakuRect | null;
  small?: boolean;
  pointer?: ReturnType<typeof useGridPointer>;
}) {
  const clueAt = new Map(clues.map((clue) => [clue.cell, clue.n]));
  const place = (r: ShikakuRect) => ({
    gridRow: `${r.r0 + 1} / ${r.r1 + 2}`,
    gridColumn: `${r.c0 + 1} / ${r.c1 + 2}`,
  });
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      className="grid w-full select-none"
      style={{
        ...(pointer?.handlers.style ?? {}),
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, auto)`,
        gap: small ? 1 : 2,
      }}
    >
      {Array.from({ length: size * rows }, (_, cell) => (
        <div
          key={cell}
          className="flex aspect-square items-center justify-center rounded-sm border border-border bg-card"
          style={{ gridRow: Math.floor(cell / size) + 1, gridColumn: (cell % size) + 1 }}
        />
      ))}
      {rects.map((r, i) => (
        <div
          key={`r${i}`}
          className="pointer-events-none rounded-md"
          style={{
            ...place(r),
            zIndex: 1,
            border: `2px solid ${FILLS[i % 2]}`,
            background: `color-mix(in oklab, ${FILLS[i % 2]} 35%, transparent)`,
          }}
        />
      ))}
      {preview && (
        <div
          className="pointer-events-none rounded-md border-2 border-primary"
          style={{ ...place(preview), zIndex: 2 }}
        />
      )}
      {[...clueAt].map(([cell, n]) => (
        <span
          key={`n${cell}`}
          className={`pointer-events-none flex items-center justify-center font-mono font-bold text-foreground ${
            small ? "text-xs" : "text-lg"
          }`}
          style={{ gridRow: Math.floor(cell / size) + 1, gridColumn: (cell % size) + 1, zIndex: 3 }}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

function IntroExample() {
  // The real 9 × 9 board size, shown with one valid rectangle per row.
  const clues = Array.from({ length: 9 }, (_, row) => ({ cell: row * 9 + (row % 2 ? 2 : 6), n: 9 }));
  const rects = Array.from({ length: 9 }, (_, row) => ({ r0: row, c0: 0, r1: row, c1: 8 }));
  return (
    <div style={{ width: 180 }}>
      <Board size={9} clues={clues} rects={rects} small />
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: ShikakuPuzzleData | null = puzzle.type === "shikaku" ? puzzle : null;
  const size = data?.size ?? SHIKAKU_SIZE;
  const clues = data?.clues ?? [];
  const [rects, setRects] = useStageState<ShikakuRect[]>(stateKey ?? "shikaku", "shikakuRects", () => []);
  const [preview, setPreview] = useState<ShikakuRect | null>(null);
  const [shake, setShake] = useState(0);
  const start = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const submitted = useRef(false);
  const encoded = encodeShikaku(rects);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current || !shikakuSolved(rects, clues, size)) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked]);

  const active = !locked && data !== null;
  const pointer = useGridPointer({
    cols: size,
    rows: size,
    onCell: active
      ? (cell) => {
          if (submitted.current) return;
          if (start.current === null) start.current = cell;
          last.current = cell;
          setPreview(rectFrom(start.current, cell, size));
        }
      : undefined,
    onRelease: () => {
      const a = start.current;
      const b = last.current;
      start.current = null;
      last.current = null;
      setPreview(null);
      if (a === null || b === null || submitted.current) return;
      const existing = rects.findIndex((r) => rectHas(r, a, size));
      if (a === b && existing >= 0) {
        buzz(8);
        setRects((current) => current.filter((_, i) => i !== existing));
        return;
      }
      const rect = rectFrom(a, b, size);
      if (rects.some((r) => rectsOverlap(r, rect)) || !rectValid(rect, clues, size)) {
        buzz(30);
        setShake((n) => n + 1);
        return;
      }
      buzz(8);
      setRects((current) => [...current, rect]);
    },
  });

  if (!data) return null;
  const uncovered = size * size - shikakuCovered(rects, clues, size);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        uncovered <span className="text-primary">{uncovered}</span>
      </p>
      <div key={shake} className={`w-full ${shake ? "animate-shake" : ""}`} style={{ width: "min(100%, 342px)", minWidth: 324 }}>
        <Board size={size} clues={clues} rects={rects} preview={preview} pointer={pointer} />
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "shikaku") return null;
  const mine = acceptedRects(decodeShikaku(myAnswer ?? "", puzzle.size), puzzle.clues, puzzle.size);
  const covered = mine.reduce((sum, r) => sum + (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1), 0);
  const elapsed = Math.max(0, SHIKAKU_TIME_MS - (myMsRemaining ?? 0));
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: 170 }}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
          <Board size={puzzle.size} clues={puzzle.clues} rects={puzzle.solution ?? []} small />
        </div>
        <div className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: 170 }}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <Board size={puzzle.size} clues={puzzle.clues} rects={mine} small />
        </div>
      </div>
      <p className="font-mono text-base text-primary">
        {myCorrect ? `Solved · ${(elapsed / 1000).toFixed(1)}s` : `${covered} / ${SHIKAKU_CELLS} covered`}
      </p>
    </div>
  );
}

export const shikakuPuzzle: PuzzleDefinition = {
  key: "shikaku",
  name: "Shikaku",
  category: "logic",
  timeLimitMs: SHIKAKU_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "shikaku", size: SHIKAKU_SIZE, clues: [] }) satisfies ShikakuPuzzleData,
  check: (answer, puzzle) =>
    puzzle.type === "shikaku" && shikakuSolved(decodeShikaku(answer, puzzle.size), puzzle.clues, puzzle.size),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
