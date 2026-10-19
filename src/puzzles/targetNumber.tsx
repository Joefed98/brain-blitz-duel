import { gameDisplayName } from "@/lib/duel/gameNames";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { Undo2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playWrong } from "@/lib/sound";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";

import { buzz } from "@/lib/motion";
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
import { fastFinishSeconds } from "@/lib/duel/puzzleBandsText";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

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
const EXACT_CSS = `
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
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Use the six numbers to reach the target. Each number once; every step must be a whole
        number.
      </p>
      <p className="font-mono text-5xl font-bold text-primary">462</p>
      <div className="grid w-full max-w-[260px] grid-cols-3 gap-2">
        {tiles.map((tile, index) => (
          <div
            key={`${tile}-${index}`}
            className={`flex h-12 items-center justify-center rounded-xl border border-border bg-card font-mono text-lg font-bold tabular-nums ${
              isLarge(tile) ? "text-primary" : "text-foreground"
            }`}
          >
            {tile}
          </div>
        ))}
      </div>
      <p className="text-center font-mono text-xs text-muted-foreground">
        75 × 6 = 450 · 450 + 10 = 460 · 460 + 2 = 462
      </p>
      <p className="text-center text-xs text-muted-foreground">
        A hit scores 120 to 150 (150 in about {fastFinishSeconds("target")} s); off by 1 scores 110, less the further off.
      </p>
    </div>
  );
}

interface Tile {
  id: number;
  value: number;
  active: boolean;
}

interface HistoryEntry {
  step: TargetStep;
  before: Tile[];
}

function Stage(props: PuzzleStageProps) {
  if (props.puzzle.type !== "target") return null;
  return <TargetStage {...props} tiles={props.puzzle.tiles} target={props.puzzle.target} />;
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
}: PuzzleStageProps & { tiles: number[]; target: number }) {
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

  const send = (list: TargetStep[]) => {
    if (submitted.current) return;
    submitted.current = true;
    setLockedHere(true);
    onSubmit(encodeSteps(list));
  };

  const refuse = () => {
    setShake((n) => n + 1);
    playWrong();
    buzz(20);
    setSelectedId(null);
    setOperator(null);
  };

  const reset = () => {
    if (locked || lockedHere) return;
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
    if (result === null) return refuse();

    const step: TargetStep = { a: first.value, b: tile.value, operator, result };
    const before = pool.map((entry) => ({ ...entry }));
    const nextHistory = [...history, { step, before }];
    setPool((current) =>
      current.map((entry) => {
        if (entry.id === first.id) return { ...entry, value: result, active: true };
        if (entry.id === tile.id) return { ...entry, active: false };
        return entry;
      }),
    );
    setHistory(nextHistory);
    setSelectedId(first.id);
    setOperator(null);
    setCombine((c) => ({ id: first.id, consumed: tile.id, n: (c?.n ?? 0) + 1 }));
    soundCue("target.combine");
    buzz(10);

    // Hitting the target locks the answer at once.
    if (result === target) {
      send(nextHistory.map((h) => h.step));
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
    send(steps);
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
    if (op) setOperator(op);
    else if (slot !== null) {
      const tile = pool[slot];
      if (tile?.active) tapTile(tile);
    } else if (key === "r") {
      if (history.length > 0) reset();
    } else send(steps);
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
            onClick={() => setOperator(op)}
            data-on={operator === op ? "true" : undefined}
            aria-pressed={operator === op}
            className="press exact-op"
          >
            {op === "-" ? "−" : op}
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
          onClick={() => send(steps)}
          disabled={isLockedNow}
          className="press tap-target rounded-xl bg-primary px-6 font-display text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          Lock{steps.length > 0 && away !== null && away > 0 ? ` · ${away} away` : ""}
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
.exact-reveal { display: flex; width: 100%; flex-direction: column; align-items: center; gap: 10px; text-align: center; font-family: var(--font-mono); font-size: 16px; }
.exact-reveal-card { position: relative; display: flex; width: 100%; flex-direction: column; align-items: center; gap: 4px; padding: 12px 12px 14px; border-radius: 16px; overflow: hidden;
  background: radial-gradient(120% 80% at 50% 0%, rgba(245,184,46,.12), transparent 62%), linear-gradient(180deg, #17171f, #101016); box-shadow: inset 0 0 0 1px rgba(245,184,46,.18), 0 6px 18px rgba(0,0,0,.3); }
.exact-reveal-card .exact-rings { position: absolute; left: 50%; top: 52%; width: 180px; height: 180px; translate: -50% -50%; pointer-events: none; opacity: .5; }
.exact-reveal-target { position: relative; font-size: 15px; color: #b4b4be; }
.exact-reveal-value { position: relative; font-size: 48px; line-height: 1.1; font-weight: 700; font-variant-numeric: tabular-nums; color: #F5B82E; text-shadow: 0 0 18px rgba(245,184,46,.28); }
.exact-reveal-verdict { position: relative; font-weight: 700; color: #f4f4f7; }
.exact-reveal-way { display: flex; width: 100%; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 14px; background: #15151c; box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); color: #d4d4dc; }
.exact-reveal-way > p:first-child { font-size: 14px; color: #b4b4be; }
.exact-reveal-way > p + p { font-size: 17px; line-height: 24px; font-variant-numeric: tabular-nums; }
`;

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
  return (
    <div className="exact-reveal">
      <PolishStyle id="target-reveal" css={EXACT_REVEAL_CSS} />
      <div className="exact-reveal-card">
        {EXACT_RINGS}
        <p className="exact-reveal-target">Target {puzzle.target}</p>
        <p className="exact-reveal-value">{replay.value ?? "—"}</p>
        <p className="exact-reveal-verdict">{myCorrect || away === 0 ? "Target hit!" : away === null ? "No number locked" : `${away} away from the target`}</p>
      </div>
      {(puzzle.solution ?? []).length > 0 && (
        <div className="exact-reveal-way"><p>One way:</p>{puzzle.solution.map((step, index) => <p key={index}>{formatStep(step)}</p>)}</div>
      )}
    </div>
  );
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
