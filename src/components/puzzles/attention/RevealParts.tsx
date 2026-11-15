/**
 * The Attention reveals' shared parts (the Attention overhaul, 15 Nov 2026; Joe's reveal brief): presentation only.
 * Each game's own Reveal draws its solution large, one board at a time (`RevealTabs` switches between boards), the
 * player's answer against the right one with what was missed or wrong marked (`RevealLegend` names the marks), and
 * the few numbers that explain the score as big tiles (`RevealStats`). They sit inside the shared answer reveal
 * (AnswerReveal: the result card, then the game's own Reveal), and never read a score of their own: every number is
 * from the stored answer, the stored puzzle or the stored extra.
 */
import type { ReactNode } from "react";

import { Segmented } from "@/design/components/Segmented";
import "@/polish-attention/attention-overhaul.css";

export interface RevealStat {
  id: string;
  label: string;
  value: ReactNode;
  /** good: the number counts for you; bad: against you; none: plain. */
  tone?: "good" | "bad" | undefined;
}

/** The numbers that explain the score: two to four tiles, label above, a big number below. */
export function RevealStats({ items, game }: { items: (RevealStat | null | false | undefined)[]; game: string }) {
  const shown = items.filter((s): s is RevealStat => !!s);
  return (
    <div className="attn-rv-stats" data-attn-reveal-stats={game} style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map((s) => (
        <div key={s.id} className="attn-rv-stat" data-attn-stat={s.id} data-tone={s.tone}>
          <span className="attn-rv-stat-label">{s.label}</span>
          <span className="attn-rv-stat-value">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

/** One board at a time: a switch between the round's boards (grids, pictures, trays) or two views of one. */
export function RevealTabs<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; tone?: "good" | "bad" | undefined }[];
  onChange: (value: T) => void;
}) {
  return (
    <Segmented
      label={label}
      radio
      value={value}
      onChange={onChange}
      className="attn-rv-tabs"
      options={options.map((o) => ({ value: o.value, label: o.label, data: { "data-attn-tab": String(o.value), "data-tone": o.tone } }))}
    />
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
