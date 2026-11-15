import { gameDisplayName } from "@/lib/duel/gameNames";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { Undo2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playWrong } from "@/lib/sound";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";

import { useGameKeys } from "@/lib/desktop";
import {
  applyOperation,
  decodeSteps,
  encodeSteps,
  formatStep,
  generateTargetPuzzle,
  LARGE_TILES,
  replayTargetSteps,
  TARGET_OPERATORS,
} from "@/lib/duel/target";
import {
  TARGET_TIME_MS,
  type Operator,
  type TargetNumberPuzzleData,
  type TargetStep,
} from "@/lib/duel/types";

import { useStageState } from "@/lib/duel/stageState";
import { HudPills } from "@/components/puzzles/HudPills";
import { wrongMoveFlash } from "@/lib/fx/gameToolkit";
import "@/polish-layout/batch-w-target.css";
import { EXACT_ELEGANT_TILES, usesNumberDepth } from "@/lib/duel/numberDepth";
import { exactCombineRate, exactLockReady, exactNear, toggleOperator } from "@/lib/duel/numberOverhaulInput";
import { gameFx } from "@/lib/fx/kit";
import { RevealFacts, RevealView, type RevealSide } from "@/components/puzzles/number/RevealParts";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
// The Number overhaul's shared look (darker background, navy and champagne controls), loaded with the game.
import "@/polish-layout/number-overhaul.css";

/* -------------------------------------------------------------------------- */
/*  Target Number — reach a three-digit target from six tiles.                 */
/*                                                                             */
/*  The client only renders and collects steps. Generating the puzzle, checking */
/*  each step and scoring the round all happen on the server.                   */
/* -------------------------------------------------------------------------- */

function isLarge(value: number): boolean {
  return LARGE_TILES.includes(value);
}

type TileState = "idle" | "selected" | "consumed";

/* Exact polish (13 Oct 2026): drawing, animation and sound cues only; steps and submit untouched. */
/** The combine's pop, pitched by the result's size (the Number overhaul's effects; the slot's own file, not a kit sound). */
function combineCue(result: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "target.combine", rate: exactCombineRate(result) } }));
}

/**
 * The Number overhaul's effects (stage 2, 15 Nov 2026; the effects kit, src/lib/fx/kit.ts): display only, run after
 * the move's render so they read the new layout. Each animates a piece's own face (never a button or the board), with
 * `silent` where the game plays its own cue.
 */
function afterPaint(fn: () => void): void {
  if (typeof window !== "undefined") requestAnimationFrame(() => requestAnimationFrame(fn));
}

