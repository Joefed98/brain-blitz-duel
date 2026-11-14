import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { BadgeCollection } from "@/components/badges/BadgeCollection";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { ProfilePageHead, backToProfile } from "@/components/profile/ProfilePageHead";
import { SectionHeader, Skeleton } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { useMyBadges } from "@/lib/badges/badgesApi";
import { BADGE_BY_SLUG, CARD_BADGE_SLOTS, badgeArtUrl } from "@/lib/badges/catalogue";
import { APP_NAME } from "@/lib/brand";

/**
 * Badges (the Profile session, phase 2 step 3, 14 Nov 2026; moved out of Profile, whose Badges row opens it): the
 * badges on your card with Choose (Customise's Badges and title tab, where they are picked), then every badge in its
 * group, earned and locked, with each rule and, for a counted badge, the progress (BadgeCollection). Accounts only: a
 * guest has no badges and is sent to Profile (whose Customise offers the save-your-progress sheet).
 */
export const Route = createFileRoute("/badges")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${APP_NAME} badges` }, { name: "robots", content: "noindex" }],
  }),
  component: BadgesScreen,
});

function BadgesScreen() {
  const router = useRouter();
  const account = useAccount();
  const { live, badges } = useMyBadges();
  useEffect(() => {
    if (account.kind !== "unknown" && account.kind !== "account") void router.navigate({ to: "/profile", replace: true });
  }, [account.kind, router]);
  const mine = badges?.account ? badges : null;
  const chosen = mine ? mine.card.filter((slug) => BADGE_BY_SLUG.has(slug)) : [];
  return (
    <PhoneShell skin="profile" bare>
      <div className="pf-subpage" data-badges-page={mine ? "ready" : "loading"}>
        <ProfilePageHead
          title="Badges"
          onBack={() => backToProfile(router as never)}
        />
        {!live || !mine ? (
          <Skeleton kind="card" />
        ) : (
          <>
            <section aria-label="On your card" className="pf-section" data-badges-on-card={chosen.join(" ")}>
              <SectionHeader
                title="On your card"
                right={
                  <button
                    type="button"
                    className="pf-see press"
                    data-badges-choose
                    onClick={() => void router.navigate({ to: "/customise", search: { tab: "badges" } as never, state: { fromPlayTab: true } as never } as never)}
                  >
                    Choose
                  </button>
                }
              />
              <ul className="jz-panel pf-oncard">
                {Array.from({ length: CARD_BADGE_SLOTS }, (_, i) => chosen[i] ?? null).map((slug, i) => (
                  <li key={slug ?? `empty-${i}`} className="pf-oncard-slot" data-oncard-slot={slug ?? "empty"}>
                    {slug ? (
                      <img src={badgeArtUrl(slug)} alt="" width={44} height={44} draggable={false} />
                    ) : (
                      <span className="pf-oncard-empty" aria-hidden="true" />
                    )}
                    <span className="pf-oncard-name" data-ellipsis>
                      {slug ? BADGE_BY_SLUG.get(slug)!.name : "Empty"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <BadgeCollection />
          </>
        )}
      </div>
    </PhoneShell>
  );
}
