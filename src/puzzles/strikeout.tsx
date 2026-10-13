import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Delete } from "lucide-react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { useStageState } from "@/lib/duel/stageState";
import {
  SO_LEN,
  SO_MAX_STRIKES,
  SO_ROWS,
  decodeStrikeout,
  encodeStrikeout,
  replayStrikeout,
  type SoAction,
  type SoView,
} from "@/lib/duel/strikeout";
import { STRIKEOUT_TIME_MS, type StrikeoutPuzzleData } from "@/lib/duel/types";
import { fx } from "@/lib/fx";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { buzz, prefersReducedMotion } from "@/lib/motion";
import { FoundWordMoment, type AcceptedWordMoment } from "@/components/puzzles/FoundWordMoment";
import { KeypadAction, LetterKeypad, type KeyTone } from "@/components/puzzles/LetterKeypad";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useMoveSync } from "@/components/puzzles/useMoveSync";
import { goldFlip, playFinish, useWordFinish, wordCue, type FinishStep } from "@/components/puzzles/wordFinish";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Five strike markers; used ones are filled red. */
function Strikes({ used, markerRef }: { used: number; markerRef?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={markerRef} className="flex items-center justify-center gap-2" aria-label={`${used} of ${SO_MAX_STRIKES} strikes`}>
      {Array.from({ length: SO_MAX_STRIKES }, (_, i) => (
        <span
          key={i}
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-display text-sm font-bold leading-none ${
            i < used ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-transparent"
          }`}
        >
          ✕
        </span>
      ))}
    </div>
  );
}

type TileLook = "hidden" | "shown" | "solved" | "typed" | "missed";

const TILE: Record<TileLook, string> = {
  hidden: "bg-secondary text-transparent",
  shown: "bg-card text-foreground ring-1 ring-inset ring-primary/60",
  solved: "bg-primary text-primary-foreground",
  typed: "bg-card text-primary ring-2 ring-inset ring-primary",
  missed: "border-2 border-destructive bg-card text-muted-foreground",
};

function Row({
  letters,
  looks,
  selected,
  onTap,
  tile,
  rowIndex,
}: {
  letters: string[];
  looks: TileLook[];
  selected?: boolean | undefined;
  onTap?: (() => void) | undefined;
  /** Tile side: px, or a CSS length such as the board's --so-tile. */
  tile: number | string;
  rowIndex: number;
}) {
  const side = typeof tile === "number" ? `${tile}px` : tile;
  return (
    <div
      role={onTap ? "button" : undefined}
      aria-label={onTap ? `Word ${rowIndex + 1}` : undefined}
      onClick={onTap}
      className={`flex justify-center gap-1 rounded-lg p-0.5 ${selected ? "bg-primary/15 ring-1 ring-primary" : ""} ${onTap ? "cursor-pointer" : ""}`}
    >
      {letters.map((ch, i) => (
        <span
          key={i}
          data-so-tile={`${rowIndex}-${i}`}
          data-so-look={looks[i] ?? "hidden"}
          className={`so-tile flex items-center justify-center rounded-md font-display font-bold ${TILE[looks[i] ?? "hidden"]}`}
          style={{ width: side, height: side, fontSize: `calc(${side} * 0.55)` }}
        >
          {ch || "\u00a0"}
        </span>
      ))}
    </div>
  );
}

/** Fixed example: two rows, A and E guessed (gold), Z a strike. */
function IntroExample() {
  const keys: [string, string][] = [["A", "bg-primary text-primary-foreground"], ["E", "bg-primary text-primary-foreground"], ["Z", "bg-destructive/80 text-destructive-foreground"], ["T", "bg-secondary text-foreground"]];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <Strikes used={1} />
        <Row letters={["", "", "A", "", "E"]} looks={["hidden", "hidden", "shown", "hidden", "shown"]} tile={26} rowIndex={0} />
        <Row letters={["", "E", "A", "", ""]} looks={["hidden", "shown", "shown", "hidden", "hidden"]} tile={26} rowIndex={1} />
        <div className="flex gap-1 pt-1">
          {keys.map(([k, tone]) => (
            <span key={k} className={`flex h-7 w-7 items-center justify-center rounded-md font-display text-sm font-bold ${tone}`}>
              {k}
            </span>
          ))}
        </div>
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        A and E fill every matching tile. Z is in no word: one strike. Tap a word and type CRANE to solve it.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, checkMoves, stateKey }: PuzzleStageProps) {
  const data: StrikeoutPuzzleData | null = puzzle.type === "strikeout" ? puzzle : null;
  const key = stateKey ?? "strikeout";
  const [actions, setActions] = useStageState<SoAction[]>(key, "soActions", () => []);
  const [view, setView] = useStageState<SoView | null>(key, "soView", () => null);
  const [row, setRow] = useStageState<number | null>(key, "soRow", () => null);
  const [typed, setTyped] = useStageState<string>(key, "soTyped", () => "");
  const [note, setNote] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedWordMoment | null>(null);
  const submitted = useRef(false);
  const root = useRef<HTMLDivElement | null>(null);
  const strikeRef = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const shownBefore = useRef<string[] | null>(view?.rows ?? null);
  useNoTouchScroll(root);

  const encoded = encodeStrikeout(actions);
  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((n) => (n === text ? null : n)), 1100);
  };

  const sync = useMoveSync(checkMoves, "strikeout", (next, sentMoves) => {
    const before = view;
    if (next.last === "notword") {
      // No effect on the board: take the refused attempt back out of the list.
      const sentList = decodeStrikeout(sentMoves);
      const refused = sentList[next.count - 1];
      if (refused?.kind === "solve") {
        setActions((list) => {
          const at = list.findIndex((a) => a.kind === "solve" && a.row === refused.row && a.word === refused.word);
          return at < 0 ? list : [...list.slice(0, at), ...list.slice(at + 1)];
        });
      }
      puzzleReject(board.current?.querySelector(`[aria-label="Word ${refused?.kind === "solve" ? refused.row + 1 : 1}"]`) ?? board.current);
      fx.onWrong();
      flash("Not in the word list");
    } else if (before && next.strikes > before.strikes) {
      puzzleReject(strikeRef.current);
      fx.onWrong();
      buzz([12, 60, 12]);
      flash(next.last === "wrong" ? "Wrong word: strike" : "Not in any word: strike");
    } else if (next.last === "right") {
      const solvedRow = next.rows.findIndex((r, i) => !r.includes("_") && (before?.rows[i] ?? "_").includes("_"));
      setAccepted((a) => ({ word: next.rows[solvedRow] ?? "", points: 20, serial: (a?.serial ?? 0) + 1 }));
      fx.onCorrect();
      buzz(16);
    } else if (next.last === "hit") {
      fx.onPlace();
      buzz(8);
    }
    setView(next);
  });

  // A remount mid-round (reconnect) asks the server for the current board again.
  useEffect(() => {
    if (actions.length > 0 && !view) sync(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (submitted.current || locked || !view || (!view.done && !view.over)) return;
    submitted.current = true;
    if (view.done) fx.onComplete();
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, locked]);

  // Solved: the tiles flip gold row by row (display only; the answer is already in).
  useWordFinish(!!view?.done, () => {
    wordCue("strikeout.finish");
    const steps: FinishStep[] = [];
    for (let r = 0; r < SO_ROWS; r++)
      for (let i = 0; i < SO_LEN; i++)
        steps.push({ el: board.current?.querySelector(`[data-so-tile="${r}-${i}"]`), keyframes: goldFlip("X"), delay: r * 150 + i * 35, duration: 420 });
    return playFinish(steps);
  });

  // Newly revealed tiles flip in.
  useLayoutEffect(() => {
    const rows = view?.rows ?? null;
    const prev = shownBefore.current;
    shownBefore.current = rows;
    if (!rows || !prev || !board.current || prefersReducedMotion()) return;
    rows.forEach((r, ri) => {
      [...r].forEach((ch, i) => {
        if (ch === "_" || prev[ri]?.[i] !== "_") return;
        board.current
          ?.querySelector(`[data-so-tile="${ri}-${i}"]`)
          ?.animate([{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }], { duration: 280, delay: i * 40, easing: "ease-out", fill: "backwards" });
      });
    });
  }, [view]);

  if (!data) return null;
  const rows = view?.rows ?? Array.from({ length: SO_ROWS }, () => "_".repeat(SO_LEN));
  const strikes = view?.strikes ?? 0;
  const done = locked || submitted.current || !!view?.done || !!view?.over;
  const guessed = new Set(actions.flatMap((a) => (a.kind === "guess" ? [a.letter] : [])));
  const hits = new Set(view?.hits ?? "");
  const misses = new Set(view?.misses ?? "");
  const solving = row !== null && !done && rows[row]?.includes("_");
  const answered = view ? Math.min(actions.length, view.count) : 0;
  const pendingSolve = actions.slice(answered).some((a) => a.kind === "solve");

  const send = (next: SoAction[]) => {
    setActions(next);
    sync(encodeStrikeout(next));
  };

  const pressLetter = (letter: string) => {
    if (done) return;
    if (solving) {
      setTyped((t) => (t.length < SO_LEN ? t + letter : t));
      return;
    }
    if (guessed.has(letter)) return;
    send([...actions, { kind: "guess", letter }]);
  };

  const tapRow = (r: number) => {
    if (done || !rows[r]?.includes("_")) return;
    setTyped("");
    setRow((current) => (current === r ? null : r));
  };

  const solve = () => {
    if (!solving || row === null || typed.length !== SO_LEN) return;
    send([...actions, { kind: "solve", row, word: typed }]);
    setTyped("");
    setRow(null);
  };

  const tone = (letter: string): KeyTone => {
    if (hits.has(letter)) return "gold";
    if (misses.has(letter)) return "red";
    if (guessed.has(letter)) return "pending";
    return "plain";
  };

  // As large as the arena allows (row rings and gaps: 40px across, 44px down, plus 16px breathing room).
  const tileSize = "min(72px, calc((100cqw - 40px) / 5), calc((100cqh - 60px) / 5))";

  return (
    <div
      ref={root}
      data-stage-column="1"
      data-word-polish="strikeout"
      className="flex min-h-0 flex-1 flex-col items-center gap-1 py-1"
      style={{ ...NO_SCROLL_STYLE, touchAction: "manipulation" }}
    >
      <div className="flex h-8 w-full shrink-0 items-center justify-center">
        <Strikes used={strikes} markerRef={strikeRef} />
      </div>
      <div data-game-arena="strikeout" className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div ref={board} className="flex flex-col items-center gap-1" style={{ ["--so-tile" as string]: tileSize }}>
          {rows.map((r, ri) => {
            const isSel = solving && row === ri;
            const solved = !r.includes("_");
            const letters = [...r].map((ch, i) => (isSel && typed[i] ? typed[i]! : ch === "_" ? "" : ch));
            const looks = [...r].map((ch, i): TileLook => (isSel && typed[i] ? "typed" : solved ? "solved" : ch === "_" ? "hidden" : "shown"));
            return <Row key={ri} letters={letters} looks={looks} selected={isSel} rowIndex={ri} tile="var(--so-tile)" onTap={done || solved ? undefined : () => tapRow(ri)} />;
          })}
        </div>
      </div>
      <div className="relative flex h-8 w-full shrink-0 items-center justify-center px-2 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground" aria-live="polite">
        {note ? (
          <span className="text-destructive">{note}</span>
        ) : solving ? (
          <span className="text-primary">Type word {row! + 1}, then Solve</span>
        ) : pendingSolve ? (
          <span>Checking…</span>
        ) : (
          <span>Tap a letter · tap a word to solve it</span>
        )}
        <div className="pointer-events-none absolute inset-0">
          <FoundWordMoment value={accepted} />
        </div>
      </div>
      <LetterKeypad
        onLetter={pressLetter}
        tone={tone}
        disabled={(letter) => !solving && guessed.has(letter)}
        locked={done}
        left={
          <KeypadAction label="Delete" disabled={!solving || typed.length === 0} onPress={() => setTyped((t) => t.slice(0, -1))}>
            <Delete className="h-5 w-5" />
          </KeypadAction>
        }
        right={
          <KeypadAction label="Solve" emphasis disabled={!solving || typed.length !== SO_LEN} onPress={solve}>
            Solve
          </KeypadAction>
        }
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myMsRemaining, timeLimitMs }: PuzzleRevealProps) {
  if (puzzle.type !== "strikeout") return null;
  const words = (puzzle.words ?? []).map((w) => w.toUpperCase());
  // The stored answer is the canonical list: every solve in it already passed the dictionary.
  const state = replayStrikeout(words, decodeStrikeout(myAnswer ?? ""), () => true);
  const solvedRows = state.revealed.filter((r) => r.every(Boolean)).length;
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div data-word-reveal="strikeout" className="flex w-full flex-col items-center gap-2">
      <Strikes used={state.strikes} />
      <div className="flex flex-col gap-1">
        {words.map((w, ri) => {
          const solved = state.revealed[ri]!.every(Boolean);
          return (
            <Row
              key={ri}
              rowIndex={ri}
              tile={34}
              letters={[...w]}
              looks={[...w].map((_, i): TileLook => (solved ? "solved" : state.revealed[ri]![i] ? "shown" : "missed"))}
            />
          );
        })}
      </div>
      <p className="font-mono text-base text-primary">
        {state.done
          ? `5 / 5 words · ${state.strikes} strike${state.strikes === 1 ? "" : "s"} · ${(elapsed / 1000).toFixed(1)}s`
          : `${solvedRows} / 5 words · ${state.strikes} strike${state.strikes === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

export const strikeoutPuzzle: PuzzleDefinition = {
  key: "strikeout",
  name: gameDisplayName("strikeout"),
  category: "word",
  timeLimitMs: STRIKEOUT_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "strikeout", strikeoutRev: 1, rows: SO_ROWS, length: SO_LEN }) satisfies StrikeoutPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "strikeout") return false;
    return replayStrikeout(puzzle.words ?? [], decodeStrikeout(answer), () => true).done;
  },
  revealHeading: "The five words",
  IntroExample,
  Stage,
  Reveal,
};
