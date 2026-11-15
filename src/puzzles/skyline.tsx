import { useGameKeys } from "@/lib/desktop";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { recordTap, tapAt } from "@/lib/arcade/engine";
import { auditTapAt } from "@/lib/arcade/auditInput";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";
import { ArtStill } from "@/components/puzzles/ArtStill";
import type { ArcadeGame } from "@/lib/arcade/engine";

import {
  MAX_CATCH_UP_TICKS,
  TICK_MS,
  TICKS_PER_SECOND,
  type CanvasSize,
} from "@/lib/arcade/engine";
import {
  skylineCheckpoint,
  skylineGameFor,
  SKYLINE_CHECKPOINT_INTERVAL,
  SKYLINE_COLOURS,
  SKYLINE_REV_LIVES,
  skylineWorldHFor,
  SKYLINE_RUN_TICKS,
  type SkylineState,
  SKYLINE_WORLD_W,
} from "@/lib/arcade/skyline";
import { decodeSkylineRun, encodeSkylineRun, replaySkylineRun } from "@/lib/duel/skyline";
import { ARCADE_CRASH_FREEZE_MS, type SkylinePuzzleData } from "@/lib/duel/types";
import { drawSkylineArt, SKYLINE_ART_BG, SKYLINE_NIGHT_STEPS, skylineNightStep, skylineSceneFill } from "@/lib/arcade/skyline.renderer";
import { skylineSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame } from "@/lib/battery";

/**
 * The intro still (the Action overhaul, 15 Nov 2026): the dealt stamp's own art, a fixed seed's tower a few floors up
 * at dusk, built by a steady drop (tap when the block lines up). Display only: the sim runs here only for the picture.
 */
const stillGame = (() => {
  const g = skylineGameFor(SKYLINE_REV_LIVES);
  return {
    ...g,
    step: (s: SkylineState) => g.step(s, Math.abs(s.x - s.blocks[s.blocks.length - 1]!.x) <= 1_400),
    draw: drawSkylineArt,
  } as unknown as ArcadeGame<SkylineState, null>;
})();

