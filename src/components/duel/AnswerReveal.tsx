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
import { TOTAL_ROUNDS, type PuzzleData, type PuzzleType } from "@/lib/duel/types";
import { holdHaptics } from "@/lib/haptics";
import { playSound, stopMusicExcept } from "@/lib/sound";
import { bombRevealExploded } from "@/puzzles/bombDefusal";
import { useSolveFlourish } from "@/components/puzzles/useSolveFlourish";
import { nearMiss } from "@/lib/duel/nearMiss";
import { usePerfectBurst } from "@/lib/fx/useSignature";
import { NewBestMoment } from "@/components/duel/NewBestMoment";
import { MuteToggle } from "@/components/duel/MuteToggle";
import {
  HERO_DANCE_MS,
  HERO_GRAND_MS,
  HERO_RUN_MS,
  HERO_STILL_MS,
  celebrationCalm,
  claimHeroRun,
  heroDance,
  heroGrand,
  heroMomentFor,
  heroRun,
  heroRunEarned,
  skipCelebration,
} from "@/lib/fx/celebrations";
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
  /**
   * Practice only: Play again and Back on the reveal itself (27 Oct 2026, no separate result page);
   * the reveal then has no countdown. Rooms leave these out and keep their timed reveal.
   */
  onPlayAgain?: () => void;
  onBack?: () => void;
}

