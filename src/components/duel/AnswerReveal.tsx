import { scorePartsText, storedScoreParts } from "@/lib/duel/puzzleScoreRev";
import { readPracticeBest } from "@/lib/duel/practiceBest";
import { stampSignature } from "@/lib/duel/practiceStamps";
import { RevealBreakdown } from "@/components/duel/RevealBreakdown";
import { SolutionSwitch } from "@/components/duel/SolutionSwitch";
import { devDiagnosticsOn, type ArcadeDiag } from "@/lib/arcade/diagnostics";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { WaitingLine } from "@/components/duel/Dots";
import { ArcadeReveal, revealShown, storedCostRows, type RevealPlayer } from "@/components/duel/ArcadeReveal";
import { engineLines, statRepeatsPart } from "@/lib/duel/revealBreakdown";
import { engineScoreLines } from "@/lib/duel/engineBreakdown";
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
import { Button } from "@/design/components";
import { MetaChips } from "@/components/app/MetaChips";

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
  /** Practice goals: the star this run earned ("Silver star earned"), shown with the new-best moment. */
  starLine?: string | null;
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
        <Button variant="secondary" size={44} onClick={onBack} className="flex-1">
          Back
        </Button>
      ) : null}
      {onPlayAgain ? (
        <Button
          variant="gold"
          size={44}
          onClick={onPlayAgain}
          className="flex-1"
        >
          Play again
        </Button>
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

/** Smallest a board is drawn to make the reveal fit (27 Oct 2026); below it the reveal scrolls as before. */
const REVEAL_FIT_MIN = 0.5;
/** Largest a reveal's board is drawn to fill the reveal's spare height (3 Nov 2026). */
const REVEAL_GROW_MAX = 1.8;
/** Padding inside the card, round everything it holds (4 Nov 2026). */
const REVEAL_CARD_PAD = 12;

type Box = { left: number; top: number; right: number; bottom: number };

/** An element's own (direct) text, outside svgs. */
function ownText(el: Element): boolean {
  if (el.closest("svg")) return false;
  return Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
}

const shown = (el: Element) => {
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "absolute" || cs.position === "fixed") return false;
  const r = el.getBoundingClientRect();
  return r.width >= 1 && r.height >= 1;
};

/**
 * The boards in a reveal's card (6 Nov 2026): what the fit scales, never the lines round them. A board is a game's own
 * `data-reveal-board` element (a board drawn with its labels), a canvas, svg or image 56 px or taller, a grid 56 px or
 * larger whose text is cells and clues (no word over 3 characters: a word list or a table of lines is text, not a
 * board), or a box drawn entirely by absolutely placed layers (Gridlock's car park). Each board takes in the wrappers
 * tight round it (a panel no more than 40 px larger that holds nothing else), so its frame grows with it.
 */
function revealBoards(card: HTMLElement): HTMLElement[] {
  const leaves: HTMLElement[] = [];
  const cellText = (el: Element) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    // Each run of characters on its own (a column clue "1\n1\n2" is three short cells, a word is one long run).
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n.textContent ?? "").split(/\s+/).some((run) => run.length > 3)) return false;
    return true;
  };
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (!(child instanceof HTMLElement || child instanceof SVGElement) || !shown(child)) continue;
      const r = child.getBoundingClientRect();
      const cs = getComputedStyle(child);
      const big = r.width >= 56 && r.height >= 56;
      const kids = Array.from(child.children);
      const board =
        child.hasAttribute("data-reveal-board") ||
        (/^(CANVAS|svg|IMG)$/i.test(child.tagName) && r.height >= 56) ||
        (big && (cs.display === "grid" || cs.display === "inline-grid") && cellText(child)) ||
        (big && kids.length > 0 && !ownText(child) && kids.every((k) => !shown(k)) && kids.some((k) => getComputedStyle(k).position === "absolute"));
      if (board) leaves.push(child instanceof HTMLElement ? child : (child.parentElement as HTMLElement));
      else walk(child);
    }
  };
  walk(card);
  const blocks = leaves.map((leaf) => {
    let b: HTMLElement = leaf;
    if (b.hasAttribute("data-reveal-board")) return b;
    while (b.parentElement && b.parentElement !== card && card.contains(b.parentElement)) {
      const p = b.parentElement;
      const kids = Array.from(p.children).filter(shown);
      if (kids.length !== 1 || ownText(p)) break;
      const pr = p.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      // Not into a box smaller than what it holds (a board overflowing a squeezed box: the box's size isn't the board's).
      if (pr.height > br.height + 40 || pr.width > br.width + 40 || pr.height < br.height - 1 || pr.width < br.width - 1) break;
      b = p;
    }
    return b;
  });
  const unique = [...new Set(blocks)].filter((el) => el !== card);
  return unique.filter((el) => !unique.some((o) => o !== el && o.contains(el)));
}

