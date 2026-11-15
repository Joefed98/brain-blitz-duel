import { BALANCE_CSS, BALANCE_DEFS, IronKettlebell, ScalesLevelFx } from "@/components/puzzles/balanceArt";
import { NumberStage, numberArt, stageFailCue, type StageExit } from "@/components/puzzles/number/overhaul";
import { balanceFreeMoves } from "@/lib/duel/numberOverhaul";
import { balanceHangCost, balanceLeftOnTray, balanceMovedWeights, balanceNearMiss, balanceRevealMarks, balanceTiltDeg, balanceTorqueText } from "@/lib/duel/numberOverhaulInput";
import { gameFx, releaseGameFx } from "@/lib/fx/kit";
import { balanceTorque } from "@/lib/duel/balance";
import { RevealBoards, RevealFacts, RevealView, useRevealBoard, type RevealSide } from "@/components/puzzles/number/RevealParts";
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
import { playLock } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { useGoalProgress } from "@/components/duel/GameFrame";
import { HudPills } from "@/components/puzzles/HudPills";
import "@/polish-layout/batch-w-balance.css";
// The Number overhaul's shared look (darker background, navy and champagne controls), loaded with the game.
import "@/polish-layout/number-overhaul.css";

const PEG_GAP = 0;
const MIN_PEG_WIDTH = 44;
/** A live round's widest notch (3 Nov 2026): the scale fills the panel on a 414 px phone. */
const LIVE_PEG_WIDTH = 50;
/** A live round's kettlebells (Beam `fill`): drawn this many notch widths wide, every other one this many bells lower. */
const FILL_SPILL = 1.9;
const FILL_STAGGER = 0.9;
/** The kettlebell art's body is this share of its width (the rest is transparent margin). */
const BELL_BODY = 0.775;
/** Beam fill: every bell's rod below the hook, so the top row hangs clear of the tags too. */
const FILL_ROD = 18;
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

/**
 * The Number overhaul's effects (stage 2, 15 Nov 2026; the effects kit): display only, after the move's render. Each
 * animates a piece's own art (never a button, notch or the board), `silent` where the game plays its own cue.
 */
function afterPaint(fn: () => void): void {
  if (typeof window !== "undefined") requestAnimationFrame(() => requestAnimationFrame(fn));
}

