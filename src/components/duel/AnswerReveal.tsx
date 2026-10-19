import { storedScoreParts } from "@/lib/duel/puzzleScoreRev";
import { devDiagnosticsOn, type ArcadeDiag } from "@/lib/arcade/diagnostics";
import { useEffect, useRef, useState } from "react";

import { WaitingLine } from "@/components/duel/Dots";
import { ArcadeReveal, storedCostRows, type RevealPlayer } from "@/components/duel/ArcadeReveal";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import { ARCADE_REVEAL_RENDERERS } from "@/lib/arcade/revealRenderers";

import { puzzleDef, puzzleName, puzzleRevealMs, puzzleTimeLimitMs } from "@/lib/duel/registry";
import { isRemovedType } from "@/lib/duel/removedGames";
import { TOTAL_ROUNDS, type PuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playSound, stopMusicExcept } from "@/lib/sound";
import { bombRevealExploded } from "@/puzzles/bombDefusal";
import { useSolveFlourish } from "@/components/puzzles/useSolveFlourish";
import { nearMiss } from "@/lib/duel/nearMiss";
import { usePerfectBurst } from "@/lib/fx/useSignature";
import { NewBestMoment } from "@/components/duel/NewBestMoment";

const REVEAL_SCORE_DELAY_MS = 350;
import { fx } from "@/lib/fx";

interface AnswerRevealProps {
  round: number;
  /** The room's own round count; practice/older rooms default to six. */
  totalRounds?: number;
  /** Practice: one game, so the header says "Practice" in place of the round. */
  practice?: boolean;
  puzzle: PuzzleData;
  /** The player's own submitted answer, or null if they never submitted. */
  myAnswer: string | null;
  myCorrect: boolean;
  myReactionAvgMs: number | null;
  myMsRemaining?: number;
  /** The score the server stored for this player and round; null until it lands. */
  myScore: number | null;
  /** The stored result detail; arcade runs carry dev diagnostics under `diag`. */
  myExtra?: Record<string, unknown> | null;
  /** False until the round's answers have arrived from the server. */
  answersReady: boolean;
  /** Everyone in the room for the arcade progress track (practice: omitted, own marker only). */
  players?: RevealPlayer[];
  /**
   * Practice only: this run beat an earlier device best under the same stamps (practiceBest.ts);
   * the reveal shows the "New best!" moment (NewBestMoment).
   */
  personalBest?: boolean;
  startedAt: number;
  now: number;
}

/** Dev-only (?dev=1): what the server did with this arcade run. */
function DevDiagnostics({ extra }: { extra: Record<string, unknown> | null }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(devDiagnosticsOn()), []);
  const diag = extra?.["diag"] as ArcadeDiag | undefined;
  if (!on || !diag) return null;
  const names = Array.from(
    new Set([...Object.keys(diag.server ?? {}), ...Object.keys(diag.client ?? {})]),
  ).filter((name) => name !== "tick");
  const differs = names.filter((name) => diag.client?.[name] !== diag.server?.[name]);
  const first = diag.first
    ? `#${diag.first.index} t${diag.first.t} k${diag.first.k} [${diag.first.a},${diag.first.b},${diag.first.c},${diag.first.d}] ${diag.first.reason}`
    : "none";
  return (
    <div className="shrink-0 break-all font-mono text-[10px] leading-tight text-muted-foreground opacity-70">
      <div>
        events {diag.received} · clamped {diag.clamped} · dropped {diag.dropped} · end t
        {diag.replayEndTick} · desync {diag.desyncTick ?? "none"} · {diag.replayMs}ms
      </div>
      <div>first fix: {first}</div>
      <div>
        {diag.client
          ? differs.length === 0
            ? "client = server"
            : differs
                .map(
                  (name) => `${name} c${diag.client?.[name] ?? "-"}/s${diag.server?.[name] ?? "-"}`,
                )
                .join(" · ")
          : "no client counters"}
      </div>
    </div>
  );
}

/**
 * The reveal board's own "Solution" and "Yours" labels (each game's Reveal draws them): tagged so
 * the skin shows the correct answer's label in a green-tinted box and the player's in an orange
 * one (polish-layout/theme.css). Display only; the board and its text are unchanged.
 */
function useRevealLabels(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const tag = () => {
      for (const el of root.querySelectorAll("span, p")) {
        if (el.children.length) continue;
        const text = el.textContent?.trim();
        const label = text === "Solution" ? "correct" : text === "Yours" ? "yours" : null;
        if (label && el.getAttribute("data-reveal-label") !== label) el.setAttribute("data-reveal-label", label);
      }
    };
    tag();
    const watch = new MutationObserver(tag);
    watch.observe(root, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [ref]);
}

