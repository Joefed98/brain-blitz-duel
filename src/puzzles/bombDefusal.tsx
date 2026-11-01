import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  actionLabel,
  BOMB_SWITCH_POSITIONS,
  checkBombPlan,
  cutAction,
  decodeBombActions,
  decodeBombConstraints,
  encodeBombActions,
  isCut,
  pressAction,
  WIRE_HEX,
  type BombAction,
  type BombButton,
  type BombSwitch,
  type WireColour,
} from "@/lib/duel/bomb";
import { useStageState } from "@/lib/duel/stageState";
import { BOMB_MAX_SEQUENCE, BOMB_TIME_MS, BOMB_V2_TIME_MS, BOMB_WIRES, type BombPuzzleData } from "@/lib/duel/types";
import { playLock } from "@/lib/sound";
import { useGameKeys } from "@/lib/desktop";

import { soundCue } from "./logicFx";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

interface PanelProps {
  wires: WireColour[];
  buttons: BombButton[];
  light: boolean;
  serial: string;
  switchPosition: BombSwitch;
  cutWires?: number[];
  pressed?: ("A" | "B")[];
  onWire?: ((index: number) => void) | undefined;
  onButton?: ((label: "A" | "B") => void) | undefined;
  compact?: boolean;
  /** Live panel only: whole seconds left on the decorative LED timer (null = no timer). */
  ledSeconds?: number | null;
  /** True once DEFUSE is pressed: the LED freezes and the fuse spark dies. */
  frozen?: boolean;
  /** The last action, keyed by step count, for the cut and press animations. */
  lastAction?: { action: BombAction; key: number } | null;
}

