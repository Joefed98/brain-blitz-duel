import { useEffect, useRef, type ReactNode } from "react";

import { countUpText, gameFx } from "@/lib/fx/kit";
import { prefersReducedMotion } from "@/lib/motion";
import { demoHushed, playSlotOr } from "@/lib/sound";

import "@/polish-word/word-look.css";
import "@/polish-word/word-reveal.css";

/**
 * The Word games' answer reveal kit (the Word overhaul, 15 Nov 2026, Joe's reveal brief): clear, big and legible on a
 * phone inside the shared reveal layout. The solution drawn large (one board at a time: a `BoardPair` puts the
 * "Solution" and "Yours" columns the shared Solution / Yours switch, SolutionSwitch.tsx, shows one at a time), your
 * answer against the correct one with misses and mistakes marked, short plain labels, the numbers that explain the
 * score, and pictures in place of dense text lists. Display only: every figure comes from the stored answer, the
 * stored extra or the puzzle's public and revealed halves.
 */

export interface RevealNumber {
  label: string;
  value: ReactNode;
  tone?: "gold" | "warn" | "good" | undefined;
  /** A hook for checks (`data-wr-number`). */
  id?: string | undefined;
}

/** The numbers that explain the score: a row of big value tiles, each with a short plain label under it. */
export function RevealNumbers({ items, countAfterMs }: {
  items: ReadonlyArray<RevealNumber | null | false | undefined>;
  /**
   * Stage 2's round end: the numeric values count up from 0 once the found words have dropped in (this many ms
   * after the reveal opens). The markup always holds the final number (screen readers, checks, reduced motion).
   */
  countAfterMs?: number;
}) {
  const shown = items.filter((i): i is RevealNumber => !!i);
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (countAfterMs === undefined || prefersReducedMotion()) return;
    const stops: (() => void)[] = [];
    const timer = window.setTimeout(() => {
      root.current?.querySelectorAll<HTMLElement>("[data-wr-count]").forEach((el, k) => {
        const to = Number(el.dataset["wrCount"]);
        if (Number.isFinite(to) && to > 0) stops.push(countUpText(el, 0, to, { silent: k > 0 || demoHushed() }));
      });
    }, countAfterMs);
    return () => {
      window.clearTimeout(timer);
      stops.forEach((stop) => stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={root} data-wr-numbers="" className="wr-numbers" style={{ gridTemplateColumns: `repeat(${Math.min(4, shown.length)}, minmax(0, 1fr))` }}>
      {shown.map((n) => (
        <div key={n.id ?? n.label} data-wr-number={n.id ?? n.label} data-tone={n.tone} className="wr-num">
          <span className="wr-num-value" data-wr-count={countAfterMs !== undefined && typeof n.value === "number" ? n.value : undefined}>{n.value}</span>
          <span className="wr-num-label">{n.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Stage 2's round end: how long the found words take to drop in (a chip every DROP_STEP_MS, up to 12 of them). */
export const DROP_STEP_MS = 90;
export const dropEndsMs = (chips: number) => Math.min(chips, 12) * DROP_STEP_MS + 260;

/** A short plain section label ("You missed", "Your words"). */
export function RevealLabel({ children }: { children: ReactNode }) {
  return <p className="wr-label">{children}</p>;
}

/** A headline line in big type ("4 words", "Cracked"). */
export function RevealHeadline({ children }: { children: ReactNode }) {
  return <p data-wr-headline="" className="wr-headline">{children}</p>;
}

export type ChipKind = "found" | "longest" | "missed" | "bonus" | "wrong";

export interface RevealChip {
  text: string;
  /** A small figure after the word (its points). */
  sub?: string | number | undefined;
  kind: ChipKind;
}

/**
 * Words as chips that wrap to whole words: found plain, the longest gold, missed outlined, wrong red. With `drop`
 * (stage 2's round end) the found words drop in one by one with a soft tick and the longest lands on its gold chip
 * with its own note (`shared.wordDrop`, `shared.wordLongest`, the shared tick until Joe's files); every chip ends
 * visible, and under reduced motion nothing moves.
 */
export function RevealChips({ items, id, drop = false }: { items: readonly RevealChip[]; id?: string; drop?: boolean }) {
  const root = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    if (!drop || demoHushed()) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    items.slice(0, 12).forEach((chip, i) => {
      if (chip.kind === "missed" || chip.kind === "wrong") return;
      timers.push(
        setTimeout(() => {
          if (chip.kind === "longest") {
            playSlotOr("shared.wordLongest", "tick", 0.7);
            gameFx("combo", root.current?.children[i] as HTMLElement | undefined, { count: 1, silent: true, inGame: false });
          } else playSlotOr("shared.wordDrop", "tick", 0.45);
        }, i * DROP_STEP_MS),
      );
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ul ref={root} data-wr-chips={id ?? ""} data-wr-drop={drop ? "" : undefined} className="wr-chips">
      {items.map((c, i) => (
        <li key={`${c.text}-${i}`} data-kind={c.kind} className="wr-chip" style={drop ? { ["--wd-i" as string]: Math.min(i, 12) } : undefined}>
          <span>{c.text}</span>
          {c.sub !== undefined && c.sub !== "" ? <span className="wr-chip-sub">{c.sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Board sizes from the reveal template's stage (the polish plan's G2, 21 Nov 2026): the stage is an inline-size container
 * (RevealScreen.tsx), so a board's cell is the stage's width less the card's 12 px padding each side and the board's own
 * gaps and edges, shared by its columns, capped at `max`. Outside the stage `cqw` falls back to the small viewport's
 * width. A number keeps the old fixed size, so the live boards and the older reveals draw exactly as before.
 */
export type CellSize = number | string;
const REVEAL_CARD_PAD = 24;
export function stageCell(cols: number, around: number, max: number): string {
  return `min(${max}px, calc((100cqw - ${REVEAL_CARD_PAD + around}px) / ${cols}))`;
}
/** A cell size as a CSS length. */
export const cellCss = (c: CellSize) => (typeof c === "number" ? `${c}px` : c);
/** A font size as a share of the cell (the old rounding for a number). */
export const cellFont = (c: CellSize, k: number): number | string => (typeof c === "number" ? Math.round(c * k) : `calc(${c} * ${k})`);
/** The stage's width less the card's padding, capped at `max` px (a board drawn at the stage's width). */
export const stageWidth = (max: number) => `min(${max}px, calc(100cqw - ${REVEAL_CARD_PAD}px))`;

export type TileTone = "black" | "gold" | "teal" | "grey" | "red" | "dim" | "sapphire" | "well";

/** A word as a row of rendered tiles (its letters live text), each tile its own tone. */
export function TileRow({ letters, tones, size = 34, id }: { letters: readonly string[]; tones?: readonly TileTone[]; size?: CellSize; id?: string }) {
  return (
    <div data-wr-tiles={id ?? ""} className="wr-tiles" style={{ gap: typeof size === "number" ? Math.max(2, Math.round(size / 12)) : 4 }}>
      {letters.map((l, i) => {
        const tone = tones?.[i] ?? "black";
        return (
          <span
            key={i}
            data-wa={tone === "well" ? "well" : "tile"}
            data-wa-tone={tone === "well" ? undefined : tone}
            className="wr-tile"
            style={{ width: size, height: size, fontSize: cellFont(size, 0.56) }}
          >
            {l}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The solution and the player's board as two labelled columns; the shared Solution / Yours switch (the game listed in
 * SOLUTION_SWITCH_TYPES) shows one at a time, full width, and the reveal's fit grows it into the space.
 */
export function BoardPair({ solution, yours }: { solution: ReactNode; yours: ReactNode }) {
  return (
    <div data-wr-pair="" className="wr-pair">
      <div className="wr-pair-col">
        <span className="wr-label">Solution</span>
        {solution}
      </div>
      <div className="wr-pair-col">
        <span className="wr-label">Yours</span>
        {yours}
      </div>
    </div>
  );
}

/** A key under a board: what each colour means, as small swatches with plain words. */
export function RevealKey({ items }: { items: ReadonlyArray<{ tone: TileTone; label: string } | null | false> }) {
  return (
    <div data-wr-key="" className="wr-key">
      {items
        .filter((i): i is { tone: TileTone; label: string } => !!i)
        .map((i) => (
          <span key={i.label} className="wr-key-item">
            <span data-wa={i.tone === "well" ? "well" : "tile"} data-wa-tone={i.tone === "well" ? undefined : i.tone} className="wr-key-swatch" />
            {i.label}
          </span>
        ))}
    </div>
  );
}

/** Plural helper for the labels ("1 word", "3 words"). */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
