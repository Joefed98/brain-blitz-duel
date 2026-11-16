/**
 * The Sports reveals' shared parts (15 Nov 2026, the Home Run and Top Bins overhaul): a row of big label-and-value
 * stats that explain the score, and a short legend. Presentation only; numbers come from the stored run's replay.
 * The effects are #422's kit (docs/design/game-fx/README.md): the numbers count up (`FxCountUp`, silent: the arcade
 * reveal's own score counts with sound) and the run's marks land in turn (`useLandInTurn`, the kit's "drop").
 */
import { useEffect, useRef, type ReactNode } from "react";

import { FxCountUp } from "@/components/fx/GameFx";
import { gameFx } from "@/lib/fx/kit";

const TILE = { borderRadius: "var(--jz-radius-md)", background: "var(--jz-surface)" } as const;

export interface RevealStat {
  label: string;
  /** A number counts up (the kit's count-up); text is shown as it is. */
  value: number | string;
  /** Shown after a counted number ("ft"). */
  unit?: string;
  gold?: boolean;
}

/** Key numbers in a wrapping row of tiles, each a big value over a short plain label. */
export function RevealStats({ stats }: { stats: readonly RevealStat[] }) {
  return (
    <div className="grid w-full grid-cols-3 gap-2" data-reveal-stats>
      {stats.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col items-center px-1 py-2" style={TILE}>
          <span className="font-black leading-tight" style={{ fontSize: 22, color: s.gold ? "var(--jz-gold)" : "var(--jz-text)" }}>
            {typeof s.value === "number" ? (
              <>
                <FxCountUp value={s.value} silent data-reveal-stat-value={s.value} />
                {s.unit ? ` ${s.unit}` : null}
              </>
            ) : (
              s.value
            )}
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

/** The first landing's wait (after the reveal's own fade-in) and the step between marks. */
export const LAND_FIRST_MS = 260;
export const LAND_STEP_MS = 70;

/**
 * The run's marks landing one after another, in the order they happened (the kit's "drop", silent, never in game):
 * call `land(i)` as each mark's ref. Every mark is in its final place in the markup; the kit only draws the landing,
 * so reduced motion, a server render and a screenshot all show the finished picture. SVG marks need
 * `transform-box: fill-box` (LAND_SVG_STYLE) so the squash is about the mark itself.
 */
export function useLandInTurn(): (i: number) => (el: Element | null) => void {
  const marks = useRef<(Element | null)[]>([]);
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    marks.current.forEach((el, i) => {
      if (el) gameFx("drop", el, { silent: true, inGame: false, delayMs: LAND_FIRST_MS + i * LAND_STEP_MS });
    });
  }, []);
  return (i) => (el) => void (marks.current[i] = el);
}

/** What an SVG mark needs for the kit's transforms to act about its own centre. */
export const LAND_SVG_STYLE = { transformBox: "fill-box", transformOrigin: "center" } as const;
