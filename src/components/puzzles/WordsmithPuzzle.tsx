import { useGameKeys } from "@/lib/desktop";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AcceptedWordChip } from "./AcceptedWordChip";
import { HudPills, type HudPillItem } from "./HudPills";
import { WordsmithRing } from "./WordsmithRing";
import { toggleWordsmithTile } from "./wordInput";
import { Shuffle } from "lucide-react";
import { shuffleLetterOrder } from "./letterShuffle";
import { playFinish, useWordFinish, wordCue, WORD_FINISH_SCORE, type FinishStep } from "./wordFinish";
import { scoreWordsmith, WORDSMITH_REV_DEPTH, WORDSMITH_V3_PANGRAM_BONUS } from "@/lib/duel/scoring";
import { useStageState } from "@/lib/duel/stageState";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import "@/polish-layout/batch-w-wordsmith.css";
import "@/polish-layout/polish-nov3-word.css";

/** The pangram moment (wordsmithRev 3): the shared moment-card sting, not a completion cue (docs/sound-cues/word.md lists those). */
const PANGRAM_CUE = "shared.momentcard";

import {
  WORDSMITH_MIN_LENGTH,
  WORDSMITH_CENTRE_INDEX,
  WORDSMITH_TIME_MS,
  type WordsmithPuzzleData,
} from "@/lib/duel/types";
import type { CheckWord } from "@/puzzles/types";

interface WordsmithPuzzleProps {
  puzzle: WordsmithPuzzleData;
  phaseStartedAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string) => void;
  /** The answer as it stands, for the room's time-out (a reveal that arrives before this stage locks in). */
  onDraftAnswer?: ((answer: string) => void) | undefined;
  checkWord?: CheckWord;
  /** The room round's stage-state key (stageState.ts): the found words survive a re-render and, in a room, a reload. */
  stateKey?: string;
}

interface Found {
  word: string;
  points: number;
}

