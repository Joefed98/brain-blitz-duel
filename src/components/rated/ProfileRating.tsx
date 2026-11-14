/**
 * Profile's ratings (wave 3, session W3c; restyled by the Profile session, phase 2 step 3, 14 Nov 2026, to the style
 * guide's profile mockup): three rating tiles, the Joulz Rating (its tier under it; a tap opens the tier ladder),
 * Puzzles and Arcade (each with its rated matches), then the strongest categories, from the server's real figures
 * only. During placement, the placement boxes ("Placement 3 of 5") and nothing that isn't known yet; no section is
 * drawn without data (strongest categories only once a category has a rated match).
 */
import { useNavigate } from "@tanstack/react-router";

import { ProfileArt } from "@/components/profile/ProfileArt";
import { Panel, Row, SectionHeader } from "@/design/components";
import type { RatedStatus, SideRating } from "@/lib/rated/backend";
import { recordRatedEvent } from "@/lib/rated/ratedEvents";
import { pickLabel, placementHomeLine } from "@/lib/rated/rules";
import { PLACEMENT_MATCHES, ratingText } from "@/lib/rated/tierDisplay";

import { PickMark, PlacementBoxes } from "./RatedParts";

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
  return (
    <div className="pf-ratings" data-profile-rating="placed">
      <section aria-label="Joulz Rating" className="pf-section">
        <SectionHeader
          title="Ratings"
          right={
            <button type="button" className="pf-see press" onClick={openTiers} data-profile-tiers-link>
              Tiers
            </button>
          }
        />
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
      {strongest.length ? (
        <section aria-label="Strongest categories" className="pf-section" data-strongest>
          <SectionHeader title="Strongest categories" />
          <Panel>
            {strongest.map((c) => (
              <Row key={c.pick} leading={<PickMark pick={c.pick} />} title={pickLabel(c.pick)} sub={matches(c.matches)} data-strongest-row={c.pick}>
                <span className="pf-row-figure">{ratingText(c.rating)}</span>
              </Row>
            ))}
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

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
