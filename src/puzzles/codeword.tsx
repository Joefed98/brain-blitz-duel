import { useEffect, useRef, useState } from "react";

import {
  CW_MAX_ACTIONS,
  compactCodeword,
  codewordTally,
  decodeCodeword,
  encodeCodeword,
  replayCodeword,
  type CwAction,
} from "@/lib/duel/codeword";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useStageState } from "@/lib/duel/stageState";
import { CODEWORD_TIME_MS, type CodewordPuzzleData } from "@/lib/duel/types";
import { completeFx, fx } from "@/lib/fx";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { buzz } from "@/lib/motion";
import { KeypadAction, LetterKeypad } from "@/components/puzzles/LetterKeypad";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useMoveSync } from "@/components/puzzles/useMoveSync";
import { goldFlip, playFinish, useWordFinish, wordCue, type FinishStep } from "@/components/puzzles/wordFinish";
import { LiveSummary } from "@/components/puzzles/batchW/LiveSummary";
import "@/polish-layout/batch-w-codeword.css";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

type CellLook = "plain" | "given" | "selected" | "right" | "wrong";

const CELL: Record<CellLook, string> = {
  plain: "bg-card text-foreground",
  given: "bg-secondary text-primary",
  selected: "bg-primary/25 text-foreground ring-2 ring-inset ring-primary",
  right: "bg-card text-primary",
  wrong: "border-2 border-destructive bg-card text-muted-foreground",
};