const overlaps = (a: Box, b: Box) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
const inside = (a: Box, b: Box) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;

/**
 * The reveal's boards fit the screen (6 Nov 2026, Joe's review; the 4 Nov fit scaled the whole card, so the lines in it
 * came out oversized). Only the boards (revealBoards) are scaled, all by one factor, from their top centre, with a
 * matching bottom margin so the lines under them move rather than being drawn over: up to REVEAL_GROW_MAX to fill the
 * reveal's spare height, or down to half size when the card is too tall (then the reveal scrolls). The factor is the
 * largest at which, measured in the page, every board stays REVEAL_CARD_PAD inside the reveal's sides and the content
 * ends REVEAL_CARD_PAD above its bottom, no board meets another board or a line it did not already touch, and no board
 * runs past a panel or clipping box that held it at full size. The text keeps its size. The tray behind the card is
 * placed on what the card draws plus the padding. A transform, so no game's own sizing or drawing changes; run before
 * the first paint and again when the space or the content changes.
 */
function useRevealFit(rootRef: { current: HTMLElement | null }, cardRef: { current: HTMLElement | null }, trayRef: { current: HTMLElement | null }) {
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    if (!root || !card) return;
    const scaled: { el: HTMLElement; transform: string; origin: string; margin: string }[] = [];
    const reset = () => {
      for (const s of scaled.splice(0)) {
        s.el.style.transform = s.transform;
        s.el.style.transformOrigin = s.origin;
        s.el.style.marginBottom = s.margin;
      }
      root.style.overflowY = "";
      delete root.dataset["fit"];
      delete root.dataset["grown"];
    };
    // Nothing drawn in the card (an engine game's breakdown above says it all): no tray.
    const empty = () =>
      !Array.from(card.children).some((el) => {
        const r = el.getBoundingClientRect();
        return r.width >= 1 && r.height >= 1 && getComputedStyle(el).display !== "none";
      });
    /** What the card draws: its lines and panels (boardBox) and its boards' drawn boxes. */
    const drawn = (boards: HTMLElement[]): Box => {
      const box = { ...boardBox(card) };
      for (const el of boards) {
        const r = el.getBoundingClientRect();
        box.left = Math.min(box.left, r.left);
        box.top = Math.min(box.top, r.top);
        box.right = Math.max(box.right, r.right);
        box.bottom = Math.max(box.bottom, r.bottom);
      }
      return box;
    };
    const placeTray = (boards: HTMLElement[]) => {
      const tray = trayRef.current;
      if (!tray) return;
      if (empty()) {
        tray.style.display = "none";
        return;
      }
      const box = drawn(boards);
      const r = root.getBoundingClientRect();
      if (!(box.right - box.left >= 24 && box.bottom - box.top >= 24)) {
        tray.style.display = "none";
        return;
      }
      const left = Math.max(0, box.left - r.left - REVEAL_CARD_PAD);
      const right = Math.min(root.clientWidth, box.right - r.left + REVEAL_CARD_PAD);
      const top = Math.max(0, box.top - r.top + root.scrollTop - REVEAL_CARD_PAD);
      const bottom = Math.min(Math.max(root.scrollHeight, root.clientHeight), box.bottom - r.top + root.scrollTop + REVEAL_CARD_PAD);
      tray.style.display = "";
      tray.style.left = `${left}px`;
      tray.style.top = `${top}px`;
      tray.style.width = `${right - left}px`;
      tray.style.height = `${bottom - top}px`;
    };
    let frame = 0;
    let fitted = "";
    const fit = () => {
      frame = 0;
      const tray = trayRef.current;
      if (tray) tray.style.display = "none";
      reset();
      // Still "Revealing": nothing to fit yet (the board's arrival refits).
      const boards = !empty() && !card.querySelector("[data-reveal-waiting]") ? revealBoards(card) : [];
      if (boards.length) {
        const r = root.getBoundingClientRect();
        const left = r.left + REVEAL_CARD_PAD;
        const right = r.left + root.clientWidth - REVEAL_CARD_PAD;
        const visBottom = r.top + root.clientHeight - REVEAL_CARD_PAD;
        const base = boards.map((el) => ({
          el,
          h: el.offsetHeight || el.getBoundingClientRect().height,
          margin: parseFloat(getComputedStyle(el).marginBottom) || 0,
          transform: el.style.transform,
          origin: el.style.transformOrigin,
          mb: el.style.marginBottom,
        }));
        // The lines (text outside the boards) and the panels or clipping boxes round each board.
        const lines = Array.from(card.querySelectorAll<HTMLElement>("*")).filter(
          (el) => ownText(el) && !boards.some((b) => b.contains(el)) && shown(el),
        );
        const holders = boards.map((b) => {
          const out: HTMLElement[] = [];
          for (let p = b.parentElement; p && p !== card && card.contains(p); p = p.parentElement) {
            const cs = getComputedStyle(p);
            const painted =
              (cs.backgroundColor !== "" && cs.backgroundColor !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor)) ||
              cs.backgroundImage !== "none" ||
              cs.boxShadow !== "none" ||
              cs.overflowX !== "visible" ||
              cs.overflowY !== "visible";
            if (painted) out.push(p);
          }
          return out;
        });
        const rect = (el: Element): Box => el.getBoundingClientRect();
        // Boards that already met at full size are left as they are; a line is never drawn over (6 Nov 2026: Mosaic's
        // board overflowed its squeezed box onto "0 / 33 cells", so the fit has to make room, not keep the overlap).
        const touchedAt1 = new Set<string>();
        const holdsAt1 = new Set<string>();
        const boardRects = boards.map(rect);
        boardRects.forEach((b, i) => {
          boardRects.forEach((o, k) => k !== i && overlaps(b, o) && touchedAt1.add(`b${i}:${k}`));
          holders[i]!.forEach((h, k) => inside(b, rect(h)) && holdsAt1.add(`${i}:${k}`));
        });
        const apply = (z: number) => {
          for (const s of base) {
            if (Math.abs(z - 1) < 0.001) {
              s.el.style.transform = s.transform;
              s.el.style.transformOrigin = s.origin;
              s.el.style.marginBottom = s.mb;
            } else {
              s.el.style.transformOrigin = "top center";
              s.el.style.transform = `scale(${z})`;
              s.el.style.marginBottom = `${s.margin + (z - 1) * s.h}px`;
            }
          }
        };
        const fits = (): boolean => {
          const rs = boards.map(rect);
          if (drawn(boards).bottom > visBottom + 0.5) return false;
          for (let i = 0; i < rs.length; i++) {
            const b = rs[i]!;
            if (b.left < left - 0.5 || b.right > right + 0.5) return false;
            for (let k = 0; k < rs.length; k++) if (k !== i && !touchedAt1.has(`b${i}:${k}`) && overlaps(b, rs[k]!)) return false;
            for (let j = 0; j < lines.length; j++) if (!touchedAt1.has(`l${i}:${j}`) && overlaps(b, rect(lines[j]!))) return false;
            const hs = holders[i]!;
            for (let k = 0; k < hs.length; k++) if (holdsAt1.has(`${i}:${k}`) && !inside(b, rect(hs[k]!))) return false;
          }
          return true;
        };
        let lo: number;
        let hi: number;
        if (fits()) {
          lo = 1;
          hi = REVEAL_GROW_MAX;
        } else {
          lo = REVEAL_FIT_MIN;
          hi = 1;
        }
        apply(hi);
        if (hi > 1 && fits()) lo = hi;
        else {
          for (let i = 0; i < 8; i++) {
            const mid = (lo + hi) / 2;
            apply(mid);
            if (fits()) lo = mid;
            else hi = mid;
          }
        }
        const z = Math.abs(lo - 1) <= 0.02 ? 1 : lo;
        for (const s of base) scaled.push({ el: s.el, transform: s.transform, origin: s.origin, margin: s.mb });
        apply(z);
        if (z > 1) root.dataset["grown"] = String(Math.round(z * 100) / 100);
        else if (z < 1) root.dataset["fit"] = "";
      }
      placeTray(boards);
      fitted = `${root.clientWidth}x${root.clientHeight}:${card.scrollHeight}`;
    };
    fit();
    const later = () => {
      if (`${root.clientWidth}x${root.clientHeight}:${card.scrollHeight}` === fitted) return;
      if (!frame) frame = requestAnimationFrame(fit);
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(later);
    resize?.observe(root);
    resize?.observe(card);
    for (const child of Array.from(card.children)) resize?.observe(child);
    const mutations = new MutationObserver(() => {
      for (const child of Array.from(card.children)) resize?.observe(child);
      if (!frame) frame = requestAnimationFrame(fit);
    });
    // The Solution / Yours switch shows (and flips) by attribute: refit then too.
    mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "data-solution-switch", "data-solution-view"] });
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutations.disconnect();
      reset();
    };
  }, []);
}