export const EXACT_CSS = `
[data-polish="target"] .exact-board { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 10px 8px; border-radius: 16px; overflow: hidden;
  background: radial-gradient(120% 70% at 50% 0%, rgba(245,184,46,.10), transparent 60%), repeating-linear-gradient(0deg, rgba(255,255,255,.022) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(255,255,255,.022) 0 1px, transparent 1px 22px), linear-gradient(180deg, #17171f, #101016);
  box-shadow: inset 0 0 0 1px rgba(245,184,46,.16), inset 0 1px 0 rgba(255,255,255,.05), 0 6px 18px rgba(0,0,0,.35); }
[data-polish="target"] .exact-plaque { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 28px 6px; }
[data-polish="target"] .exact-rings { position: absolute; left: 50%; top: 50%; height: calc(100% + 14px); width: auto; aspect-ratio: 1; translate: -50% -50%; pointer-events: none; opacity: .6; }
[data-polish="target"] .exact-label { position: relative; font-size: 12px; letter-spacing: .24em; text-transform: uppercase; color: #a9a9b4; }
[data-polish="target"] .exact-number { position: relative; font-family: var(--font-mono); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: #F5B82E; font-size: 48px;
  text-shadow: 0 0 18px rgba(245,184,46,.28), 0 2px 0 rgba(0,0,0,.45); }
[data-polish="target"] .exact-history { width: 100%; height: 104px; display: flex; flex-direction: column; align-items: center; gap: 2px; overflow-y: auto; padding: 6px 8px; border-radius: 10px;
  background: linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.16)); box-shadow: inset 0 1px 3px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.04); }
[data-polish="target"] .exact-history-empty { margin: auto; font-family: var(--font-mono); font-size: 14px; color: #9a9aa6; }
[data-polish="target"] .exact-line { font-family: var(--font-mono); font-size: 18px; line-height: 26px; font-variant-numeric: tabular-nums; color: #ececf1; white-space: nowrap; }
[data-polish="target"] .exact-line b { color: #F5B82E; font-weight: 700; }
[data-polish="target"] .exact-line[data-new="true"] { animation: exact-line-in 220ms cubic-bezier(.2,.9,.3,1) both; }
@keyframes exact-line-in { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }

[data-polish="target"] .exact-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
[data-polish="target"] .exact-tile { position: relative; display: flex; height: 64px; align-items: center; justify-content: center; border-radius: 16px; overflow: hidden;
  font-family: var(--font-mono); font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; color: #f4f4f7;
  background: linear-gradient(180deg, #2b2b35 0%, #20202a 55%, #1a1a22 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.09), inset 0 1px 0 rgba(255,255,255,.10), inset 0 -4px 0 rgba(0,0,0,.35), 0 2px 4px rgba(0,0,0,.35);
  transition: translate 150ms ease-out, box-shadow 150ms ease-out, opacity 180ms ease-out, background 180ms ease-out; }
[data-polish="target"] .exact-tile:disabled { opacity: 1; }
[data-polish="target"] .exact-tile[data-large="true"] { color: #F5B82E; background: linear-gradient(180deg, #33301f 0%, #25231b 55%, #1d1b16 100%); box-shadow: inset 0 0 0 1px rgba(245,184,46,.30), inset 0 1px 0 rgba(255,236,170,.12), inset 0 -4px 0 rgba(0,0,0,.35), 0 2px 4px rgba(0,0,0,.35); }
[data-polish="target"] .exact-tile[data-state="selected"] { translate: 0 -2px; color: #FFE08A; background: linear-gradient(180deg, #4a3d17 0%, #33290f 60%, #2a220c 100%);
  box-shadow: inset 0 0 0 2px #F5B82E, inset 0 1px 0 rgba(255,236,170,.25), inset 0 -4px 0 rgba(0,0,0,.30), 0 0 14px rgba(245,184,46,.35), 0 4px 8px rgba(0,0,0,.4); }
[data-polish="target"] .exact-tile[data-state="consumed"] { opacity: .32; color: #8d8d99; background: #15151b; box-shadow: inset 0 0 0 1px rgba(255,255,255,.05), inset 0 2px 4px rgba(0,0,0,.5); }
[data-polish="target"] .exact-tile[data-state="consumed"] .exact-face { animation: exact-sink 200ms ease-out both; }
[data-polish="target"] .exact-tile[data-hit="true"] { color: #1a1406; background: linear-gradient(180deg, #ffd56a, #F5B82E 60%, #d99a14); box-shadow: inset 0 0 0 1px #ffe69a, inset 0 -4px 0 rgba(120,80,0,.35), 0 0 18px rgba(245,184,46,.55); }
[data-polish="target"][data-locked="true"] .exact-tile:not([data-hit="true"]):not([data-state="consumed"]) { opacity: .5; }
[data-polish="target"] .exact-face { position: relative; display: inline-block; }
[data-polish="target"] .exact-elegant { color: var(--jz-gold); }
[data-polish="target"] .exact-face[data-pop="true"] { animation: exact-pop 240ms cubic-bezier(.2,1.5,.4,1) both; }
[data-polish="target"] .exact-ring { position: absolute; inset: 3px; border-radius: 13px; box-shadow: inset 0 0 0 2px #F5B82E; pointer-events: none; animation: exact-ring 260ms ease-out both; }
@keyframes exact-pop { 0% { scale: .7; opacity: .4; } 60% { scale: 1.14; opacity: 1; } 100% { scale: 1; } }
@keyframes exact-ring { from { opacity: .9; scale: .86; } to { opacity: 0; scale: 1.02; } }
@keyframes exact-sink { 0% { scale: 1; } 50% { scale: .82; } 100% { scale: 1; } }

[data-polish="target"] .exact-ops { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
[data-polish="target"] .exact-op { display: flex; height: 48px; align-items: center; justify-content: center; border-radius: 12px; font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: #ececf1;
  background: linear-gradient(180deg, #262630, #1c1c24); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.08), inset 0 -3px 0 rgba(0,0,0,.35);
  transition: box-shadow 140ms ease-out, background 140ms ease-out, color 140ms ease-out; }
[data-polish="target"] .exact-op[data-on="true"] { color: #F5B82E; background: linear-gradient(180deg, #3a3017, #29220f); box-shadow: inset 0 0 0 2px #F5B82E, inset 0 -3px 0 rgba(0,0,0,.3), 0 0 10px rgba(245,184,46,.28); }

/* Solve: the final tile flies into the target, which pulses gold. */
[data-polish="target"] .exact-ghost { position: absolute; z-index: 30; width: 96px; height: 56px; margin: -28px 0 0 -48px; display: flex; align-items: center; justify-content: center; border-radius: 14px; pointer-events: none;
  font-family: var(--font-mono); font-size: 28px; font-weight: 700; color: #1a1406; background: linear-gradient(180deg, #ffd56a, #F5B82E 60%, #d99a14); box-shadow: 0 0 22px rgba(245,184,46,.6);
  animation: exact-fly 480ms cubic-bezier(.5,0,.3,1) both; }
@keyframes exact-fly { 0% { translate: 0 0; scale: 1; opacity: 1; } 75% { translate: var(--dx) var(--dy); scale: 1.15; opacity: 1; } 100% { translate: var(--dx) var(--dy); scale: 1.5; opacity: 0; } }
[data-polish="target"] .exact-plaque[data-solved="true"] .exact-number { animation: exact-target-pulse 700ms 340ms ease-out both; }
@keyframes exact-target-pulse { 0% { scale: 1; } 30% { scale: 1.16; color: #FFE08A; text-shadow: 0 0 28px rgba(255,208,90,.9), 0 0 6px rgba(255,236,170,.9); } 100% { scale: 1; } }
[data-polish="target"] .exact-burst { position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; pointer-events: none; box-shadow: 0 0 0 3px #F5B82E, 0 0 16px rgba(245,184,46,.6); opacity: 0; animation: exact-burst 620ms 360ms ease-out both; }
[data-polish="target"] .exact-burst + .exact-burst { animation-delay: 470ms; }
@keyframes exact-burst { 0% { opacity: .95; scale: .4; } 100% { opacity: 0; scale: 1.7; } }
[data-polish="target"] .exact-stamp-late { animation-delay: 700ms; }

.game-column [data-polish="target"][data-stage-column] { padding-top: 12px; }
.game-column [data-polish="target"][data-stage-column] > [data-game-arena] { flex: 1 1 0; max-height: none; min-height: 0; container-type: size; justify-content: center; }
.game-column [data-polish="target"] .exact-number { font-size: clamp(48px, min(17cqw, 15cqh), 84px); }
.game-column [data-polish="target"] .exact-plaque { flex: none; }
.game-column [data-polish="target"] .exact-history { flex: 1 1 0; height: auto; min-height: 0; max-height: 148px; }
@container (min-height: 330px) { .game-column [data-polish="target"] .exact-line { font-size: 20px; line-height: 30px; } .game-column [data-polish="target"] .exact-history { max-height: 168px; } }

/* ---- The Number overhaul (15 Nov 2026): Blender-rendered tiles, keys and the gold target plate (public/number/target),
   bold Archivo numbers, champagne gold and navy, no glows or glare. Display only: every control keeps its place. */
[data-polish="target"] .exact-board { background: linear-gradient(180deg, var(--jz-surface), var(--jz-bg)); box-shadow: inset 0 0 0 1px var(--jz-line), 0 8px 18px rgba(0,0,0,.4); }
[data-polish="target"] .exact-rings { display: none; }
[data-polish="target"] .exact-plaque { padding: 8px 34px 10px; min-width: 62%; background: url("/number/target/target.webp") center / 100% 100% no-repeat; filter: drop-shadow(0 6px 8px rgba(0,0,0,.45)); }
[data-polish="target"] .exact-label { color: var(--jz-on-gold); opacity: .72; font-family: var(--jz-font); font-weight: 800; }
[data-polish="target"] .exact-number, [data-puzzle-play] .game-column [data-polish="target"] .exact-number { font-family: var(--jz-font); font-weight: 900; color: var(--jz-on-gold); text-shadow: none; }
[data-polish="target"] .exact-history-card { background: var(--jz-well); box-shadow: inset 0 0 0 1px var(--jz-line); }
[data-polish="target"] .exact-line { font-family: var(--jz-font); font-weight: 700; color: var(--jz-text); }
[data-polish="target"] .exact-line b { color: var(--jz-gold); font-weight: 800; }
[data-polish="target"] .exact-tile, [data-polish="target"] .exact-tile[data-large="true"] {
  font-family: var(--jz-font); font-weight: 800; font-size: 30px; color: var(--jz-white); box-shadow: 0 4px 8px rgba(0,0,0,.45);
  background: url("/number/target/tile.webp") center / 100% 100% no-repeat; }
[data-polish="target"] .exact-tile[data-large="true"] { color: var(--jz-gold); background-image: url("/number/target/tile-large.webp"); }
[data-polish="target"] .exact-tile[data-state="selected"], [data-polish="target"] .exact-tile[data-hit="true"] {
  translate: 0 -3px; color: var(--jz-on-gold); background: url("/number/target/tile-picked.webp") center / 100% 100% no-repeat; box-shadow: 0 6px 10px rgba(0,0,0,.5); }
[data-polish="target"] .exact-tile[data-state="consumed"] { opacity: .4; color: var(--jz-text-3); background: var(--jz-well); box-shadow: inset 0 2px 6px rgba(0,0,0,.6); }
[data-polish="target"] .exact-ring { box-shadow: inset 0 0 0 2px var(--jz-gold); }
[data-polish="target"] .exact-op { font-family: var(--jz-font); font-weight: 800; font-size: 26px; color: var(--jz-white); box-shadow: 0 3px 6px rgba(0,0,0,.4);
  background: url("/number/target/op.webp") center / 100% 100% no-repeat; }
[data-polish="target"] .exact-op[data-on="true"] { color: var(--jz-gold); background: url("/number/target/op.webp") center / 100% 100% no-repeat; box-shadow: inset 0 0 0 2px var(--jz-gold), 0 3px 6px rgba(0,0,0,.4); }
[data-polish="target"] .puzzle-secondary-control { color: var(--jz-text) !important; border-color: var(--jz-line) !important; background: var(--jz-surface-2) !important; }
[data-polish="target"] .exact-lock { min-height: 48px; padding: 0 20px; border-radius: 12px; font-family: var(--jz-font); font-size: 15px; font-weight: 800;
  color: var(--jz-text-2); background: var(--jz-surface-2); box-shadow: 0 4px 0 var(--jz-bg); }
[data-polish="target"] .exact-lock[data-ready] { color: var(--jz-on-gold); background: var(--jz-gold); box-shadow: 0 4px 0 var(--jz-gold-ledge); }
[data-polish="target"] .exact-lock:disabled { opacity: .6; }
[data-polish="target"] .exact-ghost { font-family: var(--jz-font); font-weight: 900; color: var(--jz-on-gold); background: url("/number/target/tile-picked.webp") center / 100% 100% no-repeat; box-shadow: none; }
[data-polish="target"] .exact-burst { box-shadow: 0 0 0 3px var(--jz-gold); }
@keyframes exact-target-pulse { 0% { scale: 1; } 30% { scale: 1.12; } 100% { scale: 1; } }
@media (prefers-reduced-motion: reduce) {
  [data-polish="target"] :is(.exact-line, .exact-face, .exact-ring, .exact-tile .exact-face) { animation: none !important; }
  [data-polish="target"] .exact-ghost, [data-polish="target"] .exact-burst { display: none; }
  [data-polish="target"] .exact-tile { transition: none; }
  [data-polish="target"] .exact-plaque[data-solved="true"] { border-radius: 14px; box-shadow: inset 0 0 0 2px #F5B82E, 0 0 16px rgba(245,184,46,.4); }
  [data-polish="target"] .exact-plaque[data-solved="true"] .exact-number { animation: none; color: #FFE08A; }
  [data-polish="target"] .exact-stamp-late { animation-delay: 0ms; }
}
`;