/** The numbered grid: black squares, then each white cell's number (corner) and letter. */
export function Grid({
  size,
  cells,
  letters,
  look,
  onCell,
  numbers = true,
}: {
  size: number;
  cells: readonly number[];
  /** Letter per number (index n − 1). */
  letters: readonly string[];
  look: (n: number) => CellLook;
  onCell?: ((n: number) => void) | undefined;
  /** Corner numbers (the reveal shows the letters alone). */
  numbers?: boolean;
}) {
  return (
    <div
      className="grid h-full w-full rounded-md bg-background p-0.5"
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`, gap: 2, containerType: "size" }}
    >
      {cells.map((n, i) =>
        n === 0 ? (
          <div key={i} className="rounded-sm bg-black/80" aria-hidden="true" />
        ) : (
          <div
            key={i}
            data-cw-cell={n}
            data-cw-filled={letters[n - 1] ? "" : undefined}
            role={onCell ? "button" : undefined}
            aria-label={onCell ? `Number ${n}` : undefined}
            onClick={onCell ? () => onCell(n) : undefined}
            className={`relative flex items-center justify-center rounded-sm font-display font-bold ${CELL[look(n)]}`}
            style={{ fontSize: `calc(100cqw / ${size} * 0.52)` }}
          >
            {numbers ? (
              <span className="absolute left-0.5 top-0 font-mono font-normal leading-none text-muted-foreground" style={{ fontSize: `calc(100cqw / ${size} * 0.24)` }}>
                {n}
              </span>
            ) : null}
            {letters[n - 1] || " "}
          </div>
        ),
      )}
    </div>
  );
}

/** The key: every number with the letter on it so far. */
function KeyStrip({
  letters,
  given,
  selected,
  onPick,
}: {
  letters: readonly string[];
  given: ReadonlySet<number>;
  selected: number | null;
  onPick?: ((n: number) => void) | undefined;
}) {
  return (
    <div data-arena-part="codeword-key" className="flex w-full shrink-0 justify-center gap-px px-0.5" aria-label="Code key">
      {letters.map((letter, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            type="button"
            tabIndex={-1}
            onClick={onPick ? () => onPick(n) : undefined}
            disabled={!onPick}
            data-cw-key={n}
            data-cw-key-on={selected === n ? "" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center rounded-sm py-0.5 ${selected === n ? "bg-primary/25 ring-1 ring-primary" : "bg-card"}`}
            style={{ maxWidth: 26, touchAction: "manipulation" }}
          >
            {/* Batch W: the clue strip's type a step larger (10px numbers, 16px letters); the note line under it gave up the 4px. */}
            <span className="font-mono text-[10px] leading-none text-muted-foreground">{n}</span>
            <span className={`font-display text-base font-bold leading-tight ${given.has(n) ? "text-primary" : "text-foreground"}`}>{letter || "·"}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Fixed example: CAT across and COW down share C (given as 1); number 2 is selected and gets A. */
function IntroExample() {
  const cells = [1, 2, 3, 4, 0, 0, 5, 0, 0];
  const letters = ["C", "A", "", "", ""];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="shrink-0" style={{ width: 96, height: 96 }}>
        <Grid size={3} cells={cells} letters={letters} look={(n) => (n === 1 ? "given" : n === 2 ? "selected" : "plain")} />
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        1 is C. Tap a 2, then A: every 2 becomes A. CA_ across and C__ down: 3 is T, 4 is O, 5 is W.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, checkMoves, stateKey }: PuzzleStageProps) {
  const data: CodewordPuzzleData | null = puzzle.type === "codeword" ? puzzle : null;
  const key = stateKey ?? "codeword";
  const [actions, setActions] = useStageState<CwAction[]>(key, "cwActions", () => []);
  const [selected, setSelected] = useStageState<number | null>(key, "cwSelected", () => null);
  const [solved, setSolved] = useStageState<boolean>(key, "cwSolved", () => false);
  const [note, setNote] = useState<string | null>(null);
  const submitted = useRef(false);
  const root = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  useNoTouchScroll(root);

  const numbers = data?.numbers ?? 0;
  const givens = data?.givens ?? [];
  const letters = replayCodeword(numbers, givens, actions);
  const given = new Set(givens.map((g) => g.n));
  const givenLetters = new Set(givens.map((g) => g.letter));
  const encoded = encodeCodeword(actions);
  const complete = numbers > 0 && letters.every(Boolean);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((n) => (n === text ? null : n)), 1200);
  };

  const latestActions = useRef(actions);
  latestActions.current = actions;
  const sync = useMoveSync(checkMoves, "codeword", (view, sentMoves) => {
    if (sentMoves !== encodeCodeword(latestActions.current)) return;
    if (view.solved) {
      setSolved(true);
      return;
    }
    if (view.complete) {
      puzzleReject(gridRef.current, false);
      fx.onWrong();
      buzz([12, 60, 12]);
      flash("Not cracked yet: a letter is wrong");
    }
  });

  // Every number filled: ask the server once for this assignment.
  useEffect(() => {
    if (!complete || solved || locked) return;
    sync(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, encoded]);

  useEffect(() => {
    if (submitted.current || locked || !solved) return;
    submitted.current = true;
    completeFx("codeword.finish");
    buzz(20);
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, locked]);

  // Cracked: the decoded letters flip across the grid in a diagonal wave (display only).
  useWordFinish(solved, () => {
    wordCue("codeword.finish");
    const size = data?.size ?? 1;
    const cells = gridRef.current?.firstElementChild?.children;
    const step = 640 / Math.max(1, 2 * (size - 1));
    const steps: FinishStep[] = (data?.cells ?? []).flatMap((n, i) =>
      n === 0 ? [] : [{ el: cells?.[i], keyframes: goldFlip("Y"), delay: Math.round((Math.floor(i / size) + (i % size)) * step), duration: 460 }],
    );
    return playFinish(steps);
  });

  if (!data) return null;
  const done = locked || solved || submitted.current;

  const record = (action: CwAction) => {
    setActions((list) => {
      const next = [...list, action];
      // Long histories collapse to the assignment itself; replay gives the same code.
      return next.length > CW_MAX_ACTIONS - 50 ? compactCodeword(replayCodeword(numbers, givens, next), givens) : next;
    });
  };

  const pressLetter = (letter: string) => {
    if (done) return;
    if (selected === null) {
      flash("Tap a square first");
      return;
    }
    if (given.has(selected)) {
      flash("That number is given");
      return;
    }
    if (givenLetters.has(letter)) {
      flash(`${letter} is already given`);
      puzzleReject(root.current?.querySelector(`[data-key="${letter}"]`));
      return;
    }
    if (letters[selected - 1] === letter) return;
    record({ n: selected, letter });
    fx.onPlace();
  };

  const clear = () => {
    if (done || selected === null || given.has(selected) || !letters[selected - 1]) return;
    record({ n: selected, letter: null });
  };

  const nextEmpty = () => {
    const order = data.cells.filter((n) => n > 0 && !given.has(n) && !letters[n - 1]);
    if (order.length === 0) return;
    const after = selected === null ? -1 : data.cells.indexOf(selected);
    const pick = data.cells.find((n, i) => i > after && n > 0 && !given.has(n) && !letters[n - 1]) ?? order[0]!;
    setSelected(pick);
  };

  const placed = new Set(letters.filter(Boolean));
  const placedCount = letters.filter((l, i) => !!l && !given.has(i + 1)).length;

  return (
    <div ref={root} data-stage-column="1" data-word-polish="codeword" className="flex min-h-0 flex-1 flex-col items-center gap-1 py-1" style={NO_SCROLL_STYLE}>
      <div data-game-arena="codeword" className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div ref={gridRef} style={{ width: "min(100cqw, 100cqh, 420px)", aspectRatio: "1 / 1" }}>
          <Grid
            size={data.size}
            cells={data.cells}
            letters={letters}
            look={(n) => (n === selected ? "selected" : given.has(n) ? "given" : solved ? "right" : "plain")}
            onCell={done ? undefined : (n) => setSelected(n)}
          />
        </div>
      </div>
      <KeyStrip letters={letters} given={given} selected={selected} onPick={done ? undefined : (n) => setSelected(n)} />
      <div className="flex h-5 w-full shrink-0 items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground" aria-live="polite">
        {note ? (
          <span className="text-destructive">{note}</span>
        ) : solved ? (
          <span className="text-primary">Cracked!</span>
        ) : complete ? (
          <span>Checking…</span>
        ) : actions.length > 0 ? (
          // Batch W: the live summary once a letter is placed (counts the grid already shows).
          <LiveSummary
            testId="codeword"
            parts={[
              <><b>{placedCount}</b> placed</>,
              <><b>{Math.max(0, numbers - givens.length - placedCount)}</b> to go</>,
            ]}
          />
        ) : (
          <span>Tap a square, then a letter</span>
        )}
      </div>
      <LetterKeypad
        onLetter={pressLetter}
        tone={(letter) => (placed.has(letter) ? "used" : "plain")}
        locked={done}
        keyHeight={42}
        keyFontPx={19}
        left={
          <KeypadAction label="Clear" keyHeight={42} fontPx={16} disabled={done || selected === null || given.has(selected) || !letters[(selected ?? 1) - 1]} onPress={clear}>
            Clear
          </KeypadAction>
        }
        right={
          <KeypadAction label="Next empty" keyHeight={42} fontPx={16} disabled={done || complete} onPress={nextEmpty}>
            Next
          </KeypadAction>
        }
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myMsRemaining, timeLimitMs }: PuzzleRevealProps) {
  if (puzzle.type !== "codeword") return null;
  const solution = puzzle.solution ?? "";
  const mine = replayCodeword(puzzle.numbers, puzzle.givens, decodeCodeword(myAnswer ?? "", puzzle.numbers));
  const tally = codewordTally(mine, solution, puzzle.givens);
  const given = new Set(puzzle.givens.map((g) => g.n));
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div data-word-reveal="codeword" className="flex w-full flex-col items-center gap-2">
      <div style={{ width: 264, height: 264 }}>
        <Grid
          size={puzzle.size}
          cells={puzzle.cells}
          numbers={false}
          letters={[...solution]}
          look={(n) => (given.has(n) ? "given" : mine[n - 1] === solution[n - 1] ? "right" : "wrong")}
        />
      </div>
      <p className="font-mono text-base text-primary">
        {tally.solved ? `Cracked · ${(elapsed / 1000).toFixed(1)}s` : `${tally.correct} / ${tally.hidden} letters decoded`}
      </p>
      {!tally.solved ? <p className="text-sm text-muted-foreground">Red squares: letters you missed or got wrong.</p> : null}
    </div>
  );
}

export const codewordPuzzle: PuzzleDefinition = {
  key: "codeword",
  name: gameDisplayName("codeword"),
  category: "word",
  timeLimitMs: CODEWORD_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "codeword",
      codewordRev: 1,
      size: 3,
      cells: [1, 2, 3, 4, 0, 0, 5, 0, 0],
      numbers: 5,
      givens: [{ n: 1, letter: "C" }],
    }) satisfies CodewordPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "codeword") return false;
    const letters = replayCodeword(puzzle.numbers, puzzle.givens, decodeCodeword(answer, puzzle.numbers));
    return codewordTally(letters, puzzle.solution ?? "", puzzle.givens).solved;
  },
  revealHeading: "The cracked grid",
  IntroExample,
  Stage,
  Reveal,
};
