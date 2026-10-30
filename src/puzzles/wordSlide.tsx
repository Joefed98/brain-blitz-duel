import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { Lock, LockOpen } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { gridCellAt, hapticTick } from "@/components/puzzles/GridDrag";
import { Button } from "@/components/ui/button";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import type { WordSlidePuzzleData } from "@/lib/duel/types";
import {
  decodeSlideTokens,
  markedRowWord,
  parseToken,
  replayWordSlide,
  shiftToken,
  slideSwapRow,
  slideSwapsOn,
  swapToken,
  WS_MARKED_ROWS,
  WS_REVEAL_MS,
  WS_SHIFT_MS,
  WS_SIZE,
  WS_TIME_MS,
  type SlideShift,
  WORD_SLIDE_REV_PAR,
  wordSlideRevOf,
} from "@/lib/duel/wordSlide";
import { playSound } from "@/lib/sound";
import { fx } from "@/lib/fx";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { FoundWordMoment, type AcceptedWordMoment } from "@/components/puzzles/FoundWordMoment";
import { prefersReducedMotion } from "@/lib/motion";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { goldPulse, playFinish, useWordFinish, wordCue, type FinishStep } from "@/components/puzzles/wordFinish";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import "@/polish-layout/batch-w-wordslide.css";

const CELL = 56;
/** Wider phones grow the tiles (lock column 56, board frame and gaps 36 take the rest). */
const MAX_CELL = 72;
const cellFor = (width: number) => Math.max(CELL, Math.min(MAX_CELL, Math.floor((width - 92) / WS_SIZE)));
const GAP = 4;

