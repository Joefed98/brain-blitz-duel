import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { StageCorrect } from "@/components/puzzles/StageCorrect";
import { FLIGHTPATH_COLOURS } from "@/lib/arcade/flightpathPalette.renderer";
import {
  FAIR_CHALK,
  FAIR_SKY_MID,
  FAIR_SKY_TOP,
  FAIR_WOOD,
  FAIR_WOOD_DARK,
} from "@/lib/arcade/fairground.renderer";
import {
  checkoutDartAllowed,
  checkoutDartLabel,
  checkoutDartValue,
  checkoutRemaining,
  checkoutValid,
  decodeCheckoutDarts,
  encodeCheckoutDarts,
  joinCheckoutRound,
  splitCheckoutRound,
  CHECKOUT_BULL,
  CHECKOUT_STAGES,
  CHECKOUT_STANDARD,
  type CheckoutDart,
} from "@/lib/duel/checkout";
import { useStageState } from "@/lib/duel/stageState";
import {
  CHECKOUT_TIME_MS,
  type CheckoutPuzzleData,
  type CheckoutStageData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** iOS: no text selection or callout on long presses anywhere in the game. */
const ROOT_STYLE: CSSProperties = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
};

/* Flightpath's fairground palette: gold, burgundy, blue, pink, charcoal, cream. */
const [GOLD, BURGUNDY, BLUE, , CHARCOAL, CREAM] = FLIGHTPATH_COLOURS;
const NEGATIVE_INK = "#FF8FA3";

/* Board geometry in a 200-unit viewBox. */
const C = 100;
const R_NUMBERS = 100;
const R_DOUBLE_OUT = 78;
const R_DOUBLE_IN = 70;
const R_TREBLE_OUT = 50;
const R_TREBLE_IN = 43;
const R_QUAD_OUT = 26;
const R_QUAD_IN = 21;
const R_BULL = 14;
const R_INNER_BULL = 6.5;

