import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { Button } from "@/components/ui/button";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import {
  canPour,
  decodeTubeLog,
  decodeTubeMoves,
  encodeTubeLog,
  encodeTubeMoves,
  replayTubeLog,
  replayTubes,
  topGroup,
  tubeSorted,
  type TubeMove,
  type TubeState,
  type TubeToken,
} from "@/lib/duel/tubes";
import { limitText, tubesPourLimit, tubesSendsUndo } from "@/lib/duel/moveLimits";
import { TUBES_COLOURS, TUBES_COUNT, TUBES_TIME_MS, type TubesPuzzleData } from "@/lib/duel/types";
import { playCorrect, playWrong } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { ParMeter } from "@/components/puzzles/depth/ParMeter";
import { usesDepth } from "@/lib/duel/logicDepth";
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

/** A faint symbol per liquid colour, as a second cue beside the colour itself. */
const POTION_SYMBOLS = ["●", "▲", "■", "◆", "★", "✚", "♥", "✦"] as const;

/** Ten glass flasks in two rows of five; each ball is one countable liquid layer. */
export function Tubes({
  tubes,
  lifted,
  shake,
  onTube,
  compact,
  layerHeight,
  poured,
}: {
  tubes: TubeState;
  lifted?: number | null;
  shake?: number | null;
  onTube?: ((tube: number) => void) | undefined;
  compact?: boolean;
  /** Reveal: CSS length for one compact layer (sized from its box). */
  layerHeight?: string;
  /** The flask that was just poured into, and how many layers arrived. */
  poured?: { tube: number; count: number; key: number } | null;
}) {
  const ballSize = compact ? 9 : 11;
  let corkOrder = 0;
  return (
    <div className={`logic-potions grid w-full grid-cols-5 grid-rows-2 justify-center ${compact ? "gap-2 h-full place-items-end" : "gap-3 px-2 tubes-play-board shrink-0 place-items-center"}`}>
      {tubes.map((tube, index) => {
        const isLifted = lifted === index;
        const group = topGroup(tube);
        const liftCount = isLifted && group ? group.count : 0;
        const sorted = tubeSorted(tube);
        const order = sorted ? corkOrder++ : 0;
        return (
          <Button
            key={index}
            type="button"
            disabled={!onTube}
            variant="ghost"
            onClick={() => onTube?.(index)}
            aria-label={`Flask ${index + 1}`}
            className={`flex h-full w-full min-w-0 items-end justify-center rounded-none border-0 p-0 hover:bg-transparent disabled:opacity-100 ${compact ? "" : "min-h-11 min-w-11"}`}
          >
            <span className={`flask logic-flask relative flex h-full w-full shrink-0 flex-col items-center justify-end rounded-b-[14px] rounded-t-md border-2 p-[3px] ${shake === index ? "animate-shake" : ""} ${
              isLifted ? "border-primary" : sorted ? "border-primary/60" : ""
            }`}
              style={{ ...(compact ? { maxWidth: layerHeight ? 36 : 26 } : {}), "--logic-i": order, "--logic-wobble": `${(index * 0.53) % 2.4}s` } as CSSProperties}
            >
              <span aria-hidden="true" className="logic-flask-rim" />
              {sorted && (
                <span aria-label="Corked" className="pointer-events-none absolute -top-[7px] left-1/2 z-10 -translate-x-1/2">
                  <span className="potion-cork logic-cork block h-[9px] w-[60%] min-w-[10px] rounded-[3px]" style={{ background: "linear-gradient(180deg, var(--cork), var(--cork-dark))", width: compact ? 12 : 20 }} />
                  {!compact && <span aria-hidden="true" className="potion-sparkle absolute -right-3 -top-2 text-xs text-primary">✦</span>}
                </span>
              )}
            <span className="logic-liquid flex w-full flex-col-reverse items-stretch justify-start overflow-hidden rounded-b-[10px]">
              {tube.map((colour, ball) => {
                const rising = isLifted && ball >= tube.length - liftCount;
                const topLayer = ball === tube.length - 1;
                const arriving = poured?.tube === index && ball >= tube.length - poured.count;
                return (
                  <span
                    key={arriving ? `${ball}-${poured?.key}` : ball}
                    className={`potion-layer logic-potion flex w-full shrink-0 items-center justify-center ${compact ? "" : "tubes-play-layer"} ${arriving ? "logic-potion-fill" : ""}`}
                    // Presentation only: a same-colour layer above joins this one with a faint line, so one colour reads as one body of liquid.
                    data-same-above={tube[ball + 1] === colour ? "" : undefined}
                    style={{
                      ...(compact ? { height: layerHeight ?? ballSize + 3 } : {}),
                      backgroundColor: ballColour(colour),
                      transform: rising ? "translateY(-4px)" : "none",
                      transition: "transform 150ms ease",
                      boxShadow: rising ? "0 0 0 2px var(--primary)" : undefined,
                      ...(arriving ? { animationDelay: `${(ball - (tube.length - (poured?.count ?? 0))) * 60}ms` } : {}),
                    }}
                  >
                    {!compact && <span aria-hidden="true" className="logic-potion-glyph">{POTION_SYMBOLS[colour % POTION_SYMBOLS.length]}</span>}
                    {topLayer && !compact && <span aria-hidden="true" className={`logic-potion-surface ${arriving ? "logic-potion-surface-pour" : ""}`} />}
                    {!compact && topLayer && !sorted && (
                      <>
                        <span aria-hidden="true" className="potion-bubble" style={{ left: "28%", animationDelay: `${(index * 0.37) % 2.6}s` }} />
                        <span aria-hidden="true" className="potion-bubble" style={{ left: "64%", animationDelay: `${(index * 0.37 + 1.3) % 2.6}s` }} />
                      </>
                    )}
                  </span>
                );
              })}
            </span>
            <span aria-hidden="true" className="logic-flask-shine" />
            </span>
          </Button>
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
        Flask 3&apos;s top layer is lifted - pour it into the empty flask or onto a matching colour. Each flask holds five layers; a full one-colour flask gets a cork. You have 90 seconds.
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
  // tubesRev 1 (moveLimits.ts): the log keeps Undo and Reset, every pour counts and the last allowed pour ends the board.
  const logged = isTubes && tubesSendsUndo(puzzle);
  const pourLimit = isTubes ? tubesPourLimit(puzzle) : null;
  const [moves, setMoves] = useStageState<TubeToken[]>(stateKey, "tubeMoves", () => []);
  const [lifted, setLifted] = useStageState<number | null>(stateKey, "tubeLifted", () => null);
  const [shake, setShake] = useStageState<number | null>(stateKey, "tubeShake", () => null);
  const [poured, setPoured] = useState<{ tube: number; count: number; key: number } | null>(null);
  const submitted = useRef(false);

  const play = (log: TubeToken[]) =>
    logged ? replayTubeLog(start, log, pourLimit) : { ...replayTubes(start, log as TubeMove[]), outOfPours: false, depth: log.length };
  const encode = (log: TubeToken[]) => (logged ? encodeTubeLog(log) : encodeTubeMoves(log as TubeMove[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const replay = useMemo(() => play(moves), [start, moves, logged, pourLimit]);
  const solving = useSolveFx("tubes", isTubes && replay.solved);
  const inFrame = useFrameProgress(replay.sorted, TUBES_COLOURS, "corked");

  useEffect(() => {
    onDraftAnswer?.(encode(moves));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, onDraftAnswer, logged]);

  useEffect(() => {
    if (locked || submitted.current || !(replay.solved || replay.outOfPours)) return;
    submitted.current = true;
    if (replay.solved) playCorrect();
    // Out of pours: the board ends unfinished and goes in now.
    onSubmit(encode(moves));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay.solved, replay.outOfPours, moves, locked, onSubmit]);

  const tapTube = (tube: number) => {
    if (locked || submitted.current || replay.solved || replay.outOfPours) return;
    if (lifted === null) {
      if (!(replay.tubes[tube] ?? []).length) return;
      soundCue("tubes.lift");
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
      playWrong();
      setTimeout(() => setShake(null), 320);
      return;
    }
    const after = play([...moves, { from: lifted, to: tube }]).tubes[tube] ?? [];
    soundCue("tubes.pour");
    if (tubeSorted(after)) soundCue("tubes.cork");
    setPoured({ tube, count: after.length - (replay.tubes[tube] ?? []).length, key: moves.length + 1 });
    setMoves((current) => [...current, { from: lifted, to: tube }]);
    setLifted(null);
  };

  const undo = () => {
    setLifted(null);
    setPoured(null);
    // Undo never gives a pour back on a limited board: it is logged, not removed.
    setMoves((current) => (logged ? [...current, "undo"] : current.slice(0, -1)));
  };

  const reset = () => {
    setLifted(null);
    setPoured(null);
    setMoves((current) => (logged ? [...current, "reset"] : []));
  };

  // Desktop keys: 1–9 tap flasks 1–9 (0 the tenth) in on-screen order, Z or Backspace = Undo, R = Reset.
  useGameKeys((kind, key, event) => {
    if (!isTubes) return false;
    const tube = /^[0-9]$/.test(key) ? (key === "0" ? 9 : Number(key) - 1) : -1;
    const used = (tube >= 0 && tube < replay.tubes.length) || key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (tube >= 0) tapTube(tube);
    else if (!locked && replay.depth !== 0) {
      if (key === "r") reset();
      else undo();
    }
    return true;
  });

  if (!isTubes) return null;

  return (
    <div data-logic-stage="tubes" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic">
        {inFrame ? null : (
          <p className="logic-status text-center font-mono text-xs uppercase tracking-widest text-muted-foreground" data-move-limit={pourLimit ?? undefined}>
            {pourLimit !== null
              ? <>pours <span className={replay.outOfPours ? "text-warn" : "text-primary"}>{limitText(replay.moves, pourLimit)}</span></>
              : <>moves <span className="text-primary">{replay.moves}</span></>}
          </p>
        )}
        <Tubes tubes={replay.tubes} lifted={lifted} shake={shake} onTube={tapTube} poured={poured} />
        <LiveSummary
          inArena
          className="logic-status"
          items={[
            // depthRev 1: the par line (sorting in the fewest pours earns the par bonus); the limit stays beside it.
            puzzle.type === "tubes" && usesDepth(puzzle) && (puzzle.par ?? 0) > 0 ? (
              <ParMeter key="pours" label="Pours" moves={replay.moves} par={puzzle.par!} limit={pourLimit} out={replay.outOfPours} />
            ) : pourLimit !== null ? (
              <SummaryItem key="pours" label="Pours" value={<span data-move-limit={pourLimit}>{limitText(replay.moves, pourLimit)}</span>} warn={replay.outOfPours} />
            ) : (
              <SummaryItem key="moves" label="Moves" value={replay.moves} />
            ),
          ]}
        />
      </div>

      {/* Taller than before and raised off the bottom edge (14 Oct 2026), so neither is cut off. */}
      <div data-game-controls="actions" className="tubes-actions flex shrink-0 justify-center gap-3 px-2">
        <button
          type="button"
          disabled={locked || replay.depth === 0}
          onClick={undo}
          className="h-[52px] min-w-[84px] rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || replay.depth === 0}
          onClick={reset}
          className="h-[52px] min-w-[84px] rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "tubes") return null;
  const pourLimit = tubesPourLimit(puzzle);
  const mine = tubesSendsUndo(puzzle)
    ? replayTubeLog(puzzle.tubes, decodeTubeLog(myAnswer ?? ""), pourLimit)
    : replayTubes(puzzle.tubes, decodeTubeMoves(myAnswer ?? ""));
  const limit = timeLimitMs;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((limit - myMsRemaining) / 100) / 10;

  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-potions-reveal">
          <Tubes tubes={mine.tubes} compact layerHeight="clamp(10px, calc((100cqh - 56px) / 12), 18px)" />
        </div>
      </div>
      <p className="shrink-0 text-center font-display text-2xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {mine.moves} {myCorrect ? "✓" : "✗"}
        </span>
        <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">
          {pourLimit !== null ? `of ${pourLimit} pours` : "moves"}{puzzle.minMoves ? ` · ${usesDepth(puzzle) ? "par" : "min"} ${puzzle.minMoves}` : ""}
          {myCorrect && elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
        </span>
      </p>
      <p className="logic-reveal-text text-center text-muted-foreground">
        {myCorrect
          ? "Keep one flask empty for as long as you can."
          : `${mine.sorted} of ${TUBES_COLOURS} flasks corked${"outOfPours" in mine && mine.outOfPours ? " · out of pours" : ""}.`}
      </p>
    </div>
  );
}

/** The board, its searched minimum and one shortest solution come from the server. */
export const sortTubesPuzzle: PuzzleDefinition = {
  key: "tubes",
  name: gameDisplayName("tubes"),
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
  revealHeading: "Your flasks",
  IntroExample,
  Stage,
  Reveal,
};
