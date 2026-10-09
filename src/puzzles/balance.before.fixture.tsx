import { Kettlebell } from "@/components/puzzles/refreshIcons.before.fixture";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
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

const PEG_GAP = 0;
const MIN_PEG_WIDTH = 44;
const pegDistanceLabel = (peg: number) => (peg < 4 ? 4 - peg : peg - 3);

function Disc({ value, fixed, size }: { value: number; fixed: boolean; size: number }) {
  return <Kettlebell value={value} fixed={fixed} size={size} />;
}

function Beam({ scale, placement, spacing, onWeightTap, onPlace, selected, showControls = false }: {
  scale: BalanceScale; placement: Placement; spacing: number;
  onWeightTap?: (tray: number) => void; onPlace?: (peg: number) => void;
  selected?: number | null; showControls?: boolean;
}) {
  const tilt = balanceTilt(scale, placement);
  const balanced = scaleSolved(scale, placement);
  const width = spacing * BAL_PEGS;
  const onPeg = new Map<number, { w: number; fixed: boolean; tray?: number }>();
  scale.fixed.forEach(f => onPeg.set(f.peg, { w: f.w, fixed: true }));
  placement.forEach((peg, i) => {
    const w = scale.tray[i];
    if (peg !== null && w !== undefined) onPeg.set(peg, { w, fixed: false, tray: i });
  });
  const offset = (peg: number) => Math.tan(tilt * Math.PI / 180) * ((peg + .5) * spacing - width / 2);
  return <div className="balance-instrument relative" style={{ width, height: showControls ? 144 : 126 }}>
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${showControls ? 144 : 126}`} aria-hidden="true">
      <path d={`M${width/2-10} 45 L${width/2+10} 45 L${width/2+17} 121 L${width/2-17} 121Z`} className="balance-metal"/>
      <path d={`M${width/2-34} 119h68l8 9h-84Z`} className="balance-metal"/>
      <path d={`M${width/2} 45v68`} stroke="var(--balance-highlight)" strokeWidth="2"/>
      <g transform={`rotate(${tilt} ${width/2} 32)`}>
        <rect x="1" y="27" width={width-2} height="10" rx="3" className="balance-metal"/>
        <path d={`M4 29H${width-4}`} stroke="var(--balance-highlight)" strokeWidth="1"/>
      </g>
      <circle cx={width/2} cy="39" r="5" fill={balanced ? 'var(--primary)' : 'var(--balance-handle)'}/>
    </svg>
    {Array.from({ length: BAL_PEGS }, (_, peg) => {
      const item = onPeg.get(peg), available = selected != null && !item;
      return <div key={peg} className="absolute top-0" style={{ left: peg * spacing, width: spacing, transform: `translateY(${offset(peg)}px)`, transition: 'transform 150ms ease-out' }}>
        {showControls ? <Button type="button" variant="ghost" onClick={() => { if (available) onPlace?.(peg); }}
          aria-label={`Place at distance ${pegDistanceLabel(peg)} on the ${peg < 4 ? 'left' : 'right'}`} aria-disabled={!available}
          className={`balance-notch h-11 w-full min-w-0 px-0 font-mono text-sm ${available ? 'text-primary' : 'text-foreground'}`}>
          <span className={available ? 'balance-notch-label balance-notch-active' : 'balance-notch-label'}>{pegDistanceLabel(peg)}</span>
        </Button> : <div className="flex h-11 items-center justify-center font-mono text-sm text-foreground"><span className="balance-notch-label">{pegDistanceLabel(peg)}</span></div>}
        {item && <div className="flex flex-col items-center">
          <span className="balance-chain h-2 w-px"/>
          {item.fixed ? <Disc value={item.w} fixed size={Math.min(44, spacing)} /> : <Button variant="ghost" className={`h-11 w-full min-w-0 p-0 ${item.tray === selected ? 'ring-2 ring-primary' : ''}`} onClick={() => { if (item.tray !== undefined) onWeightTap?.(item.tray); }} aria-label={`Select weight ${item.w}`}><Disc value={item.w} fixed={false} size={Math.min(44, spacing)}/></Button>}
        </div>}
      </div>;
    })}
  </div>;
}

function IntroExample() {
  const scale: BalanceScale = { fixed: [{ peg: 1, w: 2 }], tray: [3] };
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Beam scale={scale} placement={[5]} spacing={30} />
      <p className="text-center text-xs text-muted-foreground">2 × 3 on the left equals 3 × 2 on the right.</p>
    </div>
  );
}

function useSpacing(ref: React.RefObject<HTMLDivElement | null>): number {
  const [spacing, setSpacing] = useState(44);
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
  const column = useGameColumnLayout();
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
  const scale = scales[current];
  if (!scale) return null;
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

  return (
    <div
      ref={root}
      data-stage-column="3" className="flex min-h-0 w-full flex-1 flex-col items-center gap-3"
      style={NO_SCROLL_STYLE}
    >
      {progressTarget && createPortal(
        <div className="flex h-3 w-full shrink-0 gap-1.5 px-4" aria-label={`${solved} of ${BAL_SCALES} scales balanced`}>
          {Array.from({ length: BAL_SCALES }, (_, i) => (
            <span key={i} className={`h-3 flex-1 rounded-full ${i < solved ? "bg-primary" : i === current ? "bg-primary/35" : "bg-border"}`} />
          ))}
        </div>, progressTarget,
      )}
      {column ? (
        <>
          {/* Column layout: beam arena, then the scale counter and tray in flow 12px below. */}
          <div data-game-arena="balance" className="relative min-h-[140px] w-full">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
          </div>
          <div data-game-controls="tray" className="flex w-full shrink-0 flex-col items-center gap-3">
            <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
              scale {current + 1} / {BAL_SCALES}
            </p>
            <div className="flex min-h-[48px] w-full flex-wrap justify-center gap-3">
              {trayLeft.map((i) => (
                <Button variant="ghost"
                  key={i}
                  aria-label={`Select weight ${scale.tray[i] ?? 0}`}
                  onClick={() => tapWeight(i)}
                  className={`h-11 w-11 p-0 ${selected === i ? "ring-2 ring-primary" : ""}`}
                >
                  <Disc value={scale.tray[i] ?? 0} fixed={false} size={44} />
                </Button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="relative min-h-0 w-full flex-1">
          <div className="absolute left-1/2" style={{ top: "calc(50% - 74px)", transform: "translate(-50%, -42px)" }}>
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
              <Button variant="ghost"
                key={i}
                aria-label={`Select weight ${scale.tray[i] ?? 0}`}
                onClick={() => tapWeight(i)}
                className={`h-11 w-11 p-0 ${selected === i ? "ring-2 ring-primary" : ""}`}
              >
                <Disc value={scale.tray[i] ?? 0} fixed={false} size={44} />
              </Button>
            ))}
          </div>
        </div>
      )}
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
  name: gameDisplayName("balance"),
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
