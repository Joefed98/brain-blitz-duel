import { useEffect, useRef } from "react";

import { gameFx } from "@/lib/fx/kit";
import { useRevealViews } from "@/components/duel/revealContext";
import { useRevealBoardWidth } from "@/components/puzzles/pattern/revealBoard";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { BlockBoard, BlockPartyPuzzle } from "@/components/puzzles/BlockPartyPuzzle";
import { blockGeometry, decodePlacements, verifyPlacements } from "@/lib/duel/blockParty";
import { HudPills, type HudPillItem } from "@/components/puzzles/HudPills";
import { BLOCK_TIME_MS, type BlockPartyPuzzleData, type BlockPlacement } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. */
const EXAMPLE_BLOCKERS = [3, 7, 12, 16, 21, 28, 33];
const EXAMPLE_PLACED = [
  { piece: 4, cells: [24, 25, 30, 31] },
  { piece: 2, cells: [18, 19, 20] },
  { piece: 1, cells: [13, 14] },
];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Fit every piece around the pegs. Tap to turn, double-tap to flip.
      </p>
      <BlockBoard blockers={EXAMPLE_BLOCKERS} placements={EXAMPLE_PLACED} size={150} />
      <p className="text-xs text-muted-foreground">
        Fill every free square to finish. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  if (puzzle.type !== "blockparty") return null;
  return (
    <BlockPartyPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

/**
 * What the reveal reads from the stored grade (the server's own extra; never recomputed differently on the phone):
 * the legal placements it counted, the squares covered, the illegal drops (blockRev 4) or the pieces right first time
 * (the standard's blockRev 2–3). An older round without a stored extra falls back to its own answer, checked with the
 * same shared rules the server uses.
 */
export interface BlockRevealFacts {
  placements: BlockPlacement[];
  covered: number;
  illegalDrops: number | null;
  rightFirstTime: number | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function blockRevealFacts(puzzle: BlockPartyPuzzleData, answer: string | null, extra: Record<string, unknown> | null | undefined): BlockRevealFacts {
  const geo = blockGeometry(puzzle);
  const stored = typeof extra?.["placements"] === "string" ? decodePlacements(extra["placements"] as string) : null;
  const placements = stored ?? verifyPlacements(puzzle.blockers, decodePlacements(answer ?? ""), geo).legal;
  const covered = num(extra?.["covered"]) ?? placements.reduce((sum, p) => sum + p.cells.length, 0);
  return { placements, covered, illegalDrops: num(extra?.["illegalDrops"]), rightFirstTime: num(extra?.["rightFirstTime"]) };
}

const cellsKey = (cells: readonly number[]) => [...cells].sort((a, b) => a - b).join(",");

/** On the player's board: pieces off every solution spot (unfinished only) and the free squares left empty. */
export function blockRevealMarks(puzzle: BlockPartyPuzzleData, placements: readonly BlockPlacement[], solved: boolean) {
  const geo = blockGeometry(puzzle);
  if (solved) return { wrong: [] as number[], gaps: [] as number[] };
  const spots = new Set((puzzle.solution ?? []).map((s) => cellsKey(s.cells)));
  const wrong = spots.size ? placements.filter((p) => !spots.has(cellsKey(p.cells))).map((p) => p.piece) : [];
  const taken = new Set<number>(puzzle.blockers);
  for (const p of placements) for (const c of p.cells) taken.add(c);
  const gaps = Array.from({ length: geo.cells }, (_, c) => c).filter((c) => !taken.has(c));
  return { wrong, gaps };
}

const pctOf = (v: number, n: number) => `${(v * 100) / n}%`;

/**
 * The result lines under each board (stage 2): on a solve, the effects kit's `win` lands on the one in view (scale
 * in with a gold burst; silent, the reveal plays its own sounds; no haptic outside a live round). Asked a frame after
 * mount, once the reveal's Solution / Yours switch has hidden the other column, so the burst never comes from a hidden
 * box. It never wraps a board: the reveal's fit measures and scales the boards themselves.
 */
function RevealResult({ solved, view, children }: { solved: boolean; view: "solution" | "yours"; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!solved || typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      const el = ref.current;
      if (el && el.getClientRects().length > 0) gameFx("win", el, { silent: true, inGame: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [solved]);
  return (
    <div ref={ref} className="bp-reveal-result flex w-full flex-col items-center gap-2" data-bp-result={solved ? "solved" : "unfinished"} data-bp-result-view={view}>
      {children}
    </div>
  );
}

/** One reveal board, drawn as the reveal's fit target (`data-reveal-board`: scaled as itself, never its column). */
function RevealBoard({
  puzzle,
  placements,
  marks,
  boardRef,
  width,
}: {
  puzzle: BlockPartyPuzzleData;
  placements: BlockPlacement[];
  marks?: { wrong: number[]; gaps: number[] } | undefined;
  /** The shown board, measured for the template's stage (G4). */
  boardRef?: React.Ref<HTMLDivElement> | undefined;
  /** The board's width for the stage, once measured (G4). */
  width?: number | null | undefined;
}) {
  const n = blockGeometry(puzzle).cols;
  const wrong = new Set(marks?.wrong ?? []);
  return (
    <div ref={boardRef} className="bp-reveal-board" data-reveal-board="" style={width ? { width } : undefined}>
      <BlockBoard blockers={puzzle.blockers} placements={placements} cols={n}>
        {placements
          .filter((p) => wrong.has(p.piece))
          .flatMap((p) =>
            p.cells.map((cell) => (
              <span
                key={`w${cell}`}
                data-reveal-wrong={p.piece}
                aria-hidden="true"
                className="bp-mark bp-mark--wrong"
                style={{ left: pctOf(cell % n, n), top: pctOf(Math.floor(cell / n), n), width: pctOf(1, n), height: pctOf(1, n) }}
              />
            )),
          )}
        {(marks?.gaps ?? []).map((cell) => (
          <span
            key={`g${cell}`}
            data-reveal-gap={cell}
            aria-hidden="true"
            className="bp-mark bp-mark--gap"
            style={{ left: pctOf(cell % n, n), top: pctOf(Math.floor(cell / n), n), width: pctOf(1, n), height: pctOf(1, n) }}
          />
        ))}
      </BlockBoard>
    </div>
  );
}

/**
 * The answer reveal (the Pattern overhaul's reveal, 15 Nov 2026): the solution large; under Yours the player's board
 * with every piece off a solution spot outlined red and every square left empty marked, then the numbers behind the
 * score, from the stored grade. Two labelled columns for the reveal's Solution / Yours switch, one board at a time.
 */
/** The reveal's two views on the template's control (G4). */
const BP_REVEAL_VIEWS = [
  { id: "solution", label: "Solution" },
  { id: "yours", label: "Yours" },
] as const;
const BP_YOURS_ONLY = [{ id: "yours", label: "Yours" }] as const;

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining, myExtra }: PuzzleRevealProps) {
  // Solution and Yours on the template's views control (the polish plan's G4, 27 Nov 2026), one board at a time at the
  // stage's size.
  const hasSolution = puzzle.type === "blockparty" && Boolean(puzzle.solution?.length);
  const view = useRevealViews(hasSolution ? BP_REVEAL_VIEWS : BP_YOURS_ONLY);
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fitWidth = useRevealBoardWidth(rootRef, boardRef, { max: 360 });
  if (puzzle.type !== "blockparty") return null;
  const geo = blockGeometry(puzzle);
  const facts = blockRevealFacts(puzzle, myAnswer, myExtra);
  const marks = blockRevealMarks(puzzle, facts.placements, myCorrect);
  const pieces = geo.pieces.length;
  const seconds = myCorrect && typeof myMsRemaining === "number" ? Math.max(0, Math.floor(myMsRemaining / 1000)) : null;
  const items: Array<HudPillItem | null> = [
    { id: "pieces", label: "Pieces placed", value: `${facts.placements.length}/${pieces}`, tone: facts.placements.length === pieces ? "good" : undefined },
    marks.wrong.length ? { id: "wrong", label: "Off the solution", value: `${marks.wrong.length}`, tone: "warn" } : null,
    !myCorrect ? { id: "gaps", label: "Squares empty", value: `${Math.max(0, geo.free - facts.covered)}` } : null,
    facts.illegalDrops !== null
      ? { id: "illegal", label: facts.illegalDrops === 1 ? "Illegal drop" : "Illegal drops", value: `${facts.illegalDrops}`, tone: facts.illegalDrops > 0 ? "warn" : "good" }
      : facts.rightFirstTime !== null
        ? { id: "first", label: "Right first time", value: `${facts.rightFirstTime}/${pieces}` }
        : null,
    seconds !== null ? { id: "time", label: "Time left", value: `${seconds} s` } : null,
  ];

  return (
    <div ref={rootRef} className="bp-reveal flex w-full flex-col items-center gap-3">
      <div className="bp-reveal-space">
        <div className="bp-reveal-pair">
          {puzzle.solution?.length ? (
            <div hidden={view !== "solution"} className="bp-reveal-col flex flex-col items-center gap-2" data-reveal-view="solution">
              <RevealBoard puzzle={puzzle} placements={puzzle.solution} boardRef={view === "solution" ? boardRef : undefined} width={fitWidth} />
              <RevealResult solved={myCorrect} view="solution">
                <span className="bp-reveal-label sr-only">Solution</span>
                {/* A line under the solution (the switch hides the label): with only a board in the shown view the
                    reveal's fit drew it at half size (the stage-1 finding), so the solution keeps a caption of its own. */}
                <p className="bp-reveal-caption" data-solution-caption="">
                  One way to fill every square
                </p>
              </RevealResult>
            </div>
          ) : null}
          <div hidden={view !== "yours"} className="bp-reveal-col flex flex-col items-center gap-2" data-reveal-view="yours">
            <RevealBoard puzzle={puzzle} placements={facts.placements} marks={marks} boardRef={view === "yours" ? boardRef : undefined} width={fitWidth} />
            <RevealResult solved={myCorrect} view="yours">
              <span className="bp-reveal-label sr-only">Yours</span>
              <HudPills testId="blockparty-reveal" items={items} className="bp-reveal-pills" />
            </RevealResult>
            {marks.wrong.length || marks.gaps.length ? (
              <p className="bp-reveal-key">
                {marks.wrong.length ? <span className="bp-key bp-key--wrong">Red: not in a solution spot</span> : null}
                {marks.gaps.length ? <span className="bp-key bp-key--gap">Dashed: left empty</span> : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Layouts are solver-verified on the server; the solution stays server-side. */
export const blockPartyPuzzle: PuzzleDefinition = {
  key: "blockparty",
  name: gameDisplayName("blockparty"),
  category: "pattern",
  timeLimitMs: BLOCK_TIME_MS,
  generate: () => ({ type: "blockparty", blockers: [] }) satisfies BlockPartyPuzzleData,
  check: () => false,
  revealHeading: "The solution",
  IntroExample,
  Stage,
  Reveal,
};
