import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState } from "react";

import { useGridPointer } from "@/components/puzzles/GridDrag";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";
import { useStageState } from "@/lib/duel/stageState";
import { WORDSEARCH_TIME_MS, type WordSearchPlacement, type WordSearchPuzzleData } from "@/lib/duel/types";
import { wsChipSlots, wsDecode, wsEncode, wsGrade, wsHasBonus, wsSnapLine, wsSplitBonus, WS_SIZE, WS_WORDS } from "@/lib/duel/wordSearch";
import { fx } from "@/lib/fx";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import { goldPulse, playFinish, useWordFinish, wordCue, type FinishStep } from "@/components/puzzles/wordFinish";

import { useGoalProgress } from "@/components/duel/GameFrame";
import "@/polish-word/word-look.css";
import "@/polish-word/lookout.css";
import { Button } from "@/components/ui/button";
import { overhaulReveal, usesWordOverhaul } from "@/lib/duel/wordOverhaul";
import { RevealChips, RevealNumbers, type RevealChip } from "@/components/puzzles/WordReveal";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

export function Grid({
  grid,
  size,
  gold,
  live,
  bad,
  missedPath,
  bonusHint,
  pointer,
  small = false,
  foundPaths = [],
  missedPaths = [],
}: {
  /** The overhaul's reveal: loops round the words not found (red). */
  missedPaths?: readonly (readonly number[])[];
  grid: string;
  size: number;
  gold: ReadonlySet<number>;
  live?: ReadonlySet<number>;
  bad?: ReadonlySet<number>;
  /** Reveal: cells along every word the player did not find. */
  missedPath?: ReadonlySet<number>;
  /** Reveal (wordSearchRev 3): the bonus word's cells when the player missed it (a gold outline, not a miss). */
  bonusHint?: ReadonlySet<number>;
  pointer?: ReturnType<typeof useGridPointer>;
  small?: boolean;
  foundPaths?: readonly (readonly number[])[];
}) {
  return (
    <div
      ref={pointer?.ref}
      {...(pointer ? pointer.handlers : {})}
      data-play-area
      className="relative grid h-full w-full select-none"
      style={{ ...(pointer?.handlers.style ?? {}), gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: small ? 1 : 2 }}
    >
      {Array.from({ length: size * size }, (_, cell) => {
        const missedOnly = (missedPath?.has(cell) ?? false) && !gold.has(cell);
        // Unfound reveal path: red letters on a faint red fill; crossings with found words stay gold.
        const fill = bad?.has(cell)
          ? "bg-destructive text-destructive-foreground"
          : live?.has(cell)
            ? "bg-primary/40 text-foreground"
            : gold.has(cell)
              ? "bg-primary text-primary-foreground"
              : missedOnly
                ? "bg-destructive/15 text-destructive"
                : "bg-card text-foreground";
        const missedOutline = missedPath?.has(cell) ? "ring-2 ring-inset ring-destructive" : bonusHint?.has(cell) && !gold.has(cell) ? "ring-2 ring-inset ring-primary/70" : "";
        return (
          <div
            key={cell}
            data-ws-cell={cell}
            data-bw-live={live?.has(cell) && !bad?.has(cell) ? "" : undefined}
            data-wa="tile-sm"
            data-wa-tone={bad?.has(cell) ? "red" : live?.has(cell) ? "sapphire" : gold.has(cell) ? "gold" : missedOnly ? "dim" : "black"}
            className={`word-letter-tile flex aspect-square items-center justify-center rounded-sm font-mono font-bold ${fill} ${missedOutline}`}
            style={{ fontSize: small ? "max(9px, 5.6cqw)" : `clamp(16px, calc(min(100cqw, 100cqh) * ${(0.6 / size).toFixed(4)}), 28px)` }}
          >
            {grid[cell]}
          </div>
        );
      })}
      <svg viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {foundPaths.map((path, i) => {
          const a = path[0], b = path.at(-1);
          if (a === undefined || b === undefined) return null;
          // The Word overhaul: a found word is circled by a gold capsule loop (the letters stay readable inside it).
          return <path key={i} data-ws-line="" className="lookout-loop" d={capsule(a % size + 0.5, Math.floor(a / size) + 0.5, b % size + 0.5, Math.floor(b / size) + 0.5, 0.42)} />;
        })}
        {missedPaths.map((path, i) => {
          const a = path[0], b = path.at(-1);
          if (a === undefined || b === undefined) return null;
          return <path key={`m${i}`} data-ws-missed-line="" className="lookout-loop lookout-loop-missed" d={capsule(a % size + 0.5, Math.floor(a / size) + 0.5, b % size + 0.5, Math.floor(b / size) + 0.5, 0.42)} />;
        })}
      </svg>
    </div>
  );
}