/** Practice's two small actions under the reveal: Play again (gold, it plays) and Back to the list. */
function PracticeRevealActions({ onPlayAgain, onBack }: { onPlayAgain?: (() => void) | undefined; onBack?: (() => void) | undefined }) {
  return (
    <div data-practice-reveal-actions className="flex shrink-0 items-center gap-2 pt-0.5">
      {onBack ? (
        <button type="button" onClick={onBack} className="rs-btn press tap-target h-11 flex-1">
          Back
        </button>
      ) : null}
      {onPlayAgain ? (
        <button
          type="button"
          onClick={onPlayAgain}
          className="th-btn-gold ap-btn-gold rs-btn-gold press tap-target h-11 flex-1 !text-[15px]"
        >
          Play again
        </button>
      ) : null}
    </div>
  );
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
 * The reveal's scroll area fades out at its bottom while there is more below (data-more, the room lists'
 * .rs-scroll fade, styles.css), so a board cut off by the scroll edge runs into the screen's home-bar strip
 * with no step (bottom-clearance-check's reveal seams; Counterweight's scales after #149). It watches the
 * content box and every scroller a game's Reveal draws inside it (Counterweight has its own). Display only.
 */
function useRevealMore(ref: { current: HTMLElement | null }) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scrollers = () =>
      [root, ...root.querySelectorAll<HTMLElement>("*")].filter((el) => {
        const y = getComputedStyle(el).overflowY;
        return y === "auto" || y === "scroll";
      });
    const sync = () => {
      const more = scrollers().some((el) => el.scrollHeight - el.scrollTop - el.clientHeight > 2);
      if (more) root.dataset["more"] = "";
      else delete root.dataset["more"];
    };
    sync();
    // Scroll events don't bubble: listen in the capture phase for the inner scrollers too.
    root.addEventListener("scroll", sync, { passive: true, capture: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    ro?.observe(root);
    const watch = new MutationObserver(sync);
    watch.observe(root, { childList: true, subtree: true });
    return () => {
      root.removeEventListener("scroll", sync, { capture: true });
      ro?.disconnect();
      watch.disconnect();
    };
  }, [ref]);
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
      // Never past the content's own end (or the box's height): the tray's padding alone must not make
      // the reveal scroll or fade (a board that fills the box, the Logic reveals, ended 10 px short).
      let end = b.clientHeight;
      for (const child of Array.from(b.children)) {
        if (child === t || getComputedStyle(child).position === "absolute") continue;
        end = Math.max(end, child.getBoundingClientRect().bottom - r.top + b.scrollTop);
      }
      const bottom = Math.min(end, box.bottom - r.top + b.scrollTop + pad);
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

/** Smallest a board is drawn to make the reveal fit (27 Oct 2026); below it the reveal scrolls as before. */
const REVEAL_FIT_MIN = 0.5;
/** The reveal's own lines never drop under this (px) when the whole reveal has to shrink. */
const REVEAL_FIT_MIN_TEXT_PX = 13;

/**
 * The reveal fits the screen (27 Oct 2026, display only): when the board and its lines are taller
 * than the space under the verdict row, the boards (each game's canvases, svgs and grids, the
 * outermost ones) are drawn smaller, centred, until everything is in frame, so there is no faded
 * edge and no scroll. Only when shrinking the boards to REVEAL_FIT_MIN is not enough does the whole
 * reveal shrink too, never taking its lines under 13 px. A transform plus a matching negative
 * margin, so each board's own layout, sizing and drawing are untouched. Run before the first
 * paint and again when the space or the content changes.
 */
function useRevealFit(ref: { current: HTMLElement | null }) {
  useIsoLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scaled: { el: HTMLElement; transform: string; origin: string; margin: string }[] = [];
    const reset = () => {
      for (const s of scaled.splice(0)) {
        s.el.style.transform = s.transform;
        s.el.style.transformOrigin = s.origin;
        s.el.style.marginBottom = s.margin;
      }
      delete root.dataset["fit"];
    };
    const shrink = (el: HTMLElement, z: number) => {
      const h = el.offsetHeight;
      const margin = parseFloat(getComputedStyle(el).marginBottom) || 0;
      scaled.push({ el, transform: el.style.transform, origin: el.style.transformOrigin, margin: el.style.marginBottom });
      el.style.transformOrigin = "top center";
      el.style.transform = `scale(${z})`;
      el.style.marginBottom = `${margin - (1 - z) * h}px`;
    };
    const overflow = () => root.scrollHeight - root.clientHeight;
    const boards = () => {
      const out: HTMLElement[] = [];
      const walk = (el: Element) => {
        for (const child of Array.from(el.children)) {
          if (!(child instanceof HTMLElement || child instanceof SVGElement)) continue;
          const cs = getComputedStyle(child);
          if (cs.display === "none" || cs.position === "absolute" || cs.position === "fixed") continue;
          const r = child.getBoundingClientRect();
          const board =
            r.height >= 56 &&
            (/^(CANVAS|svg|IMG)$/i.test(child.tagName) || cs.display === "grid" || cs.display === "inline-grid");
          // An svg can't be moved by its own style in every browser: its html parent is.
          if (board) out.push(child instanceof HTMLElement ? child : (child.parentElement as HTMLElement));
          else walk(child);
        }
      };
      walk(root);
      return [...new Set(out)].filter((el) => el !== root && root.contains(el));
    };
    /** The boards' combined height down the page (side-by-side boards count once). */
    const span = (els: HTMLElement[]) => {
      const rows = els.map((el) => el.getBoundingClientRect()).map((r) => [r.top, r.bottom] as const).sort((a, b) => a[0] - b[0]);
      let total = 0;
      let end = -Infinity;
      for (const [top, bottom] of rows) {
        if (bottom <= end) continue;
        total += bottom - Math.max(top, end);
        end = bottom;
      }
      return total;
    };
    let frame = 0;
    let fitted = "";
    const fit = () => {
      frame = 0;
      // The tray (placed on the board's box) is left out of the measure: it follows the board.
      const tray = root.querySelector<HTMLElement>("[data-reveal-tray]");
      const trayDisplay = tray?.style.display ?? "";
      if (tray) tray.style.display = "none";
      reset();
      let over = overflow();
      if (over > 1) {
        const els = boards();
        const height = span(els);
        let z = 1;
        // Shrinking a board can rewrap what sits beside it: a few passes, each from the measured overflow.
        for (let pass = 0; pass < 4 && over > 1 && height > 0 && z > REVEAL_FIT_MIN; pass++) {
          z = Math.max(REVEAL_FIT_MIN, z - (over + 2) / height);
          for (const s of scaled.splice(0)) {
            s.el.style.transform = s.transform;
            s.el.style.transformOrigin = s.origin;
            s.el.style.marginBottom = s.margin;
          }
          for (const el of els) shrink(el, z);
          over = overflow();
        }
        if (over > 1) {
          // Last resort: the whole reveal, lines included, never under 13 px text.
          let smallest = Infinity;
          for (const el of Array.from(root.querySelectorAll<HTMLElement>("p, span, li, div"))) {
            if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim())) continue;
            if (el.closest("svg, [data-reveal-fit-board]")) continue;
            smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize) || Infinity);
          }
          const floor = Number.isFinite(smallest) ? Math.min(1, REVEAL_FIT_MIN_TEXT_PX / smallest) : 1;
          const blocks = Array.from(root.children).filter(
            (el): el is HTMLElement => el instanceof HTMLElement && getComputedStyle(el).position !== "absolute",
          );
          const total = blocks.reduce((n, el) => n + el.offsetHeight, 0);
          const zz = total > 0 ? Math.max(floor, 1 - (over + 2) / total) : 1;
          if (zz < 1) for (const el of blocks) shrink(el, zz);
        }
        root.dataset["fit"] = "";
      }
      if (tray) tray.style.display = trayDisplay;
      fitted = `${root.clientWidth}x${root.clientHeight}:${root.scrollHeight}`;
    };
    fit();
    const later = () => {
      if (`${root.clientWidth}x${root.clientHeight}:${root.scrollHeight}` === fitted) return;
      if (!frame) frame = requestAnimationFrame(fit);
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(later);
    resize?.observe(root);
    for (const child of Array.from(root.children)) resize?.observe(child);
    const mutations = new MutationObserver(() => {
      for (const child of Array.from(root.children)) resize?.observe(child);
      if (!frame) frame = requestAnimationFrame(fit);
    });
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutations.disconnect();
      reset();
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
export function StoredScore({ score, type }: { score: number | null; type: PuzzleType }) {
  const scoreRef = useRef<HTMLParagraphElement>(null);
  usePerfectBurst(scoreRef, score, type);
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
  onPlayAgain,
  onBack,
}: AnswerRevealProps) {
  const practiceActions = practice && (onPlayAgain || onBack);
  const secondsLeft = Math.max(
    0,
    Math.ceil((puzzleRevealMs(puzzle) - Math.max(0, now - startedAt)) / 1000),
  );
  const def = puzzleDef(puzzle.type);
  const Reveal = def.Reveal;
  const puzzleOwnsRevealLayout = puzzle.type === "chain";
  // Haptics (lib/haptics.ts) never play over a reveal: its boards, replays and verdict cues hold them.
  useIsoLayoutEffect(() => holdHaptics(), []);
  const cued = useRef(0);
  const scoreCue = useRef<number | undefined>(undefined);
  const solvedBoard = useRef<HTMLDivElement>(null);
  useSolveFlourish(solvedBoard, puzzle.type, answersReady && myScore !== null && myCorrect);
  useRevealLabels(solvedBoard);
  useRevealFit(solvedBoard);
  useRevealMore(solvedBoard);
  const trayRef = useRef<HTMLDivElement>(null);
  useRevealTray(solvedBoard, trayRef);

  useEffect(() => {
    if (myScore === null || cued.current === round) return;
    cued.current = round;
    stopMusicExcept("music_reveal", 200);
    // One verdict (none for partial credit), then the score cue 0.35 s later.
    if (puzzle.type === "bomb" && bombRevealExploded(puzzle, myAnswer)) {
      playSound("pz_bomb_explode");
    } else if (myCorrect) {
      fx.onCorrect(undefined, def.theme);
    } else if (myScore <= 0) {
      fx.onWrong(undefined, def.theme);
    }
    const score = myScore;
    scoreCue.current = window.setTimeout(() => fx.onRevealScore(score, def.theme), REVEAL_SCORE_DELAY_MS);
  }, [round, myCorrect, myScore, puzzle.type, def.category]);
  useEffect(() => () => window.clearTimeout(scoreCue.current), []);

  // Celebrations (src/lib/fx/celebrations.ts), once per round, just after the score lands, ending with
  // the reveal: a round score of HERO_RUN_SCORE or more sends the hero running along the bottom;
  // 190–199 brings it on to dance (heroDance); 200 sends it round the screen under fireworks
  // (heroGrand). A tap anywhere skips it (the tap still reaches whatever is under it: the layer is
  // pointer-events none and the listener only observes).
  const celebrate = useCelebrationsOn();
  const scope = useCelebrationScope();
  useEffect(() => {
    if (!celebrate || !heroRunAllowed || !heroRunEarned(myScore)) return;
    const moment = heroMomentFor(myScore);
    const key = `${practice ? "practice" : "round"}:${puzzle.type}:${round}:${startedAt}`;
    let skipTimer = 0;
    const skip = () => {
      skipCelebration(scope);
      stopListening();
    };
    const stopListening = () => {
      window.clearTimeout(skipTimer);
      window.removeEventListener("pointerdown", skip, true);
    };
    const timer = window.setTimeout(() => {
      if (!claimHeroRun(key)) return;
      if (moment === "grand") heroGrand(scope);
      else if (moment === "dance") heroDance(scope);
      else heroRun(scope);
      const lasts = celebrationCalm() ? (moment === "run" ? 0 : HERO_STILL_MS) : moment === "grand" ? HERO_GRAND_MS : moment === "dance" ? HERO_DANCE_MS : HERO_RUN_MS;
      if (!lasts) return;
      window.addEventListener("pointerdown", skip, { capture: true, passive: true });
      skipTimer = window.setTimeout(stopListening, lasts);
    }, REVEAL_SCORE_DELAY_MS + 250);
    return () => {
      window.clearTimeout(timer);
      stopListening();
    };
  }, [celebrate, myScore, round, startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-skin="room" data-answer-reveal className="relative flex min-h-0 flex-1 flex-col gap-2.5 px-3 text-left animate-phase-in">
      {/* Practice's new best (arcade too); rooms keep ArcadeReveal's room-best record. */}
      {practice && personalBest && myScore !== null ? <NewBestMoment /> : null}
      {/* Its own screen (3 Nov 2026): this row is the screen's header (no app top bar), so the sound button sits here. */}
      <div data-reveal-head className="rs-head shrink-0 items-center">
        <span className="min-w-0 truncate text-[15px] font-bold text-foreground">{def.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="rs-meta">
            {practice ? (practiceActions ? "Practice" : `Practice · ${secondsLeft}s`) : `Round ${round} of ${totalRounds} · ${secondsLeft}s`}
          </span>
          <MuteToggle />
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
          <StoredScore score={myScore} type={puzzle.type} />
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
      {practiceActions ? <PracticeRevealActions onPlayAgain={onPlayAgain} onBack={onBack} /> : null}
      <DevDiagnostics extra={myExtra ?? null} />
    </div>
  );
}
