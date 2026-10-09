import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import {
  decodeTowerMoves,
  encodeTowerMoves,
  replayTower,
  towerCanMove,
  towerPegsFrom,
  type TowerMove,
  type TowerPegs,
} from "@/lib/duel/tower";
import { useStageState } from "@/lib/duel/stageState";
import { towerPegCount } from "@/lib/duel/tower";
import { TOWER_DISCS, TOWER_PEGS, TOWER_TIME_MS, type TowerPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Graduated by size, smallest (light yellow) to largest (sky blue); equal sizes share a colour. */
const HANOI_SHADES = 9;

function discColour(size: number, discs = TOWER_DISCS): string {
  const step = discs <= 1 ? 1 : Math.round(((size - 1) * (HANOI_SHADES - 1)) / (discs - 1)) + 1;
  return `var(--hanoi-${Math.max(1, Math.min(HANOI_SHADES, step))})`;
}

/** Three or four pegs on a base; the target peg wears a gold base. */
function Pegs({
  pegs,
  discs,
  targetPeg,
  lifted,
  shake,
  onPeg,
  compact,
}: {
  pegs: TowerPegs;
  discs: number;
  targetPeg: number;
  lifted?: number | null;
  shake?: number | null;
  onPeg?: ((peg: number) => void) | undefined;
  compact?: boolean;
}) {
  const liftedDisc =
    lifted === null || lifted === undefined ? null : (pegs[lifted]?.at(-1) ?? null);

  return (
    <div className={`flex h-full w-full items-center justify-center ${compact ? "gap-1.5" : "gap-3 px-2"}`}>
      {Array.from({ length: Math.max(3, pegs.length) }, (_, peg) => {
        const stack = pegs[peg] ?? [];
        const isLifted = lifted === peg;
                return (
          <button
            key={peg}
            type="button"
            disabled={!onPeg}
            onClick={() => onPeg?.(peg)}
            aria-label={`Post ${peg + 1}`}
             className="relative flex h-full flex-1 flex-col items-center justify-center"
          >
            {/* The lifted disc hovers above its peg. */}
            <div
              className={`flex w-full flex-col items-center justify-end ${compact ? "gap-[2px]" : "gap-1"}`}
              style={{ height: discs * (compact ? 9 : 14) + 24, maxHeight: "calc(100% - 10px)", minHeight: 0 }}
            >
              <div className="flex h-6 w-full items-center justify-center">
                {isLifted && liftedDisc !== null && (
                  <div
                    className="hanoi-disc hanoi-lifted rounded-full -translate-y-0.5"
                    style={{
                      height: compact ? 7 : 12,
                      width: `${30 + (liftedDisc / discs) * 65}%`,
                      backgroundColor: discColour(liftedDisc, discs),
                    }}
                  />
                )}
              </div>

              <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-end">
                <div
                  aria-hidden="true"
                  className="hanoi-post absolute bottom-0 w-[7px] rounded-t-full"
                  style={{ height: "100%" }}
                />
                {/* The stack is bottom-to-top from index 0, so the column is drawn
                    in reverse: the smallest disc is the topmost element. */}
                {[...stack].reverse().map((size, index) => {
                  const hide = isLifted && index === 0;
                  return (
                    <div
                      key={size}
                      className={`hanoi-disc relative z-10 rounded-full ${shake === peg ? "animate-shake" : ""}`}
                      style={{
                        height: compact ? 7 : 12,
                        marginTop: 2,
                        width: `${30 + (size / discs) * 65}%`,
                        backgroundColor: discColour(size, discs),
                        opacity: hide ? 0.25 : 1,
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div
              className={`mt-1 h-[7px] w-full rounded-full ${
                peg === targetPeg ? "bg-primary" : "hanoi-base"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const pegs: TowerPegs = [[9, 8, 6], [7, 4, 2], [5, 3], [1]];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Move every ring to the gold-based post, one at a time. Never put a bigger ring on a smaller one.
      </p>
      <div style={{ width: 190, height: 96 }}>
        <Pegs pegs={pegs} discs={9} targetPeg={3} compact />
      </div>
      <p className="text-xs text-muted-foreground">
        Nine rings on 3 or 4 posts - the line below says which. Fewest moves earns a bonus. You have 90 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "tower" }: PuzzleStageProps) {
  const isTower = puzzle.type === "tower";
  const discs = isTower ? puzzle.discs : TOWER_DISCS;
  const targetPeg = isTower ? puzzle.targetPeg : TOWER_PEGS - 1;
  const start = useMemo(
    () => (isTower ? (puzzle.start ?? []) : []),
    // The stored spread never changes during a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTower],
  );
  const [moves, setMoves] = useStageState<TowerMove[]>(stateKey, "towerMoves", () => []);
  const [lifted, setLifted] = useStageState<number | null>(stateKey, "towerLifted", () => null);
  const [shake, setShake] = useStageState<number | null>(stateKey, "towerShake", () => null);
  const submitted = useRef(false);

  const replay = useMemo(
    () => replayTower(start, targetPeg, discs, moves),
    [start, targetPeg, discs, moves],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeTowerMoves(moves));
  }, [moves, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !replay.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeTowerMoves(moves));
  }, [replay.solved, moves, locked, onSubmit]);

  const reject = (peg: number) => {
    setShake(peg);
    buzz(20);
    playWrong();
    setTimeout(() => setShake(null), 320);
  };

  const tapPeg = (peg: number) => {
    if (locked || submitted.current || replay.solved) return;
    if (lifted === null) {
      if (!(replay.pegs[peg] ?? []).length) return;
      hapticTick();
      setLifted(peg);
      return;
    }
    if (lifted === peg) {
      setLifted(null);
      return;
    }
    if (!towerCanMove(replay.pegs, lifted, peg)) {
      reject(peg);
      setLifted(null);
      return;
    }
    hapticTick();
    setMoves((current) => [...current, { from: lifted, to: peg }]);
    setLifted(null);
  };

  if (!isTower) return null;

  return (
    <div data-stage-column="2" className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        moves <span className="text-primary">{replay.moves}</span>
      </p>

      <div data-game-arena="tall" className="flex min-h-0 flex-1 items-center justify-center">
        <Pegs
          pegs={replay.pegs}
          discs={discs}
          targetPeg={targetPeg}
          lifted={lifted}
          shake={shake}
          onPeg={tapPeg}
        />
      </div>

      <div data-game-controls="actions" className="flex shrink-0 justify-center gap-3 px-2">
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={() => {
            setLifted(null);
            setMoves((current) => current.slice(0, -1));
          }}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={() => {
            setLifted(null);
            setMoves([]);
          }}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "tower") return null;
  const start = puzzle.start ?? [];
  const mine = replayTower(start, puzzle.targetPeg, puzzle.discs, decodeTowerMoves(myAnswer ?? ""));
  const limit = timeLimitMs;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((limit - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 200, height: 110 }}>
        <Pegs
          pegs={mine.moves ? mine.pegs : towerPegsFrom(start)}
          discs={puzzle.discs}
          targetPeg={puzzle.targetPeg}
          compact
        />
      </div>
      <p className="font-display text-2xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {mine.moves} {myCorrect ? "✓" : "✗"}
        </span>
        <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">
          moves · min {puzzle.minMoves}
          {myCorrect && elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
        </span>
      </p>
      <p className="text-center text-base text-muted-foreground">
        Park the big rings where they won&apos;t block you.
      </p>
    </div>
  );
}

/** The spread, the minimum and one shortest solution all come from the server. */
export const towerPuzzle: PuzzleDefinition = {
  key: "tower",
  name: gameDisplayName("tower"),
  category: "logic",
  timeLimitMs: TOWER_TIME_MS,
  revealMs: 5_000,
  generate: () =>
    ({
      type: "tower",
      discs: TOWER_DISCS,
      targetPeg: TOWER_PEGS - 1,
      start: [],
      minMoves: 0,
      timeLimitMs: TOWER_TIME_MS,
    }) satisfies TowerPuzzleData,
  check: () => false,
  revealHeading: "Your tower",
  introLine: (puzzle) =>
    puzzle.type === "tower" ? `${towerPegCount(puzzle.start)} posts` : null,
  IntroExample,
  Stage,
  Reveal,
};
