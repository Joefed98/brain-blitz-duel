import { aimVector, directionOf, useGameKeys } from "@/lib/desktop";
import { auditEventAt } from "@/lib/arcade/auditInput";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { flightpathColour, flightpathInk } from "@/lib/arcade/flightpathPalette.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { arcadeFeedback } from "@/lib/fx/arcade";
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
  bullseyeCheckpoint,
  bullseyeDrag,

  bullseyeGame,
  bullseyeInitFor,
  bullseyeAimPointFor,
  bullseyeBoard,
  bullseyeIsBull,
  bullseyeTallRev,
  BULLSEYE_V8_LIFT,
  BULLSEYE_ARROWS,
  BULLSEYE_BG,
  BULLSEYE_CX,
  BULLSEYE_GOLD,
  BULLSEYE_CHECKPOINT_INTERVAL,
  BULLSEYE_OUTER_R,
  BULLSEYE_RING_VALUES,
  BULLSEYE_RING_STEP,
  BULLSEYE_RINGS,
  BULLSEYE_RUN_TICKS,
  type BullseyeState,
  BULLSEYE_WORLD_H,
  BULLSEYE_WORLD_W,
} from "@/lib/arcade/bullseye";
import { decodeBullseyeRun, encodeBullseyeRun, replayBullseyeRun } from "@/lib/duel/bullseye";
import { bullseyeArenaScene, bullseyeArenaSceneV8, bullseyeArtAim, drawBullseye, FP_VIEW_H } from "@/lib/arcade/bullseye.renderer";
import { fairTransform } from "@/lib/arcade/fairground.renderer";
import { bullseyeExtraSounds } from "@/lib/arcade/e5Sounds";
import { useFairSceneKey } from "@/components/puzzles/useFairSceneKey";
import { bullseyeSounds } from "@/lib/fx/gameSounds";
import { ARCADE_CRASH_FREEZE_MS, type BullseyePuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame } from "@/lib/battery";

