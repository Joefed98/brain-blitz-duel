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
  tenDropCheckpoint,
  tenDropGame,
  tenDropHolding,
  tdView,
  unpackTdLog,
  TD_CHECKPOINT_INTERVAL,
  TD_COL_W,
  TD_H,
  TD_INPUT_TAP,
  TD_LOG_APPLIED,
  TD_LOG_CLEAR,
  TD_LOG_EMPTY,
  TD_LOG_REFUSED,
  TD_LOG_RESET,
  TD_TARGETS,
  TD_W,
  type TenDropState,
} from "@/lib/arcade/tenDrop";
import { encodeTenDropRun, replayTenDropRun } from "@/lib/duel/tenDrop";
import { TENDROP_TIME_MS, type TenDropPuzzleData } from "@/lib/duel/types";
import { playBlip, playTick, playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const GAME_ROOT_STYLE = { ...NO_SCROLL_STYLE, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as const;

function Hud({ target, total, flash }: { target: number; total: number; flash: "" | "red" | "gold" }) {
  return (
    <div className="relative h-10 w-full shrink-0 font-mono font-bold leading-none">
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 text-2xl text-primary"
        aria-label={`Running total ${total}`}
      >
        {total}
      </div>
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md px-2 text-3xl transition-colors ${
          flash === "gold" ? "bg-primary text-primary-foreground" : "text-foreground"
        }`}
        aria-label={`Target ${target}`}
      >
        {target}
      </div>
    </div>
  );
}

/** Intro: target 20, reached with three digit presses. */
const EXAMPLE = ["7", "6", "7"];
const EXAMPLE_TOTALS = [7, 13, 20];
function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= EXAMPLE.length) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 900 : 800);
    return () => window.clearTimeout(id);
  }, [step]);
  const total = step === 0 ? 0 : EXAMPLE_TOTALS[step - 1]!;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`rounded-lg px-3 font-mono text-3xl font-bold ${step >= 3 ? "bg-primary text-primary-foreground" : ""}`}>20</div>
      <div className="font-mono text-xl font-bold text-primary">{total}</div>
      <div className="flex gap-2">
        {EXAMPLE.map((label, i) => (
          <div
            key={label + i}
            className={`flex h-11 w-12 items-center justify-center rounded-lg border font-mono text-lg font-bold transition-opacity ${
              label.startsWith("×") ? "border-primary text-primary" : "border-border text-foreground"
            } ${i < step ? "opacity-20" : ""}`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

const LOG_NAMES: Record<number, string> = {
  [TD_LOG_APPLIED]: "ok",
  [TD_LOG_REFUSED]: "refused",
  [TD_LOG_RESET]: "reset",
  [TD_LOG_CLEAR]: "clear",
  [TD_LOG_EMPTY]: "miss",
};

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: TenDropPuzzleData | null = puzzle.type === "tendrop" ? puzzle : null;
  const seed = data?.seed ?? 1;

  const wrap = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const state = useRef<TenDropState>(tenDropGame.init(seed));
  const events = useRef<ArcadeInputEvent[]>([]);
  const checkpoints = useRef<ReturnType<typeof tenDropCheckpoint>[]>([]);
  const pending = useRef<ArcadeInputEvent[]>([]);
  const submitted = useRef(false);
  const [hud, setHud] = useState({ target: 0, total: 0, cleared: 0, tick: 0, flash: "" as "" | "red" | "gold" });
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
      encodeTenDropRun({
        seed,
        claimedScore: tenDropGame.score(state.current),
        events: events.current,
        endTick: state.current.tick,
        checkpoints: checkpoints.current,
      }),
      arcadeCounters("tendrop", state.current, tenDropGame.score(state.current)),
    );

  useEffect(() => {
    state.current = tenDropGame.init(seed);
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
    let seenCleared = 0;
    let seenResets = 0;
    let seenRefused = 0;
    let shownKey = "";

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const delta = time - last;
      last = time;
      if (!tenDropGame.isOver(state.current) && !lockedRef.current) {
        accumulator += delta;
        let ticks = Math.floor(accumulator / TICK_MS);
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;
        accumulator -= ticks * TICK_MS;
        for (let i = 0; i < ticks; i++) {
          const queued = pending.current.shift() ?? null;
          const applied = queued ? { ...queued, t: state.current.tick + 1 } : null;
          recordInput(events.current, applied, tenDropGame.inputRanges);
          state.current = tenDropGame.step(state.current, inputAt(events.current, state.current.tick + 1));
          if (state.current.tick % TD_CHECKPOINT_INTERVAL === 0) {
            checkpoints.current.push(tenDropCheckpoint(state.current));
          }
          if (tenDropGame.isOver(state.current)) break;
        }
      }
      const s = state.current;
      if (s.cleared > seenCleared) {
        seenCleared = s.cleared;
        playBlip();
      }
      if (s.resets > seenResets) {
        seenResets = s.resets;
        playWrong();
      }
      if (s.refused > seenRefused) {
        seenRefused = s.refused;
        playTick();
      }
      const flash: "" | "red" | "gold" =
        tenDropHolding(s) ? "gold" : s.tick - s.resetTick < 24 ? "red" : "";
      const target = s.plan.targets[Math.min(s.stage, TD_TARGETS - 1)]!;
      const key = `${target}|${s.total}|${s.cleared}|${Math.ceil((tenDropGame.runTicks - s.tick) / 60)}|${flash}`;
      if (key !== shownKey) {
        shownKey = key;
        setHud({ target, total: s.total, cleared: s.cleared, tick: s.tick, flash });
      }
      if (devOn && s.tick % 6 === 0) {
        const log = s.log
          .slice(-6)
          .map((entry) => {
            const e = unpackTdLog(entry);
            return `${e.tick}:${LOG_NAMES[e.code] ?? e.code}@c${e.extra}`;
          })
          .join(" ");
        setDev(`tick ${s.tick} · target ${s.stage + 1} · queue ${s.queueIndex} · ${log}`);
      }

      reportArcadeTick(s.tick, tenDropGame.isOver(s));
      feedback(s, tenDropGame.isOver(s));
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
          tenDropGame.draw(ctx, s, { width, height });
        }
      }

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }
      if (tenDropGame.isOver(s) && !submitted.current) {
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
    <div ref={wrap} className="flex min-h-0 w-full flex-1 flex-col select-none" style={GAME_ROOT_STYLE}>
      <Hud {...hud} />
      <div
        ref={board}
        data-play-area
        className="relative min-h-0 w-full flex-1"
        style={{ touchAction: "none" }}
        aria-label="Ten Drop board"
        onPointerDown={(event) => {
          event.preventDefault();
          if (locked || submitted.current || tenDropGame.isOver(state.current)) return;
          const box = board.current?.getBoundingClientRect();
          if (!box) return;
          const { scaleX, scaleY } = tdView({ width: box.width, height: box.height });
          const wx = (event.clientX - box.left) / scaleX;
          const wy = (event.clientY - box.top) / scaleY;
          if (wx < 0 || wx > TD_W || wy < 0 || wy > TD_H) return;
          const col = Math.min(3, Math.max(0, Math.floor(wx / TD_COL_W)));
          pending.current.push({ t: 0, k: TD_INPUT_TAP, a: col, b: Math.round(wy), c: 0, d: 0 });
        }}
      >
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      {dev ? <p className="truncate font-mono text-[10px] text-muted-foreground">{dev}</p> : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "tendrop") return null;
  const result = replayTenDropRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-center font-mono text-lg font-bold text-foreground">
        {result.cleared} / {TD_TARGETS} targets · {result.resets} reset{result.resets === 1 ? "" : "s"}
      </p>
      <p className="text-center text-base text-muted-foreground">Same targets and tiles for everyone</p>
    </div>
  );
}

/** Targets and tile queues come from the round's seed; the run is replayed on the server. */
export const tenDropPuzzle: PuzzleDefinition = {
  key: "tendrop",
  name: "Ten Drop",
  category: "number",
  arcadeRun: true,
  timeLimitMs: TENDROP_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "tendrop", seed: 1 }) satisfies TenDropPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
