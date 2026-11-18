import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
  pour,
  replayTubeLog,
  replayTubes,
  topGroup,
  tubeSorted,
  tubeSortedCap,
  tubesCapacity,
  tubesColourCount,
  type TubeMove,
  type TubeState,
  type TubeToken,
} from "@/lib/duel/tubes";
import { limitText, tubesPourLimit, tubesRefundsUndo, tubesSendsUndo } from "@/lib/duel/moveLimits";
import { TUBES_COLOURS, TUBES_COUNT, TUBES_TIME_MS, type TubesPuzzleData } from "@/lib/duel/types";
import { playCorrect, playWrong } from "@/lib/sound";

import { soundCue, useSolveFx } from "./logicFx";
import { animatePour, animateRefusedPour, POUR_MS } from "./logicMotion";
import { gameFx } from "@/lib/fx/kit";
import { MovePicture, MoveStrip, RevealFacts } from "./logicReveal";
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
  // The levels' Expert board (ten colours, 15 Nov 2026).
  "TEAL",
  "PEARL",
] as const;
const EXTRA_COLOURS: Record<string, string> = { TEAL: "#19B5AD", PEARL: "#E6DFD2" };

function ballColour(index: number): string {
  const name = BALL_COLOURS[index % BALL_COLOURS.length]!;
  return EXTRA_COLOURS[name] ?? GLYPH_COLOURS[name as keyof typeof GLYPH_COLOURS];
}

/** A flask's contents in words, bottom to top (7 Nov 2026, accessibility audit #16: the label was "Flask N" alone). */
function flaskLabel(index: number, tube: readonly number[], sorted: boolean): string {
  const layers = tube.map((colour) => BALL_COLOURS[colour % BALL_COLOURS.length]!.toLowerCase());
  const contents = layers.length ? `${layers.join(", ")} on top` : "empty";
  return `Flask ${index + 1}: ${contents}${sorted ? ", corked" : ""}`;
}

/** A faint symbol per liquid colour, as a second cue beside the colour itself. */
const POTION_SYMBOLS = ["●", "▲", "■", "◆", "★", "✚", "♥", "✦", "✿", "☾"] as const;

