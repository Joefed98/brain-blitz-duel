/**
 * Profile's top (wave 2, session A2; restyled by the Profile session, phase 2 step 3, 14 Nov 2026, to
 * docs/design/style-guide/phone/profile.png): `ProfileCard` is the player card and Customise card; `ProfileRatings` the
 * Ratings section (the Joulz Rating, Puzzles and Arcade), drawn only for a player rated play is open to (the same rule
 * as Home: hidden for everyone else, with no gap). The Friends button moved to Profile's Friends strip
 * (src/components/profile/ProfileFriends.tsx). Earlier notes: Only real data. With rated play open to the player (wave 3, testers only at first) and placed: the
 * pill shows the tier and rating, and ProfileRating draws the Joulz Rating, Puzzles and Arcade and the strongest
 * categories from the server's figures; in placement, the pill keeps the player number and the panel shows the
 * placement matches. Without rated play: the pill shows the player number (an account) or "Guest", and the panel says
 * the rating arrives with rated play. Mastery stars and challenges (C1), badges and titles (C2), the trophy cabinet
 * and the season peak (wave 4) aren't drawn until they have data.
 *
 * New accounts start with Captain Joulz's helmet in their colour (lookFromLoadout with no saved avatar); guests keep
 * their colour and initial.
 *
 * A guest's Customise opens the save-your-progress sheet (an account keeps what you choose); never over a result:
 * this is a tab page.
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { SaveProgressOffer } from "@/components/account/SaveProgress";
import { Button, Icon } from "@/design/components";
import { DEFAULT_LOOK, PlayerCard, type CardLook } from "@/design/identity";
import { cachedAccount, useAccount, type AccountCard } from "@/lib/account/accountApi";
import { useMyBadges } from "@/lib/badges/badgesApi";
import { titleName } from "@/lib/badges/catalogue";
import { useMyIdentity } from "@/lib/identity/identityApi";
import { recordIdentityEvent } from "@/lib/identity/identityEvents";
import type { Loadout } from "@/lib/identity/backend";
import { useRatedStatus } from "@/lib/rated/ratedApi";
import { ProfileRating } from "@/components/rated/ProfileRating";
import { usePlusStatus } from "@/lib/plus/plusApi";

export { lookFromLoadout, withAvatarItems } from "@/lib/identity/cardLook";
import { lookFromLoadout } from "@/lib/identity/cardLook";

export function ProfileCard({ guestName, guestColour }: { guestName: string; guestColour: number | null }) {
  const router = useRouter();
  const account = useAccount();
  const identity = useMyIdentity();
  // C2: the card's badges and title (badgesApi.ts; accounts, once the server answers).
  const mine = useMyBadges().badges;
  const rated = useRatedStatus();
  const [cached, setCached] = useState<AccountCard | null>(null);
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    setCached(cachedAccount());
  }, []);

  // profile_viewed once the account's kind is known (account or guest).
  const sent = useRef(false);
  useEffect(() => {
    if (account.kind === "unknown" || sent.current) return;
    sent.current = true;
    recordIdentityEvent({ event: "profile_viewed", who: account.kind === "account" ? "account" : "guest" });
  }, [account.kind]);

  const signedIn = account.kind === "account" ? account : null;
  const fromCache = account.kind === "unknown" ? cached : null;
  const isAccount = Boolean(signedIn || fromCache);
  const name = signedIn?.username ?? fromCache?.username ?? guestName;
  const playerNumber = signedIn?.playerNumber ?? fromCache?.playerNumber ?? null;
  const look = isAccount
    ? lookFromLoadout(identity.loadout, signedIn?.colour ?? fromCache?.colour ?? null)
    : lookFromLoadout(null, guestColour);

  // Wave 2 E2: the gold PLUS chip, only when this account has Plus and turned it on (off by default).
  const plusMark = usePlusStatus(!!signedIn)?.member?.showMark === true;

  const customise = () => {
    if (isAccount) void router.navigate({ to: "/customise", state: { fromPlayTab: true } as never } as never);
    else setOffer(true);
  };
  // The card page (/card): the card shown large; an account's only (a guest's card is their colour and initial).
  const openCard = () => {
    if (isAccount) void router.navigate({ to: "/card", state: { fromPlayTab: true } as never } as never);
  };

  return (
    <section aria-label="Your card" data-profile-card={isAccount ? "account" : "guest"} className="pf-card-block">
      {isAccount ? (
        <button type="button" className="pf-card-open press" onClick={openCard} aria-label="Open your card" data-profile-card-open>
          <PlayerCard
            look={look}
            name={name}
            playerNumber={playerNumber}
            guest={false}
            guestColour={guestColour ?? 0}
            title={mine?.account ? titleName(mine.title) : null}
            badges={mine?.account ? mine.card : undefined}
            rank={rated?.standing.state === "placed" ? rated.standing.rank : null}
          />
        </button>
      ) : (
        <PlayerCard look={look} name={name} playerNumber={playerNumber} guest guestColour={guestColour ?? 0} title={null} rank={null} />
      )}
      {plusMark ? (
        <span className="jz-plus-chip" data-plus-mark="">
          PLUS
        </span>
      ) : null}
      <Button variant="secondary" size={48} block onClick={customise} data-customise-open>
        <Icon name="edit" size={20} /> Customise card
      </Button>
      {offer ? <SaveProgressOffer onClose={() => setOffer(false)} /> : null}
    </section>
  );
}

/**
 * Profile's Ratings (the style guide's three tiles, ProfileRating): an account rated play is open to, from the server's
 * real figures; placement's boxes while placing. Nothing at all (no section, no gap) for anyone else, as Home.
 */
export function ProfileRatings() {
  const account = useAccount();
  const rated = useRatedStatus();
  const isAccount = account.kind === "account" || (account.kind === "unknown" && cachedAccount() !== null);
  if (!isAccount || !rated) return null;
  return <ProfileRating status={rated} />;
}
