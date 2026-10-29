import { matchupFill } from "@/lib/arcade/arenaFills.renderer";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordInput, inputAt } from "@/lib/arcade/engine";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type ArcadeInputEvent,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  matchupCellAt,
  matchupAnimationDuration,
  matchupBusy,
  matchupConstantPlay,
  MATCHUP_REV_WAIT,
  matchupCheckpoint,
  matchupGameFor,
  matchupShowHint,
  MATCHUP_BG,
  MATCHUP_CHECKPOINT_INTERVAL,
  MATCHUP_COLOURS,
  MATCHUP_V10_RUN_TICKS,
  MATCHUP_SIZE,
  type MatchupState,
  MATCHUP_WORLD_H,
  MATCHUP_WORLD_W,
  MATCHUP_BOARD_X,
  MATCHUP_BOARD_Y,
  MATCHUP_CELL_PX,
  matchupRowsFor,
  matchupWorldHFor,
  matchupGoalsMet,
  matchupStdParts,
} from "@/lib/arcade/matchup";
import { KeyCursor, useGridCursor } from "@/components/puzzles/KeyCursor";
import { directionOf, useGameKeys } from "@/lib/desktop";
import { decodeMatchupRun, encodeMatchupRun, replayMatchupRun } from "@/lib/duel/matchup";
import {
  drawMatchupArt, drawMatchupArtAnimated, drawMatchupArtSelection, drawMatchupSwap,
  matchupStepOffsets, matchupStepSound, MATCHUP_SWAP_MS, type MatchupSwapTween,
} from "@/lib/arcade/matchup.renderer";
import { playSound } from "@/lib/sound";
import type { SoundId } from "@/lib/fx/manifest";

/** Cascade pitch ladder: chain depth 1-4 (capped) rises through these rates. */
const MATCHUP_PITCH_RATES = [1, 1.12, 1.26, 1.41] as const;
import { ARCADE_CRASH_FREEZE_MS, type MatchupPuzzleData } from "@/lib/duel/types";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { liveCue } from "@/lib/fx/momentCues";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";

