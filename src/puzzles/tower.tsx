import { useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick } from "@/components/puzzles/GridDrag";
import {
  decodeTowerMoves,
  encodeTowerMoves,
  replayTower,
  towerCanMove,
  type TowerMove,
  type TowerPegs,
} from "@/lib/duel/tower";
import { useStageState } from "@/lib/duel/stageState";
import { TOWER_TIME_MS, type TowerPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const DISC_COLOURS = ["RED", "ORANGE", "GREEN", "BLUE", "PURPLE", "PINK", "BROWN"] as const;

function discColour(size: number): string {
  return GLYPH_COLOURS[DISC_COLOURS[(size - 1) % DISC_COLOURS.length]!];
}

/** Three pegs on a base; the target peg wears a gold base. */
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
    <div className="flex h-full w-full items-end justify-center gap-2">
      {[0, 1, 2].map((peg) => {
        const stack = pegs[peg] ?? [];
        const isLifted = lifted === peg;
        const top = stack.length ? stack[stack.length - 1]! : null;
        return (
          <button
            key={peg}
            type="button"
            disabled={!onPeg}
            onClick={() => onPeg?.(peg)}
            aria-label={`Peg ${peg + 1}`}
            className="relative flex h-full flex-1 flex-col items-center justify-end"
          >
            {/* The lifted disc hovers above its peg. */}
            <div
              className={`flex w-full flex-col items-center justify-end ${compact ? "gap-[2px]" : "gap-1"}`}
              style={{ minHeight: 0 }}
            >
              <div className="flex h-6 w-full items-center justify-center">
                {isLifted && liftedDisc !== null && (
                  <div
                    className="rounded-full border-2 border-primary"
                    style={{
                      height: compact ? 8 : 12,
                      width: `${30 + (liftedDisc / discs) * 65}%`,
                      backgroundColor: discColour(liftedDisc),
                    }}
                  />
                )}
              </div>

              <div className="relative flex w-full flex-1 flex-col items-center justify-end">
                <div
                  aria-hidden="true"
                  className="absolute bottom-0 w-[6px] rounded-t bg-border"
                  style={{ height: "100%" }}
                />
                {/* The stack is bottom-to-top from index 0, so the column is drawn
                    in reverse: the smallest disc is the topmost element. */}
                {[...stack].reverse().map((size, index) => {
                  const hide = isLifted && index === 0;
                  return (
                    <div
                      key={size}
                      className={`relative z-10 rounded-full ${shake === peg ? "animate-shake" : ""}`}
                      style={{
                        height: compact ? 8 : 14,
                        marginTop: 2,
                        width: `${30 + (size / discs) * 65}%`,
                        backgroundColor: discColour(size),
                        opacity: hide ? 0.25 : 1,
                        outline:
                          top === size && !hide ? "1px solid rgba(255,255,255,0.25)" : "none",
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div
              className={`mt-1 h-[6px] w-full rounded-full ${
                peg === targetPeg ? "bg-primary" : "bg-border"
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
  const pegs: TowerPegs = [[4, 3], [2], [1]];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Move the whole tower to the marked peg, one disc at a time. Never put a bigger disc on a
        smaller one.
      </p>
      <div style={{ width: 168, height: 96 }}>
        <Pegs pegs={pegs} discs={4} targetPeg={2} compact />
      </div>
      <p className="text-xs text-muted-foreground">
        Fewest moves earns a bonus. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "tower" }: PuzzleStageProps) {
  const isTower = puzzle.type === "tower";
  const discs = isTower ? puzzle.discs : 4;
  const targetPeg = isTower ? puzzle.targetPeg : 2;
  const [moves, setMoves] = useStageState<TowerMove[]>(stateKey, "towerMoves", () => []);
  const [lifted, setLifted] = useStageState<number | null>(stateKey, "towerLifted", () => null);
  const [shake, setShake] = useStageState<number | null>(stateKey, "towerShake", () => null);
  const submitted = useRef(false);

  const replay = useMemo(() => replayTower(discs, targetPeg, moves), [discs, targetPeg, moves]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        moves <span className="text-primary">{replay.moves}</span> · min {puzzle.minMoves}
      </p>

      <div className="flex min-h-0 flex-1 items-end justify-center pb-1">
        <Pegs
          pegs={replay.pegs}
          discs={discs}
          targetPeg={targetPeg}
          lifted={lifted}
          shake={shake}
          onPeg={tapPeg}
        />
      </div>

      <div className="flex shrink-0 justify-center gap-2">
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
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        Tap a peg to lift its top disc, then tap where it goes
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "tower") return null;
  const mine = replayTower(puzzle.discs, puzzle.targetPeg, decodeTowerMoves(myAnswer ?? ""));
  const limit = puzzle.timeLimitMs ?? TOWER_TIME_MS;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((limit - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 190, height: 110 }}>
        <Pegs pegs={mine.pegs} discs={puzzle.discs} targetPeg={puzzle.targetPeg} compact />
      </div>
      <p className="font-display text-2xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {mine.moves} {myCorrect ? "✓" : "✗"}
        </span>
        <span className="ml-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          moves · min {puzzle.minMoves}
          {myCorrect && elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
        </span>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        The smallest disc moves every other turn.
      </p>
    </div>
  );
}

/** The tower itself is fixed; only the target peg and disc count vary. */
export const towerPuzzle: PuzzleDefinition = {
  key: "tower",
  name: "Tower",
  category: "logic",
  timeLimitMs: TOWER_TIME_MS,
  revealMs: 5_000,
  generate: () =>
    ({
      type: "tower",
      discs: 4,
      targetPeg: 2,
      minMoves: 15,
      timeLimitMs: TOWER_TIME_MS,
    }) satisfies TowerPuzzleData,
  check: () => false,
  revealHeading: "Your tower",
  IntroExample,
  Stage,
  Reveal,
};
