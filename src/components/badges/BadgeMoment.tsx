/**
 * The badge-earned moment (wave 2, train C, session C2): a small toast with the badge, its name and, for a
 * Legendary, its 250 coins. Drawn only by PhoneShell on the tab pages (Play, Practice, Tournaments, Shop, Profile),
 * like "Save your progress", so it never covers a round, its intro or reveal, or any result, podium, standings or
 * share screen. Shows one badge at a time for 4 s (a tap closes it sooner), then marks it shown; still under reduced
 * motion (no animation at all). Accounts only; nothing is drawn while there is nothing new.
 */
import { useEffect, useState } from "react";

import { Toast } from "@/design/components";
import { BADGE_BY_SLUG, badgeArtUrl } from "@/lib/badges/catalogue";
import { markBadgesShown, useMyBadges } from "@/lib/badges/badgesApi";

export const BADGE_MOMENT_MS = 4000;

export function BadgeMoment() {
  const { live, badges } = useMyBadges();
  const next = live && badges?.account ? badges.unseen.find((slug) => BADGE_BY_SLUG.has(slug)) ?? null : null;
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!next || shown) return;
    setShown(next);
  }, [next, shown]);

  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => close(shown), BADGE_MOMENT_MS);
    return () => window.clearTimeout(t);
  }, [shown]);

  const close = (slug: string) => {
    setShown(null);
    void markBadgesShown([slug]);
  };

  const def = shown ? BADGE_BY_SLUG.get(shown) : undefined;
  if (!shown || !def) return null;
  return (
    <Toast as="button" tone="live" className="bd-moment" data-badge-moment={def.slug} onClick={() => close(def.slug)}>
      <img src={badgeArtUrl(def.slug)} alt="" width={40} height={40} draggable={false} />
      <span className="bd-moment-text">
        <span className="bd-moment-kicker">{def.coins ? `Badge earned · +${def.coins} coins` : "Badge earned"}</span>
        <span className="bd-moment-name">{def.name}</span>
      </span>
    </Toast>
  );
}
