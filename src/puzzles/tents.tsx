import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useStageState } from "@/lib/duel/stageState";
import {
  decodeTents,
  encodeTents,
  lineCounts,
  tentsHeightOf,
  tentsLayoutValid,
  orthNeighbours,
  tentsTouch,
} from "@/lib/duel/tents";
import { TENTS_TIME_MS, type TentsPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";

import { useSolveFx } from "./logicFx";
import { soundCue } from "@/lib/fx/soundCues";
import { gameFx } from "@/lib/fx/kit";
import { logicArt, logicArtVars } from "./logicArt";
import { LogicReveal, extraCount, tallySets } from "./logic2Reveal";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { HudPills } from "@/components/puzzles/HudPills";
import "@/polish-layout/polish-nov3-logic.css";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Clean flat trees; pine or round is picked from the cell position (cosmetic only). */
export function TreeIcon({ cell }: { cell: number }) {
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
export function TentIcon({ colour = "var(--primary)" }: { colour?: string | undefined }) {
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

/** The angle (deg) from a cell to an orthogonal neighbour: 0 right, 90 down, 180 left, 270 up. */
function dirTo(from: number, to: number, size: number): number {
  if (to === from + 1) return 0;
  if (to === from + size) return 90;
  if (to === from - 1) return 180;
  return 270;
}

/**
 * Each tent paired with a different tree beside it (display only: the faint line of the Logic overhaul's tent effect):
 * a maximum matching (Kuhn's), so a tent shows a line only when a tree is free for it.
 */
export function tentTreePairs(tents: readonly number[], trees: ReadonlySet<number>, size: number, height: number): Map<number, number> {
  const treeOf = new Map<number, number>();
  const tentOf = new Map<number, number>();
  const options = new Map(tents.map((t) => [t, orthNeighbours(t, size, height).filter((n) => trees.has(n))]));
  const tryTent = (tent: number, seen: Set<number>): boolean => {
    for (const tree of options.get(tent) ?? []) {
      if (seen.has(tree)) continue;
      seen.add(tree);
      const holder = tentOf.get(tree);
      if (holder === undefined || tryTent(holder, seen)) {
        tentOf.set(tree, tent);
        treeOf.set(tent, tree);
        return true;
      }
    }
    return false;
  };
  for (const tent of tents) tryTent(tent, new Set());
  return treeOf;
}

const TENTS_ART = logicArtVars(["tents-turf", "tents-sign", "tents-sign-met"]);

export function Board({
  size,
  height = size,
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
  lit = false,
  wrongTents,
  missedTents,
}: {
  size: number;
  /** Rows (the depth revision's 8 × 9 field); `size` when square. */
  height?: number;
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
  /** Live play turns a sign gold once its line is complete; the reveal keeps every sign wooden. */
  dimDone?: boolean;
  /** The solve: lanterns light in every tent. */
  lit?: boolean;
  /** Reveal: tents that are not in the solution (a red ring). */
  wrongTents?: ReadonlySet<number> | undefined;
  /** Reveal: the solution's tents the player didn't pitch (a faint ghost tent in a dashed ring). */
  missedTents?: ReadonlySet<number> | undefined;
}) {
  const treeSet = new Set(trees);
  const tents = marks.flatMap((mark, cell) => (mark === 1 ? [cell] : []));
  const { rows, cols } = lineCounts(tents, size, height);
  // The Logic overhaul (15 Nov 2026): a tent with no tree beside it gets a red ring (live play only).
  const lonely = new Set(onTap ? tents.filter((cell) => !orthNeighbours(cell, size, height).some((n) => treeSet.has(n))) : []);
  // Live play: a faint line joins each tent to the tree it is paired with (one tree each, a matching found afresh).
  const pairOf = onTap ? tentTreePairs(tents, treeSet, size, height) : new Map<number, number>();
  const pairDir = new Map<number, number>();
  for (const [tent, tree] of pairOf) {
    pairDir.set(tent, dirTo(tent, tree, size));
    pairDir.set(tree, dirTo(tree, tent, size));
  }
  return (
    <div
      className="logic-camp logic2-camp grid w-full"
      data-logic2="tents"
      style={{
        ...TENTS_ART,
        gridTemplateColumns: `${countSize}px repeat(${size}, minmax(0, 1fr))`,
        gap,
      }}
    >
      <span />
      {colCounts.map((count, c) => (
        <span
          key={`c${c}`}
          className="camp-sign logic-sign logic2-sign mx-auto mb-px w-[86%] text-center"
          data-sign={`c${c}`}
          data-met={dimDone && count >= 0 && cols[c] === count ? "" : undefined}
        >
          {count < 0 ? "?" : count}
        </span>
      ))}
      {Array.from({ length: height }, (_, r) => [
        <span
          key={`r${r}`}
          className="camp-sign logic-sign logic2-sign my-[10%] flex items-center justify-center"
          data-sign={`r${r}`}
          data-met={dimDone && (rowCounts[r] ?? -1) >= 0 && rows[r] === rowCounts[r] ? "" : undefined}
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
              className={`flex aspect-square items-center justify-center rounded-md camp-cell logic-camp-cell logic2-cell ${flash === cell ? "animate-shake" : ""} ${pitched === cell && mark === 1 ? "logic-tent-pitch" : ""}`}
              data-tent-cell={cell}
              data-lonely={lonely.has(cell) ? "" : undefined}
              data-missed={missedTents?.has(cell) && mark !== 1 ? "" : undefined}
              data-wrong={wrongTents?.has(cell) || (tentColour && mark === 1 && tentColour(cell) === "var(--destructive)") ? "" : undefined}
              aria-label={tree ? "Tree" : mark === 1 ? (lonely.has(cell) ? "Tent with no tree beside it" : "Tent") : mark === 2 ? "Grass" : "Empty"}
            >
              {pairDir.has(cell) ? <span aria-hidden="true" className="logic2-pair-line" style={{ "--logic2-pair": `${pairDir.get(cell)}deg` } as CSSProperties} /> : null}
              {tree ? (
                <img className="logic2-piece logic2-tree" src={logicArt(((cell * 7 + (cell >> 3)) % 3) !== 0 ? "tents-tree-a" : "tents-tree-b")} alt="" draggable={false} />
              ) : mark === 1 ? (
                <img className="logic-tent logic2-piece logic2-tent" src={logicArt(lit ? "tents-tent-lit" : "tents-tent")} alt="" draggable={false} />
              ) : missedTents?.has(cell) ? (
                <img className="logic2-piece logic2-tent logic2-ghost" src={logicArt("tents-tent")} alt="" draggable={false} />
              ) : mark === 2 ? (
                <img className="logic2-piece logic2-tuft" src={logicArt("tents-tuft")} alt="" draggable={false} />
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
  const height = data ? tentsHeightOf(data) : size;
  const [marks, setMarks] = useStageState<Mark[]>(stateKey ?? "tents", "tentsMarks", () =>
    new Array(size * height).fill(0),
  );
  const submitted = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const fxQueue = useRef<{ cell: number; pitched: boolean; touching: number[]; metNow: string[]; lonely: boolean } | null>(null);
  // Effects for the last tap, once the board shows it (the kit animates the pieces only; nothing waits on it).
  useEffect(() => {
    const fx = fxQueue.current;
    fxQueue.current = null;
    const root = boardRef.current;
    if (!fx || !root) return;
    const cellEl = (c: number) => root.querySelector<HTMLElement>(`[data-tent-cell="${c}"]`);
    if (fx.pitched) gameFx("drop", cellEl(fx.cell)?.querySelector(".logic2-tent"), { silent: true });
    if (fx.touching.length) {
      soundCue("tents.touch");
      for (const c of [fx.cell, ...fx.touching]) gameFx("wrong", cellEl(c)?.querySelector(".logic2-tent"), { silent: true, noHaptic: true });
    } else if (fx.lonely) soundCue("tents.lonely");
    if (fx.metNow.length) {
      soundCue("tents.signMet");
      for (const id of fx.metNow) gameFx("tap", root.querySelector(`[data-sign="${id}"]`), { silent: true });
    }
  }, [marks]);

  const tents = marks.flatMap((mark, cell) => (mark === 1 ? [cell] : []));
  const encoded = encodeTents(tents);
  const solving = useSolveFx("tents", Boolean(data && tentsLayoutValid(data, tents)));
  const inFrame = useFrameProgress(tents.length, data?.trees.length ?? 0, "tents");

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
  const treeCells = new Set(data.trees);
  const lonelyTents = tents.filter((cell) => !orthNeighbours(cell, size, height).some((n) => treeCells.has(n))).length;

  const tap = (cell: number) => {
    if (locked || submitted.current) return;
    const nextMark = (((marks[cell] ?? 0) + 1) % 3) as Mark;
    soundCue(nextMark === 1 ? "tents.pitch" : nextMark === 2 ? "tents.grass" : "tents.clear");
    // The Logic overhaul's effects (15 Nov 2026, the effects kit): played once the board shows the change.
    const next = nextMark === 1 ? [...tents, cell] : tents.filter((t) => t !== cell);
    const touching = nextMark === 1 ? tents.filter((tent) => tentsTouch(tent, cell, size)) : [];
    const was = lineCounts(tents, size, height);
    const now = lineCounts(next, size, height);
    const metNow = [
      ...data.rowCounts.flatMap((n, r) => (n >= 0 && now.rows[r] === n && was.rows[r] !== n ? [`r${r}`] : [])),
      ...data.colCounts.flatMap((n, c) => (n >= 0 && now.cols[c] === n && was.cols[c] !== n ? [`c${c}`] : [])),
    ];
    const lonelyNow = nextMark === 1 && !orthNeighbours(cell, size, height).some((n) => treeCells.has(n));
    fxQueue.current = { cell, pitched: nextMark === 1, touching, metNow, lonely: lonelyNow };
    setMarks((current) => current.map((mark, index) => (index === cell ? nextMark : mark)));
  };

  return (
    <div data-logic-stage="tents" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic" className="px-3">
        {inFrame ? null : (
          <p className="logic-status font-mono text-xs uppercase tracking-widest text-muted-foreground">
            tents <span className="text-primary">{tents.length}</span> / {data.trees.length}
          </p>
        )}
        <div ref={boardRef} className="logic-tents-fit logic-camp-frame" style={{ "--board-aspect": height / size } as CSSProperties}>
          <Board
            size={size}
            height={height}
            trees={data.trees}
            rowCounts={data.rowCounts}
            colCounts={data.colCounts}
            marks={marks}
            onTap={locked ? undefined : tap}
            countSize={26}
            gap={1}
            lit={solving}
          />
        </div>
        {lonelyTents > 0 ? (
          <p className="logic2-warn" role="status" data-tents-lonely={lonelyTents}>
            {lonelyTents === 1 ? "A tent has no tree beside it" : `${lonelyTents} tents have no tree beside them`}
          </p>
        ) : null}
        {inFrame ? (
          <HudPills testId="tents" className="logic-hud-pills" items={[{ id: "tents", label: "Tents", value: `${tents.length} / ${data.trees.length}` }]} />
        ) : null}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "tents") return null;
  const height = tentsHeightOf(puzzle);
  const cells = puzzle.size * height;
  const hasSolution = Array.isArray(puzzle.solution) && puzzle.solution.length > 0;
  const solution = new Set(puzzle.solution ?? []);
  const treeSet = new Set(puzzle.trees);
  const mine = decodeTents(myAnswer ?? "", puzzle.size, height).filter((cell) => !treeSet.has(cell));
  const mineSet = new Set(mine);
  const marksOf = (set: ReadonlySet<number>) => Array.from({ length: cells }, (_, cell) => (set.has(cell) ? 1 : 0)) as Mark[];
  const wrong = new Set(hasSolution ? mine.filter((cell) => !solution.has(cell)) : []);
  const missed = new Set(hasSolution ? [...solution].filter((cell) => !mineSet.has(cell)) : []);
  const board = (marks: Mark[], compare: boolean) => (
    <div className="logic-camp-frame logic2-reveal-camp">
      <Board
        size={puzzle.size}
        height={height}
        trees={puzzle.trees}
        rowCounts={puzzle.rowCounts}
        colCounts={puzzle.colCounts}
        marks={marks}
        countSize={22}
        gap={1}
        wrongTents={compare ? wrong : undefined}
        missedTents={compare ? missed : undefined}
        lit={myCorrect}
      />
    </div>
  );
  const mistakes = extraCount(myExtra, "mistakes");
  const { rows, cols } = lineCounts(mine, puzzle.size, height);
  const signsMet = puzzle.rowCounts.filter((n, r) => n >= 0 && rows[r] === n).length + puzzle.colCounts.filter((n, c) => n >= 0 && cols[c] === n).length;
  const signs = puzzle.rowCounts.filter((n) => n >= 0).length + puzzle.colCounts.filter((n) => n >= 0).length;
  return (
    <LogicReveal
      game="tents"
      solved={myCorrect}
      hasSolution={hasSolution}
      yours={board(marksOf(mineSet), true)}
      solution={board(marksOf(solution), false)}
      tally={tallySets(mine, solution, "tents")}
      facts={[
        ...(myCorrect ? [] : [{ label: "Signs met", value: `${signsMet} of ${signs}` }]),
        ...(mistakes !== null ? [{ label: "Mistakes", value: String(mistakes) }] : []),
      ]}
    />
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
    puzzle.type === "tents" && tentsLayoutValid(puzzle, decodeTents(answer, puzzle.size, tentsHeightOf(puzzle))),
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
