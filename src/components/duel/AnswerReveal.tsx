import { storedScoreParts } from "@/lib/duel/puzzleScoreRev";
import { devDiagnosticsOn, type ArcadeDiag } from "@/lib/arcade/diagnostics";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { WaitingLine } from "@/components/duel/Dots";
import { ArcadeReveal, storedCostRows, type RevealPlayer } from "@/components/duel/ArcadeReveal";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import { ARCADE_REVEAL_RENDERERS } from "@/lib/arcade/revealRenderers";

import { puzzleDef, puzzleName, puzzleRevealMs, puzzleTimeLimitMs } from "@/lib/duel/registry";
import { boardBox } from "@/lib/boardBox";
import { isRemovedType } from "@/lib/duel/removedGames";
import { TOTAL_ROUNDS, type PuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playSound, stopMusicExcept } from "@/lib/sound";
import { bombRevealExploded } from "@/puzzles/bombDefusal";
import { useSolveFlourish } from "@/components/puzzles/useSolveFlourish";
import { nearMiss } from "@/lib/duel/nearMiss";
import { usePerfectBurst } from "@/lib/fx/useSignature";
import { NewBestMoment } from "@/components/duel/NewBestMoment";
import { claimHeroRun, heroRun, heroRunEarned } from "@/lib/fx/celebrations";
import { useCelebrationScope, useCelebrationsOn } from "@/components/fx/useCelebration";

const REVEAL_SCORE_DELAY_MS = 350;
import { fx } from "@/lib/fx";
import { APP_NAME } from "@/lib/brand";

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
  /**
   * Celebrations' hero run on a round score of HERO_RUN_SCORE or more (once per round); false for a
   * reveal reopened from a results list (the daily's AsyncResults).
   */
  heroRun?: boolean;
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

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The reveal board's tray (Polish batch R, display only): placed behind the board's drawn box (boardBox,
 * the game frame's measure) plus 10 px, before the first paint and whenever the board's boxes change, so
 * the board sits in a tray that hugs it instead of a tall tinted panel. The board's own layout is untouched.
 */
function useRevealTray(board: { current: HTMLElement | null }, tray: { current: HTMLElement | null }) {
  useIsoLayoutEffect(() => {
    const b = board.current;
    const t = tray.current;
    if (!b || !t) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      // Measured against the board's own box, so its entrance (a translate) moves the tray with it.
      const box = boardBox(b);
      const r = b.getBoundingClientRect();
      const pad = 10;
      const left = Math.max(0, box.left - r.left - pad);
      const right = Math.min(b.clientWidth, box.right - r.left + pad);
      const top = Math.max(0, box.top - r.top + b.scrollTop - pad);
      const bottom = box.bottom - r.top + b.scrollTop + pad;
      if (right - left < 24 || bottom - top < 24) {
        t.style.display = "none";
        return;
      }
      t.style.display = "";
      t.style.left = `${left}px`;
      t.style.top = `${top}px`;
      t.style.width = `${right - left}px`;
      t.style.height = `${bottom - top}px`;
    };
    place();
    const later = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(later);
    resize?.observe(b);
    for (const child of Array.from(b.children)) resize?.observe(child);
    const mutations = new MutationObserver(later);
    mutations.observe(b, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutations.disconnect();
    };
  }, []);
}

/** The verdict in sentence case, so units stay lowercase: "Solved in 53.2 s", "Partly solved", "Not solved". */
function verdictLine(correct: boolean, score: number | null, msRemaining: number | undefined, limitMs: number): string {
  if (score === null && !correct) return "Scoring…";
  if (correct) {
    const used = Math.max(0, limitMs - (msRemaining ?? 0));
    return msRemaining === undefined || used <= 0 ? "Solved" : `Solved in ${(used / 1000).toFixed(1)} s`;
  }
  return score !== null && score > 0 ? "Partly solved" : "Not solved";
}

