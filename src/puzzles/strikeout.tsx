import { useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
import { Delete } from "lucide-react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { useStageState } from "@/lib/duel/stageState";
import { usesStandard } from "@/lib/duel/standard/stamps";
import { STD_STRIKEOUT, strikeoutEarlySolvePoints } from "@/lib/duel/standard/word";
import {
  SO2_VOWELS,
  SO2_WORDS,
  SO_LEN,
  SO_MAX_STRIKES,
  SO_ROWS,
  SO4_RULES,
  STRIKEOUT_REV2,
  STRIKEOUT_REV5,
  decodeStrikeout,
  decodeStrikeout2,
  encodeStrikeout,
  encodeStrikeout2,
  replayStrikeout,
  replayStrikeout2,
  so2GivenLetters,
  so2Rules,
  strikeoutRevOf,
  type So2Action,
  type SoAction,
  type SoView,
} from "@/lib/duel/strikeout";
import { STRIKEOUT_TIME_MS, type StrikeoutPuzzleData } from "@/lib/duel/types";
import { completeFx, fx } from "@/lib/fx";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { buzz, prefersReducedMotion } from "@/lib/motion";
import { FoundWordMoment, type AcceptedWordMoment } from "@/components/puzzles/FoundWordMoment";
import { KeypadAction, LetterKeypad, type KeyTone } from "@/components/puzzles/LetterKeypad";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { useMoveSync } from "@/components/puzzles/useMoveSync";
import { goldFlip, playFinish, useWordFinish, wordCue, type FinishStep } from "@/components/puzzles/wordFinish";

import { LiveSummary } from "@/components/puzzles/batchW/LiveSummary";
import "@/polish-layout/batch-w-strikeout.css";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** One strike marker per strike allowed (five, ten from rev 3 or twelve from rev 4, drawn smaller); used ones are filled red. */
export function Strikes({ used, max = SO_MAX_STRIKES, markerRef }: { used: number; max?: number; markerRef?: React.RefObject<HTMLDivElement | null> }) {
  const many = max > SO_MAX_STRIKES;
  // Rev 4's twelve markers sit a little closer (12 × 20 px + 11 × 4 px = 284 px) so the row fits a 320 px phone.
  const gap = max > 10 ? "gap-1" : many ? "gap-1.5" : "gap-2";
  return (
    <div ref={markerRef} className={`flex items-center justify-center ${gap}`} aria-label={`${used} of ${max} strikes`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`flex ${many ? "h-5 w-5" : "h-6 w-6"} items-center justify-center rounded-full border-2 font-display ${many ? "text-xs" : "text-sm"} font-bold leading-none ${
            i < used ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-transparent"
          }`}
        >
          ✕
        </span>
      ))}
    </div>
  );
}

type TileLook = "hidden" | "shown" | "given" | "solved" | "typed" | "missed";

const TILE: Record<TileLook, string> = {
  hidden: "bg-secondary text-transparent",
  shown: "bg-card text-foreground ring-1 ring-inset ring-primary/60",
  /** Rev 2: a starting letter (showing from the start, earns nothing). */
  given: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  solved: "bg-primary text-primary-foreground",
  typed: "bg-card text-primary ring-2 ring-inset ring-primary",
  missed: "border-2 border-destructive bg-card text-muted-foreground",
};

export function Row({
  letters,
  looks,
  selected,
  onTap,
  tile,
  tileH,
  rowIndex,
}: {
  letters: string[];
  looks: TileLook[];
  selected?: boolean | undefined;
  onTap?: (() => void) | undefined;
  /** Tile side: px, or a CSS length such as the board's --so-tile. */
  tile: number | string;
  /** Tile height when it differs from its width (batch W: Strikeout's live row is a little taller than wide). */
  tileH?: string | undefined;
  rowIndex: number;
}) {
  const side = typeof tile === "number" ? `${tile}px` : tile;
  const height = tileH ?? side;
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
          style={{ width: side, height, fontSize: `calc(${side} * 0.55)` }}
        >
          {ch || "\u00a0"}
        </span>
      ))}
    </div>
  );
}