export function Beam({ scale, placement, spacing, onWeightTap, onPlace, onEmptyNotch, torque, marks, selected, showControls = false, height, compact = false, solving = false, fill = false, kitFx = false }: {
  /**
   * balanceRev 4's live beam (the Number overhaul's effects): the tilt proportional to how far off the scale is
   * (balanceTiltDeg), a pointer at the pivot for the near-miss tremble and the balanced lock, and the kit's drop in
   * place of the old CSS one. Older stamps' beams, intros and reveals draw as before.
   */
  kitFx?: boolean;
  /**
   * A live round's beam fills its wall (Joe, 15 Nov 2026): the kettlebells grow past their notch (1.6 times its width),
   * every other notch's hanging a bell's height lower on a brass rod so neighbours never touch, and the whole
   * instrument (tags, beam, bells, the balance) is centred in the wall's height. Display only: the notches' places,
   * widths and tap targets are unchanged.
   */
  fill?: boolean;
  /** The reveal: tray weights ringed in gold (hung somewhere other than in your arrangement). */
  marks?: ReadonlySet<number> | undefined;
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
  const balanced = scaleSolved(scale, placement);
  const forces = balanceTorque(scale, placement);
  const tilt = kitFx ? (balanced ? 0 : balanceTiltDeg(forces.left, forces.right)) : visibleTilt(scale, placement);
  const pegs = scalePegs(scale);
  const width = spacing * pegs;
  const big = height !== undefined;
  const weight = big ? 52 : Math.min(44, spacing);
  // A weight's art is exactly its button: 44 × 52 on the live beam, 44 × 44 in the old layout.
  const bellW = big ? spacing : weight;
  // A wider live notch (3 Nov 2026) grows the hung kettlebell with it, keeping its 44 × 52 shape.
  // The Number overhaul: a live beam's bells half as big again, spilling a little past their notch (the button is the notch).
  const spill = fill ? FILL_SPILL : big ? 1.3 : 1;
  const bellH = fill ? Math.round(spacing * FILL_SPILL * 72 / 60) : big ? Math.max(72, Math.round(spacing * 52 / 44 * 1.4)) : showControls ? weight : Math.round(weight * 52 / 44);
  // Every other notch hangs lower (fill), so two neighbours' bells never meet.
  const stagger = fill ? Math.round(bellH * FILL_STAGGER) : 0;
  // fill: the block (tags 32 above the beam, hook, the staggered bells, the balance plaque) centred above the bench.
  const rod = fill ? FILL_ROD : 0;
  // The end notches' bells step inward just enough to stay inside the beam's width (their rod still under the tag).
  const edgeNudge = fill ? Math.max(0, Math.round((BELL_BODY * FILL_SPILL * spacing) / 2 - spacing / 2 - 2)) : 0;
  const fillBlock = 34 + 20 + rod + stagger + bellH + 18 + 38;
  // The Number overhaul: a live beam sits a little lower on its column, so the wall below it isn't left empty.
  const beamY = height !== undefined ? (fill ? Math.max(40, Math.round((height - 30 - fillBlock) / 2) + 32) : Math.max(32, Math.round(height * 0.42))) : compact ? 24 : 32;
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
  return <div data-balance-fill={fill ? "" : undefined} className={`balance-instrument relative${fx}${big ? " bal-big" : ""}`} style={{ width, height: H, marginTop: rise || undefined, marginBottom: drop || undefined }}>
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
      {balanced && !kitFx && <circle cx={cx} cy={beamY} r={big ? 5 : 3.5} fill="var(--jz-gold)" stroke="#3E2805" strokeWidth="1"/>}
    </svg>
    {/* The pivot's pointer (kitFx): gold when balanced; the kit trembles it on a near miss and locks it on a balance. */}
    {kitFx ? <span data-bal-pointer="" data-on={balanced ? "" : undefined} className="bal-pointer" aria-hidden="true"
      style={{ left: cx - 7, top: beamY - 7 }} /> : null}
    {Array.from({ length: pegs }, (_, peg) => {
      const item = onPeg.get(peg), available = selected != null && !item;
      return <div key={peg} className="absolute flex flex-col items-center" style={{ top: beamY - 32, left: peg * spacing, width: spacing, transform: `translateY(${offset(peg)}px)`, transition: TILT_EASE }}>
        {showControls ? <Button type="button" variant="ghost" onClick={() => { if (available) onPlace?.(peg); else if (!item && selected == null) onEmptyNotch?.(); }}
          aria-label={`Place at distance ${pegDistance(peg, pegs)} on the ${pegIsLeft(peg, pegs) ? 'left' : 'right'}`} aria-disabled={!available}
          className="balance-notch h-11 w-full min-w-0 px-0 font-mono text-sm">
          <span className={available ? 'bal-notch-label bal-notch-active' : 'bal-notch-label'} style={{ width: labelW }}>{pegDistance(peg, pegs)}</span>
        </Button> : <div className="flex h-11 w-full items-center justify-center font-mono text-sm"><span className="bal-notch-label" style={{ width: labelW }}>{pegDistance(peg, pegs)}</span></div>}
        {item && <div key={item.fixed ? 'f' : `t${item.tray}`} data-reveal-mark={!item.fixed && item.tray !== undefined && marks?.has(item.tray) ? "moved" : undefined} data-bell-tray={!item.fixed ? item.tray : undefined} className={`flex flex-col items-center ${showControls && !item.fixed && !kitFx ? 'bal-drop' : ''}`}
          style={edgeNudge && (peg === 0 || peg === pegs - 1) ? { translate: `${peg === 0 ? edgeNudge : -edgeNudge}px 0` } : undefined}>
          {rod > 0 ? <span className="bal-rod" aria-hidden="true" style={{ height: rod + (peg % 2 === 1 ? stagger : 0) }} /> : null}
          <svg className="bal-hook" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0V3.2a2.1 2.1 0 1 1-2.1 2.1" fill="none" stroke="#D9A940" strokeWidth="1.6" strokeLinecap="round"/></svg>
          {item.fixed ? <Disc value={item.w} fixed width={bellW} height={bellH} spill={spill} /> : <Button variant="ghost" style={big ? { height: bellH } : undefined} className={`min-w-0 p-0 ${big ? '' : 'h-11'} w-full hover:bg-transparent ${item.tray === selected ? 'ring-2 ring-primary' : ''}`} onClick={() => { if (item.tray !== undefined) onWeightTap?.(item.tray); }} aria-label={`Select weight ${item.w}`}><Disc value={item.w} fixed={false} width={bellW} height={bellH} spill={spill}/></Button>}
        </div>}
      </div>;
    })}
    {torque !== undefined && (
      <div data-balance-torque="" className="bal-torque" aria-label={`Left ${torque.split(" | ")[0]}, right ${torque.split(" | ")[1]}`}
        style={{ left: cx, top: beamY + 12 + 8 + rod + stagger + bellH + (big ? 18 : 10) }}>
        <span>{torque.split(" | ")[0]}</span><i aria-hidden="true">|</i><span>{torque.split(" | ")[1]}</span>
      </div>
    )}
  </div>;
}

/** An element's width, kept up to date (the reveal's beam fits its panel). */
function useWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [w, setW] = useState(0);
  useBeforePaint(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return w;
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
  // The Number overhaul's effects (stage 2): balanceRev 4 in a live round only (intros and demos draw as before).
  const kitOn = freeMoves && inFrame;
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
    // overhaul (Joe's approval, 15 Nov 2026): the scale greys and slides away with its own dull thunk, the shared fail
    // moment's `balance.fail`, then the next scale starts.
    soundCue(stageFailCue("balance"));
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
    if (kitOn) {
      // The effects kit: the kettlebell drops onto its hook (its own clink plays above); off by one the pointer
      // trembles; balanced, it locks gold (the stage moment's chime is the scale's own).
      const after = balanceTorque(scale, next);
      const level = scaleSolved(scale, next);
      afterPaint(() => {
        const box = root.current;
        releaseGameFx(box?.querySelector(`[data-tray-cup="${tray}"] .bal-bell`));
        gameFx("drop", box?.querySelector(`[data-bell-tray="${tray}"] .bal-bell`), { silent: true });
        const pointer = box?.querySelector("[data-bal-pointer]");
        if (level) gameFx("win", pointer, { silent: true, noHaptic: true });
        else if (balanceNearMiss(after.left, after.right)) gameFx("nearMiss", pointer);
      });
    }
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
        releaseGameFx(root.current?.querySelector(`[data-tray-cup="${tray}"] .bal-bell, [data-bell-tray="${tray}"] .bal-bell`));
        if (placement[tray] !== null) toTray(tray);
        else setSelected(null);
        return;
      }
      soundCue(placement[tray] !== null ? "balance.pickup" : "balance.select");
      // The effects kit: the kettlebell lifts (off the tray, or off its hook) and stays up until it is hung or put back.
      const box = kitOn ? root.current : null;
      if (selected !== null) releaseGameFx(box?.querySelector(`[data-tray-cup="${selected}"] .bal-bell, [data-bell-tray="${selected}"] .bal-bell`));
      gameFx("pickUp", box?.querySelector(`[data-tray-cup="${tray}"] .bal-bell, [data-bell-tray="${tray}"] .bal-bell`), { silent: true });
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
  // A live round's instrument fills the wall (Beam `fill`, Joe 15 Nov 2026): as tall as the panel, its parts centred.
  const beamHeight = inFrame ? Math.max(146, arenaHeight - 24) : beamHeightFor(arenaHeight, 300);
  // The instrument stands on the bench: centred in the panel, with the desk from its base down.
  const beamTop = inFrame ? 12 : Math.max(26, Math.round((arenaHeight - beamHeight) / 2) + 8);
  const trayButtons = trayLeft.map((i) => (
    <Button variant="ghost"
      key={i}
      aria-label={`Select weight ${scale.tray[i] ?? 0}`}
      data-selected={selected === i}
      data-tray-cup={i}
      onClick={(event) => { event.stopPropagation(); tapWeight(i); }}
      className={`bal-tray-cup ${inFrame ? "h-[88px] w-[80px]" : "h-14 w-14"} p-0`}
    >
      {/* A live round's cups are a size up (polish batch W, again 3 Nov 2026); intros and demos keep main's. */}
      <Disc value={scale.tray[i] ?? 0} fixed={false} width={inFrame ? 70 : 44} height={inFrame ? 84 : 52} />
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
                  fill={inFrame}
                  kitFx={kitOn}
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
              kitFx={kitOn}
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

/** The reveal's beam height: about a quarter of the screen's height, 170–250 px (a 375 × 667 phone fits it all). */
// A short screen (the shared reveal layout's payoff row above, #422) gets a shorter beam, so the balance, the key and
// the facts never meet.
const revealBeamHeight = (screenHeight: number) =>
  Math.round(screenHeight < 760 ? Math.max(130, screenHeight * 0.21) : Math.min(250, Math.max(170, screenHeight * 0.27)));

/**
 * The answer reveal (the Number overhaul, 15 Nov 2026): one scale at a time, drawn large with its rendered art, on
 * numbered tabs marked balanced, not balanced or nothing hung (opening on the first not balanced). A scale not
 * balanced switches between your weights (the balance under the beam, the weights left on the tray) and a balanced
 * arrangement (the weights hung somewhere other than yours ringed in gold); a balanced scale shows yours. Under it,
 * the numbers behind the score: scales balanced, your hangs on this scale against its limit, and the time on a full
 * set. Every stamp's stored answer reads the same way (decodeBalance, the hang counts where the stamp has them).
 */
function Reveal({ timeLimitMs, puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  const data = puzzle.type === "balance" ? puzzle : null;
  const scales = data?.scales ?? [];
  const placements = data ? decodeBalance(myAnswer ?? "", scales) : [];
  const placeLimits = data ? balancePlaceLimits(data) : null;
  const hangs = placeLimits ? splitCountSuffix(myAnswer).counts : [];
  // Limited rounds credit each scale on its own (hung within its limit); stored rounds count scales in order.
  const solvedInOrder = data ? balanceSolvedCount(scales, placements) : 0;
  const okAt = placeLimits
    ? balanceScalesSolved(scales, placements).map((ok, s) => ok && (hangs[s] ?? 0) <= (placeLimits[s] ?? 0))
    : scales.map((_, s) => s < solvedInOrder);
  const marks = balanceRevealMarks(placements, okAt);
  const [index, setIndex] = useRevealBoard(marks);
  const stage = useRef<HTMLDivElement | null>(null);
  const scale = scales[index];
  // The beam fills the panel's width: each notch up to the live round's 44 px, down to 30 on a 10-notch scale.
  const stageWidth = useWidth(stage);
  const pegs = scale ? scalePegs(scale) : 8;
  const spacing = stageWidth > 0 ? Math.max(30, Math.min(44, Math.floor((stageWidth - 12) / pegs))) : 36;
  const [beamHeight, setBeamHeight] = useState(250);
  useBeforePaint(() => setBeamHeight(revealBeamHeight(window.innerHeight)), []);
  const solution = data?.solutions?.[index] ?? null;
  const right = !!okAt[index];
  const [side, setSide] = useState<RevealSide>("solution");
  if (!data || !scale) return null;
  const solved = okAt.filter(Boolean).length;
  const total = balanceScaleCount(data);
  const mine = placements[index] ?? scale.tray.map(() => null);
  // A balanced scale needs no switch (yours is a balanced arrangement); without the stored solution, yours alone.
  const canSwitch = !right && !!solution;
  const showing: RevealSide = canSwitch ? side : "yours";
  const shown = showing === "solution" && solution ? solution : mine;
  const moved = showing === "solution" && solution ? balanceMovedWeights(mine, solution) : undefined;
  const left = showing === "yours" ? balanceLeftOnTray(mine, scale.tray.length) : [];
  const elapsed = myMsRemaining === undefined ? null : ((timeLimitMs - myMsRemaining) / 1000).toFixed(1);
  return (
    <div data-balance-reveal data-polish="balance" className="bal-reveal flex min-h-0 w-full flex-1 flex-col items-center gap-3 py-1">
      <BalanceArt />
      <RevealBoards noun="Scale" marks={marks} index={index} onIndex={(i) => { setIndex(i); setSide("solution"); }}>
        {canSwitch ? <RevealView value={showing} onChange={setSide} /> : null}
        <div ref={stage} className="bal-reveal-stage" data-reveal-side={showing}>
          <Beam scale={scale} placement={shown} spacing={spacing} height={beamHeight} {...(moved ? { marks: moved } : {})} />
        </div>
        {/* The balance, left | right, under the scale (in the flow, so a short screen never draws it over the note). */}
        {(() => {
          const [l, r] = balanceTorqueText(scale, shown).split(" | ");
          return (
            <div data-balance-torque="" className="bal-torque bal-reveal-torque" aria-label={`Left ${l}, right ${r}`}>
              <span>{l}</span><i aria-hidden="true">|</i><span>{r}</span>
            </div>
          );
        })()}
        {showing === "solution" && moved && moved.size > 0 ? (
          <p className="bal-reveal-note"><span className="bal-reveal-ring" aria-hidden="true" /> Hung differently from yours</p>
        ) : null}
        {left.length > 0 ? (
          <div className="bal-reveal-tray" aria-label={`Still on the tray: ${left.map((i) => scale.tray[i]).join(", ")}`}>
            <span className="bal-reveal-tray-label">Still on the tray</span>
            <span className="bal-reveal-tray-bells">
              {left.map((i) => <Disc key={i} value={scale.tray[i] ?? 0} fixed={false} width={36} height={43} />)}
            </span>
          </div>
        ) : null}
      </RevealBoards>
      <RevealFacts facts={[
        { label: "Balanced", value: `${solved} of ${total}`, ...(solved === total ? { tone: "good" as const } : {}) },
        placeLimits && showing === "yours" && hangs[index] !== undefined
          ? { label: `Your hangs, scale ${index + 1}`, value: `${hangs[index]} of ${placeLimits[index] ?? 0}`, ...((hangs[index] ?? 0) > (placeLimits[index] ?? 0) ? { tone: "miss" as const } : {}) }
          : null,
        solved === total && elapsed ? { label: "Time", value: `${elapsed} s` } : null,
      ]} />
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