export function Board({
  grid,
  cell,
  good,
  boardRef,
  onPointerDown,
  locked,
  onLock,
  shut = false,
  swapRow = null,
  picked = null,
}: {
  grid: string[];
  cell: number;
  good: Set<number>;
  boardRef?: React.RefObject<HTMLDivElement | null>;
  onPointerDown?: (event: React.PointerEvent) => void;
  locked?: Set<number>;
  onLock?: (row: number) => void;
  /** Solved: every padlock is drawn shut (display only). */
  shut?: boolean;
  /** wordSlideRev 4: the last unlocked row, whose tiles swap, and the tile picked to swap (display only). */
  swapRow?: number | null;
  picked?: number | null;
}) {
  const board = (
    <div
      ref={boardRef}
      onPointerDown={onPointerDown}
      className="puzzle-board grid shrink-0 rounded-xl border-2 border-border bg-card p-1.5"
      style={{ gridTemplateColumns: `repeat(${WS_SIZE}, ${cell}px)`, gap: GAP, ...(onPointerDown ? NO_SCROLL_STYLE : {}) }}
      aria-label={`${gameDisplayName("wordslide")} board`}
      data-slide-swap-row={swapRow ?? undefined}
    >
      {grid.map((letter, i) => {
        const row = Math.floor(i / WS_SIZE);
        const tone = locked?.has(row)
          ? "border-primary bg-opponent/15"
          : good.has(row) ? "border-opponent bg-opponent/15" : "border-transparent bg-background/40";
        const swappable = swapRow === row;
        return (
          <span
            key={i}
            data-cell={i}
            data-valid-row={good.has(row) ? "true" : undefined}
            data-slide-swap={swappable ? (picked === i % WS_SIZE ? "picked" : "open") : undefined}
             className={`word-letter-tile flex items-center justify-center rounded-lg border-2 font-display font-bold text-foreground ${tone}`}
            style={{ height: cell, fontSize: Math.round(cell * 0.5) }}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
  if (!onLock) return board;
  return (
    <div data-game-arena="fixed" data-word-first="" className="flex shrink-0 items-start gap-1">
      {board}
      <div className="flex flex-col p-1.5" style={{ gap: GAP }}>
        {Array.from({ length: WS_SIZE }, (_, row) => {
          const isLocked = locked?.has(row) ?? false;
          const can = isLocked || good.has(row);
          const drawnShut = isLocked || shut;
          return (
            <button
              key={row}
              data-slide-lock={row}
              type="button"
              aria-label={isLocked ? `Unlock row ${row + 1}` : `Lock row ${row + 1}`}
              disabled={!can}
              onClick={() => onLock(row)}
              className={`slide-lock flex w-11 shrink-0 items-center justify-center rounded-lg ${drawnShut ? "bg-primary/20 text-primary" : "text-foreground"} disabled:opacity-60`}
              style={{ height: cell }}
            >
              {drawnShut ? <Lock className="h-7 w-7" /> : <LockOpen className="h-7 w-7" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IntroExample() {
  const before = [..."TCABOXRUN"];
  const after = [..."CATBOXRUN"];
  const mini = (cells: string[], good: boolean) => (
    <div className="grid gap-1 rounded-lg border-2 border-border bg-card p-1" style={{ gridTemplateColumns: "repeat(3, 26px)" }}>
      {cells.map((l, i) => (
        <span
          key={i}
          className={`word-letter-tile flex h-[26px] items-center justify-center rounded border font-display text-xs font-bold ${i < 3 ? (good ? "border-opponent bg-opponent/15" : "border-primary bg-primary/10") : "border-transparent bg-background/40"}`}
        >
          {l}
        </span>
      ))}
    </div>
  );
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        {mini(before, false)}
        <span className="font-mono text-xs text-muted-foreground">← swipe</span>
        {mini(after, true)}
      </div>
      <p className="text-center text-xs text-muted-foreground">One swipe left wraps the T round to the end: CAT.</p>
    </div>
  );
}

/** Word checks here are background validation: the shared wrapper plays no verdict for them. */
const SILENT_CHECKS = true;
function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, checkWord, stateKey = "wordslide" }: PuzzleStageProps) {
  const data: WordSlidePuzzleData | null = puzzle.type === "wordslide" ? puzzle : null;
  const [tokens, setTokens] = useStageState<string[]>(stateKey, "slideTokens", () => []);
  const [verdicts, setVerdicts] = useState<Record<string, boolean>>({});
  const [accepted, setAccepted] = useState<AcceptedWordMoment | null>(null);
  const submitted = useRef(false);
  const [finished, setFinished] = useState(false);
  const [cell, setCell] = useState(CELL);
  const board = useRef<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const lastShift = useRef<SlideShift | null>(null);
  const lastSwap = useRef<[number, number, number] | null>(null);
  // wordSlideRev 4: the tile picked in the last row, waiting for the tile to swap with (display state only).
  const [picked, setPicked] = useState<number | null>(null);
  useNoTouchScroll(root);

  useBeforePaint(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => setCell(cellFor(node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const swapsOn = slideSwapsOn(data);
  const replay = useMemo(() => (data ? replayWordSlide(data.grid, tokens, { swaps: slideSwapsOn(data) }) : null), [data, tokens]);
  const encoded = tokens.join(",");
  const lockedRows = new Set(replay?.locked ?? []);
  // Four rows locked as words: the last row's tiles can be swapped (the server checks the locked rows are words).
  const swapRow = swapsOn ? slideSwapRow(lockedRows) : null;
  useEffect(() => {
    if (swapRow === null) setPicked(null);
  }, [swapRow]);
  // Par moves (word depth d1): the phone shows the public par beside the moves; the server scores the bonus.
  const parOn = wordSlideRevOf(data) >= WORD_SLIDE_REV_PAR;
  const withinPar = !!data && !!replay && replay.moves <= data.par;

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  const rowWords = replay ? WS_MARKED_ROWS.map((r) => markedRowWord(replay.grid, r)) : [];
  const rowKey = rowWords.join("|");

  // Rows that already read as words when the stage opened (a reload) get no "correct" (display only).
  const openingWords = useRef<Set<string> | null>(null);
  if (openingWords.current === null && replay) openingWords.current = new Set(rowWords);
  const lockedNow = useRef(locked);
  lockedNow.current = locked;

  // Check all five rows on the server; lock the moment all read as words.
  useEffect(() => {
    if (!checkWord) return;
    for (const word of rowWords) {
      if (word in verdicts) continue;
      void checkWord(word, [])
        .then((v) => {
          setVerdicts((c) => ({ ...c, [word]: v.valid }));
          if (v.valid) setAccepted(previous => ({ word: v.word, points: 22, serial: (previous?.serial ?? 0) + 1 }));
          // A row the player made into a word: the shared "correct" and its small burst, like the other word games.
          if (v.valid && !lockedNow.current && !openingWords.current?.has(word)) {
            fx.onCorrect();
            // Batch W (display only): the row that became a word gets the toolkit's right-move glow.
            rowWords.forEach((w, i) => {
              if (w !== word) return;
              const row = WS_MARKED_ROWS[i]!;
              for (let col = 0; col < WS_SIZE; col++) rightMoveFlash(board.current?.querySelector(`[data-cell="${row * WS_SIZE + col}"]`));
            });
          }
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey, checkWord]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (rowWords.length && rowWords.every((w) => verdicts[w] === true)) {
      submitted.current = true;
      playSound("pz_padlock");
      setFinished(true);
      onSubmit(encoded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey, verdicts, locked, data]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + WS_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encoded);
  }, [now, phaseStartedAt, locked, data, encoded, onSubmit]);

  // A shift slides its line in over 120 ms; a swap slides its two tiles past each other.
  useLayoutEffect(() => {
    const swap = lastSwap.current;
    lastSwap.current = null;
    if (swap && board.current && !prefersReducedMotion()) {
      const [row, a, b] = swap;
      const step = (cell + GAP) * (b - a);
      board.current.querySelector<HTMLElement>(`[data-cell="${row * WS_SIZE + a}"]`)?.animate([{ transform: `translateX(${step}px)` }, { transform: "none" }], { duration: WS_SHIFT_MS + 60, easing: "ease-out" });
      board.current.querySelector<HTMLElement>(`[data-cell="${row * WS_SIZE + b}"]`)?.animate([{ transform: `translateX(${-step}px)` }, { transform: "none" }], { duration: WS_SHIFT_MS + 60, easing: "ease-out" });
    }
    const shift = lastShift.current;
    lastShift.current = null;
    if (!shift || !board.current || prefersReducedMotion()) return;
    const offset = -(cell + GAP) * shift.dir;
    for (let k = 0; k < WS_SIZE; k++) {
      if (shift.axis === "c" && lockedRows.has(k)) continue;
      const index = shift.axis === "r" ? shift.index * WS_SIZE + k : k * WS_SIZE + shift.index;
      const el = board.current.querySelector<HTMLElement>(`[data-cell="${index}"]`);
      const from = shift.axis === "r" ? `translateX(${offset}px)` : `translateY(${offset}px)`;
      el?.animate([{ transform: from }, { transform: "none" }], { duration: WS_SHIFT_MS, easing: "ease-out" });
    }
  }, [tokens]);

  // All five rows are words: the padlocks click shut down the rows in a cascade (display only).
  useWordFinish(finished, () => {
    wordCue("wordslide.finish");
    const steps: FinishStep[] = [];
    for (let row = 0; row < WS_SIZE; row++) {
      steps.push({
        el: root.current?.querySelector(`[data-slide-lock="${row}"]`),
        keyframes: [
          { transform: "scale(1)", filter: "none" },
          { transform: "scale(0.8)", offset: 0.3 },
          { transform: "scale(1.15)", filter: "drop-shadow(0 0 6px var(--primary))", offset: 0.6 },
          { transform: "scale(1)", filter: "none" },
        ],
        delay: row * 170,
        duration: 320,
      });
      for (let col = 0; col < WS_SIZE; col++)
        steps.push({ el: board.current?.querySelector(`[data-cell="${row * WS_SIZE + col}"]`), keyframes: goldPulse(1.05), delay: row * 170 + 80 + col * 20, duration: 380 });
    }
    return playFinish(steps);
  });

  // Desktop keys: Z or Backspace = Undo, R = Reset.
  useGameKeys((kind, key, event) => {
    if (!data || !replay) return false;
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (frozen || !canUndo) return true;
    push(key === "r" ? "X" : "U");
    return true;
  });

  if (!data || !replay) return null;
  const frozen = locked || submitted.current;
  const good = new Set(WS_MARKED_ROWS.filter((r, i) => verdicts[rowWords[i]!] === true));
  const canUndo = tokens.reduce((depth, token) => token.startsWith("L") ? depth : token === "X" ? 0 : token === "U" ? Math.max(0, depth - 1) : depth + 1, 0) > 0;

  const push = (token: string) => {
    if (frozen) return;
    const parsed = parseToken(token);
    if (parsed && typeof parsed === "object" && "swap" in parsed) {
      if (swapRow === null) return puzzleReject(board.current);
      lastSwap.current = [swapRow, parsed.swap[0], parsed.swap[1]];
    } else if (parsed && typeof parsed === "object" && !("lock" in parsed)) {
      if (parsed.axis === "r" && lockedRows.has(parsed.index)) return puzzleReject(board.current);
      lastShift.current = parsed;
    }
    hapticTick();
    setTokens([...tokens, token]);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (frozen) return;
    event.preventDefault();
    const start = gridCellAt(board.current, event.clientX, event.clientY, WS_SIZE, WS_SIZE);
    if (start === null) return;
    const sx = event.clientX;
    const sy = event.clientY;
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) {
        // wordSlideRev 4: a tap in the open last row picks a tile; a tap on another tile there swaps the two.
        if (swapRow === null) return;
        const col = start % WS_SIZE;
        if (Math.floor(start / WS_SIZE) !== swapRow) return setPicked(null);
        if (picked === null) {
          hapticTick();
          return setPicked(col);
        }
        if (picked === col) return setPicked(null);
        setPicked(null);
        push(swapToken(picked, col));
        return;
      }
      setPicked(null);
      const shift: SlideShift =
        Math.abs(dx) >= Math.abs(dy)
          ? { axis: "r", index: Math.floor(start / WS_SIZE), dir: dx > 0 ? 1 : -1 }
          : { axis: "c", index: start % WS_SIZE, dir: dy > 0 ? 1 : -1 };
      if (shift.axis === "r" && lockedRows.has(shift.index)) return puzzleReject(board.current);
      push(shiftToken(shift));
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div ref={root} data-polish="wordslide" data-word-polish="wordslide" data-stage-column="3" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3" style={NO_SCROLL_STYLE}>
      <div className="word-moment-float top-0">
        <FoundWordMoment value={accepted} />
      </div>
      <Board grid={replay.grid} cell={cell} good={good} boardRef={board} onPointerDown={onPointerDown} locked={lockedRows} shut={finished} swapRow={frozen ? null : swapRow} picked={picked} onLock={(row) => { playSound("pz_padlock"); push(`L${row}`); }} />
      <div data-game-controls="status" data-word-controls-first="" className="relative flex h-8 shrink-0 items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {/* Batch W live summary (display only): rows reading as words, rows locked, moves. */}
        <span data-live-summary="wordslide" className="whitespace-nowrap font-sans text-[13px] font-semibold normal-case tracking-normal tabular-nums text-[#a09da6]">
          <b className="font-extrabold text-[#f3f1ec]">{good.size}</b> / {WS_MARKED_ROWS.length} words<span className="text-[#5d5a63]"> · </span>
          <b className="font-extrabold text-[#f3f1ec]">{lockedRows.size}</b> locked<span className="text-[#5d5a63]"> · </span>
          Moves <span data-par-moves={parOn ? (withinPar ? "within" : "over") : undefined} className={parOn && !withinPar ? "text-[#f3f1ec]" : "text-primary"}>{replay.moves}</span>
          {/* Par moves (wordSlideRev 1): gold while the moves are still within par, the par dimmed once past it. */}
          {parOn ? (
            <>
              <span className="text-[#5d5a63]"> · </span>
              <span data-par-label="" className={withinPar ? "font-extrabold text-primary" : "text-[#5d5a63] line-through"}>Par {data?.par}</span>
            </>
          ) : null}
        </span>
      </div>
      <div data-game-controls="actions" className="flex shrink-0 gap-3 px-2">
        <Button
          type="button"
          disabled={frozen || !canUndo}
          onPointerDown={() => push("U")}
          className="h-11 w-24 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground disabled:opacity-40"
        >
          Undo
        </Button>
        <Button
          type="button"
          disabled={frozen || !canUndo}
          onPointerDown={() => push("X")}
          className="h-11 w-24 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground disabled:opacity-40"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, validRows }: PuzzleRevealProps) {
  if (puzzle.type !== "wordslide") return null;
  const replay = replayWordSlide(puzzle.grid, decodeSlideTokens(myAnswer ?? ""), { swaps: slideSwapsOn(puzzle) });
  const words = puzzle.words ?? [];
  const good = new Set<number>(WS_MARKED_ROWS.filter((r) => myCorrect || validRows?.includes(r)));
  const elapsed = myMsRemaining === undefined ? null : ((timeLimitMs - myMsRemaining) / 1000).toFixed(1);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <Board grid={replay.grid} cell={40} good={good} />
      {words.length > 0 && (
        <div className="flex flex-col items-center gap-0.5 font-mono text-base text-muted-foreground">
          {words.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
      )}
      <p className={`text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}>
        {myCorrect
          ? `Solved · 5 / 5 rows${elapsed ? ` · ${elapsed}s` : ""}`
          : (solutionProgress(puzzle, myAnswer ?? "", validRows ? { validRows } : null)?.text ?? `${good.size} / 5 rows`)}
      </p>
      <p className="text-center font-mono text-base text-muted-foreground">
        Par {puzzle.par} – you used {replay.moves}
      </p>
    </div>
  );
}

export const wordSlidePuzzle: PuzzleDefinition = {
  key: "wordslide",
  name: gameDisplayName("wordslide"),
  category: "word",
  timeLimitMs: WS_TIME_MS,
  revealMs: WS_REVEAL_MS,
  generate: () =>
     ({ type: "wordslide", grid: [..."HOUSEWATERSTONEPLANTLIGHT"], par: 6 }) satisfies WordSlidePuzzleData,
  check: () => false,
  revealHeading: "Your grid",
  IntroExample,
  Stage,
  Reveal,
};
(Stage as { silentWordChecks?: boolean }).silentWordChecks = SILENT_CHECKS;
