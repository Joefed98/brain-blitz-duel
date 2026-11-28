/**
 * The Attention reveals' shared parts (the Attention overhaul, 15 Nov 2026; Joe's reveal brief): presentation only.
 * Each game's own Reveal draws its solution large, one board at a time, the
 * player's answer against the right one with what was missed or wrong marked (`RevealLegend` names the marks), and
 * the few numbers that explain the score as big tiles (`RevealStats`). They sit inside the shared answer reveal
 * (AnswerReveal: the result card, then the game's own Reveal), and never read a score of their own: every number is
 * from the stored answer, the stored puzzle or the stored extra.
 *
 * Since the reveal template (the polish plan's G6, 21 Nov 2026; the switch moved onto the template's own views control
 * on 27 Nov 2026, through `useRevealViews`, each board's tab marked right or wrong, opening on the first one wrong) the
 * switch between boards is the template's and the numbers are the template's facts strip (`FactTiles`' markup and classes), so an Attention reveal reads as every other game's; the
 * boards take their size from the template's stage (`cqw`, attention-overhaul.css). Every Attention attribute is kept.
 */
import type { ReactNode } from "react";

import "@/polish-attention/attention-overhaul.css";

export interface RevealStat {
  id: string;
  label: string;
  value: ReactNode;
  /** good: the number counts for you; bad: against you; none: plain. */
  tone?: "good" | "bad" | undefined;
}

/** The numbers that explain the score: two to four tiles, a big number over its label (the template's facts strip). */
export function RevealStats({ items, game }: { items: (RevealStat | null | false | undefined)[]; game: string }) {
  const shown = items.filter((s): s is RevealStat => !!s);
  return (
    <div
      className="reveal-facts attn-rv-stats"
      data-reveal-facts=""
      data-attn-reveal-stats={game}
      style={{ ["--reveal-facts-n" as string]: Math.min(4, Math.max(1, shown.length)) }}
    >
      {shown.map((s) => (
        <div key={s.id} className="reveal-fact attn-rv-stat" data-attn-stat={s.id} data-tone={s.tone}>
          <b className="reveal-fact-value attn-rv-stat-value">{s.value}</b>
          <span className="reveal-fact-label attn-rv-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export type RevealMark = "found" | "wrong" | "missed" | "route" | "trail" | "dim";

/** The marks on the board, named once in short plain words. */
export function RevealLegend({ items }: { items: { mark: RevealMark; label: string }[] }) {
  return (
    <ul className="attn-rv-legend" aria-label="Key">
      {items.map((it) => (
        <li key={it.mark} data-attn-mark={it.mark}>
          <span className="attn-rv-swatch" aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
