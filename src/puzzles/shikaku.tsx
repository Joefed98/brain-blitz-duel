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
  SHIKAKU_SIZE,
  type ShikakuClue,
  type ShikakuRect,
} from "@/lib/duel/shikaku";

import { SHIKAKU_TIME_MS, type ShikakuPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { logicArtVars } from "./logicArt";
import { LogicReveal, extraCount, tallySets } from "./logic2Reveal";

/** The four jewel panes, by main's fill index (the Logic overhaul, 15 Nov 2026). */
export const SHIKAKU_JEWELS = ["sapphire", "emerald", "amber", "ruby"] as const;
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const SHIKAKU_ART = logicArtVars(["logic-cell", "shikaku-pane-sapphire", "shikaku-pane-emerald", "shikaku-pane-amber", "shikaku-pane-ruby"]);

/** The area matches the one number inside (the drag outline turns green). */
function previewFits(rect: ShikakuRect, clues: readonly ShikakuClue[], size: number): boolean {
  const inside = clues.filter((clue) => rectHas(rect, clue.cell, size));
  return inside.length === 1 && inside[0]!.n === (rect.r1 - rect.r0 + 1) * (rect.c1 - rect.c0 + 1);
}

/**
 * Four gold-family fills (Logic review, 15 Nov 2026; display only). Two fills by placement order let touching
 * rectangles share one (and both were the same gold), so each rectangle takes the first fill no earlier touching
 * rectangle holds (`shikakuFills`).
 */
const FILLS = [
  "var(--primary)",
  "color-mix(in oklab, var(--primary) 55%, var(--jz-white))",
  "var(--jz-bronze)",
  "color-mix(in oklab, var(--primary) 55%, var(--jz-bg))",
];

/** True when two rectangles share part of a side. */
export function shikakuRectsTouch(a: ShikakuRect, b: ShikakuRect): boolean {
  const rows = a.r0 <= b.r1 && b.r0 <= a.r1;
  const cols = a.c0 <= b.c1 && b.c0 <= a.c1;
  return (rows && (a.c1 + 1 === b.c0 || b.c1 + 1 === a.c0)) || (cols && (a.r1 + 1 === b.r0 || b.r1 + 1 === a.r0));
}

/**
 * A fill index (0–3) for each rectangle, touching rectangles never alike: the first such colouring in placement order
 * (each rectangle the lowest fill that still lets every later one be coloured), so a placed rectangle keeps its colour
 * unless a new neighbour leaves no other way (always possible in four for rectangles tiling a grid).
 */
export function shikakuFills(rects: readonly ShikakuRect[], colours = FILLS.length): number[] {
  const near = rects.map((r, i) => rects.flatMap((q, j) => (j < i && shikakuRectsTouch(r, q) ? [j] : [])));
  const fill = new Array<number>(rects.length).fill(-1);
  let budget = 200_000;
  const place = (i: number): boolean => {
    if (i === rects.length) return true;
    for (let c = 0; c < colours; c++) {
      if (--budget < 0) return false;
      if (near[i]!.some((j) => fill[j] === c)) continue;
      fill[i] = c;
      if (place(i + 1)) return true;
    }
    fill[i] = -1;
    return false;
  };
  if (place(0)) return fill;
  // Never expected: the plain lowest-free fill, wrapped.
  const out: number[] = [];
  rects.forEach((_, i) => {
    const used = new Set(near[i]!.map((j) => out[j]!));
    let c = 0;
    while (used.has(c)) c++;
    out.push(c % colours);
  });
  return out;
}

export function Board({
  size,
  rows = size,
  clues,
  rects,
  preview,
  small = false,
  pointer,
  wrong,
  ghosts,
}: {
  size: number;
  rows?: number;
  clues: readonly ShikakuClue[];
  rects: readonly ShikakuRect[];
  preview?: ShikakuRect | null;
  small?: boolean;
  pointer?: ReturnType<typeof useGridPointer>;
  /** Reveal: indices into `rects` that are not in the solution (ringed red). */
  wrong?: ReadonlySet<number> | undefined;
  /** Reveal: the solution's rectangles the player didn't draw (dashed outlines). */
  ghosts?: readonly ShikakuRect[] | undefined;
}) {
  const clueAt = new Map(clues.map((clue) => [clue.cell, clue.n]));
  // The Logic overhaul (15 Nov 2026): main's fills (touching rectangles never alike) drawn as four jewel panes.
  const fills = shikakuFills(rects);
  const place = (r: ShikakuRect) => ({
    gridRow: `${r.r0 + 1} / ${r.r1 + 2}`,
    gridColumn: `${r.c0 + 1} / ${r.c1 + 2}`,
  });
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      className="shikaku-board logic-glass logic2-shikaku grid w-full shrink-0 select-none overflow-hidden"
      data-logic2="shikaku"
      data-small={small ? "" : undefined}
      style={{
        ...SHIKAKU_ART,
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
          className="logic-pane logic2-pane pointer-events-none rounded-md"
          data-fill={fills[i]}
          data-jewel={SHIKAKU_JEWELS[fills[i] ?? 0]}
          data-wrong={wrong?.has(i) ? "" : undefined}
          style={{
            ...place(r),
            zIndex: 1,
            "--logic-i": Math.min(i, 17),
            "--logic2-diag": r.r0 + r.c0,
            "--logic-hue": Math.round((i * 137.5 + 20) % 360),
          } as CSSProperties}
        />
      ))}
      {ghosts?.map((r) => (
        <div
          key={`g${r.r0}-${r.c0}-${r.r1}-${r.c1}`}
          className="logic2-rect-ghost pointer-events-none rounded-md"
          data-missed-rect=""
          style={{ ...place(r), zIndex: 2 }}
        />
      ))}
      {preview && (
        <div
          className="logic-pane-preview logic2-preview pointer-events-none rounded-md border-2"
          data-fits={previewFits(preview, clues, size) ? "" : undefined}
          style={{ ...place(preview), zIndex: 2 }}
        />
      )}
      {[...clueAt].map(([cell, n]) => (
        <span
          key={`n${cell}`}
          className="shikaku-clue logic-glass-clue logic2-num pointer-events-none flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden text-center leading-none"
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

/**
 * The intro's worked board (the Logic overhaul, 15 Nov 2026): a real 6 × 6 puzzle with one solution, most of it cut
 * into rectangles and two left to draw (never a dealt board: the live game is 10 × 11).
 */
export const SHIKAKU_EXAMPLE = {
  size: 6,
  clues: [{ cell: 4, n: 3 }, { cell: 7, n: 4 }, { cell: 8, n: 5 }, { cell: 9, n: 5 }, { cell: 18, n: 2 }, { cell: 19, n: 2 }, { cell: 29, n: 6 }, { cell: 30, n: 4 }, { cell: 33, n: 2 }, { cell: 34, n: 3 }] as ShikakuClue[],
  rects: [{ r0: 0, c0: 0, r1: 1, c1: 1 }, { r0: 0, c0: 2, r1: 4, c1: 2 }, { r0: 0, c0: 3, r1: 4, c1: 3 }, { r0: 0, c0: 4, r1: 2, c1: 4 }, { r0: 0, c0: 5, r1: 5, c1: 5 }, { r0: 2, c0: 0, r1: 3, c1: 0 }, { r0: 2, c0: 1, r1: 3, c1: 1 }, { r0: 3, c0: 4, r1: 5, c1: 4 }, { r0: 4, c0: 0, r1: 5, c1: 1 }, { r0: 5, c0: 2, r1: 5, c1: 3 }] as ShikakuRect[],
};

function IntroExample() {
  // Eight of the ten rectangles drawn; two still to go.
  const drawn = SHIKAKU_EXAMPLE.rects.filter((_, i) => i !== 7 && i !== 9);
  return (
    <div style={{ width: 150 }}>
      <Board size={SHIKAKU_EXAMPLE.size} clues={SHIKAKU_EXAMPLE.clues} rects={drawn} small />
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
        soundCue("shikaku.remove");
        setRects((current) => current.filter((_, i) => i !== existing));
        return;
      }
      const rect = rectFrom(a, b, size);
      if (rects.some((r) => rectsOverlap(r, rect)) || !rectValid(rect, clues, size)) {
        setShake((n) => n + 1);
        return;
      }
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

function Reveal({ puzzle, myAnswer, myCorrect, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "shikaku") return null;
  const height = shikakuHeightOf(puzzle);
  const mine = acceptedRects(decodeShikaku(myAnswer ?? "", puzzle.size, height), puzzle.clues, puzzle.size);
  const solution = puzzle.solution ?? [];
  const hasSolution = solution.length > 0;
  const keyOf = (r: ShikakuRect) => `${r.r0},${r.c0},${r.r1},${r.c1}`;
  const solKeys = new Set(solution.map(keyOf));
  const myKeys = new Set(mine.map(keyOf));
  const wrong = new Set(hasSolution ? mine.flatMap((r, i) => (solKeys.has(keyOf(r)) ? [] : [i])) : []);
  const ghosts = hasSolution ? solution.filter((r) => !myKeys.has(keyOf(r))) : [];
  const covered = mine.reduce((sum, r) => sum + (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1), 0);
  const cells = puzzle.size * height;
  const board = (rects: readonly ShikakuRect[], compare: boolean) => (
    <div className="logic-glass-frame logic2-reveal-glass">
      <Board size={puzzle.size} rows={height} clues={puzzle.clues} rects={rects} wrong={compare ? wrong : undefined} ghosts={compare ? ghosts : undefined} />
    </div>
  );
  const mistakes = extraCount(myExtra, "mistakes");
  return (
    <LogicReveal
      game="shikaku"
      solved={myCorrect}
      hasSolution={hasSolution}
      yours={board(mine, true)}
      solution={board(solution, false)}
      tally={tallySets(mine.map(keyOf), solution.map(keyOf), "rectangles")}
      facts={[
        ...(myCorrect ? [] : [{ label: "Squares covered", value: `${covered} of ${cells}` }]),
        ...(mistakes !== null ? [{ label: "Mistakes", value: String(mistakes) }] : []),
      ]}
    />
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
