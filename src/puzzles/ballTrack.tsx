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
  BT_K_FLIP,
  BT_K_RELEASE,
  BT_K_ROTATE,
  BT_K_SLIDE,
  BT_K_WHEEL,
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

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Practice fallback course (a tier-2 bank course). */
const PRACTICE_COURSE: BtCourse = {
  trays: [-1, 2, 4, 0, 3, 1, -1],
  balls: [1, 2, 4, 3, 2, 1, 4, 3, 0, 4, 2, 1, 0, 3, 0],
  pipes: [
    { cell: 27, shape: 0, rot: 0 },
    { cell: 12, shape: 1, rot: 2 },
    { cell: 2, shape: 0, rot: 2 },
  ],
  flippers: [
    { cell: 3, dir: 0 },
    { cell: 8, dir: 0 },
    { cell: 5, dir: 1 },
    { cell: 10, dir: 1 },
    { cell: 11, dir: 1 },
  ],
  sliders: [
    { row: 5, col: 0, len: 3, slot: 0, pos: 0 },
    { row: 4, col: 1, len: 3, slot: 1, pos: 0 },
  ],
  wheels: [{ cell: 18, pocket: 0 }],
};

/* ------------------------------ Intro example ------------------------------ */

/** 3×3: a flipper in the middle, two trays below, one ball mid-fall. */
function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % 6), 650);
    return () => window.clearInterval(id);
  }, []);
  const flapRight = step >= 2;
  const ball = [
    { x: 150, y: 20 },
    { x: 150, y: 50 },
    { x: 150, y: 150 },
    { x: 250, y: 250 },
    { x: 250, y: 335 },
    { x: 250, y: 335 },
  ][step]!;
  return (
    <svg viewBox="0 0 300 370" className="h-40 w-auto" aria-hidden="true">
      <rect x="0" y="0" width="300" height="300" rx="10" fill="#12161C" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) =>
          r === 1 && c === 1 ? null : (
            <line key={`${r}${c}`} x1={c * 100 + 50} y1={r * 100 + 12} x2={c * 100 + 50} y2={r * 100 + 88} stroke="#2A313C" strokeWidth="4" strokeDasharray="8 10" />
          ),
        ),
      )}
      <rect x="108" y="108" width="84" height="84" rx="6" fill="none" stroke="#3A414D" strokeWidth="4" />
      <line x1="150" y1="132" x2={flapRight ? 180 : 120} y2="176" stroke="#F5B82E" strokeWidth="12" strokeLinecap="round" />
      <rect x="8" y="305" width="84" height="58" fill="#4D8CFF" opacity=".25" />
      <path d="M10 305 V361 H90 V305" fill="none" stroke="#4D8CFF" strokeWidth="5" />
      <rect x="208" y="305" width="84" height="58" fill="#FF4D4D" opacity={step >= 4 ? 0.6 : 0.25} />
      <path d="M210 305 V361 H290 V305" fill="none" stroke="#FF4D4D" strokeWidth="5" />
      <circle cx={ball.x} cy={ball.y} r="18" fill="#FF4D4D" style={{ transition: "cx .6s linear, cy .6s linear" }} />
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
  const drag = useRef<{ id: number; slider: number; grab: number; last: number } | null>(null);
  const submitted = useRef(false);
  const [hud, setHud] = useState({ home: 0, wrong: 0, left: BT_BALLS, hopperBusy: false });
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
      const hopperBusy = s.balls.some((b) => b.cell === -1);
      const key = `${s.home}|${s.wrong}|${s.next}|${hopperBusy}`;
      if (key !== shown) {
        shown = key;
        setHud({ home: s.home, wrong: s.wrong, left: BT_BALLS - s.next, hopperBusy });
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
          game.draw(ctx, s, { width: BT_W, height: BT_H });
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
    if (event.k === BT_K_SLIDE) queue.current = queue.current.filter((e) => !(e.k === BT_K_SLIDE && e.a === event.a));
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
          const info = game.map[cell]!;
          if (info.kind === 1) push({ k: BT_K_ROTATE, a: cell, b: 0, c: 0, d: 0 });
          else if (info.kind === 2) push({ k: BT_K_FLIP, a: cell, b: 0, c: 0, d: 0 });
          else if (info.kind === 4) push({ k: BT_K_WHEEL, a: info.idx, b: 0, c: 0, d: 0 });
          else if (info.kind === 3) {
            const slider = course.sliders[info.idx]!;
            const pos = state.current.slTo[info.idx]!;
            const grab = (p.x - slider.col * BT_TILE) / BT_TILE - pos;
            drag.current = { id: event.pointerId, slider: info.idx, grab, last: pos };
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          if (info.kind !== 3 && info.kind !== 0) playTick();
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (!d || d.id !== event.pointerId || blocked()) return;
          const p = world(event.clientX, event.clientY);
          if (!p) return;
          const slider = course.sliders[d.slider]!;
          const pos = Math.max(0, Math.min(slider.len - 2, Math.round((p.x - slider.col * BT_TILE) / BT_TILE - d.grab)));
          if (pos !== d.last) {
            d.last = pos;
            push({ k: BT_K_SLIDE, a: d.slider, b: pos, c: 0, d: 0 });
            playTick();
          }
        }}
        onPointerUp={(event) => {
          if (drag.current?.id === event.pointerId) drag.current = null;
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      <div className="flex h-14 w-full shrink-0 items-center justify-between gap-2 px-1 pt-1">
        <span className="w-20 font-mono text-xs text-muted-foreground">
          {hud.home} home{hud.wrong ? ` · ${hud.wrong} wrong` : ""}
        </span>
        <button
          type="button"
          className="h-12 min-w-36 rounded-xl bg-primary px-6 font-display text-lg font-bold text-primary-foreground shadow disabled:opacity-40"
          style={{ touchAction: "manipulation" }}
          disabled={locked || hud.left === 0 || hud.hopperBusy}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!blocked()) push({ k: BT_K_RELEASE, a: 0, b: 0, c: 0, d: 0 });
          }}
        >
          Release
        </button>
        <span className="w-20 text-right font-mono text-xs text-muted-foreground">{hud.left} left</span>
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
      <p className="text-center text-base text-muted-foreground">Same course for everyone</p>
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
