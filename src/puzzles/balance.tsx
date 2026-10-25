import { BALANCE_CSS, BALANCE_DEFS, IronKettlebell, ScalesLevelFx } from "@/components/puzzles/balanceArt";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useReducedMotion } from "@/lib/motion";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { Button } from "@/components/ui/button";
import { StageCorrect, useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import {
  BAL_REVEAL_MS,
  BAL_TIME_MS,
  balanceScaleCount,
  balanceScalesSolved,
  balanceSolvedCount,
  balanceTilt,
  decodeBalance,
  encodeBalance,
  pegDistance,
  pegIsLeft,
  scalePegs,
  scaleSolved,
  type Placement,
} from "@/lib/duel/balance";
import { useStageState } from "@/lib/duel/stageState";
import { balancePlaceLimits, joinCountSuffix, limitText, splitCountSuffix } from "@/lib/duel/moveLimits";
import type { BalancePuzzleData, BalanceScale } from "@/lib/duel/types";
import { playCorrect, playLock } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { useGoalProgress } from "@/components/duel/GameFrame";
import { LiveSummary } from "@/components/puzzles/batchW/LiveSummary";
import "@/polish-layout/batch-w-balance.css";

const PEG_GAP = 0;
const MIN_PEG_WIDTH = 44;
/** balanceRev 2's 10-notch scale: ten notches must fit a 375 px phone, so each may narrow to this. */
const MIN_WIDE_PEG_WIDTH = 32;

function Disc({ value, fixed, width, height }: { value: number; fixed: boolean; width: number; height: number }) {
  return <IronKettlebell value={value} fixed={fixed} width={width} height={height} />;
}

function BalanceArt() {
  return <>
    <PolishStyle id="balance" css={BALANCE_CSS} />
    {BALANCE_DEFS}
  </>;
}

/** Below this the existing ±12° tilt is too faint to see, so unbalanced beams show at least this much. */
const MIN_VISIBLE_TILT = 5;
function visibleTilt(scale: BalanceScale, placement: Placement): number {
  if (scaleSolved(scale, placement)) return 0;
  const tilt = balanceTilt(scale, placement);
  if (tilt === 0) return 0;
  return Math.sign(tilt) * Math.min(12, Math.max(MIN_VISIBLE_TILT, Math.abs(tilt)));
}

/** Render-only beam tilt and peg offsets: a quick ease with a small settle past level. */
const TILT_EASE = "transform 260ms cubic-bezier(.34,1.4,.55,1)";

function Beam({ scale, placement, spacing, onWeightTap, onPlace, selected, showControls = false, height, compact = false, solving = false }: {
  scale: BalanceScale; placement: Placement; spacing: number;
  onWeightTap?: (tray: number) => void; onPlace?: (peg: number) => void;
  selected?: number | null; showControls?: boolean;
  /** Total drawing height; the beam sits a little above the middle. */
  height?: number;
  /** Reveal: a short stand, so three beams fit one screen. */
  compact?: boolean;
  /** The completion moment: the brass shines along its length. */
  solving?: boolean;
}) {
  const tilt = visibleTilt(scale, placement);
  const balanced = scaleSolved(scale, placement);
  const pegs = scalePegs(scale);
  const width = spacing * pegs;
  const big = height !== undefined;
  const weight = big ? 52 : Math.min(44, spacing);
  // A weight's art is exactly its button: 44 × 52 on the live beam, 44 × 44 in the old layout.
  const bellW = big ? spacing : weight;
  const bellH = big ? 52 : showControls ? weight : Math.round(weight * 52 / 44);
  const beamY = height !== undefined ? Math.max(32, Math.round(height * 0.36)) : compact ? 24 : 32;
  const H = height ?? (compact ? beamY + 12 + 8 + bellH + 6 : showControls ? 144 : 126);
  const standW = big ? 10 : 6;
  const baseW = big ? 58 : compact ? 30 : 34;
  const baseH = big ? 12 : 7;
  const barH = big ? 12 : 8;
  const labelW = Math.min(28, spacing - 6);
  const clipId = `bal-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const onPeg = new Map<number, { w: number; fixed: boolean; tray?: number }>();
  scale.fixed.forEach(f => onPeg.set(f.peg, { w: f.w, fixed: true }));
  placement.forEach((peg, i) => {
    const w = scale.tray[i];
    if (peg !== null && w !== undefined) onPeg.set(peg, { w, fixed: false, tray: i });
  });
  const offset = (peg: number) => Math.tan(tilt * Math.PI / 180) * ((peg + .5) * spacing - width / 2);
  const cx = width / 2;
  const top = beamY + barH / 2;
  const fx = showControls ? solving ? " bal-solving" : balanced ? " bal-level" : "" : "";
  // Reveal: a tilted beam swings its end labels up and its weights down past the box, so the compact
  // beam reserves that room and the caption below (or the beam above) stays clear.
  const offsets = Array.from({ length: pegs }, (_, peg) => offset(peg));
  // Less the room the box already has: 3px above a label's top, 6px under a hanging weight.
  const rise = compact ? Math.max(0, Math.ceil(Math.max(0, ...offsets.map((o) => -o))) - 3) : 0;
  const drop = compact ? Math.max(0, Math.ceil(Math.max(0, ...[...onPeg.keys()].map(offset))) - 6) : 0;
  return <div className={`balance-instrument relative${fx}`} style={{ width, height: H, marginTop: rise || undefined, marginBottom: drop || undefined }}>
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
      <ellipse cx={cx} cy={H - 1.5} rx={baseW + 8} ry={big ? 4 : 2.5} fill="#000" opacity="0.4"/>
      <path d={`M${cx - standW} ${top + 10} L${cx + standW} ${top + 10} L${cx + standW + 5} ${H - baseH} L${cx - standW - 5} ${H - baseH}Z`} fill="url(#bal-column)" stroke="#0B0D10" strokeWidth="1"/>
      <rect x={cx - standW - 3} y={top + 10} width={standW * 2 + 6} height={big ? 5 : 3} rx="1.5" fill="url(#bal-brass-h)"/>
      <rect x={cx - standW - 8} y={H - baseH - (big ? 6 : 4)} width={standW * 2 + 16} height={big ? 6 : 4} rx="2" fill="url(#bal-brass-h)"/>
      <path d={`M${cx - baseW} ${H - 1}L${cx - baseW + 6} ${H - baseH}H${cx + baseW - 6}L${cx + baseW} ${H - 1}Z`} fill="url(#bal-wood)" stroke="#1A0F06" strokeWidth="1"/>
      <path d={`M${cx - baseW + 7} ${H - baseH + 1.5}H${cx + baseW - 7}`} stroke="#E6BE6A" strokeOpacity="0.55" strokeWidth="1"/>
      <path d={`M${cx - 8} ${top + 11} L${cx + 8} ${top + 11} L${cx} ${beamY}Z`} fill="url(#bal-brass)" stroke="#5A3A0C" strokeWidth="0.8"/>
      <g className="bal-tilt" style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${cx}px ${beamY}px`, transition: TILT_EASE }}>
        <rect className="bal-beam-rect" x="2" y={beamY - barH / 2} width={width - 4} height={barH} rx={barH / 2.5} fill="url(#bal-brass)" stroke="#5A3A0C" strokeWidth="1"/>
        <path d={`M${barH / 2} ${beamY - barH / 2 + 1.5}H${width - barH / 2}`} stroke="#FFF6D6" strokeOpacity="0.75" strokeWidth="1"/>
        <path d={`M${barH / 2} ${beamY + barH / 2 - 2}H${width - barH / 2}`} stroke="#4A2F08" strokeOpacity="0.45" strokeWidth="1"/>
        {Array.from({ length: pegs - 1 }, (_, i) => i + 1).filter((peg) => peg !== pegs / 2).map((peg) => {
          const x = peg * spacing, h = barH / 2 - 1.5;
          return <g key={peg}>
            <path d={`M${x} ${beamY - h}V${beamY + h}`} stroke="#3E2805" strokeWidth="1.4"/>
            <path d={`M${x + 1.2} ${beamY - h}V${beamY + h}`} stroke="#FFF1C2" strokeOpacity="0.55" strokeWidth="0.8"/>
          </g>;
        })}
        <circle cx={big ? 5 : 4} cy={beamY} r={big ? 6.5 : 4.5} fill="url(#bal-brass)" stroke="#5A3A0C" strokeWidth="1"/>
        <circle cx={width - (big ? 5 : 4)} cy={beamY} r={big ? 6.5 : 4.5} fill="url(#bal-brass)" stroke="#5A3A0C" strokeWidth="1"/>
        {showControls && <>
          <clipPath id={clipId}><rect x="2" y={beamY - barH / 2} width={width - 4} height={barH} rx={barH / 2.5}/></clipPath>
          <g clipPath={`url(#${clipId})`}>
            <rect className="bal-beam-shine" x="0" y={beamY - barH / 2} width="64" height={barH} fill="url(#bal-shine)"
              style={{ ["--sweep-from" as string]: "-70px", ["--sweep-to" as string]: `${width + 6}px` }}/>
          </g>
        </>}
      </g>
      <circle className="bal-boss-glow" cx={cx} cy={beamY} r={big ? 11 : 7} fill="var(--primary)" opacity="0.4"/>
      <circle cx={cx} cy={beamY} r={big ? 5 : 3.5} fill={balanced ? "var(--primary)" : "url(#bal-brass-h)"} stroke="#3E2805" strokeWidth="1"/>
    </svg>
    {Array.from({ length: pegs }, (_, peg) => {
      const item = onPeg.get(peg), available = selected != null && !item;
      return <div key={peg} className="absolute flex flex-col items-center" style={{ top: beamY - 32, left: peg * spacing, width: spacing, transform: `translateY(${offset(peg)}px)`, transition: TILT_EASE }}>
        {showControls ? <Button type="button" variant="ghost" onClick={() => { if (available) onPlace?.(peg); }}
          aria-label={`Place at distance ${pegDistance(peg, pegs)} on the ${pegIsLeft(peg, pegs) ? 'left' : 'right'}`} aria-disabled={!available}
          className="balance-notch h-11 w-full min-w-0 px-0 font-mono text-sm">
          <span className={available ? 'bal-notch-label bal-notch-active' : 'bal-notch-label'} style={{ width: labelW }}>{pegDistance(peg, pegs)}</span>
        </Button> : <div className="flex h-11 w-full items-center justify-center font-mono text-sm"><span className="bal-notch-label" style={{ width: labelW }}>{pegDistance(peg, pegs)}</span></div>}
        {item && <div key={item.fixed ? 'f' : `t${item.tray}`} className={`flex flex-col items-center ${showControls && !item.fixed ? 'bal-drop' : ''}`}>
          <svg className="bal-hook" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0V3.2a2.1 2.1 0 1 1-2.1 2.1" fill="none" stroke="#D9A940" strokeWidth="1.6" strokeLinecap="round"/></svg>
          {item.fixed ? <Disc value={item.w} fixed width={bellW} height={bellH} /> : <Button variant="ghost" className={`min-w-0 p-0 ${big ? 'h-[52px]' : 'h-11'} w-full hover:bg-transparent ${item.tray === selected ? 'ring-2 ring-primary' : ''}`} onClick={() => { if (item.tray !== undefined) onWeightTap?.(item.tray); }} aria-label={`Select weight ${item.w}`}><Disc value={item.w} fixed={false} width={bellW} height={bellH}/></Button>}
        </div>}
      </div>;
    })}
  </div>;
}