function IntroExample() {
  return (
    <ArtStill
      game={stillGame}
      worldW={SKYLINE_WORLD_W}
      worldH={skylineWorldHFor(SKYLINE_REV_LIVES)}
      ticks={330}
      input={null}
      caption="Tap to drop each floor. Line it up for a perfect drop. A miss costs one of your 3 lives."
    />
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SkylinePuzzleData | null = puzzle.type === "skyline" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const skylineGame = skylineGameFor(data?.skylineRev);

  const wrap = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<SkylineState>(skylineGame.init(seed));
  const inputs = useRef<number[]>([]);
  const checkpoints = useRef<ReturnType<typeof skylineCheckpoint>[]>([]);
  const pending = useRef(0);
  const submitted = useRef(false);
  const missedAt = useRef<number | null>(null);
  const [, forceRedraw] = useState(0);
  // Edge to edge: the night step the screen's fill is painted at (it changes a few times a round).
  const nightRef = useRef(0);
  const [nightKey, setNightKey] = useState(0);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  // Desktop keys: Space, ↓ or S drops the block (a tap).
  useGameKeys((kind, key, event) => {
    if (![" ", "ArrowDown", "s"].includes(key)) return false;
    if (kind === "down" && !event.repeat && !lockedRef.current && !submitted.current && !skylineGame.isOver(state.current)) pending.current += 1;
    return true;
  });
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeRaw(),
      arcadeCounters("skyline", state.current, skylineGame.score(state.current)),
    );
  const encodeRaw = (): string =>
    encodeSkylineRun({
      seed,
      claimedScore: skylineGame.score(state.current),
      inputs: inputs.current,
      endTick: state.current.tick,
      checkpoints: checkpoints.current,
    });

  useEffect(() => {
    state.current = skylineGame.init(seed);
    inputs.current = [];
    checkpoints.current = [];
    pending.current = 0;
    submitted.current = false;
    missedAt.current = null;
    forceRedraw((n) => n + 1);
  }, [seed, skylineGame]);

  useEffect(() => {
    if (!data) return;
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({ game: "skyline" });
    const sounds = skylineSounds();
    let secondAt = last;
    let ticksThisSecond = 0;

    const finish = () => {
      if (submitted.current) return;
      submitted.current = true;
      submitRef.current(encode());
    };

    const loop = (time: number) => {
      frameTiming.begin(time);
      frame = arenaFrame(loop);
      const delta = time - last;
      last = time;

      if (!skylineGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          // The dev audit's bot log (auditInput.ts; never in a production build) taps like a player.
          if (auditTapAt(state.current.tick + 1)) pending.current = Math.max(pending.current, 1);
          const tapped = pending.current > 0;
          if (tapped) {
            pending.current -= 1;
            recordTap(inputs.current, state.current.tick + 1);
          }
          state.current = skylineGame.step(
            state.current,
            tapAt(inputs.current, state.current.tick + 1),
          );
          if (state.current.tick % SKYLINE_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(skylineCheckpoint(state.current));
          }
          ticksThisSecond += 1;
          if (skylineGame.isOver(state.current)) break;
        }
      }

      // Edge to edge: the screen's fill follows the night's step (repainted only when the step changes).
      const step = Math.round(skylineNightStep(state.current.placed) * SKYLINE_NIGHT_STEPS);
      if (step !== nightRef.current) {
        nightRef.current = step;
        setNightKey(step);
      }

      reportArcadeTick(state.current.tick, skylineGame.isOver(state.current));
      feedback(state.current, skylineGame.isOver(state.current));
      sounds.frame(state.current, !skylineGame.isOver(state.current) && !lockedRef.current);

      frameTiming.draw();
      const size = sizeCanvas();
      const context = canvas.current?.getContext("2d");
      if (size && context) drawSkylineArt(context, state.current, size);

      frameTiming.rendered();

      if (import.meta.env.DEV && time - secondAt >= 1000) {
        const rate = (ticksThisSecond * 1000) / (time - secondAt);
        console.log(
          `[skyline] ${rate.toFixed(1)} sim ticks/s · tick ${state.current.tick}/${SKYLINE_RUN_TICKS}`,
        );
        secondAt = time;
        ticksThisSecond = 0;
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }

      if (skylineGame.isOver(state.current) && !submitted.current) {
        if (state.current.missed) {
          if (missedAt.current === null) {
            missedAt.current = time;
          } else if (time - missedAt.current >= ARCADE_CRASH_FREEZE_MS) {
            finish();
          }
        } else {
          finish();
        }
      }
      frameTiming.end();
    };

    frame = arenaFrame(loop);
    return () => {
      cancelArenaFrame(loop, frame);
      sounds.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed, skylineGame]);

  const sizeCanvas = (): CanvasSize | null => {
    const node = canvas.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!node || !box || box.width < 1 || box.height < 1) return null;
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

  if (!data) return null;

  return (
    <ArcadeArenaSlot width={SKYLINE_WORLD_W} height={skylineWorldHFor(data.skylineRev)} scene={skylineSceneFill(nightKey / SKYLINE_NIGHT_STEPS)} sceneKey={nightKey}>
      <div ref={wrap} data-game-arena="canvas" className="min-h-0 w-full flex-1 overflow-hidden rounded-xl">
        <canvas role="img"
          ref={canvas}
          className="puzzle-board block h-full w-full rounded-xl"
          style={{ background: SKYLINE_ART_BG }}
          aria-label={gameDisplayName("skyline")}
          onPointerDown={(event) => {
            event.preventDefault();
            if (locked || submitted.current || skylineGame.isOver(state.current)) return;
            pending.current += 1;
          }}
        />
      </div>
    </ArcadeArenaSlot>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "skyline") return null;
  const result = replaySkylineRun(puzzle.seed, myAnswer ?? "", puzzle.skylineRev);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="flex w-full max-w-[200px] shrink-0 flex-col-reverse items-center gap-[2px]">
        {result.state.blocks.slice(-14).map((block, index) => (
          <span
            key={index}
            className="h-2 rounded-sm"
            style={{
              width: `${Math.max(6, Math.round((block.w / 51_200) * 160))}px`,
              background: SKYLINE_COLOURS[index % SKYLINE_COLOURS.length],
            }}
          />
        ))}
      </div>
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.blocks} blocks · {result.perfects} perfect
        {puzzle.skylineRev ? ` · best streak ${result.bestStreak}` : ""} ·{" "}
        {result.survived ? "survived" : `${result.state.lives !== undefined ? "out of lives" : "missed"} at ${result.endedSeconds.toFixed(1)}s`}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same tower for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const skylinePuzzle: PuzzleDefinition = {
  key: "skyline",
  name: gameDisplayName("skyline"),
  category: "arcade",
  timeLimitMs: (SKYLINE_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "skyline", seed: 1, skylineRev: SKYLINE_REV_LIVES }) satisfies SkylinePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
