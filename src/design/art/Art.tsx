/**
 * The approved reward art as components (Joulz art v1, docs/art/README.md; design foundation F5, 6 Nov 2026):
 * Emblem, Trophy and Badge, inline SVG drawn from markup.ts (gen.py's geometry, token colours). The medal is the
 * shared Medal component (src/design/components/Medal.tsx), which draws `MedalArt` from here.
 *
 * Each piece is one element with role="img" and a label; its SVGs are hidden from screen readers. `size` is the
 * width in px; the height follows the piece's own viewBox.
 */
import { useId, useMemo } from "react";

import {
  BADGE_BOX,
  EMBLEM_BOX,
  MEDAL_BOX,
  PIPS_BOX,
  TROPHY_BOX,
  TROPHY_LEVEL,
  badge,
  defs,
  emblem,
  founderNumber,
  idPrefix,
  medal,
  pips,
  styled,
  trophy,
  type BadgeKind,
  type MedalMetal,
  type Tier,
  type TrophyKind,
} from "./markup";

type Box = { x: number; y: number; w: number; h: number };

/** One SVG of a piece at `width` px (its height from the box), the markup styled once per id and inputs. */
function ArtSvg({ box, width, markup }: { box: Box; width: number; markup: string }) {
  // One object per markup: React 19 rewrites dangerouslySetInnerHTML whenever the object changes, so a fresh one each
  // render redrew every medal on each room clock tick (battery-check).
  const inner = useMemo(() => ({ __html: styled(markup) }), [markup]);
  const height = Math.round(((width * box.h) / box.w) * 10) / 10;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={inner}
    />
  );
}

function usePrefix(): string {
  return idPrefix(useId());
}

/* ------------------------------------------------------------------ Emblem */

export const TIER_NAMES: Record<Tier, string> = {
  spark: "Spark",
  charge: "Charge",
  volt: "Volt",
  surge: "Surge",
  storm: "Storm",
  lightning: "Lightning",
};
const ROMAN = ["", "I", "II", "III"] as const;

/** "Volt II", "Lightning #37", "Spark". */
export function emblemLabel(tier: Tier, division?: 1 | 2 | 3, rank?: number): string {
  if (tier === "lightning") return rank ? `Lightning #${rank}` : "Lightning";
  return division ? `${TIER_NAMES[tier]} ${ROMAN[division]}` : TIER_NAMES[tier];
}

/**
 * A rank emblem: the shield in its tier's metal. Below it (`marker`, on by default when there is something to
 * show) the division's three diamonds, filled gold as earned (division III one, II two, I all three), or for
 * Lightning its numbered rank. At standings size (28 px) pass `marker={false}` and show the name beside it.
 */
export function Emblem({
  tier,
  division,
  rank,
  size = 28,
  marker = true,
  label,
  className,
}: {
  tier: Tier;
  division?: 1 | 2 | 3 | undefined;
  rank?: number | undefined;
  size?: number;
  marker?: boolean;
  label?: string;
  className?: string;
}) {
  const pfx = usePrefix();
  const shield = useMemo(() => defs(pfx) + emblem(pfx, tier), [pfx, tier]);
  const showPips = marker && tier !== "lightning" && division !== undefined;
  const showRank = marker && tier === "lightning" && rank !== undefined;
  const pipsMarkup = useMemo(
    () => (showPips ? defs(`${pfx}p`) + pips(`${pfx}p`, 3, 4 - (division ?? 3), 60, 0) : ""),
    [pfx, showPips, division],
  );
  return (
    <span
      data-jz="emblem"
      data-tier={tier}
      role="img"
      aria-label={label ?? emblemLabel(tier, division, rank)}
      className={`jz-art${className ? ` ${className}` : ""}`}
    >
      <ArtSvg box={EMBLEM_BOX} width={size} markup={shield} />
      {showPips && <ArtSvg box={PIPS_BOX} width={Math.max(36, Math.round(size * 0.4))} markup={pipsMarkup} />}
      {showRank && (
        <span className="jz-emblem-rank" style={{ fontSize: Math.max(11, Math.round(size * 0.093)) }} aria-hidden="true">
          #{rank}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ Medal art (the Medal component draws it) */

/** The medal art alone (no number, DESIGN.md section 5): `size` px wide, 7/6 as tall. */
export function MedalArt({ metal, size }: { metal: MedalMetal; size: number }) {
  const pfx = usePrefix();
  const markup = useMemo(() => defs(pfx) + medal(pfx, metal), [pfx, metal]);
  return <ArtSvg box={MEDAL_BOX} width={size} markup={markup} />;
}

/* ------------------------------------------------------------------ Trophy */

export const TROPHY_NAMES: Record<TrophyKind, string> = {
  bronze: "Bronze cup",
  silver: "Silver cup",
  gold: "Gold cup",
  championship: "Championship trophy",
};

/** A trophy, progressively grander: bronze, silver, gold, championship. `size` is its width (the boards: 80, 94, 112, 176). */
export function Trophy({
  kind,
  size = TROPHY_SIZES[kind],
  label,
  className,
}: {
  kind: TrophyKind;
  size?: number;
  label?: string;
  className?: string;
}) {
  const pfx = usePrefix();
  const { metal, level } = TROPHY_LEVEL[kind];
  const markup = useMemo(() => defs(pfx) + trophy(pfx, metal, level), [pfx, metal, level]);
  return (
    <span data-jz="trophy" data-kind={kind} role="img" aria-label={label ?? TROPHY_NAMES[kind]} className={`jz-art${className ? ` ${className}` : ""}`}>
      <ArtSvg box={TROPHY_BOX[kind]} width={size} markup={markup} />
    </span>
  );
}

/** The widths the approved board draws each trophy at. */
export const TROPHY_SIZES: Record<TrophyKind, number> = { bronze: 80, silver: 94, gold: 112, championship: 176 };

/* ------------------------------------------------------------------ Badge */

export const BADGE_NAMES: Record<BadgeKind, string> = {
  winner: "Tournament Winner",
  arena: "Arena Champion",
  club: "200 Club",
  founder: "Founding Player",
};

/** A player card badge: winner, arena, club, founder (`player`: the founder's player number, data, shown as #0042). */
export function Badge({
  kind,
  player = 0,
  size = 104,
  label,
  className,
}: {
  kind: BadgeKind;
  player?: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const pfx = usePrefix();
  const markup = useMemo(() => defs(pfx) + badge(pfx, kind, player), [pfx, kind, player]);
  const name = kind === "founder" ? `${BADGE_NAMES.founder} ${founderNumber(player)}` : BADGE_NAMES[kind];
  return (
    <span data-jz="badge" data-kind={kind} role="img" aria-label={label ?? name} className={`jz-art${className ? ` ${className}` : ""}`}>
      <ArtSvg box={BADGE_BOX} width={size} markup={markup} />
    </span>
  );
}