/**
 * Timed games with nothing to solve (3 Nov 2026, Joe's audit: Flash and Bang On said "Solved in 60.0 s" on tiny
 * scores): their reveal says "Finished", never Solved / Not solved, and shows no tick or cross. Tenfall, Bonk, Mixed
 * Signals and Pull! join them now they take the puzzle reveal; Nucleus and Forage, open games with nothing to finish,
 * since 4 Nov 2026 (they said "Solved in 99.5 s" over "171 for progress").
 */
export const FINISH_ONLY_TYPES: ReadonlySet<string> = new Set(["reaction", "stopwatch", "tendrop", "whack", "stroop", "clayshoot", "wordsmith", "wordhunt"]);

/**
 * Engine games in puzzle categories (Speed, Number) that used the arcade reveal: they take the puzzle reveal (verdict,
 * score, their stored breakdown) from 3 Nov 2026. Display only.
 */
export const PUZZLE_REVEAL_ENGINE_TYPES: ReadonlySet<string> = new Set(["tendrop", "whack", "stroop", "clayshoot"]);

/**
 * Puzzles whose own Reveal writes the stored score parts: none since 4 Nov 2026 (Blackout, Turntable and Colour Flood
 * showed them twice): every puzzle's line is the one above the board; solvedMovesText keeps the moves.
 */
