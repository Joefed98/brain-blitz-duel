import { gameDisplayName } from "@/lib/duel/gameNames";
import { useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { StageCorrect, useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import { StageProgress } from "@/components/puzzles/StageProgress";
import {
  decodeMeasureActions,
  encodeMeasureRound,
  measureApply,
  replayMeasure,
  splitMeasureRound,
  MEASURE_BOARDS,
  type MeasureAction,
} from "@/lib/duel/measure";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { limitText, measureMoveLimits } from "@/lib/duel/moveLimits";
import { MEASURE_TIME_MS, type MeasureBoardData, type MeasurePuzzleData } from "@/lib/duel/types";
import { useReducedMotion } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { GoalLineContext } from "@/components/duel/GameFrame";
import { HudPills } from "@/components/puzzles/HudPills";
import { usesNumberDepth } from "@/lib/duel/numberDepth";
import "@/polish-layout/batch-w-measure.css";
import { StepChips } from "@/components/puzzles/number/StepChips";

/** iOS: no text selection or callout on long presses anywhere in the game. */
const ROOT_STYLE: CSSProperties = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
};
/** Water level easing per move (transform only). */
const LEVEL_MS = 260;
/** Lifetime of a pour or tap stream. */
const FLOW_MS = 320;
/** Completion: ripples and sparkles at the target line. */
const SOLVE_MS = 1100;
/** Room above the jugs for the pour stream's arc. */
const STREAM_TOP = 22;
const NO_ACTIONS: MeasureAction[] = [];

/* Number polish (13 Oct 2026): display only. Clear glass, moving water, litre marks. */
const WAVE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="6" viewBox="0 0 40 6"><path d="M0 2 Q10 -1.6 20 2 T40 2 V6 H0 Z" fill="#000"/></svg>',
)}")`;
/** Completion sparkles around the target line: x in % of the jug, y px above the line, size, delay. */
const SPARKS: { x: number; y: number; s: number; d: number }[] = [
  { x: 8, y: 12, s: 14, d: 0 },
  { x: 30, y: -10, s: 11, d: 120 },
  { x: 52, y: 20, s: 16, d: 60 },
  { x: 74, y: -8, s: 12, d: 180 },
  { x: 94, y: 10, s: 14, d: 90 },
  { x: 20, y: 30, s: 10, d: 260 },
  { x: 84, y: 32, s: 10, d: 320 },
];
export const MEASURE_CSS = `
[data-polish="measure"] { --mj-water: var(--measure-water); --mj-water-top: color-mix(in oklab, var(--measure-water) 62%, white); --mj-water-deep: color-mix(in oklab, var(--measure-water) 72%, #001433); }
[data-puzzle-surface] [data-polish="measure"] [data-measure-jug][data-puzzle-cell] { box-shadow: none !important; background: transparent !important; border-radius: 0 !important; }
/* The shared [data-polish] rule sizes the arena to its content; the jugs are fitted to the arena’s height, so it must fill instead. */
.game-column [data-polish="measure"][data-play-area] > [data-game-arena] { flex: 1 1 0; max-height: none; }
[data-polish="measure"] [data-game-arena] { background: radial-gradient(ellipse 70% 55% at 50% 62%, rgba(120, 175, 255, 0.07), transparent 70%); }
[data-polish="measure"] .mj-glass {
  position: absolute; inset: 0; overflow: hidden; border: 2px solid var(--measure-glass-edge); border-top-color: rgba(232, 242, 255, 0.85);
  border-radius: 5px 5px 16px 16px;
  background: linear-gradient(90deg, rgba(210, 230, 255, 0.14), rgba(210, 230, 255, 0.045) 22%, rgba(210, 230, 255, 0.02) 62%, rgba(210, 230, 255, 0.1));
  box-shadow: 0 10px 14px -10px rgba(0, 0, 0, 0.75), inset 0 -8px 12px -6px rgba(170, 210, 255, 0.12);
  transition: box-shadow 150ms ease-out, border-color 150ms ease-out;
}
[data-polish="measure"] .mj-glass[data-selected] { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary), 0 0 18px -2px color-mix(in oklab, var(--primary) 60%, transparent); }
[data-polish="measure"] .mj-glass::before { content: ""; position: absolute; z-index: 3; top: 5px; bottom: 9px; right: 13%; width: 5px; border-radius: 3px; pointer-events: none;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.12) 55%, rgba(255, 255, 255, 0.03)); }
[data-polish="measure"] .mj-glass::after { content: ""; position: absolute; z-index: 3; top: 8px; bottom: 14px; right: 25%; width: 2px; border-radius: 2px; pointer-events: none;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.22), transparent); }
[data-polish="measure"] .mj-water { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1; transform-origin: 50% 100%; will-change: transform;
  background: linear-gradient(to bottom, var(--mj-water-top), var(--mj-water) 38%, var(--mj-water-deep));
  box-shadow: inset 6px 0 8px -4px rgba(255, 255, 255, 0.18), inset -6px 0 8px -4px rgba(0, 20, 60, 0.35);
  transition: transform ${LEVEL_MS}ms cubic-bezier(0.3, 0.7, 0.4, 1); }
[data-polish="measure"] .mj-surface { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; z-index: 1; overflow: hidden; will-change: transform;
  transition: transform ${LEVEL_MS}ms cubic-bezier(0.3, 0.7, 0.4, 1), opacity 120ms linear; }
[data-polish="measure"] .mj-wave { position: absolute; left: 0; top: 0; height: 6px; width: calc(100% + 40px); background: var(--mj-water-top);
  -webkit-mask: ${WAVE_MASK} repeat-x 0 0 / 40px 6px; mask: ${WAVE_MASK} repeat-x 0 0 / 40px 6px; animation: mj-wave 2.4s linear infinite; will-change: transform; }
[data-polish="measure"] .mj-wave-back { top: -1px; opacity: 0.5; background: color-mix(in oklab, var(--mj-water-top) 70%, white); animation-duration: 3.7s; animation-direction: reverse; }
@keyframes mj-wave { from { transform: translateX(0); } to { transform: translateX(-40px); } }
[data-polish="measure"] .mj-ticks { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
[data-polish="measure"] .mj-tick { position: absolute; left: 0; display: flex; align-items: center; color: rgba(236, 244, 255, 0.9); text-shadow: 0 1px 1px rgba(0, 10, 30, 0.6); }
[data-polish="measure"] .mj-tick > i { display: block; height: 2px; border-radius: 0 1px 1px 0; background: currentColor; box-shadow: 0 1px 0 rgba(0, 10, 30, 0.35); }
[data-polish="measure"] .mj-tick-r { position: absolute; right: 0; width: 5px; height: 1px; background: rgba(236, 244, 255, 0.4); }
[data-polish="measure"] .mj-line { position: absolute; left: 0; right: 0; z-index: 2; pointer-events: none; height: 0; border-top: 3px dashed var(--primary);
  filter: drop-shadow(0 0 3px color-mix(in oklab, var(--primary) 60%, transparent)); }
[data-polish="measure"] .mj-stream { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; z-index: 5; }
[data-polish="measure"] .mj-stream .mj-flow { stroke-dasharray: 1 1; stroke-dashoffset: 1; animation: mj-flow ${FLOW_MS}ms ease-out forwards; }
[data-polish="measure"] .mj-stream .mj-splash { transform-box: fill-box; transform-origin: center; opacity: 0; animation: mj-splash ${FLOW_MS - 90}ms ease-out 90ms forwards; }
[data-polish="measure"] .mj-stream .mj-nozzle { opacity: 0; animation: mj-fade ${FLOW_MS}ms ease-out forwards; }
@keyframes mj-flow { 0% { stroke-dashoffset: 1; opacity: 1; } 45% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes mj-splash { 0% { opacity: 0.9; transform: scale(0.3); } 100% { opacity: 0; transform: scale(1.6); } }
@keyframes mj-fade { 0%, 60% { opacity: 1; } 100% { opacity: 0; } }
[data-polish="measure"] .mj-fx { position: absolute; inset: 0; pointer-events: none; z-index: 4; }
[data-polish="measure"] .mj-ripple { position: absolute; left: 4%; width: 92%; height: 12px; margin-bottom: -6px; border-radius: 50%;
  border: 3px solid color-mix(in oklab, var(--primary) 40%, white); box-shadow: 0 0 8px color-mix(in oklab, var(--primary) 70%, transparent); opacity: 0; animation: mj-ripple 820ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards; }
@keyframes mj-ripple { 0% { opacity: 0.95; transform: scale(0.2, 0.4); } 100% { opacity: 0; transform: scale(1.15, 1.6); } }
[data-polish="measure"] .mj-spark { position: absolute; margin: 0 0 -7px -7px; opacity: 0; background: radial-gradient(circle, #fff 0 30%, var(--primary) 65%);
  clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); animation: mj-spark 640ms ease-out forwards; }
@keyframes mj-spark { 0% { opacity: 0; transform: scale(0) rotate(0deg); } 35% { opacity: 1; transform: scale(1.15) rotate(40deg); } 100% { opacity: 0; transform: scale(0.4) rotate(90deg); } }
[data-polish="measure"] .mj-glass[data-solved] { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in oklab, var(--primary) 70%, transparent), 0 0 22px -2px color-mix(in oklab, var(--primary) 55%, transparent); }
[data-polish="measure"] .mj-glass[data-solved] .mj-line { border-top-style: solid; }
[data-polish="measure"] .mj-amount { font-size: 17px; font-weight: 600; color: var(--foreground); }
[data-polish="measure"] .mj-amount[data-hit] { color: var(--primary); font-weight: 700; }
[data-polish="measure"] .mj-cap { font-size: 14px; color: rgba(220, 228, 240, 0.78); }
[data-polish="measure"] .mj-row { border-left: 3px solid var(--measure-water); background: rgba(120, 175, 255, 0.05); }
[data-polish="measure"] .mj-row[data-solved] { border-left-color: var(--primary); }
[data-polish="measure"] .mj-par { color: #F5B82E; font-weight: 700; }
[data-polish="measure"] .mj-dim { color: rgba(220, 228, 240, 0.8); }
@media (prefers-reduced-motion: reduce) {
  [data-polish="measure"] .mj-water, [data-polish="measure"] .mj-surface, [data-polish="measure"] .mj-glass { transition: none; }
  [data-polish="measure"] .mj-wave, [data-polish="measure"] .mj-ripple, [data-polish="measure"] .mj-spark { animation: none; }
  [data-polish="measure"] .mj-ripple, [data-polish="measure"] .mj-spark, [data-polish="measure"] .mj-stream { display: none; }
}
`;