/** A capsule round the segment (x1, y1)–(x2, y2), radius r, as an SVG path (Lookout's found-word loop). */
export function capsule(x1: number, y1: number, x2: number, y2: number, r: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * r;
  const ny = ((x2 - x1) / len) * r;
  const f = (v: number) => Number(v.toFixed(3));
  return `M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${r} ${r} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${r} ${r} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z`;
}

/** Fixed 5×5 example: LION found on a diagonal, read backwards. */
const EXAMPLE_GRID = "NTEKARNSIGBMOUPWELIDCAHYL";
const EXAMPLE_CELLS = [24, 18, 12, 6];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Animals · <span className="text-primary">1</span> / 6
      </p>
      <div style={{ width: 150, containerType: "inline-size" }}>
        <Grid grid={EXAMPLE_GRID} size={5} gold={new Set(EXAMPLE_CELLS)} foundPaths={[EXAMPLE_CELLS]} small />
      </div>
      <p className="max-w-[260px] text-center text-xs text-muted-foreground">
        LION, found diagonally and backwards. Words can run in any of eight directions.
      </p>
    </div>
  );
}

/** The one sound a Lookout drag's verdict plays (game review fix, 15 Nov 2026): none for a word already found. */
export function wordSearchVerdictSound(verdict: { valid: boolean; reason?: string }): "correct" | "wrong" | null {
  if (verdict.valid) return "correct";
  return verdict.reason === "Already found" ? null : "wrong";
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, checkWord, stateKey }: PuzzleStageProps) {
  const lockedNow = useRef(locked);
  lockedNow.current = locked;
  const data: WordSearchPuzzleData | null = puzzle.type === "wordsearch" ? puzzle : null;
  const key = stateKey ?? "wordsearch";
  const [selections, setSelections] = useStageState<number[][]>(key, "wsSelections", () => []);
  const [found, setFound] = useStageState<WordSearchPlacement[]>(key, "wsFound", () => []);
  // wordSearchRev 3: the hidden bonus word, once the server confirmed a drag on it (display only; the server grades).
  const [bonus, setBonus] = useStageState<WordSearchPlacement | null>(key, "wsBonus", () => null);
  const bonusChip = useRef<HTMLSpanElement | null>(null);
  const [line, setLine] = useState<number[]>([]);
  const [bad, setBad] = useState<number[]>([]);
  const start = useRef<number | null>(null);
  const current = useRef<number[]>([]);
  const submitted = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const size = data?.size ?? WS_SIZE;
  const total = data?.wordCount ?? WS_WORDS;
  const encoded = wsEncode(selections);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);

  // wordSearchRev 6 (the Word overhaul): finding the last listed word no longer ends the round; the bonus can still
  // be found, and Done ends it (or the clock). With the bonus found too there is nothing left, so it ends at once.
  const runsOn = usesWordOverhaul(data, "wordsearch") && !!data && wsHasBonus(data);
  const allFound = found.length >= total;
  const finish = () => {
    if (submitted.current || locked) return;
    submitted.current = true;
    onSubmit(encoded);
  };
  useEffect(() => {
    if (submitted.current || locked || !allFound) return;
    if (runsOn && !bonus) return;
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found.length, locked, bonus]);

  const done = locked || submitted.current || (allFound && !runsOn);
  // Batch W (display only): the found count moves to the frame's goal line in a live round; intros keep theirs.
  const inFrame = useGoalProgress({ done: found.length, total, text: `${found.length} of ${total} found` });
  const pointer = useGridPointer({
    cols: size,
    rows: size,
    onCell: done
      ? undefined
      : (cell) => {
          if (start.current === null) start.current = cell;
          const next = wsSnapLine(start.current, cell, size);
          if (next.join(".") !== current.current.join(".")) {
            current.current = next;
            setLine(next);
          }
        },
    onRelease: () => {
      const path = current.current;
      start.current = null;
      current.current = [];
      setLine([]);
      if (path.length < 2 || !checkWord) return;
      setSelections((s) => [...s, path]);
      const already = [...found.map((f) => f.word), ...(bonus ? [bonus.word] : [])];
      void checkWord("", already, path).then((verdict) => {
        // Game review fix (15 Nov 2026): the checks are silent in FeedbackStage (silentWordChecks), so each drag plays
        // exactly one sound here: one `correct` for a word or the bonus (was two for the bonus), one `wrong` for a
        // drag that is not a word, and nothing for re-dragging a word already found (was `wrong`).
        const sound = wordSearchVerdictSound(verdict);
        if (sound === "correct" && !lockedNow.current) fx.onCorrect();
        else if (sound === "wrong" && !lockedNow.current) fx.onWrong();
        if (verdict.valid && (verdict as { bonus?: boolean }).bonus) {
          setBonus((b) => b ?? { word: verdict.word, cells: path });
          rightMoveFlash(bonusChip.current);
        } else if (verdict.valid) {
          setFound((f) => (f.some((x) => x.word === verdict.word) ? f : [...f, { word: verdict.word, cells: path }]));
        } else if (verdict.reason !== "Already found") {
          setBad(path);
          setTimeout(() => setBad([]), 350);
        }
      });
    },
  });

  // All six found: every found word glows in the grid together (display only).
  useWordFinish(total > 0 && found.length >= total, () => {
    wordCue("wordsearch.finish");
    const root = stageRef.current;
    const cells = new Set(found.flatMap((f) => f.cells));
    const steps: FinishStep[] = [...cells].map((cell) => ({
      el: root?.querySelector(`[data-ws-cell="${cell}"]`),
      keyframes: goldPulse(1.06),
      delay: 0,
      duration: 900,
    }));
    root?.querySelectorAll("[data-ws-line]").forEach((line) =>
      steps.push({
        el: line,
        keyframes: [{ opacity: 0.7 }, { opacity: 1, strokeWidth: 0.14, offset: 0.4 }, { opacity: 0.7 }],
        delay: 0,
        duration: 900,
      }),
    );
    return playFinish(steps);
  });

  if (!data) return null;
  const hasBonus = wsHasBonus(data);
  const gold = new Set([...found.flatMap((f) => f.cells), ...(bonus?.cells ?? [])]);
  // Stored rounds before rev 1 carry no lengths and keep their blank chips.
  const slots = wsChipSlots(data.wordLengths, found.map((f) => f.word));
  return (
    <div ref={stageRef} data-polish="wordsearch" data-stage-column="2" className="flex min-h-0 flex-1 flex-col items-center gap-2 py-1">
      <div className="flex shrink-0 flex-col items-center">
        <p className="font-display text-2xl font-bold leading-tight text-foreground">{data.category}</p>
        {inFrame ? null : (
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span className="text-primary">{found.length}</span> / {total} found
          </p>
        )}
      </div>
      <div data-game-arena="board" className="flex min-h-0 w-full flex-1 items-center justify-center" style={{ containerType: "size" }}>
        <div style={{ width: "min(100cqw, 100cqh)", aspectRatio: "1 / 1" }}>
          <Grid grid={data.grid} size={size} gold={gold} foundPaths={[...found.map((f) => f.cells), ...(bonus ? [bonus.cells] : [])]} live={new Set(line)} bad={new Set(bad)} pointer={pointer} />
        </div>
      </div>
      <div data-game-controls="words" className="lookout-words flex w-full shrink-0 flex-wrap justify-center gap-1.5" aria-label={`${found.length} found, ${Math.max(0, total - found.length)} still to find`}>
        {slots
          ? // Rev 1: one chip per hidden word in a fixed order; an open chip shows only its letter count.
            slots.map((slot, i) =>
              slot.word ? (
                <span key={`slot-${i}`} className="lookout-word-chip" data-ws-chip="found">{slot.word}</span>
              ) : (
                <span key={`slot-${i}`} className="lookout-word-placeholder gap-1" data-ws-chip="open" data-ws-length={slot.length} aria-label={`Word still to find, ${slot.length} letters`}>
                  <span aria-hidden="true" className="font-mono text-[11px] leading-none tracking-[0.12em] text-muted-foreground">{"_".repeat(slot.length)}</span>
                  <span aria-hidden="true" className="rounded-sm bg-muted px-1 font-mono text-[11px] font-bold leading-4 text-foreground">{slot.length}</span>
                </span>
              ),
            )
          : <>
              {found.map((entry) => <span key={entry.word} className="lookout-word-chip">{entry.word}</span>)}
              {Array.from({ length: Math.max(0, total - found.length) }, (_, i) => <span key={`empty-${i}`} className="lookout-word-placeholder" aria-label="Word still to find" />)}
            </>}
        {hasBonus ? (
          // Rev 3: the hidden bonus word's chip, drawn from the first paint at a fixed size so nothing moves when it fills.
          <span
            ref={bonusChip}
            className="lookout-bonus-chip"
            data-ws-chip="bonus"
            data-found={bonus ? "" : undefined}
            aria-label={bonus ? `Bonus word found: ${bonus.word}` : "Bonus word: one more theme word is hidden"}
          >
            <span aria-hidden="true" className="lookout-bonus-star">★</span>
            <span aria-hidden="true" className="lookout-bonus-text">{bonus ? bonus.word : "?"}</span>
          </span>
        ) : null}
      </div>
      {runsOn ? (
        <div data-game-controls="actions" className="flex h-11 w-full shrink-0 items-center justify-center gap-3">
          {allFound ? (
            <>
              <span className="text-sm font-semibold text-muted-foreground">All {total} found · bonus still hidden</span>
              <Button type="button" data-ws-done="" data-wa-btn="gold" className="h-11 w-28 font-bold uppercase tracking-widest" disabled={done} onClick={finish}>
                Done
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Word overhaul's reveal (wordSearchRev 6+): the grid large, your found words gold in their loops and the words you
 * missed in red loops; every hidden word as a chip (found, missed, the bonus); the numbers the score is made of: words
 * found, the bonus word and wrong drags.
 */
function RevealOverhaul({ puzzle, myAnswer, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "wordsearch") return null;
  const placements = puzzle.placements ?? [];
  const split = wsSplitBonus(puzzle.bonus, wsDecode(myAnswer ?? "", puzzle.size));
  const verdict = wsGrade(placements, split.rest);
  const foundSet = new Set(verdict.found);
  const bonusCells = puzzle.bonus?.cells ?? [];
  const gold = new Set([...verdict.found.flatMap((i) => placements[i]?.cells ?? []), ...(split.bonusFound ? bonusCells : [])]);
  const missedPaths = placements.filter((_, i) => !foundSet.has(i)).map((p) => p.cells);
  const wrong = typeof myExtra?.["wrong"] === "number" ? (myExtra["wrong"] as number) : null;
  const chips: RevealChip[] = [
    ...placements.map((p, i): RevealChip => ({ text: p.word, kind: foundSet.has(i) ? "found" : "missed" })),
    ...(puzzle.bonus ? [{ text: `★ ${puzzle.bonus.word}`, kind: split.bonusFound ? ("longest" as const) : ("missed" as const) }] : []),
  ];
  return (
    <div data-word-reveal="wordsearch" data-wr-version="overhaul" className="wr">
      <RevealNumbers
        items={[
          { id: "found", label: "Words found", value: `${verdict.found.length}/${placements.length}`, tone: verdict.found.length === placements.length ? "gold" : undefined },
          puzzle.bonus ? { id: "bonus", label: "Bonus word", value: split.bonusFound ? "Found" : "Missed", tone: split.bonusFound ? "gold" : undefined } : null,
          wrong !== null ? { id: "wrong", label: "Wrong drags", value: wrong, tone: wrong > 0 ? "warn" : undefined } : null,
        ]}
      />
      <div style={{ width: "min(84vw, 340px)", containerType: "inline-size" }}>
        <Grid grid={puzzle.grid} size={puzzle.size} gold={gold} foundPaths={[...verdict.found.map((i) => placements[i]?.cells ?? []), ...(split.bonusFound ? [bonusCells] : [])]} missedPaths={missedPaths} />
      </div>
      <RevealChips id="words" items={chips} />
    </div>
  );
}

function Reveal(props: PuzzleRevealProps) {
  if (overhaulReveal(props.puzzle)) return <RevealOverhaul {...props} />;
  return <RevealOlder {...props} />;
}

function RevealOlder({ timeLimitMs, puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(devDiagnosticsOn()), []);
  if (puzzle.type !== "wordsearch") return null;
  const placements = puzzle.placements ?? [];
  // Rev 3: the bonus word's drags are set aside as the grader does.
  const split = wsSplitBonus(puzzle.bonus, wsDecode(myAnswer ?? "", puzzle.size));
  const verdict = wsGrade(placements, split.rest);
  const bonusCells = puzzle.bonus?.cells ?? [];
  const foundSet = new Set(verdict.found);
  const gold = new Set([...verdict.found.flatMap((i) => placements[i]?.cells ?? []), ...(split.bonusFound ? bonusCells : [])]);
  const missed = new Set(placements.flatMap((p, i) => (foundSet.has(i) ? [] : p.cells)));
  const all = verdict.found.length === placements.length && placements.length > 0;
  const elapsed = Math.max(0, timeLimitMs - (myMsRemaining ?? 0));
  return (
    <div data-word-reveal="wordsearch" className="flex w-full flex-col items-center gap-2">
      <div style={{ width: "min(100%, 256px)", containerType: "inline-size" }}>
        <Grid grid={puzzle.grid} size={puzzle.size} gold={gold} foundPaths={[...verdict.found.map((i) => placements[i]?.cells ?? []), ...(split.bonusFound ? [bonusCells] : [])]} missedPath={missed} bonusHint={new Set(bonusCells)} small />
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 font-mono text-sm uppercase tracking-wider">
        {placements.map((p, i) => (
          <span key={p.word} data-ws-reveal-word={p.word} className={foundSet.has(i) ? "text-primary" : "text-destructive"}>
            {p.word}
            {/* Letter count, as the chips show it during play (every round, stored ones too). */}
            <span className="ml-0.5 align-super text-[10px] opacity-70">{p.word.length}</span>
          </span>
        ))}
        {puzzle.bonus ? (
          <span data-ws-reveal-word={puzzle.bonus.word} data-ws-reveal-bonus={split.bonusFound ? "found" : "missed"} className={split.bonusFound ? "text-primary" : "text-muted-foreground"}>
            ★ {puzzle.bonus.word}
            <span className="ml-0.5 align-super text-[10px] opacity-70">bonus</span>
          </span>
        ) : null}
      </div>
      <p className="font-mono text-base text-primary">
        {all
          ? `6 / 6 · ${(elapsed / 1000).toFixed(1)}s`
          : `${verdict.found.length} / ${placements.length} found`}
      </p>
      {dev && (
        <div className="font-mono text-[10px] text-muted-foreground">
          {placements.map((p) => (
            <div key={p.word}>
              dev · {p.word}: [{p.cells.join(", ")}]
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const wordSearchPuzzle: PuzzleDefinition = {
  key: "wordsearch",
  name: gameDisplayName("wordsearch"),
  category: "word",
  timeLimitMs: WORDSEARCH_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "wordsearch", size: WS_SIZE, grid: "E".repeat(WS_SIZE * WS_SIZE), category: "Animals", wordCount: WS_WORDS }) satisfies WordSearchPuzzleData,
  check: (answer, puzzle) =>
    puzzle.type === "wordsearch" &&
    wsGrade(puzzle.placements ?? [], wsDecode(answer, puzzle.size)).found.length === (puzzle.placements?.length ?? -1),
  revealHeading: "The hidden words",
  IntroExample,
  Stage,
  Reveal,
};
// Game review fix (15 Nov 2026): the stage plays each check's one sound itself (wordSearchVerdictSound).
(Stage as { silentWordChecks?: boolean }).silentWordChecks = true;
