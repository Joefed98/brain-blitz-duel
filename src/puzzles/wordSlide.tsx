import { gameDisplayName } from "@/lib/duel/gameNames";
import { solutionProgress } from "@/lib/duel/progressFigures";
import { Lock, LockOpen, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { gridCellAt } from "@/components/puzzles/GridDrag";
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
  slideGridSide,
  swapToken,
  wordSlideSize,
  wsRows,
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
import { effectCue, wordFx } from "@/components/puzzles/wordFx";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import "@/polish-word/word-look.css";
import "@/polish-word/slider.css";
import { BoardPair, RevealKey, RevealNumbers } from "@/components/puzzles/WordReveal";
import { overhaulReveal } from "@/lib/duel/wordOverhaul";
import "@/polish-layout/polish-nov3-word.css";
import { HudPills } from "@/components/puzzles/HudPills";

// The Word overhaul: tiles as large as the width allows down to 44 px, so the board and its padlock column fit a
// 375 px phone (a 56 px floor ran past its edge).
const CELL = 44;
/** Wider phones grow the tiles (lock column 56, board frame and gaps 36 take the rest). */
const MAX_CELL = 72;
const cellFor = (width: number, size: number = WS_SIZE) => Math.max(size > WS_SIZE ? 36 : CELL, Math.min(MAX_CELL, Math.floor((width - 84 - GAP * (size - WS_SIZE)) / size)));
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
      style={{ gridTemplateColumns: `repeat(${slideGridSide(grid)}, ${cell}px)`, gap: GAP, ...(onPointerDown ? NO_SCROLL_STYLE : {}) }}
      aria-label={`${gameDisplayName("wordslide")} board`}
      data-slide-swap-row={swapRow ?? undefined}
    >
      {grid.map((letter, i) => {
        const row = Math.floor(i / slideGridSide(grid));
        const tone = locked?.has(row)
          ? "border-primary bg-opponent/15"
          : good.has(row) ? "border-opponent bg-opponent/15" : "border-transparent bg-background/40";
        const swappable = swapRow === row;
        const waTone = swappable && picked === i % slideGridSide(grid) ? "sapphire" : locked?.has(row) || shut ? "gold" : good.has(row) ? "teal" : "black";
        return (
          <span
            key={i}
            data-cell={i}
            data-valid-row={good.has(row) ? "true" : undefined}
            data-slide-swap={swappable ? (picked === i % slideGridSide(grid) ? "picked" : "open") : undefined}
            data-wa="tile"
            data-wa-tone={waTone}
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
      <div className="flex flex-col py-1.5" style={{ gap: GAP }}>
        {Array.from({ length: slideGridSide(grid) }, (_, row) => {
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
              data-slide-lock-shut={drawnShut ? "" : undefined}
              className={`slide-lock flex w-11 shrink-0 items-center justify-center rounded-lg ${drawnShut ? "text-primary" : "text-foreground"} disabled:opacity-60`}
              style={{ height: cell }}
            >
              {/* The padlocks are rendered pieces (public/word-art), the icon only for assistive tech's sake. */}
              <span aria-hidden="true" className="slide-lock-art" />
              {drawnShut ? <Lock className="sr-only" /> : <LockOpen className="sr-only" />}
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
  // The Word overhaul: Reset asks first. The first tap arms it ("Reset?") for 3 s; a second tap resets.
  const [resetArmed, setResetArmed] = useState(false);
  const resetArmedRef = useRef(false);
  useEffect(() => {
    if (!resetArmed) return;
    const timer = window.setTimeout(() => {
      resetArmedRef.current = false;
      setResetArmed(false);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [resetArmed]);
  useNoTouchScroll(root);

  useBeforePaint(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => setCell(cellFor(node.clientWidth, wordSlideSize(data)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const swapsOn = slideSwapsOn(data);
  const replay = useMemo(() => (data ? replayWordSlide(data.grid, tokens, { swaps: slideSwapsOn(data), ...(wordSlideSize(data) !== WS_SIZE ? { size: wordSlideSize(data) } : {}) }) : null), [data, tokens]);
  const encoded = tokens.join(",");
  const lockedRows = new Set(replay?.locked ?? []);
  // Four rows locked as words: the last row's tiles can be swapped (the server checks the locked rows are words).
  const swapRow = swapsOn ? slideSwapRow(lockedRows, wordSlideSize(data)) : null;
  useEffect(() => {
    if (swapRow === null) setPicked(null);
  }, [swapRow]);
  // Par moves (word depth d1): the phone shows the public par beside the moves; the server scores the bonus.
  const parOn = wordSlideRevOf(data) >= WORD_SLIDE_REV_PAR;
  const withinPar = !!data && !!replay && replay.moves <= data.par;

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  const rowWords = replay ? wsRows(wordSlideSize(data)).map((r) => markedRowWord(replay.grid, r, wordSlideSize(data))) : [];
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
          // Game review fix (15 Nov 2026): a row that already read as a word when the stage opened (a reload) is not
          // announced again in the found-word chip.
          if (v.valid && !openingWords.current?.has(word)) setAccepted(previous => ({ word: v.word, points: 22, serial: (previous?.serial ?? 0) + 1 }));
          // A row the player made into a word: the shared "correct" and its small burst, like the other word games.
          if (v.valid && !lockedNow.current && !openingWords.current?.has(word)) {
            fx.onCorrect();
            // Stage 2: a row becoming a word brightens with its own two-note.
            effectCue("wordslide.word");
            // Batch W (display only): the row that became a word gets the toolkit's right-move glow.
            rowWords.forEach((w, i) => {
              if (w !== word) return;
              const row = wsRows(wordSlideSize(data))[i]!;
              for (let col = 0; col < wordSlideSize(data); col++) rightMoveFlash(board.current?.querySelector(`[data-cell="${row * wordSlideSize(data) + col}"]`));
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
      board.current.querySelector<HTMLElement>(`[data-cell="${row * wordSlideSize(data) + a}"]`)?.animate([{ transform: `translateX(${step}px)` }, { transform: "none" }], { duration: WS_SHIFT_MS + 60, easing: "ease-out" });
      board.current.querySelector<HTMLElement>(`[data-cell="${row * wordSlideSize(data) + b}"]`)?.animate([{ transform: `translateX(${-step}px)` }, { transform: "none" }], { duration: WS_SHIFT_MS + 60, easing: "ease-out" });
    }
    const shift = lastShift.current;
    lastShift.current = null;
    if (!shift || !board.current || prefersReducedMotion()) return;
    const offset = -(cell + GAP) * shift.dir;
    for (let k = 0; k < wordSlideSize(data); k++) {
      if (shift.axis === "c" && lockedRows.has(k)) continue;
      const index = shift.axis === "r" ? shift.index * wordSlideSize(data) + k : k * wordSlideSize(data) + shift.index;
      const el = board.current.querySelector<HTMLElement>(`[data-cell="${index}"]`);
      const from = shift.axis === "r" ? `translateX(${offset}px)` : `translateY(${offset}px)`;
      el?.animate([{ transform: from }, { transform: "none" }], { duration: WS_SHIFT_MS, easing: "ease-out" });
    }
  }, [tokens]);

  // Stage 2: at par with three rows already words, a nudge on the moves counter (once each time it happens).
  const goodNow = rowWords.filter((w) => verdicts[w] === true).length;
  const nudgeAt = useRef(-1);
  useEffect(() => {
    if (!data || !replay || !parOn || locked || submitted.current) return;
    if (replay.moves !== data.par || goodNow < 3 || nudgeAt.current === replay.moves) return;
    nudgeAt.current = replay.moves;
    wordFx("nearMiss", root.current?.querySelector('[data-hud-pill="moves"]'), "wordslide.nudge");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay?.moves, goodNow]);

  // All five rows are words: the padlocks click shut down the rows in a cascade (display only).
  useWordFinish(finished, () => {
    wordCue("wordslide.finish");
    const steps: FinishStep[] = [];
    for (let row = 0; row < wordSlideSize(data); row++) {
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
      for (let col = 0; col < wordSlideSize(data); col++)
        steps.push({ el: board.current?.querySelector(`[data-cell="${row * wordSlideSize(data) + col}"]`), keyframes: goldPulse(1.05), delay: row * 170 + 80 + col * 20, duration: 380 });
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
  const good = new Set(wsRows(wordSlideSize(data)).filter((r, i) => verdicts[rowWords[i]!] === true));
  const canUndo = tokens.reduce((depth, token) => token.startsWith("L") ? depth : token === "X" ? 0 : token === "U" ? Math.max(0, depth - 1) : depth + 1, 0) > 0;

  const push = (token: string) => {
    // The Word overhaul: Reset (the button or R) asks first; the first press only arms it, any other move disarms it.
    if (token === "X" && !resetArmedRef.current) {
      resetArmedRef.current = true;
      setResetArmed(true);
      wordFx("tap", null, "wordslide.resetArm");
      return;
    }
    resetArmedRef.current = false;
    setResetArmed(false);
    if (frozen) return;
    const parsed = parseToken(token, wordSlideSize(data));
    if (parsed && typeof parsed === "object" && "swap" in parsed) {
      if (swapRow === null) return puzzleReject(board.current);
      lastSwap.current = [swapRow, parsed.swap[0], parsed.swap[1]];
      effectCue("wordslide.swap");
    } else if (parsed && typeof parsed === "object" && !("lock" in parsed)) {
      if (parsed.axis === "r" && lockedRows.has(parsed.index)) return puzzleReject(board.current);
      lastShift.current = parsed;
      // Stage 2: the swipe slides its line with a tile rattle (the line's own slide is the layout effect above).
      effectCue("wordslide.slide");
    } else if (parsed && typeof parsed === "object" && "lock" in parsed) {
      // Stage 2: the padlock snaps shut (or opens again) on its own art.
      const row = parsed.lock;
      wordFx("drop", root.current?.querySelector(`[data-slide-lock="${row}"] .slide-lock-art`), lockedRows.has(row) ? "wordslide.unlock" : "wordslide.lock", { silent: true });
    }
    setTokens([...tokens, token]);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (frozen) return;
    event.preventDefault();
    const start = gridCellAt(board.current, event.clientX, event.clientY, wordSlideSize(data), wordSlideSize(data));
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
        const col = start % wordSlideSize(data);
        if (Math.floor(start / wordSlideSize(data)) !== swapRow) return setPicked(null);
        if (picked === null) {
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
          ? { axis: "r", index: Math.floor(start / wordSlideSize(data)), dir: dx > 0 ? 1 : -1 }
          : { axis: "c", index: start % wordSlideSize(data), dir: dy > 0 ? 1 : -1 };
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
      <div data-game-controls="status" data-word-controls-first="" className="relative flex h-8 shrink-0 items-center justify-center">
        {/* Live summary (display only) as separate pills (3 Nov 2026): rows reading as words, rows locked, moves and,
            on wordSlideRev 1+, the par: gold while the moves are within it, red once past. */}
        <HudPills
          testId="wordslide"
          items={[
            { id: "words", label: "Words", value: `${good.size} / ${wsRows(wordSlideSize(data)).length}` },
            { id: "locked", label: "Locked", value: lockedRows.size },
            { id: "moves", label: "Moves", value: replay.moves },
            parOn ? { id: "par", label: "Par", value: data?.par, tone: withinPar ? "gold" : "warn" } : null,
          ]}
        />
      </div>
      <div data-game-controls="actions" className="flex shrink-0 gap-3 px-2">
        <Button
          type="button"
          data-slide-action="undo"
          aria-label="Undo last move"
          title="Undo last move"
          disabled={frozen || !canUndo}
          onClick={() => push("U")}
          data-wa-btn="navy"
          className="h-11 w-28 rounded-xl font-display text-sm font-bold uppercase tracking-widest disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Undo
        </Button>
        <Button
          type="button"
          data-slide-action="reset"
          data-slide-reset-armed={resetArmed ? "" : undefined}
          aria-label={resetArmed ? "Tap again to reset the board" : "Reset the board"}
          title="Reset the board"
          disabled={frozen || !canUndo}
          onClick={() => push("X")}
          data-wa-btn={resetArmed ? "gold" : "navy"}
          className="h-11 w-28 rounded-xl font-display text-sm font-bold uppercase tracking-widest disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {resetArmed ? "Reset?" : "Reset"}
        </Button>
      </div>
    </div>
  );
}

/**
 * The Word overhaul's reveal (wordSlideRev 6+): the five dealt words as a solved grid (gold) and your final grid, one at
 * a time and large (the shared Solution / Yours switch), your rows that read as words in teal; the numbers the score is
 * made of: rows made, moves used and par (the proven fewest).
 */
function RevealOverhaul({ puzzle, myAnswer, myCorrect, validRows }: PuzzleRevealProps) {
  if (puzzle.type !== "wordslide") return null;
  const replay = replayWordSlide(puzzle.grid, decodeSlideTokens(myAnswer ?? "", wordSlideSize(puzzle)), { swaps: slideSwapsOn(puzzle), ...(wordSlideSize(puzzle) !== WS_SIZE ? { size: wordSlideSize(puzzle) } : {}) });
  const words = puzzle.words ?? [];
  const good = new Set<number>(wsRows(wordSlideSize(puzzle)).filter((r) => myCorrect || validRows?.includes(r)));
  const cell = 52;
  return (
    <div data-word-reveal="wordslide" data-wr-version="overhaul" className="wr">
      <RevealNumbers
        countAfterMs={200}
        items={[
          { id: "rows", label: "Rows made", value: `${good.size}/${wsRows(wordSlideSize(puzzle)).length}`, tone: myCorrect ? "gold" : undefined },
          { id: "moves", label: "Moves used", value: replay.moves, tone: myCorrect && replay.moves <= puzzle.par ? "gold" : undefined },
          { id: "par", label: "Par (fewest)", value: puzzle.par },
        ]}
      />
      <BoardPair
        solution={<Board grid={[...words.join("")]} cell={cell} good={new Set()} shut />}
        // Joe (15 Nov 2026): the key belongs to Yours only (the solution is all locked gold).
        yours={
          <>
            <Board grid={replay.grid} cell={cell} good={good} />
            <RevealKey items={[{ tone: "teal", label: "A real word" }, { tone: "black", label: "Not a word" }]} />
          </>
        }
      />
    </div>
  );
}

function Reveal(props: PuzzleRevealProps) {
  if (overhaulReveal(props.puzzle)) return <RevealOverhaul {...props} />;
  return <RevealOlder {...props} />;
}

function RevealOlder({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, validRows }: PuzzleRevealProps) {
  if (puzzle.type !== "wordslide") return null;
  const replay = replayWordSlide(puzzle.grid, decodeSlideTokens(myAnswer ?? "", wordSlideSize(puzzle)), { swaps: slideSwapsOn(puzzle), ...(wordSlideSize(puzzle) !== WS_SIZE ? { size: wordSlideSize(puzzle) } : {}) });
  const words = puzzle.words ?? [];
  const good = new Set<number>(wsRows(wordSlideSize(puzzle)).filter((r) => myCorrect || validRows?.includes(r)));
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
      {myCorrect ? null : (
        <p className="text-center font-mono text-base font-bold text-foreground">
          {solutionProgress(puzzle, myAnswer ?? "", validRows ? { validRows } : null)?.text ?? `${good.size} / 5 rows`}
        </p>
      )}
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
