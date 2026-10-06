import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { Button } from "@/components/ui/button";
import { StageCorrect, useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import {
  BAL_PEGS,
  BAL_REVEAL_MS,
  BAL_SCALES,
  BAL_TIME_MS,
  balanceSolvedCount,
  balanceTilt,
  decodeBalance,
  encodeBalance,
  scaleSolved,
  type Placement,
} from "@/lib/duel/balance";
import { useStageState } from "@/lib/duel/stageState";
import type { BalancePuzzleData, BalanceScale } from "@/lib/duel/types";
import { playCorrect, playLock } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const PEG_GAP = 4;
const MIN_PEG_WIDTH = 40;
const pegDistanceLabel = (peg: number) => (peg < 4 ? 4 - peg : peg - 3);

function Disc({ value, fixed, size }: { value: number; fixed: boolean; size: number }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full font-mono font-bold ${fixed ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {value}
    </span>
  );
}

function Beam({
  scale,
  placement,
  spacing,
  onWeightTap,
  onPlace,
  selected,
  showControls = false,
}: {
  scale: BalanceScale;
  placement: Placement;
  spacing: number;
  onWeightTap?: (tray: number) => void;
  onPlace?: (peg: number) => void;
  selected?: number | null;
  showControls?: boolean;
}) {
  const tilt = balanceTilt(scale, placement);
  const balanced = scaleSolved(scale, placement);
  const disc = Math.min(40, spacing - 2);
  const width = spacing * BAL_PEGS + PEG_GAP * (BAL_PEGS - 1);
  const onPeg = new Map<number, { w: number; fixed: boolean; tray?: number }>();
  scale.fixed.forEach((f) => onPeg.set(f.peg, { w: f.w, fixed: true }));
  placement.forEach((peg, i) => {
    if (peg !== null) onPeg.set(peg, { w: scale.tray[i]!, fixed: false, tray: i });
  });
  return (
    <div className="relative" style={{ width, height: showControls ? 92 : 68 }}>
      {/* Decorative layer only: it may tilt, but number buttons never do. */}
      <div
        className="absolute left-0 top-0 h-[68px] w-full"
        style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "50% 42px", transition: "transform 150ms ease-out" }}
      >
        <div className="absolute left-1 top-10 h-1.5 rounded-full bg-foreground/70" style={{ width: width - 8 }} />
        <div className="absolute inset-x-0 top-0 flex" style={{ gap: PEG_GAP }}>
          {Array.from({ length: BAL_PEGS }, (_, peg) => {
            const item = onPeg.get(peg);
            const available = selected !== null && !item;
            return (
              <span key={peg} className="relative z-30 flex justify-center" style={{ width: spacing }}>
                {item && (
                  <span
                    className={`mt-0.5 ${item.tray === selected && !item.fixed ? "rounded-full ring-2 ring-primary shadow-[0_0_16px_var(--primary)]" : ""}`}
                    onClick={!item.fixed && item.tray !== undefined ? () => onWeightTap?.(item.tray ?? -1) : undefined}
                  >
                    <Disc value={item.w} fixed={item.fixed} size={disc} />
                  </span>
                )}
                {available && <span className="pointer-events-none absolute top-6 h-4 w-0.5 bg-primary" />}
              </span>
            );
          })}
        </div>
      </div>
      <span
        className="absolute left-1/2 top-[42px] h-0 w-0 -translate-x-1/2 border-x-[14px] border-b-[22px] border-x-transparent"
        style={{
          borderBottomColor: balanced ? "var(--primary)" : "var(--muted-foreground)",
          filter: balanced ? "drop-shadow(0 0 8px var(--primary))" : undefined,
        }}
      />
      {showControls && (
        <div className="absolute inset-x-0 top-12 flex" style={{ gap: PEG_GAP }}>
          {Array.from({ length: BAL_PEGS }, (_, peg) => {
            const occupied = onPeg.has(peg);
            const available = selected !== null && !occupied;
            return (
              <Button
                key={peg}
                type="button"
                variant="ghost"
                onClick={() => { if (available) onPlace?.(peg); }}
                aria-label={`Place at distance ${pegDistanceLabel(peg)} on the ${peg < 4 ? "left" : "right"}`}
                aria-disabled={!available}
                className={`h-11 min-w-10 flex-1 px-0 font-mono text-sm ${available ? "bg-primary/20 text-primary ring-1 ring-primary/70 hover:bg-primary/30" : "text-muted-foreground hover:bg-transparent"}`}
                style={{ width: spacing, minWidth: MIN_PEG_WIDTH }}
              >
                {pegDistanceLabel(peg)}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IntroExample() {
  const scale: BalanceScale = { fixed: [{ peg: 1, w: 2 }], tray: [3] };
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Beam scale={scale} placement={[5]} spacing={40} showControls />
      <p className="text-center text-xs text-muted-foreground">2 × 3 on the left equals 3 × 2 on the right.</p>
    </div>
  );
}

function useSpacing(ref: React.RefObject<HTMLDivElement | null>): number {
  const [spacing, setSpacing] = useState(38);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSpacing(Math.max(MIN_PEG_WIDTH, Math.min(44, Math.floor((el.clientWidth - PEG_GAP * (BAL_PEGS - 1)) / BAL_PEGS))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return spacing;
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, stateKey = "balance" }: PuzzleStageProps) {
  const data: BalancePuzzleData | null = puzzle.type === "balance" ? puzzle : null;
  const scales = data?.scales ?? [];
  const [placements, setPlacements] = useStageState<Placement[]>(stateKey, "placements", () =>
    scales.map((s) => s.tray.map(() => null)),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [current, setCurrentStage] = useStageState<number>(stateKey, "balanceStage", () => Math.min(balanceSolvedCount(scales, placements), BAL_SCALES - 1));
  const [progressTarget, setProgressTarget] = useState<HTMLElement | null>(null);
  const lastTap = useRef<{ tray: number; time: number } | null>(null);
  const submitted = useRef(false);
  const root = useRef<HTMLDivElement | null>(null);
  useNoTouchScroll(root);
  const spacing = useSpacing(root);

  useEffect(() => {
    setProgressTarget(document.getElementById(`balance-progress-${stateKey}`));
  }, [stateKey]);

  const solved = balanceSolvedCount(scales, placements);
  const encoded = encodeBalance(placements);
  const holding = useStageCorrectHold({
    complete: solved > current && current < BAL_SCALES - 1,
    finalStage: false,
    locked: locked || submitted.current,
    stateKey,
    onAdvance: () => setCurrentStage(Math.min(current + 1, BAL_SCALES - 1)),
  });

  useEffect(() => {
    setSelected(null);
    lastTap.current = null;
  }, [solved]);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (solved === BAL_SCALES) {
      submitted.current = true;
      playLock();
      onSubmit(encoded);
      return;
    }
    if (now < phaseStartedAt + BAL_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encoded);
  }, [now, phaseStartedAt, locked, data, encoded, onSubmit, solved]);

  if (!data) return null;
  const scale = scales[current]!;
  const placement = placements[current] ?? scale.tray.map(() => null);
  const frozen = locked || submitted.current || holding;

  const setCurrent = (next: Placement) => {
    if (frozen) return;
    const all = placements.map((p, i) => (i === current ? next : p));
    setPlacements(all);
    if (scaleSolved(scale, next)) playCorrect();
  };


  const available = (tray: number) => Array.from({ length: BAL_PEGS }, (_, peg) => peg).filter((peg) =>
    !scale.fixed.some((f) => f.peg === peg) && !placement.some((p, i) => i !== tray && p === peg));
  const hang = (tray: number, peg: number) => {
    if (!available(tray).includes(peg)) return;
    // Button taps update the same placement array encoded for server torque validation.
    const next = [...placement]; next[tray] = peg;
    setSelected(null); hapticTick(); setCurrent(next);
  };
  const tapWeight = (tray: number) => {
    if (frozen) return;
    const previous = lastTap.current;
    const isDouble = placement[tray] !== null && previous?.tray === tray && Date.now() - previous.time < 350;
    lastTap.current = isDouble ? null : { tray, time: Date.now() };
    if (isDouble) {
      const next = [...placement]; next[tray] = null;
      setSelected(null); hapticTick(); setCurrent(next);
    } else {
      setSelected((current) => current === tray ? null : tray);
    }
  };

  const trayLeft = scale.tray.map((_, i) => i).filter((i) => placement[i] === null);
  const disc = Math.min(40, spacing - 2);

  return (
    <div
      ref={root}
      className="flex min-h-0 w-full flex-1 flex-col items-center gap-3"
      style={NO_SCROLL_STYLE}
    >
      {progressTarget && createPortal(
        <div className="flex h-3 w-full shrink-0 gap-1.5 px-4" aria-label={`${solved} of ${BAL_SCALES} scales balanced`}>
          {Array.from({ length: BAL_SCALES }, (_, i) => (
            <span key={i} className={`h-3 flex-1 rounded-full ${i < solved ? "bg-primary" : i === current ? "bg-primary/35" : "bg-border"}`} />
          ))}
        </div>, progressTarget,
      )}
      <div className="relative min-h-0 w-full flex-1">
        <div className="absolute left-1/2" style={{ top: "calc(50% - 50px)", transform: "translate(-50%, -42px)" }}>
          <StageCorrect visible={holding} />
          <Beam
            scale={scale}
            placement={placement}
            spacing={spacing}
            selected={selected}
            showControls
            onWeightTap={tapWeight}
            onPlace={(peg) => { if (selected !== null && !frozen) hang(selected, peg); }}
          />
        </div>
        <p className="absolute inset-x-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground" style={{ bottom: 108 }}>
          scale {current + 1} / {BAL_SCALES}
        </p>
        <div className="absolute inset-x-0 flex min-h-[48px] flex-wrap justify-center gap-3" style={{ bottom: 56 }}>
          {trayLeft.map((i) => (
            <span
              key={i}
              onClick={() => tapWeight(i)}
              className={selected === i ? "rounded-full ring-2 ring-primary shadow-[0_0_16px_var(--primary)]" : ""}
            >
              <Disc value={scale.tray[i]!} fixed={false} size={44} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "balance") return null;
  const placements = decodeBalance(myAnswer ?? "", puzzle.scales);
  const solved = balanceSolvedCount(puzzle.scales, placements);
  const elapsed = myMsRemaining === undefined ? null : ((timeLimitMs - myMsRemaining) / 1000).toFixed(1);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-6 overflow-y-auto py-1">
      {puzzle.scales.map((scale, s) => {
        const ok = s < solved;
        const solution = puzzle.solutions?.[s];
        return (
          <div key={s} className="flex shrink-0 flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className={`font-mono text-base font-bold ${ok ? "text-primary" : "text-warn"}`}>{ok ? "✓" : "✗"}</span>
              <Beam scale={scale} placement={placements[s] ?? []} spacing={30} />
            </div>
            {!ok && solution && (
              <div className="flex flex-col items-center opacity-80">
                <span className="text-xs text-muted-foreground">One balanced way</span>
                <Beam scale={scale} placement={solution} spacing={26} />
              </div>
            )}
          </div>
        );
      })}
      <p className={`text-center font-mono text-base font-bold ${solved === BAL_SCALES ? "text-primary" : "text-foreground"}`}>
        {solved === BAL_SCALES ? `3 / 3${elapsed ? ` · ${elapsed}s` : ""}` : `${solved} / 3`}
      </p>
    </div>
  );
}

export const balancePuzzle: PuzzleDefinition = {
  key: "balance",
  name: "Balance",
  category: "number",
  timeLimitMs: BAL_TIME_MS,
  revealMs: BAL_REVEAL_MS,
  generate: () =>
    ({
      type: "balance",
      scales: [
        { fixed: [{ peg: 1, w: 2 }], tray: [1, 4] },
        { fixed: [{ peg: 1, w: 2 }], tray: [1, 4] },
        { fixed: [{ peg: 1, w: 2 }], tray: [1, 4] },
      ],
    }) satisfies BalancePuzzleData,
  check: () => false,
  revealHeading: "Your scales",
  IntroExample,
  Stage,
  Reveal,
};
