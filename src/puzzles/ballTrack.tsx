import { useEffect, useMemo, useRef, useState } from "react";

import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { inputAt, MAX_CATCH_UP_TICKS, recordInput, TICK_MS, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  btCheckpoint,
  makeBallTrackGame,
  BT_BALLS,
  BT_CHECKPOINT_INTERVAL,
  BT_COLS,
  BT_H,
  BT_HOPPER_H,
  BT_K_ROTATE,
  BT_PALETTE,
  BT_ROWS,
  BT_TILE,
  BT_W,
  type BtCheckpoint,
  type BtCourse,
  type BtState,
} from "@/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "@/lib/duel/ballTrack";
import { BALLTRACK_TIME_MS, type BallTrackPuzzleData } from "@/lib/duel/types";
import { playBlip, playTick, playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { btDraw } from "@/lib/arcade/ballTrack";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Practice fallback course (the first bank course). */
const PRACTICE_COURSE: BtCourse = {"trays": [3, -1, 1, 4, 0, 2, -1], "balls": [3, 3, 1, 3, 1, 0, 2, 2, 4, 4, 0, 1, 0, 4, 4, 3, 0, 2, 1, 2], "fixed": [15, 18, 19, 22, 23, 25, 36, 40, 44, 45, 46, 51]};

/* ------------------------------ Intro example ------------------------------ */

/** Compact example: turn an upper tube, then follow the fixed bottom to its tray. */
function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep(s => (s + 1) % 7), 600);
    return () => window.clearInterval(id);
  }, []);
  const positions = [{x:50,y:-10},{x:50,y:50},{x:150,y:50},{x:150,y:150},{x:50,y:150},{x:50,y:250},{x:50,y:315}];
  const ball = positions[step] ?? positions[0];
  if (!ball) return null;
  const tube = (d: string, key: string, fixed = false) => (
    <g key={key}>
      <path d={d} fill="none" stroke={fixed ? "var(--bt-fixed)" : "var(--bt-tube)"} strokeWidth="49" />
      <path d={d} fill="none" stroke="var(--bt-background)" strokeWidth="43" />
    </g>
  );
  return (
    <svg viewBox="0 -30 300 370" className="bt-example h-40 w-auto" aria-hidden="true">
      <rect width="300" height="300" fill="var(--bt-background)" />
      {tube("M50 2Q50 50 98 50", "a", true)}
      {tube("M150 2V98", "b")}
      {tube("M202 50Q250 50 250 98", "c", true)}
      {tube("M298 150Q250 150 250 102", "d", true)}
      {tube("M198 150H102", "e")}
      {tube("M98 150Q50 150 50 198", "f", true)}
      {tube("M50 202V298", "g", true)}
      {tube("M102 250H198", "h", true)}
      {tube("M202 250Q250 250 250 298", "i", true)}
      <rect x="8" y="306" width="84" height="28" fill="none" stroke="var(--bt-example-ball)" strokeWidth="4" />
      <circle cx={ball.x} cy={ball.y} r="22.5" fill="var(--bt-example-ball)" className="bt-example-ball" />
    </svg>
  );
}

/* ---------------------------------- Stage ---------------------------------- */

const GAME_ROOT_STYLE = { ...NO_SCROLL_STYLE, userSelect: "none", WebkitUserSelect: "none" } as const;

