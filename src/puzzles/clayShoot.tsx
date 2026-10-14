import { gameDisplayName } from "@/lib/duel/gameNames";
import { clayArtGameFor } from '@/lib/arcade/clayShoot.renderer';
import { drawClayFinalBurst } from '@/lib/arcade/clayShootArt.renderer';
import { END_OF_RUN_FX_SCORE, playOverlayFx, registerFxPreview, soundCue } from "@/components/puzzles/speedFx";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
import { clayTapWorld } from "@/components/puzzles/tapMapping";
import { arcadeFeedback } from "@/lib/fx/arcade";
import { appendClientCounters, arcadeCounters, devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { reportArcadeTick, resetArcadeClock } from "@/lib/arcade/clock";
import { useEffect, useRef, useState } from "react";

import {
  inputAt,
  MAX_CATCH_UP_TICKS,
  recordInput,
  TICK_MS,
  type ArcadeInputEvent,
} from "@/lib/arcade/engine";
import {
  clayCheckpoint,
  clayGameFor,
  unpackClayLog,
  clayFlight,
  CLAY_CHECKPOINT_INTERVAL,
  CLAY_COUNT,
  CLAY_KIND_GOLD,
  CLAY_HIT,
  CLAY_INPUT_SHOT,
  CLAY_LOG_ESCAPED,
  CLAY_LOG_HIT,
  CLAY_MISSED,
  CLAY_ORANGE,
  CLAY_W,
  type ClayState,
} from "@/lib/arcade/clayShoot";
import { clayChargesEmptyShots, CLAY_EMPTY_SHOTS_PER_POINT, CLAY_FREE_EMPTY_SHOTS, CLAY_REV, CLAY_REV5 } from "@/lib/arcade/clayShoot";
import { encodeClayRun, replayClayRun } from "@/lib/duel/clayShoot";
import { CLAYSHOOT_TIME_MS, type ClayShootPuzzleData } from "@/lib/duel/types";
import { playSound, playTick } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GAME_ROOT_STYLE = { ...NO_SCROLL_STYLE, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as const;

/**
 * End-of-run effect for a strong run (phone score >= END_OF_RUN_FX_SCORE): a last burst of
 * clay fragments that turns into gold sparkle over the sky. Overlay canvas only; it never
 * touches the sim, the run string or its submission.
 */
function fireClayFinale(board: HTMLElement | null): void {
  if (!board) return;
  const rect = board.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  soundCue("clayshoot.finalBurst");
  let sparkled = false;
  playOverlayFx({
    rect,
    ms: 1100,
    draw: ({ ctx, ms, width, height, reduced }) => {
      if (!sparkled && ms >= 380) {
        sparkled = true;
        soundCue("clayshoot.goldSparkle");
      }
      drawClayFinalBurst(ctx, ms, width, height, reduced);
    },
  });
}

function IntroBird({ x, y, up }: { x: number; y: number; up: boolean }) {
  const tipY = up ? -9 : 8;
  return (
    <g transform={`translate(${x} ${y})`} stroke="rgba(14,20,32,0.85)" strokeWidth="1" strokeLinejoin="round">
      <path d={`M2 -1 Q0 ${tipY * 0.7} -6 ${tipY} Q-3 ${tipY * 0.45} -3 0Z`} fill="#C9D0DA" transform="translate(1.5 -0.5)" />
      <path d="M-6 -1.5 L-13 -3.2 L-11.2 0.5 L-13 3.5 L-6 2.2Z" fill="#F8F9FB" />
      <ellipse cx="0" cy="0.5" rx="7.5" ry="3.8" fill="#F8F9FB" />
      <circle cx="7.4" cy="-1.3" r="3.1" fill="#F8F9FB" />
      <path d="M10 -2.3 L13.6 -0.8 L10 0.2Z" fill="#EFA531" strokeWidth="0.6" />
      <circle cx="8.2" cy="-2.1" r="0.9" fill="#0B0B0F" stroke="none" />
      <path d={`M2 -1 Q0 ${tipY * 0.7} -6 ${tipY} Q-3 ${tipY * 0.45} -3 0Z`} fill="#FFFFFF" />
    </g>
  );
}

/** Intro: one clay crosses, one tap shatters it. */
function IntroExample() {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (t >= 60) return;
    const id = window.setTimeout(() => setT((v) => v + 1), 33);
    return () => window.clearTimeout(id);
  }, [t]);
  const p = Math.min(t, 40) / 60;
  const x = 10 + p * 180;
  const y = 100 - 320 * p * (1 - p);
  const shot = t >= 40;
  return (
    <svg viewBox="0 0 200 110" width={200} height={110} aria-hidden="true" className="rounded-lg">
      <defs>
        <linearGradient id="clay-intro-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1C4774" />
          <stop offset="0.6" stopColor="#3A78AE" />
          <stop offset="0.9" stopColor="#9CC4E0" />
        </linearGradient>
        <linearGradient id="clay-intro-clay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFA766" />
          <stop offset="0.5" stopColor={CLAY_ORANGE} />
          <stop offset="1" stopColor="#A9481A" />
        </linearGradient>
      </defs>
      <rect width={200} height={110} fill="url(#clay-intro-sky)" />
      <circle cx={172} cy={18} r={18} fill="rgba(255,236,190,0.22)" />
      <circle cx={172} cy={18} r={7} fill="#FFF6DE" opacity={0.9} />
      <path d="M0 98 Q20 92 40 96 T80 95 T120 96 T160 94 T200 96 V110 H0Z" fill="#2D573B" />
      <rect y={101} width={200} height={9} fill="#4A7436" />
      <path d="M10 100 Q100 -60 190 100" fill="none" stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
      {!shot ? (
        <g>
          <ellipse cx={x} cy={y} rx={9} ry={5} fill="url(#clay-intro-clay)" stroke="rgba(90,30,5,0.55)" strokeWidth={0.7} />
          <ellipse cx={x - 2.5} cy={y - 1.7} rx={3.6} ry={1.3} fill="rgba(255,255,255,0.55)" />
        </g>
      ) : (
        [0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k * Math.PI) / 3;
          const d = 4 + (t - 40) * 1.2;
          return <rect key={k} x={x + Math.cos(a) * d - 2} y={y + Math.sin(a) * d - 1} width={4} height={3} fill={CLAY_ORANGE} opacity={1 - (t - 40) / 20} />;
        })
      )}
      {t >= 36 ? <circle cx={x} cy={y} r={14} fill="none" stroke="#F5B82E" strokeWidth={2} opacity={shot ? 1 - (t - 40) / 20 : 1} /> : null}
      <IntroBird x={154} y={32} up={t % 8 < 4} />
      <IntroBird x={130} y={50} up={(t + 3) % 8 < 4} />
    </svg>
  );
}

