import { ArcadeArenaSlot } from "@/components/puzzles/ArcadeArenaSlot";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useArcadeFrameTiming } from "@/components/puzzles/useArcadeFrameTiming";
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
  tenDropInit,
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
import { playCorrect, playTick, playWrong } from "@/lib/sound";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { drawTenDropLive, tenDropArenaScene } from "@/lib/arcade/tenDrop.renderer";
import "@/polish-layout/batch-w-tendrop.css";
import "@/polish-layout/polish-nov3-number.css";
import { HudPills } from "@/components/puzzles/HudPills";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { arcadeCanvasRatio } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame } from "@/lib/battery";

const GAME_ROOT_STYLE = { ...NO_SCROLL_STYLE, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as const;

/** Toybox look (Number polish, Oct 2026): the HUD plank, its pegs and the effects. Presentation only. */
const TD_CSS = `
[data-polish="tendrop"] .td-hud { background: linear-gradient(180deg, #5A3A20, #3E2716); border: 2px solid #2B1A0E; border-bottom: 3px solid #D4A84A; border-radius: 12px 12px 0 0; box-shadow: inset 0 1px 0 rgba(255,230,180,0.25); }
[data-polish="tendrop"] .td-label { font-family: 'Space Grotesk', 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; line-height: 1; color: rgba(255,244,222,0.85); }
[data-polish="tendrop"] .td-total { color: #F7CF63; display: inline-block; }
[data-polish="tendrop"] .td-total[data-flash="red"] { color: #FF8A73; animation: td-shake 240ms ease-out; }
[data-polish="tendrop"] .td-plaque { background: linear-gradient(180deg, #FBEFD5, #E9D2A4); color: #2B1A0E; border: 2px solid #9C7444; border-radius: 10px; box-shadow: 0 2px 0 #2B1A0E, inset 0 1px 0 rgba(255,255,255,0.6); transition: background-color 200ms; }
[data-polish="tendrop"] .td-plaque[data-hit="1"] { background: linear-gradient(180deg, #FFE08A, #F2B63C); border-color: #8A6420; }
[data-polish="tendrop"] .td-bump { display: inline-block; animation: td-bump 200ms ease-out; }
[data-polish="tendrop"] .td-peg { width: 10px; height: 10px; border-radius: 50%; background: #2B1A0E; box-shadow: inset 0 1px 2px rgba(0,0,0,0.7), 0 1px 0 rgba(255,230,180,0.18); }
[data-polish="tendrop"] .td-peg[data-on="1"] { background: radial-gradient(circle at 35% 35%, #FFF1B8, #D4A84A 60%, #8A6420); box-shadow: 0 0 0 1px #2B1A0E; }
[data-polish="tendrop"] .td-peg[data-new="1"] { animation: td-peg 240ms ease-out; }
[data-polish="tendrop"] .td-board { border-radius: 0 0 12px 12px; overflow: hidden; background: #C99A62; box-shadow: 0 0 0 2px #2B1A0E; }
[data-polish="tendrop"][data-solve="1"] .td-plaque { animation: td-glint 900ms ease-out; }
[data-polish="tendrop"][data-solve="1"] .td-peg { animation: td-glint 900ms ease-out; }
@keyframes td-bump { from { transform: scale(1.2); } to { transform: scale(1); } }
@keyframes td-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes td-peg { from { transform: scale(1.6); } to { transform: scale(1); } }
@keyframes td-glint { 0% { box-shadow: 0 0 0 0 rgba(255,217,120,0.9); transform: scale(1); } 30% { box-shadow: 0 0 14px 4px rgba(255,217,120,0.8); transform: scale(1.06); } 100% { box-shadow: 0 0 0 0 rgba(255,217,120,0); transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  [data-polish="tendrop"] .td-total[data-flash="red"], [data-polish="tendrop"] .td-bump, [data-polish="tendrop"] .td-peg[data-new="1"],
  [data-polish="tendrop"][data-solve="1"] .td-plaque, [data-polish="tendrop"][data-solve="1"] .td-peg { animation: none; }
  [data-polish="tendrop"][data-solve="1"] .td-plaque { box-shadow: 0 0 0 3px #FFD978; }
}
.td-intro-tile { background: linear-gradient(180deg, #FBEFD5, #E9D2A4); color: #2B1A0E; border: 2px solid #9C7444; box-shadow: 0 2px 0 rgba(43,26,14,0.5); }
.td-intro-plaque { background: linear-gradient(180deg, #FBEFD5, #E9D2A4); color: #2B1A0E; border: 2px solid #9C7444; }
.td-intro-plaque[data-hit="1"] { background: linear-gradient(180deg, #FFE08A, #F2B63C); border-color: #8A6420; }
`;

/**
 * Puzzle polish (3 Nov 2026, Joe's audit; display only): the HUD is three label-and-value pills, "Total 8",
 * "Target 25" and the cleared pegs, instead of the plank's "TOTAL 8" beside an unlabelled "25" plaque.
 * Where the world is narrower than its slot is tall (an iPhone 11), the plank sits in the strip under the
 * world that used to be bare wood (`place="below"`); otherwise it stays above the board, a little slimmer.
 */
function Hud({ target, total, cleared, flash, place, top }: { target: number; total: number; cleared: number; flash: "" | "red" | "gold"; place: "above" | "below"; top?: number }) {
  return (
    <div
      className="td-hud td-hud-v3"
      data-place={place}
      style={place === "below" ? { top } : undefined}
    >
      <HudPills
        testId="tendrop"
        className="td-pills"
        items={[
          {
            id: "total",
            label: "Total",
            value: (
              <span className="td-total" data-flash={flash === "red" ? "red" : undefined} aria-label={`Running total ${total}`}>
                <span key={total} className="td-bump">{total}</span>
              </span>
            ),
          },
          {
            id: "target",
            label: "Target",
            tone: "gold",
            value: (
              <span className="td-target" data-hit={flash === "gold" ? "1" : undefined} aria-label={`Target ${target}`}>
                <span key={target} className="td-bump">{target}</span>
              </span>
            ),
          },
          {
            id: "cleared",
            label: (
              <span className="td-pegs" aria-hidden="true">
                {Array.from({ length: TD_TARGETS }, (_, i) => (
                  <span key={i} className="td-peg" data-on={i < cleared ? "1" : undefined} data-new={i === cleared - 1 ? "1" : undefined} />
                ))}
              </span>
            ),
            value: <span aria-label={`Targets cleared ${cleared} of ${TD_TARGETS}`}>{cleared}/{TD_TARGETS}</span>,
          },
        ]}
      />
    </div>
  );
}

/** The plank's height under the world; it moves there only when the strip below the world is at least this tall. */
const TD_HUD_BELOW_H = 56;

/** Where the HUD goes: under the world when the root is tall enough to show the whole width-fitted world above it. */
function useHudPlace(root: React.RefObject<HTMLDivElement | null>): { place: "above" | "below"; top: number } {
  const [layout, setLayout] = useState<{ place: "above" | "below"; top: number }>({ place: "above", top: 0 });
  useBeforePaint(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const worldH = Math.floor((w * TD_H) / TD_W);
      const next = w > 0 && h - worldH >= TD_HUD_BELOW_H ? { place: "below" as const, top: worldH } : { place: "above" as const, top: 0 };
      setLayout((prev) => (prev.place === next.place && prev.top === next.top ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);
  return layout;
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
      <PolishStyle id="tendrop" css={TD_CSS} />
      <div className="td-intro-plaque rounded-lg px-3 font-mono text-3xl font-bold" data-hit={step >= 3 ? "1" : undefined}>20</div>
      <div className="font-mono text-xl font-bold text-primary">{total}</div>
      <div className="flex gap-2">
        {EXAMPLE.map((label, i) => (
          <div
            key={label + i}
            className={`td-intro-tile flex h-11 w-12 items-center justify-center rounded-lg font-mono text-lg font-bold transition-opacity ${i < step ? "opacity-20" : ""}`}
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
  // The stored score revision rides in the sim state, so the phone's claim matches the server's replay.
  const scoreRev = data?.tenRev;

  const wrap = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const frameTiming = useArcadeFrameTiming(canvas);
  const state = useRef<TenDropState>(tenDropInit(seed, scoreRev));
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
    state.current = tenDropInit(seed, scoreRev);
    events.current = [];
    checkpoints.current = [];
    pending.current = [];
    submitted.current = false;
  }, [seed, scoreRev]);

  useEffect(() => {
    if (!data) return;
    const devOn = devDiagnosticsOn();
    let frame = 0;
    resetArcadeClock();
    let last = performance.now();
    let accumulator = 0;
    let draftAt = 0;
    const feedback = arcadeFeedback({
      game: "tendrop",
      completeCue: (s) =>
        (s as { cleared: number }).cleared >= TD_TARGETS ? "tendrop.solve" : null,
    });
    let seenCleared = 0;
    let seenResets = 0;
    let seenRefused = 0;
    let seenGold = 0;
    let seenStage = 0;
    let seenLogTick = 0;
    let shownKey = "";

    const loop = (time: number) => {
      frameTiming.begin(time);
      frame = arenaFrame(loop);
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
        playCorrect();
        soundCue("tendrop.clear");
      }
      // tenRev 4: a ten made by the gold tile adds the moment cue over the clear (an existing cue, no new audio).
      if ((s.goldTens ?? 0) > seenGold) {
        seenGold = s.goldTens ?? 0;
        soundCue("tendrop.ten");
      }
      if (s.resets > seenResets) {
        seenResets = s.resets;
        playWrong();
        soundCue("tendrop.reset");
      }
      if (s.refused > seenRefused) {
        seenRefused = s.refused;
        playTick();
        soundCue("tendrop.refused");
      }
      // The next target: the old lane's tiles fade out.
      if (s.stage > seenStage) {
        seenStage = s.stage;
        if (!tenDropGame.isOver(s)) soundCue("tendrop.nextTarget");
      }
      for (const entry of s.log) {
        const e = unpackTdLog(entry);
        if (e.tick <= seenLogTick) continue;
        seenLogTick = e.tick;
        if (e.code === TD_LOG_APPLIED) soundCue("tendrop.apply");
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
      frameTiming.draw();
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
        if (ctx) drawTenDropLive(ctx, s, { width, height }, ratio, time);
      }

      frameTiming.rendered();

      if (!submitted.current && time - draftAt >= 500) {
        draftAt = time;
        draftRef.current?.(encode());
      }
      if (tenDropGame.isOver(s) && !submitted.current) {
        submitted.current = true;
        submitRef.current(encode());
      }
      frameTiming.end();
    };
    frame = arenaFrame(loop);
    return () => cancelArenaFrame(loop, frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, data]);

  const solveFx = useSolveFx(hud.cleared >= TD_TARGETS, "tendrop.solve");
  const hudPlace = useHudPlace(wrap);

  if (!data) return null;

  return (
    <div ref={wrap} data-polish="tendrop" data-solve={solveFx ? "1" : undefined} data-stage-column="0" className="relative flex min-h-0 w-full flex-1 flex-col select-none" style={GAME_ROOT_STYLE}>
      <PolishStyle id="tendrop" css={TD_CSS} />
      {hudPlace.place === "above" ? <Hud target={hud.target} total={hud.total} cleared={hud.cleared} flash={hud.flash} place="above" /> : null}
      {/* The world at its own aspect, largest fit, top-anchored (15 Oct 2026, display only; tdView maps through this box). */}
      <ArcadeArenaSlot width={TD_W} height={TD_H} scene={tenDropArenaScene}>
      <div
        ref={board}
        data-play-area
        data-game-arena="canvas" className="td-board relative min-h-0 w-full flex-1"
        style={{ touchAction: "none" }}
        aria-label={`${gameDisplayName("tendrop")} board`}
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
      </ArcadeArenaSlot>
      {hudPlace.place === "below" ? <Hud target={hud.target} total={hud.total} cleared={hud.cleared} flash={hud.flash} place="below" top={hudPlace.top} /> : null}
      {dev ? <p className="truncate font-mono text-[10px] text-muted-foreground">{dev}</p> : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "tendrop") return null;
  const result = replayTenDropRun(puzzle.seed, myAnswer ?? "", puzzle.tenRev);
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
  name: gameDisplayName("tendrop"),
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
