/**
 * The tier ladder (wave 3, session W3c; mockup 14): your rating and the bar to the next division, then W3a's ladder
 * (getTierLadder: every tier from Top 500 down to Spark with its range, division floors, cap and the live share of
 * rated players, `share` null until the standings have run), where you are, and the rules: placement, Storm's and Top
 * 500's caps with their grace, the grace at a tier's floor, and the season's rewards. The figures in the rules come
 * from W3a's constants (src/lib/rated/tiers.ts).
 */
import { Emblem } from "@/design/art";
import { Icon, Panel } from "@/design/components";
import type { TierLadderRung } from "@/lib/data/ratings";
import { CAP_GRACE_DAYS, FLOOR_GRACE_MATCHES, STORM_TOP_SHARE, TOP_500 } from "@/lib/rated/tiers";
import { emblemTier, PLACEMENT_MATCHES, ratingText, rungFloors, rungRange, shareText, type RankView } from "@/lib/rated/tierDisplay";

import { DivisionBarView, RankEmblem } from "./RatedParts";

const STORM_PCT = Math.round(STORM_TOP_SHARE * 100);

export function TierLadder({ rank, rungs }: { rank: RankView | null; rungs: readonly TierLadderRung[] }) {
  const shares = rungs.some((r) => r.share !== null);
  const youAt = rank ? (rank.tier === "top500" ? "top500" : rank.tier) : null;
  return (
    <div className="rt-ladder" data-tier-ladder>
      {rank ? (
        <Panel pad className="rt-ladder-you" data-ladder-you>
          <div className="rt-ladder-you-head">
            <RankEmblem rank={rank} size={40} />
            <span className="rt-rating-text">
              <span className="rt-rating-label" data-one-line>Your Joulz Rating</span>
              <span className="rt-rating-value" data-one-line>{ratingText(rank.rating)}</span>
            </span>
          </div>
          <DivisionBarView rank={rank} />
        </Panel>
      ) : (
        <Panel pad className="rt-ladder-you" data-ladder-you="placement">
          <p className="rt-rank-line">Your tier is revealed after {PLACEMENT_MATCHES} placement matches.</p>
        </Panel>
      )}

      <Panel className="rt-ladder-table">
        <div className="rt-games-head">
          <span>Tier</span>
          {shares ? <span>Players</span> : null}
        </div>
        <ul>
          {rungs.map((r) => {
            const here = youAt === r.tier;
            return (
              <li key={r.tier} className="jz-row rt-tier" data-tier-row={r.tier} data-you={here ? "" : undefined}>
                <Emblem
                  tier={emblemTier(r.tier)}
                  rank={r.tier === "top500" && here ? (rank?.rank ?? undefined) : undefined}
                  size={56}
                  marker={false}
                  label={r.name}
                />
                <span className="rt-tier-text">
                  <span className="rt-tier-name" data-one-line>
                    {r.name}
                    {here && rank ? <span className="rt-tier-you">You, {rank.label}</span> : null}
                  </span>
                  <span className="rt-tier-range">
                    {r.tier === "top500" ? r.cap : `${rungRange(r)}${r.cap ? `, ${r.cap}` : ""}`}
                  </span>
                  <span className="rt-tier-floors">{r.tier === "top500" ? `Numbered: Top 500 #1 to #${TOP_500}` : rungFloors(r)}</span>
                </span>
                {shares ? (
                  <span className="rt-tier-share" data-tier-share>
                    {r.share !== null ? shareText(r.share) : "–"}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      <ul className="rt-ladder-rules">
        <li>
          <Icon name="info" size={22} tone="text-3" />
          <span>
            Your tier comes from your Joulz Rating, revealed after {PLACEMENT_MATCHES} placement matches. Each tier has three
            divisions, III up to I.
          </span>
        </li>
        <li data-cap-rule>
          <Icon name="lock" size={22} tone="text-3" />
          <span>
            Storm and Top 500 must be held: drop out of the top {STORM_PCT}% or the top {TOP_500} for {CAP_GRACE_DAYS} days and
            you move down. {FLOOR_GRACE_MATCHES} matches of grace at every tier’s floor.
          </span>
        </li>
        {rank?.heldBack ? (
          <li data-held-back>
            <Icon name="lock" size={22} tone="gold" />
            <span>
              {rank.heldBack.label}: you’ll move up once you hold the place {rank.heldBack.ratedTier === "top500" ? `in the top ${TOP_500}` : `in the top ${STORM_PCT}%`}.
            </span>
          </li>
        ) : null}
        {rank?.floorGrace ? (
          <li data-floor-grace>
            <Icon name="lock" size={22} tone="gold" />
            <span>
              Below {rank.label}’s floor: kept for {rank.floorGrace.matchesLeft} more {rank.floorGrace.matchesLeft === 1 ? "match" : "matches"}.
            </span>
          </li>
        ) : null}
        <li>
          <Icon name="rewards" size={22} tone="text-3" />
          <span>End-of-season rewards come from your peak tier: the season emblem, a card frame and a title like “S1 Storm”.</span>
        </li>
      </ul>
    </div>
  );
}
