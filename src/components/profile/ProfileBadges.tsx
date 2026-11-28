/**
 * Profile's Badges preview (the Profile session, phase 2 step 3, 14 Nov 2026): the count ("5 of 54") and the badges
 * earned, newest first, in one row (as many as fit), with "See all" opening the Badges page (/badges, every badge
 * grouped, earned and locked). Accounts only, once the server has answered (a guest has no badges); with none earned
 * yet, one row to the Badges page.
 */
import { useRouter } from "@tanstack/react-router";

import { Icon, Panel, Row, SectionHeader } from "@/design/components";
import { useMyBadges } from "@/lib/badges/badgesApi";
import { BADGE_BY_SLUG, BADGES, badgeArtUrl } from "@/lib/badges/catalogue";

/** The most badges the preview row draws (the row clips any that don't fit). */
export const BADGE_PREVIEW_MAX = 8;

export function ProfileBadges() {
  const router = useRouter();
  const { live, badges } = useMyBadges();
  if (!live || !badges?.account) return null;
  const open = () => void router.navigate({ to: "/badges", state: { fromPlayTab: true } as never } as never);
  const earned = [...badges.earned]
    .filter((b) => BADGE_BY_SLUG.has(b.slug))
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
    .slice(0, BADGE_PREVIEW_MAX);
  return (
    <section aria-label="Badges" className="pf-section" data-profile-badge-preview={badges.earned.length}>
      <SectionHeader
        title="Badges"
        right={
          <button type="button" className="pf-see press" onClick={open} data-profile-badges-open aria-label="See all badges">
            See all
          </button>
        }
      />
      {earned.length ? (
        <button type="button" className="jz-panel pf-badges press" onClick={open} aria-label={`${badges.earned.length} of ${BADGES.length} badges earned. See all`}>
          <span className="pf-badges-row" aria-hidden="true">
            {earned.map((b) => (
              <img key={b.slug} src={badgeArtUrl(b.slug)} alt="" width={44} height={44} draggable={false} data-preview-badge={b.slug} />
            ))}
          </span>
          <span className="pf-badges-count" data-one-line>
            {badges.earned.length} of {BADGES.length}
          </span>
        </button>
      ) : (
        <Panel>
          <Row as="button" onClick={open} leading={<Icon name="rewards" size={22} tone="text-2" />} title="No badges yet" sub={`${BADGES.length} to earn`} data-profile-badges-none>
            <Icon name="chevron-right" size={20} className="jz-chevron" />
          </Row>
        </Panel>
      )}
    </section>
  );
}