const angleOf = (wedge: number) => ((-90 + wedge * 18) * Math.PI) / 180;
const point = (r: number, a: number) =>
  `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;

function sector(r0: number, r1: number, wedge: number): string {
  const a0 = angleOf(wedge) - (9 * Math.PI) / 180;
  const a1 = angleOf(wedge) + (9 * Math.PI) / 180;
  return `M ${point(r0, a0)} L ${point(r1, a0)} A ${r1} ${r1} 0 0 1 ${point(r1, a1)} L ${point(r0, a1)} A ${r0} ${r0} 0 0 0 ${point(r0, a0)} Z`;
}

/** Where a dart marker sits: the middle of its ring band in its wedge. */
function dartSpot(dart: CheckoutDart, quad: boolean, nth: number): { x: number; y: number } {
  if (dart.wedge === CHECKOUT_BULL) {
    const r = dart.ring === 2 ? 2 : (R_BULL + R_INNER_BULL) / 2;
    const a = (nth * 2.1) % (Math.PI * 2);
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  }
  const band =
    dart.ring === 2
      ? (R_DOUBLE_IN + R_DOUBLE_OUT) / 2
      : dart.ring === 3
        ? (R_TREBLE_IN + R_TREBLE_OUT) / 2
        : dart.ring === 4
          ? (R_QUAD_IN + R_QUAD_OUT) / 2
          : quad
            ? 36
            : 60;
  const a = angleOf(dart.wedge) + ((nth % 3) - 1) * 0.07;
  return { x: C + band * Math.cos(a), y: C + band * Math.sin(a) };
}

/**
 * The dartboard: wooden rim with large wedge numbers, alternating charcoal and
 * cream singles, burgundy and blue doubles and trebles, a gold x4 ring where the
 * board has one, and the bull. A whole wedge (any ring) is one tap target.
 */
function Board({
  stage,
  selected,
  darts,
  onWedge,
  size,
}: {
  stage: Pick<CheckoutStageData, "wedges" | "quad">;
  selected?: number | null;
  darts?: readonly CheckoutDart[];
  onWedge?: ((wedge: number) => void) | undefined;
  size: number;
}) {
  const quad = stage.quad === true;
  const fontSize = stage.wedges.some((v) => Math.abs(v) >= 10) ? 13 : 14;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="group"
      aria-label="Dartboard"
      style={{ display: "block", touchAction: "manipulation" }}
    >
      <circle cx={C} cy={C} r={R_NUMBERS} fill={FAIR_WOOD} />
      <circle
        cx={C}
        cy={C}
        r={R_NUMBERS - 1.5}
        fill="none"
        stroke={FAIR_WOOD_DARK}
        strokeWidth={1.2}
      />
      {stage.wedges.map((value, wedge) => {
        const even = wedge % 2 === 0;
        const single = even ? CHARCOAL : CREAM;
        const ring = even ? BURGUNDY : BLUE;
        return (
          <g key={wedge}>
            <path d={sector(R_DOUBLE_IN, R_DOUBLE_OUT, wedge)} fill={ring} />
            <path d={sector(R_TREBLE_OUT, R_DOUBLE_IN, wedge)} fill={single} />
            <path d={sector(R_TREBLE_IN, R_TREBLE_OUT, wedge)} fill={ring} />
            {quad ? (
              <>
                <path d={sector(R_QUAD_OUT, R_TREBLE_IN, wedge)} fill={single} />
                <path d={sector(R_QUAD_IN, R_QUAD_OUT, wedge)} fill={GOLD} />
                <path d={sector(R_BULL, R_QUAD_IN, wedge)} fill={single} />
              </>
            ) : (
              <path d={sector(R_BULL, R_TREBLE_IN, wedge)} fill={single} />
            )}
            <text
              x={C + 89 * Math.cos(angleOf(wedge))}
              y={C + 89 * Math.sin(angleOf(wedge))}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight={800}
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fill={value < 0 ? NEGATIVE_INK : FAIR_CHALK}
            >
              {value < 0 ? `−${-value}` : value}
            </text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R_BULL} fill={BLUE} />
      <circle cx={C} cy={C} r={R_INNER_BULL} fill={BURGUNDY} />
      {selected !== null && selected !== undefined ? (
        selected === CHECKOUT_BULL ? (
          <circle
            cx={C}
            cy={C}
            r={R_BULL}
            fill="none"
            stroke={GOLD}
            strokeWidth={3}
            data-checkout-selected
          />
        ) : (
          <path
            d={sector(R_BULL, R_NUMBERS - 1, selected)}
            fill={GOLD}
            fillOpacity={0.28}
            stroke={GOLD}
            strokeWidth={2.5}
            data-checkout-selected
          />
        )
      ) : null}
      {(darts ?? []).map((dart, i) => {
        const spot = dartSpot(dart, quad, i);
        return (
          <g key={i} pointerEvents="none">
            <circle
              cx={spot.x}
              cy={spot.y}
              r={4.4}
              fill={GOLD}
              stroke="#0B0B0F"
              strokeWidth={1.2}
            />
            <text
              x={spot.x}
              y={spot.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={5.5}
              fontWeight={800}
              fill="#0B0B0F"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
      {onWedge ? (
        <g data-checkout-hits>
          {stage.wedges.map((value, wedge) => (
            <path
              key={wedge}
              d={sector(R_BULL, R_NUMBERS, wedge)}
              fill="transparent"
              data-puzzle-cell={`w${wedge}`}
              role="button"
              aria-label={`Wedge ${value}`}
              onClick={() => onWedge(wedge)}
            />
          ))}
          <circle
            cx={C}
            cy={C}
            r={R_BULL}
            fill="transparent"
            role="button"
            aria-label="Bull"
            data-puzzle-cell="bull"
            onClick={() => onWedge(CHECKOUT_BULL)}
          />
        </g>
      ) : null}
    </svg>
  );
}

function finishWord(stage: CheckoutStageData): string {
  return stage.finish === 3 ? "treble" : "double";
}

function dartsRule(stage: CheckoutStageData): string {
  return stage.exactDarts ? `exactly ${stage.maxDarts} darts` : `up to ${stage.maxDarts} darts`;
}

/** Fixed example: 57 on the standard board, T15 then D6. */
const EXAMPLE_STAGE: CheckoutStageData = {
  wedges: [...CHECKOUT_STANDARD],
  target: 57,
  maxDarts: 3,
  finish: 2,
};
const EXAMPLE_DARTS: CheckoutDart[] = [
  { wedge: 7, ring: 3 },
  { wedge: 5, ring: 2 },
];

function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % 4), 1100);
    return () => clearInterval(timer);
  }, []);
  const shown = EXAMPLE_DARTS.slice(0, Math.min(step, 2));
  const left = checkoutRemaining(EXAMPLE_STAGE, shown);
  return (
    <div className="flex flex-col items-center gap-2" style={ROOT_STYLE}>
      <div
        className="rounded-xl p-1.5"
        style={{ background: `linear-gradient(${FAIR_SKY_TOP}, ${FAIR_SKY_MID})` }}
      >
        <Board stage={EXAMPLE_STAGE} darts={shown} size={150} />
      </div>
      <p className="h-5 font-mono text-sm text-primary">
        57 → {shown.map((d) => checkoutDartLabel(EXAMPLE_STAGE, d)).join(" + ") || "?"} → {left}
        {left === 0 ? " ✓" : ""}
      </p>
      <p className="max-w-[270px] text-center text-xs text-muted-foreground">
        Treble 15 (45), then double 6 (12): zero, finishing on a double. Each board is different.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "checkout",
}: PuzzleStageProps) {
  const data: CheckoutPuzzleData | null = puzzle.type === "checkout" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "checkoutStage", () => 0);
  const [solved, setSolved] = useStageState<string[]>(stateKey, "checkoutSolved", () =>
    Array.from({ length: CHECKOUT_STAGES }, () => ""),
  );
  const [inPlay, setInPlay] = useStageState<CheckoutDart[][]>(stateKey, "checkoutDarts", () =>
    Array.from({ length: CHECKOUT_STAGES }, () => []),
  );
  const [selected, setSelected] = useStageState<number | null>(
    stateKey,
    "checkoutWedge",
    () => null,
  );
  const [shake, setShake] = useState(false);
  const [correct, setCorrect] = useState(false);
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 340, height: 320 });
  const encoded = joinCheckoutRound(solved);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    measure();
    return () => ro.disconnect();
  }, []);

  if (!data) return null;
  const current = data.stages[stage]!;
  const isSolved = (index: number) => Boolean(solved[index]);
  const darts = isSolved(stage)
    ? decodeCheckoutDarts(solved[stage]!, current.maxDarts)
    : (inPlay[stage] ?? []);
  const left = checkoutRemaining(current, darts);
  const busy = locked || submitted.current;
  const done = isSolved(stage);
  const full = darts.length >= current.maxDarts;

  const setDarts = (next: CheckoutDart[]) => {
    const all = [...inPlay];
    all[stage] = next;
    setInPlay(all);
  };
  const addDart = (ring: number) => {
    if (busy || done || selected === null || full) return;
    const dart = { wedge: selected, ring };
    if (!checkoutDartAllowed(current, dart)) return;
    hapticTick();
    setDarts([...darts, dart]);
  };
  const reject = () => {
    setShake(true);
    buzz(20);
    playWrong();
    setTimeout(() => setShake(false), 320);
  };
  const throwDarts = () => {
    if (busy || done || !darts.length) return;
    if (!checkoutValid(current, darts)) {
      reject();
      return;
    }
    const next = [...solved];
    next[stage] = encodeCheckoutDarts(darts);
    setSolved(next);
    setSelected(null);
    playCorrect();
    buzz(20);
    if (next.every(Boolean)) {
      submitted.current = true;
      onSubmit(joinCheckoutRound(next));
      return;
    }
    setCorrect(true);
    const following = [1, 2, 3, 4, 5]
      .map((k) => (stage + k) % CHECKOUT_STAGES)
      .find((i) => !next[i]);
    setTimeout(() => {
      setCorrect(false);
      if (following !== undefined) setStage(following);
    }, 900);
  };

  const boardSize = Math.max(180, Math.min(size.width - 8, size.height - 4));
  const rings = selected === CHECKOUT_BULL ? [1, 2] : current.quad ? [1, 2, 3, 4] : [1, 2, 3];
  const ringLabel = (ring: number) =>
    selected === CHECKOUT_BULL ? (ring === 2 ? "Bull 50" : "25") : `x${ring}`;
  const control =
    "h-11 flex-1 rounded-xl border font-mono text-sm font-bold uppercase tracking-wider disabled:opacity-40";

  return (
    <div
      data-play-area
      data-stage-column="1"
      className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 py-0.5"
      style={ROOT_STYLE}
    >
      <div className="flex h-9 w-full shrink-0 gap-1.5" role="tablist" aria-label="Boards">
        {data.stages.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === stage}
            disabled={busy}
            onClick={() => {
              setStage(i);
              setSelected(null);
            }}
            className={`flex-1 rounded-lg border font-mono text-xs font-bold ${i === stage ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"} ${isSolved(i) ? "bg-category-accent/25 text-foreground" : ""}`}
          >
            {isSolved(i) ? "✓" : s.target}
          </button>
        ))}
      </div>
      <p
        className="h-5 w-full shrink-0 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground"
        data-checkout-rule
      >
        Finish on a <span className="text-primary">{finishWord(current)}</span> ·{" "}
        {dartsRule(current)}
      </p>
      <StageCorrect visible={correct} />
      <div
        ref={box}
        data-game-arena="board"
        className="flex min-h-0 w-full flex-1 items-center justify-center rounded-xl"
        style={{ background: `linear-gradient(${FAIR_SKY_TOP}, ${FAIR_SKY_MID})` }}
      >
        <Board
          stage={current}
          selected={done ? null : selected}
          darts={darts}
          onWedge={
            busy || done
              ? undefined
              : (w) => {
                  hapticTick();
                  setSelected(selected === w ? null : w);
                }
          }
          size={boardSize}
        />
      </div>
      <div
        className={`flex h-10 w-full shrink-0 items-center justify-between gap-2 px-1 font-mono ${shake ? "animate-shake" : ""}`}
        data-checkout-darts
      >
        <span className="text-sm text-muted-foreground">
          {current.target}
          {darts.map((d, i) => (
            <span key={i} className="text-foreground">
              {" "}
              − {checkoutDartLabel(current, d)}
            </span>
          ))}
        </span>
        <span
          className={`text-xl font-bold ${left === 0 ? "text-primary" : left < 0 ? "text-warn" : "text-foreground"}`}
        >
          {done ? "✓ 0" : left}
        </span>
      </div>
      <div data-game-controls="rings" className="flex w-full shrink-0 gap-1.5">
        {rings.map((ring) => (
          <button
            key={ring}
            type="button"
            className={`${control} border-primary text-primary`}
            disabled={busy || done || selected === null || full}
            onClick={() => addDart(ring)}
          >
            {ringLabel(ring)}
          </button>
        ))}
      </div>
      <div data-game-controls="actions" className="flex w-full shrink-0 gap-1.5">
        <button
          type="button"
          className={`${control} border-border text-muted-foreground`}
          disabled={busy || done || !darts.length}
          onClick={() => setDarts(darts.slice(0, -1))}
        >
          Undo
        </button>
        <button
          type="button"
          className={`${control} border-primary bg-primary text-primary-foreground`}
          disabled={busy || done || !darts.length}
          onClick={throwDarts}
        >
          Throw
        </button>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "checkout") return null;
  const parts = splitCheckoutRound(myAnswer);
  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 px-1">
      {puzzle.stages.map((stage, index) => {
        const mine = decodeCheckoutDarts(parts[index] ?? "", stage.maxDarts);
        const ok = checkoutValid(stage, mine);
        const best = decodeCheckoutDarts(puzzle.routes?.[index] ?? "", stage.maxDarts);
        return (
          <div
            key={index}
            data-puzzle-cell={index}
            className="rounded-lg border border-border px-2 py-1 font-mono text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {index + 1}. {stage.target} · {finishWord(stage)}
              </span>
              <span className={ok ? "font-bold text-primary" : "text-warn"}>
                {ok
                  ? `✓ ${mine.map((d) => checkoutDartLabel(stage, d)).join(" ")} (${mine.length})`
                  : "✗ not checked out"}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Fewest {puzzle.minDarts?.[index] ?? "?"}:{" "}
              {best
                .map((d) => `${checkoutDartLabel(stage, d)} (${checkoutDartValue(stage, d)})`)
                .join(" + ")}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export const checkoutPuzzle: PuzzleDefinition = {
  key: "checkout",
  name: gameDisplayName("checkout"),
  category: "number",
  timeLimitMs: CHECKOUT_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "checkout",
      checkoutRev: 1,
      stages: [EXAMPLE_STAGE, EXAMPLE_STAGE, EXAMPLE_STAGE, EXAMPLE_STAGE, EXAMPLE_STAGE],
    }) satisfies CheckoutPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "checkout") return false;
    const parts = splitCheckoutRound(answer);
    return puzzle.stages.every((stage, i) =>
      checkoutValid(stage, decodeCheckoutDarts(parts[i] ?? "", stage.maxDarts)),
    );
  },
  revealHeading: "Your darts and the fewest",
  IntroExample,
  Stage,
  Reveal,
};