/** Who else is in (a room's reveal): everyone's badge, "n of N finished" and when the results arrive. */
function RevealPlayers({ players, secondsLeft }: { players: RevealPlayer[]; secondsLeft: number }) {
  const finished = players.filter((p) => p.score !== null).length;
  return (
    <div data-reveal-players className="flex shrink-0 items-center gap-2.5 pb-1">
      <span className="flex shrink-0 -space-x-1.5">
        {players.slice(0, 10).map((p) => (
          <span key={p.slot} className={`rounded-full ring-2 ring-[var(--ap-bg)] ${p.score === null ? "opacity-40" : ""}`}>
            <PlayerBadge look={p.look} name={p.name} size={22} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ap-text-2)]">
        {finished} of {players.length} finished · results in {secondsLeft}s
      </span>
    </div>
  );
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
    <p ref={scoreRef} data-reveal-score={score} className="th-score shrink-0 whitespace-nowrap text-2xl tabular-nums text-foreground animate-pop-in">
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
    return <div data-verdict="pending" className="h-11 w-11 shrink-0 rounded-full border-2 border-border" aria-hidden="true" />;
  }
  if (!correct && score !== null && score > 0) {
    return (
      <div data-verdict="partial" className="flex flex-col items-center gap-1 animate-pop-in">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-timer-orange text-timer-orange">
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
          </svg>
        </div>

      </div>
    );
  }
  return (
    <div
      data-verdict={correct ? "correct" : "wrong"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 animate-pop-in ${
        correct ? "border-category-accent text-category-accent" : "border-warn text-warn"
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
        <p className="text-center text-sm text-muted-foreground">{`This game is no longer in ${APP_NAME}; the stored score stands.`}</p>
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
  heroRun: heroRunAllowed = true,
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
  const trayRef = useRef<HTMLDivElement>(null);
  useRevealTray(solvedBoard, trayRef);

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

  // Celebrations (src/lib/fx/celebrations.ts): a round score of HERO_RUN_SCORE or more sends the
  // hero running along the bottom once, just after the score lands; it ends with the reveal.
  const celebrate = useCelebrationsOn();
  const scope = useCelebrationScope();
  useEffect(() => {
    if (!celebrate || !heroRunAllowed || !heroRunEarned(myScore)) return;
    const key = `${practice ? "practice" : "round"}:${puzzle.type}:${round}:${startedAt}`;
    const timer = window.setTimeout(() => {
      if (claimHeroRun(key)) heroRun(scope);
    }, REVEAL_SCORE_DELAY_MS + 250);
    return () => window.clearTimeout(timer);
  }, [celebrate, myScore, round, startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-skin="room" data-answer-reveal className="relative flex min-h-0 flex-1 flex-col gap-2.5 px-3 text-left animate-phase-in">
      {/* Practice's new best (arcade too); rooms keep ArcadeReveal's room-best record. */}
      {practice && personalBest && myScore !== null ? <NewBestMoment /> : null}
      <div className="rs-head shrink-0">
        <span className="min-w-0 truncate text-[15px] font-bold text-foreground">{def.name}</span>
        <span className="rs-meta">
          {practice ? "Practice" : `Round ${round} of ${totalRounds}`} · {secondsLeft}s
        </span>
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
      <div className="flex min-h-0 w-full flex-1 flex-col items-stretch gap-2.5">
        {/* The verdict row: the mark in the category colour, "Solved in 53.2 s" in sentence case, the score in white. */}
        <div data-verdict-row className="flex shrink-0 items-center gap-3">
          {!puzzleOwnsRevealLayout ? <Verdict correct={myCorrect} score={myScore} /> : null}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[16px] font-bold text-foreground">
              {verdictLine(myCorrect, myScore, myMsRemaining, puzzleTimeLimitMs(puzzle))}
            </span>
            {!puzzleOwnsRevealLayout ? (
              <span data-reveal-heading className="truncate text-[13px] text-[var(--ap-text-2)]">
                {def.revealHeading ?? "The answer was"}
              </span>
            ) : null}
          </span>
          <StoredScore score={myScore} />
        </div>
        {/* Shared near-miss line; nearMiss() returns null for every puzzle type without one. */}
        {myScore !== null && nearMiss(puzzle.type, myExtra) ? (
          <p className="shrink-0 text-center text-sm font-semibold text-foreground">{nearMiss(puzzle.type, myExtra)}</p>
        ) : null}
        {/* The board keeps its box (flex-1, as before); the tray behind it hugs what it draws (useRevealTray). */}
        <div ref={solvedBoard} data-skin-off className="answer-reveal-content relative isolate flex w-full min-h-0 flex-1 flex-col items-center justify-start overflow-x-hidden overflow-y-auto text-base animate-rise-settle">
          <div ref={trayRef} aria-hidden="true" data-reveal-tray className="reveal-tray" />
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
        {players && players.length > 1 ? <RevealPlayers players={players} secondsLeft={secondsLeft} /> : null}
      </div>
      )}
      <DevDiagnostics extra={myExtra ?? null} />
    </div>
  );
}
