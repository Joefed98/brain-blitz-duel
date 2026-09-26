import { useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick } from "@/components/puzzles/GridDrag";
import { useStageState } from "@/lib/duel/stageState";
import {
  canPour,
  decodeTubeMoves,
  encodeTubeMoves,
  replayTubes,
  topGroup,
  tubeSorted,
  type TubeMove,
  type TubeState,
} from "@/lib/duel/tubes";
import { TUBES_COLOURS, TUBES_COUNT, TUBES_TIME_MS, type TubesPuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

// The eight game colours from the shared palette (GOLD is reserved for the lift highlight).
const BALL_COLOURS = [
  "RED",
  "BLUE",
  "GREEN",
  "PURPLE",
  "PINK",
  "ORANGE",
  "BROWN",
  "YELLOW",
] as const;

function ballColour(index: number): string {
  return GLYPH_COLOURS[BALL_COLOURS[index % BALL_COLOURS.length]!];
}

/** Ten tubes in two rows of five; the lifted tube wears a gold outline. */
function Tubes({
  tubes,
  lifted,
  shake,
  onTube,
  compact,
}: {
  tubes: TubeState;
  lifted?: number | null;
  shake?: number | null;
  onTube?: ((tube: number) => void) | undefined;
  compact?: boolean;
}) {
  const ballSize = compact ? 9 : 15;
  return (
    <div className="grid h-full w-full grid-cols-5 grid-rows-2 place-items-end justify-center gap-x-1.5 gap-y-2">
      {tubes.map((tube, index) => {
        const isLifted = lifted === index;
        const group = topGroup(tube);
        const liftCount = isLifted && group ? group.count : 0;
        return (
          <button
            key={index}
            type="button"
            disabled={!onTube}
            onClick={() => onTube?.(index)}
            aria-label={`Tube ${index + 1}`}
            className={`flex h-full w-full flex-col items-center justify-end rounded-b-[14px] rounded-t-md border-2 p-[3px] ${
              shake === index ? "animate-shake" : ""
            } ${
              isLifted
                ? "border-primary bg-primary/10"
                : tubeSorted(tube)
                  ? "border-ok/60 bg-card"
                  : "border-border bg-card"
            }`}
            style={{ maxWidth: compact ? 26 : 42 }}
          >
            <div className="flex w-full flex-col-reverse items-center justify-start gap-[3px]">
              {tube.map((colour, ball) => {
                const rising = isLifted && ball >= tube.length - liftCount;
                return (
                  <span
                    key={ball}
                    className="rounded-full"
                    style={{
                      width: ballSize,
                      height: ballSize,
                      backgroundColor: ballColour(colour),
                      transform: rising ? "translateY(-4px)" : "none",
                      transition: "transform 150ms ease",
                      boxShadow: rising ? "0 0 0 2px rgba(245,184,46,0.9)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  const tubes: TubeState = [[0, 1, 0], [1, 1], [0], []];
  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: 150, height: 120 }}>
        <Tubes tubes={tubes} lifted={2} compact />
      </div>
      <p className="text-xs text-muted-foreground">
        Tube 3&apos;s top ball is lifted — pour it onto the empty tube or a matching colour.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "tubes" }: PuzzleStageProps) {
  const isTubes = puzzle.type === "tubes";
  const start = useMemo(
    () => (isTubes ? puzzle.tubes.map((tube) => [...tube]) : []),
    // The stored board never changes during a round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTubes],
  );
  const [moves, setMoves] = useStageState<TubeMove[]>(stateKey, "tubeMoves", () => []);
  const [lifted, setLifted] = useStageState<number | null>(stateKey, "tubeLifted", () => null);
  const [shake, setShake] = useStageState<number | null>(stateKey, "tubeShake", () => null);
  const submitted = useRef(false);

  const replay = useMemo(() => replayTubes(start, moves), [start, moves]);

  useEffect(() => {
    onDraftAnswer?.(encodeTubeMoves(moves));
  }, [moves, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !replay.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeTubeMoves(moves));
  }, [replay.solved, moves, locked, onSubmit]);

  const tapTube = (tube: number) => {
    if (locked || submitted.current || replay.solved) return;
    if (lifted === null) {
      if (!(replay.tubes[tube] ?? []).length) return;
      hapticTick();
      setLifted(tube);
      return;
    }
    if (lifted === tube) {
      setLifted(null);
      return;
    }
    if (!canPour(replay.tubes, lifted, tube)) {
      // An invalid destination shakes and keeps the lift.
      setShake(tube);
      buzz(20);
      playWrong();
      setTimeout(() => setShake(null), 320);
      return;
    }
    hapticTick();
    setMoves((current) => [...current, { from: lifted, to: tube }]);
    setLifted(null);
  };

  if (!isTubes) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        moves <span className="text-primary">{replay.moves}</span>
      </p>

      <div className="flex min-h-0 flex-1 items-end justify-center pb-1">
        <Tubes tubes={replay.tubes} lifted={lifted} shake={shake} onTube={tapTube} />
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
        Tap a tube to lift its top balls, then tap where to pour
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "tubes") return null;
  const mine = replayTubes(puzzle.tubes, decodeTubeMoves(myAnswer ?? ""));
  const limit = TUBES_TIME_MS;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((limit - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 190, height: 150 }}>
        <Tubes tubes={mine.tubes} compact />
      </div>
      <p className="font-display text-2xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {mine.moves} {myCorrect ? "✓" : "✗"}
        </span>
        <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">
          moves{puzzle.minMoves ? ` · min ${puzzle.minMoves}` : ""}
          {myCorrect && elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
        </span>
      </p>
      <p className="text-center text-base text-muted-foreground">
        {myCorrect
          ? "Keep one tube empty for as long as you can."
          : `${mine.sorted} of ${TUBES_COLOURS} tubes finished.`}
      </p>
    </div>
  );
}

/** The board, its searched minimum and one shortest solution come from the server. */
export const sortTubesPuzzle: PuzzleDefinition = {
  key: "tubes",
  name: "Sort the Tubes",
  category: "logic",
  timeLimitMs: TUBES_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "tubes",
      tubes: Array.from({ length: TUBES_COUNT }, () => []),
      minMoves: 0,
    }) satisfies TubesPuzzleData,
  check: () => false,
  revealHeading: "Your tubes",
  IntroExample,
  Stage,
  Reveal,
};