/** Fixed intro still: a 4×4 board with one swap making a line of three. */
function IntroExample() {
  const board = [
    [0, 1, 2, 3],
    [1, 2, 0, 1],
    [2, 0, 1, 2],
    [1, 1, 2, 1],
  ];
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 120 120"
        width={120}
        height={120}
        aria-hidden="true"
        style={{ background: MATCHUP_BG, borderRadius: 10 }}
      >
        {board.flatMap((row, r) =>
          row.map((kind, c) => (
            <circle
              key={`${r}-${c}`}
              cx={15 + c * 30}
              cy={15 + r * 30}
              r={10}
              fill={MATCHUP_COLOURS[kind]}
            />
          )),
        )}
        <g stroke="#F5B82E" strokeWidth="2" fill="none">
          <rect x="65" y="95" width="20" height="20" rx="4" />
          <rect x="95" y="95" width="20" height="20" rx="4" />
        </g>
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Swap those two and the bottom row makes a line of three.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: MatchupPuzzleData | null = puzzle.type === "matchup" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const matchupGame = matchupGameFor(data?.matchupRev);
  // matchupRev 9: the taller board (ten rows in a 390 × 720 world); every phone draws the stored revision's.
  const MATCHUP_ROWS = matchupRowsFor(data?.matchupRev);
  const MATCHUP_WORLD_H = matchupWorldHFor(data?.matchupRev);
  /** matchupRev 2–4: keep swapping while gems clear and fall; each resolution step animates on its own. */
  const constantPlay = matchupConstantPlay(matchupGame.init(seed));
  /** matchupRev 5: the sim itself refuses swaps until the gems have fallen in. */
  const waitPlay = matchupGame.init(seed).rev === MATCHUP_REV_WAIT;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<MatchupState>(matchupGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof matchupCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const selected = useRef<{ row: number; col: number } | null>(null);
  const animStart = useRef(0);
  const animUntil = useRef(0);
  const swapTween = useRef<MatchupSwapTween | null>(null);
  /** Pending gem chimes for the current swap: wall-clock times, cascade step = index. */
  const chimes = useRef<{ at: number[]; sounds: SoundId[]; next: number; depth?: number }>({
    at: [], sounds: [], next: 0,
  });
  const submitted = useRef(false);
  const endedAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);

  // Callbacks and the lock live in refs so the loop is never torn down and
  // restarted mid-run, which would lose the accumulator and drop sim ticks.
  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("matchup", state.current, matchupGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeMatchupRun({
      seed,
      claimedScore: matchupGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = matchupGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    selected.current = null;
    animStart.current = 0;
    animUntil.current = 0;
    swapTween.current = null;
    chimes.current = { at: [], sounds: [], next: 0 };
    submitted.current = false;
    endedAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    // The match chime climbs with the cascade on its own: no generic combo sound (sound batch 4).
    const feedback = arcadeFeedback({ game: "matchup", combo: false });
    let secondAt = last;
    let ticksThisSecond = 0;
    let hintShown = false;
    // matchupRev 9: the features sound from the shared set (a goal's chime, ice cracking, a treasure's ding, a deep cascade's zap).
    let goalsSeen = { levels: state.current.levels ?? 0, ice: state.current.iceBroken ?? 0, treasures: state.current.treasures ?? 0, swaps: state.current.swaps };

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      submitRef.current(encode());
    };

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;

      if (!matchupGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        // Capped per frame; the time above the cap stays in the accumulator.
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          const before = state.current;
          recordInput(events.current, applied, matchupGame.inputRanges);
          state.current = matchupGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (constantPlay && (state.current.resolveSerial ?? 0) > (before.resolveSerial ?? 0)) {
            // One resolution step: the swap's own clear, or a cascade step on its own tick.
            const swapped = Boolean(applied && state.current.swaps > before.swaps);
            const lead = swapped ? MATCHUP_SWAP_MS : 0;
            animStart.current = time + lead;
            animUntil.current = time + lead + matchupAnimationDuration(state.current.lastAnimation, state.current);
            if (!swapped) swapTween.current = null;
            const animSteps = state.current.lastAnimation;
            const depth = Math.max(1, state.current.lastSteps);
            chimes.current = {
              at: animSteps.map(() => time + lead),
              sounds: animSteps.map(matchupStepSound),
              next: 0,
              depth,
            };
          } else if (applied && state.current.swaps > before.swaps) {
            const duration = matchupAnimationDuration(state.current.lastAnimation);
            animStart.current = time;
            animUntil.current = time + duration;
            // A new swap resets the cascade pitch.
            const animSteps = state.current.lastAnimation;
            chimes.current = {
              at: matchupStepOffsets(animSteps).map((ms) => time + MATCHUP_SWAP_MS + ms),
              sounds: animSteps.map(matchupStepSound),
              next: 0,
            };
          }
          // The swap slides, or slides out and back when it makes no match.
          if (applied && state.current.swaps > before.swaps) liveCue("matchup.swap");
          else if (applied && state.current.lastInvalidTick === state.current.tick) liveCue("matchup.invalid");
          if (applied && (state.current.swaps > before.swaps ||
            state.current.lastInvalidTick === state.current.tick)) {
            swapTween.current = {
              before, a: applied.a * MATCHUP_SIZE + applied.b, b: applied.c * MATCHUP_SIZE + applied.d,
              rejected: state.current.swaps === before.swaps, startedAt: time,
            };
          }
          if (state.current.tick % MATCHUP_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(matchupCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (matchupGame.isOver(state.current)) break;
        }
      }

      if (state.current.goals) {
        const now = state.current;
        if ((now.levels ?? 0) > goalsSeen.levels) playSound("shared.celebrate.chime", 0.7);
        if ((now.treasures ?? 0) > goalsSeen.treasures) playSound("shared.celebrate.countDing", 0.8);
        if ((now.iceBroken ?? 0) > goalsSeen.ice) playSound("shared.celebrate.crackle2", 0.55);
        if (now.swaps > goalsSeen.swaps && (now.lastMult ?? 0) >= 3) playSound("shared.celebrate.zap", 0.45);
        goalsSeen = { levels: now.levels ?? 0, ice: now.iceBroken ?? 0, treasures: now.treasures ?? 0, swaps: now.swaps };
      }
      reportArcadeTick(state.current.tick, matchupGame.isOver(state.current));
      feedback(state.current, matchupGame.isOver(state.current));
      // The hint highlight appears after a spell without a move.
      const hint = !matchupGame.isOver(state.current) && matchupShowHint(state.current);
      if (hint && !hintShown) liveCue("matchup.hint");
      hintShown = hint;
      const chime = chimes.current;
      while (chime.next < chime.at.length && time >= chime.at[chime.next]!) {
        // Cascade pitch ladder: chain depth 1-4 rises 1.0 / 1.12 / 1.26 / 1.41.
        const depth = Math.min(chime.depth ?? chime.next + 1, MATCHUP_PITCH_RATES.length);
        playSound("arc_gem_match", 0.8, MATCHUP_PITCH_RATES[depth - 1] ?? 1, true);
        const special = chime.sounds[chime.next];
        // A special layers over the match chime rather than cutting it.
        if (special && special !== "arc_gem_match") playSound(special, 0.8, 1, true);
        chime.next += 1;
      }

      const size = sizeCanvas();
      if (size) {
        const node = canvas.current;
        const ctx = node?.getContext("2d");
        if (ctx) {
          const tween = swapTween.current;
          const elapsed = tween ? time - tween.startedAt : 0;
          const swapDuration = MATCHUP_SWAP_MS * (tween?.rejected ? 2 : 1);
          if (tween && elapsed < swapDuration) {
            drawMatchupSwap(ctx, state.current, size, tween, elapsed);
          } else if (constantPlay && time < animUntil.current) {
            drawMatchupArtAnimated(ctx, state.current, size, time - animStart.current);
          } else if (constantPlay) {
            drawMatchupArt(ctx, state.current, size);
          } else if (tween && !tween.rejected && time < animUntil.current + MATCHUP_SWAP_MS) {
            drawMatchupArtAnimated(ctx, state.current, size, elapsed - MATCHUP_SWAP_MS);
          } else if (!tween && time < animUntil.current) {
            drawMatchupArtAnimated(ctx, state.current, size, time - animStart.current);
          } else {
            drawMatchupArt(ctx, state.current, size);
          }
          const pick = selected.current;
          if (pick && !matchupGame.isOver(state.current) && (constantPlay || time >= animUntil.current) &&
            (!tween || elapsed >= swapDuration)) {
            drawMatchupArtSelection(ctx, size, pick.row, pick.col);
          }
        }
      }

      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[matchup] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${matchupGame.runTicks}`,
        );
        secondAt = time;
        ticksThisSecond = 0;
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (matchupGame.isOver(state.current) && !submitted.current) {
        if (endedAt.current === null) endedAt.current = time;
        else if (time - endedAt.current >= ARCADE_CRASH_FREEZE_MS) finish();
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed]);

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
    // Capped at 2: a 3× buffer on a tall phone starves the sim loop.
    const ratio = arcadeCanvasRatio();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) {
      node.width = Math.round(width * ratio);
      node.height = Math.round(height * ratio);
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }
    const ctx = node.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  };

  const cellFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return matchupCellAt(
      { width: box.width, height: box.height },
      event.clientX - box.left,
      event.clientY - box.top,
      MATCHUP_ROWS,
      MATCHUP_WORLD_H,
    );
  };

  /** Ignored while the animation plays (original rounds), so nothing is recorded out of step. */
  const busy = () =>
    locked ||
    submitted.current ||
    matchupGame.isOver(state.current) ||
    (waitPlay ? matchupBusy(state.current) || pending.current.length > 0 : !constantPlay && performance.now() < animUntil.current);

  const trySwap = (a: { row: number; col: number }, b: { row: number; col: number }) => {
    if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) !== 1) return false;
    pending.current.push({ t: 0, k: 3, a: a.row, b: a.col, c: b.row, d: b.col });
    return true;
  };

  // Desktop keys: the arrows (WASD) move a cursor over the gems; Space or Enter picks the gem under it (a tap),
  // and an arrow with a gem picked swaps it that way (a tap on the neighbour). Esc drops the pick.
  const cursor = useGridCursor(MATCHUP_ROWS, MATCHUP_SIZE, { row: Math.floor(MATCHUP_ROWS / 2), col: Math.floor(MATCHUP_SIZE / 2) });
  useGameKeys((kind, key, event) => {
    if (key === "Escape") {
      if (kind === "down") selected.current = null;
      return true;
    }
    if (key === " " || key === "Enter") {
      if (kind === "down" && !event.repeat && !busy()) {
        const at = cursor.show();
        const pick = selected.current;
        if (pick && pick.row === at.row && pick.col === at.col) selected.current = null;
        else if (pick && trySwap(pick, at)) selected.current = null;
        else {
          selected.current = at;
          liveCue("matchup.select");
        }
      }
      return true;
    }
    const dir = directionOf(key);
    if (!dir) return false;
    if (kind !== "down") return true;
    const pick = selected.current;
    if (pick && cursor.cell && pick.row === cursor.cell.row && pick.col === cursor.cell.col) {
      if (busy()) return true;
      const to = { row: pick.row + (dir === "up" ? -1 : dir === "down" ? 1 : 0), col: pick.col + (dir === "left" ? -1 : dir === "right" ? 1 : 0) };
      if (to.row >= 0 && to.row < MATCHUP_ROWS && to.col >= 0 && to.col < MATCHUP_SIZE && trySwap(pick, to)) selected.current = null;
      return true;
    }
    cursor.move(dir);
    return true;
  });

  if (!data) return null;

  return (
    <ArcadeArenaSlot width={MATCHUP_WORLD_W} height={MATCHUP_WORLD_H} scene={matchupFill} playCentre sceneUnderHeader>
      <div ref={wrap} data-game-arena="canvas" className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl">
        <canvas
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ background: MATCHUP_BG }}
          aria-label={gameDisplayName("matchup")}
          onPointerDown={(event) => {
            event.preventDefault();
            if (busy()) return;
            const cell = cellFrom(event);
            if (!cell) return;
            const pick = selected.current;
            if (pick && trySwap(pick, cell)) {
              selected.current = null;
              return;
            }
            if (!pick || pick.row !== cell.row || pick.col !== cell.col) liveCue("matchup.select");
            selected.current = cell;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const pick = selected.current;
            if (!pick || busy()) return;
            const cell = cellFrom(event);
            if (!cell) return;
            if (trySwap(pick, cell)) selected.current = null;
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            selected.current = null;
          }}
        />
        <KeyCursor
          rect={cursor.cell ? { x: MATCHUP_BOARD_X + cursor.cell.col * MATCHUP_CELL_PX, y: MATCHUP_BOARD_Y + cursor.cell.row * MATCHUP_CELL_PX, w: MATCHUP_CELL_PX, h: MATCHUP_CELL_PX } : null}
          worldW={MATCHUP_WORLD_W}
          worldH={MATCHUP_WORLD_H}
        />
      </div>
    </ArcadeArenaSlot>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "matchup") return null;
  const result = replayMatchupRun(puzzle.seed, myAnswer ?? "", puzzle.matchupRev);
  const sent = decodeMatchupRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <svg viewBox="0 0 150 30" className="h-auto w-full max-w-[180px] shrink-0" aria-hidden="true">
        {MATCHUP_COLOURS.map((colour, index) => (
          <circle key={colour} cx={15 + index * 24} cy={15} r={9} fill={colour} />
        ))}
      </svg>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.raw.toLocaleString("en-GB")} match points
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.swaps} swap{result.swaps === 1 ? "" : "s"} · best line {result.bestLine || "-"}
        {result.reshuffles > 0 ? ` · ${result.reshuffles} reshuffled` : ""}
      </p>
      {result.state.std ? (
        // matchupRev 11: the parts, each with its points (they add up to the score).
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {(result.state.gemsCleared ?? 0).toLocaleString("en-GB")} gems +{matchupStdParts(result.state).core} · {result.state.treasures ?? 0} treasure +{matchupStdParts(result.state).treasure} · {matchupGoalsMet(result.state)} goals +{matchupStdParts(result.state).goals} · {result.state.iceBroken ?? 0} ice +{matchupStdParts(result.state).ice} · {result.state.bigLines ?? 0} big lines +{matchupStdParts(result.state).big}
        </p>
      ) : result.state.goals ? (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.state.levels ?? 0} goal{result.state.levels === 1 ? "" : "s"} · {result.state.iceBroken ?? 0} ice · {result.state.treasures ?? 0} treasure · cascades +{result.state.cascadeExtra ?? 0}
        </p>
      ) : null}
      {result.jackpots > 0 && (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.jackpots} jackpot gem{result.jackpots === 1 ? "" : "s"}
        </p>
      )}
      {sent > result.swaps && (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {sent} swaps tried
        </p>
      )}
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const matchupPuzzle: PuzzleDefinition = {
  key: "matchup",
  name: gameDisplayName("matchup"),
  category: "arcade",
  // matchupRev 10's 90 s run (older rounds run 60 s and end there; their clock shows the extra 30 s unused, as Tempo's).
  timeLimitMs: (MATCHUP_V10_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "matchup", seed: 1 }) satisfies MatchupPuzzleData,
  check: () => false,
  revealHeading: "Your board",
  IntroExample,
  Stage,
  Reveal,
};