/** Faint bullseye behind the target number (static, built once). */
export const EXACT_RINGS = (
  <svg className="exact-rings" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(245,184,46,.10)" strokeWidth="1" />
    <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(245,184,46,.12)" strokeWidth="1" strokeDasharray="2 3" />
    <circle cx="50" cy="50" r="24" fill="rgba(245,184,46,.05)" stroke="rgba(245,184,46,.14)" strokeWidth="1" />
    <path d="M50 0v14M50 86v14M0 50h14M86 50h14" stroke="rgba(245,184,46,.16)" strokeWidth="1" />
  </svg>
);

function IntroExample() {
  const tiles = [75, 4, 6, 2, 10, 3];
  // The Number overhaul (15 Nov 2026): the intro's still shows the round's own rendered plate and tiles.
  return (
    <div data-polish="target" className="flex w-full flex-col items-center gap-3">
      <PolishStyle id="target" css={EXACT_CSS} />
      <div className="exact-plaque">
        <p className="exact-label">Target</p>
        <p className="exact-number" style={{ fontSize: 48 }}>462</p>
      </div>
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-2">
        {tiles.map((tile, index) => (
          <div key={`${tile}-${index}`} className="exact-tile" data-large={isLarge(tile) ? "true" : undefined} style={{ height: 52, fontSize: 24 }}>
            {tile}
          </div>
        ))}
      </div>
      <p className="text-center text-sm font-semibold text-foreground">75 × 6 = 450 · 450 + 10 = 460 · 460 + 2 = 462</p>
      <p className="text-center text-xs text-muted-foreground">
        Hitting it scores 150, with more for speed and for using fewer numbers. Not exact: what you built towards it, or about 120 one away.
      </p>
    </div>
  );
}

