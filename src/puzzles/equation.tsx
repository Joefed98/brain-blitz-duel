import { gameDisplayName } from "@/lib/duel/gameNames";
import { Button } from "@/components/ui/button";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useGameKeys } from "@/lib/desktop";

import { StageProgress } from "@/components/puzzles/StageProgress";
import { StageCorrect, useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import { randInt, shuffled } from "@/lib/duel/random";
import { useStageState } from "@/lib/duel/stageState";
import { equationTryLimit, joinCountSuffix, limitText, splitCountSuffix } from "@/lib/duel/moveLimits";
import {
  equationStageCorrect,
  evaluateLeftToRight,
  joinStages,
  parseOperators,
  splitStages,
} from "@/lib/duel/stagedRounds";
import { EQUATION_STAGE_COUNT, EQUATION_TIME_MS, type EquationPuzzleData, type EquationStage, type Operator } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

export { evaluateLeftToRight };

export const OPERATORS: Operator[] = ["+", "-", "×", "÷"];

/** Numbers per stage: three, four, five, then a harder five. */
export const EQUATION_STAGE_NUMBERS = [3, 4, 5, 5] as const;

/** Every operator combination for the given number of slots. */
export function allCombos(slots: number): Operator[][] {
  let combos: Operator[][] = [[]];
  for (let i = 0; i < slots; i++) combos = combos.flatMap((c) => OPERATORS.map((op) => [...c, op]));
  return combos;
}

/** Answer-first: pick numbers, keep a target reached by exactly one operator set. */
function buildStage(count: number, stageIndex: number): { stage: EquationStage; ops: Operator[] } {
  const combos = allCombos(count - 1);
  const allowed = (ops: Operator[]) => stageIndex === 3
    ? ops.includes("÷") && ops.includes("×") && new Set(ops).size >= 3
    : stageIndex !== 2 || !ops.includes("÷");
  for (let attempt = 0; attempt < 900; attempt++) {
    const numbers = Array.from({ length: count }, () => randInt(2, stageIndex === 3 ? 20 : count === 3 ? 12 : 15));
    const solutions = combos
      .map((ops) => ({ ops, value: evaluateLeftToRight(numbers, ops) }))
      .filter((r): r is { ops: Operator[]; value: number } => r.value !== null);
    const chosen = shuffled(solutions).find(
      (c) => c.value <= 400 && allowed(c.ops) && solutions.filter((o) => o.value === c.value).length === 1,
    );
    if (chosen) return { stage: { numbers, target: chosen.value }, ops: chosen.ops };
  }
  const fallback: Record<number, { stage: EquationStage; ops: Operator[] }> = {
    3: { stage: { numbers: [7, 3, 2], target: 20 }, ops: ["+", "×"] },
    4: { stage: { numbers: [8, 2, 5, 3], target: 17 }, ops: ["÷", "×", "-"] },
    5: { stage: { numbers: [9, 3, 4, 2, 5], target: 31 }, ops: ["-", "×", "+", "+"] },
  };
  if (stageIndex === 3) return { stage: { numbers: [12, 3, 7, 2, 5], target: 55 }, ops: ["+", "+", "÷", "×"] };
  const result = fallback[count];
  if (!result) throw new Error("Unsupported Equation stage");
  return result;
}

export function buildEquation(): EquationPuzzleData {
  const built = EQUATION_STAGE_NUMBERS.map((n, i) => buildStage(n, i));
  return { type: "equation", stages: built.map((b) => b.stage), operators: built.map((b) => b.ops) };
}

/* Operator polish (13 Oct 2026): drawing, animation and sound cues only; answers and submit untouched. */
const OPERATOR_CSS = `
[data-polish="equation"] .op-board { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 14px 10px; border-radius: 16px; overflow: hidden;
  background: radial-gradient(110% 60% at 50% 45%, rgba(61,220,132,.07), transparent 65%), repeating-linear-gradient(0deg, rgba(255,255,255,.02) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgba(255,255,255,.02) 0 1px, transparent 1px 24px), linear-gradient(180deg, #16161e, #0f0f15);
  box-shadow: inset 0 0 0 1px rgba(61,220,132,.16), inset 0 1px 0 rgba(255,255,255,.05), 0 6px 18px rgba(0,0,0,.35); }
[data-polish="equation"] .op-caption { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #a9a9b4; }
[data-polish="equation"] .op-equation { position: relative; width: 100%; color: #f4f4f7; border-radius: 14px;
  background: linear-gradient(180deg, #23232c, #1a1a22); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.07), inset 0 -4px 0 rgba(0,0,0,.3), 0 3px 8px rgba(0,0,0,.35);
  transition: box-shadow 200ms ease-out; }
[data-polish="equation"] .op-equation { font-size: var(--fit-fs, 32px); line-height: 1; }
[data-polish="equation"] .op-line { display: flex; width: max-content; flex-wrap: nowrap; align-items: center; gap: .125em; white-space: nowrap; }
[data-polish="equation"] .op-term { display: flex; align-items: center; gap: .125em; }
[data-polish="equation"] .op-equation .op-slot { width: 1.35em; height: 1.75em; min-width: 0; padding: 0; font-size: inherit; }
[data-polish="equation"] .op-equation .op-chip { font-size: .875em; }
[data-polish="equation"] .op-equation .op-goal { margin-left: .15em; }
[data-polish="equation"] .op-equation[data-enter="true"] { animation: op-enter 240ms cubic-bezier(.2,.9,.3,1) both; }
[data-polish="equation"] .op-equation[data-correct="true"] { box-shadow: inset 0 0 0 2px #3DDC84, inset 0 -4px 0 rgba(0,0,0,.3), 0 0 18px rgba(61,220,132,.30); }
[data-polish="equation"] .op-goal { color: #F5B82E; text-shadow: 0 0 14px rgba(245,184,46,.25); }
[data-polish="equation"] .op-slot { position: relative; overflow: visible; border-radius: 12px !important; border: 0 !important; color: #8f8f9b !important;
  background: linear-gradient(180deg, #0c0c11, #14141b) !important; box-shadow: inset 0 2px 5px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.06) !important; }
[data-polish="equation"] .op-slot::before { content: ""; position: absolute; inset: 7px; border-radius: 8px; border: 2px dashed rgba(255,255,255,.16); pointer-events: none; }
[data-polish="equation"] .op-slot[data-filled="true"]::before { display: none; }
[data-polish="equation"] .op-slot:disabled { opacity: 1; }
[data-polish="equation"] .op-chip { position: absolute; inset: 3px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-family: var(--font-mono); font-size: 28px; color: #1a1406;
  background: linear-gradient(180deg, #ffd56a, #F5B82E 60%, #d99a14); box-shadow: inset 0 1px 0 rgba(255,244,200,.7), inset 0 -3px 0 rgba(120,80,0,.35), 0 2px 5px rgba(0,0,0,.45); }
[data-polish="equation"] .op-chip[data-drop="true"] { animation: op-drop 200ms cubic-bezier(.3,1.4,.5,1) both; }
[data-polish="equation"] .op-equation[data-correct="true"] .op-chip { background: linear-gradient(180deg, #7bf0b0, #3DDC84 60%, #24b566); box-shadow: inset 0 1px 0 rgba(220,255,236,.7), inset 0 -3px 0 rgba(0,90,40,.35), 0 0 10px rgba(61,220,132,.45); }
[data-polish="equation"] .op-pad { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
[data-polish="equation"] .op-key { display: flex; height: 64px; align-items: center; justify-content: center; border-radius: 14px; font-family: var(--font-mono); font-size: 32px; font-weight: 700; color: #f4f4f7;
  background: linear-gradient(180deg, #2b2b35 0%, #20202a 55%, #1a1a22 100%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.09), inset 0 1px 0 rgba(255,255,255,.10), inset 0 -4px 0 rgba(0,0,0,.35), 0 2px 4px rgba(0,0,0,.35); }
[data-polish="equation"] .op-key:disabled { opacity: .5; }
@keyframes op-enter { from { opacity: 0; translate: 28px 0; } to { opacity: 1; translate: 0 0; } }
@keyframes op-drop { 0% { translate: 0 -14px; scale: 1.3; opacity: .3; } 70% { translate: 0 1px; scale: .96; opacity: 1; } 100% { translate: 0 0; scale: 1; } }

/* Solve: the four equations tick green one after another. */
[data-polish="equation"] .op-finale { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 12px; pointer-events: none;
  background: #101016; animation: op-fade 160ms ease-out both; }
[data-polish="equation"] .op-finale-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-radius: 10px; font-family: var(--font-mono); font-weight: 700; font-size: 17px; font-variant-numeric: tabular-nums; white-space: nowrap;
  color: #d4d4dc; background: #1b1b23; box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); animation: op-row 520ms ease-out both; animation-delay: calc(var(--i) * 150ms); }
[data-polish="equation"] .op-tick { display: flex; width: 26px; height: 26px; flex: none; align-items: center; justify-content: center; border-radius: 50%; font-size: 16px; color: #0b2a17; background: #3DDC84; box-shadow: 0 0 12px rgba(61,220,132,.6);
  animation: op-tick 300ms cubic-bezier(.3,1.6,.5,1) both; animation-delay: calc(var(--i) * 150ms + 120ms); }
@keyframes op-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes op-row { 0% { opacity: 0; translate: -12px 0; } 30% { opacity: 1; translate: 0 0; color: #d4d4dc; } 55%, 100% { opacity: 1; translate: 0 0; color: #7bf0b0; box-shadow: inset 0 0 0 1px rgba(61,220,132,.55), 0 0 12px rgba(61,220,132,.18); } }
@keyframes op-tick { from { scale: 0; opacity: 0; } to { scale: 1; opacity: 1; } }

.game-column [data-polish="equation"][data-stage-column] { padding-top: 12px; }
.game-column [data-polish="equation"][data-stage-column] > [data-game-arena] { flex: 1 1 0; max-height: none; min-height: 0; }

@media (prefers-reduced-motion: reduce) {
  [data-polish="equation"] :is(.op-equation, .op-chip, .op-finale, .op-tick) { animation: none !important; transition: none; }
  [data-polish="equation"] .op-finale-row { animation: none; color: #7bf0b0; box-shadow: inset 0 0 0 1px rgba(61,220,132,.55); }
}
`;

/**
 * One line, always (19 Oct 2026): the equation (and each reveal line) is drawn at its design size and, when that
 * is wider than its box (five two-digit numbers and a three-digit target on a 375 px phone), its font size, and
 * everything sized in em with it, is cut just enough to fit. Measured before paint and again on a resize, so the
 * board never shows a wrapped or jumping frame. Display only.
 */
/** The equation's design size and the least it may shrink to (a wide equation on the narrowest phone). */
const OP_EQUATION_PX = 32;
const OP_EQUATION_MIN_PX = 16;

function useFitOneLine(box: RefObject<HTMLElement | null>, line: RefObject<HTMLElement | null>, basePx: number, minPx: number, key: unknown) {
  useBeforePaint(() => {
    const el = box.current;
    const inner = line.current;
    if (!el || !inner) return;
    const fit = () => {
      el.style.setProperty("--fit-fs", `${basePx}px`);
      const style = getComputedStyle(el);
      const avail = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const need = inner.scrollWidth;
      if (!(avail > 0) || !(need > avail)) return;
      // Half-pixel steps, a pixel's slack for rounding in the glyph widths.
      const px = Math.max(minPx, Math.floor(((basePx * (avail - 1)) / need) * 2) / 2);
      el.style.setProperty("--fit-fs", `${px}px`);
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [key, basePx, minPx]);
}

function OperatorSlot({ value, onClick, fresh }: { value: Operator | null; onClick?: (() => void) | undefined; fresh?: boolean }) {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      disabled={!onClick}
      data-filled={value ? "true" : undefined}
      aria-label={value ? `Operator ${display(value)}` : "Empty operator slot"}
      className="equation-slot op-slot flex h-14 w-14 shrink-0 items-center justify-center font-bold"
    >
      {value ? <span className="op-chip" data-drop={fresh ? "true" : undefined}>{display(value)}</span> : null}
    </Button>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5 font-mono text-xl font-bold tabular-nums">
        <span>7</span>
        <IntroSlot />
        <span>3</span>
        <IntroSlot />
        <span>2</span>
        <span>= 20</span>
      </div>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">7 + 3 × 2 = 20</span>
      </p>
    </div>
  );
}

/** The intro's empty slot, drawn exactly as before (the shared intro frame is not restyled). */
function IntroSlot() {
  return (
    <Button
      variant="ghost"
      type="button"
      disabled
      className="equation-slot flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-card font-mono text-xl font-bold text-muted-foreground"
    >
      ▢
    </Button>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "equation" }: PuzzleStageProps) {
  const column = useGameColumnLayout();
  const data = puzzle.type === "equation" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "eqStage", () => 0);
  const [answers, setAnswers] = useStageState<string[]>(stateKey, "eqAnswers", () => Array.from({ length: data?.stages.length ?? 4 }, () => ""));
  const [slots, setSlots] = useStageState<(Operator | null)[]>(stateKey, "eqSlots", () =>
    Array(Math.max(0, (data?.stages[0]?.numbers.length ?? 1) - 1)).fill(null),
  );
  // equationRev 1 (moveLimits.ts): every full operator set is a try; after the last wrong one the equation locks.
  const tryLimit = data ? equationTryLimit(data) : null;
  const [tries, setTries] = useStageState<number[]>(stateKey, "eqTries", () => Array.from({ length: data?.stages.length ?? 4 }, () => 0));
  const done = useRef(false);
  // Presentation only: the slot that just took an operator, whether a stage has advanced, and the finale.
  const [dropped, setDropped] = useState<{ index: number; n: number } | null>(null);
  const [entered, setEntered] = useState(false);
  const [finale, setFinale] = useState<string[] | null>(null);
  const finaleOn = useSolveFx(finale !== null, "equation.solve", 1200);

  const total = data?.stages.length ?? 4;
  const current = data?.stages[Math.min(stage, total - 1)];
  const liveAnswers = answers.map((a, i) => (i === stage ? slots.filter(Boolean).join(",") : a));
  const draft = tryLimit !== null ? joinCountSuffix(joinStages(liveAnswers, total), tries) : joinStages(liveAnswers, total);
  const complete = !!current && slots.every((slot) => slot !== null) && equationStageCorrect(current.numbers, current.target, slots.join(","));
  const triesUsed = tries[stage] ?? 0;
  const outOfTries = tryLimit !== null && !complete && triesUsed >= tryLimit;
  const holding = useStageCorrectHold({
    complete,
    finalStage: stage >= total - 1,
    locked: locked || done.current,
    stateKey,
    onAdvance: () => advance(slots),
  });
  useEffect(() => {
    onDraftAnswer?.(draft);
  }, [draft, onDraftAnswer]);
  useEffect(() => {
    if (holding) soundCue("equation.correct");
  }, [holding]);

  // Desktop keys: + − × ÷ (also - * x /) drop that operator in the next slot, Backspace clears the last
  // filled slot, Enter = Next / Submit.
  useGameKeys((kind, key, event) => {
    if (!data || !current) return false;
    const op: Operator | null = key === "+" ? "+" : key === "-" ? "-" : key === "*" || key === "x" || key === "×" ? "×" : key === "/" || key === "÷" ? "÷" : null;
    const used = op !== null || key === "Backspace" || key === "Enter";
    if (!used || kind !== "down") return used;
    if (op) {
      if (!event.repeat) tapOperator(op);
    } else if (key === "Backspace") {
      let index = slots.length - 1;
      while (index >= 0 && slots[index] === null) index--;
      if (index >= 0) clearSlot(index);
    } else if (!event.repeat && !frozen) advance(slots);
    return true;
  });

  // The equation stays on one line (useFitOneLine): refitted per equation.
  const equationBox = useRef<HTMLDivElement>(null);
  const equationLine = useRef<HTMLSpanElement>(null);
  useFitOneLine(equationBox, equationLine, OP_EQUATION_PX, OP_EQUATION_MIN_PX, `${stage}:${current?.numbers.join(",")}=${current?.target}`);
  if (!data || !current) return null;
  const frozen = locked || done.current || holding;
  // Out of tries: the equation is over; only Next (or Submit) is left.
  const keysFrozen = frozen || outOfTries;

  const advance = (filled: (Operator | null)[]) => {
    const next = [...answers];
    next[stage] = filled.filter(Boolean).join(",");
    setAnswers(next);
    if (stage >= total - 1) {
      done.current = true;
      onSubmit(tryLimit !== null ? joinCountSuffix(joinStages(next, total), tries) : joinStages(next, total));
      // Display only: every equation right means the whole puzzle is solved.
      if (data.stages.every((st, i) => equationStageCorrect(st.numbers, st.target, next[i] ?? ""))) setFinale(next);
      return;
    }
    const nextStage = stage + 1;
    setStage(nextStage);
    setEntered(true);
    setDropped(null);
    soundCue("equation.advance");
    const nextNumbers = data.stages[nextStage]?.numbers;
    if (nextNumbers) setSlots(Array(nextNumbers.length - 1).fill(null));
  };

  const tapOperator = (op: Operator) => {
    if (keysFrozen) return;
    const index = slots.findIndex((s) => s === null);
    if (index === -1) return;
    const next = [...slots];
    next[index] = op;
    setSlots(next);
    // A full set is a try (the right one included).
    if (tryLimit !== null && next.every((s) => s !== null)) {
      setTries(tries.map((n, i) => (i === stage ? n + 1 : n)));
      if (!equationStageCorrect(current.numbers, current.target, next.join(","))) puzzleReject();
    }
    setDropped((d) => ({ index, n: (d?.n ?? 0) + 1 }));
    soundCue("equation.drop");
  };

  const clearSlot = (index: number) => {
    if (keysFrozen) return;
    const next = [...slots];
    next[index] = null;
    setSlots(next);
  };

  const last = stage >= total - 1;

  return (
    <div data-polish="equation" data-stage-column="3" className={`flex min-h-0 flex-1 flex-col gap-3 ${column ? "" : "justify-between"}`}>
      <PolishStyle id="equation" css={OPERATOR_CSS} />
      <div data-game-arena="fixed" className="op-board">
        <StageProgress stage={stage} total={total} />
        <p className="op-caption">
          Equation {stage + 1} of {total} · left to right
        </p>
        <div
          key={stage}
          ref={equationBox}
          data-enter={entered ? "true" : undefined}
          data-correct={holding || finale ? "true" : undefined}
          className="polish-equation op-equation flex w-full items-center justify-center px-2 py-4 font-mono font-bold tabular-nums"
        >
          <span ref={equationLine} className="op-line">
          {current.numbers.map((n, index) => (
            <span key={index} className="op-term">
              <span>{n}</span>
              {index < current.numbers.length - 1 && (
                <OperatorSlot
                  key={dropped?.index === index ? `drop-${dropped.n}` : "slot"}
                  value={slots[index] ?? null}
                  fresh={dropped?.index === index}
                  onClick={keysFrozen ? undefined : () => clearSlot(index)}
                />
              )}
            </span>
          ))}
          <span className="op-goal">= {current.target}</span>
          </span>
        </div>
        {tryLimit !== null && (
          <p className="op-caption" data-move-limit={tryLimit}>
            {outOfTries ? <span className="text-warn">No tries left</span> : <>tries <span className="text-primary">{limitText(triesUsed, tryLimit)}</span></>}
          </p>
        )}
        <StageCorrect visible={holding} />
        {finaleOn && finale && (
          <div className="op-finale" aria-hidden="true">
            {data.stages.map((st, i) => (
              <div key={i} className="op-finale-row" style={{ "--i": i } as CSSProperties}>
                <span><Line numbers={st.numbers} ops={parseOperators(finale[i] ?? "")} /> = {st.target}</span>
                <span className="op-tick">✓</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div data-game-controls="operators" data-equation-pad className="op-pad">
        {OPERATORS.map((op) => (
          <Button
            key={op}
            variant="ghost"
            type="button"
            disabled={keysFrozen}
            onClick={() => tapOperator(op)}
            aria-label={`Operator ${display(op)}`}
            className="press op-key"
          >
            {display(op)}
          </Button>
        ))}
      </div>

      <Button
        data-game-controls="submit"
        variant="ghost"
        type="button"
        onClick={() => !frozen && advance(slots)}
        disabled={frozen}
        className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
      >
        {last ? "Submit" : "Next"}
      </Button>
    </div>
  );
}

function display(op: string): string {
  return op === "-" ? "−" : op;
}

function Line({ numbers, ops }: { numbers: number[]; ops: string[] }) {
  return (
    <>
      {numbers.map((n, index) => (
        <span key={index}>
          {n}
          {index < ops.length ? ` ${display(ops[index] ?? "")} ` : ""}
        </span>
      ))}
    </>
  );
}

/** A reveal line kept on one line (useFitOneLine), its font cut only as far as it must be. */
function FitLine({ className, basePx, fitKey, children }: { className: string; basePx: number; fitKey: string; children: ReactNode }) {
  const box = useRef<HTMLParagraphElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  useFitOneLine(box, line, basePx, 11, fitKey);
  return (
    <p ref={box} className={className} style={{ "--fit-base": `${basePx}px` } as CSSProperties}>
      <span ref={line} className="op-fit-line">{children}</span>
    </p>
  );
}

const OPERATOR_REVEAL_CSS = `
.op-reveal { display: flex; min-height: 0; width: 100%; flex: 1 1 auto; flex-direction: column; justify-content: center; gap: 8px; }
.op-reveal-row { position: relative; display: flex; width: 100%; flex-direction: column; align-items: center; gap: 2px; padding: 8px 10px 9px; border-radius: 14px;
  background: linear-gradient(180deg, #1c1c25, #15151c); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07), inset 0 -3px 0 rgba(0,0,0,.25); }
.op-reveal-row[data-ok="true"] { box-shadow: inset 3px 0 0 #3DDC84, inset 0 0 0 1px rgba(61,220,132,.22), inset 0 -3px 0 rgba(0,0,0,.25); }
.op-reveal-row[data-ok="false"] { box-shadow: inset 3px 0 0 #ff7a70, inset 0 0 0 1px rgba(255,122,112,.22), inset 0 -3px 0 rgba(0,0,0,.25); }
.op-reveal-label { font-size: 14px; color: #b4b4be; }
.op-reveal-label .ok { color: #5fe69c; font-weight: 700; }
.op-reveal-label .bad { color: #ff7a70; font-weight: 700; }
.op-reveal-line, .op-reveal-mine { align-self: stretch; white-space: nowrap; font-size: var(--fit-fs, var(--fit-base)) !important; }
.op-fit-line { display: inline-block; white-space: nowrap; }
.op-reveal-line { text-align: center; font-family: var(--font-mono); font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; color: #F5B82E; }
.op-reveal-mine { text-align: center; font-family: var(--font-mono); font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: #ff7a70; }
`;

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "equation") return null;
  const tryLimit = equationTryLimit(puzzle);
  const { body, counts: tries } = tryLimit !== null ? splitCountSuffix(myAnswer) : { body: myAnswer ?? "", counts: [] as number[] };
  const parts = splitStages(body, puzzle.stages.length);
  return (
    <div className="op-reveal">
      <PolishStyle id="equation-reveal" css={OPERATOR_REVEAL_CSS} />
      {puzzle.stages.map((stage, i) => {
        const mine = parseOperators(parts[i] ?? "");
        const ok = equationStageCorrect(stage.numbers, stage.target, parts[i] ?? "") && (tryLimit === null || (tries[i] ?? 0) <= tryLimit);
        return (
          <div key={i} className="op-reveal-row" data-ok={ok ? "true" : "false"}>
            <p className="op-reveal-label">
              Equation {i + 1} · <span className={ok ? "ok" : "bad"}>{ok ? "✓" : mine.length < stage.numbers.length - 1 ? (mine.length ? "Incomplete ✗" : "Skipped ✗") : "✗"}</span>
            </p>
            <FitLine className="op-reveal-line" basePx={18} fitKey={`${stage.numbers.join(",")}:${(puzzle.operators?.[i] ?? []).join("")}`}>
              <Line numbers={stage.numbers} ops={puzzle.operators?.[i] ?? []} /> = {stage.target}
            </FitLine>
            {!ok && mine.length === stage.numbers.length - 1 && (
              <FitLine className="op-reveal-mine" basePx={16} fitKey={`${stage.numbers.join(",")}:${mine.join("")}`}>
                <Line numbers={stage.numbers} ops={mine} /> ✗
              </FitLine>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const equationPuzzle: PuzzleDefinition = {
  key: "equation",
  name: gameDisplayName("equation"),
  category: "number",
  timeLimitMs: EQUATION_TIME_MS,
  generate: buildEquation,
  check: (answer, puzzle) => {
    if (puzzle.type !== "equation") return false;
    const parts = splitStages(splitCountSuffix(answer).body, puzzle.stages.length);
    return puzzle.stages.every((st, i) => equationStageCorrect(st.numbers, st.target, parts[i] ?? ""));
  },
  IntroExample,
  Stage,
  Reveal,
};
