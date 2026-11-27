/**
 * Profile's ratings (wave 3, session W3c; restyled by the Profile session, phase 2 step 3, 14 Nov 2026, to the style
 * guide's profile mockup): three rating tiles, the Joulz Rating (its tier under it; a tap opens the tier ladder),
 * Puzzles and Arcade (each with its rated matches), then the strongest categories, from the server's real figures
 * only. During placement, the placement boxes ("Placement 3 of 5") and nothing that isn't known yet; no section is
 * drawn without data (strongest categories only once a category has a rated match).
 */
import { useNavigate } from "@tanstack/react-router";

import { ProfileArt } from "@/components/profile/ProfileArt";
import { Panel, SectionHeader } from "@/design/components";
import type { RatedStatus, SideRating } from "@/lib/rated/backend";
import { recordRatedEvent } from "@/lib/rated/ratedEvents";
import { pickLabel, placementHomeLine } from "@/lib/rated/rules";
import { PLACEMENT_MATCHES, ratingText } from "@/lib/rated/tierDisplay";

import { PlacementBoxes } from "./RatedParts";

/** The strongest categories shown (the top three with at least one rated match). */
export const STRONGEST_SHOWN = 3;

const matches = (n: number) => `${n} ${n === 1 ? "match" : "matches"}`;

export function ProfileRating({ status }: { status: RatedStatus }) {
  const navigate = useNavigate();
  const s = status.standing;
  const openTiers = () => {
    recordRatedEvent({ event: "tier_ladder_viewed", from: "profile" });
    void navigate({ to: "/tiers" as never });
  };
  if (s.state === "placement") {
    return (
      <section aria-label="Joulz Rating" className="pf-section" data-profile-rating="placement">
        <SectionHeader title="Ratings" />
        <Panel pad className="pf-placement">
          <h3 className="pf-placement-title">
            Placement {s.results.length} of {PLACEMENT_MATCHES}
          </h3>
          <PlacementBoxes results={s.results} />
          <p className="pf-placement-line">{placementHomeLine(s.results.length)}</p>
        </Panel>
      </section>
    );
  }
  const strongest = [...s.categories]
    .filter((c) => c.matches > 0)
    .sort((a, b) => b.rating - a.rating || b.matches - a.matches)
    .slice(0, STRONGEST_SHOWN);
  // You (P3, 22 Nov 2026; mockup you-mixed-phone): the strongest categories as bars first, then the three ratings.
  const top = strongest[0]?.rating ?? 0;
  const floor = Math.min(...strongest.map((c) => c.rating), top) - 150;
  return (
    <div className="pf-ratings" data-profile-rating="placed">
      {strongest.length ? (
        <section aria-label="Strongest categories" className="pf-section" data-strongest>
          <SectionHeader
            title="Strongest categories"
            right={
              <button type="button" className="pf-see press" onClick={openTiers} data-profile-tiers-link>
                Tiers
              </button>
            }
          />
          <Panel className="pf-bars">
            {strongest.map((c) => (
              <div key={c.pick} className="pf-bar-row" data-strongest-row={c.pick}>
                <span className="pf-bar-name" data-one-line>
                  {pickLabel(c.pick)}
                </span>
                <span className="pf-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(12, Math.round(((c.rating - floor) / Math.max(1, top - floor)) * 100))}%`, background: PICK_BAR[c.pick] ?? "var(--jz-text-3)" }} />
                </span>
                <span className="pf-row-figure" aria-label={`${ratingText(c.rating)}, ${matches(c.matches)}`}>
                  {ratingText(c.rating)}
                </span>
              </div>
            ))}
          </Panel>
        </section>
      ) : null}
      <section aria-label="Joulz Rating" className="pf-section">
        {strongest.length ? null : (
          <SectionHeader
            title="Ratings"
            right={
              <button type="button" className="pf-see press" onClick={openTiers} data-profile-tiers-link>
                Tiers
              </button>
            }
          />
        )}
        <div className="pf-tiles">
          <button type="button" className="pf-tile press" data-open-tiers onClick={openTiers} aria-label={`Joulz Rating ${ratingText(s.rank.rating)}, ${s.rank.label}. See the tiers`}>
            <ProfileArt name="rating" />
            <span className="pf-tile-value" data-joulz-rating data-one-line>
              {ratingText(s.rank.rating)}
            </span>
            <span className="pf-tile-label" data-one-line>
              Joulz Rating
            </span>
            <span className="pf-tile-sub" data-one-line>
              {s.rank.label}
            </span>
          </button>
          <SideRatingTile side="puzzles" rating={s.puzzles} />
          <SideRatingTile side="arcade" rating={s.arcade} />
        </div>
      </section>
    </div>
  );
}

/** A strongest category's bar colour: the category's or arcade group's own (tokens in theme.css). */
const PICK_BAR: Record<string, string> = {
  word: "var(--category-word)",
  number: "var(--category-number)",
  speed: "var(--category-speed)",
  attention: "var(--category-attention)",
  pattern: "var(--category-pattern)",
  logic: "var(--category-logic)",
  retro: "var(--group-retro)",
  sports: "var(--group-sports)",
  cards: "var(--group-cards)",
  action: "var(--group-action)",
  strategy: "var(--group-strategy)",
};

/** A side's tile: its rating (or "Not played yet", no figure), the side's name and its rated matches. */
function SideRatingTile({ side, rating }: { side: "puzzles" | "arcade"; rating: SideRating }) {
  const figure = rating.rating !== null;
  return (
    <div className="pf-tile" data-side={side} data-side-value={figure ? "rating" : "none"}>
      <ProfileArt name={side} />
      {figure ? (
        <span className="pf-tile-value rt-side-value" data-one-line>
          {ratingText(rating.rating!)}
        </span>
      ) : (
        <span className="pf-tile-value pf-tile-word rt-side-value" data-wrap-ok>
          Not played yet
        </span>
      )}
      <span className="pf-tile-label" data-one-line>
        {side === "puzzles" ? "Puzzles" : "Arcade"}
      </span>
      <span className="pf-tile-sub" data-one-line>
        {matches(rating.matches)}
      </span>
    </div>
  );
}
