import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters, devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import { inputAt, MAX_CATCH_UP_TICKS, recordInput, TICK_MS, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  snipCheckpoint,
  snipGame,
  snipView,
  snipCamera,
  unpackSnipCut,
  SNIP_CHECKPOINT_INTERVAL,
  SNIP_INPUT_CUT,
  SNIP_MOUTH,
  SNIP_SWEET,
  type SnipState,
} from "@/lib/arcade/snip";
import { drawSnipArt, type SnipSwipe } from "@/lib/arcade/snip.renderer";
import { snipSounds } from "@/lib/fx/gameSounds";
import { encodeSnipRun, replaySnipRun } from "@/lib/duel/snip";
import { SNIP_TIME_MS, type SnipPuzzleData } from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { NO_SCROLL_STYLE } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GAME_ROOT_STYLE = { ...NO_SCROLL_STYLE, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as const;

/** Intro: one rope, one swipe, the sweet drops into the mouth. Plays once. */
function IntroExample() {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (t >= 70) return;
    const id = window.setTimeout(() => setT((v) => v + 1), 33);
    return () => window.clearTimeout(id);
  }, [t]);
  const cut = t >= 25;
  const fall = cut ? Math.min(1, ((t - 25) / 22) ** 2) : 0;
  const sy = 45 + fall * 70;
  const eaten = t >= 47;
  const swipe = t >= 15 && t < 30 ? (t - 15) / 10 : -1;
  return (
    <svg viewBox="0 0 160 140" width={160} height={140} aria-hidden="true" className="rounded-lg">
      <rect width={160} height={140} fill="#1E2433" />
      <circle cx={80} cy={10} r={3} fill="#D9D9D9" />
      {cut ? (
        <polyline points="80,10 79,18 80,24" fill="none" stroke="#C9A66B" strokeWidth={2} opacity={0.5} />
      ) : (
        <line x1={80} y1={10} x2={80} y2={45} stroke="#C9A66B" strokeWidth={2} />
      )}
      <circle cx={80} cy={120} r={12} fill={SNIP_MOUTH} />
      <ellipse cx={80} cy={119} rx={6} ry={eaten ? 1 : 4} fill="#1E2433" />
      {!eaten && <circle cx={80} cy={sy} r={7} fill={SNIP_SWEET} />}
      {swipe >= 0 && swipe <= 1 && (
        <line x1={55} y1={22} x2={55 + 50 * Math.min(1, swipe)} y2={30} stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      )}
    </svg>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: SnipPuzzleData | null = puzzle.type === "snip" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const board = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
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
    const feedback = arcadeFeedback();
    const sounds = snipSounds();
    let seenEaten = 0;
    let shownKey = "";

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
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
      if (s.eaten > seenEaten) {
        seenEaten = s.eaten;
        playCorrect();
      }
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
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(box.width);
        const height = Math.round(box.height);
        if (node.width !== width * ratio || node.height !== height * ratio) {
          node.width = width * ratio;
          node.height = height * ratio;
        }
        const ctx = node.getContext("2d");
        if (ctx) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          const previous = camera.current;
          const reset = previous.level !== s.level;
          const x = snipCamera(s, reset ? s.sx / 256 - 180 : previous.x, reset ? 1 : Math.min(0.1, Math.max(0, (time - previous.time) / 1000)));
          camera.current = { x, level: s.level, time };
          swipes.current = swipes.current.filter((w) => time - w.at < 220);
          drawSnipArt(ctx, s, { width, height }, undefined, x, swipes.current);
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
    const { scaleX, scaleY } = snipView({ width: box.width, height: box.height });
    return { x: Math.round((clientX - box.left) / scaleX + camera.current.x), y: Math.round((clientY - box.top) / scaleY) };
  };
  const active = () => !locked && !submitted.current && !snipGame.isOver(state.current);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 select-none" style={GAME_ROOT_STYLE}>
      <div className="flex items-baseline justify-between px-1 font-mono text-sm text-muted-foreground">
        <span>Level {hud.level}</span>
        <span className="text-2xl font-bold text-foreground">
          <span className="text-primary">{hud.score}</span>
        </span>
        <span>
          {hud.eaten} fed · {hud.stars}★
        </span>
      </div>
      <div
        ref={board}
        data-play-area
        className="relative min-h-0 w-full flex-1"
        style={{ touchAction: "none" }}
        aria-label="Snip arena"
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
      {dev ? <p className="truncate font-mono text-[10px] text-muted-foreground">{dev}</p> : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "snip") return null;
  const result = replaySnipRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center font-mono text-lg font-bold text-foreground">
        {result.eaten} sweet{result.eaten === 1 ? "" : "s"} fed · {result.stars}★
      </p>
      <p className="text-center text-base text-muted-foreground">Same levels for everyone</p>
    </div>
  );
}

/** Levels come from the round's seed; the run is replayed on the server. */
export const snipPuzzle: PuzzleDefinition = {
  key: "snip",
  name: "Snip",
  category: "arcade",
  timeLimitMs: SNIP_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "snip", seed: 1 }) satisfies SnipPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
