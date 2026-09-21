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
  matchupCheckpoint,
  matchupDrawAnimated,
  matchupDrawSelection,
  matchupGame,
  MATCHUP_BG,
  MATCHUP_CHECKPOINT_INTERVAL,
  MATCHUP_COLOURS,
  MATCHUP_RUN_TICKS,
  type MatchupState,
} from "@/lib/arcade/matchup";
import { decodeMatchupRun, encodeMatchupRun, replayMatchupRun } from "@/lib/duel/matchup";
import { ARCADE_CRASH_FREEZE_MS, type MatchupPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

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

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<MatchupState>(matchupGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof matchupCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const selected = useRef<{ row: number; col: number } | null>(null);
  const animStart = useRef(0);
  const animUntil = useRef(0);
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
    submitted.current = false;
    endedAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    let secondAt = last;
    let ticksThisSecond = 0;

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
          state.current = matchupGame.step(state.current, applied);
          if (applied && state.current.swaps > before.swaps) {
            events.current.push(applied);
            const duration = matchupAnimationDuration(state.current.lastAnimation);
            animStart.current = time;
            animUntil.current = time + duration;
          }
          if (state.current.tick % MATCHUP_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(matchupCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (matchupGame.isOver(state.current)) break;
        }
      }

      const size = sizeCanvas();
      if (size) {
        const node = canvas.current;
        const ctx = node?.getContext("2d");
        if (ctx) {
          if (time < animUntil.current) {
            matchupDrawAnimated(ctx, state.current, size, time - animStart.current);
          } else {
            matchupGame.draw(ctx, state.current, size);
          }
        }
        const pick = selected.current;
        if (pick && !matchupGame.isOver(state.current) && time >= animUntil.current) {
          matchupDrawSelection(ctx, size, pick.row, pick.col);
        }
      }

      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[matchup] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${MATCHUP_RUN_TICKS}`,
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
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (node.width !== width * ratio || node.height !== height * ratio) {
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
    );
  };

  /** Ignored while the animation plays, so nothing is recorded out of step. */
  const busy = () =>
    locked ||
    submitted.current ||
    matchupGame.isOver(state.current) ||
    performance.now() < animUntil.current;

  const trySwap = (a: { row: number; col: number }, b: { row: number; col: number }) => {
    if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) !== 1) return false;
    pending.current.push({ t: 0, k: 3, a: a.row, b: a.col, c: b.row, d: b.col });
    return true;
  };

  if (!data) return null;

  return (
    <div ref={wrap} className="min-h-0 w-full flex-1 overflow-hidden rounded-xl">
      <canvas
        ref={canvas}
        className="block h-full w-full rounded-xl"
        style={{ touchAction: "none", background: MATCHUP_BG }}
        aria-label="Matchup"
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
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "matchup") return null;
  const result = replayMatchupRun(puzzle.seed, myAnswer ?? "");
  const sent = decodeMatchupRun(myAnswer ?? "").events.length;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <svg viewBox="0 0 150 30" className="h-auto w-full max-w-[180px] shrink-0" aria-hidden="true">
        {MATCHUP_COLOURS.map((colour, index) => (
          <circle key={colour} cx={15 + index * 24} cy={15} r={9} fill={colour} />
        ))}
      </svg>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold text-foreground">
        {result.raw.toLocaleString("en-GB")} pts → {result.score}
      </p>
      <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
        {result.swaps} swap{result.swaps === 1 ? "" : "s"} · best line {result.bestLine || "—"}
        {result.reshuffles > 0 ? ` · ${result.reshuffles} reshuffled` : ""}
      </p>
      {sent > result.swaps && (
        <p className="shrink-0 text-center font-mono text-xs text-muted-foreground">
          {sent} swaps tried
        </p>
      )}
      {result.desyncTick !== null && (
        <p className="shrink-0 font-mono text-xs font-bold text-destructive">
          desync at tick {result.desyncTick}
        </p>
      )}
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const matchupPuzzle: PuzzleDefinition = {
  key: "matchup",
  name: "Matchup",
  category: "arcade",
  timeLimitMs: (MATCHUP_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "matchup", seed: 1 }) satisfies MatchupPuzzleData,
  check: () => false,
  revealHeading: "Your board",
  IntroExample,
  Stage,
  Reveal,
};
