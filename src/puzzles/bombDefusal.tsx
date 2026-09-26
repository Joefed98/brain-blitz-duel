import { useEffect, useRef } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
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
import { BOMB_MAX_SEQUENCE, BOMB_TIME_MS, BOMB_WIRES, type BombPuzzleData } from "@/lib/duel/types";
import { playLock } from "@/lib/sound";

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
}

/** The dark bomb box: thick coloured wires, two round caps, an LED and a plate. */
function Panel({
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
}: PanelProps) {
  return (
    <div className="flex h-full w-full flex-col justify-between rounded-2xl border-2 border-border bg-background/70 p-2">
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
        <span
          className="rounded bg-muted px-2 font-mono text-[11px] tracking-widest text-foreground/80"
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
              className={`h-2.5 w-3 rounded-sm ${position === switchPosition ? "bg-primary" : "bg-border"}`}
              title={position}
            />
          ))}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 py-1">
        {wires.map((colour, index) => {
          const isCutWire = cutWires.includes(index);
          return (
            <button
              key={index}
              type="button"
              disabled={!onWire || isCutWire}
              onClick={() => onWire?.(index)}
              aria-label={`Wire ${index + 1}`}
              className="flex w-full items-center gap-1"
            >
              <span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span>
              <span className="flex flex-1 items-center">
                <span
                  className="rounded-full"
                  style={{
                    height: compact ? 5 : 9,
                    flex: isCutWire ? "0 0 42%" : 1,
                    backgroundColor: WIRE_HEX[colour],
                    opacity: isCutWire ? 0.7 : 1,
                  }}
                />
                {isCutWire && <span className="flex-1" />}
                {isCutWire && (
                  <span
                    className="rounded-full"
                    style={{
                      height: compact ? 5 : 9,
                      flex: "0 0 42%",
                      backgroundColor: WIRE_HEX[colour],
                      opacity: 0.7,
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 pt-1">
        {buttons.map((button) => {
          const isDown = pressed.includes(button.label);
          return (
            <button
              key={button.label}
              type="button"
              disabled={!onButton}
              onClick={() => onButton?.(button.label)}
              aria-label={`Button ${button.label}`}
              className="flex items-center justify-center rounded-full border-2 font-mono text-xs font-bold"
              style={{
                width: compact ? 24 : 40,
                height: compact ? 24 : 40,
                backgroundColor: WIRE_HEX[button.colour],
                borderColor: isDown ? "#F5B82E" : "transparent",
                color: "#111",
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
        Rule: if the light is on, cut the second wire — so wire 2 is cut.
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
  const submitted = useRef(false);

  useEffect(() => {
    onDraftAnswer?.(encodeBombActions(actions));
  }, [actions, onDraftAnswer]);

  const act = (action: BombAction) => {
    if (locked || submitted.current) return;
    hapticTick();
    const next = [...actions, action];
    setActions(next);
  };

  useEffect(() => {
    if (locked || submitted.current || !isBomb) return;
    if (now < phaseStartedAt + BOMB_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeBombActions(actions));
  }, [now, phaseStartedAt, actions, locked, isBomb, onSubmit]);

  if (!isBomb) return null;

  const cutWires = actions.filter(isCut).map((action) => Number.parseInt(action.slice(1), 10));
  const pressed = actions
    .filter((action) => !isCut(action))
    .map((action) => action.slice(1) as "A" | "B");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="shrink-0 rounded-xl border border-border bg-card p-2">
        {puzzle.rules.map((rule, index) => (
          <p key={rule.id} className="text-[14px] leading-snug">
            <span className="font-mono text-primary">{index + 1}.</span> {rule.text}
          </p>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
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
        />
      </div>

      <div className="flex shrink-0 items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          steps <span className="text-primary">{actions.length}</span> / {BOMB_MAX_SEQUENCE}
        </p>
        <button
          type="button"
          disabled={locked || !actions.length}
          onClick={() => {
            if (locked || submitted.current) return;
            submitted.current = true;
            playLock();
            onSubmit(encodeBombActions(actions));
          }}
          className="h-12 flex-1 rounded-xl bg-primary px-5 font-display text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          Defuse
        </button>
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
      <p className="shrink-0 text-center text-[11px] text-muted-foreground">
        Read every rule, act in order, then tap DEFUSE
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "bomb") return null;
  const required = decodeBombActions(puzzle.required ?? puzzle.sequence ?? "");
  const constraints = decodeBombConstraints(puzzle.constraints ?? "");
  const shown = decodeBombActions(puzzle.sequence ?? "");
  const mine = decodeBombActions(myAnswer ?? "");
  const replay = checkBombPlan(required, constraints, mine);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((BOMB_TIME_MS - myMsRemaining) / 100) / 10;

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
      <p className="font-display text-xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {replay.exploded
            ? `Exploded at step ${replay.correctPrefix + 1}`
            : replay.defused
              ? "Defused"
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
  name: "Bomb Defusal",
  category: "logic",
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
