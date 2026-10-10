import { gameDisplayName } from "@/lib/duel/gameNames";
import { Lock, LockOpen } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { gridCellAt, hapticTick } from "@/components/puzzles/GridDrag";
import { Button } from "@/components/ui/button";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useStageState } from "@/lib/duel/stageState";
import type { WordSlidePuzzleData } from "@/lib/duel/types";
import {
  decodeSlideTokens,
  markedRowWord,
  parseToken,
  replayWordSlide,
  shiftToken,
  WS_MARKED_ROWS,
  WS_REVEAL_MS,
  WS_SHIFT_MS,
  WS_SIZE,
  WS_TIME_MS,
  type SlideShift,
} from "@/lib/duel/wordSlide";
import { playSound } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const CELL = 56;
const GAP = 4;

function Board({
  grid,
  cell,
  good,
  boardRef,
  onPointerDown,
  locked,
  onLock,
}: {
  grid: string[];
  cell: number;
  good: Set<number>;
  boardRef?: React.RefObject<HTMLDivElement | null>;
  onPointerDown?: (event: React.PointerEvent) => void;
  locked?: Set<number>;
  onLock?: (row: number) => void;
}) {
  const board = (
    <div
      ref={boardRef}
      onPointerDown={onPointerDown}
      className="puzzle-board grid shrink-0 rounded-xl border-2 border-border bg-card p-1.5"
      style={{ gridTemplateColumns: `repeat(${WS_SIZE}, ${cell}px)`, gap: GAP, ...(onPointerDown ? NO_SCROLL_STYLE : {}) }}
      aria-label={`${gameDisplayName("wordslide")} board`}
    >
      {grid.map((letter, i) => {
        const row = Math.floor(i / WS_SIZE);
        const tone = locked?.has(row)
          ? "border-primary bg-opponent/15"
          : good.has(row) ? "border-opponent bg-opponent/15" : "border-transparent bg-background/40";
        return (
          <span
            key={i}
            data-cell={i}
            data-valid-row={good.has(row) ? "true" : undefined}
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
    <div data-game-arena="fixed" className="flex shrink-0 items-start gap-1">
      {board}
      <div className="flex flex-col p-1.5" style={{ gap: GAP }}>
        {Array.from({ length: WS_SIZE }, (_, row) => {
          const isLocked = locked?.has(row) ?? false;
          const can = isLocked || good.has(row);
          return (
            <button
              key={row}
              type="button"
              aria-label={isLocked ? `Unlock row ${row + 1}` : `Lock row ${row + 1}`}
              disabled={!can}
              onClick={() => onLock(row)}
              className={`flex w-11 shrink-0 items-center justify-center rounded-lg ${isLocked ? "bg-primary/20 text-primary" : "text-foreground"} disabled:opacity-60`}
              style={{ height: cell }}
            >
              {isLocked ? <Lock className="h-7 w-7" /> : <LockOpen className="h-7 w-7" />}
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
  const submitted = useRef(false);
  const board = useRef<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const lastShift = useRef<SlideShift | null>(null);
  useNoTouchScroll(root);

  const replay = useMemo(() => (data ? replayWordSlide(data.grid, tokens) : null), [data, tokens]);
  const encoded = tokens.join(",");
  const lockedRows = new Set(replay?.locked ?? []);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  const rowWords = replay ? WS_MARKED_ROWS.map((r) => markedRowWord(replay.grid, r)) : [];
  const rowKey = rowWords.join("|");

  // Check all five rows on the server; lock the moment all read as words.
  useEffect(() => {
    if (!checkWord) return;
    for (const word of rowWords) {
      if (word in verdicts) continue;
      void checkWord(word, [])
        .then((v) => setVerdicts((c) => ({ ...c, [word]: v.valid })))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey, checkWord]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (rowWords.length && rowWords.every((w) => verdicts[w] === true)) {
      submitted.current = true;
      playSound("pz_padlock");
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

  // A shift slides its line in over 120 ms.
  useLayoutEffect(() => {
    const shift = lastShift.current;
    lastShift.current = null;
    if (!shift || !board.current) return;
    const offset = -(CELL + GAP) * shift.dir;
    for (let k = 0; k < WS_SIZE; k++) {
      if (shift.axis === "c" && lockedRows.has(k)) continue;
      const index = shift.axis === "r" ? shift.index * WS_SIZE + k : k * WS_SIZE + shift.index;
      const el = board.current.querySelector<HTMLElement>(`[data-cell="${index}"]`);
      const from = shift.axis === "r" ? `translateX(${offset}px)` : `translateY(${offset}px)`;
      el?.animate([{ transform: from }, { transform: "none" }], { duration: WS_SHIFT_MS, easing: "ease-out" });
    }
  }, [tokens]);

  if (!data || !replay) return null;
  const frozen = locked || submitted.current;
  const good = new Set(WS_MARKED_ROWS.filter((r, i) => verdicts[rowWords[i]!] === true));
  const canUndo = tokens.reduce((depth, token) => token.startsWith("L") ? depth : token === "X" ? 0 : token === "U" ? Math.max(0, depth - 1) : depth + 1, 0) > 0;

  const push = (token: string) => {
    if (frozen) return;
    const parsed = parseToken(token);
    if (parsed && typeof parsed === "object" && !("lock" in parsed)) {
      if (parsed.axis === "r" && lockedRows.has(parsed.index)) return;
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
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
      const shift: SlideShift =
        Math.abs(dx) >= Math.abs(dy)
          ? { axis: "r", index: Math.floor(start / WS_SIZE), dir: dx > 0 ? 1 : -1 }
          : { axis: "c", index: start % WS_SIZE, dir: dy > 0 ? 1 : -1 };
      if (shift.axis === "r" && lockedRows.has(shift.index)) return;
      push(shiftToken(shift));
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div ref={root} data-polish="wordslide" data-stage-column="3" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3" style={NO_SCROLL_STYLE}>
      <Board grid={replay.grid} cell={CELL} good={good} boardRef={board} onPointerDown={onPointerDown} locked={lockedRows} onLock={(row) => { playSound("pz_padlock"); push(`L${row}`); }} />
      <p data-game-controls="status" className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Moves <span className="text-primary">{replay.moves}</span>
      </p>
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
  const replay = replayWordSlide(puzzle.grid, decodeSlideTokens(myAnswer ?? ""));
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
           : `${good.size} / 5 rows`}
      </p>
      <p className="text-center font-mono text-base text-muted-foreground">
        Par {puzzle.par} - you used {replay.moves}
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