/** Rev 1 (stored rounds): five five-letter words on the board at once. */
function StageRev1({ puzzle, locked, onSubmit, onDraftAnswer, checkMoves, stateKey }: PuzzleStageProps) {
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
    if (view.done) completeFx("strikeout.finish");
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

function RevealRev1({ puzzle, myAnswer, myMsRemaining, timeLimitMs }: PuzzleRevealProps) {
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

// ───────────────────────── Rev 2: five long words, one at a time ─────────────────────────

/** Vowel guesses left on the current word (two, or three from rev 3): filled dots are still available. */
function VowelsLeft({ left, max }: { left: number; max: number }) {
  return (
    <div data-so-vowels={left} className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground" aria-label={`${left} vowel guess${left === 1 ? "" : "es"} left`}>
      <span>Vowels</span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < left ? "bg-primary" : "border border-border bg-transparent"}`} />
      ))}
    </div>
  );
}

/**
 * strikeoutRev 5 (word depth, early-solve bonus): letters still hidden when words were solved with Solve, summed
 * over the round. Absolutely centred in the dots row, so it never moves anything; empty until the first early solve.
 * The points are the server's (they also need a quick finish); this only counts what the board showed.
 */
function EarlyPill({ hidden, pillRef, points = false }: { hidden: number; pillRef: Ref<HTMLSpanElement>; points?: boolean }) {
  // The scoring standard (strikeoutRev 7): the pill counts the early-solve points themselves (word.ts), which the
  // board shows in full: 4 per word solved with 3+ letters still hidden.
  const label = points ? `Early solves: ${hidden} point${hidden === 1 ? "" : "s"}` : `Early solves: ${hidden} letter${hidden === 1 ? "" : "s"} still hidden`;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-live="polite">
      <span
        ref={pillRef}
        data-so-early={hidden}
        className={`so-early-pill rounded-full px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${hidden > 0 ? "" : "invisible"}`}
        aria-label={label}
      >
        Early +{hidden}
      </span>
    </div>
  );
}

/** A small lift on the early pill when a word is solved early (none with reduced motion or reduced effects). */
function popEarly(el: HTMLElement | null) {
  if (!el || prefersReducedMotion() || document.documentElement.dataset["reducedEffects"]) return;
  el.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
}

/** Five progress dots: solved words gold, the current word ringed. */
function WordDots({ solved, current }: { solved: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground" aria-label={`Word ${Math.min(current, SO2_WORDS - 1) + 1} of ${SO2_WORDS}`}>
      <span>Word {Math.min(current, SO2_WORDS - 1) + 1}/{SO2_WORDS}</span>
      {Array.from({ length: SO2_WORDS }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < solved ? "bg-primary" : i === current ? "ring-2 ring-primary" : "bg-secondary"}`} />
      ))}
    </div>
  );
}

/** Fixed example (rev 3 / 4, SPLINTER; twelve strike markers as rooms deal rev 4): a first word with two starting letters, two letters found, one strike, two vowel guesses left. */
function IntroExample() {
  const keys: [string, string][] = [["E", "bg-primary text-primary-foreground"], ["R", "bg-primary text-primary-foreground"], ["Z", "bg-destructive/80 text-destructive-foreground"], ["T", "bg-secondary text-foreground"]];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div className="flex flex-col items-center gap-1">
          <Strikes used={1} max={SO4_RULES.maxStrikes} />
          <VowelsLeft left={SO4_RULES.maxVowels - 1} max={SO4_RULES.maxVowels} />
        </div>
        <Row
          letters={["", "", "", "", "", "", "", ""].map((_, i) => ({ 0: "S", 4: "N", 6: "E", 7: "R" } as Record<number, string>)[i] ?? "")}
          looks={["given", "hidden", "hidden", "hidden", "given", "hidden", "shown", "shown"]}
          tile={24}
          rowIndex={0}
        />
        <div className="flex gap-1 pt-1">
          {keys.map(([k, tone]) => (
            <span key={k} className={`flex h-7 w-7 items-center justify-center rounded-md font-display text-sm font-bold ${tone}`}>
              {k}
            </span>
          ))}
        </div>
      </div>
      <p className="max-w-[270px] text-center text-xs text-muted-foreground">
        One word at a time; S and N were showing. E and R fill every match, Z is a strike. Three vowel guesses per word.
      </p>
    </div>
  );
}