function ledText(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** The dark bomb box: thick coloured wires, two round caps, an LED and a plate. */
export function Panel({
  wires,
  buttons,
  light,
  serial,
  switchPosition,
  cutWires = [],
  pressed = [],
  onWire,
  onButton,
  compact = false,
  ledSeconds = null,
  frozen = false,
  lastAction = null,
}: PanelProps) {
  return (
    <div className={`bomb-plate logic-bomb relative flex h-full w-full flex-col justify-between rounded-2xl border-2 border-border p-2 ${frozen ? "logic-bomb-frozen" : ""}`}>
      <span aria-hidden="true" data-corner="tl" className="bomb-screw" />
      <span aria-hidden="true" data-corner="tr" className="bomb-screw" />
      <span aria-hidden="true" data-corner="bl" className="bomb-screw" />
      <span aria-hidden="true" data-corner="br" className="bomb-screw" />
      <div className="flex items-center justify-between gap-2 px-1">
        <span
          aria-hidden="true"
          className="rounded-full"
          style={{
            width: compact ? 8 : 12,
            height: compact ? 8 : 12,
            backgroundColor: light ? WIRE_HEX.YELLOW : "#3A3A3A",
            boxShadow: light ? `0 0 8px ${WIRE_HEX.YELLOW}` : "none",
          }}
        />
        {ledSeconds !== null && (
          <span className="logic-bomb-led-wrap" aria-hidden="true">
            <span className="logic-bomb-spark"><i /><i /><i /></span>
            <span className="logic-bomb-led font-mono font-bold">{ledText(ledSeconds)}</span>
          </span>
        )}
        <span
          className="bomb-serial logic-bomb-serial rounded bg-muted px-2 py-0.5 font-mono text-sm font-bold tracking-widest text-foreground/90"
          style={{ backgroundColor: "#5A5A5A22" }}
        >
          {serial}
        </span>
        <span
          className="flex items-center gap-0.5 rounded border border-border bg-card p-0.5"
          aria-label={`Switch ${switchPosition}`}
        >
          {BOMB_SWITCH_POSITIONS.map((position) => (
            <span
              key={position}
              className={`h-3 w-3.5 rounded-sm ${position === switchPosition ? "bg-primary" : "bg-border"}`}
              title={position}
            />
          ))}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 py-1">
        {wires.map((colour, index) => {
          const isCutWire = cutWires.includes(index);
          const justCut = isCutWire && lastAction?.action === `w${index}`;
          const strand = (style: CSSProperties, end?: "left" | "right") => (
            <span
              key={`${end ?? "whole"}-${justCut ? lastAction?.key : 0}`}
              className={`logic-wire rounded-full ${end ? `logic-wire-cut logic-wire-${end}` : ""} ${justCut ? "logic-wire-snap" : ""}`}
              style={{
                height: compact ? 4 : 8,
                backgroundColor: WIRE_HEX[colour],
                boxShadow: colour === "BLACK" ? "0 0 0 1px #6A6A74" : undefined,
                ...style,
              }}
            />
          );
          return (
            <button
              key={index}
              type="button"
              disabled={!onWire || isCutWire}
              onClick={() => onWire?.(index)}
              aria-label={`Wire ${index + 1}`}
              className="flex w-full items-center gap-1"
            >
              <span className="bomb-wire-index font-mono text-sm font-bold text-muted-foreground">{index + 1}</span>
              <span className="relative flex flex-1 items-center">
                {!compact && <span aria-hidden="true" className="logic-terminal logic-terminal-left" />}
                {strand({ flex: isCutWire ? "0 0 42%" : 1, opacity: isCutWire ? 0.75 : 1 }, isCutWire ? "left" : undefined)}
                {isCutWire && <span className="relative flex-1">{justCut && !compact && <span aria-hidden="true" className="logic-wire-sparks"><i /><i /><i /><i /></span>}</span>}
                {isCutWire && strand({ flex: "0 0 42%", opacity: 0.75 }, "right")}
                {!compact && <span aria-hidden="true" className="logic-terminal logic-terminal-right" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 pt-1">
        {buttons.map((button) => {
          const isDown = pressed.includes(button.label);
          const justPressed = lastAction?.action === `b${button.label}`;
          return (
            <button
              key={`${button.label}-${justPressed ? lastAction?.key : 0}`}
              type="button"
              disabled={!onButton}
              onClick={() => onButton?.(button.label)}
              aria-label={`Button ${button.label}`}
              className={`logic-bomb-cap flex items-center justify-center rounded-full border-2 font-mono text-xs font-bold ${justPressed ? "logic-bomb-cap-press" : ""}`}
              style={{
                width: compact ? 24 : 44,
                height: compact ? 24 : 44,
                backgroundColor: WIRE_HEX[button.colour],
                borderColor: isDown ? "#F5B82E" : button.colour === "BLACK" ? "#6A6A74" : "transparent",
                color: button.colour === "BLACK" ? "#F2F2F2" : "#111",
                boxShadow: isDown ? "0 0 8px rgba(245,184,46,0.8)" : "none",
              }}
            >
              {button.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


const TOKEN_RE = /(wires \d and \d|wire \d|button [AB]|press [AB]|\b(?:Red|Blue|Green|Yellow|White|Black)\b)/gi;

function Swatch({ colour }: { colour: WireColour }) {
  return (
    <span
      className="mx-0.5 inline-block h-2.5 w-4 shrink-0 rounded-[2px] align-middle shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
      style={{
        backgroundColor: WIRE_HEX[colour],
        border: colour === "BLACK" ? "1px solid #8A8A94" : "none",
      }}
    />
  );
}

function RuleText({
  text,
  wires,
  buttons,
}: {
  text: string;
  wires: WireColour[];
  buttons: { label: "A" | "B"; colour: WireColour }[];
}) {
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <span key={index}>{part}</span>;
        const lower = part.toLowerCase();
        
        if (lower.startsWith("wires ")) {
          const [a, b] = (part.match(/\d/g) ?? []).map(Number);
          const c1 = wires[(a ?? 1) - 1] ?? "WHITE";
          const c2 = wires[(b ?? 1) - 1] ?? "WHITE";
          return (
            <span key={index} className="inline-flex items-center font-bold text-foreground/90">
              wires&nbsp;
              <Swatch colour={c1} />
              <span>{a}</span>
              &nbsp;and&nbsp;
              <Swatch colour={c2} />
              <span>{b}</span>
            </span>
          );
        }
        
        if (lower.startsWith("wire ")) {
          const n = Number(part.slice(5));
          const colour = wires[n - 1] ?? "WHITE";
          return (
            <span key={index} className="inline-flex items-center font-bold text-foreground/90">
              <Swatch colour={colour} />
              {part}
            </span>
          );
        }
        
        if (lower.startsWith("button ") || lower.startsWith("press ")) {
          const label = part.slice(-1) as "A" | "B";
          const colour = buttons.find((b) => b.label === label)?.colour ?? "WHITE";
          return (
            <span key={index} className="inline-flex items-center font-bold text-foreground/90">
              <Swatch colour={colour} />
              {part}
            </span>
          );
        }
        
        const colour = part.toUpperCase() as WireColour;
        return (
          <span key={index} className="inline-flex items-center font-bold uppercase tracking-tight text-foreground/90">
            <Swatch colour={colour} />
            {part}
          </span>
        );
      })}
    </>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: 150, height: 118 }}>
        <Panel
          wires={["RED", "BLUE"]}
          buttons={[{ label: "A", colour: "WHITE" }]}
          light
          serial="317"
          switchPosition="MID"
          cutWires={[1]}
          compact
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Clue: “Step 1: cut wire 2.” So wire 2 is cut first. Read every clue, work out the six steps and their order, then do them.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "bomb",
}: PuzzleStageProps) {
  const isBomb = puzzle.type === "bomb";
  const [actions, setActions] = useStageState<BombAction[]>(stateKey, "bombActions", () => []);
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  const submitted = useRef(false);
  const stepTotal = (isBomb ? puzzle.stepCount || BOMB_MAX_SEQUENCE : BOMB_MAX_SEQUENCE);
  const inFrame = useFrameProgress(Math.min(actions.length, stepTotal), stepTotal, "steps");

  useEffect(() => {
    onDraftAnswer?.(encodeBombActions(actions));
  }, [actions, onDraftAnswer]);

  const act = (action: BombAction) => {
    if (locked || submitted.current) return;
    soundCue(isCut(action) ? "bomb.cut" : "bomb.press");
    const next = [...actions, action];
    setActions(next);
  };

  useEffect(() => {
    if (locked || submitted.current || !isBomb) return;
    if (now < phaseStartedAt + (puzzle.timeLimitMs ?? BOMB_TIME_MS) - 400) return;
    submitted.current = true;
    onSubmit(encodeBombActions(actions));
  }, [now, phaseStartedAt, actions, locked, isBomb, onSubmit]);

  const defuse = () => {
    if (locked || submitted.current) return;
    submitted.current = true;
    playLock();
    // The panel freezes at the press; whether it is defused is the server's verdict.
    setFrozenAt(Date.now());
    soundCue("bomb.defuse");
    onSubmit(encodeBombActions(actions));
  };

  // Desktop keys: 1–n cut that wire, A / B press that button, Enter = Defuse, R = Reset.
  useGameKeys((kind, key, event) => {
    if (!isBomb) return false;
    const wire = /^[1-9]$/.test(key) && Number(key) <= puzzle.wires.length ? Number(key) - 1 : null;
    const button = puzzle.buttons.find((b) => b.label.toLowerCase() === key);
    const used = wire !== null || button !== undefined || key === "Enter" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (wire !== null) {
      if (!actions.filter(isCut).some((action) => Number.parseInt(action.slice(1), 10) === wire)) act(cutAction(wire));
    } else if (button) act(pressAction(button.label));
    else if (key === "Enter") {
      if (!(locked || !actions.length)) defuse();
    } else if (!(locked || !actions.length || submitted.current)) setActions([]);
    return true;
  });

  if (!isBomb) return null;

  const cutWires = actions.filter(isCut).map((action) => Number.parseInt(action.slice(1), 10));
  const pressed = actions
    .filter((action) => !isCut(action))
    .map((action) => action.slice(1) as "A" | "B");
  const limitMs = puzzle.timeLimitMs ?? BOMB_TIME_MS;
  const ledSeconds = Math.ceil(Math.max(0, phaseStartedAt + limitMs - (frozenAt ?? now)) / 1000);
  const last = actions.at(-1);

  return (
    <div data-stage-column="2" data-logic-stage="bomb" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <div data-game-arena="logic">
        <div className="logic-bomb-rules w-full shrink-0 rounded-xl border border-border bg-card p-2">
          {puzzle.rules.map((rule, index) => (
            <p key={rule.id} className="text-[14px] leading-[1.5]">
              <span className="font-mono text-primary">{index + 1}.</span>{" "}
              <RuleText text={rule.text} wires={puzzle.wires} buttons={puzzle.buttons} />
            </p>
          ))}
        </div>

        <div className="logic-bomb-board flex w-full">
          <Panel
            wires={puzzle.wires}
            buttons={puzzle.buttons}
            light={puzzle.light}
            serial={puzzle.serial}
            switchPosition={puzzle.switchPosition}
            cutWires={cutWires}
            pressed={pressed}
            onWire={(index) => act(cutAction(index))}
            onButton={(label) => act(pressAction(label))}
            ledSeconds={ledSeconds}
            frozen={frozenAt !== null}
            lastAction={last ? { action: last, key: actions.length } : null}
          />
        </div>
      </div>

      <div data-game-controls="actions" className="flex shrink-0 items-center justify-between">
        {inFrame ? null : (
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            steps <span className="text-primary">{actions.length}</span> / {puzzle.stepCount || BOMB_MAX_SEQUENCE}
          </p>
        )}
        <div className="flex flex-1 items-center justify-center">
        <Button
          type="button"
          disabled={locked || !actions.length}
          onClick={defuse}
          className="h-11 w-3/4 rounded-lg px-4 font-display text-[10.5px] font-bold uppercase tracking-widest disabled:opacity-40"
        >
          Defuse
        </Button>
        </div>
        <button
          type="button"
          disabled={locked || !actions.length || submitted.current}
          onClick={() => {
            setActions([]);
          }}
          className="h-11 rounded-xl border border-border px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/** The reveal's status lamp: red, turning green on a verified defuse. */
function BombLamp({ defused }: { defused: boolean }) {
  const cued = useRef(false);
  useEffect(() => {
    if (!defused || cued.current) return;
    cued.current = true;
    soundCue("bomb.solve");
  }, [defused]);
  return <span aria-hidden="true" className={`logic-bomb-lamp ${defused ? "logic-bomb-lamp-green" : ""}`} />;
}

/** Whether a revealed plan replays as an explosion; the answer reveal plays its cue. */
export function bombRevealExploded(puzzle: PuzzleRevealProps["puzzle"], answer: string | null | undefined): boolean {
  if (puzzle.type !== "bomb") return false;
  const required = decodeBombActions(puzzle.required ?? puzzle.sequence ?? "");
  return checkBombPlan(required, decodeBombConstraints(puzzle.constraints ?? ""), decodeBombActions(answer ?? "")).exploded;
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "bomb") return null;
  const required = decodeBombActions(puzzle.required ?? puzzle.sequence ?? "");
  const constraints = decodeBombConstraints(puzzle.constraints ?? "");
  const shown = decodeBombActions(puzzle.sequence ?? "");
  const mine = decodeBombActions(myAnswer ?? "");
  const replay = checkBombPlan(required, constraints, mine);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="grid w-full grid-cols-2 gap-3 text-base">
        <div>
          <p className="mb-1 text-center font-mono uppercase text-primary">One valid plan</p>
          {shown.map((action, index) => (
            <p key={`${action}-${index}`} className="break-words">
              <span className="font-mono text-primary">{index + 1}.</span>{" "}
              {actionLabel(action, puzzle.wires)}
            </p>
          ))}
        </div>
        <div>
          <p className="mb-1 text-center font-mono uppercase text-muted-foreground">Yours</p>
          {mine.map((action, index) => (
            <p
              key={`${action}-${index}`}
              className={index === replay.firstWrong ? "break-words text-warn" : "break-words"}
            >
              <span className="font-mono">{index + 1}.</span> {actionLabel(action, puzzle.wires)}
              {index === replay.firstWrong ? " ✗" : ""}
            </p>
          ))}
        </div>
      </div>
      <p className="flex items-center justify-center gap-2 font-display text-xl font-bold">
        <BombLamp defused={myCorrect && replay.defused} />
        <span className={myCorrect ? "text-ok" : "text-warn"}>
          {replay.exploded
            ? `Exploded at step ${replay.correctPrefix + 1}`
            : replay.defused
              ? "DEFUSED"
              : `${replay.correctPrefix} / ${required.length} steps`}
        </span>
        {myCorrect && elapsed !== null && (
          <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">
            {elapsed.toFixed(1)}s
          </span>
        )}
      </p>
    </div>
  );
}

/** The rules and panel are public; the required sequence is server-side only. */
export const bombDefusalPuzzle: PuzzleDefinition = {
  key: "bomb",
  name: gameDisplayName("bomb"),
  category: "logic",
  // New six-step rounds carry their own 90 s clock; this default covers stored four-step rounds.
  timeLimitMs: BOMB_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "bomb",
      wires: new Array<WireColour>(BOMB_WIRES).fill("RED"),
      buttons: [
        { label: "A", colour: "WHITE" },
        { label: "B", colour: "RED" },
      ],
      light: false,
      serial: "000",
      switchPosition: "MID",
      rules: [],
      stepCount: 0,
    }) satisfies BombPuzzleData,
  check: () => false,
  revealHeading: "The right moves",
  IntroExample,
  Stage,
  Reveal,
};
