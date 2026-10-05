import { useEffect, useRef, useState } from "react";

import { useStageState } from "@/lib/duel/stageState";
import {
  decodeTents,
  encodeTents,
  lineCounts,
  scoreTents,
  tentsLayoutValid,
  tentsTouch,
} from "@/lib/duel/tents";
import { TENTS_TIME_MS, type TentsPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { buzz } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const TREE_GREEN = "#2F6B3A";

function TreeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3/4 w-3/4" aria-hidden="true">
      <polygon points="10,2 17,14 3,14" fill={TREE_GREEN} />
      <rect x={8.5} y={14} width={3} height={4} fill="#5A3B22" />
    </svg>
  );
}

function TentIcon({ colour = "var(--primary)" }: { colour?: string | undefined }) {
  return (
    <svg viewBox="0 0 20 20" className="h-3/4 w-3/4" aria-hidden="true">
      <polygon points="10,3 18,17 2,17" fill={colour} />
    </svg>
  );
}

type Mark = 0 | 1 | 2;

function Board({
  size,
  trees,
  rowCounts,
  colCounts,
  marks,
  tentColour,
  onTap,
  flash,
  countSize = 18,
  gap = 2,
}: {
  size: number;
  trees: readonly number[];
  rowCounts: readonly number[];
  colCounts: readonly number[];
  marks: readonly Mark[];
  tentColour?: ((cell: number) => string) | undefined;
  onTap?: ((cell: number) => void) | undefined;
  flash?: number | null;
  countSize?: number;
  gap?: number;
}) {
  const treeSet = new Set(trees);
  const tents = marks.flatMap((mark, cell) => (mark === 1 ? [cell] : []));
  const { rows, cols } = lineCounts(tents, size);
  return (
    <div
      className="grid w-full"
      style={{
        gridTemplateColumns: `${countSize}px repeat(${size}, minmax(0, 1fr))`,
        gap,
      }}
    >
      <span />
      {colCounts.map((count, c) => (
        <span
          key={`c${c}`}
          className={`text-center font-mono text-sm font-bold ${
            count >= 0 && cols[c] === count ? "text-muted-foreground opacity-40" : "text-foreground"
          }`}
        >
          {count < 0 ? "?" : count}
        </span>
      ))}
      {Array.from({ length: size }, (_, r) => [
        <span
          key={`r${r}`}
          className={`flex items-center justify-center font-mono text-sm font-bold ${
            (rowCounts[r] ?? -1) >= 0 && rows[r] === rowCounts[r] ? "text-muted-foreground opacity-40" : "text-foreground"
          }`}
        >
          {(rowCounts[r] ?? -1) < 0 ? "?" : rowCounts[r]}
        </span>,
        ...Array.from({ length: size }, (_, c) => {
          const cell = r * size + c;
          const tree = treeSet.has(cell);
          const mark = marks[cell] ?? 0;
          return (
            <button
              key={cell}
              type="button"
              disabled={!onTap || tree}
              onClick={onTap && !tree ? () => onTap(cell) : undefined}
              className={`flex aspect-square items-center justify-center rounded-md border border-border ${
                tree ? "bg-muted" : "bg-card"
              } ${flash === cell ? "animate-pulse bg-destructive/50" : ""}`}
              aria-label={tree ? "Tree" : mark === 1 ? "Tent" : mark === 2 ? "Grass" : "Empty"}
            >
              {tree ? (
                <TreeIcon />
              ) : mark === 1 ? (
                <TentIcon colour={tentColour?.(cell)} />
              ) : mark === 2 ? (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              ) : null}
            </button>
          );
        }),
      ])}
    </div>
  );
}