/** A stream for the last move: a pour from jug to jug, or the tap filling a jug. */
type Flow = { kind: "pour"; from: number; to: number; id: number } | { kind: "fill"; to: number; id: number };

function goalText(board: MeasureBoardData): string {
  if (board.goal === "split") return `Make ${(board.split ?? []).join(" · ")}`;
  return `Make ${board.target} L in any jug`;
}

/** Litres each jug should hold for the target line: the target on every jug, or each jug's share of the split. */
function targetLines(board: MeasureBoardData): (number | null)[] {
  if (board.goal === "split") return board.caps.map((_, jug) => board.split?.[jug] ?? null);
  return board.caps.map((cap) =>
    board.target !== undefined && board.target <= cap ? board.target : null,
  );
}

/**
 * The stream overlay: an arc from the source jug's lip into the destination's water,
 * or a falling column from the tap. Drawn once per move (keyed) and fades on its own.
 */
function Stream({
  flow,
  caps,
  amounts,
  litre,
  width,
  gap,
  tall,
}: {
  flow: Flow;
  caps: readonly number[];
  amounts: readonly number[];
  litre: number;
  width: number;
  gap: number;
  tall: number;
}) {
  const W = caps.length * width + (caps.length - 1) * gap;
  const H = STREAM_TOP + tall + 26;
  const cx = (i: number) => i * (width + gap) + width / 2;
  const rim = (i: number) => STREAM_TOP + tall + 2 - (caps[i] ?? 0) * litre;
  const surface = (i: number) => STREAM_TOP + tall - (amounts[i] ?? 0) * litre;
  let d: string;
  let end: { x: number; y: number };
  let nozzle: number | null = null;
  if (flow.kind === "pour") {
    const dir = flow.to > flow.from ? 1 : -1;
    const sx = cx(flow.from) + dir * width * 0.42;
    const sy = rim(flow.from) + 2;
    const ex = cx(flow.to) - dir * width * 0.12;
    const top = Math.max(2, Math.min(rim(flow.from), rim(flow.to)) - 24);
    const ey = Math.max(rim(flow.to) + 4, surface(flow.to));
    d = `M ${sx} ${sy} Q ${(sx + ex) / 2} ${top} ${ex} ${rim(flow.to) - 2} L ${ex} ${ey}`;
    end = { x: ex, y: ey };
  } else {
    const x = cx(flow.to);
    const ey = Math.max(rim(flow.to) + 4, surface(flow.to));
    d = `M ${x} 4 L ${x} ${ey}`;
    end = { x, y: ey };
    nozzle = x;
  }
  return (
    <svg aria-hidden="true" className="mj-stream" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {nozzle !== null ? (
        <rect className="mj-nozzle" x={nozzle - 8} y={0} width={16} height={6} rx={3} fill="rgba(210,225,245,0.85)" />
      ) : null}
      <path className="mj-flow" pathLength={1} d={d} fill="none" stroke="var(--mj-water)" strokeWidth={5} strokeLinecap="round" />
      <path className="mj-flow" pathLength={1} d={d} fill="none" stroke="var(--mj-water-top)" strokeWidth={1.8} strokeLinecap="round" />
      <ellipse className="mj-splash" cx={end.x} cy={end.y} rx={width * 0.22} ry={3} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
    </svg>
  );
}

