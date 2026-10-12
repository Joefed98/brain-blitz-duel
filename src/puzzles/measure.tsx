import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { StageCorrect, useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import { StageProgress } from "@/components/puzzles/StageProgress";
import {
  decodeMeasureActions,
  encodeMeasureRound,
  measureApply,
  replayMeasure,
  splitMeasureRound,
  MEASURE_BOARDS,
  type MeasureAction,
} from "@/lib/duel/measure";
import { useStageState } from "@/lib/duel/stageState";
import { MEASURE_TIME_MS, type MeasureBoardData, type MeasurePuzzleData } from "@/lib/duel/types";
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
const POUR_MS = 520;
const NO_ACTIONS: MeasureAction[] = [];

function goalText(board: MeasureBoardData): string {
  if (board.goal === "split") return `Make ${(board.split ?? []).join(" · ")}`;
  return `Make ${board.target} L in any jug`;
}

/** Litres each jug should hold for the target line: the target on every jug, or each jug's share of the split. */
function targetLines(board: MeasureBoardData): (number | null)[] {
  if (board.goal === "split") return board.caps.map((_, jug) => board.split?.[jug] ?? null);
  return board.caps.map((cap) =>
    board.target !== undefined && board.target <= cap ? board.target : null,
  );
}

/**
 * Glass jugs on one shared litre scale, so a target line sits at the same
 * height on every jug. Water levels ease between amounts (the pour animation);
 * the pour stream arcs from the source jug to the destination while it runs.
 */
function Jugs({
  board,
  amounts,
  litre,
  width,
  selected,
  shake,
  pour,
  onJug,
}: {
  board: MeasureBoardData;
  amounts: readonly number[];
  /** Pixels per litre. */
  litre: number;
  width: number;
  selected?: number | null;
  shake?: number | null;
  pour?: { from: number; to: number } | null;
  onJug?: ((jug: number) => void) | undefined;
}) {
  const lines = targetLines(board);
  const maxCap = Math.max(...board.caps);
  const tall = maxCap * litre;
  const small = litre < 9;
  const gap = Math.max(10, Math.round(width * 0.28));
  return (
    <div className="relative flex items-end justify-center" style={{ gap, paddingTop: 22 }}>
      {pour ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 animate-pour-stream"
          style={{ height: 30, width: "100%" }}
          viewBox={`0 0 ${board.caps.length * (width + gap)} 30`}
          preserveAspectRatio="none"
        >
          <path
            d={`M ${pour.from * (width + gap) + width / 2 + gap / 2} 28 Q ${((pour.from + pour.to) / 2) * (width + gap) + width / 2 + gap / 2} -6 ${pour.to * (width + gap) + width / 2 + gap / 2} 28`}
            fill="none"
            stroke="var(--measure-water)"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      {board.caps.map((cap, jug) => {
        const height = cap * litre;
        const amount = amounts[jug] ?? 0;
        const line = lines[jug];
        const isSelected = selected === jug;
        return (
          <button
            key={jug}
            type="button"
            data-puzzle-cell={jug}
            data-measure-jug={jug}
            disabled={!onJug}
            onClick={() => onJug?.(jug)}
            aria-label={`Jug ${jug + 1}: ${amount} of ${cap} litres`}
            className={`relative flex flex-col items-center justify-end transition-transform duration-150 ${isSelected ? "-translate-y-2" : ""} ${shake === jug ? "animate-shake" : ""}`}
            style={{ width, height: tall + 26 }}
          >
            <div
              className={`measure-glass relative w-full overflow-hidden rounded-b-[14px] rounded-t-[4px] border-2 ${isSelected ? "border-primary ring-2 ring-primary" : "border-[color:var(--measure-glass-edge)]"}`}
              style={{ height }}
            >
              <div
                className="measure-water absolute inset-x-0 bottom-0"
                style={{ height: amount * litre, transition: `height ${POUR_MS}ms ease-in-out` }}
              />
              {/* Litre markings: a tick every litre, a number every litre (every other on small jugs). */}
              {Array.from({ length: cap - 1 }, (_, i) => i + 1).map((l) => (
                <div
                  key={l}
                  className="pointer-events-none absolute left-0 flex items-center"
                  style={{ bottom: l * litre - 1 }}
                >
                  <span
                    className="block h-[2px] bg-[color:var(--measure-tick)]"
                    style={{ width: l % 5 === 0 ? 12 : 7 }}
                  />
                  {!small || l % 2 === 0 ? (
                    <span
                      className="ml-0.5 font-mono leading-none text-[color:var(--measure-tick)]"
                      style={{
                        fontSize: Math.min(11, Math.max(8, litre * 0.8)),
                        transform: "translateY(0.5px)",
                      }}
                    >
                      {l}
                    </span>
                  ) : null}
                </div>
              ))}
              {line !== null && line !== undefined ? (
                <div
                  data-measure-target
                  className="pointer-events-none absolute inset-x-0 border-t-[3px] border-dashed border-primary"
                  style={{ bottom: line * litre - 1.5 }}
                />
              ) : null}
            </div>
            <span className="mt-1 h-5 font-mono text-sm leading-5 text-foreground">
              <span
                className={measureSolvedJug(board, amount, jug) ? "font-bold text-primary" : ""}
              >
                {amount}
              </span>
              <span className="text-muted-foreground">/{cap}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function measureSolvedJug(board: MeasureBoardData, amount: number, jug: number): boolean {
  if (board.goal === "split") return board.split?.[jug] === amount;
  return amount === board.target;
}

/** Fixed example: jugs of 5 and 3, make 4. Fill 5, pour, empty 3, pour, fill 5, pour. */
const EXAMPLE_BOARD: MeasureBoardData = {
  caps: [5, 3],
  start: [0, 0],
  tap: true,
  goal: "amount",
  target: 4,
};
const EXAMPLE_STEPS: { amounts: number[]; label: string }[] = [
  { amounts: [0, 0], label: "Make 4 L" },
  { amounts: [5, 0], label: "Fill the 5" },
  { amounts: [2, 3], label: "Pour 5 → 3" },
  { amounts: [2, 0], label: "Empty the 3" },
  { amounts: [0, 2], label: "Pour 5 → 3" },
  { amounts: [5, 2], label: "Fill the 5" },
  { amounts: [4, 3], label: "Pour 5 → 3: 4 L!" },
];

function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % (EXAMPLE_STEPS.length + 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const shown = EXAMPLE_STEPS[Math.min(step, EXAMPLE_STEPS.length - 1)]!;
  return (
    <div className="flex flex-col items-center gap-2" style={ROOT_STYLE}>
      <Jugs board={EXAMPLE_BOARD} amounts={shown.amounts} litre={14} width={52} />
      <p className="h-5 font-mono text-sm text-primary">{shown.label}</p>
      <p className="max-w-[270px] text-center text-xs text-muted-foreground">
        Six moves. Every fill, empty and pour counts. Puzzle 4 has no tap: share out what&apos;s
        there.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "measure",
}: PuzzleStageProps) {
  const data: MeasurePuzzleData | null = puzzle.type === "measure" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "measureStage", () => 0);
  const [allActions, setAllActions] = useStageState<MeasureAction[][]>(
    stateKey,
    "measureActions",
    () => Array.from({ length: MEASURE_BOARDS }, () => []),
  );
  const [selected, setSelected] = useStageState<number | null>(
    stateKey,
    "measureSelected",
    () => null,
  );
  const [shake, setShake] = useState<number | null>(null);
  const [pour, setPour] = useState<{ from: number; to: number } | null>(null);
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 360, height: 420 });

  const board = data?.boards[Math.min(stage, MEASURE_BOARDS - 1)];
  const actions = allActions[stage] ?? NO_ACTIONS;
  const replay = useMemo(() => (board ? replayMeasure(board, actions) : null), [board, actions]);
  const encoded = encodeMeasureRound(allActions);

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

  const complete = replay?.solved ?? false;
  const advance = () => {
    setSelected(null);
    if (stage >= MEASURE_BOARDS - 1) {
      submitted.current = true;
      onSubmit(encodeMeasureRound(allActions));
      return;
    }
    setStage(stage + 1);
  };
  const holding = useStageCorrectHold({
    complete,
    finalStage: stage >= MEASURE_BOARDS - 1,
    locked: locked || submitted.current,
    stateKey,
    onAdvance: () => {
      playCorrect();
      advance();
    },
  });

  if (!data || !board || !replay) return null;
  const busy = locked || submitted.current || complete;

  const reject = (jug: number) => {
    setShake(jug);
    buzz(20);
    playWrong();
    setTimeout(() => setShake(null), 320);
  };
  const act = (action: MeasureAction): boolean => {
    if (busy) return false;
    if (!measureApply(board, replay.amounts, action)) return false;
    hapticTick();
    const boards = [...allActions];
    boards[stage] = [...actions, action];
    setAllActions(boards);
    return true;
  };
  const tapJug = (jug: number) => {
    if (busy) return;
    if (selected === null) {
      setSelected(jug);
      hapticTick();
      return;
    }
    if (selected === jug) {
      setSelected(null);
      return;
    }
    const from = selected;
    setSelected(null);
    if (!act({ kind: "pour", from, to: jug })) {
      reject(jug);
      return;
    }
    setPour({ from, to: jug });
    setTimeout(() => setPour((p) => (p && p.from === from && p.to === jug ? null : p)), POUR_MS);
  };
  const fillOrEmpty = (kind: "fill" | "empty") => {
    if (selected === null) return;
    const jug = selected;
    if (!act({ kind, jug })) reject(jug);
    else setSelected(null);
  };
  const reset = () => {
    setSelected(null);
    act({ kind: "reset" });
  };

  const maxCap = Math.max(...board.caps);
  const jugWidth = Math.max(
    54,
    Math.min(96, Math.floor((size.width - 24) / (board.caps.length * 1.35))),
  );
  const litre = Math.max(6, Math.min(26, Math.floor((size.height - 60) / maxCap)));
  const atStart = replay.amounts.every((v, i) => v === board.start[i]);
  const button =
    "h-11 min-w-[72px] flex-1 rounded-xl border border-border font-mono text-xs uppercase tracking-widest text-foreground disabled:opacity-40";

  return (
    <div
      data-play-area
      data-stage-column="1"
      className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 py-0.5"
      style={ROOT_STYLE}
    >
      <StageProgress stage={stage} total={MEASURE_BOARDS} />
      <div className="flex h-9 w-full shrink-0 items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase text-muted-foreground">
          Puzzle {stage + 1} of {MEASURE_BOARDS} · moves{" "}
          <span className="text-primary">{replay.moves}</span>
        </p>
        <p className="font-display text-sm font-bold text-primary" data-measure-goal>
          {goalText(board)}
        </p>
      </div>
      <StageCorrect visible={holding} />
      <div
        ref={box}
        data-game-arena="board"
        className="flex min-h-0 w-full flex-1 items-end justify-center pb-1"
      >
        <Jugs
          board={board}
          amounts={replay.amounts}
          litre={litre}
          width={jugWidth}
          selected={selected}
          shake={shake}
          pour={pour}
          onJug={busy ? undefined : tapJug}
        />
      </div>
      <p className="h-4 shrink-0 text-center text-[11px] leading-4 text-muted-foreground">
        {selected === null
          ? "Tap a jug"
          : board.tap
            ? "Tap another jug to pour, or Fill / Empty"
            : "Tap another jug to pour into it"}
      </p>
      <div data-game-controls="actions" className="flex w-full shrink-0 justify-center gap-2 px-1">
        {board.tap ? (
          <>
            <button
              type="button"
              className={button}
              disabled={
                busy ||
                selected === null ||
                (replay.amounts[selected] ?? 0) >= (board.caps[selected] ?? 0)
              }
              onClick={() => fillOrEmpty("fill")}
            >
              Fill
            </button>
            <button
              type="button"
              className={button}
              disabled={busy || selected === null || (replay.amounts[selected] ?? 0) <= 0}
              onClick={() => fillOrEmpty("empty")}
            >
              Empty
            </button>
          </>
        ) : null}
        <button type="button" className={button} disabled={busy || atStart} onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}

function routeText(board: MeasureBoardData, raw: string): string {
  return decodeMeasureActions(raw, board.caps.length)
    .map((a) =>
      a.kind === "fill"
        ? `Fill ${board.caps[a.jug]}`
        : a.kind === "empty"
          ? `Empty ${board.caps[a.jug]}`
          : a.kind === "pour"
            ? `${board.caps[a.from]}→${board.caps[a.to]}`
            : "Reset",
    )
    .join(" · ");
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "measure") return null;
  const parts = splitMeasureRound(myAnswer);
  let open = true;
  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 px-1">
      {puzzle.boards.map((board, index) => {
        const mine = open
          ? replayMeasure(board, decodeMeasureActions(parts[index] ?? "", board.caps.length))
          : null;
        if (!mine?.solved) open = false;
        const min = puzzle.minMoves?.[index];
        return (
          <div
            key={index}
            data-puzzle-cell={index}
            className="rounded-lg border border-border px-2 py-1"
          >
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">
                {index + 1}. Jugs {board.caps.join(", ")} ·{" "}
                {board.goal === "split"
                  ? `split ${(board.split ?? []).join("-")}`
                  : `${board.target} L`}
              </span>
              <span className={mine?.solved ? "font-bold text-primary" : "text-warn"}>
                {mine?.solved ? `✓ ${mine.moves} moves` : mine ? "✗ unsolved" : "—"}
                <span className="text-muted-foreground"> · best {min ?? "?"}</span>
              </span>
            </div>
            {puzzle.solutions?.[index] ? (
              <p className="mt-0.5 break-words font-mono text-[10px] leading-snug text-muted-foreground">
                Best: {routeText(board, puzzle.solutions[index]!)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const measurePuzzle: PuzzleDefinition = {
  key: "measure",
  name: gameDisplayName("measure"),
  category: "number",
  timeLimitMs: MEASURE_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "measure",
      measureRev: 1,
      boards: [EXAMPLE_BOARD, EXAMPLE_BOARD, EXAMPLE_BOARD, EXAMPLE_BOARD],
    }) satisfies MeasurePuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "measure") return false;
    const parts = splitMeasureRound(answer);
    return puzzle.boards.every(
      (board, i) =>
        replayMeasure(board, decodeMeasureActions(parts[i] ?? "", board.caps.length)).solved,
    );
  },
  revealHeading: "Your moves and the fewest",
  IntroExample,
  Stage,
  Reveal,
};
