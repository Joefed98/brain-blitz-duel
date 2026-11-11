/**
 * Profile's rated panels (wave 3, session W3c): the Joulz Rating with its tier and the bar to the next division, the
 * Puzzles and Arcade tiles, and the strongest categories, from the server's real figures only. During placement, the
 * placement boxes ("Placement 3 of 5") and nothing that isn't known yet; no section is drawn without data (strongest
 * categories only once a category has a rated match). The trophy cabinet and the season peak stay hidden until
 * wave 4.
 */
import { useNavigate } from "@tanstack/react-router";

import { Panel, Row, SectionHeader } from "@/design/components";
import type { RatedStatus } from "@/lib/rated/backend";
import { recordRatedEvent } from "@/lib/rated/ratedEvents";
import { pickLabel, placementHomeLine } from "@/lib/rated/rules";
import { PLACEMENT_MATCHES, rankLabel, ratingText } from "@/lib/rated/tiers";

import { DivisionBarView, PickMark, PlacementBoxes, RankEmblem, SideTile } from "./RatedParts";

/** The strongest categories shown (the top three with at least one rated match). */
export const STRONGEST_SHOWN = 3;

export function ProfileRating({ status }: { status: RatedStatus }) {
  const navigate = useNavigate();
  const s = status.standing;
  if (s.state === "placement") {
    return (
      <Panel as="section" pad aria-label="Joulz Rating" className="rt-rank" data-profile-rating="placement">
        <h2 className="rt-placement-title">
          Placement {s.results.length} of {PLACEMENT_MATCHES}
        </h2>
        <PlacementBoxes results={s.results} />
        <p className="rt-rank-line">{placementHomeLine(s.results.length)}</p>
      </Panel>
    );
  }
  const strongest = [...s.categories]
    .filter((c) => c.matches > 0)
    .sort((a, b) => b.rating - a.rating || b.matches - a.matches)
    .slice(0, STRONGEST_SHOWN);
  return (
    <div className="rt-profile" data-profile-rating="placed">
      <Panel as="section" pad aria-label="Joulz Rating" className="rt-rank">
        <button
          type="button"
          className="rt-profile-rating press"
          data-open-tiers
          onClick={() => {
            recordRatedEvent({ event: "tier_ladder_viewed", from: "profile" });
            void navigate({ to: "/tiers" as never });
          }}
        >
          <RankEmblem rank={s.rank} size={48} />
          <span className="rt-rating-text">
            <span className="rt-rating-label">Joulz Rating</span>
            <span className="rt-rating-value" data-joulz-rating>
              {ratingText(s.rank.rating)}
            </span>
          </span>
          <span className="rt-profile-tier">{rankLabel(s.rank)}</span>
        </button>
        <DivisionBarView rank={s.rank} />
        <div className="rt-sides">
          <SideTile side="puzzles" rating={s.puzzles} sub={`${s.puzzles.matches} ${s.puzzles.matches === 1 ? "match" : "matches"}`} />
          <SideTile side="arcade" rating={s.arcade} sub={`${s.arcade.matches} ${s.arcade.matches === 1 ? "match" : "matches"}`} />
        </div>
      </Panel>
      {strongest.length ? (
        <section aria-label="Strongest categories" className="ap-section" data-strongest>
          <SectionHeader title="Strongest categories" />
          <Panel>
            {strongest.map((c) => (
              <Row
                key={c.pick}
                leading={<PickMark pick={c.pick} />}
                title={pickLabel(c.pick)}
                sub={`${c.matches} ${c.matches === 1 ? "match" : "matches"}`}
                data-strongest-row={c.pick}
              >
                <span className="rt-option-rating">{ratingText(c.rating)}</span>
              </Row>
            ))}
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
