/**
 * The tier ladder (wave 3, session W3c; mockup 14): your rating and the bar to the next division, then every tier from
 * Top 500 down to Spark with its range and division floors, each tier's share of players from the server's real
 * counts (no column when the server has too few players to say), where you are, and the rules: placement, Storm's and
 * Top 500's caps, the grace at a tier's floor, and the season's rewards.
 */
import { Emblem } from "@/design/art";
import { Icon, Panel } from "@/design/components";
import type { LadderCounts } from "@/lib/rated/backend";
import {
  CAP_DAYS,
  GRACE_MATCHES,
  PLACEMENT_MATCHES,
  rankLabel,
  ratingText,
  STORM_TOP_SHARE,
  TIER_NAMES,
  tierFloorsText,
  tierRange,
  TIERS,
  TOP_COUNT,
  type RankView,
} from "@/lib/rated/tiers";

import { DivisionBarView, RankEmblem } from "./RatedParts";

export function TierLadder({ rank, counts }: { rank: RankView | null; counts: LadderCounts | null }) {
  const rows = [...TIERS].reverse();
  const share = (t: (typeof TIERS)[number]) => counts?.shares?.[t];
  const atTop = rank?.top500 !== null && rank?.top500 !== undefined;
  return (
    <div className="rt-ladder" data-tier-ladder>
      {rank ? (
        <Panel pad className="rt-ladder-you" data-ladder-you>
          <div className="rt-ladder-you-head">
            <RankEmblem rank={rank} size={40} />
            <span className="rt-rating-text">
              <span className="rt-rating-label">Your Joulz Rating</span>
              <span className="rt-rating-value">{ratingText(rank.rating)}</span>
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
          {counts ? <span>Players</span> : null}
        </div>
        <ul>
          <li className="jz-row rt-tier" data-tier-row="top500" data-you={atTop ? "" : undefined}>
            <Emblem tier="lightning" rank={rank?.top500 ?? undefined} size={56} marker={false} label="Top 500" />
            <span className="rt-tier-text">
              <span className="rt-tier-name">
                Top 500{atTop ? <span className="rt-tier-you">You, {rankLabel(rank!)}</span> : null}
              </span>
              <span className="rt-tier-range">Lightning, and ranked 1 to {TOP_COUNT}</span>
              <span className="rt-tier-floors">Numbered: Top 500 #1 to #{TOP_COUNT}</span>
            </span>
            {counts ? <span className="rt-tier-share">{ratingText(counts.top500)} players</span> : null}
          </li>
          {rows.map((t) => {
            const here = rank !== null && !atTop && rank.tier === t;
            const s = share(t);
            return (
              <li key={t} className="jz-row rt-tier" data-tier-row={t} data-you={here ? "" : undefined}>
                <Emblem tier={t} size={56} marker={false} />
                <span className="rt-tier-text">
                  <span className="rt-tier-name">
                    {TIER_NAMES[t]}
                    {here ? <span className="rt-tier-you">You, {rankLabel(rank!)}</span> : null}
                  </span>
                  <span className="rt-tier-range">
                    {tierRange(t)}
                    {t === "storm" ? `, and top ${STORM_TOP_SHARE}%` : ""}
                  </span>
                  <span className="rt-tier-floors">{tierFloorsText(t)}</span>
                </span>
                {counts ? <span className="rt-tier-share">{s !== undefined && s !== null ? `${s}%` : "–"}</span> : null}
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
            Storm and Top 500 must be held: drop out of the top {STORM_TOP_SHARE}% or the top {TOP_COUNT} for {CAP_DAYS} days and
            you move down. {GRACE_MATCHES} matches of grace at every tier’s floor.
          </span>
        </li>
        {rank?.heldBack ? (
          <li data-held-back={rank.heldBack}>
            <Icon name="lock" size={22} tone="gold" />
            <span>
              {rank.heldBack === "storm"
                ? `Your rating reaches Storm. You’ll move up once you’re in the top ${STORM_TOP_SHARE}%.`
                : `Your rating reaches Top 500. You’ll get a number once you hold a top ${TOP_COUNT} place.`}
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