function view(width: number, height: number) {
  const scale = Math.min(width / BT_W, height / BT_H);
  return { scale, ox: (width - BT_W * scale) / 2, oy: (height - BT_H * scale) / 2 };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BallTrackPuzzleData | null = puzzle.type === "balltrack" ? puzzle : null;
  const course = data?.course ?? PRACTICE_COURSE;
  const seed = data?.seed ?? 1;
  const game = useMemo(() => makeBallTrackGame(course), [course]);

  const wrap = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<BtState>(game.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<BtCheckpoint[]>([]);
  const queue = useRef<Omit<ArcadeInputEvent, "t">[]>([]);
    const submitted = useRef(false);
  const [hud, setHud] = useState({ home: 0, wrong: 0, left: BT_BALLS });
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = () =>
    appendClientCounters(
      encodeBallTrackRun(course, {
        seed,
        claimedScore: game.score(state.current),
        events: events.current,
        endTick: state.current.tick,
        checkpoints: checkpoints.current,
      }),
      arcadeCounters("balltrack", state.current, game.score(state.current)),
    );

  useEffect(() => {
    state.current = game.init(seed);
    events.current = [];
    checkpoints.current = [];
    queue.current = [];
    submitted.current = false;
  }, [game, seed]);

  useEffect(() => {
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    let seenHome = 0;
    let seenBad = 0;
    let shown = "";
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;
      if (!game.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const next = queue.current.shift();
          if (next) recordInput(events.current, { ...next, t: state.current.tick + 1 }, game.inputRanges);
          state.current = game.step(state.current, inputAt(events.current, state.current.tick + 1));
          if (state.current.tick % BT_CHECKPOINT_INTERVAL === 0) checkpoints.current.push(btCheckpoint(state.current));
          if (game.isOver(state.current)) break;
        }
      }
      const s = state.current;
      if (s.home > seenHome) {
        seenHome = s.home;
        playBlip();
      }
      if (s.wrong + s.lost > seenBad) {
        seenBad = s.wrong + s.lost;
        playWrong();
      }
      const key = `${s.home}|${s.wrong}|${s.next}`;
      if (key !== shown) {
        shown = key;
        setHud({ home: s.home, wrong: s.wrong, left: BT_BALLS - s.next });
      }
      reportArcadeTick(s.tick, game.isOver(s));
      const node = canvas.current;
      const box = board.current?.getBoundingClientRect();
      if (node && box && box.width > 1) {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(box.width), h = Math.round(box.height);
        if (node.width !== w * ratio || node.height !== h * ratio) {
          node.width = w * ratio;
          node.height = h * ratio;
        }
        const ctx = node.getContext("2d");
        if (ctx) {
          const v = view(w, h);
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          ctx.clearRect(0, 0, w, h);
          ctx.translate(v.ox, v.oy);
          ctx.scale(v.scale, v.scale);
          btDraw(ctx, course, s, game.rotatable);
        }
      }
      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }
      if (game.isOver(s) && !submitted.current) {
        submitted.current = true;
        submitRef.current(encode());
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, seed]);

  const blocked = () => locked || submitted.current || game.isOver(state.current);
  const push = (event: Omit<ArcadeInputEvent, "t">) => {
    if (queue.current.length < 6) queue.current.push(event);
  };
  const world = (clientX: number, clientY: number) => {
    const box = board.current?.getBoundingClientRect();
    if (!box) return null;
    const v = view(box.width, box.height);
    return { x: (clientX - box.left - v.ox) / v.scale, y: (clientY - box.top - v.oy) / v.scale };
  };

  if (!data && puzzle.type !== "balltrack") return null;

  return (
    <div ref={wrap} className="flex min-h-0 w-full flex-1 flex-col select-none" style={GAME_ROOT_STYLE}>
      <div
        ref={board}
        data-play-area
        className="relative min-h-0 w-full flex-1"
        style={{ touchAction: "none" }}
        aria-label="Ball Track course"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(event) => {
          event.preventDefault();
          if (blocked()) return;
          const p = world(event.clientX, event.clientY);
          if (!p) return;
          const col = Math.floor(p.x / BT_TILE), row = Math.floor((p.y - BT_HOPPER_H) / BT_TILE);
          if (col < 0 || col >= BT_COLS || row < 0 || row >= BT_ROWS) return;
          const cell = row * BT_COLS + col;
          if (!game.rotatable.has(cell)) return;
          push({ k: BT_K_ROTATE, a: cell, b: 0, c: 0, d: 0 });
          playTick();
        }}
      >
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      <div className="flex h-7 w-full shrink-0 items-center justify-between px-1 font-mono text-xs text-muted-foreground">
        <span>{hud.home} home{hud.wrong ? ` · ${hud.wrong} wrong` : ""}</span>
        <span>{hud.left} to drop</span>
      </div>
    </div>
  );
}

/* --------------------------------- Reveal ---------------------------------- */

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "balltrack") return null;
  const result = replayBallTrackRun(puzzle.course, puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center font-mono text-lg font-bold text-foreground">
        {result.home} / {BT_BALLS} home · {result.wrong} wrong
      </p>
      <div className="flex gap-1.5" aria-hidden="true">
        {puzzle.course.trays.map((tray, i) => (
          <span
            key={i}
            className="h-3 w-6 rounded-sm"
            style={{ background: tray < 0 ? "var(--color-muted)" : BT_PALETTE[tray] }}
          />
        ))}
      </div>
      <p className="text-center text-base text-muted-foreground">Same track for everyone</p>
      <p className="font-mono text-base text-primary">{result.score} points</p>
    </div>
  );
}

/** The course comes from the server-only bank; the full input log is replayed on the server. */
export const ballTrackPuzzle: PuzzleDefinition = {
  key: "balltrack",
  name: "Ball Track",
  category: "pattern",
  arcadeRun: true,
  timeLimitMs: BALLTRACK_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "balltrack", seed: 1, course: PRACTICE_COURSE }) satisfies BallTrackPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
