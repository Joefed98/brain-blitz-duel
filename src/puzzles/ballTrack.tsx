import { ballTrackFill } from "@/lib/arcade/arenaFills.renderer";
import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { useEffect, useMemo, useRef, useState } from "react";

import { appendClientCounters, arcadeCounters } from "@/lib/arcade/diagnostics";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { inputAt, MAX_CATCH_UP_TICKS, recordInput, TICK_MS, type ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  btCheckpoint,
  btEventCountdown,
  makeBallTrackGame,
  BT_BALLS,
  BT_CHECKPOINT_INTERVAL,
  BT_COLS,
  btLayout,
  BT_HOPPER_H,
  BT_K_ROTATE,
  BT_REV,
  BT_REV_BAND,
  BT_REV_TALL,
  BT_PALETTE,
  BT_TILE,
  BT_W,
  type BtCheckpoint,
  type BtCourse,
  type BtState,
} from "@/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "@/lib/duel/ballTrack";
import { BALLTRACK_TIME_MS, type BallTrackPuzzleData } from "@/lib/duel/types";
import { playTick, playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { btArtDraw } from "@/lib/arcade/ballTrackArt.renderer";
import { TOY_TABLE } from "@/lib/arcade/toybox.renderer";
import { ballTrackSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";

/** Practice fallback course (the first bank course). */
const PRACTICE_COURSE: BtCourse = {"trays":[-1,-1,2,0,1,-1,3],"relay":{"tick":1414,"trays":[-1,2,-1,0,1,3,-1]},"shuffle":{"tick":2596,"trays":[-1,0,-1,2,3,1,-1]},"balls":[3,3,1,2,2,1,0,0,2,0,2,0,3,2,1,2,2,1,3,0,0,3,1,2,3,1,1,3,0,1],"fixed":[8,9,11,12,18,23,26,29,37,39,44,46,47,50]};

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

function view(width: number, height: number, BT_H: number) {
  const scale = Math.min(width / BT_W, height / BT_H);
  return { scale, ox: (width - BT_W * scale) / 2, oy: (height - BT_H * scale) / 2 };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BallTrackPuzzleData | null = puzzle.type === "balltrack" ? puzzle : null;
  const course = data?.course ?? PRACTICE_COURSE;
  const seed = data?.seed ?? 1;
  const rev = data?.btRev;
  const game = useMemo(() => makeBallTrackGame(course, rev), [course, rev]);
  // btRev 4: the taller board (its course carries the rows); every phone draws the stored course's board.
  const { rows: BT_ROWS, h: BT_H } = btLayout(course);

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
    const feedback = arcadeFeedback({ game: "balltrack" });
    const sounds = ballTrackSounds(course);
    let seenHome = 0;
    let seenBad = 0;
    let shuffled = 0;
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
          const warning = btEventCountdown(course, state.current.tick);
          if (warning !== null && warning !== btEventCountdown(course, state.current.tick - 1)) playTick(0.4);
          if (state.current.tick % BT_CHECKPOINT_INTERVAL === 0) checkpoints.current.push(btCheckpoint(state.current));
          if (game.isOver(state.current)) break;
        }
      }
      const s = state.current;
      sounds.frame(s, !game.isOver(s) && !lockedRef.current);
      if (s.home > seenHome) seenHome = s.home;
      const bottomEvents = (s.tick >= course.relay.tick ? 1 : 0) + (s.tick >= course.shuffle.tick ? 1 : 0);
      if (bottomEvents > shuffled) {
        shuffled = bottomEvents;
        playTick();
      }
      // Wrong trays knock (sound observer); only lost balls keep the miss cue.
      if (s.lost > seenBad) {
        seenBad = s.lost;
        playWrong();
      }
      const key = `${s.home}|${s.wrong}|${s.next}`;
      if (key !== shown) {
        shown = key;
        setHud({ home: s.home, wrong: s.wrong, left: BT_BALLS - s.next });
      }
      reportArcadeTick(s.tick, game.isOver(s));
      feedback(s, game.isOver(s));
      const node = canvas.current;
      const box = board.current?.getBoundingClientRect();
      if (node && box && box.width > 1) {
        const ratio = arcadeCanvasRatio();
        const w = Math.round(box.width), h = Math.round(box.height);
        if (node.width !== Math.round(w * ratio) || node.height !== Math.round(h * ratio)) {
          node.width = Math.round(w * ratio);
          node.height = Math.round(h * ratio);
        }
        const ctx = node.getContext("2d");
        if (ctx) {
          const v = view(w, h, BT_H);
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          ctx.clearRect(0, 0, w, h);
          ctx.translate(v.ox, v.oy);
          ctx.scale(v.scale, v.scale);
          btArtDraw(ctx, course, s, game.rotatable);
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
    return () => { cancelAnimationFrame(frame); sounds.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, seed]);

  const blocked = () => locked || submitted.current || game.isOver(state.current);
  const push = (event: Omit<ArcadeInputEvent, "t">) => {
    if (queue.current.length < 6) queue.current.push(event);
  };
  const world = (clientX: number, clientY: number) => {
    const box = board.current?.getBoundingClientRect();
    if (!box) return null;
    const v = view(box.width, box.height, BT_H);
    return { x: (clientX - box.left - v.ox) / v.scale, y: (clientY - box.top - v.oy) / v.scale };
  };

  if (!data && puzzle.type !== "balltrack") return null;

  return (
    <div ref={wrap} data-stage-column="0" className="flex min-h-0 w-full flex-1 flex-col select-none" style={GAME_ROOT_STYLE}>
      <ArcadeArenaSlot width={BT_W} height={BT_H} scene={ballTrackFill}>
        <div
          ref={board}
          data-play-area
          data-game-arena="canvas" className="relative min-h-0 w-full flex-1"
          style={{ touchAction: "none" }}
          aria-label={`${gameDisplayName("balltrack")} course`}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(event) => {
            event.preventDefault();
            if (blocked()) return;
            const p = world(event.clientX, event.clientY);
            if (!p) return;
            const col = Math.floor(p.x / BT_TILE), row = Math.floor((p.y - BT_HOPPER_H) / BT_TILE);
            if (col < 0 || col >= BT_COLS || row < 0 || row >= BT_ROWS) return;
            const cell = row * BT_COLS + col;
            // Rev 2: bottom-row tray drops are switch points (the sim ignores taps where no tray is live).
            const switchPoint = (rev === BT_REV || rev === BT_REV_BAND || rev === BT_REV_TALL) && row === BT_ROWS - 1 && col > 0;
            if (!game.rotatable.has(cell) && !switchPoint) return;
            push({ k: BT_K_ROTATE, a: cell, b: 0, c: 0, d: 0 });
          }}
        >
          <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      </ArcadeArenaSlot>
      <div data-game-controls="status" className="flex h-7 w-full shrink-0 items-center justify-between px-1 font-mono text-xs text-muted-foreground">
        <span>{hud.home} home{hud.wrong ? ` · ${hud.wrong} wrong` : ""}</span>
        <span>{hud.left} to drop</span>
      </div>
    </div>
  );
}

/* --------------------------------- Reveal ---------------------------------- */

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "balltrack") return null;
  const result = replayBallTrackRun(puzzle.course, puzzle.seed, myAnswer ?? "", puzzle.btRev);
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center font-mono text-lg font-bold text-foreground">
        {result.home} / {BT_BALLS} home
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
    </div>
  );
}

/** The course comes from the server-only bank; the full input log is replayed on the server. */
export const ballTrackPuzzle: PuzzleDefinition = {
  key: "balltrack",
  name: gameDisplayName("balltrack"),
  category: "arcade",
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
