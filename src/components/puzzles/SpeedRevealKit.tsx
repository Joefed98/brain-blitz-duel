import type { ReactNode } from "react";

import "@/polish-speed/speed-reveal.css";

/**
 * The Speed overhaul's reveal pieces (Joe, 15 Nov 2026; display only): each Speed game's own part of the answer reveal,
 * inside the shared reveal layout. Big, plain numbers that explain the score (`RevealNumbers`), pictures of the run in
 * place of text lists (`RevealPips`, `RevealBars`) and one short caption under a picture (`RevealCaption`). Labels are
 * short words, never a "×" or a count that reads as describing the solution.
 */
export interface RevealNumber {
  id: string;
  label: string;
  value: ReactNode;
  /** gold: the headline figure; good / warn: a clean or a costly figure. */
  tone?: "gold" | "good" | "warn" | undefined;
}

/**
 * Two to four big figures, each a large value over a short label. Since the reveal template (the polish plan's G6, 21
 * Nov 2026) they are the template's facts strip (`FactTiles`' markup and classes: `data-reveal-facts`, `.reveal-fact`),
 * so a Speed reveal's numbers read as every other game's; the Speed attributes and tones are kept.
 */
export function RevealNumbers({ items, testId }: { items: readonly (RevealNumber | false | null | undefined)[]; testId: string }) {
  const shown = items.filter((i): i is RevealNumber => !!i);
  return (
    <div
      data-speed-reveal-numbers={testId}
      data-reveal-facts=""
      className="reveal-facts sr-numbers"
      data-count={shown.length}
      style={{ ["--reveal-facts-n" as string]: Math.min(4, Math.max(1, shown.length)) }}
    >
      {shown.map((item) => (
        <div key={item.id} data-reveal-number={item.id} data-tone={item.tone} className="reveal-fact sr-number">
          <b className="reveal-fact-value sr-number-value">{item.value}</b>
          <span className="reveal-fact-label sr-number-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export type PipState = "hit" | "gold" | "miss" | "wrong" | "empty" | "break";

/** One pip per item in order (clays, links, targets): filled for made, hollow for missed, red for wrong. */
export function RevealPips({ pips, testId, label, groups = 0 }: { pips: readonly PipState[]; testId: string; label: string; groups?: number }) {
  return (
    <ol data-speed-reveal-pips={testId} aria-label={label} className="sr-pips" data-groups={groups || undefined}>
      {pips.map((state, i) => (
        <li key={i} data-pip={state} className="sr-pip" />
      ))}
    </ol>
  );
}

export interface RevealBar {
  /** 0–1: the bar's height. */
  share: number;
  /** The figure printed over the bar (short). */
  text: string;
  tone: "gold" | "good" | "slow" | "miss";
  label: string;
}

/** A small bar chart (Flash's reactions): one bar per item, its figure over it. */
export function RevealBars({ bars, testId, label }: { bars: readonly RevealBar[]; testId: string; label: string }) {
  return (
    <ol data-speed-reveal-bars={testId} aria-label={label} className="sr-bars">
      {bars.map((bar, i) => (
        <li key={i} aria-label={bar.label} className="sr-bar" data-tone={bar.tone} style={{ ["--sr-i" as string]: i }}>
          <span className="sr-bar-text">{bar.text}</span>
          <span className="sr-bar-track">
            <span className="sr-bar-fill" style={{ height: `${Math.round(Math.max(0.06, Math.min(1, bar.share)) * 100)}%` }} />
          </span>
          <span className="sr-bar-index">{i + 1}</span>
        </li>
      ))}
    </ol>
  );
}

/** One short line under a picture. */
export function RevealCaption({ children, tone }: { children: ReactNode; tone?: "warn" | "good" | undefined }) {
  return (
    <p className="sr-caption" data-tone={tone}>
      {children}
    </p>
  );
}

/** A titled block of the reveal (a picture with its caption). */
export function RevealPanel({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  return (
    <section data-speed-reveal-panel={testId} className="sr-panel">
      <h3 className="sr-panel-title">{title}</h3>
      {children}
    </section>
  );
}
