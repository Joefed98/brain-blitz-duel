/**
 * Profile's top (wave 2, session A2; mockup docs/art/wave-2/screens/profile.png): the player card, Customise, and
 * the Joulz Rating. Only real data. With rated play open to the player (wave 3, testers only at first) and placed: the
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
import { useWaitingRequests } from "@/lib/friends/friendsApi";
import { useMyBadges } from "@/lib/badges/badgesApi";
import { titleName } from "@/lib/badges/catalogue";
import { useMyIdentity } from "@/lib/identity/identityApi";
import { recordIdentityEvent } from "@/lib/identity/identityEvents";
import type { Loadout } from "@/lib/identity/backend";
import { useRatedStatus } from "@/lib/rated/ratedApi";
import { ProfileRating } from "@/components/rated/ProfileRating";

/** A card look from a saved loadout (the defaults where a slot is empty; the account's colour on Captain Joulz). */
export function lookFromLoadout(loadout: Loadout | null, colour: number | null): CardLook {
  return {
    cardArt: loadout?.slots["card-art"] ?? DEFAULT_LOOK.cardArt,
    frame: loadout?.slots["frame"] ?? DEFAULT_LOOK.frame,
    nameColour: loadout?.slots["name-colour"] ?? null,
    avatar: loadout?.avatar ?? (colour !== null ? { id: "captain-joulz", colour, gem: null } : null),
  };
}

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

  // Friends (wave 2 B1): accounts only; the badge counts requests waiting (in-app only). A guest gets the
  // save-your-progress sheet, as Customise.
  const waiting = useWaitingRequests(Boolean(signedIn));
  const friends = () => {
    if (isAccount) void router.navigate({ to: "/friends", state: { fromPlayTab: true } as never } as never);
    else setOffer(true);
  };

  const customise = () => {
    if (isAccount) void router.navigate({ to: "/customise", state: { fromPlayTab: true } as never } as never);
    else setOffer(true);
  };

  return (
    <section aria-label="Your card" data-profile-card={isAccount ? "account" : "guest"} className="id-card-block">
      <PlayerCard
        look={look}
        name={name}
        playerNumber={playerNumber}
        guest={!isAccount}
        guestColour={guestColour ?? 0}
        title={mine?.account ? titleName(mine.title) : null}
        badges={mine?.account ? mine.card : undefined}
        rank={isAccount && rated?.standing.state === "placed" ? rated.standing.rank : null}
      />
      <Button variant="secondary" size={48} block onClick={customise} data-customise-open>
        Customise card
      </Button>
      <Button variant="secondary" size={48} block onClick={friends} data-friends-open aria-label={waiting ? `Friends, ${waiting} waiting` : "Friends"}>
        <Icon name="friends" size={20} /> Friends
        {waiting ? (
          <span className="fr-tab-badge" data-friends-waiting={waiting} aria-hidden="true">
            {waiting > 99 ? "99+" : waiting}
          </span>
        ) : null}
      </Button>
      {isAccount && rated ? (
        <ProfileRating status={rated} />
      ) : (
        <div className="jz-panel id-rating-note" data-rating-note>
          <Icon name="leaderboard" size={20} tone="text-3" />
          <span>Your Joulz Rating arrives with rated play.</span>
        </div>
      )}
      {offer ? <SaveProgressOffer onClose={() => setOffer(false)} /> : null}
    </section>
  );
}