/**
 * Glass jugs on one shared litre scale, so a target line sits at the same
 * height on every jug. Water levels ease between amounts (transform only, under a
 * gently moving surface); the pour stream arcs from the source jug to the
 * destination while it runs. Each jug's button is exactly its drawn glass plus label.
 */
export function Jugs({
  board,
  amounts,
  litre,
  width,
  selected,
  shake,
  flow,
  celebrate,
  onJug,
}: {
  board: MeasureBoardData;
  amounts: readonly number[];
  /** Pixels per litre. */
  litre: number;
  width: number;
  selected?: number | null;
  shake?: number | null;
  flow?: Flow | null;
  /** Completion effect on the solved jugs at their target line. */
  celebrate?: "move" | "static" | null;
  onJug?: ((jug: number) => void) | undefined;
}) {
  const lines = targetLines(board);
  const maxCap = Math.max(...board.caps);
  const tall = maxCap * litre;
  const small = litre < 9;
  const gap = Math.max(10, Math.round(width * 0.28));
  const tickFont = Math.min(12, Math.max(8, litre * 0.8));
  return (
    <div className="relative flex items-end justify-center" style={{ gap, paddingTop: STREAM_TOP }}>
      {board.caps.map((cap, jug) => {
        const height = cap * litre;
        const amount = amounts[jug] ?? 0;
        const line = lines[jug];
        const isSelected = selected === jug;
        const hit = measureSolvedJug(board, amount, jug);
        const party = celebrate && hit && line !== null && line !== undefined ? celebrate : null;
        // The water body's top sits 2 px under the level so the wave's crests and troughs average on it.
        const body = amount > 0 ? Math.max(0, amount * litre - 2) / height : 0;
        const marks = Array.from({ length: cap - 1 }, (_, i) => i + 1);
        return (
          <button
            key={jug}
            type="button"
            data-puzzle-cell={jug}
            data-measure-jug={jug}
            disabled={!onJug}
            onClick={() => onJug?.(jug)}
            aria-label={`Jug ${jug + 1}: ${amount} of ${cap} litres`}
            className={`relative flex flex-col items-center justify-end transition-transform duration-150 ${isSelected ? "-translate-y-2" : ""} ${shake === jug ? "animate-shake" : ""}`}
            style={{ width, height: tall + 26 }}
          >
            <div className="relative w-full" style={{ height }}>
              <div
                className="mj-glass"
                data-selected={isSelected ? "" : undefined}
                data-solved={party ? "" : undefined}
              >
                {/* Body scales from the bottom and the surface strip rides up, so nothing ever lies outside the glass. */}
                <div className="mj-water" style={{ height, transform: `scaleY(${body})` }} />
                <div
                  className="mj-surface"
                  style={{ transform: `translateY(${4 - amount * litre}px)`, opacity: amount > 0 ? 1 : 0 }}
                >
                  <span className="mj-wave mj-wave-back" />
                  <span className="mj-wave" />
                </div>
                {/* Litre markings: a tick every litre, a number every litre (every other on small jugs). */}
                <div className="mj-ticks">
                  {marks.map((l) => (
                    <div key={l} className="mj-tick" style={{ bottom: l * litre - 1 }}>
                      <i style={{ width: l % 5 === 0 ? 12 : 7 }} />
                      {!small || l % 2 === 0 ? (
                        <span
                          className="ml-0.5 font-mono leading-none"
                          style={{ fontSize: tickFont, transform: "translateY(0.5px)" }}
                        >
                          {l}
                        </span>
                      ) : null}
                    </div>
                  ))}
                  {marks.map((l) => (
                    <span key={`r${l}`} className="mj-tick-r" style={{ bottom: l * litre - 0.5 }} />
                  ))}
                </div>
                {line !== null && line !== undefined ? (
                  <div data-measure-target className="mj-line" style={{ bottom: line * litre - 1.5 }} />
                ) : null}
                {party === "move" ? (
                  <div className="mj-fx" aria-hidden="true">
                    {[0, 200, 400].map((delay) => (
                      <span
                        key={delay}
                        className="mj-ripple"
                        style={{ bottom: (line ?? 0) * litre, animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              {party === "move" ? (
                <div className="mj-fx" aria-hidden="true">
                  {SPARKS.map((sp, i) => (
                    <span
                      key={i}
                      className="mj-spark"
                      style={{
                        left: `${sp.x}%`,
                        bottom: (line ?? 0) * litre + sp.y,
                        width: sp.s,
                        height: sp.s,
                        animationDelay: `${sp.d + jug * 70}ms`,
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <span className="mt-1 h-5 font-mono leading-5">
              <span className="mj-amount" data-hit={hit ? "" : undefined}>
                {amount}
              </span>
              <span className="mj-cap">/{cap}</span>
            </span>
          </button>
        );
      })}
      {flow ? (
        <Stream
          key={flow.id}
          flow={flow}
          caps={board.caps}
          amounts={amounts}
          litre={litre}
          width={width}
          gap={gap}
          tall={tall}
        />
      ) : null}
    </div>
  );
}

function measureSolvedJug(board: MeasureBoardData, amount: number, jug: number): boolean {
  if (board.goal === "split") return board.split?.[jug] === amount;
  return amount === board.target;
}

/** Fixed example: jugs of 5 and 3, make 4. Fill 5, pour, empty 3, pour, fill 5, pour. */
const EXAMPLE_BOARD: MeasureBoardData = {
  caps: [5, 3],
  start: [0, 0],
  tap: true,
  goal: "amount",
  target: 4,
};
const EXAMPLE_STEPS: { amounts: number[]; label: string }[] = [
  { amounts: [0, 0], label: "Make 4 L" },
  { amounts: [5, 0], label: "Fill the 5" },
  { amounts: [2, 3], label: "Pour 5 → 3" },
  { amounts: [2, 0], label: "Empty the 3" },
  { amounts: [0, 2], label: "Pour 5 → 3" },
  { amounts: [5, 2], label: "Fill the 5" },
  { amounts: [4, 3], label: "Pour 5 → 3: 4 L!" },
];
/** The stream drawn for each example step (display only). */
const EXAMPLE_FLOWS: (Flow | null)[] = EXAMPLE_STEPS.map((step, i) => {
  const prev = EXAMPLE_STEPS[i - 1]?.amounts;
  if (!prev) return null;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const up = step.amounts.findIndex((v, j) => v > prev[j]!);
  const down = step.amounts.findIndex((v, j) => v < prev[j]!);
  if (up >= 0 && down >= 0 && sum(step.amounts) === sum(prev)) return { kind: "pour", from: down, to: up, id: i };
  if (up >= 0 && down < 0) return { kind: "fill", to: up, id: i };
  return null;
});

function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % (EXAMPLE_STEPS.length + 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const index = Math.min(step, EXAMPLE_STEPS.length - 1);
  const shown = EXAMPLE_STEPS[index]!;
  return (
    <div className="flex flex-col items-center gap-2" style={ROOT_STYLE} data-polish="measure">
      <PolishStyle id="measure" css={MEASURE_CSS} />
      <Jugs
        board={EXAMPLE_BOARD}
        amounts={shown.amounts}
        litre={14}
        width={52}
        flow={step === index ? (EXAMPLE_FLOWS[index] ?? null) : null}
      />
      <p className="h-5 font-mono text-sm text-primary">{shown.label}</p>
      <p className="max-w-[270px] text-center text-xs text-muted-foreground">
        Six moves. Every fill, empty and pour counts. Puzzle 4 has no tap: share out what’s
        there.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "measure",
}: PuzzleStageProps) {
  const data: MeasurePuzzleData | null = puzzle.type === "measure" ? puzzle : null;
  // Batch W: in a live round the goal line shows "Stage n of 3", so the row drops its "Puzzle n of 3".
  const framed = Boolean(useContext(GoalLineContext));
  const [stage, setStage] = useStageState<number>(stateKey, "measureStage", () => 0);
  const [allActions, setAllActions] = useStageState<MeasureAction[][]>(
    stateKey,
    "measureActions",
    () => Array.from({ length: MEASURE_BOARDS }, () => []),
  );
  const [selected, setSelected] = useStageState<number | null>(
    stateKey,
    "measureSelected",
    () => null,
  );
  const [shake, setShake] = useState<number | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const flowId = useRef(0);
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 360, height: 420 });
  const reduced = useReducedMotion();

  const board = data?.boards[Math.min(stage, MEASURE_BOARDS - 1)];
  const actions = allActions[stage] ?? NO_ACTIONS;
  // measureRev 2 (moveLimits.ts): a generous visible move limit per puzzle; running out ends the run unfinished.
  const moveLimit = data ? (measureMoveLimits(data)?.[Math.min(stage, MEASURE_BOARDS - 1)] ?? null) : null;
  const replay = useMemo(() => (board ? replayMeasure(board, actions, moveLimit) : null), [board, actions, moveLimit]);
  // depthRev 1, par pours: this puzzle's fewest moves (public on the depth stamp); at or under it is a par solve.
  const par = data && usesNumberDepth(data) ? (data.par?.[Math.min(stage, MEASURE_BOARDS - 1)] ?? null) : null;
  const encoded = encodeMeasureRound(allActions);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);
  useBeforePaint(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    measure();
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!flow) return;
    const timer = setTimeout(() => setFlow((f) => (f === flow ? null : f)), FLOW_MS);
    return () => clearTimeout(timer);
  }, [flow]);

  const complete = replay?.solved ?? false;
  const outOfMoves = replay?.outOfMoves ?? false;
  useEffect(() => {
    // Out of moves: puzzles are played in order, so the run ends here and goes in now.
    if (!outOfMoves || locked || submitted.current) return;
    submitted.current = true;
    setSelected(null);
    onSubmit(encodeMeasureRound(allActions));
  }, [outOfMoves, locked, allActions, onSubmit, setSelected]);
  // Completion effect: only when the last board (the whole puzzle) is solved.
  const solveFx = useSolveFx(complete && stage >= MEASURE_BOARDS - 1, "measure.solve", SOLVE_MS);
  const advance = () => {
    setSelected(null);
    if (stage >= MEASURE_BOARDS - 1) {
      submitted.current = true;
      onSubmit(encodeMeasureRound(allActions));
      return;
    }
    setFlow(null);
    setStage(stage + 1);
  };
  const holding = useStageCorrectHold({
    complete,
    finalStage: stage >= MEASURE_BOARDS - 1,
    locked: locked || submitted.current,
    stateKey,
    onAdvance: () => {
      playCorrect();
      advance();
    },
  });

  // Desktop keys: 1–n tap jugs 1–n (left to right), F = Fill, E = Empty (boards with a tap), R = Reset.
  useGameKeys((kind, key, event) => {
    if (!data || !board || !replay) return false;
    const jug = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
    const used = (jug >= 0 && jug < board.caps.length) || (board.tap && (key === "f" || key === "e")) || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (jug >= 0) {
      if (!busy) tapJug(jug);
    } else if (key === "r") {
      if (!(busy || atStart)) reset();
    } else if (key === "f") {
      if (!(busy || selected === null || (replay.amounts[selected] ?? 0) >= (board.caps[selected] ?? 0))) fillOrEmpty("fill");
    } else if (!(busy || selected === null || (replay.amounts[selected] ?? 0) <= 0)) fillOrEmpty("empty");
    return true;
  });

  if (!data || !board || !replay) return null;
  const busy = locked || submitted.current || complete || outOfMoves;

  const reject = (jug: number) => {
    setShake(jug);
    playWrong();
    soundCue("measure.reject");
    setTimeout(() => setShake(null), 320);
  };
  const act = (action: MeasureAction): boolean => {
    if (busy) return false;
    if (!measureApply(board, replay.amounts, action)) return false;
    const boards = [...allActions];
    boards[stage] = [...actions, action];
    setAllActions(boards);
    return true;
  };
  const tapJug = (jug: number) => {
    if (busy) return;
    if (selected === null) {
      setSelected(jug);
      soundCue("measure.select");
      return;
    }
    if (selected === jug) {
      setSelected(null);
      return;
    }
    const from = selected;
    setSelected(null);
    if (!act({ kind: "pour", from, to: jug })) {
      reject(jug);
      return;
    }
    soundCue("measure.pour");
    setFlow({ kind: "pour", from, to: jug, id: ++flowId.current });
  };
  const fillOrEmpty = (kind: "fill" | "empty") => {
    if (selected === null) return;
    const jug = selected;
    if (!act({ kind, jug })) reject(jug);
    else {
      setSelected(null);
      soundCue(kind === "fill" ? "measure.fill" : "measure.empty");
      if (kind === "fill") setFlow({ kind: "fill", to: jug, id: ++flowId.current });
    }
  };
  const reset = () => {
    setSelected(null);
    if (act({ kind: "reset" })) soundCue("measure.reset");
  };

  const maxCap = Math.max(...board.caps);
  const jugWidth = Math.max(
    54,
    Math.min(framed ? 124 : 96, Math.floor((size.width - 24) / (board.caps.length * 1.35))),
  );
  // Height-fitted: the stream room above (22 px) and the amount label below (26 px). Batch W: in a live
  // round the jugs may grow further into the free height (40 px a litre, 124 px wide, never smaller).
  const litre = Math.max(6, Math.min(framed ? 40 : 30, Math.floor((size.height - 56) / maxCap)));
  const atStart = replay.amounts.every((v, i) => v === board.start[i]);
  const button =
    "gf-glass h-11 min-w-[72px] flex-1 rounded-xl border border-border font-mono text-xs uppercase tracking-widest text-foreground disabled:opacity-40";

  return (
    <div
      data-play-area
      data-stage-column="1"
      data-polish="measure"
      className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 py-0.5"
      style={ROOT_STYLE}
    >
      <PolishStyle id="measure" css={MEASURE_CSS} />
      <StageProgress stage={stage} total={MEASURE_BOARDS} />
      <div className={`flex ${framed ? "h-8" : "h-9"} w-full shrink-0 items-center justify-between gap-2`}>
        {/* Puzzle polish (3 Nov 2026): moves and par as separate pills (one line with a "·" before). */}
        <HudPills
          testId="measure-moves"
          className="mx-0"
          items={[
            !framed && { id: "puzzle", label: "Puzzle", value: `${stage + 1} / ${MEASURE_BOARDS}` },
            {
              id: "moves",
              label: "Moves",
              ...(moveLimit !== null ? { limit: moveLimit } : {}),
              value: moveLimit !== null ? limitText(replay.moves, moveLimit) : replay.moves,
              ...(outOfMoves ? { tone: "warn" as const } : {}),
            },
            par !== null && {
              id: "par",
              label: replay.solved && replay.moves <= par ? "★" : "Par",
              value: replay.solved && replay.moves <= par ? "Par" : par,
              tone: "gold",
            },
          ]}
        />
        <p className="font-display text-sm font-bold text-primary" data-measure-goal>
          {goalText(board)}
        </p>
      </div>
      <StageCorrect visible={holding} />
      <div
        ref={box}
        data-game-arena="board"
        className="flex min-h-0 w-full flex-1 items-center justify-center"
      >
        <Jugs
          key={stage}
          board={board}
          amounts={replay.amounts}
          litre={litre}
          width={jugWidth}
          selected={selected}
          shake={shake}
          flow={flow}
          celebrate={solveFx ? (reduced ? "static" : "move") : null}
          onJug={busy ? undefined : tapJug}
        />
      </div>
      {framed ? (
        // Puzzle polish (3 Nov 2026): the live status as label-and-value pills (Batch W's one summary line before).
        <HudPills
          testId="measure"
          items={
            selected === null
              ? [{ id: "hint", value: "Tap a jug" }, moveLimit !== null && { id: "left", label: "Left", value: Math.max(0, moveLimit - replay.moves) }]
              : [
                  { id: "jug", label: `Jug ${selected + 1}`, value: `${replay.amounts[selected] ?? 0} of ${board.caps[selected] ?? 0} L` },
                  { id: "hint", value: board.tap ? "Pour, Fill or Empty" : "Tap another to pour" },
                ]
          }
        />
      ) : (
        <p className="h-4 shrink-0 text-center text-[11px] leading-4 text-muted-foreground">
          {selected === null
            ? "Tap a jug"
            : board.tap
              ? "Tap another jug to pour, or Fill / Empty"
              : "Tap another jug to pour into it"}
        </p>
      )}
      <div data-game-controls="actions" className="flex w-full shrink-0 justify-center gap-2 px-1">
        {board.tap ? (
          <>
            <button
              type="button"
              className={button}
              disabled={
                busy ||
                selected === null ||
                (replay.amounts[selected] ?? 0) >= (board.caps[selected] ?? 0)
              }
              onClick={() => fillOrEmpty("fill")}
            >
              Fill
            </button>
            <button
              type="button"
              className={button}
              disabled={busy || selected === null || (replay.amounts[selected] ?? 0) <= 0}
              onClick={() => fillOrEmpty("empty")}
            >
              Empty
            </button>
          </>
        ) : null}
        <button type="button" className={button} disabled={busy || atStart} onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}

/** The best route's moves, one label each (the reveal draws them as numbered chips). */
function routeSteps(board: MeasureBoardData, raw: string): string[] {
  return decodeMeasureActions(raw, board.caps.length)
    .map((a) =>
      a.kind === "fill"
        ? `Fill ${board.caps[a.jug]}`
        : a.kind === "empty"
          ? `Empty ${board.caps[a.jug]}`
          : a.kind === "pour"
            ? `${board.caps[a.from]}→${board.caps[a.to]}`
            : "Reset",
    );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "measure") return null;
  const parts = splitMeasureRound(myAnswer);
  let open = true;
  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 px-1" data-polish="measure">
      <PolishStyle id="measure" css={MEASURE_CSS} />
      {puzzle.boards.map((board, index) => {
        const mine = open
          ? replayMeasure(board, decodeMeasureActions(parts[index] ?? "", board.caps.length), measureMoveLimits(puzzle)?.[index] ?? null)
          : null;
        if (!mine?.solved) open = false;
        const min = puzzle.minMoves?.[index];
        return (
          <div
            key={index}
            data-puzzle-cell={index}
            data-solved={mine?.solved ? "" : undefined}
            className="mj-row rounded-lg border border-border px-2 py-1"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-2 font-mono text-xs">
              <span className="mj-dim whitespace-nowrap">
                {index + 1}. Jugs {board.caps.join(", ")} ·{" "}
                {board.goal === "split"
                  ? `split ${(board.split ?? []).join("-")}`
                  : `${board.target} L`}
              </span>
              <span
                className={`ml-auto whitespace-nowrap ${mine?.solved ? "font-bold text-primary" : "text-warn"}`}
              >
                {mine?.solved ? `✓ ${mine.moves} moves` : mine ? (mine.outOfMoves ? "✗ out of moves" : "✗ unsolved") : "—"}
                {usesNumberDepth(puzzle) && mine?.solved && min !== undefined && mine.moves <= min ? (
                  <span className="mj-par"> · ★ par</span>
                ) : (
                  <span className="mj-dim"> · best {min ?? "?"}</span>
                )}
              </span>
            </div>
            {puzzle.solutions?.[index] ? (
              <StepChips testId="measure" label="Best" steps={routeSteps(board, puzzle.solutions[index]!)} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const measurePuzzle: PuzzleDefinition = {
  key: "measure",
  name: gameDisplayName("measure"),
  category: "number",
  timeLimitMs: MEASURE_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "measure",
      measureRev: 1,
      boards: [EXAMPLE_BOARD, EXAMPLE_BOARD, EXAMPLE_BOARD, EXAMPLE_BOARD],
    }) satisfies MeasurePuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "measure") return false;
    const parts = splitMeasureRound(answer);
    return puzzle.boards.every(
      (board, i) =>
        replayMeasure(board, decodeMeasureActions(parts[i] ?? "", board.caps.length)).solved,
    );
  },
  revealHeading: "Your moves and the fewest",
  IntroExample,
  Stage,
  Reveal,
};
