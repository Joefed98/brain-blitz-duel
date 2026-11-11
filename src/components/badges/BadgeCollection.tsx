/**
 * Profile's badge collection (wave 2, train C, session C2): all 54 badges in their six groups, earned ones lit with
 * their rarity (and the Founding Player's number), locked ones dimmed with their rule and, for a counted badge the
 * server checks, progress ("4 of 7 days"). No hidden badges.
 * Accounts only, once the server has answered (a guest has no badges; nothing is drawn until there is data).
 */
import {
  BADGE_GROUP_LABEL,
  BADGE_GROUPS,
  BADGE_RARITY_LABEL,
  BADGES,
  badgeArtUrl,
  badgeHowLine,
  badgeProgressLine,
} from "@/lib/badges/catalogue";
import { useMyBadges } from "@/lib/badges/badgesApi";

export function BadgeCollection() {
  const { live, badges } = useMyBadges();
  if (!live || !badges?.account) return null;
  const earned = new Map(badges.earned.map((b) => [b.slug, b]));
  return (
    <section aria-label="Badges" data-profile-badges className="ap-section">
      <div className="ap-section-head">
        <h2 className="ap-section-title">Badges</h2>
        <span className="ap-meta" data-badge-count>
          {earned.size} of {BADGES.length}
        </span>
      </div>
      {BADGE_GROUPS.map((group) => (
        <div key={group} className="bd-group" data-badge-group={group}>
          <h3 className="bd-group-title">{BADGE_GROUP_LABEL[group]}</h3>
          <ul className="bd-grid">
            {BADGES.filter((b) => b.group === group).map((b) => {
              const mine = earned.get(b.slug);
              return (
                <li key={b.slug} className="bd-tile" data-badge={b.slug} data-locked={mine ? undefined : ""} data-status={b.status}>
                  <img src={badgeArtUrl(b.slug)} alt="" width={56} height={56} draggable={false} />
                  <span className="bd-name">{b.name}</span>
                  <span className="bd-rarity">{BADGE_RARITY_LABEL[b.rarity]}</span>
                  <span className="bd-how" data-badge-how>
                    {mine ? (mine.number !== null ? `Earned · #${String(mine.number).padStart(4, "0")}` : "Earned") : badgeHowLine(b)}
                  </span>
                  {!mine && badgeProgressLine(b, badges.progress[b.slug]) ? (
                    <span className="bd-progress" data-badge-progress>
                      {badgeProgressLine(b, badges.progress[b.slug])}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