function Pips({ status, kind }: { status: number[]; kind: number[] }) {
  return (
    <div className="flex justify-center gap-0.5">
      {status.map((s, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            s === CLAY_HIT
              ? kind[i] === CLAY_KIND_GOLD
                ? "bg-primary"
                : "bg-secondary"
              : s === CLAY_MISSED
                ? kind[i] === CLAY_KIND_GOLD
                  ? "bg-primary/40"
                  : "bg-destructive"
                : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: ClayShootPuzzleData | null = puzzle.type === "clayshoot" ? puzzle : null;
  const seed = data?.seed ?? 1;
  const game = clayArtGameFor(data?.clayRev);

  const wrap = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<ClayState>(game.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof clayCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const submitted = useRef(false);
  const [hud, setHud] = useState({ hits: 0, orangeHits: 0, goldHits: 0, birdHits: 0, status: new Array<number>(CLAY_COUNT).fill(0) });
  const [dev, setDev] = useState<string | null>(null);
  useNoTouchScroll(wrap);

  const lockedRef = useRef(locked);
  const submitRef = useRef(onSubmit);
  const draftRef = useRef(onDraftAnswer);
  lockedRef.current = locked;
  submitRef.current = onSubmit;
  draftRef.current = onDraftAnswer;

  const encode = (): string =>
    appendClientCounters(
      encodeClayRun({
        seed,
        claimedScore: game.score(state.current),
        events: events.current,
        endTick: state.current.tick,
        checkpoints: checkpoints.current,
      }, data?.clayRev),
      arcadeCounters("clayshoot", state.current, game.score(state.current)),
    );

  useEffect(() => {
    state.current = game.init(seed);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
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
    let seenHits = 0;
    let seenGold = 0;
    let seenBirds = 0;
    let shownKey = "";

    const loop = (time: number) => {
      frameTiming.begin(time);
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;
      if (!game.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          if (applied && recordInput(events.current, applied, game.inputRanges)) playTick();
          state.current = game.step(state.current, inputAt(events.current, state.current.tick + 1));
          if (state.current.tick % CLAY_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(clayCheckpoint(state.current));
          }
          if (game.isOver(state.current)) break;
        }
      }
      const s = state.current;
      if (s.hits > seenHits) {
        for (let n = seenHits; n < s.hits; n++) playSound("pz_clay_hit", 1, 1, true);
        soundCue(s.goldHits > seenGold ? "clayshoot.goldShatter" : "clayshoot.shatter");
        seenHits = s.hits;
        seenGold = s.goldHits;
      }
      if ((s.birdHits ?? 0) > seenBirds) {
        seenBirds = s.birdHits ?? 0;
        soundCue("clayshoot.birdStartle");
      }
      const key = `${s.status.join("")}:${s.birdHits ?? 0}`;
      if (key !== shownKey) {
        shownKey = key;
        setHud({ hits: s.hits, orangeHits: s.orangeHits, goldHits: s.goldHits, birdHits: s.birdHits ?? 0, status: [...s.status] });
      }
      if (devOn && s.tick % 6 === 0) {
        const log = s.log
          .slice(-6)
          .map((entry) => {
            const e = unpackClayLog(entry);
            const name = e.code === CLAY_LOG_HIT ? `hit#${e.clay + 1}` : e.code === CLAY_LOG_ESCAPED ? `lost#${e.clay + 1}` : "miss";
            return `${e.tick}:${name}`;
          })
          .join(" ");
        const paths = s.schedule.vx
          .map((vx, i) => {
            const f = clayFlight(s.schedule.side[i]!, s.schedule.launchY[i]!, vx, s.schedule.vy[i]!);
            return `${i + 1}:${Math.round((100 * f.coverage) / CLAY_W)}%/${(f.ticks / 60).toFixed(1)}s`;
          })
          .join(" ");
        setDev(`tick ${s.tick} · queue ${s.next}/${CLAY_COUNT} · shots ${s.shots} · ${log}\n${paths}`);
      }

      reportArcadeTick(s.tick, game.isOver(s));
      feedback(s, game.isOver(s));
      frameTiming.draw();
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
          game.draw(ctx, s, { width, height });
        }
      }

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }
      if (game.isOver(s) && !submitted.current) {
        submitted.current = true;
        submitRef.current(encode());
        // Presentation only, after the run is submitted: never delays or alters it.
        if (game.score(s) >= END_OF_RUN_FX_SCORE) fireClayFinale(board.current);
      }
      frameTiming.end();
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, data, game]);

  useEffect(() => registerFxPreview("clayshoot", () => fireClayFinale(board.current)), []);

  if (!data) return null;

  return (
    <div ref={wrap} data-stage-column="1" data-polish="clayshoot" className="flex min-h-0 w-full flex-1 flex-col gap-1 select-none" style={GAME_ROOT_STYLE}>
      <p className="shrink-0 text-center font-mono text-xs font-semibold leading-none text-foreground">
        <span className="text-primary">{hud.hits}</span> / {CLAY_COUNT} · {hud.orangeHits} orange · {hud.goldHits} gold · {hud.birdHits} birds
      </p>
      <div className="shrink-0"><Pips status={hud.status} kind={state.current.schedule.kind} /></div>
      <div
        ref={board}
        data-play-area
        data-game-arena="canvas" className="relative min-h-0 w-full flex-1"
        style={{ touchAction: "none" }}
        aria-label={`${gameDisplayName("clayshoot")} sky`}
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || game.isOver(state.current)) return;
          const box = board.current?.getBoundingClientRect();
          if (!box) return;
          const shot = clayTapWorld(box, event.clientX, event.clientY);
          if (!shot) return;
          pending.current.push({ t: 0, k: CLAY_INPUT_SHOT, a: shot.wx, b: shot.wy, c: 0, d: 0 });
        }}
      >
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      {dev ? <p className="whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">{dev}</p> : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "clayshoot") return null;
  const result = replayClayRun(puzzle.seed, myAnswer ?? "", puzzle.clayRev);
  // clayRev 4: the stored empty-shot count and cost.
  const empty = typeof myExtra?.["emptyShots"] === "number" ? (myExtra["emptyShots"] as number) : null;
  const cost = typeof myExtra?.["emptyShotCost"] === "number" ? (myExtra["emptyShotCost"] as number) : null;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center font-mono text-lg font-bold text-foreground">
        {result.hits} / {result.total} clays · {result.orangeHits} orange · {result.goldHits} gold · {result.birdHits} birds hit
      </p>
      <p className="text-center text-base text-muted-foreground">{result.shots} shot{result.shots === 1 ? "" : "s"} · Don't shoot the birds — each one costs 10.</p>
      {empty !== null && cost !== null ? (
        <p className="text-center text-sm text-muted-foreground">
          {empty} hit nothing{cost > 0 ? ` · −${cost}` : ""} (first {CLAY_FREE_EMPTY_SHOTS} free, then −1 per {CLAY_EMPTY_SHOTS_PER_POINT})
        </p>
      ) : null}
    </div>
  );
}

/** The launch schedule comes from the round's seed; the run is replayed on the server. */
export const clayShootPuzzle: PuzzleDefinition = {
  key: "clayshoot",
  name: gameDisplayName("clayshoot"),
  category: "speed",
  arcadeRun: true,
  timeLimitMs: CLAYSHOOT_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "clayshoot", seed: 1, clayRev: CLAY_REV }) satisfies ClayShootPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  introLine: (puzzle) =>
    puzzle.type === "clayshoot" && clayChargesEmptyShots(puzzle.clayRev)
      ? `${puzzle.clayRev === CLAY_REV5 ? "14–16 birds cross: don't" : "Don't"} shoot them — each one costs 10. Aim: after ${CLAY_FREE_EMPTY_SHOTS} shots that hit nothing, every ${CLAY_EMPTY_SHOTS_PER_POINT} more cost 1.`
      : "Don't shoot the birds — each one costs 10.",
  IntroExample,
  Stage,
  Reveal,
};