function IntroExample() {
  const marks: Mark[] = new Array(64).fill(0);
  for (const cell of [0, 2, 4, 6, 49, 51, 53, 55]) marks[cell] = 1;
  return (
    <div style={{ width: 190 }}>
      <Board
        size={8}
        trees={[8, 10, 12, 14, 41, 43, 45, 47]}
        rowCounts={[4, 0, 0, 0, -1, 0, 4, 0]}
        colCounts={[1, 1, -1, 1, 1, 1, 1, 1]}
        marks={marks}
        countSize={12}
        gap={1}
      />
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey }: PuzzleStageProps) {
  const data: TentsPuzzleData | null = puzzle.type === "tents" ? puzzle : null;
  const size = data?.size ?? 7;
  const [marks, setMarks] = useStageState<Mark[]>(stateKey ?? "tents", "tentsMarks", () =>
    new Array(size * size).fill(0),
  );
  const [flash, setFlash] = useState<number | null>(null);
  const submitted = useRef(false);

  const tents = marks.flatMap((mark, cell) => (mark === 1 ? [cell] : []));
  const encoded = encodeTents(tents);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (!tentsLayoutValid(data, tents)) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encoded, locked]);

  if (!data) return null;

  const tap = (cell: number) => {
    if (locked || submitted.current) return;
    buzz(8);
    const nextMark = (((marks[cell] ?? 0) + 1) % 3) as Mark;
    if (nextMark === 1 && tents.some((tent) => tentsTouch(tent, cell, size))) {
      setFlash(cell);
      window.setTimeout(() => setFlash(null), 450);
    }
    setMarks((current) => current.map((mark, index) => (index === cell ? nextMark : mark)));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        tents <span className="text-primary">{tents.length}</span> / {data.trees.length}
      </p>
       <div className="w-full">
        <Board
          size={size}
          trees={data.trees}
          rowCounts={data.rowCounts}
          colCounts={data.colCounts}
          marks={marks}
          onTap={locked ? undefined : tap}
          flash={flash}
          countSize={12}
          gap={1}
        />
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "tents") return null;
  const cells = puzzle.size * puzzle.size;
  const solution = new Set(puzzle.solution ?? []);
  const treeSet = new Set(puzzle.trees);
  const mine = decodeTents(myAnswer ?? "", puzzle.size).filter((cell) => !treeSet.has(cell));
  const solvedMarks = Array.from({ length: cells }, (_, cell) =>
    solution.has(cell) ? 1 : 0,
  ) as Mark[];
  const mineSet = new Set(mine);
  const myMarks = Array.from({ length: cells }, (_, cell) => (mineSet.has(cell) ? 1 : 0)) as Mark[];
  const correct = mine.filter((cell) => solution.has(cell)).length;
  const wrong = mine.length - correct;
  const trees = puzzle.trees.length;
  const points = scoreTents(myCorrect, myMsRemaining ?? 0, timeLimitMs, correct, wrong, trees);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full justify-center gap-3">
        <div className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: 180 }}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
          <Board
            size={puzzle.size}
            trees={puzzle.trees}
            rowCounts={puzzle.rowCounts}
            colCounts={puzzle.colCounts}
            marks={solvedMarks}
            countSize={12}
            gap={1}
          />
        </div>
        <div className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: 180 }}>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
          <Board
            size={puzzle.size}
            trees={puzzle.trees}
            rowCounts={puzzle.rowCounts}
            colCounts={puzzle.colCounts}
            marks={myMarks}
            tentColour={(cell) => (solution.has(cell) ? "var(--primary)" : "var(--destructive)")}
            countSize={12}
            gap={1}
          />
        </div>
      </div>
      <p className="font-mono text-base text-primary">
        {correct === trees && wrong === 0
          ? `${correct} / ${trees} · ${points}`
          : `${correct} / ${trees} tents · ${points}`}
      </p>
    </div>
  );
}

export const tentsPuzzle: PuzzleDefinition = {
  key: "tents",
  name: "Tents and Trees",
  category: "logic",
  timeLimitMs: TENTS_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "tents",
      size: 8,
      trees: [],
      rowCounts: new Array(8).fill(0),
      colCounts: new Array(8).fill(0),
    }) satisfies TentsPuzzleData,
  check: (answer, puzzle) =>
    puzzle.type === "tents" && tentsLayoutValid(puzzle, decodeTents(answer, puzzle.size)),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
