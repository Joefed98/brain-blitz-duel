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
  clayGame,
  clayView,
  unpackClayLog,
  CLAY_CHECKPOINT_INTERVAL,
  CLAY_COUNT,
  CLAY_H,
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
import { encodeClayRun, replayClayRun } from "@/lib/duel/clayShoot";
import { CLAYSHOOT_TIME_MS, type ClayShootPuzzleData } from "@/lib/duel/types";
import { playBlip, playTick } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GAME_ROOT_STYLE = { ...NO_SCROLL_STYLE, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as const;

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
      <rect width={200} height={110} fill="#2B5378" />
      <path d="M10 100 Q100 -60 190 100" fill="none" stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
      {!shot ? (
        <ellipse cx={x} cy={y} rx={9} ry={5} fill={CLAY_ORANGE} />
      ) : (
        [0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k * Math.PI) / 3;
          const d = 4 + (t - 40) * 1.2;
          return <rect key={k} x={x + Math.cos(a) * d - 2} y={y + Math.sin(a) * d - 1} width={4} height={3} fill={CLAY_ORANGE} opacity={1 - (t - 40) / 20} />;
        })
      )}
      {t >= 36 ? <circle cx={x} cy={y} r={14} fill="none" stroke="#F5B82E" strokeWidth={2} opacity={shot ? 1 - (t - 40) / 20 : 1} /> : null}
    </svg>
  );
}

function Pips({ status, kind }: { status: number[]; kind: number[] }) {
  return (
    <div className="flex justify-center gap-1">
      {status.map((s, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${s === CLAY_HIT ? "bg-primary" : s === CLAY_MISSED ? "bg-destructive" : kind[i] === CLAY_KIND_GOLD ? "bg-primary/40" : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: ClayShootPuzzleData | null = puzzle.type === "clayshoot" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<ClayState>(clayGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof clayCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const submitted = useRef(false);
  const [hud, setHud] = useState({ hits: 0, orangeHits: 0, goldHits: 0, status: new Array<number>(CLAY_COUNT).fill(0) });
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
        claimedScore: clayGame.score(state.current),
        events: events.current,
        endTick: state.current.tick,
        checkpoints: checkpoints.current,
      }),
      arcadeCounters("clayshoot", state.current, clayGame.score(state.current)),
    );

  useEffect(() => {
    state.current = clayGame.init(seed);
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
    let seenHits = 0;
    let shownKey = "";

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;
      if (!clayGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          if (applied && recordInput(events.current, applied, clayGame.inputRanges)) playTick();
          state.current = clayGame.step(state.current, inputAt(events.current, state.current.tick + 1));
          if (state.current.tick % CLAY_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(clayCheckpoint(state.current));
          }
          if (clayGame.isOver(state.current)) break;
        }
      }
      const s = state.current;
      if (s.hits > seenHits) {
        seenHits = s.hits;
        playBlip();
      }
      const key = s.status.join("");
      if (key !== shownKey) {
        shownKey = key;
        setHud({ hits: s.hits, orangeHits: s.orangeHits, goldHits: s.goldHits, status: [...s.status] });
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
        setDev(`tick ${s.tick} · queue ${s.next}/${CLAY_COUNT} · shots ${s.shots} · ${log}`);
      }

      reportArcadeTick(s.tick, clayGame.isOver(s));
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
          clayGame.draw(ctx, s, { width, height });
        }
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }
      if (clayGame.isOver(s) && !submitted.current) {
        submitted.current = true;
        submitRef.current(encode());
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, data]);

  if (!data) return null;

  return (
    <div ref={wrap} className="flex min-h-0 w-full flex-1 flex-col gap-2 select-none" style={GAME_ROOT_STYLE}>
      <p className="text-center font-mono text-2xl font-bold text-foreground">
        <span className="text-primary">{hud.hits}</span> / {CLAY_COUNT} · {hud.orangeHits} orange · {hud.goldHits} gold
      </p>
      <Pips status={hud.status} kind={state.current.schedule.kind} />
      <div
        ref={board}
        data-play-area
        className="relative min-h-0 w-full flex-1"
        style={{ touchAction: "none" }}
        aria-label="Clay Shoot sky"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || clayGame.isOver(state.current)) return;
          const box = board.current?.getBoundingClientRect();
          if (!box) return;
          const { scaleX, scaleY } = clayView({ width: box.width, height: box.height });
          const wx = Math.round((event.clientX - box.left) / scaleX);
          const wy = Math.round((event.clientY - box.top) / scaleY);
          if (wx < 0 || wx > CLAY_W || wy < 0 || wy > CLAY_H) return;
          pending.current.push({ t: 0, k: CLAY_INPUT_SHOT, a: wx, b: wy, c: 0, d: 0 });
        }}
      >
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      {dev ? <p className="truncate font-mono text-[10px] text-muted-foreground">{dev}</p> : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "clayshoot") return null;
  const result = replayClayRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center font-mono text-lg font-bold text-foreground">
        {result.hits} / {result.total} clays · {result.orangeHits} orange · {result.goldHits} gold
      </p>
      <p className="text-center text-base text-muted-foreground">{result.shots} shot{result.shots === 1 ? "" : "s"} · Same clays for everyone</p>
      <p className="font-mono text-base text-primary">{result.score} points</p>
    </div>
  );
}

/** The launch schedule comes from the round's seed; the run is replayed on the server. */
export const clayShootPuzzle: PuzzleDefinition = {
  key: "clayshoot",
  name: "Clay Shoot",
  category: "speed",
  arcadeRun: true,
  timeLimitMs: CLAYSHOOT_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "clayshoot", seed: 1 }) satisfies ClayShootPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