function Stage2({ puzzle, locked, onSubmit, onDraftAnswer, checkMoves, stateKey }: PuzzleStageProps) {
  const data: StrikeoutPuzzleData | null = puzzle.type === "strikeout" ? puzzle : null;
  const key = stateKey ?? "strikeout";
  const rev = data ? strikeoutRevOf(data) : STRIKEOUT_REV2;
  const rules = so2Rules(rev);
  // The scoring standard (strikeoutRev 7, standard/word.ts): the early pill shows the early-solve points.
  const standard = !!data && usesStandard(data);
  const [actions, setActions] = useStageState<So2Action[]>(key, "so2Actions", () => []);
  const [view, setView] = useStageState<SoView | null>(key, "so2View", () => null);
  const [solving, setSolving] = useStageState<boolean>(key, "so2Solving", () => false);
  const [typed, setTyped] = useStageState<string>(key, "so2Typed", () => "");
  // strikeoutRev 5 (word depth): tiles still hidden when each word was solved with Solve (public: the board showed them).
  const [early, setEarly] = useStageState<number[]>(key, "so5Early", () => []);
  const earlyRef = useRef<HTMLSpanElement | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedWordMoment | null>(null);
  const submitted = useRef(false);
  const root = useRef<HTMLDivElement | null>(null);
  const strikeRef = useRef<HTMLDivElement | null>(null);
  const board = useRef<HTMLDivElement | null>(null);
  const shownBefore = useRef<string | null>(null);
  useNoTouchScroll(root);

  const encoded = encodeStrikeout2(actions);
  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((n) => (n === text ? null : n)), 1100);
  };

  const sync = useMoveSync(checkMoves, "strikeout", (next, sentMoves) => {
    const before = view;
    setView(next);
    if ((next.word ?? 0) !== (before?.word ?? 0)) {
      setSolving(false);
      setTyped("");
    }
    if (next.last === "notword" || next.last === "vowels") {
      // No effect on the board: take the refused action back out of the list.
      const refused = decodeStrikeout2(sentMoves)[next.count - 1];
      if (refused) {
        const token = encodeStrikeout2([refused]);
        setActions((list) => {
          const at = list.map((a) => encodeStrikeout2([a])).lastIndexOf(token);
          return at < 0 ? list : [...list.slice(0, at), ...list.slice(at + 1)];
        });
      }
      puzzleReject(board.current);
      fx.onWrong();
      flash(next.last === "notword" ? "Not in the word list" : "No vowel guesses left");
    } else if (before && next.strikes > before.strikes) {
      puzzleReject(strikeRef.current);
      fx.onWrong();
      buzz([12, 60, 12]);
      flash(next.last === "wrong" ? "Wrong word: strike" : "Not in the word: strike");
    } else if ((next.word ?? 0) > (before?.word ?? 0)) {
      const solvedWord = next.rows[before?.word ?? 0] ?? "";
      if (rev >= STRIKEOUT_REV5 && next.last === "right") {
        const w = before?.word ?? 0;
        const hidden = [...(before?.rows[w] ?? words[w] ?? "")].filter((ch) => ch === "_").length;
        if (hidden > 0) {
          const counts = !standard || hidden >= STD_STRIKEOUT.earlyHidden;
          setEarly((list) => {
            const out = [...list];
            while (out.length < w) out.push(0);
            out[w] = hidden;
            return out;
          });
          if (counts) popEarly(earlyRef.current);
        }
      }
      setAccepted((a) => ({ word: solvedWord, points: 30, serial: (a?.serial ?? 0) + 1 }));
      fx.onCorrect();
      buzz(16);
    } else if (next.last === "hit") {
      fx.onPlace();
      buzz(8);
    }
  });

  // A remount mid-round (reconnect) asks the server for the current board again.
  useEffect(() => {
    if (actions.length > 0 && !view) sync(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (submitted.current || locked || !view || (!view.done && !view.over)) return;
    submitted.current = true;
    if (view.done) completeFx("strikeout.finish");
    onSubmit(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, locked]);

  const words = data?.givens ?? [];
  const cur = Math.min(view?.word ?? 0, Math.max(0, words.length - 1));
  const pattern = words[cur] ?? "";
  // The board for the current word (the last one once all are solved): the server's reply, or the starting letters before any reply.
  const shown = view?.rows[cur] ?? pattern;

  // Solved: the last word's tiles flip gold, then the solved-word strip (display only; the answer is already in).
  useWordFinish(!!view?.done, () => {
    wordCue("strikeout.finish");
    const steps: FinishStep[] = [];
    for (let i = 0; i < pattern.length; i++)
      steps.push({ el: board.current?.querySelector(`[data-so-tile="${cur}-${i}"]`), keyframes: goldFlip("X"), delay: i * 60, duration: 420 });
    for (let w = 0; w < SO2_WORDS; w++)
      steps.push({ el: board.current?.querySelector(`[data-so-solved="${w}"]`), keyframes: goldFlip("X"), delay: 520 + w * 80, duration: 420 });
    return playFinish(steps);
  });

  // Newly revealed tiles flip in.
  useLayoutEffect(() => {
    const prev = shownBefore.current;
    shownBefore.current = `${cur}:${shown}`;
    if (!prev || !prev.startsWith(`${cur}:`) || !board.current || prefersReducedMotion()) return;
    const before = prev.slice(String(cur).length + 1);
    [...shown].forEach((ch, i) => {
      if (ch === "_" || before[i] !== "_") return;
      board.current
        ?.querySelector(`[data-so-tile="${cur}-${i}"]`)
        ?.animate([{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }], { duration: 280, delay: i * 30, easing: "ease-out", fill: "backwards" });
    });
  }, [cur, shown]);

  if (!data) return null;
  const strikes = view?.strikes ?? 0;
  const solvedCount = view?.done ? SO2_WORDS : (view?.word ?? 0);
  const done = locked || submitted.current || !!view?.done || !!view?.over;
  const given = so2GivenLetters(words, cur);
  const mine = actions.filter((a) => a.word === cur);
  const guessed = new Set(mine.flatMap((a) => (a.kind === "guess" ? [a.letter] : [])));
  const fresh = (view?.word ?? 0) === cur;
  const hits = new Set(fresh ? (view?.hits ?? "") : "");
  const misses = new Set(fresh ? (view?.misses ?? "") : "");
  const vowelsTried = [...guessed].filter((l) => SO2_VOWELS.includes(l)).length;
  const vowelsLeft = Math.max(0, Math.min(rules.maxVowels - vowelsTried, fresh ? (view?.vowelsLeft ?? rules.maxVowels) : rules.maxVowels));
  const holes = [...shown].map((ch, i) => (ch === "_" ? i : -1)).filter((i) => i >= 0);
  const isSolving = solving && !done && holes.length > 0;
  const answered = view ? Math.min(actions.length, view.count) : 0;
  const pendingSolve = actions.slice(answered).some((a) => a.kind === "solve");

  const send = (next: So2Action[]) => {
    setActions(next);
    sync(encodeStrikeout2(next));
  };

  const vowelLocked = (letter: string) => SO2_VOWELS.includes(letter) && vowelsLeft <= 0 && !guessed.has(letter);
  const keyOff = (letter: string) => !isSolving && (guessed.has(letter) || given.has(letter) || vowelLocked(letter));

  const pressLetter = (letter: string) => {
    if (done) return;
    if (isSolving) {
      setTyped((t) => (t.length < holes.length ? t + letter : t));
      return;
    }
    if (keyOff(letter)) return;
    send([...actions, { kind: "guess", word: cur, letter }]);
  };

  const toggleSolve = () => {
    if (done || holes.length === 0) return;
    setTyped("");
    setSolving(!solving);
  };

  const solve = () => {
    if (!isSolving) {
      toggleSolve();
      return;
    }
    if (typed.length !== holes.length) return;
    let k = 0;
    const guess = [...shown].map((ch) => (ch === "_" ? typed[k++]! : ch)).join("");
    send([...actions, { kind: "solve", word: cur, guess }]);
    setTyped("");
    setSolving(false);
  };

  const tone = (letter: string): KeyTone => {
    if (hits.has(letter) || given.has(letter)) return "gold";
    if (misses.has(letter)) return "red";
    if (guessed.has(letter)) return "pending";
    if (vowelLocked(letter)) return "used";
    return "plain";
  };

  // One row of up to eight tiles, as large as the arena allows: batch W (display only) fills the tray's
  // width with the word's own length (4px gaps, 8px for the row's ring) and stands each tile taller
  // than wide, 72–80px where the arena has the height, never smaller than before (the old height,
  // min(1.2 × width, (arena − 56) / 1.6), is always within the new limits).
  const tileCount = Math.max(1, pattern.length || 8);
  const tileSize = `min(64px, calc((100cqw - ${8 + (tileCount - 1) * 4}px) / ${tileCount}), calc((100cqh - 56px) / 1.6))`;
  const tileHeight = "min(max(calc(var(--so-tile) * 1.45), 72px), 80px, calc((100cqh - 40px) / 1.25))";
  let k = 0;
  const letters = [...shown].map((ch) => (ch === "_" ? (isSolving ? (typed[k++] ?? "") : "") : ch));
  k = 0;
  const looks = [...shown].map((ch, i): TileLook => {
    if (ch === "_") return isSolving && typed[k++] ? "typed" : "hidden";
    if (view?.done) return "solved";
    return pattern[i] !== "_" ? "given" : "shown";
  });
  const solvedWords = (view?.rows ?? []).slice(0, solvedCount);

  return (
    <div
      ref={root}
      data-stage-column="1"
      data-word-polish="strikeout"
      data-strikeout-rev={rev}
      className="flex min-h-0 flex-1 flex-col items-center gap-1 py-1"
      style={{ ...NO_SCROLL_STYLE, touchAction: "manipulation" }}
    >
      <div className="flex h-8 w-full shrink-0 items-center justify-center">
        <Strikes used={strikes} max={rules.maxStrikes} markerRef={strikeRef} />
      </div>
      <div className="relative flex h-6 w-full shrink-0 items-center justify-between px-2">
        <WordDots solved={solvedCount} current={view?.word ?? 0} />
        {rev >= STRIKEOUT_REV5 ? (
          standard ? (
            <EarlyPill hidden={strikeoutEarlySolvePoints(early)} pillRef={earlyRef} points />
          ) : (
            <EarlyPill hidden={early.reduce((a, b) => a + (b ?? 0), 0)} pillRef={earlyRef} />
          )
        ) : null}
        <VowelsLeft left={vowelsLeft} max={rules.maxVowels} />
      </div>
      <div data-game-arena="strikeout" className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div ref={board} className="flex h-full w-full flex-col items-center" style={{ ["--so-tile" as string]: tileSize }}>
          {/* The words already solved (Joe's phone notes, 27 Oct 2026; display only) sit centred in the space between
              the top bar and the tiles (his notes of 28 Oct 2026). The tiles keep their place: this space takes what
              the arena leaves above them, and the words float in it (absolute), so the board tray still hugs the tiles. */}
          <div data-so-solved-space="" className="relative w-full min-h-0 flex-1">
            <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 flex-wrap justify-center gap-1" aria-label="Solved words">
              {solvedWords.map((w, i) => (
                <span key={i} data-so-solved={i} className="bw-lift rounded bg-primary/90 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-primary-foreground">
                  {w}
                </span>
              ))}
            </div>
          </div>
          <Row
            letters={letters}
            looks={looks}
            selected={isSolving}
            rowIndex={cur}
            tile="var(--so-tile)"
            tileH={tileHeight}
            onTap={done ? undefined : toggleSolve}
          />
        </div>
      </div>
      <div className="relative flex h-8 w-full shrink-0 items-center justify-center px-2 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground" aria-live="polite">
        {note ? (
          <span className="text-destructive">{note}</span>
        ) : isSolving ? (
          <span className="text-primary">Type the missing letters, then Solve</span>
        ) : pendingSolve ? (
          <span>Checking…</span>
        ) : mine.length > 0 ? (
          // Batch W: the live summary once this word has a guess (what the board and keypad already show).
          <LiveSummary
            testId="strikeout"
            parts={[
              <><b>{hits.size}</b> found</>,
              <><b>{misses.size}</b> missed</>,
              <><b>{holes.length}</b> to go</>,
            ]}
          />
        ) : (
          <span>Tap a letter · Solve to guess the word</span>
        )}
        <div className="pointer-events-none absolute inset-0">
          <FoundWordMoment value={accepted} />
        </div>
      </div>
      <LetterKeypad
        onLetter={pressLetter}
        tone={tone}
        disabled={keyOff}
        locked={done}
        left={
          <KeypadAction
            label={isSolving && typed.length === 0 ? "Back" : "Delete"}
            disabled={!isSolving}
            onPress={() => (typed.length === 0 ? setSolving(false) : setTyped((t) => t.slice(0, -1)))}
          >
            {isSolving && typed.length === 0 ? "Back" : <Delete className="h-5 w-5" />}
          </KeypadAction>
        }
        right={
          <KeypadAction label="Solve" emphasis disabled={done || holes.length === 0 || (isSolving && typed.length !== holes.length)} onPress={solve}>
            Solve
          </KeypadAction>
        }
      />
    </div>
  );
}

function Reveal2({ puzzle, myAnswer, myMsRemaining, timeLimitMs }: PuzzleRevealProps) {
  if (puzzle.type !== "strikeout") return null;
  const words = (puzzle.words ?? []).map((w) => w.toUpperCase());
  const givens = puzzle.givens ?? [];
  const rev = strikeoutRevOf(puzzle);
  const rules = so2Rules(rev);
  // The stored answer is the canonical list: every solve in it already passed the dictionary.
  const state = replayStrikeout2(words, givens, decodeStrikeout2(myAnswer ?? ""), () => true, rules);
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  const strikeText = `${state.strikes} strike${state.strikes === 1 ? "" : "s"}`;
  return (
    <div data-word-reveal="strikeout" data-strikeout-rev={rev} className="flex w-full flex-col items-center gap-2">
      <Strikes used={state.strikes} max={rules.maxStrikes} />
      <div className="flex flex-col items-center gap-1">
        {words.map((w, wi) => {
          const solved = wi < state.solvedWords;
          return (
            <Row
              key={wi}
              rowIndex={wi}
              tile={28}
              letters={[...w]}
              looks={[...w].map((_, i): TileLook => (solved ? "solved" : wi === state.word && state.revealed[wi]![i] ? (state.given[wi]![i] ? "given" : "shown") : "missed"))}
            />
          );
        })}
      </div>
      <p className="font-mono text-base text-primary">
        {state.done
          ? `5 / 5 words · ${strikeText} · ${(elapsed / 1000).toFixed(1)}s`
          : `${state.solvedWords} / 5 words · ${strikeText}`}
      </p>
    </div>
  );
}

function Stage(props: PuzzleStageProps) {
  return props.puzzle.type === "strikeout" && strikeoutRevOf(props.puzzle) >= STRIKEOUT_REV2 ? <Stage2 {...props} /> : <StageRev1 {...props} />;
}

function Reveal(props: PuzzleRevealProps) {
  return props.puzzle.type === "strikeout" && strikeoutRevOf(props.puzzle) >= STRIKEOUT_REV2 ? <Reveal2 {...props} /> : <RevealRev1 {...props} />;
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
    if (strikeoutRevOf(puzzle) >= STRIKEOUT_REV2) return replayStrikeout2(puzzle.words ?? [], puzzle.givens ?? [], decodeStrikeout2(answer), () => true, so2Rules(strikeoutRevOf(puzzle))).done;
    return replayStrikeout(puzzle.words ?? [], decodeStrikeout(answer), () => true).done;
  },
  revealHeading: "The five words",
  IntroExample,
  Stage,
  Reveal,
};
