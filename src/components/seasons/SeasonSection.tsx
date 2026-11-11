/**
 * Seasons on Profile (wave 4, session W4d; docs/seasons/README.md): the season peak (the season now: the peak tier
 * actually held so far, from the server's stored rated matches) and the season history (each season's reward), with
 * the season emblems. Real data only: nothing is drawn for a guest, before the server answers, or when there is no
 * season played; a season with no tier held yet shows no peak.
 *
 * `SeasonEmblem` is the approved tier emblem (src/design/art) with the season's mark ("S1"); Top 500 uses the
 * Lightning shield with a "TOP 500" plate until its own emblem is drawn. `SeasonTrophies` is the emblems alone, for the
 * trophy cabinet (wave 4) to place.
 */
import { Emblem } from "@/design/art";
import type { TierId } from "@/lib/data/ratings";
import { SEASON_TIER_NAMES } from "@/lib/seasons/rules";
import { useMySeasons } from "@/lib/seasons/seasonsApi";
import type { SeasonHistoryEntry } from "@/lib/seasons/types";

type EmblemTier = "spark" | "charge" | "volt" | "surge" | "storm" | "lightning";

/** A season emblem: the tier's shield and the season's mark. */
export function SeasonEmblem({ tier, mark, size = 40 }: { tier: TierId; mark: string; size?: number }) {
  const shield: EmblemTier = tier === "top500" ? "lightning" : tier;
  const label = `${mark} ${SEASON_TIER_NAMES[tier]} emblem`;
  return (
    <span className="sn-emblem" data-season-emblem={tier} data-season-mark={mark} role="img" aria-label={label}>
      <Emblem tier={shield} size={size} marker={false} label={label} />
      <span className="sn-mark" aria-hidden="true">
        {tier === "top500" ? `${mark} TOP 500` : mark}
      </span>
    </span>
  );
}

/** Every season emblem earned, oldest first (for the trophy cabinet). */
export function SeasonTrophies({ history, size = 48 }: { history: readonly SeasonHistoryEntry[]; size?: number }) {
  if (!history.length) return null;
  return (
    <span className="sn-trophies" data-season-trophies={history.length}>
      {history.map((h) => (
        <SeasonEmblem key={`${h.season}:${h.grantedAt}`} tier={h.tier} mark={h.mark} size={size} />
      ))}
    </span>
  );
}

export function SeasonSection() {
  const { live, seasons } = useMySeasons();
  if (!live || !seasons?.account) return null;
  const current = seasons.current;
  const peak = current?.peak ? current : null;
  const history = seasons.history;
  if (!peak && !history.length) return null;
  return (
    <section aria-label="Seasons" data-profile-seasons className="ap-section">
      {peak ? (
        <>
          <div className="ap-section-head">
            <h2 className="ap-section-title">Season peak</h2>
          </div>
          <div className="jz-panel jz-row" data-icon="none" data-season-peak={peak.peak ?? ""}>
            <SeasonEmblem tier={peak.peak!} mark={peak.mark} size={36} />
            <span data-ellipsis className="jz-row-title min-w-0 flex-1">
              {peak.peakLabel ?? SEASON_TIER_NAMES[peak.peak!]}
            </span>
            <span className="ap-meta" data-season-name>
              {peak.name}
            </span>
          </div>
        </>
      ) : null}
      {history.length ? (
        <>
          <div className="ap-section-head">
            <h2 className="ap-section-title">Season history</h2>
          </div>
          <ul className="jz-panel" data-season-history={history.length}>
            {history.map((h) => (
              <li key={`${h.season}:${h.grantedAt}`} className="jz-row" data-icon="none" data-season-entry={h.season}>
                <SeasonEmblem tier={h.tier} mark={h.mark} size={36} />
                <span data-ellipsis className="jz-row-title min-w-0 flex-1">
                  {h.test ? `${h.name} (test)` : h.name}
                </span>
                <span className="ap-meta">{`Peak ${SEASON_TIER_NAMES[h.tier]}`}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
