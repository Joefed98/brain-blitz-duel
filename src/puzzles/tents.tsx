import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useStageState } from "@/lib/duel/stageState";
import {
  decodeTents,
  encodeTents,
  lineCounts,
  tentsLayoutValid,
  tentsTouch,
} from "@/lib/duel/tents";
import { TENTS_TIME_MS, type TentsPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { buzz } from "@/lib/motion";

import { soundCue, useSolveFx } from "./logicFx";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Clean flat trees; pine or round is picked from the cell position (cosmetic only). */
function TreeIcon({ cell }: { cell: number }) {
  const pine = ((cell * 7 + (cell >> 3)) % 3) !== 0;
  return (
    <svg viewBox="0 0 20 20" className="h-[70%] w-[70%]" aria-hidden="true">
      <ellipse cx="10" cy="18.4" rx="5" ry="1.2" fill="var(--guest-ink)" opacity="0.45" />
      <rect x="8.8" y="13.6" width="2.4" height="4.8" rx="0.8" fill="var(--trunk)" />
      {pine ? (
        <>
          <path d="M10 1.6 16 9.2h-2.6L17.2 14H2.8l3.8-4.8H4z" fill="var(--pine)" />
          <path d="M10 1.6 4 9.2h2.6L2.8 14H10z" fill="var(--pine-dark)" />
        </>
      ) : (
        <>
          <circle cx="10" cy="8.4" r="6.2" fill="var(--leaf)" />
          <path d="M10 2.2a6.2 6.2 0 0 0 0 12.4z" fill="var(--pine)" />
        </>
      )}
    </svg>
  );
}

/** Striped canvas tent in gold (or the reveal colour), with a lantern at the door. */
function TentIcon({ colour = "var(--primary)" }: { colour?: string | undefined }) {
  return (
    <svg viewBox="0 0 20 20" className="logic-tent h-[74%] w-[74%]" aria-hidden="true">
      <ellipse cx="10" cy="17.6" rx="8" ry="1.2" fill="var(--guest-ink)" opacity="0.45" />
      <polygon points="10,2.6 18.4,17 1.6,17" fill={colour} />
      {/* Canvas stripes, darker panels between lighter ones. */}
      <path d="M10 2.6 5.6 17h-1.8ZM10 2.6 14.4 17h1.8Z" fill="var(--guest-ink)" opacity="0.18" />
      <path d="M10 2.6 1.6 17h1.4Z" fill="#FFFFFF" opacity="0.3" />
      <path d="M10 2.6 7.2 17M10 2.6 12.8 17" stroke="var(--guest-ink)" strokeOpacity="0.28" strokeWidth="1.1" />
      <polygon points="10,8.4 12.4,17 7.6,17" fill="var(--guest-ink)" opacity="0.72" />
      <circle className="logic-lantern" cx="10" cy="14.6" r="1.4" fill="#FFD66B" />
      <path d="M1.2 17.2h17.6" stroke="var(--guest-ink)" strokeOpacity="0.45" strokeWidth="0.8" />
      <path d="M10 2.6V1" stroke="var(--sign-ink)" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M10 1.1 12.2 1.8 10 2.4Z" fill="#E5533D" />
    </svg>
  );
}

/** A small grass tuft for cells marked "no tent". */
function TuftIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[36%] w-[36%]" aria-hidden="true">
      <path d="M4 16c1-4 2-6 3-8M8 16c0-5 1-8 2-11M12 16c0-4 0-6-1-9M15 16c-1-3-1-5 1-7" fill="none" stroke="var(--tuft)" strokeWidth="1.7" strokeLinecap="round" />
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
  pitched,
  dimDone = true,
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
  /** The cell where a tent was just pitched (it pops up). */
  pitched?: number | null;
  /** Live play dims a sign once its line is complete; the reveal keeps every sign at full contrast. */
  dimDone?: boolean;
}) {
  const treeSet = new Set(trees);
  const tents = marks.flatMap((mark, cell) => (mark === 1 ? [cell] : []));
  const { rows, cols } = lineCounts(tents, size);
  return (
    <div
      className="logic-camp grid w-full"
      style={{
        gridTemplateColumns: `${countSize}px repeat(${size}, minmax(0, 1fr))`,
        gap,
      }}
    >
      <span />
      {colCounts.map((count, c) => (
        <span
          key={`c${c}`}
          className={`camp-sign logic-sign mx-auto mb-px w-[78%] text-center font-mono text-sm font-bold ${
            dimDone && count >= 0 && cols[c] === count ? "opacity-40" : ""
          }`}
        >
          {count < 0 ? "?" : count}
        </span>
      ))}
      {Array.from({ length: size }, (_, r) => [
        <span
          key={`r${r}`}
          className={`camp-sign logic-sign my-[12%] flex items-center justify-center font-mono text-sm font-bold ${
            dimDone && (rowCounts[r] ?? -1) >= 0 && rows[r] === rowCounts[r] ? "opacity-40" : ""
          }`}
        >
          {(rowCounts[r] ?? -1) < 0 ? "?" : rowCounts[r]}
        </span>,
        ...Array.from({ length: size }, (_, c) => {
          const cell = r * size + c;
          const tree = treeSet.has(cell);
          const mark = marks[cell] ?? 0;
          const tentIndex = mark === 1 ? tents.indexOf(cell) : 0;
          return (
            <button
              key={cell}
              type="button"
              disabled={!onTap || tree}
              onClick={onTap && !tree ? () => onTap(cell) : undefined}
              style={{ "--logic-i": tentIndex, "--logic-grass": (cell * 37) % 7 } as CSSProperties}
              className={`flex aspect-square items-center justify-center rounded-md border border-border camp-cell logic-camp-cell ${flash === cell ? "animate-shake" : ""} ${pitched === cell && mark === 1 ? "logic-tent-pitch" : ""}`}
              aria-label={tree ? "Tree" : mark === 1 ? "Tent" : mark === 2 ? "Grass" : "Empty"}
            >
              {tree ? (
                <TreeIcon cell={cell} />
              ) : mark === 1 ? (
                <TentIcon colour={tentColour?.(cell)} />
              ) : mark === 2 ? (
                <TuftIcon />
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
  const [pitched, setPitched] = useState<number | null>(null);
  const submitted = useRef(false);

  const tents = marks.flatMap((mark, cell) => (mark === 1 ? [cell] : []));
  const encoded = encodeTents(tents);
  const solving = useSolveFx("tents", Boolean(data && tentsLayoutValid(data, tents)));

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
    soundCue(nextMark === 1 ? "tents.pitch" : nextMark === 2 ? "tents.grass" : "tents.clear");
    setPitched(nextMark === 1 ? cell : null);
    if (nextMark === 1 && tents.some((tent) => tentsTouch(tent, cell, size))) {
      setFlash(cell);
      window.setTimeout(() => setFlash(null), 450);
    }
    setMarks((current) => current.map((mark, index) => (index === cell ? nextMark : mark)));
  };

  return (
    <div data-logic-stage="tents" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
          tents <span className="text-primary">{tents.length}</span> / {data.trees.length}
        </p>
        <div className="logic-tents-fit logic-camp-frame">
          <Board
            size={size}
            trees={data.trees}
            rowCounts={data.rowCounts}
            colCounts={data.colCounts}
            marks={marks}
            onTap={locked ? undefined : tap}
            flash={flash}
            pitched={pitched}
            countSize={16}
            gap={1}
          />
        </div>
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

  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-pair">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Solution</span>
            <Board
              size={puzzle.size}
              trees={puzzle.trees}
              rowCounts={puzzle.rowCounts}
              colCounts={puzzle.colCounts}
              marks={solvedMarks}
              countSize={14}
              gap={1}
              dimDone={false}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Yours</span>
            <Board
              size={puzzle.size}
              trees={puzzle.trees}
              rowCounts={puzzle.rowCounts}
              colCounts={puzzle.colCounts}
              marks={myMarks}
              tentColour={(cell) => (solution.has(cell) ? "var(--primary)" : "var(--destructive)")}
              countSize={14}
              gap={1}
              dimDone={false}
            />
          </div>
        </div>
      </div>
      <p className="logic-reveal-text text-center font-mono text-primary">
        {correct === trees && wrong === 0
          ? `${correct} / ${trees}`
          : `${correct} / ${trees} tents`}
      </p>
    </div>
  );
}

export const tentsPuzzle: PuzzleDefinition = {
  key: "tents",
  name: gameDisplayName("tents"),
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