export function WordsmithPuzzle({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
  checkWord,
  stateKey = "wordsmith",
}: WordsmithPuzzleProps) {
  const column = useGameColumnLayout();
  const letters = puzzle.letters;
  const [order, setOrder] = useState(() => letters.map((_, i) => i));
  const [selectedTiles, setSelectedTiles] = useState<number[]>([]);
  const [found, setFound] = useStageState<Found[]>(stateKey, "wordsmithFound", () => []);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedWord, setAcceptedWord] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [runEnded, setRunEnded] = useState(false);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const wordBoxRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<number[]>([]);
  const submitted = useRef(false);
  const foundRef = useRef<Found[]>([]);
  foundRef.current = found;

  selectedRef.current = selectedTiles;
  const word = selectedTiles.map((index) => letters[index] ?? "").join("");
  const points = found.reduce((sum, entry) => sum + entry.points, 0);
  // Word depth (wordsmithRev 3): the pangram badge, the phone's display of a public rule (the server scores it).
  const pangramRule = (puzzle.wordsmithRev ?? 0) >= WORDSMITH_REV_DEPTH;
  const pangramFound = found.some((entry) => entry.word.length >= letters.length);

  const lockIn = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    setRunEnded(true);
    onSubmit(foundRef.current.map((entry) => entry.word).join(","));
  }, [onSubmit]);

  // Every change goes to the room as a draft, so a reveal that arrives before this stage locks in
  // (a backgrounded phone, a stalled clock) still sends the answer as it stands, never "".
  useEffect(() => {
    onDraftAnswer?.(found.map((entry) => entry.word).join(","));
  }, [found, onDraftAnswer]);

  // A run worth 120+ on this phone's count: the atom spins up, outer tiles orbiting the centre (display only).
  useWordFinish(runEnded && scoreWordsmith(points, puzzle.wordsmithRev, found.some((entry) => entry.word.length >= puzzle.letters.length)) >= WORD_FINISH_SCORE, () => {
    wordCue("wordsmith.finish");
    const ring = ringRef.current?.querySelector(".wordsmith-ring");
    const spin = "cubic-bezier(.5,0,.2,1)";
    const steps: FinishStep[] = [
      { el: ring, keyframes: [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], delay: 0, duration: 1100, easing: spin },
      {
        el: ring?.querySelector(".wordsmith-ring-centre"),
        keyframes: [{ filter: "none" }, { filter: "drop-shadow(0 0 10px var(--primary)) brightness(1.2)", offset: 0.5 }, { filter: "none" }],
        delay: 0,
        duration: 1100,
      },
    ];
    ring?.querySelectorAll(".wordsmith-ring-letter").forEach((el) =>
      steps.push({ el, keyframes: [{ transform: "rotate(0deg)" }, { transform: "rotate(-360deg)" }], delay: 0, duration: 1100, easing: spin }),
    );
    return playFinish(steps);
  });

  // The round always runs the full clock; the found words go in just before
  // the clock stops so nothing is lost to the timeout.
  useEffect(() => {
    if (locked) return;
    const remaining = phaseStartedAt + WORDSMITH_TIME_MS - now;
    if (remaining <= 600) lockIn();
  }, [locked, now, phaseStartedAt, lockIn]);

  const trySubmit = async (indices = selectedRef.current) => {
    if (locked || busy) return;
    const candidate = indices.map((index) => letters[index] ?? "").join("").trim().toUpperCase();
    if (candidate.length < WORDSMITH_MIN_LENGTH) {
      setMessage(`${WORDSMITH_MIN_LENGTH} letters or more`);
      setShake((n) => n + 1);
      return;
    }
    if (!checkWord) return;
    setBusy(true);
    const verdict = await checkWord(
      candidate,
      found.map((entry) => entry.word),
    );
    setBusy(false);
    if (verdict.valid) {
      setFound((current) => [{ word: verdict.word, points: verdict.points }, ...current]);
      selectedRef.current = [];
      setSelectedTiles([]);
      setMessage(null);
      setAcceptedWord(verdict.word);
      rightMoveFlash(wordBoxRef.current);
      if (pangramRule && verdict.word.length >= letters.length && !pangramFound) wordCue(PANGRAM_CUE);
    } else {
      setMessage(verdict.reason ?? "Not a word");
      setShake((n) => n + 1);
    }
  };

  const tapTile = (index: number) => {
    if (locked || busy) return;
    setMessage(null);
    selectedRef.current = toggleWordsmithTile(selectedRef.current, index);
    setSelectedTiles(selectedRef.current);
  };

  // Desktop keys: typing a letter taps the first unused tile with it, Backspace taps the last tile again
  // (taking it off), Esc clears, Enter enters the word.
  useGameKeys((kind, key, event) => {
    if (/^[a-z]$/.test(key)) {
      if (kind === "down" && !locked && !busy) {
        const letter = key.toUpperCase();
        const index = letters.findIndex((l, i) => (l ?? "").toUpperCase() === letter && !selectedRef.current.includes(i));
        if (index >= 0) tapTile(index);
      }
      return true;
    }
    if (key === "Backspace") {
      const last = selectedRef.current[selectedRef.current.length - 1];
      if (kind === "down" && last !== undefined) tapTile(last);
      return true;
    }
    if (key === "Escape") {
      if (kind === "down" && !locked && !busy) {
        selectedRef.current = [];
        setSelectedTiles([]);
        setMessage(null);
      }
      return true;
    }
    if (key === "Enter") {
      if (kind === "down" && !event.repeat && selectedRef.current.length > 0) void trySubmit();
      return true;
    }
    return false;
  });

  // Batch W live summary (display only): what the status line shows when no message is up.
  const longest = found.reduce((best, entry) => Math.max(best, entry.word.length), 0);
  // Puzzle polish (3 Nov 2026): the summary as separate pills, never one line with dots in it.
  const summary: Array<HudPillItem | null> = word
    ? [
        { id: "letters", label: word.length === 1 ? "Letter" : "Letters", value: word.length },
        word.length < WORDSMITH_MIN_LENGTH ? { id: "needed", label: "Need", value: WORDSMITH_MIN_LENGTH, tone: "gold" } : null,
      ]
    : found.length > 0
      ? [
          { id: "words", label: found.length === 1 ? "Word" : "Words", value: found.length },
          { id: "longest", label: "Longest", value: longest, tone: "gold" },
        ]
      : [{ id: "hint", label: "Tap tiles to build a word" }];

  return (
    <div data-stage-column="2" data-word-polish="wordsmith" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>
          points <span className="text-primary">{points}</span>
        </span>
        {/* The accepted word shows in the HUD's empty middle, never over the board. */}
        <div className="word-moment-float inset-y-0 flex items-center" style={{ left: "28%", right: "28%" }}>
          <AcceptedWordChip word={acceptedWord} hidden={listOpen} />
        </div>
        <button
          type="button"
          onClick={() => setListOpen((open) => !open)}
          aria-expanded={listOpen}
          className="press rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-foreground"
        >
          Words {found.length} / {puzzle.wordCount ?? "?"}
        </button>
        {listOpen && (
          <>
            <div className="fixed inset-0 z-20" onPointerDown={() => setListOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full z-30 mt-2 max-h-72 w-60 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-lg">
              <p className="mb-2 text-[11px] text-muted-foreground">
                {found.length} of {puzzle.wordCount ?? "?"} possible words
              </p>
              {found.length === 0 ? (
                <p className="text-sm normal-case tracking-normal text-muted-foreground">No words yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {[...found]
                    .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word))
                    .map((entry) => (
                      <li key={entry.word} className="flex justify-between text-sm text-foreground">
                        <span>{entry.word}</span>
                        <span className="text-primary">{entry.points}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      <div data-game-arena="word" data-word-first="" className="relative flex min-h-0 flex-1 flex-col items-center">
        {pangramRule ? (
          // Its own reserved row above the ring (3 Nov 2026: laid over the corner it overlapped the plate), the same
          // fixed size open or found, so nothing moves when it lights.
          <div data-pangram-badge={pangramFound ? "found" : "open"} aria-label={pangramFound ? `Pangram found, plus ${WORDSMITH_V3_PANGRAM_BONUS}` : `Pangram: the word using every tile adds ${WORDSMITH_V3_PANGRAM_BONUS}`}
            className="pointer-events-none z-10 mb-1 flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] font-bold uppercase tracking-widest">
            <span>Pangram</span>
            <span className="tabular-nums">+{WORDSMITH_V3_PANGRAM_BONUS}</span>
          </div>
        ) : null}
        <div className="word-confirmation-board-space word-board-centre">
          <div ref={ringRef} className="word-confirmation-board">
            <WordsmithRing letters={letters} order={order} selected={selectedTiles} disabled={locked || busy} onTap={tapTile} />
          </div>
        </div>
      </div>
      <div key={shake} ref={wordBoxRef} aria-live="polite" aria-label="Current word" data-bw-well={word ? undefined : ""}
        data-game-controls="input" data-word-controls-first="" className={`flex h-11 shrink-0 items-center justify-center rounded-lg border bg-card px-2 text-center font-mono text-xl uppercase text-foreground ${message ? "border-warn animate-shake" : "border-border"}`}>
        {word || " "}
      </div>
      {message ? (
        <p data-game-controls="status" data-live-summary="wordsmith" className="h-6 shrink-0 truncate text-center font-mono text-xs leading-6 text-warn">{message}</p>
      ) : (
        <div data-game-controls="status" data-live-summary="wordsmith" className="h-6 shrink-0">
          <HudPills testId="wordsmith" items={summary} />
        </div>
      )}

      <div data-game-controls="actions" className={`${column ? "" : "mt-auto "}grid shrink-0 grid-cols-[44px_1fr_1fr] gap-2`}>
        <Button type="button" variant="outline" className="h-11 w-11 p-0" aria-label="Shuffle letters" title="Shuffle letters" disabled={locked || busy} onClick={() => setOrder(current => shuffleLetterOrder(current, WORDSMITH_CENTRE_INDEX))}><Shuffle className="h-5 w-5" /></Button>
        <Button type="button" variant="outline" onClick={() => {
          selectedRef.current = [];
          setSelectedTiles([]);
          setMessage(null);
        }} disabled={locked || busy || word.length === 0} className="h-11" >Clear</Button>
        <Button type="button" onClick={() => void trySubmit()} disabled={locked || busy || word.length === 0}
          className="h-11">Enter</Button>
      </div>
    </div>
  );
}