interface Tile {
  id: number;
  value: number;
  active: boolean;
  /** depthRev 1: how many starting numbers fed this one (1 for a starting number; absent on older saved state). */
  uses?: number;
}

interface HistoryEntry {
  step: TargetStep;
  before: Tile[];
}

function Stage(props: PuzzleStageProps) {
  if (props.puzzle.type !== "target") return null;
  return <TargetStage {...props} tiles={props.puzzle.tiles} target={props.puzzle.target} depth={usesNumberDepth(props.puzzle)} />;
}

interface SolveFlight {
  x: number;
  y: number;
  dx: number;
  dy: number;
  value: number;
}

function TargetStage({
  tiles: startTiles,
  target,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey,
  depth = false,
}: PuzzleStageProps & { tiles: number[]; target: number; depth?: boolean }) {
  const column = useGameColumnLayout();
  // The board belongs to the round (stageState.ts), so a re-mount, or in a room a reload, keeps it.
  const roundKey = stateKey ?? "target";
  const [pool, setPool] = useStageState<Tile[]>(roundKey, "targetPool", () =>
    startTiles.map((value, id) => ({ id, value, active: true })),
  );
  const [history, setHistory] = useStageState<HistoryEntry[]>(roundKey, "targetHistory", () => []);
  const [selectedId, setSelectedId] = useStageState<number | null>(roundKey, "targetSelected", () => null);
  const [operator, setOperator] = useStageState<Operator | null>(roundKey, "targetOperator", () => null);
  const [shake, setShake] = useState(0);
  const [lockedHere, setLockedHere] = useStageState<boolean>(roundKey, "targetLocked", () => false);
  // Presentation only: the last combine (for its pop) and the exact hit's flight into the target.
  const [combine, setCombine] = useState<{ id: number; consumed: number; n: number } | null>(null);
  const [flight, setFlight] = useState<SolveFlight | null>(null);
  const submitted = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLParagraphElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const solving = useSolveFx(flight !== null, "target.solve", 1150);

  const steps = history.map((h) => h.step);
  // The steps so far go to the room as a draft, so a reveal that arrives before the auto lock-in still sends them.
  const draft = encodeSteps(steps);
  useEffect(() => {
    onDraftAnswer?.(draft);
  }, [draft, onDraftAnswer]);

  /** `byHand`: the player's Lock (Enter or the button), which plays the lock (the exact hit and the time-out don't). */
  const send = (list: TargetStep[], byHand = true) => {
    if (submitted.current) return;
    submitted.current = true;
    if (byHand) soundCue("target.lock");
    setLockedHere(true);
    onSubmit(encodeSteps(list));
  };

  const refuse = (tapped?: Tile) => {
    setShake((n) => n + 1);
    // Polish batch W: the refused number also gets the shared red outline (its "wrong" already plays),
    // found after the shake's re-render has drawn the row again.
    if (tapped) requestAnimationFrame(() => wrongMoveFlash(rootRef.current?.querySelector(`[data-tile-id="${tapped.id}"]`), false));
    playWrong();
    setSelectedId(null);
    setOperator(null);
  };

  const reset = () => {
    if (locked || lockedHere) return;
    soundCue("target.reset");
    setPool(startTiles.map((value, id) => ({ id, value, active: true })));
    setHistory([]);
    setSelectedId(null);
    setOperator(null);
    setCombine(null);
  };

  const undo = () => {
    if (locked || lockedHere) return;
    const last = history[history.length - 1];
    if (!last) return;
    soundCue("target.undo");
    // The merge played backwards: the number given back slides out of the result's place to its own.
    const back = last.before.find((b) => !pool.find((t) => t.id === b.id)?.active && b.active);
    const resultFace = pool.find((t) => t.active && last.before.find((b) => b.id === t.id)?.value !== t.value);
    const fromBox = resultFace ? rootRef.current?.querySelector(`[data-tile-id="${resultFace.id}"] .exact-face`)?.getBoundingClientRect() : undefined;
    if (back && fromBox) afterPaint(() => {
      const el = rootRef.current?.querySelector(`[data-tile-id="${back.id}"] .exact-face`);
      const to = el?.getBoundingClientRect();
      if (el && to) gameFx("slide", el, { from: { x: fromBox.left - to.left, y: fromBox.top - to.top }, silent: true });
    });
    setPool(last.before);
    setHistory((current) => current.slice(0, -1));
    setSelectedId(null);
    setOperator(null);
    setCombine(null);
  };

  const tapTile = (tile: Tile) => {
    if (locked || lockedHere || !tile.active) return;
    if (selectedId === null) {
      setSelectedId(tile.id);
      soundCue("target.select");
      return;
    }
    if (tile.id === selectedId) {
      setSelectedId(null);
      setOperator(null);
      return;
    }
    if (operator === null) {
      setSelectedId(tile.id);
      soundCue("target.select");
      return;
    }
    const first = pool.find((t) => t.id === selectedId);
    if (!first) return refuse();
    const result = applyOperation(first.value, tile.value, operator);
    if (result === null) return refuse(tile);

    const step: TargetStep = { a: first.value, b: tile.value, operator, result };
    const before = pool.map((entry) => ({ ...entry }));
    const nextHistory = [...history, { step, before }];
    setPool((current) =>
      current.map((entry) => {
        if (entry.id === first.id) return { ...entry, value: result, active: true, uses: (first.uses ?? 1) + (tile.uses ?? 1) };
        if (entry.id === tile.id) return { ...entry, active: false };
        return entry;
      }),
    );
    setHistory(nextHistory);
    setSelectedId(first.id);
    setOperator(null);
    setCombine((c) => ({ id: first.id, consumed: tile.id, n: (c?.n ?? 0) + 1 }));
    combineCue(result);
    // The two numbers slide together into the result (FLIP from the second number's place), then, within 10 of the
    // target, the target plate pulses softly (the hit has its own flight and gold flip below).
    const fromBox = rootRef.current?.querySelector(`[data-tile-id="${tile.id}"] .exact-face`)?.getBoundingClientRect();
    const nextClosest = Math.min(
      Math.abs(result - target),
      ...pool.filter((t) => t.active && t.id !== first.id && t.id !== tile.id).map((t) => Math.abs(t.value - target)),
    );
    afterPaint(() => {
      const el = rootRef.current?.querySelector(`[data-tile-id="${first.id}"] .exact-face`);
      const to = el?.getBoundingClientRect();
      if (el && to && fromBox) gameFx("slide", el, { from: { x: fromBox.left - to.left, y: fromBox.top - to.top }, silent: true });
      const plaque = rootRef.current?.querySelector(".exact-plaque");
      if (result === target) gameFx("win", plaque, { silent: true });
      else if (exactNear(nextClosest)) gameFx("nearMiss", plaque);
    });

    // Hitting the target locks the answer at once.
    if (result === target) {
      send(nextHistory.map((h) => h.step), false);
      // Display only, measured after the submit: the result tile's flight into the target.
      const root = rootRef.current?.getBoundingClientRect();
      const goal = targetRef.current?.getBoundingClientRect();
      const from = rootRef.current?.querySelector<HTMLElement>(`[data-tile-id="${first.id}"]`)?.getBoundingClientRect();
      if (root && goal && from) {
        const x = from.left + from.width / 2 - root.left;
        const y = from.top + from.height / 2 - root.top;
        setFlight({ x, y, dx: goal.left + goal.width / 2 - root.left - x, dy: goal.top + goal.height / 2 - root.top - y, value: result });
      }
    }
  };

  // Out of time: the closest tile goes in automatically.
  useEffect(() => {
    if (locked || lockedHere || submitted.current) return;
    if (now < phaseStartedAt + TARGET_TIME_MS - 400) return;
    send(steps, false);
  });

  // Keep the newest step in view.
  useEffect(() => {
    const box = historyRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [history.length]);

  const closest = pool
    .filter((tile) => tile.active)
    .reduce<number | null>(
      (best, tile) =>
        best === null || Math.abs(tile.value - target) < Math.abs(best - target)
          ? tile.value
          : best,
      null,
    );
  const away = closest === null ? null : Math.abs(closest - target);
  // depthRev 1, the elegance bonus: the number on target and how many starting numbers it used.
  const onTarget = depth ? pool.find((t) => t.active && t.value === target) : undefined;
  const elegant = onTarget !== undefined && (onTarget.uses ?? 1) <= EXACT_ELEGANT_TILES;
  const isLockedNow = locked || lockedHere;
  const hitId = flight ? (combine?.id ?? null) : null;

  // Desktop keys: 1–6 tap the tile in that place, + − × ÷ (also - * x /) pick the operator,
  // Backspace or Z = Undo, R = Reset, Enter = Lock.
  useGameKeys((kind, key, event) => {
    const op: Operator | null = key === "+" ? "+" : key === "-" ? "-" : key === "*" || key === "x" || key === "×" ? "×" : key === "/" || key === "÷" ? "÷" : null;
    const slot = /^[1-6]$/.test(key) ? Number(key) - 1 : null;
    const used = op !== null || slot !== null || key === "Backspace" || key === "z" || key === "r" || key === "Enter";
    if (!used || kind !== "down") return used;
    if (key === "Backspace" || key === "z") {
      if (!isLockedNow && history.length > 0) undo();
      return true;
    }
    if (event.repeat || isLockedNow) return true;
    if (op) { soundCue("target.operator"); setOperator(toggleOperator(operator, op)); }
    else if (slot !== null) {
      const tile = pool[slot];
      if (tile?.active) tapTile(tile);
    } else if (key === "r") {
      if (history.length > 0) reset();
    } else if (steps.length > 0) send(steps);
    return true;
  });

  return (
    <div ref={rootRef} data-polish="target" data-stage-column="2" data-locked={isLockedNow ? "true" : undefined} className={`relative flex min-h-0 flex-1 flex-col gap-2 ${column ? "" : "justify-between"}`}>
      <PolishStyle id="target" css={EXACT_CSS} />
      <div data-game-arena="fixed" className="exact-board">
        <div className="exact-plaque" data-solved={flight ? "true" : undefined}>
          {EXACT_RINGS}
          <p className="exact-label">Target</p>
          <p ref={targetRef} className="exact-number">
            {target}
          </p>
          {solving && (
            <>
              <span className="exact-burst" aria-hidden="true" />
              <span className="exact-burst" aria-hidden="true" />
            </>
          )}
        </div>

        <div ref={historyRef} data-scrollable className="target-history exact-history">
          {/* The steps card (polish batch W): painted only round the lines it holds, so no half-empty panel. */}
          <div className="exact-history-card">
          {steps.length === 0 ? (
            <p className="exact-history-empty">No steps yet</p>
          ) : (
            steps.map((step, index) => (
              <p
                key={`${index}-${step.result}`}
                data-new={index === steps.length - 1 && combine ? "true" : undefined}
                className="exact-line"
              >
                {formatStep(step).replace(/ = [^=]*$/, " = ")}
                <b>{step.result}</b>
              </p>
            ))
          )}
          </div>
        </div>
        {/* The live status (puzzle polish, 3 Nov 2026): one label-and-value pill per figure, never dots in one pill. */}
        <HudPills
          testId="target"
          items={[
            { id: "left", label: depth ? "Left" : "Numbers left", value: pool.filter((t) => t.active).length },
            !depth && { id: "steps", label: "Steps", value: steps.length },
            // depthRev 1: the distance stays on the Lock button, so the line has room for the elegance bonus.
            closest !== null && (away === 0
              ? { id: "closest", value: "On target", tone: "good" as const }
              : { id: "closest", label: "Closest", value: closest }),
            !depth && closest !== null && away !== null && away > 0 && { id: "away", label: "Away", value: away },
            depth && (onTarget
              ? (elegant ? { id: "elegant", value: "✦ Elegant", tone: "gold" as const } : { id: "used", label: "Used", value: onTarget.uses ?? 1 })
              : { id: "elegant", label: "✦ Elegant", value: `${EXACT_ELEGANT_TILES} numbers`, tone: "gold" as const }),
          ]}
        />
      </div>

      <div key={shake} data-game-controls="numbers" className={shake > 0 ? "animate-shake" : ""}>
        <div className="exact-tiles">
          {pool.map((tile) => {
            const state: TileState = !tile.active ? "consumed" : selectedId === tile.id ? "selected" : "idle";
            const popped = combine !== null && combine.id === tile.id;
            const sunk = combine !== null && combine.consumed === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                data-tile-id={tile.id}
                data-state={state}
                data-large={isLarge(tile.value) ? "true" : undefined}
                data-hit={hitId === tile.id ? "true" : undefined}
                aria-pressed={state === "selected"}
                disabled={isLockedNow || !tile.active}
                onClick={() => tapTile(tile)}
                className="press exact-tile"
              >
                <span key={popped ? `pop-${combine.n}` : sunk ? `sink-${combine.n}` : "face"} className="exact-face" data-pop={popped ? "true" : undefined}>
                  {tile.value}
                </span>
                {popped && <span key={`ring-${combine.n}`} className="exact-ring" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <div data-game-controls="operators" className="exact-ops">
        {TARGET_OPERATORS.map((op) => (
          <button
            key={op}
            type="button"
            disabled={isLockedNow}
            // The Number overhaul (15 Nov 2026): tapping the picked operator again deselects it.
            onClick={(event) => {
              soundCue("target.operator");
              gameFx("tap", event.currentTarget.firstElementChild, { silent: true });
              setOperator(toggleOperator(operator, op));
            }}
            data-on={operator === op ? "true" : undefined}
            aria-pressed={operator === op}
            className="press exact-op"
          >
            <span className="exact-op-face">{op === "-" ? "−" : op}</span>
          </button>
        ))}
      </div>

      <div data-game-controls="actions" className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="button" variant="outline" aria-label="Undo" title="Undo" onClick={undo}
            disabled={isLockedNow || history.length === 0} className="puzzle-secondary-control">
            <Undo2 aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" aria-label="Reset" title="Reset" onClick={reset}
            disabled={isLockedNow || history.length === 0} className="puzzle-secondary-control">
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
        <button
          type="button"
          onClick={() => { if (steps.length > 0) send(steps); }}
          // Game review fix (15 Nov 2026): no Lock before the first step (one tap used to lock 0 points);
          // the time-out still sends whatever stands.
          disabled={isLockedNow || steps.length === 0}
          data-exact-lock=""
          // The Number overhaul (15 Nov 2026): navy until there's a step to lock, champagne gold once there is.
          data-ready={exactLockReady(steps.length) ? "" : undefined}
          className="press tap-target exact-lock"
        >
          {/* Puzzle polish (3 Nov 2026): "Lock in 150 (564 away)": the number that would be locked and its distance. */}
          {steps.length > 0 && closest !== null && away !== null
            ? away > 0 ? `Lock in ${closest} (${away} away)` : `Lock in ${closest}`
            : "Lock"}
        </button>
      </div>

      {solving && flight && (
        <div
          className="exact-ghost"
          aria-hidden="true"
          style={{ left: flight.x, top: flight.y, "--dx": `${flight.dx}px`, "--dy": `${flight.dy}px` } as CSSProperties}
        >
          {flight.value}
        </div>
      )}

      {isLockedNow && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className={`animate-stamp-in rounded-xl border-2 border-primary px-6 py-2 font-display text-2xl font-bold uppercase tracking-[0.2em] text-primary ${flight ? "exact-stamp-late" : ""}`}>
            Locked
          </p>
        </div>
      )}
    </div>
  );
}

function Reveal(props: PuzzleRevealProps) {
  if (props.puzzle.type !== "target") return null;
  return <TargetReveal {...props} puzzle={props.puzzle} />;
}

const EXACT_REVEAL_CSS = `
.exact-reveal { display: flex; width: 100%; flex-direction: column; align-items: center; gap: 10px; text-align: center; font-family: var(--jz-font); }
.exact-rv-head { display: grid; width: 100%; grid-template-columns: 1fr 1fr; gap: 10px; }
.exact-rv-plate { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 96px; padding: 8px 6px; border-radius: 16px; }
.exact-rv-plate[data-plate="target"] { background: url("/number/target/target.webp") center / 100% 100% no-repeat; color: var(--jz-on-gold); }
.exact-rv-plate[data-plate="yours"] { background: var(--jz-surface-2); color: var(--jz-text); }
.exact-rv-plate-label { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .8; }
.exact-rv-plate-value { font-size: 42px; line-height: 1.05; font-weight: 900; font-variant-numeric: tabular-nums; }
.exact-rv-plate-note { font-size: 15px; font-weight: 700; color: var(--jz-text-2); }
.exact-rv-plate[data-hit] .exact-rv-plate-note { color: var(--jz-gold); }
.exact-rv-route { display: flex; width: 100%; flex-direction: column; align-items: center; gap: 6px; }
.exact-rv-caption { font-size: 14px; font-weight: 600; color: var(--jz-text-2); }
.exact-rv-step { display: flex; align-items: center; justify-content: center; gap: 6px; }
.exact-rv-tile { display: inline-flex; min-width: 54px; height: 42px; align-items: center; justify-content: center; padding: 0 8px; border-radius: 10px;
  background: url("/number/target/tile.webp") center / 100% 100% no-repeat; color: #fff; font-size: 20px; font-weight: 900; font-variant-numeric: tabular-nums; }
.exact-rv-tile[data-made] { background-image: url("/number/target/tile-large.webp"); }
.exact-rv-tile[data-hit] { background-image: url("/number/target/tile-picked.webp"); color: var(--jz-on-gold); }
.exact-rv-op { min-width: 18px; font-size: 22px; font-weight: 800; color: var(--jz-text); }
.exact-rv-empty { font-size: 16px; font-weight: 600; color: var(--jz-text-2); }
/* A short screen (the shared reveal layout's payoff row above, #422): smaller plates and route tiles, so a four-step
   route and the facts fit at 375 × 667. */
@media (max-height: 760px) {
  .exact-rv-plate { min-height: 72px; padding: 4px 6px; }
  .exact-rv-plate-value { font-size: 32px; }
  .exact-rv-plate-note { font-size: 13px; }
  .exact-rv-route { gap: 4px; }
  .exact-rv-step { gap: 4px; }
  .exact-rv-tile { min-width: 46px; height: 34px; font-size: 18px; }
  .exact-rv-op { font-size: 18px; }
}
`;

/** One step of a route as tiles: a op b = result (the result gold when it is the target). */
function RouteStep({ step, target, made }: { step: TargetStep; target: number; made: ReadonlySet<number> }) {
  const symbol = step.operator === "-" ? "\u2212" : step.operator;
  return (
    <div className="exact-rv-step" data-route-step aria-label={formatStep(step)}>
      <span className="exact-rv-tile" data-made={made.has(step.a) ? "" : undefined}>{step.a}</span>
      <span className="exact-rv-op" aria-hidden="true">{symbol}</span>
      <span className="exact-rv-tile" data-made={made.has(step.b) ? "" : undefined}>{step.b}</span>
      <span className="exact-rv-op" aria-hidden="true">=</span>
      <span className="exact-rv-tile" data-made="" data-hit={step.result === target ? "" : undefined}>{step.result}</span>
    </div>
  );
}

/** A route's tiles: each step's result is a number made, drawn on the made tile where a later step uses it. */
function Route({ steps, target }: { steps: readonly TargetStep[]; target: number }) {
  const made = new Set(steps.map((s) => s.result));
  return <div className="exact-rv-route">{steps.map((step, i) => <RouteStep key={i} step={step} target={target} made={made} />)}</div>;
}

/**
 * The answer reveal (the Number overhaul, 15 Nov 2026): the target plate beside your closest number (how far off),
 * then your route against a way to the target, each drawn as tiles (a step a row), and the numbers behind the score.
 */
function TargetReveal({
  puzzle,
  myAnswer,
  myCorrect,
}: PuzzleRevealProps & { puzzle: TargetNumberPuzzleData }) {
  const replay = useMemo(
    () => replayTargetSteps(puzzle.tiles, puzzle.target, decodeSteps(myAnswer ?? "")),
    [puzzle.tiles, puzzle.target, myAnswer],
  );
  const away = replay.distance;
  const hit = myCorrect || away === 0;
  // depthRev 1: the hit's numbers, for the elegance fact.
  const depth = usesNumberDepth(puzzle);
  const used = depth && away === 0 ? exactTilesUsedPhone(puzzle.tiles, puzzle.target, myAnswer ?? "") : null;
  const way = puzzle.solution ?? [];
  const canSwitch = way.length > 0;
  const [side, setSide] = useState<RevealSide>(hit ? "yours" : "solution");
  const showing: RevealSide = canSwitch ? side : "yours";
  const madeSteps = replay.steps.length;
  return (
    <div className="exact-reveal" data-exact-reveal>
      <PolishStyle id="target-reveal" css={EXACT_REVEAL_CSS} />
      <div className="exact-rv-head">
        <div className="exact-rv-plate" data-plate="target">
          <span className="exact-rv-plate-label">Target</span>
          <span className="exact-rv-plate-value">{puzzle.target}</span>
        </div>
        <div className="exact-rv-plate" data-plate="yours" data-hit={hit ? "" : undefined}>
          <span className="exact-rv-plate-label">Yours</span>
          <span className="exact-rv-plate-value">{madeSteps > 0 && replay.value !== null ? replay.value : "–"}</span>
          <span className="exact-rv-plate-note">{hit ? "Spot on" : madeSteps === 0 ? "No steps made" : `${away} away`}</span>
        </div>
      </div>
      {canSwitch ? <RevealView value={showing} onChange={setSide} yoursLabel="Your route" /> : null}
      <div data-reveal-side={showing} className="exact-rv-route">
        {showing === "solution" ? (
          <>
            <p className="exact-rv-caption">{depth ? `A way with ${EXACT_ELEGANT_TILES} numbers` : "A way to the target"}</p>
            <Route steps={way} target={puzzle.target} />
          </>
        ) : madeSteps > 0 ? (
          <Route steps={replay.steps} target={puzzle.target} />
        ) : (
          <p className="exact-rv-empty">No steps made</p>
        )}
      </div>
      <RevealFacts facts={[
        { label: "Your steps", value: madeSteps },
        used !== null ? { label: "Numbers used", value: used, ...(used <= EXACT_ELEGANT_TILES ? { tone: "good" as const } : {}) } : null,
      ]} />
    </div>
  );
}

/** The starting numbers that fed the number on target (display only; the server counts its own). */
function exactTilesUsedPhone(tiles: number[], target: number, answer: string): number | null {
  let pool = tiles.map((value) => ({ value, uses: 1 }));
  for (const step of replayTargetSteps(tiles, target, decodeSteps(answer)).steps) {
    const first = pool.findIndex((t) => t.value === step.a);
    if (first < 0) break;
    const rest = pool.filter((_, i) => i !== first);
    const second = rest.findIndex((t) => t.value === step.b);
    if (second < 0) break;
    pool = [...rest.filter((_, i) => i !== second), { value: step.result, uses: pool[first]!.uses + rest[second]!.uses }];
  }
  return pool.find((t) => t.value === target)?.uses ?? null;
}

export const targetNumberPuzzle: PuzzleDefinition = {
  key: "target",
  name: gameDisplayName("target"),
  category: "number",
  timeLimitMs: TARGET_TIME_MS,
  generate: generateTargetPuzzle,
  check: (answer, puzzle) => {
    if (puzzle.type !== "target") return false;
    const replay = replayTargetSteps(puzzle.tiles, puzzle.target, decodeSteps(answer));
    return replay.distance === 0;
  },
  IntroExample,
  Stage,
  Reveal,
};