/** Ten glass flasks in two rows of five; each ball is one countable liquid layer. */
export function Tubes({
  tubes,
  lifted,
  shake,
  onTube,
  compact,
  layerHeight,
  poured,
  justCorked,
  hiddenLayers,
}: {
  /** Flasks corked by the pour just made (they ring once). */
  justCorked?: readonly number[] | undefined;
  tubes: TubeState;
  lifted?: number | null;
  shake?: number | null;
  onTube?: ((tube: number) => void) | undefined;
  compact?: boolean;
  /** Reveal: CSS length for one compact layer (sized from its box). */
  layerHeight?: string;
  /** The flask that was just poured into, and how many layers arrived. */
  poured?: { tube: number; count: number; key: number } | null;
  /** Expert (`hidden`): layers not yet uncovered, as "flask:layer" (shown dark with a ?). */
  hiddenLayers?: ReadonlySet<string> | undefined;
}) {
  const ballSize = compact ? 9 : 11;
  // A level's board (the Logic overhaul's levels): 6, 10 or 12 flasks of 4–7 layers; today's 10 of 5 in two rows of five.
  const capacity = tubesCapacity(tubes);
  const across = tubes.length <= 6 ? 3 : tubes.length <= 10 ? 5 : 6;
  const rows = Math.ceil(tubes.length / across);
  let corkOrder = 0;
  return (
    <div
      data-flasks={tubes.length}
      data-capacity={capacity}
      className={`logic-potions grid w-full justify-center ${compact ? "gap-2 h-full place-items-end" : "gap-3 px-2 tubes-play-board shrink-0 place-items-center"}`}
      style={{ gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, "--tube-cap": capacity, "--tube-rows": rows, "--tube-across": across } as CSSProperties}
    >
      {tubes.map((tube, index) => {
        const isLifted = lifted === index;
        const group = topGroup(tube);
        const liftCount = isLifted && group ? group.count : 0;
        const sorted = tubeSortedCap(tube, capacity);
        const order = sorted ? corkOrder++ : 0;
        return (
          <Button
            key={index}
            type="button"
            disabled={!onTube}
            variant="ghost"
            onClick={() => onTube?.(index)}
            aria-label={flaskLabel(index, tube, sorted)}
            className={`flex h-full w-full min-w-0 items-end justify-center rounded-none border-0 p-0 hover:bg-transparent disabled:opacity-100 ${compact ? "" : "min-h-11 min-w-11"}`}
          >
            <span data-flask={index} data-just-corked={justCorked?.includes(index) ? "" : undefined} className={`flask logic-flask relative flex h-full w-full shrink-0 flex-col items-center justify-end rounded-b-[14px] rounded-t-md border-2 p-[3px] ${shake === index ? "animate-shake" : ""} ${
              isLifted ? "border-primary" : sorted ? "border-primary/60" : ""
            }`}
              style={{ ...(compact ? { maxWidth: layerHeight ? 36 : 26 } : {}), "--logic-i": order, "--logic-wobble": `${(index * 0.53) % 2.4}s` } as CSSProperties}
            >
              <span aria-hidden="true" className="logic-flask-rim" />
              {sorted && (
                <span aria-hidden="true" className="pointer-events-none absolute -top-[7px] left-1/2 z-10 -translate-x-1/2">
                  <span className="potion-cork logic-cork block h-[9px] w-[60%] min-w-[10px] rounded-[3px]" style={{ background: "linear-gradient(180deg, var(--cork), var(--cork-dark))", width: compact ? 12 : 20 }} />
                  {!compact && <span aria-hidden="true" className="potion-sparkle absolute -right-3 -top-2 text-xs text-primary">✦</span>}
                </span>
              )}
            <span className="logic-liquid flex w-full flex-col-reverse items-stretch justify-start overflow-hidden rounded-b-[10px]">
              {tube.map((colour, ball) => {
                const rising = isLifted && ball >= tube.length - liftCount;
                const topLayer = ball === tube.length - 1;
                const arriving = poured?.tube === index && ball >= tube.length - poured.count;
                const veiled = hiddenLayers?.has(`${index}:${ball}`) ?? false;
                return (
                  <span
                    key={arriving ? `${ball}-${poured?.key}` : ball}
                    className={`potion-layer logic-potion flex w-full shrink-0 items-center justify-center ${compact ? "" : "tubes-play-layer"} ${arriving ? "logic-potion-fill" : ""}`}
                    // Presentation only: a same-colour layer above joins this one with a faint line, so one colour reads as one body of liquid.
                    data-same-above={tube[ball + 1] === colour ? "" : undefined}
                    // The rendered liquid (public/logic-art/potion-<colour>[-bottom].webp; display only).
                    data-potion={veiled ? "hidden" : BALL_COLOURS[colour % BALL_COLOURS.length]!.toLowerCase()}
                    data-hidden-layer={veiled ? "" : undefined}
                    data-bottom={ball === 0 ? "" : undefined}
                    style={{
                      ...(compact ? { height: layerHeight ?? ballSize + 3 } : {}),
                      backgroundColor: veiled ? "var(--potion-hidden, #b0b2b7)" : ballColour(colour),
                      transform: rising ? "translateY(-4px)" : "none",
                      transition: "transform 150ms ease",
                      boxShadow: rising ? "0 0 0 2px var(--primary)" : undefined,
                      ...(arriving ? { animationDelay: `calc(var(--pour-delay, 0ms) + ${(ball - (tube.length - (poured?.count ?? 0))) * 90}ms)` } : {}),
                    }}
                  >
                    {!compact && <span aria-hidden="true" className="logic-potion-glyph">{veiled ? "?" : POTION_SYMBOLS[colour % POTION_SYMBOLS.length]}</span>}
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
        Flask 3’s top layer is lifted – pour it into the empty flask or onto a matching colour. Each flask holds five layers; a full one-colour flask gets a cork. Undo gives its pour back. You have 90 seconds.
      </p>
    </div>
  );
}

/** Two flasks corked within this long are a combo (the kit's "combo"). */
const CORK_COMBO_MS = 4_000;

/** How long the "Out of pours" moment shows before the unfinished board goes in. */
export const OUT_OF_POURS_MS = 1_100;

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
  // tubesRev 3 (Logic overhaul 1): Undo gives its pour back, Reset gives them all back.
  const refund = isTubes && tubesRefundsUndo(puzzle);
  const [outShown, setOutShown] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const lastCork = useRef(0);
  const [justCorked, setJustCorked] = useState<number[]>([]);
  const [pourDelay, setPourDelay] = useState(0);
  const [moves, setMoves] = useStageState<TubeToken[]>(stateKey, "tubeMoves", () => []);
  const [lifted, setLifted] = useStageState<number | null>(stateKey, "tubeLifted", () => null);
  const [shake, setShake] = useStageState<number | null>(stateKey, "tubeShake", () => null);
  const [poured, setPoured] = useState<{ tube: number; count: number; key: number } | null>(null);
  const submitted = useRef(false);

  const play = (log: TubeToken[]) =>
    logged ? replayTubeLog(start, log, pourLimit, undefined, refund) : { ...replayTubes(start, log as TubeMove[]), outOfPours: false, depth: log.length };
  const encode = (log: TubeToken[]) => (logged ? encodeTubeLog(log) : encodeTubeMoves(log as TubeMove[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const replay = useMemo(() => play(moves), [start, moves, logged, pourLimit]);
  const solving = useSolveFx("tubes", isTubes && replay.solved);
  // The solve: each cork glints as it pops in turn (logic.css logic-cork-pop, 80 ms apart), a very soft ting each.
  const glintCount = replay.sorted;
  useEffect(() => {
    if (!solving) return;
    const timers = Array.from({ length: glintCount }, (_, i) => window.setTimeout(() => soundCue("tubes.glint"), i * 80 + 150));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solving]);
  const inFrame = useFrameProgress(replay.sorted, isTubes ? tubesColourCount(start) : TUBES_COLOURS, "corked");
  // Expert (`hidden`, the levels): a starting layer stays hidden until it has been the top of its flask (or moved).
  // Display only: the lowest each flask has been emptied to over the boards played (undone boards included: seen is
  // seen), and every layer at or above that height has shown.
  const hiddenLayers = useMemo(() => {
    if (!isTubes || !puzzle.hidden) return undefined;
    const low = start.map((tube) => tube.length);
    const boards: TubeState[] = [start];
    let state: TubeState = start.map((t) => [...t]);
    const history: TubeState[] = [state];
    for (const token of moves) {
      if (token === "undo") { if (history.length > 1) history.pop(); state = history[history.length - 1]!; boards.push(state); continue; }
      if (token === "reset") { history.length = 1; state = history[0]!; boards.push(state); continue; }
      if (!canPour(state, token.from, token.to)) continue;
      state = pour(state, token.from, token.to);
      history.push(state);
      boards.push(state);
    }
    // A flask's starting layers still in place at its bottom (`keep`) only fall when a pour takes them off the top,
    // so the layer at keep − 1 was the top at that moment: every layer from the lowest keep − 1 up has shown.
    for (const b of boards) b.forEach((tube, i) => {
      let keep = 0;
      while (keep < tube.length && keep < start[i]!.length && tube[keep] === start[i]![keep]) keep++;
      low[i] = Math.min(low[i]!, keep);
    });
    const out = new Set<string>();
    start.forEach((tube, i) => {
      for (let ball = 0; ball < Math.min(low[i]!, tube.length) - 1; ball++) out.add(`${i}:${ball}`);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTubes, start, moves, replay]);
  // A layer uncovered (Expert): a soft glassy shimmer as the veil lifts.
  const veiledCount = hiddenLayers?.size ?? 0;
  const lastVeiled = useRef(veiledCount);
  useEffect(() => {
    if (veiledCount < lastVeiled.current) soundCue("tubes.uncover");
    lastVeiled.current = veiledCount;
  }, [veiledCount]);

  useEffect(() => {
    onDraftAnswer?.(encode(moves));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, onDraftAnswer, logged]);

  useEffect(() => {
    if (locked || submitted.current || !(replay.solved || replay.outOfPours)) return;
    submitted.current = true;
    if (replay.solved) {
      playCorrect();
      onSubmit(encode(moves));
      return;
    }
    // Out of pours: a clear moment (a banner and its own sound), then the board goes in unfinished. The draft is
    // already sent, so a buzzer during the moment loses nothing.
    setOutShown(true);
    soundCue("tubes.outOfPours");
    const answer = encode(moves);
    window.setTimeout(() => onSubmit(answer), OUT_OF_POURS_MS);
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
      // An invalid destination: the lifted flask tips toward it, nothing pours, it rights itself; the lift is kept.
      animateRefusedPour(boardRef.current, lifted, tube);
      playWrong();
      soundCue("tubes.wrong");
      return;
    }
    const after = play([...moves, { from: lifted, to: tube }]).tubes[tube] ?? [];
    const count = after.length - (replay.tubes[tube] ?? []).length;
    const colour = ballColour(after[after.length - 1] ?? 0);
    // The pour (logicMotion.ts): lift, fly over, tilt, the stream, the target rising, back. The glug's pitch rises with
    // the level the liquid reaches.
    const total = animatePour(boardRef.current, lifted, tube, colour, count);
    soundCue("tubes.pour", 0.85 + after.length * 0.07);
    if (tubeSortedCap(after, tubesCapacity(start))) {
      // The cork pops in as the pour settles; two within a few seconds are a combo.
      const now = Date.now();
      const combo = now - lastCork.current < CORK_COMBO_MS;
      lastCork.current = now;
      window.setTimeout(() => {
        // A second flask corked within CORK_COMBO_MS plays the combo in the cork's place (one sound a moment).
        soundCue(combo ? "tubes.combo" : "tubes.cork");
        setJustCorked([tube]);
        const flask = boardRef.current?.querySelector(`[data-flask="${tube}"]`);
        if (combo) gameFx("combo", flask, { count: 2, silent: true });
        window.setTimeout(() => setJustCorked([]), 700);
      }, Math.max(0, total - POUR_MS.back - POUR_MS.settle));
    }
    // The target's layers rise while the stream falls (the fill's delay, logic-potion-fill).
    setPourDelay(total ? POUR_MS.lift + POUR_MS.tilt : 0);
    setPoured({ tube, count, key: moves.length + 1 });
    setMoves((current) => [...current, { from: lifted, to: tube }]);
    setLifted(null);
  };

  const undo = () => {
    setLifted(null);
    setPoured(null);
    // Undo is logged, not removed; from tubesRev 3 the server gives its pour back (replayTubeLog's refund).
    soundCue("tubes.undo");
    setMoves((current) => (logged ? [...current, "undo"] : current.slice(0, -1)));
  };

  const reset = () => {
    setLifted(null);
    setPoured(null);
    if (moves.length) soundCue("tubes.reset");
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
        <div ref={boardRef} className="relative" style={{ "--pour-delay": `${pourDelay}ms` } as CSSProperties}>
          <Tubes tubes={replay.tubes} lifted={lifted} shake={shake} onTube={tapTube} poured={poured} justCorked={justCorked} hiddenLayers={hiddenLayers} />
          {outShown ? (
            <div role="status" data-out-of-pours="" className="logic-out-banner">
              Out of pours
            </div>
          ) : null}
        </div>
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

/**
 * The reveal (Logic overhaul 1, 15 Nov 2026): your flasks large, the numbers behind the score (pours used, par, flasks
 * sorted), and the shortest route as small pictures of each pour (the colour poured, flask to flask).
 */
function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "tubes") return null;
  const pourLimit = tubesPourLimit(puzzle);
  const mine = tubesSendsUndo(puzzle)
    ? replayTubeLog(puzzle.tubes, decodeTubeLog(myAnswer ?? "", puzzle.tubes.length), pourLimit, undefined, tubesRefundsUndo(puzzle))
    : replayTubes(puzzle.tubes, decodeTubeMoves(myAnswer ?? "", puzzle.tubes.length));
  const par = puzzle.par ?? puzzle.minMoves ?? 0;
  const route: ReactNode[] = [];
  let state = puzzle.tubes.map((tube) => [...tube]);
  for (const move of decodeTubeMoves(puzzle.solution ?? "", puzzle.tubes.length)) {
    if (!canPour(state, move.from, move.to)) break;
    const top = state[move.from]![state[move.from]!.length - 1]!;
    route.push(<MovePicture colour={ballColour(top)} from={move.from + 1} to={move.to + 1} />);
    state = pour(state, move.from, move.to);
  }

  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board">
        <div className="logic-potions-reveal">
          <Tubes tubes={mine.tubes} compact layerHeight="clamp(10px, calc((100cqh - 56px) / 12), 18px)" />
        </div>
      </div>
      <RevealFacts
        items={[
          { label: pourLimit !== null ? `Pours used of ${pourLimit}` : "Pours", value: mine.moves, tone: mine.solved && par && mine.moves <= par ? "gold" : undefined },
          par > 0 && { label: "Par", value: par },
          { label: `Sorted of ${tubesColourCount(puzzle.tubes)}`, value: mine.sorted, tone: mine.solved ? "good" : undefined },
        ]}
      />
      <MoveStrip testId="tubes" title="Shortest route" moves={route} />
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
