import type { ReactNode } from "react";

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
export function RevealNumbers({ items }: { items: ReadonlyArray<RevealNumber | null | false | undefined> }) {
  const shown = items.filter((i): i is RevealNumber => !!i);
  return (
    <div data-wr-numbers="" className="wr-numbers" style={{ gridTemplateColumns: `repeat(${Math.min(4, shown.length)}, minmax(0, 1fr))` }}>
      {shown.map((n) => (
        <div key={n.id ?? n.label} data-wr-number={n.id ?? n.label} data-tone={n.tone} className="wr-num">
          <span className="wr-num-value">{n.value}</span>
          <span className="wr-num-label">{n.label}</span>
        </div>
      ))}
    </div>
  );
}

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

/** Words as chips that wrap to whole words: found plain, the longest gold, missed outlined, wrong red. */
export function RevealChips({ items, id }: { items: readonly RevealChip[]; id?: string }) {
  return (
    <ul data-wr-chips={id ?? ""} className="wr-chips">
      {items.map((c, i) => (
        <li key={`${c.text}-${i}`} data-kind={c.kind} className="wr-chip">
          <span>{c.text}</span>
          {c.sub !== undefined && c.sub !== "" ? <span className="wr-chip-sub">{c.sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export type TileTone = "black" | "gold" | "teal" | "grey" | "red" | "dim" | "sapphire" | "well";

/** A word as a row of rendered tiles (its letters live text), each tile its own tone. */
export function TileRow({ letters, tones, size = 34, id }: { letters: readonly string[]; tones?: readonly TileTone[]; size?: number; id?: string }) {
  return (
    <div data-wr-tiles={id ?? ""} className="wr-tiles" style={{ gap: Math.max(2, Math.round(size / 12)) }}>
      {letters.map((l, i) => {
        const tone = tones?.[i] ?? "black";
        return (
          <span
            key={i}
            data-wa={tone === "well" ? "well" : "tile"}
            data-wa-tone={tone === "well" ? undefined : tone}
            className="wr-tile"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.56) }}
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
