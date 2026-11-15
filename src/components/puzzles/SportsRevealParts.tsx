/**
 * The Sports reveals' shared parts (15 Nov 2026, the Home Run and Top Bins overhaul): a row of big label-and-value
 * stats that explain the score, and a short legend. Presentation only; numbers come from the stored run's replay.
 */
import type { ReactNode } from "react";

const TILE = { borderRadius: "var(--jz-radius-md)", background: "var(--jz-surface)" } as const;

export interface RevealStat {
  label: string;
  value: string;
  gold?: boolean;
}

/** Key numbers in a wrapping row of tiles, each a big value over a short plain label. */
export function RevealStats({ stats }: { stats: readonly RevealStat[] }) {
  return (
    <div className="grid w-full grid-cols-3 gap-2" data-reveal-stats>
      {stats.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col items-center px-1 py-2" style={TILE}>
          <span className="font-black leading-tight" style={{ fontSize: 22, color: s.gold ? "var(--jz-gold)" : "var(--jz-text)" }}>
            {s.value}
          </span>
          <span className="truncate font-bold" style={{ fontSize: 12, color: "var(--jz-text-2)", maxWidth: "100%" }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A legend row: small coloured marks with their meanings. */
export function RevealLegend({ items }: { items: readonly { mark: ReactNode; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-semibold" style={{ fontSize: 13, color: "var(--jz-text-2)" }}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.mark}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** A legend dot (a token colour, or hollow). */
export function Dot({ colour, hollow = false }: { colour: string; hollow?: boolean }) {
  return (
    <svg width={12} height={12} aria-hidden="true">
      <circle cx={6} cy={6} r={4.5} fill={hollow ? "none" : colour} stroke={colour} strokeWidth={2} />
    </svg>
  );
}