function useHeight(ref: React.RefObject<HTMLDivElement | null>): number {
  const [h, setH] = useState(0);
  useBeforePaint(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setH(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return h;
}

function IntroExample() {
  const scale: BalanceScale = { fixed: [{ peg: 1, w: 2 }], tray: [3] };
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <BalanceArt />
      <Beam scale={scale} placement={[5]} spacing={30} />
      <p className="text-center text-xs text-muted-foreground">2 × 3 on the left equals 3 × 2 on the right.</p>
    </div>
  );
}

/** Notch width for the current scale: 44 px on 8 notches; a 10-notch scale shares the width, down to 32 px. */
function useSpacing(ref: React.RefObject<HTMLDivElement | null>, pegs: number): number {
  const [spacing, setSpacing] = useState(44);
  useBeforePaint(() => {
    const el = ref.current;
    if (!el) return;
    const min = pegs > 8 ? MIN_WIDE_PEG_WIDTH : MIN_PEG_WIDTH;
    const measure = () => setSpacing(Math.max(min, Math.min(44, Math.floor((el.clientWidth - PEG_GAP * (pegs - 1)) / pegs))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, pegs]);
  return spacing;
}

/** Live instrument height: as tall as the bench allows, within a readable range. */
const beamHeightFor = (arenaHeight: number) => Math.min(300, Math.max(146, arenaHeight - 56));

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, stateKey = "balance" }: PuzzleStageProps) {
  const column = useGameColumnLayout();
  const reduced = useReducedMotion();
  const data: BalancePuzzleData | null = puzzle.type === "balance" ? puzzle : null;
  const scales = data?.scales ?? [];
  // balanceRev 2: four scales and the puzzle's own 120 s; stored rounds three scales and the registry's 90 s.
  const total = data ? balanceScaleCount(data) : 3;
  const limitMs = data?.timeLimitMs ?? BAL_TIME_MS;
  const [placements, setPlacements] = useStageState<Placement[]>(stateKey, "placements", () =>
    scales.map((s) => s.tray.map(() => null)),
  );
  // balanceRev 1 (moveLimits.ts): a visible hang limit per scale; a scale out of hangs ends unbalanced and the next one starts.
  const placeLimits = data ? balancePlaceLimits(data) : null;
  const [hangs, setHangs] = useStageState<number[]>(stateKey, "balanceHangs", () => scales.map(() => 0));
  const [selected, setSelected] = useState<number | null>(null);
  const [current, setCurrentStage] = useStageState<number>(stateKey, "balanceStage", () => Math.min(balanceSolvedCount(scales, placements), total - 1));
  const [progressTarget, setProgressTarget] = useState<HTMLElement | null>(null);
  // Set by the move that balances the last scale (never on a restore), to start the completion effect.
  const [solvedHere, setSolvedHere] = useState(false);
  const solveFx = useSolveFx(solvedHere, "balance.solve", 1100);
  const lastTap = useRef<{ tray: number; time: number } | null>(null);
  const submitted = useRef(false);
  const root = useRef<HTMLDivElement | null>(null);
  useNoTouchScroll(root);
  const spacing = useSpacing(root, scales[current] ? scalePegs(scales[current]!) : 8);
  const arena = useRef<HTMLDivElement | null>(null);
  const arenaHeight = useHeight(arena);

  // Polish batch W: in a live round the frame's goal line shows the scale; the old pip bar is not drawn.
  const inFrame = useGoalProgress({ done: current, total, text: `Scale ${current + 1} of ${total}` });

  useEffect(() => {
    setProgressTarget(inFrame ? null : document.getElementById(`balance-progress-${stateKey}`));
  }, [stateKey, inFrame]);

  const verdicts = balanceScalesSolved(scales, placements);
  // Limited boards credit each scale on its own (any order); stored rounds advance only past a balanced scale.
  const solved = placeLimits ? verdicts.filter(Boolean).length : balanceSolvedCount(scales, placements);
  const encoded = placeLimits ? joinCountSuffix(encodeBalance(placements), hangs) : encodeBalance(placements);
  const outOfHangs = !!placeLimits && !verdicts[current] && (hangs[current] ?? 0) >= (placeLimits[current] ?? 0);
  const allDone = placeLimits ? current >= total - 1 && (verdicts[current] || outOfHangs) : solved === total;
  const holding = useStageCorrectHold({
    complete: (placeLimits ? !!verdicts[current] : solved > current) && current < total - 1,
    finalStage: false,
    locked: locked || submitted.current,
    stateKey,
    onAdvance: () => setCurrentStage(Math.min(current + 1, total - 1)),
  });

  useEffect(() => {
    setSelected(null);
    lastTap.current = null;
  }, [solved, current]);

  useEffect(() => {
    // Out of hangs on a scale before the last: it ends unbalanced and the next scale starts.
    if (!outOfHangs || current >= total - 1 || locked || submitted.current) return;
    soundCue("balance.level");
    setCurrentStage(current + 1);
  }, [outOfHangs, current, total, locked, setCurrentStage]);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (allDone) {
      submitted.current = true;
      if (solved === total) playLock();
      onSubmit(encoded);
      return;
    }
    if (now < phaseStartedAt + limitMs - 400) return;
    submitted.current = true;
    onSubmit(encoded);
  }, [now, phaseStartedAt, limitMs, locked, data, encoded, onSubmit, solved, allDone, total]);

  if (!data) return null;
  const scale = scales[current];
  if (!scale) return null;
  const placement = placements[current] ?? scale.tray.map(() => null);
  const frozen = locked || submitted.current || holding || outOfHangs;

  const setCurrent = (next: Placement, hung = false) => {
    if (frozen) return;
    const all = placements.map((p, i) => (i === current ? next : p));
    setPlacements(all);
    if (hung && placeLimits) setHangs(hangs.map((n, i) => (i === current ? n + 1 : n)));
    if (scaleSolved(scale, next)) {
      playCorrect();
      if ((placeLimits ? balanceScalesSolved(scales, all).filter(Boolean).length : balanceSolvedCount(scales, all)) === total) setSolvedHere(true);
      else soundCue("balance.level");
    }
  };


  const available = (tray: number) => Array.from({ length: scalePegs(scale) }, (_, peg) => peg).filter((peg) =>
    !scale.fixed.some((f) => f.peg === peg) && !placement.some((p, i) => i !== tray && p === peg));
  const hang = (tray: number, peg: number) => {
    if (!available(tray).includes(peg)) return puzzleReject();
    // Button taps update the same placement array encoded for server torque validation.
    const next = [...placement]; next[tray] = peg;
    soundCue("balance.drop");
    setSelected(null); hapticTick(); setCurrent(next, true);
  };
  const tapWeight = (tray: number) => {
    if (frozen) return;
    const previous = lastTap.current;
    const isDouble = placement[tray] !== null && previous?.tray === tray && Date.now() - previous.time < 350;
    lastTap.current = isDouble ? null : { tray, time: Date.now() };
    if (isDouble) {
      const next = [...placement]; next[tray] = null;
      soundCue("balance.lift");
      setSelected(null); hapticTick(); setCurrent(next);
    } else {
      if (selected !== tray) soundCue("balance.select");
      setSelected((current) => current === tray ? null : tray);
    }
  };

  const trayLeft = scale.tray.map((_, i) => i).filter((i) => placement[i] === null);
  const beamHeight = beamHeightFor(arenaHeight);
  // The instrument stands on the bench: centred in the panel, with the desk from its base down.
  const beamTop = Math.max(26, Math.round((arenaHeight - beamHeight) / 2) + 8);
  const trayButtons = trayLeft.map((i) => (
    <Button variant="ghost"
      key={i}
      aria-label={`Select weight ${scale.tray[i] ?? 0}`}
      data-selected={selected === i}
      onClick={() => tapWeight(i)}
      className={`bal-tray-cup ${inFrame ? "h-16 w-16" : "h-14 w-14"} p-0`}
    >
      {/* A live round's cups are a size up (polish batch W); intros and demos keep main's. */}
      <Disc value={scale.tray[i] ?? 0} fixed={false} width={inFrame ? 50 : 44} height={inFrame ? 59 : 52} />
    </Button>
  ));

  // The live summary above the rack (polish batch W): the scale (outside the frame), hangs, balanced scales, the pick.
  const summary = (
    <LiveSummary
      testId="balance"
      parts={[
        !inFrame && `Scale ${current + 1} / ${total}`,
        placeLimits ? <>Hangs <span className={outOfHangs ? "text-warn" : "text-primary"} data-move-limit={placeLimits[current]}>{limitText(hangs[current] ?? 0, placeLimits[current] ?? 0)}</span></> : null,
        <><b>{solved}</b> of {total} balanced</>,
        selected !== null ? <>Weight <b>{scale.tray[selected] ?? 0}</b> picked</> : trayLeft.length ? `${trayLeft.length} to hang` : null,
      ]}
    />
  );

  return (
    <div
      ref={root}
      data-polish="balance"
      data-stage-column="3" className="flex min-h-0 w-full flex-1 flex-col items-center gap-3"
      style={NO_SCROLL_STYLE}
    >
      <BalanceArt />
      {progressTarget && createPortal(
        <div className="flex h-3 w-full shrink-0 gap-1.5 px-4" aria-label={`${solved} of ${total} scales balanced`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-3 flex-1 rounded-full ${(placeLimits ? verdicts[i] : i < solved) ? "bg-primary" : i === current ? "bg-primary/35" : "bg-border"}`} />
          ))}
        </div>, progressTarget,
      )}
      {column ? (
        <>
          {/* Column layout: the bench fills the space above the tray, which sits 12px below it. */}
          <div ref={arena} data-game-arena="balance" className="relative min-h-[170px] w-full">
            <div className="bal-panel pointer-events-none absolute inset-x-0 bottom-0 top-3">
              <div className="bal-table" style={{ top: beamTop + beamHeight - 28, height: "auto" }} />
            </div>
            <div className="absolute inset-x-0 top-4"><StageCorrect visible={holding} /></div>
            {solveFx && <ScalesLevelFx reduced={reduced} count={total} />}
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: beamTop }}>
              <Beam
                scale={scale}
                placement={placement}
                spacing={spacing}
                selected={selected}
                showControls
                solving={solveFx}
                height={beamHeight}
                onWeightTap={tapWeight}
                onPlace={(peg) => { if (selected !== null && !frozen) hang(selected, peg); }}
              />
            </div>
          </div>
          {/* The rack stands 16 px clear of the bottom of the screen. */}
          <div data-game-controls="tray" className="flex w-full shrink-0 flex-col items-center gap-1.5 pb-4">
            {summary}
            <div className="bal-rack flex min-h-[68px] w-full flex-wrap items-center justify-center gap-3 px-2 py-1.5">
              {trayButtons}
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
              solving={solveFx}
              onWeightTap={tapWeight}
              onPlace={(peg) => { if (selected !== null && !frozen) hang(selected, peg); }}
            />
          </div>
          <div className="absolute inset-x-0" style={{ bottom: 108 }}>{summary}</div>
          <div className="absolute inset-x-0 flex min-h-[48px] flex-wrap justify-center gap-3" style={{ bottom: 56 }}>
            {trayButtons}
          </div>
        </div>
      )}
    </div>
  );
}

/** Reveal notch width: three scales at 36 px; four (balanceRev 2) a little tighter so all four fit a 375 × 667 screen. */
const revealSpacing = (scale: BalanceScale, total: number) => (total > 3 ? (scalePegs(scale) > 8 ? 27 : 32) : 36);

const SIDE = (peg: number, pegs: number) => `${pegIsLeft(peg, pegs) ? "left" : "right"} ${pegDistance(peg, pegs)}`;

function Reveal({ timeLimitMs, puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "balance") return null;
  const placements = decodeBalance(myAnswer ?? "", puzzle.scales);
  const placeLimits = balancePlaceLimits(puzzle);
  const hangs = placeLimits ? splitCountSuffix(myAnswer).counts : [];
  // Limited rounds credit each scale on its own (hung within its limit); stored rounds count scales in order.
  const okAt = placeLimits ? balanceScalesSolved(puzzle.scales, placements).map((ok, s) => ok && (hangs[s] ?? 0) <= (placeLimits[s] ?? 0)) : null;
  const solved = okAt ? okAt.filter(Boolean).length : balanceSolvedCount(puzzle.scales, placements);
  const total = balanceScaleCount(puzzle);
  const elapsed = myMsRemaining === undefined ? null : ((timeLimitMs - myMsRemaining) / 1000).toFixed(1);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto py-1">
      <BalanceArt />
      <div className="bal-panel flex w-full max-w-[360px] shrink-0 flex-col items-center gap-2 px-2 py-2">
        {puzzle.scales.map((scale, s) => {
          const ok = okAt ? !!okAt[s] : s < solved;
          const solution = puzzle.solutions?.[s];
          return (
            <div key={s} className="flex shrink-0 flex-col items-center gap-0.5">
              <div className="flex items-center gap-2">
                <span className={`w-4 font-mono text-base font-bold ${ok ? "text-primary" : "text-warn"}`}>{ok ? "✓" : "✗"}</span>
                <Beam scale={scale} placement={placements[s] ?? []} spacing={revealSpacing(scale, total)} compact />
                <span className="w-4" />
              </div>
              {!ok && solution && (
                <p className="px-2 text-center text-sm leading-snug text-foreground">
                  <span className="text-[#E8D9B0]">One balanced way: </span>
                  {solution.map((peg, i) => peg === null ? null : `${scale.tray[i]} on ${SIDE(peg, scalePegs(scale))}`).filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className={`text-center font-mono text-base font-bold ${solved === total ? "text-primary" : "text-foreground"}`}>
        {solved === total ? `${total} / ${total}${elapsed ? ` · ${elapsed}s` : ""}` : `${solved} / ${total}`}
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
