import { useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
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

const DISC_COLOURS = ["RED", "ORANGE", "GREEN", "BLUE", "PURPLE", "PINK", "BROWN"] as const;

function discColour(size: number): string {
  return GLYPH_COLOURS[DISC_COLOURS[(size - 1) % DISC_COLOURS.length]!];
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
    <div className="flex h-full w-full items-center justify-center gap-1.5">
      {Array.from({ length: Math.max(3, pegs.length) }, (_, peg) => {
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
                    className="rounded-full border-2 border-primary"
                    style={{
                      height: compact ? 7 : 11,
                      width: `${30 + (liftedDisc / discs) * 65}%`,
                      backgroundColor: discColour(liftedDisc),
                    }}
                  />
                )}
              </div>

              <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-end">
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
                        height: compact ? 7 : 12,
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
  const pegs: TowerPegs = [[9, 8, 6], [7, 4, 2], [5, 3], [1]];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Move every disc to the marked peg, one at a time. Never put a bigger disc on a smaller one.
      </p>
      <div style={{ width: 190, height: 96 }}>
        <Pegs pegs={pegs} discs={9} targetPeg={3} compact />
      </div>
      <p className="text-xs text-muted-foreground">
        Nine discs on 3 or 4 pegs — the line below says which. Fewest moves earns a bonus. You have 90 seconds.
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
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        moves <span className="text-primary">{replay.moves}</span> · min {puzzle.minMoves}
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center">
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
        Park the big discs where they won&apos;t block you.
      </p>
    </div>
  );
}

/** The spread, the minimum and one shortest solution all come from the server. */
export const towerPuzzle: PuzzleDefinition = {
  key: "tower",
  name: "Tower",
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
    puzzle.type === "tower" ? `${towerPegCount(puzzle.start)} pegs` : null,
  IntroExample,
  Stage,
  Reveal,
};
