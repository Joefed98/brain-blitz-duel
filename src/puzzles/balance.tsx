import { BALANCE_CSS, BALANCE_DEFS, IronKettlebell, ScalesLevelFx } from "@/components/puzzles/balanceArt";
import { NumberStage, numberArt, type StageExit } from "@/components/puzzles/number/overhaul";
import { balanceFreeMoves } from "@/lib/duel/numberOverhaul";
import { balanceHangCost, balanceTorqueText } from "@/lib/duel/numberOverhaulInput";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useReducedMotion } from "@/lib/motion";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { Button } from "@/components/ui/button";
import { useStageCorrectHold } from "@/components/puzzles/StageCorrect";
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
import { playLock, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { useGoalProgress } from "@/components/duel/GameFrame";
import { HudPills } from "@/components/puzzles/HudPills";
import "@/polish-layout/batch-w-balance.css";

const PEG_GAP = 0;
const MIN_PEG_WIDTH = 44;
/** A live round's widest notch (3 Nov 2026): the scale fills the panel on a 414 px phone. */
const LIVE_PEG_WIDTH = 50;
/** balanceRev 2's 10-notch scale: ten notches must fit a 375 px phone, so each may narrow to this. */
const MIN_WIDE_PEG_WIDTH = 32;

function Disc({ value, fixed, width, height, spill }: { value: number; fixed: boolean; width: number; height: number; spill?: number }) {
  return <IronKettlebell value={value} fixed={fixed} width={width} height={height} {...(spill ? { spill } : {})} />;
}

export function BalanceArt() {
  return <>
    <PolishStyle id="balance" css={BALANCE_CSS} />
    {BALANCE_DEFS}
  </>;
}

/** The stage's spoken status (the old CORRECT line, now heard only: the stage moment is the visible one). */
function StageStatus({ holding }: { holding: boolean }) {
  return <span className="sr-only" role="status" aria-live="polite">{holding ? "Balanced" : ""}</span>;
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
/** The Number overhaul: how long an out-of-hangs scale takes to grey and slide away before the next one. */
const FAIL_SLIDE_MS = 850;
/** How long the "Pick a weight first" nudge shows. */
const NUDGE_MS = 1400;

const TILT_EASE = "transform 260ms cubic-bezier(.34,1.4,.55,1)";

export function Beam({ scale, placement, spacing, onWeightTap, onPlace, onEmptyNotch, torque, selected, showControls = false, height, compact = false, solving = false }: {
  scale: BalanceScale; placement: Placement; spacing: number;
  onWeightTap?: (tray: number) => void; onPlace?: (peg: number) => void;
  /** A free notch tapped with no weight picked (the Number overhaul's "Pick a weight first" nudge). */
  onEmptyNotch?: () => void;
  /** balanceRev 4: the balance shown under the beam ("18 | 15"). */
  torque?: string | undefined;
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
  // A wider live notch (3 Nov 2026) grows the hung kettlebell with it, keeping its 44 × 52 shape.
  // The Number overhaul: a live beam's bells half as big again, spilling a little past their notch (the button is the notch).
  const bellH = big ? Math.max(72, Math.round(spacing * 52 / 44 * 1.4)) : showControls ? weight : Math.round(weight * 52 / 44);
  const spill = big ? 1.3 : 1;
  // The Number overhaul: a live beam sits a little lower on its column, so the wall below it isn't left empty.
  const beamY = height !== undefined ? Math.max(32, Math.round(height * 0.42)) : compact ? 24 : 32;
  const H = height ?? (compact ? beamY + 12 + 8 + bellH + 6 : showControls ? 144 : 126);
  // The Number overhaul (15 Nov 2026): a live round's instrument half as big again where the width allows: a thicker
  // beam, column and foot, wider notch tags (the notches' places and widths are unchanged).
  const standW = big ? 13 : 6;
  const baseW = big ? 74 : compact ? 30 : 34;
  const baseH = big ? 18 : 7;
  const barH = big ? 18 : 8;
  const labelW = big ? Math.min(40, spacing - 4) : Math.min(28, spacing - 6);
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
  return <div className={`balance-instrument relative${fx}${big ? " bal-big" : ""}`} style={{ width, height: H, marginTop: rise || undefined, marginBottom: drop || undefined }}>
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
      <ellipse cx={cx} cy={H - 1.5} rx={baseW + 8} ry={big ? 4 : 2.5} fill="#000" opacity="0.4"/>
      {/* The Number overhaul's rendered pieces (public/number/balance): the iron column, the brass foot on its plinth. */}
      <image href={numberArt("balance", "column")} x={cx - standW - 3} y={top - 2} width={standW * 2 + 6} height={H - baseH - top + 4} preserveAspectRatio="none"/>
      <image href={numberArt("balance", "foot")} x={cx - baseW} y={H - baseH - (big ? 8 : 5)} width={baseW * 2} height={baseH + (big ? 8 : 5)} preserveAspectRatio="none"/>
      <g className="bal-tilt" style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${cx}px ${beamY}px`, transition: TILT_EASE }}>
        <image className="bal-beam-rect" href={numberArt("balance", "beam")} x="0" y={beamY - barH / 2 - 1} width={width} height={barH + 2} preserveAspectRatio="none"/>
        {Array.from({ length: pegs - 1 }, (_, i) => i + 1).filter((peg) => peg !== pegs / 2).map((peg) => {
          const x = peg * spacing, h = barH / 2 - 1.5;
          return <g key={peg}>
            <path d={`M${x} ${beamY - h}V${beamY + h}`} stroke="#3E2805" strokeWidth="1.4"/>
            <path d={`M${x + 1.2} ${beamY - h}V${beamY + h}`} stroke="#FFF1C2" strokeOpacity="0.55" strokeWidth="0.8"/>
          </g>;
        })}
        {showControls && <>
          <clipPath id={clipId}><rect x="2" y={beamY - barH / 2} width={width - 4} height={barH} rx={barH / 2.5}/></clipPath>
          <g clipPath={`url(#${clipId})`}>
            <rect className="bal-beam-shine" x="0" y={beamY - barH / 2} width="64" height={barH} fill="url(#bal-shine)"
              style={{ ["--sweep-from" as string]: "-70px", ["--sweep-to" as string]: `${width + 6}px` }}/>
          </g>
        </>}
      </g>
      <image href={numberArt("balance", "pivot")} x={cx - (big ? 13 : 8)} y={beamY - (big ? 13 : 8)} width={big ? 26 : 16} height={big ? 26 : 16}/>
      {balanced && <circle cx={cx} cy={beamY} r={big ? 5 : 3.5} fill="var(--jz-gold)" stroke="#3E2805" strokeWidth="1"/>}
    </svg>
    {Array.from({ length: pegs }, (_, peg) => {
      const item = onPeg.get(peg), available = selected != null && !item;
      return <div key={peg} className="absolute flex flex-col items-center" style={{ top: beamY - 32, left: peg * spacing, width: spacing, transform: `translateY(${offset(peg)}px)`, transition: TILT_EASE }}>
        {showControls ? <Button type="button" variant="ghost" onClick={() => { if (available) onPlace?.(peg); else if (!item && selected == null) onEmptyNotch?.(); }}
          aria-label={`Place at distance ${pegDistance(peg, pegs)} on the ${pegIsLeft(peg, pegs) ? 'left' : 'right'}`} aria-disabled={!available}
          className="balance-notch h-11 w-full min-w-0 px-0 font-mono text-sm">
          <span className={available ? 'bal-notch-label bal-notch-active' : 'bal-notch-label'} style={{ width: labelW }}>{pegDistance(peg, pegs)}</span>
        </Button> : <div className="flex h-11 w-full items-center justify-center font-mono text-sm"><span className="bal-notch-label" style={{ width: labelW }}>{pegDistance(peg, pegs)}</span></div>}
        {item && <div key={item.fixed ? 'f' : `t${item.tray}`} className={`flex flex-col items-center ${showControls && !item.fixed ? 'bal-drop' : ''}`}>
          <svg className="bal-hook" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0V3.2a2.1 2.1 0 1 1-2.1 2.1" fill="none" stroke="#D9A940" strokeWidth="1.6" strokeLinecap="round"/></svg>
          {item.fixed ? <Disc value={item.w} fixed width={bellW} height={bellH} spill={spill} /> : <Button variant="ghost" style={big ? { height: bellH } : undefined} className={`min-w-0 p-0 ${big ? '' : 'h-11'} w-full hover:bg-transparent ${item.tray === selected ? 'ring-2 ring-primary' : ''}`} onClick={() => { if (item.tray !== undefined) onWeightTap?.(item.tray); }} aria-label={`Select weight ${item.w}`}><Disc value={item.w} fixed={false} width={bellW} height={bellH} spill={spill}/></Button>}
        </div>}
      </div>;
    })}
    {torque !== undefined && (
      <div data-balance-torque="" className="bal-torque" aria-label={`Left ${torque.split(" | ")[0]}, right ${torque.split(" | ")[1]}`}
        style={{ left: cx, top: beamY + 12 + 8 + bellH + (big ? 18 : 10) }}>
        <span>{torque.split(" | ")[0]}</span><i aria-hidden="true">|</i><span>{torque.split(" | ")[1]}</span>
      </div>
    )}
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
function useSpacing(ref: React.RefObject<HTMLDivElement | null>, pegs: number, max = 44): number {
  const [spacing, setSpacing] = useState(44);
  useBeforePaint(() => {
    const el = ref.current;
    if (!el) return;
    const min = pegs > 8 ? MIN_WIDE_PEG_WIDTH : MIN_PEG_WIDTH;
    const measure = () => setSpacing(Math.max(min, Math.min(max, Math.floor((el.clientWidth - PEG_GAP * (pegs - 1)) / pegs))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, pegs, max]);
  return spacing;
}

/** Live instrument height: as tall as the bench allows, within a readable range (a live round up to 400, 3 Nov 2026). */
const beamHeightFor = (arenaHeight: number, max = 300) => Math.min(max, Math.max(146, arenaHeight - 56));

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
  // balanceRev 4 (the Number overhaul): only new hangs count, a hung weight is picked up with one tap and moved free.
  const freeMoves = balanceFreeMoves(data);
  // Display only: a notch tapped with nothing picked nudges the tray ("Pick a weight first").
  const [nudge, setNudge] = useState(0);
  const [nudgeShown, setNudgeShown] = useState(false);
  useEffect(() => {
    if (nudge === 0) return;
    setNudgeShown(true);
    const timer = setTimeout(() => setNudgeShown(false), NUDGE_MS);
    return () => clearTimeout(timer);
  }, [nudge]);
  // Display only: an out-of-hangs scale greys and slides away before the next one (the shared fail moment).
  const [failing, setFailing] = useState<number | null>(null);
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
  const arena = useRef<HTMLDivElement | null>(null);
  const arenaHeight = useHeight(arena);

  // Polish batch W: in a live round the frame's goal line shows the scale; the old pip bar is not drawn.
  const inFrame = useGoalProgress({ done: current, total, text: `Scale ${current + 1} of ${total}` });
  // Puzzle polish (3 Nov 2026, display only): in a live round the notches widen into the panel's width (up to
  // LIVE_PEG_WIDTH) and the kettlebells grow with them; intros and demos keep 44 px, so recorded touches still land.
  const spacing = useSpacing(root, scales[current] ? scalePegs(scales[current]!) : 8, inFrame ? LIVE_PEG_WIDTH : 44);

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
    // Game review fix (15 Nov 2026): out of hangs is a failed scale, so it never plays the balanced sound. The Number
    // overhaul: the scale greys and slides away (the shared fail moment), then the next
    // scale starts. The sound stays the fail sound (playWrong; the slide below is silent, number-word-review-fixes-check).
    playWrong();
    setFailing(current);
    const timer = setTimeout(() => {
      setFailing(null);
      setCurrentStage(current + 1);
    }, FAIL_SLIDE_MS);
    return () => clearTimeout(timer);
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
      // The Number overhaul: one sound a moment. A scale before the last plays the shared stage moment
      // (`balance.stageClear`, NumberStage); the last plays the solve (useSolveFx) and the lock.
      if ((placeLimits ? balanceScalesSolved(scales, all).filter(Boolean).length : balanceSolvedCount(scales, all)) === total) setSolvedHere(true);
    }
  };


  const available = (tray: number) => Array.from({ length: scalePegs(scale) }, (_, peg) => peg).filter((peg) =>
    !scale.fixed.some((f) => f.peg === peg) && !placement.some((p, i) => i !== tray && p === peg));
  const hang = (tray: number, peg: number) => {
    if (!available(tray).includes(peg)) return puzzleReject();
    // Button taps update the same placement array encoded for server torque validation.
    const next = [...placement]; next[tray] = peg;
    soundCue("balance.drop");
    // Older stamps count every placement; balanceRev 4 counts only a weight hung from the tray.
    setSelected(null); setCurrent(next, balanceHangCost(placement, tray, peg, freeMoves) === 1);
  };
  const toTray = (tray: number) => {
    const next = [...placement]; next[tray] = null;
    soundCue("balance.lift");
    setSelected(null); setCurrent(next);
  };
  const tapWeight = (tray: number) => {
    if (frozen) return;
    if (freeMoves) {
      // balanceRev 4: one tap picks a hung weight up (a free notch then moves it there, free); tapping the picked
      // hung weight again puts it back on the tray.
      if (selected === tray) {
        if (placement[tray] !== null) toTray(tray);
        else setSelected(null);
        return;
      }
      soundCue(placement[tray] !== null ? "balance.pickup" : "balance.select");
      setSelected(tray);
      return;
    }
    const previous = lastTap.current;
    const isDouble = placement[tray] !== null && previous?.tray === tray && Date.now() - previous.time < 350;
    lastTap.current = isDouble ? null : { tray, time: Date.now() };
    if (isDouble) {
      const next = [...placement]; next[tray] = null;
      soundCue("balance.lift");
      setSelected(null); setCurrent(next);
    } else {
      if (selected !== tray) soundCue("balance.select");
      setSelected((current) => current === tray ? null : tray);
    }
  };

  const trayLeft = scale.tray.map((_, i) => i).filter((i) => placement[i] === null);
  const emptyNotch = () => {
    if (frozen) return;
    soundCue("balance.nudge");
    setNudge((n) => n + 1);
  };
  // balanceRev 4: a hung weight picked up goes back to the tray when the tray is tapped.
  const tapRack = () => {
    if (!freeMoves || frozen || selected === null || placement[selected] === null) return;
    toTray(selected);
  };
  const exit: StageExit = failing === current ? "fail" : holding ? "clear" : null;
  const torque = freeMoves ? balanceTorqueText(scale, placement) : undefined;
  const beamHeight = beamHeightFor(arenaHeight, inFrame ? 400 : 300);
  // The instrument stands on the bench: centred in the panel, with the desk from its base down.
  const beamTop = Math.max(26, Math.round((arenaHeight - beamHeight) / 2) + 8);
  const trayButtons = trayLeft.map((i) => (
    <Button variant="ghost"
      key={i}
      aria-label={`Select weight ${scale.tray[i] ?? 0}`}
      data-selected={selected === i}
      onClick={(event) => { event.stopPropagation(); tapWeight(i); }}
      className={`bal-tray-cup ${inFrame ? "h-[72px] w-[72px]" : "h-14 w-14"} p-0`}
    >
      {/* A live round's cups are a size up (polish batch W, again 3 Nov 2026); intros and demos keep main's. */}
      <Disc value={scale.tray[i] ?? 0} fixed={false} width={inFrame ? 60 : 44} height={inFrame ? 72 : 52} />
    </Button>
  ));

  // The live status above the rack (puzzle polish, 3 Nov 2026): one label-and-value pill per figure.
  const summary = (
    <HudPills
      testId="balance"
      items={[
        !inFrame && { id: "scale", label: "Scale", value: `${current + 1} / ${total}` },
        placeLimits && { id: "hangs", label: "Hangs", ...(placeLimits[current] !== undefined ? { limit: placeLimits[current] } : {}), value: limitText(hangs[current] ?? 0, placeLimits[current] ?? 0), tone: outOfHangs ? "warn" as const : "gold" as const },
        { id: "balanced", label: "Balanced", value: `${solved} / ${total}` },
        selected !== null
          ? { id: "pick", label: "Picked", value: scale.tray[selected] ?? 0, tone: "gold" as const }
          : trayLeft.length ? { id: "pick", label: "To hang", value: trayLeft.length } : null,
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
            <StageStatus holding={holding} />
            {solveFx && <ScalesLevelFx reduced={reduced} count={total} />}
            {/* The Number overhaul's stage moment: a balanced scale lifts and slides away (balance.stageClear); out of
                hangs it greys and slides away; the next scale slides in. */}
            <NumberStage type="balance" index={current} exit={exit === "clear" ? "clear" : null}
              className={`pointer-events-none absolute inset-0${exit === "fail" ? " bal-failing" : ""}`}>
              <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2" style={{ top: beamTop }}>
                <Beam
                  scale={scale}
                  placement={placement}
                  spacing={spacing}
                  selected={selected}
                  showControls
                  solving={solveFx}
                  height={beamHeight}
                  torque={torque}
                  onWeightTap={tapWeight}
                  onEmptyNotch={emptyNotch}
                  onPlace={(peg) => { if (selected !== null && !frozen) hang(selected, peg); }}
                />
              </div>
            </NumberStage>
          </div>
          {/* The rack stands 16 px clear of the bottom of the screen. */}
          <div data-game-controls="tray" className="flex w-full shrink-0 flex-col items-center gap-1.5 pb-4">
            {summary}
            <div key={`nudge-${nudge}`} onClick={tapRack} data-nudge={nudge > 0 ? "" : undefined}
              className="bal-rack relative flex min-h-[80px] w-full flex-wrap items-center justify-center gap-3 px-2 py-1.5">
              {trayButtons}
              {nudgeShown && <span className="bal-nudge" role="status">Pick a weight first</span>}
            </div>
          </div>
        </>
      ) : (
        <div className="relative min-h-0 w-full flex-1">
          <div className="absolute left-1/2" style={{ top: "calc(50% - 74px)", transform: "translate(-50%, -42px)" }}>
            <div className="flex h-6 w-full shrink-0 items-center justify-center"><StageStatus holding={holding} /></div>
            <Beam
              scale={scale}
              placement={placement}
              spacing={spacing}
              selected={selected}
              showControls
              solving={solveFx}
              torque={torque}
              onWeightTap={tapWeight}
              onEmptyNotch={emptyNotch}
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
