import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { lookFromLoadout } from "@/components/identity/ProfileCard";
import { ProfilePageHead, backToProfile } from "@/components/profile/ProfilePageHead";
import { Button, Icon, Skeleton } from "@/design/components";
import { PlayerCard } from "@/design/identity";
import { useAccount } from "@/lib/account/accountApi";
import { useMyBadges } from "@/lib/badges/badgesApi";
import { titleName } from "@/lib/badges/catalogue";
import { APP_NAME } from "@/lib/brand";
import { useMyIdentity } from "@/lib/identity/identityApi";
import { useRatedStatus } from "@/lib/rated/ratedApi";

/**
 * Your player card (the Profile session, phase 2 step 3, 14 Nov 2026; opened from the card on Profile): the card shown
 * large, as other players see it on a tap (avatar, name, title, number or tier, badges), with Customise one tap away.
 * Accounts only: a guest's card is their colour and initial, so a guest is sent to Profile.
 */
export const Route = createFileRoute("/card")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${APP_NAME} card` }, { name: "robots", content: "noindex" }],
  }),
  component: CardScreen,
});

function CardScreen() {
  const router = useRouter();
  const account = useAccount();
  const identity = useMyIdentity();
  const mine = useMyBadges().badges;
  const rated = useRatedStatus();
  useEffect(() => {
    if (account.kind !== "unknown" && account.kind !== "account") void router.navigate({ to: "/profile", replace: true });
  }, [account.kind, router]);
  const signedIn = account.kind === "account" ? account : null;
  return (
    <PhoneShell skin="profile" bare>
      <div className="pf-subpage" data-card-page={signedIn ? "ready" : "loading"}>
        <ProfilePageHead title="Your card" onBack={() => backToProfile(router as never)} />
        {!signedIn ? (
          <Skeleton kind="card" />
        ) : (
          <div className="pf-card-large">
            <PlayerCard
              look={lookFromLoadout(identity.loadout, signedIn.colour)}
              name={signedIn.username}
              playerNumber={signedIn.playerNumber}
              title={mine?.account ? titleName(mine.title) : null}
              badges={mine?.account ? mine.card : undefined}
              rank={rated?.standing.state === "placed" ? rated.standing.rank : null}
              label={`${signedIn.username}’s card`}
            />
            <Button
              variant="gold"
              size={60}
              block
              data-card-customise
              onClick={() => void router.navigate({ to: "/customise", state: { fromPlayTab: true } as never } as never)}
            >
              <Icon name="edit" size={22} /> Customise card
            </Button>
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
