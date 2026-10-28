import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { useEffect, useRef, useState, type CSSProperties } from "react";

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
  shikakuHeightOf,
  shikakuSolved,
  SHIKAKU_DEPTH_HEIGHT,
  SHIKAKU_SIZE,
  type ShikakuClue,
  type ShikakuRect,
} from "@/lib/duel/shikaku";

import { SHIKAKU_TIME_MS, type ShikakuPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { buzz } from "@/lib/motion";

import { soundCue, useSolveFx } from "./logicFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const FILLS = ["var(--primary)", "var(--me)"];

export function Board({
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
      className="shikaku-board logic-glass grid w-full shrink-0 select-none overflow-hidden"
      style={{
        ...(pointer?.handlers.style ?? {}),
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        aspectRatio: `${size} / ${rows}`,
        gap: small ? 1 : 2,
        containerType: "inline-size",
      }}
    >
      {Array.from({ length: size * rows }, (_, cell) => (
        <div
          key={cell}
          className="logic-glass-cell flex min-h-0 min-w-0 items-center justify-center rounded-sm border border-border bg-card"
          style={{ gridRow: Math.floor(cell / size) + 1, gridColumn: (cell % size) + 1 }}
        />
      ))}
      {rects.map((r, i) => (
        <div
          key={`r${r.r0}-${r.c0}-${r.r1}-${r.c1}`}
          className="logic-pane pointer-events-none rounded-md"
          style={{
            ...place(r),
            zIndex: 1,
            border: `2px solid ${FILLS[i % 2]}`,
            background: `color-mix(in oklab, ${FILLS[i % 2]} 35%, transparent)`,
            "--logic-i": Math.min(i, 17),
            "--logic-hue": Math.round((i * 137.5 + 20) % 360),
          } as CSSProperties}
        />
      ))}
      {preview && (
        <div
          className="logic-pane-preview pointer-events-none rounded-md border-2 border-primary"
          style={{ ...place(preview), zIndex: 2 }}
        />
      )}
      {[...clueAt].map(([cell, n]) => (
        <span
          key={`n${cell}`}
          className="shikaku-clue logic-glass-clue pointer-events-none flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden text-center font-mono font-bold leading-none text-foreground"
          style={{ gridRow: Math.floor(cell / size) + 1, gridColumn: (cell % size) + 1, zIndex: 3,
            fontSize: small ? `clamp(${n >= 10 ? 12 : 13}px, calc((100cqw - ${size - 1}px) / ${size} * ${n >= 10 ? 0.62 : 0.88}), 22px)` : undefined,
          }}
        >
          <span className={`whitespace-nowrap ${small ? "leading-none" : "text-xl leading-none"} ${small && n >= 10 ? "tracking-[-0.08em]" : ""}`}>{n}</span>
        </span>
      ))}
    </div>
  );
}

function IntroExample() {
  // The real board size (10 × 11 since the depth revision), shown with one valid rectangle per row.
  const clues = Array.from({ length: SHIKAKU_DEPTH_HEIGHT }, (_, row) => ({ cell: row * SHIKAKU_SIZE + (row % 2 ? 2 : 6), n: SHIKAKU_SIZE }));
  const rects = Array.from({ length: SHIKAKU_DEPTH_HEIGHT }, (_, row) => ({ r0: row, c0: 0, r1: row, c1: SHIKAKU_SIZE - 1 }));
  return (
    <div style={{ width: 164 }}>
      <Board size={SHIKAKU_SIZE} rows={SHIKAKU_DEPTH_HEIGHT} clues={clues} rects={rects} small />
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: ShikakuPuzzleData | null = puzzle.type === "shikaku" ? puzzle : null;
  const size = data?.size ?? SHIKAKU_SIZE;
  // 10 rows before the depth revision, 11 on it.
  const height = data ? shikakuHeightOf(data) : size;
  const clues = data?.clues ?? [];
  const [rects, setRects] = useStageState<ShikakuRect[]>(stateKey ?? "shikaku", "shikakuRects", () => []);
  const [preview, setPreview] = useState<ShikakuRect | null>(null);
  const [shake, setShake] = useState(0);
  const start = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const submitted = useRef(false);
  const encoded = encodeShikaku(rects);
  const solving = useSolveFx("shikaku", Boolean(data && shikakuSolved(rects, clues, size, height)));
  const inFrame = useFrameProgress(shikakuCovered(rects, clues, size), size * height, "covered");

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current || !shikakuSolved(rects, clues, size, height)) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked]);

  const active = !locked && data !== null;
  const pointer = useGridPointer({
    cols: size,
    rows: height,
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
        soundCue("shikaku.remove");
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
      soundCue("shikaku.place");
      setRects((current) => [...current, rect]);
    },
  });

  if (!data) return null;
  const uncovered = size * height - shikakuCovered(rects, clues, size);

  return (
    <div data-logic-stage="shikaku" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        {inFrame ? null : (
          <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
            uncovered <span className="text-primary">{uncovered}</span>
          </p>
        )}
        <div
          key={shake}
          className={`${height === size ? "logic-square" : "logic-board-tall"} logic-glass-frame ${shake ? "animate-shake" : ""}`}
          style={height === size ? undefined : ({ "--board-aspect": height / size } as CSSProperties)}
        >
          <Board size={size} rows={height} clues={clues} rects={rects} preview={preview} pointer={pointer} />
        </div>
        <LiveSummary
          inArena
          className="logic-status"
          items={[
            <SummaryItem key="rects" label="Rectangles" value={`${rects.length} / ${clues.length}`} />,
          ]}
        />
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "shikaku") return null;
  const height = shikakuHeightOf(puzzle);
  const mine = acceptedRects(decodeShikaku(myAnswer ?? "", puzzle.size, height), puzzle.clues, puzzle.size);
  const covered = mine.reduce((sum, r) => sum + (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1), 0);
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-pair">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
            <Board size={puzzle.size} rows={height} clues={puzzle.clues} rects={puzzle.solution ?? []} small />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
            <Board size={puzzle.size} rows={height} clues={puzzle.clues} rects={mine} small />
          </div>
        </div>
      </div>
      <p className="logic-reveal-text text-center font-mono text-primary">
        {myCorrect ? `Solved · ${(elapsed / 1000).toFixed(1)}s` : (solutionProgress(puzzle, myAnswer ?? "")?.text ?? `${covered} / ${puzzle.size * height} covered`)}
      </p>
    </div>
  );
}

export const shikakuPuzzle: PuzzleDefinition = {
  key: "shikaku",
  name: gameDisplayName("shikaku"),
  category: "logic",
  timeLimitMs: SHIKAKU_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "shikaku", size: SHIKAKU_SIZE, clues: [] }) satisfies ShikakuPuzzleData,
  check: (answer, puzzle) =>
    puzzle.type === "shikaku" && shikakuSolved(decodeShikaku(answer, puzzle.size, shikakuHeightOf(puzzle)), puzzle.clues, puzzle.size, shikakuHeightOf(puzzle)),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