const REVEAL_SHOWS_PARTS: ReadonlySet<string> = new Set<string>();

/** The verdict in sentence case, so units stay lowercase: "Solved in 53.2 s", "Partly solved", "Not solved". */
function verdictLine(correct: boolean, score: number | null, msRemaining: number | undefined, limitMs: number, type?: string): string {
  if (type && FINISH_ONLY_TYPES.has(type)) return score === null ? "Scoring…" : "Finished";
  if (score === null && !correct) return "Scoring…";
  if (correct) {
    const used = Math.max(0, limitMs - (msRemaining ?? 0));
    return msRemaining === undefined || used <= 0 ? "Solved" : `Solved in ${(used / 1000).toFixed(1)} s`;
  }
  return score !== null && score > 0 ? "Partly solved" : "Not solved";
}

/** An engine game's stored breakdown on the puzzle reveal: open in practice, behind "See breakdown" in a room. */
/** Stats the engine rows already state (engineBreakdown.ts): left out under them. */
const ENGINE_ROW_TILES: ReadonlySet<string> = new Set(["Wrong colour", "Hedgehogs", "Empty taps", "Birds hit", "Correct", "Best streak", "Bonus", "Wrong"]);

function EngineBreakdown({ type, extra, score, practice, costRows, open, setOpen, rev }: { type: string; rev?: number | undefined; extra: Record<string, unknown> | null; score: number | null; practice: boolean; costRows: { label: string; value: string }[]; open: boolean; setOpen: (f: (v: boolean) => boolean) => void }) {
  const stored = (extra?.["reveal"] as ArcadeRevealData | undefined) ?? null;
  if (!stored || score === null) return null;
  // Each fact once (4 Nov 2026, Joe's review: Tenfall said "9 of 10 targets" three times): the stored lines in plain
  // words with no pre-curve "points", then only the stats they don't already state.
  // Bonk, Pull! and Mixed Signals (6 Nov 2026): rows that add up to the score, costs included, when the stored counts
  // give exactly the stored score (engineBreakdown.ts); else the stored lines as before.
  const scored = engineScoreLines(type, extra, stored.lines, score, rev);
  const reveal = { ...stored, lines: scored ?? engineLines(type, stored.lines) };
  const shown = revealShown(reveal, score);
  const tiles = scored
    ? shown.tiles.filter((t) => !ENGINE_ROW_TILES.has(t.label) && !statRepeatsPart(t.label, shown.lines)).slice(0, 4)
    : [...shown.tiles.filter((t) => !statRepeatsPart(t.label, shown.lines)).slice(0, 4), ...costRows.filter((t) => t.value !== "0")];
  return (
    <div data-engine-breakdown="" className="flex shrink-0 flex-col items-center gap-1">
      {practice ? null : (
        <Button
          variant="secondary"
          size={44}
          data-reveal-summary={open ? "open" : "closed"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="reveal-see-breakdown"
        >
          <span className="reveal-see-breakdown-label">{open ? "Hide breakdown" : "See breakdown"}</span>
        </Button>
      )}
      <RevealBreakdown lines={shown.lines} score={score} extra={tiles} hidden={!practice && !open} />
    </div>
  );
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
      <span className="reveal-meta min-w-0 flex-1 truncate">
        {finished} of {players.length} finished, results in {secondsLeft}s
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
    <p ref={scoreRef} data-reveal-score={score} className="jz-score-m shrink-0 whitespace-nowrap text-foreground animate-pop-in">
      {score === 1 ? "1 point" : `${score} points`}
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
          {myScore === null ? "No score" : `${myScore} ${myScore === 1 ? "point" : "points"}`}
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
  starLine = null,
  heroRun: heroRunAllowed = true,
  startedAt,
  now,
  onPlayAgain,
  onBack,
}: AnswerRevealProps) {
  const practiceActions = practice && (onPlayAgain || onBack);
  const [engineOpen, setEngineOpen] = useState(false);
  const secondsLeft = Math.max(
    0,
    Math.ceil((puzzleRevealMs(puzzle) - Math.max(0, now - startedAt)) / 1000),
  );
  const def = puzzleDef(puzzle.type);
  const Reveal = def.Reveal;
  // Puzzle polish (3 Nov 2026): Don't Break the Chain takes the shared verdict row like every other puzzle (it hid the
  // mark and heading before); no puzzle owns the layout now.
  const puzzleOwnsRevealLayout = false as boolean;
  // Haptics (lib/haptics.ts) never play over a reveal: its boards, replays and verdict cues hold them.
  useIsoLayoutEffect(() => holdHaptics(), []);
  const cued = useRef(0);
  const scoreCue = useRef<number | undefined>(undefined);
  const solvedBoard = useRef<HTMLDivElement>(null);
  useSolveFlourish(solvedBoard, puzzle.type, answersReady && myScore !== null && myCorrect);
  useRevealLabels(solvedBoard);
  const revealCard = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  useRevealFit(solvedBoard, revealCard, trayRef);
  useRevealMore(solvedBoard);

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
  const revealRoot = useRef<HTMLDivElement>(null);
  /** The hero's reserved strip (above the score), shown only when this score earns a hero moment. */
  const heroSpot = celebrate && heroRunAllowed && heroRunEarned(myScore);
  // Practice: this device's best for the game under today's stamps (read once the score has landed and been recorded).
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    if (!practice || myScore === null) return;
    const id = window.setTimeout(() => setBest(readPracticeBest(puzzle.type, stampSignature(puzzle))), 0);
    return () => window.clearTimeout(id);
  }, [practice, myScore, puzzle]);
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
      // The reserved spot (3 Nov 2026): the hero keeps to its own strip, never over a board, a line or a button.
      const spot = revealRoot.current?.querySelector("[data-hero-spot]") ?? null;
      if (moment === "grand") heroGrand(scope, spot);
      else if (moment === "dance") heroDance(scope, spot);
      else heroRun(scope, spot);
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
    <div ref={revealRoot} data-skin="room" data-answer-reveal data-hero-earned={heroSpot ? "" : undefined} className="relative flex min-h-0 flex-1 flex-col gap-2.5 px-3 text-left animate-phase-in">
      {/* Practice's new best (arcade too); rooms keep ArcadeReveal's room-best record. */}
      {practice && (personalBest || starLine) && myScore !== null ? <NewBestMoment starLine={starLine} /> : null}
      {/* Its own screen (3 Nov 2026): this row is the screen's header (no app top bar), so the sound button sits here. */}
      <div data-reveal-head className="rs-head shrink-0 items-center">
        <span className="reveal-title min-w-0 truncate">{def.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          <MetaChips
            data-reveal-meta
            facts={practice ? (practiceActions ? ["Practice"] : ["Practice", `${secondsLeft}s`]) : [`Round ${round} of ${totalRounds}`, `${secondsLeft}s`]}
          />
          <MuteToggle variant="speaker" />
        </span>
      </div>

      {ARCADE_REVEAL_RENDERERS[puzzle.type] && !PUZZLE_REVEAL_ENGINE_TYPES.has(puzzle.type) ? (
        <ArcadeReveal
          practice={practice}
          best={best}
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
        {/* The hero's reserved strip (3 Nov 2026): only when the score earns a hero moment, above the verdict. */}
        {heroSpot ? <div data-hero-spot="" aria-hidden="true" className="reveal-hero-spot shrink-0" /> : null}
        {/* The verdict row: the mark in the category colour, "Solved in 53.2 s" in sentence case, the score in white. */}
        <div data-verdict-row className="flex shrink-0 items-center gap-3 px-1">
          {!puzzleOwnsRevealLayout && !FINISH_ONLY_TYPES.has(puzzle.type) ? <Verdict correct={myCorrect} score={myScore} /> : null}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="reveal-verdict truncate">
              {verdictLine(myCorrect, myScore, myMsRemaining, puzzleTimeLimitMs(puzzle), puzzle.type)}
            </span>
            {!puzzleOwnsRevealLayout ? (
              <span data-reveal-heading className="reveal-meta truncate">
                {def.revealHeading ?? "The answer was"}
              </span>
            ) : null}
          </span>
          <StoredScore score={myScore} type={puzzle.type} />
        </div>
        {/* One score line on every puzzle reveal (3 Nov 2026): the stored parts, "150 + 20 par + 30 speed". */}
        {myScore !== null && storedScoreParts(myExtra) && !REVEAL_SHOWS_PARTS.has(puzzle.type) && !(FINISH_ONLY_TYPES.has(puzzle.type) && storedScoreParts(myExtra)!.kind === "partial") ? (
          <p data-reveal-score-line="" className="reveal-score-line shrink-0 text-center">
            {scorePartsText(storedScoreParts(myExtra)!)}
          </p>
        ) : null}
        {practice && myScore !== null ? (
          <p data-reveal-best="" className="reveal-meta shrink-0 text-center">
            {best === null ? "First go at this one" : `Your best: ${best}`}
          </p>
        ) : null}
        {/* Engine games on the puzzle reveal: their stored breakdown, open (practice) or one tap away (rooms). */}
        {PUZZLE_REVEAL_ENGINE_TYPES.has(puzzle.type) ? (
          <EngineBreakdown type={puzzle.type} rev={puzzle.type === "clayshoot" ? puzzle.clayRev : undefined} open={engineOpen} setOpen={setEngineOpen} extra={myExtra ?? null} score={myScore} practice={practice} costRows={storedCostRows(puzzle.type, myExtra, puzzle.type === "clayshoot" ? puzzle.clayRev : undefined)} />
        ) : null}
        {/* Shared near-miss line; nearMiss() returns null for every puzzle type without one. */}
        {myScore !== null && nearMiss(puzzle.type, myExtra) ? (
          <p className="shrink-0 text-center text-sm font-semibold text-foreground">{nearMiss(puzzle.type, myExtra)}</p>
        ) : null}
        {/* The board keeps its box (flex-1, as before); the tray behind its card hugs what the card draws (useRevealFit). */}
        <div ref={solvedBoard} data-skin-off className="answer-reveal-content relative isolate flex w-full min-h-0 flex-1 flex-col items-center justify-start overflow-x-hidden overflow-y-auto text-base animate-rise-settle">
          <div ref={trayRef} aria-hidden="true" data-reveal-tray className="reveal-tray" />
          {answersReady ? <SolutionSwitch type={puzzle.type} root={solvedBoard} /> : null}
          {/* The card: the game's board and every line it draws, measured and scaled as one (useRevealFit). */}
          <div ref={revealCard} data-reveal-card="" className="reveal-card">
          {/* An engine game's own summary line only while its breakdown is folded away (a room's "See breakdown"). */}
          {answersReady && !(PUZZLE_REVEAL_ENGINE_TYPES.has(puzzle.type) && myScore !== null && (practice || engineOpen)) ? (
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
          ) : !answersReady ? (
            <div data-reveal-waiting="" className="flex justify-center">
              <WaitingLine label="Revealing" />
            </div>
          ) : null}
          </div>
        </div>
        {players && players.length > 1 ? <RevealPlayers players={players} secondsLeft={secondsLeft} /> : null}
      </div>
      )}
      {practiceActions ? <PracticeRevealActions onPlayAgain={onPlayAgain} onBack={onBack} /> : null}
      <DevDiagnostics extra={myExtra ?? null} />
    </div>
  );
}
