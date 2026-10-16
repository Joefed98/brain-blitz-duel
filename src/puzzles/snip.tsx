import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters, devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import { inputAt, MAX_CATCH_UP_TICKS, recordInput, TICK_MS, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  snipCheckpoint,
  snipGame,
  snipGameFor,
  snipView,
  snipCamera,
  unpackSnipCut,
  SNIP_CHECKPOINT_INTERVAL,
  SNIP_INPUT_CUT,
  SNIP_CONFIG,
  SNIP_REV_PROVEN,
  snipWorldHFor,
  type SnipState,
} from "@/lib/arcade/snip";
import { drawSnipArt, drawSnipOrchardExample, type SnipSwipe } from "@/lib/arcade/snip.renderer";
import { COUNTRY_GRASS } from "@/lib/arcade/countryside.renderer";
import { snipSounds } from "@/lib/fx/gameSounds";
import { encodeSnipRun, replaySnipRun } from "@/lib/duel/snip";
import { SNIP_TIME_MS, type SnipPuzzleData } from "@/lib/duel/types";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { NO_SCROLL_STYLE } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";

const GAME_ROOT_STYLE = { ...NO_SCROLL_STYLE, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as const;

/** Intro: one rope, one swipe, the sweet drops into the mouth. Plays once. */
function IntroExample() {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (t >= 70) return;
    const id = window.setTimeout(() => setT((v) => v + 1), 33);
    return () => window.clearTimeout(id);
  }, [t]);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const ctx=canvas.current?.getContext("2d");if(!ctx)return;
    ctx.setTransform(2,0,0,2,0,0);drawSnipOrchardExample(ctx,t);
  },[t]);
  return <canvas ref={canvas} width={320} height={280} aria-hidden="true" className="h-[140px] w-[160px] rounded-lg" />;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SnipPuzzleData | null = puzzle.type === "snip" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const snipGame = snipGameFor(data?.snipRev);

  const board = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const camera = useRef({ x: 90, level: -1, time: 0 });
  const state = useRef<SnipState>(snipGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof snipCheckpoint>[]>([]);
  /** The swipe since the last tick, as one straight step. */
  const pendingCut = useRef<{ a: number; b: number; c: number; d: number } | null>(null);
  const swipes = useRef<SnipSwipe[]>([]);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const submitted = useRef(false);
  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  const [hud, setHud] = useState({ level: 1, eaten: 0, stars: 0, score: 0 });
  const [dev, setDev] = useState("");
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeSnipRun({
        seed,
        claimedScore: snipGame.score(state.current),
        events: events.current,
        endTick: state.current.tick,
        checkpoints: checkpoints.current,
      }),
      arcadeCounters("snip", state.current, snipGame.score(state.current)),
    );

  useEffect(() => {
    state.current = snipGame.init(seed);
    events.current = [];
    checkpoints.current = [];
    pendingCut.current = null;
    submitted.current = false;
  }, [seed]);

  useEffect(() => {
    if (!data) return;
    const devOn = devDiagnosticsOn();
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({ game: "snip" });
    const sounds = snipSounds();
    let shownKey = "";

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      frameTiming.begin(time);
      const delta = time - last;
      last = time;
      if (!snipGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const seg = pendingCut.current;
          pendingCut.current = null;
          if (seg) {
            recordInput(events.current, { t: state.current.tick + 1, k: SNIP_INPUT_CUT, ...seg }, snipGame.inputRanges);
            state.current = snipGame.step(state.current, inputAt(events.current, state.current.tick + 1));
          } else {
            state.current = snipGame.step(state.current, inputAt(events.current, state.current.tick + 1));
          }
          if (state.current.tick % SNIP_CHECKPOINT_INTERVAL === 0) checkpoints.current.push(snipCheckpoint(state.current));
          if (snipGame.isOver(state.current)) break;
        }
      }
      const s = state.current;
      const key = `${s.level}.${s.eaten}.${s.stars}`;
      if (key !== shownKey) {
        shownKey = key;
        setHud({ level: Math.min(10, s.level + 1), eaten: s.eaten, stars: s.stars, score: snipGame.score(s) });
      }
      if (devOn && s.tick % 6 === 0) {
        const cuts = s.cutLog
          .slice(-5)
          .map((e) => {
            const c = unpackSnipCut(e);
            return `${c.tick}:L${c.level + 1}r${c.rope}`;
          })
          .join(" ");
        const trail = s.trail.map((p) => `${Math.floor(p / 1024)},${p % 1024}`).join(" ");
        setDev(`tick ${s.tick} · level ${s.level} (tpl ${s.template}) · cuts ${cuts || "—"} · sweet@300 ${trail || "—"}`);
      }

      reportArcadeTick(s.tick, snipGame.isOver(s));
      feedback(s, snipGame.isOver(s));
      sounds.frame(s, !snipGame.isOver(s) && !lockedRef.current);
      const node = canvas.current;
      const box = board.current?.getBoundingClientRect();
      if (node && box && box.width > 1) {
        const ratio = arcadeCanvasRatio();
        const width = Math.round(box.width);
        const height = Math.round(box.height);
        if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) {
          node.width = Math.round(width * ratio);
          node.height = Math.round(height * ratio);
        }
        const ctx = node.getContext("2d");
        if (ctx) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          const previous = camera.current;
          const reset = previous.level !== s.level;
          const x = snipCamera(s, reset ? s.sx / 256 - 180 : previous.x, reset ? 1 : Math.min(0.1, Math.max(0, (time - previous.time) / 1000)));
          camera.current = { x, level: s.level, time };
          swipes.current = swipes.current.filter((w) => time - w.at < 220);
          frameTiming.draw();
          drawSnipArt(ctx, s, { width, height }, undefined, x, swipes.current);
          frameTiming.rendered();
        }
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }
      if (snipGame.isOver(s) && !submitted.current) {
        submitted.current = true;
        submitRef.current(encode());
      }
      frameTiming.end();
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      sounds.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, data]);

  if (!data) return null;

  const toWorld = (clientX: number, clientY: number) => {
    const box = board.current?.getBoundingClientRect();
    if (!box) return null;
    const { scaleX, scaleY } = snipView({ width: box.width, height: box.height }, snipWorldHFor(data.snipRev));
    return { x: Math.round((clientX - box.left) / scaleX + camera.current.x), y: Math.round((clientY - box.top) / scaleY) };
  };
  const active = () => !locked && !submitted.current && !snipGame.isOver(state.current);

  return (
    <div data-stage-column="1" className="flex min-h-0 w-full flex-1 flex-col gap-1 select-none" style={GAME_ROOT_STYLE}>
      {/* One 20px line under the compact header (15 Oct 2026, display only; it was 32px). */}
      <div data-snip-hud className="flex h-5 shrink-0 items-center justify-between px-2 font-mono text-xs leading-none text-muted-foreground">
        <span>Level {hud.level}</span>
        <span className="text-base font-bold text-foreground">
          <span className="text-primary">{hud.score}</span>
        </span>
        <span>
          {hud.eaten} picked · {hud.stars} leaves
        </span>
      </div>
      <ArcadeArenaSlot width={SNIP_CONFIG.viewW} height={snipWorldHFor(data.snipRev)}>
        <div
          ref={board}
          data-play-area
          data-game-arena="canvas" className="relative min-h-0 w-full flex-1"
          style={{ touchAction: "none" }}
          aria-label={`${gameDisplayName("snip")} arena`}
          onPointerDown={(event) => {
            event.preventDefault();
            if (!active()) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            lastPoint.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const previous = lastPoint.current;
            if (!previous || !active()) return;
            const from = toWorld(previous.x, previous.y);
            const to = toWorld(event.clientX, event.clientY);
            if (!from || !to) return;
            const seg = pendingCut.current;
            pendingCut.current = seg ? { ...seg, c: to.x, d: to.y } : { a: from.x, b: from.y, c: to.x, d: to.y };
            swipes.current.push({ a: from.x, b: from.y, c: to.x, d: to.y, at: performance.now() });
            if (swipes.current.length > 24) swipes.current.shift();
            lastPoint.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={() => (lastPoint.current = null)}
          onPointerCancel={() => (lastPoint.current = null)}
        >
          <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      </ArcadeArenaSlot>
      {dev ? <p className="truncate font-mono text-[10px] text-muted-foreground">{dev}</p> : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "snip") return null;
  const result = replaySnipRun(puzzle.seed, myAnswer ?? "", puzzle.snipRev);
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center font-mono text-lg font-bold text-foreground">
        {result.eaten} apple{result.eaten === 1 ? "" : "s"} picked · {result.stars} leaves
      </p>
      <p className="text-center text-base text-muted-foreground">Same levels for everyone</p>
    </div>
  );
}

/** Levels come from the round's seed; the run is replayed on the server. */
export const snipPuzzle: PuzzleDefinition = {
  key: "snip",
  name: gameDisplayName("snip"),
  category: "arcade",
  timeLimitMs: SNIP_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "snip", seed: 1, snipRev: SNIP_REV_PROVEN }) satisfies SnipPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