/** Fixed intro still: the target, the wind flag, a balloon and a dart ready to throw. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 195 110"
        width={195}
        height={110}
        aria-hidden="true"
        style={{ background: BULLSEYE_BG, borderRadius: 10 }}
      >
        {[6, 5, 4, 3, 2, 1].map((ring) => (
          <circle
            key={ring}
            cx="98"
            cy="46"
            r={ring * 6}
            fill={flightpathColour(BULLSEYE_RING_VALUES[ring - 1] ?? 0)}
            opacity={1}
            stroke="#0B0B0FB0"
          />
        ))}
        {BULLSEYE_RING_VALUES.map((value, index) => (
          <text
            key={value}
            x="98"
            y={46 - (index * 6 + 3)}
            fill={flightpathInk(value)}
            fontSize="5"
            fontWeight="700"
            fontFamily="monospace"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {value}
          </text>
        ))}
        {/* The wind flag: flying left (the wind blows left), its strength on it. */}
        <line x1="52" y1="6" x2="52" y2="30" stroke="#EDE3CF" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="52" cy="5.5" r="1.8" fill={BULLSEYE_GOLD} />
        <path d="M52 7 Q44 5 38 8 T24 8 L26 22 Q32 19 38 22 T52 21 Z" fill={BULLSEYE_GOLD} stroke="#3C2404B0" strokeWidth="0.8" />
        <text x="38" y="15.5" fill="#0B0B0F" fontSize="10" fontWeight="800" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">
          2
        </text>
        {/* bullRev 8: the dead-centre ring inside the bull. */}
        <circle cx="98" cy="46" r="1.5" fill="none" stroke="#FFFFFF" strokeWidth="0.8" />
        <circle cx="150" cy="40" r="8" fill="#E8384F" />
        <circle cx="147" cy="37" r="2" fill="#FFFFFF" opacity="0.6" />
        {/* A black dart with a light edge, ready to throw. */}
        <path d="M98 70 L99.5 78 L100.5 78 L100.5 90 L99 90 L99 96 L103 103 L98 101 L93 103 L97 96 L97 90 L95.5 90 L95.5 78 L96.5 78 Z" fill="#0B0B0F" stroke="#FFF8EB" strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Drag to aim. Bulls in a row build a streak; the white dead-centre ring adds more.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BullseyePuzzleData | null = puzzle.type === "bullseye" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const fairSceneKey = useFairSceneKey();
  // bullRev 8 and 9: the taller range (lift px above the original top); every phone draws the stored revision's world.
  const lift = bullseyeTallRev(data?.bullRev) ? BULLSEYE_V8_LIFT : 0;
  const worldH = BULLSEYE_WORLD_H + lift;
  const boxH = lift ? FP_VIEW_H : worldH;

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<BullseyeState>(bullseyeInitFor(seed, data?.winds, data?.bullRev));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof bullseyeCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  /** Where the finger went down; the aim vector is measured from here. */
  const anchor = useRef<{ x: number; y: number } | null>(null);
  /** The launch a release right now would make. Render only. */
  const aim = useRef<{ vx: number; vy: number } | null>(null);
  const submitted = useRef(false);
  const endedAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);

  // Callbacks and the lock live in refs so the loop is never torn down and
  // restarted mid-run, which would lose the accumulator and drop sim ticks.
  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  // Desktop keys: the arrows (WASD) aim a virtual drag (its landing ring drawn as a drag's is), Space or Enter
  // shoots it through the same launch as a finger lifted.
  const keyAim = useRef(aimVector());
  useGameKeys((kind, key, event) => {
    const open = !lockedRef.current && !submitted.current && !bullseyeGame.isOver(state.current) && !anchor.current;
    if (key === " " || key === "Enter") {
      if (kind === "down" && !event.repeat && open) {
        const v = keyAim.current.show();
        aim.current = null;
        const launch = bullseyeDrag(v.dx, v.dy);
        if (launch) pending.current.push({ t: 0, k: 2, a: launch.vx, b: launch.vy, c: 0, d: 0 });
      }
      return true;
    }
    if (directionOf(key) === null) return false;
    if (kind === "down" && open) {
      keyAim.current.nudge(key, event.shiftKey);
      const v = keyAim.current.show();
      const preview = bullseyeDrag(v.dx, v.dy);
      aim.current = preview ? { vx: preview.vx, vy: preview.vy } : null;
    }
    return true;
  });
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("bullseye", state.current, bullseyeGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeBullseyeRun({
      seed,
      claimedScore: bullseyeGame.score(state.current),
      events: events.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = bullseyeInitFor(seed, data?.winds, data?.bullRev);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    anchor.current = null;
    aim.current = null;
    submitted.current = false;
    endedAt.current = null;
    forceRedraw((n) => n + 1);
  }, [data?.winds, data?.bullRev, seed]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({ game: "bullseye" });
    const sounds = bullseyeSounds();
    const extra = bullseyeExtraSounds();
    let secondAt = last;
    let ticksThisSecond = 0;

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      submitRef.current(encode());
    };

    const loop = (time: number) => {
      frame = arenaFrame(loop);
      const delta = time - last;
      last = time;

      if (!bullseyeGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        // Capped per frame; the time above the cap stays in the accumulator.
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // A release between ticks applies on the next tick, logged as that
          // sim tick — never a wall-clock reading.
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          const before = state.current;
          recordInput(events.current, applied, bullseyeGame.inputRanges);
          // The dev audit's bot log (auditInput.ts; never in a production build).
          { const audit = auditEventAt(state.current.tick + 1); if (audit) recordInput(events.current, audit, bullseyeGame.inputRanges); }
          state.current = bullseyeGame.step(
            state.current,
            inputAt(events.current, state.current.tick + 1),
          );
          if (state.current.tick % BULLSEYE_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(bullseyeCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (bullseyeGame.isOver(state.current)) break;
        }
      }

      reportArcadeTick(state.current.tick, bullseyeGame.isOver(state.current));
      feedback(state.current, bullseyeGame.isOver(state.current));
      sounds.frame(state.current, !bullseyeGame.isOver(state.current));
      extra(state.current);

      const size = sizeCanvas();
      if (size) {
        const context = canvas.current?.getContext("2d");
        if (context) drawBullseye(context, state.current, size);
        if (context && aim.current && state.current.flightTick === 0) {
          // The dotted path and landing ring include the sway at the tick a
          // release would land on, so the player can time it.
          bullseyeArtAim(
            context,
            size,
            bullseyeAimPointFor(
              state.current,
              state.current.tick + 1,
              aim.current.vx,
              aim.current.vy,
            ),
            lift,
            state.current,
          );
        }
      }

      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[bullseye] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${BULLSEYE_RUN_TICKS}`,
        );
        secondAt = time;
        ticksThisSecond = 0;
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (bullseyeGame.isOver(state.current) && !submitted.current) {
        if (endedAt.current === null) endedAt.current = time;
        else if (time - endedAt.current >= ARCADE_CRASH_FREEZE_MS) finish();
      }
    };

    frame = arenaFrame(loop);
    return () => { cancelArenaFrame(loop, frame); sounds.stop(); };
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

  /** Canvas coordinates to world pixels, using the sim's own mapping. */
  const worldPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    // The stage's box (bullRev 8+: the darts stall's 390 × FP_VIEW_H view): a drag is measured at the box's own
    // scale, as before the stall's zoom (display only), so a throw lands where it always did.
    const { scale, offsetX, offsetY } = fairTransform({ width: box.width, height: box.height }, BULLSEYE_WORLD_W, boxH);
    const divisor = Math.max(scale, 0.0001);
    return {
      x: (event.clientX - box.left - offsetX) / divisor,
      y: (event.clientY - box.top - offsetY) / divisor - lift,
    };
  };

  if (!data) return null;

  return (
    <ArcadeArenaSlot width={BULLSEYE_WORLD_W} height={boxH} scene={lift ? bullseyeArenaSceneV8 : bullseyeArenaScene} sceneKey={fairSceneKey}>
      <div ref={wrap} data-game-arena="canvas" className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl">
        <canvas
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ background: BULLSEYE_BG }}
          aria-label={gameDisplayName("bullseye")}
          onPointerDown={(event) => {
            event.preventDefault();
            if (locked || submitted.current || bullseyeGame.isOver(state.current)) return;
            // The anchor is wherever the finger went down; the aim is the drag from
            // it, so the predicted landing holds still when the finger does.
            anchor.current = worldPoint(event);
            aim.current = null;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = anchor.current;
            if (!start) return;
            const point = worldPoint(event);
            const preview = bullseyeDrag(point.x - start.x, point.y - start.y);
            aim.current = preview ? { vx: preview.vx, vy: preview.vy } : null;
          }}
          onPointerUp={(event) => {
            const start = anchor.current;
            anchor.current = null;
            aim.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            if (!start || locked || submitted.current) return;
            const point = worldPoint(event);
            const launch = bullseyeDrag(point.x - start.x, point.y - start.y);
            if (!launch) return;
            pending.current.push({ t: 0, k: 2, a: launch.vx, b: launch.vy, c: 0, d: 0 });
          }}
          onPointerCancel={(event) => {
            anchor.current = null;
            aim.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
        />
      </div>
    </ArcadeArenaSlot>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "bullseye") return null;
  const result = replayBullseyeRun(puzzle.seed, myAnswer ?? "", puzzle.winds, puzzle.bullRev);
  const shots = decodeBullseyeRun(myAnswer ?? "").events.length;
  const size = BULLSEYE_OUTER_R * 2 + 12;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-full max-w-[180px] shrink-0"
        aria-hidden="true"
      >
        {Array.from({ length: BULLSEYE_RINGS }, (_, index) => BULLSEYE_RINGS - index).map(
          (ring) => (
            <circle
              key={ring}
              cx={size / 2}
              cy={size / 2}
              r={ring * BULLSEYE_RING_STEP}
              fill={flightpathColour(BULLSEYE_RING_VALUES[ring - 1] ?? 0)}
              opacity={ring <= 2 ? 0.9 : 0.3}
              stroke="#0B0B0FB0"
            />
          ),
        )}
        {result.hits.filter((hit) => hit.pop !== 1 || result.tuned === 1).map((hit, index) => {
          // Each hit is shown where it fell relative to the target it hit, so
          // every dart is comparable on one full-size ring set (balloon pops are listed below).
          const board = bullseyeBoard(result.state, hit.arrow);
          const scale = board.scalePct;
          const x = size / 2 + ((hit.x - (hit.tdx ?? 0) - BULLSEYE_CX) * 100) / scale;
          const y = size / 2 + ((hit.y - board.cy) * 100) / scale;
          return <circle key={index} cx={x} cy={y} r={5} fill={BULLSEYE_GOLD} stroke="#0B0B0F" />;
        })}
      </svg>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {puzzle.bullRev ? `${result.total} points` : `${result.total} / 100 rings`}
      </p>
      {puzzle.bullRev ? (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.innerBulls} inner bull{result.innerBulls === 1 ? "" : "s"} · {result.pops} of {result.balloons} balloons{result.tuned ? ` (+${result.balloonPoints})` : ""}
        </p>
      ) : null}
      {bullseyeTallRev(puzzle.bullRev) ? (
        <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
          {result.hits.filter(bullseyeIsBull).length} bulls · best streak ×{bestStreak(result.hits)} · dead-centre {result.hits.filter((hit) => hit.dc === 1).length}
        </p>
      ) : null}
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {shots} of {BULLSEYE_ARROWS} darts
      </p>
    </div>
  );
}

/** bullRev 8: the longest run of bulls in a row. */
function bestStreak(hits: readonly Parameters<typeof bullseyeIsBull>[0][]): number {
  let best = 0;
  let run = 0;
  for (const hit of hits) {
    run = bullseyeIsBull(hit) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const bullseyePuzzle: PuzzleDefinition = {
  key: "bullseye",
  name: gameDisplayName("bullseye"),
  category: "arcade",
  timeLimitMs: (BULLSEYE_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () =>
    ({
      type: "bullseye",
      seed: 1,
      winds: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    }) satisfies BullseyePuzzleData,
  check: () => false,
  revealHeading: "Your darts",
  IntroExample,
  Stage,
  Reveal,
};