/** The only score on the reveal: the server's stored number, never a local calculation. */
export function StoredScore({ score }: { score: number | null }) {
  const scoreRef = useRef<HTMLParagraphElement>(null);
  usePerfectBurst(scoreRef, score);
  if (score === null) {
    return (
      <div data-reveal-score="pending" className="shrink-0">
        <WaitingLine label="Scoring…" />
      </div>
    );
  }
  return (
    <p ref={scoreRef} data-reveal-score={score} className="th-score th-score-top shrink-0 font-mono text-2xl font-bold tabular-nums text-primary animate-pop-in">
      {score} points
    </p>
  );
}

/**
 * Solved ✓, partly solved (amber half ring, shown with the stored points), or ✗ for zero.
 * Partial is a stored score above 0 that isn't fully correct; until the score lands an
 * unsolved round shows an empty ring so the mark never flips from ✗ to partial.
 */
function Verdict({ correct, score }: { correct: boolean; score: number | null }) {
  if (!correct && score === null) {
    return <div data-verdict="pending" className="h-14 w-14 rounded-full border-2 border-border" aria-hidden="true" />;
  }
  if (!correct && score !== null && score > 0) {
    return (
      <div data-verdict="partial" className="flex flex-col items-center gap-1 animate-pop-in">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-timer-orange text-timer-orange">
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
          </svg>
        </div>
        <p className="font-display text-sm font-bold text-timer-orange">Partly solved</p>
      </div>
    );
  }
  return (
    <div
      data-verdict={correct ? "correct" : "wrong"}
      className={`flex h-14 w-14 items-center justify-center rounded-full border-2 animate-pop-in ${
        correct ? "border-me text-me" : "border-warn text-warn"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {correct ? (
          <path
            d="m5 13 4.5 4.5L19 7"
            className="animate-draw-stroke"
            style={{ strokeDasharray: 30, ["--draw-length" as string]: 30 }}
          />
        ) : (
          <>
            <path
              d="M6 6l12 12"
              className="animate-draw-stroke"
              style={{ strokeDasharray: 24, ["--draw-length" as string]: 24 }}
            />
            <path
              d="M18 6 6 18"
              className="animate-draw-stroke"
              style={{
                strokeDasharray: 24,
                ["--draw-length" as string]: 24,
                animationDelay: "120ms",
              }}
            />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * The round reveal. A stored round of a deleted game (removedGames.ts) gets only
 * its name and the stored score; everything else gets the game's own reveal.
 */
export function AnswerReveal(props: AnswerRevealProps) {
  return isRemovedType(props.puzzle.type) ? <RemovedRoundReveal {...props} /> : <LiveAnswerReveal {...props} />;
}

/** Read-only: no board, no replay, no grading; never waits on "Scoring…". */
function RemovedRoundReveal({ round, totalRounds = TOTAL_ROUNDS, puzzle, myScore }: AnswerRevealProps) {
  return (
    <div data-removed-game={puzzle.type} className="flex min-h-0 flex-1 flex-col gap-2 animate-phase-in">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Round {round} of {totalRounds}
        </span>
        <span className="min-w-0 flex-1 whitespace-normal break-words text-center font-display text-sm font-bold leading-none text-foreground">{puzzleName(puzzle.type)}</span>
      </div>
      <div className="flex w-full flex-1 flex-col items-center gap-2">
        <p data-reveal-score={myScore ?? "none"} className="shrink-0 font-mono text-2xl font-bold tabular-nums text-primary">
          {myScore === null ? "No score" : `${myScore} points`}
        </p>
        <p className="text-center text-sm text-muted-foreground">This game is no longer in Duelz; the stored score stands.</p>
      </div>
    </div>
  );
}

function LiveAnswerReveal({
  round,
  totalRounds = TOTAL_ROUNDS,
  practice = false,
  puzzle,
  myAnswer,
  myCorrect,
  myReactionAvgMs,
  myMsRemaining,
  myScore,
  myExtra,
  answersReady,
  players,
  personalBest,
  startedAt,
  now,
}: AnswerRevealProps) {
  const secondsLeft = Math.max(
    0,
    Math.ceil((puzzleRevealMs(puzzle) - Math.max(0, now - startedAt)) / 1000),
  );
  const def = puzzleDef(puzzle.type);
  const Reveal = def.Reveal;
  const puzzleOwnsRevealLayout = puzzle.type === "chain";
  const cued = useRef(0);
  const scoreCue = useRef<number | undefined>(undefined);
  const solvedBoard = useRef<HTMLDivElement>(null);
  useSolveFlourish(solvedBoard, puzzle.type, answersReady && myScore !== null && myCorrect);
  useRevealLabels(solvedBoard);

  useEffect(() => {
    if (myScore === null || cued.current === round) return;
    cued.current = round;
    stopMusicExcept("music_reveal", 200);
    // One verdict (none for partial credit), then the score cue 0.35 s later.
    if (puzzle.type === "bomb" && bombRevealExploded(puzzle, myAnswer)) {
      playSound("pz_bomb_explode");
      buzz([12, 60, 12]);
    } else if (myCorrect) {
      fx.onCorrect(undefined, def.theme);
      buzz(20);
    } else if (myScore <= 0) {
      fx.onWrong(undefined, def.theme);
      buzz([12, 60, 12]);
    }
    const score = myScore;
    scoreCue.current = window.setTimeout(() => fx.onRevealScore(score, def.theme), REVEAL_SCORE_DELAY_MS);
  }, [round, myCorrect, myScore, puzzle.type, def.category]);
  useEffect(() => () => window.clearTimeout(scoreCue.current), []);

  return (
    <div data-skin="room" className="relative flex min-h-0 flex-1 flex-col gap-2 animate-phase-in">
      {/* Practice's new best (arcade too); rooms keep ArcadeReveal's room-best record. */}
      {practice && personalBest && myScore !== null ? <NewBestMoment /> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {practice ? "Practice" : `Round ${round} of ${totalRounds}`}
        </span>
        <span className="min-w-0 flex-1 whitespace-normal break-words text-center font-display text-sm font-bold leading-none text-foreground">{def.name}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{secondsLeft}s</span>
      </div>

      {ARCADE_REVEAL_RENDERERS[puzzle.type] ? (
        <ArcadeReveal
          puzzle={puzzle}
          myAnswer={myAnswer}
          myScore={myScore}
          nearMissLine={nearMiss(puzzle.type, myExtra)}
          costRows={storedCostRows(puzzle.type, myExtra, puzzle.type === "clayshoot" ? puzzle.clayRev : undefined)}
          personalBest={practice ? false : undefined}
          round={round}
          myReveal={(myExtra?.["reveal"] as ArcadeRevealData | undefined) ?? null}
          players={
            players ?? [
              { slot: 0, name: "You", isMe: true, score: myScore, reveal: (myExtra?.["reveal"] as ArcadeRevealData | undefined) ?? null },
            ]
          }
        />
      ) : (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2">
        {!puzzleOwnsRevealLayout ? <Verdict correct={myCorrect} score={myScore} /> : null}
        {!puzzleOwnsRevealLayout ? (
          <p data-reveal-heading className="th-answer-correct whitespace-nowrap text-base">
            {def.revealHeading ?? "The answer was"}
          </p>
        ) : null}
        <StoredScore score={myScore} />
        {/* Shared near-miss line; nearMiss() returns null for every puzzle type without one. */}
        {myScore !== null && nearMiss(puzzle.type, myExtra) ? (
          <p className="shrink-0 text-center font-mono text-sm text-primary">{nearMiss(puzzle.type, myExtra)}</p>
        ) : null}
        <div ref={solvedBoard} data-skin-off className="answer-reveal-content th-answer-board flex w-full min-h-0 flex-1 flex-col items-center justify-start overflow-x-hidden overflow-y-auto text-base animate-rise-settle">
          {answersReady ? (
            <Reveal
              puzzle={puzzle}
              myAnswer={myAnswer}
              myCorrect={myCorrect}
              myReactionAvgMs={myReactionAvgMs}
              myMsRemaining={myMsRemaining}
              timeLimitMs={puzzleTimeLimitMs(puzzle)}
              validRows={Array.isArray(myExtra?.["validRows"]) ? (myExtra["validRows"] as number[]) : undefined}
              scoreParts={storedScoreParts(myExtra)}
              myExtra={myExtra ?? null}
            />
          ) : (
            <div className="flex justify-center">
              <WaitingLine label="Revealing" />
            </div>
          )}
        </div>
      </div>
      )}
      <DevDiagnostics extra={myExtra ?? null} />
    </div>
  );
}
