/**
 * Profile's Friends strip (the Profile session, phase 2 step 3, 14 Nov 2026): up to eight friends (online first), each
 * their mini card and name, a tap opening their profile; "See all" opens Friends (with the waiting requests' count).
 * From the friends list's own call (friendsApi.overview, the cards with it), accounts only. An account with no friends
 * yet gets one row to add a friend; a guest's row opens the save-your-progress sheet (friends need an account). The
 * list's rules are the server's: only the account's own friends, blocked players never.
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SaveProgressOffer } from "@/components/account/SaveProgress";
import { FriendBadge } from "@/components/friends/FriendsScreens";
import { Icon, Panel, Row, SectionHeader } from "@/design/components";
import { cachedAccount, useAccount } from "@/lib/account/accountApi";
import { isOnline } from "@/lib/friends/friends";
import { friendsApi, useWaitingRequests, type Overview } from "@/lib/friends/friendsApi";

/** How many friends the strip shows. */
export const FRIENDS_STRIP_MAX = 8;

export function ProfileFriends() {
  const router = useRouter();
  const account = useAccount();
  const isAccount = account.kind === "account" || (account.kind === "unknown" && cachedAccount() !== null);
  const waiting = useWaitingRequests(account.kind === "account");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    if (account.kind !== "account") return;
    let live = true;
    void friendsApi.overview().then((a) => {
      if (live && a.ok) setOverview(a.overview);
    });
    return () => {
      live = false;
    };
  }, [account.kind]);

  const go = (search: Record<string, string> = {}) =>
    void router.navigate({ to: "/friends", search: search as never, state: { fromPlayTab: true } as never } as never);
  const openAll = () => (isAccount ? go() : setOffer(true));

  const shown = overview
    ? [...overview.friends].sort((a, b) => Number(isOnline(b.status)) - Number(isOnline(a.status))).slice(0, FRIENDS_STRIP_MAX)
    : [];

  return (
    <section aria-label="Friends" className="pf-section" data-profile-friends={isAccount ? (overview ? overview.friends.length : "loading") : "guest"}>
      <SectionHeader
        title="Friends"
        right={
          isAccount ? (
            <button
              type="button"
              className="pf-see press"
              onClick={openAll}
              data-friends-open
              aria-label={waiting ? `See all friends, ${waiting} waiting` : "See all friends"}
            >
              {waiting ? (
                <span className="pf-count" data-friends-waiting={waiting} aria-hidden="true">
                  {waiting > 99 ? "99+" : waiting}
                </span>
              ) : null}
              See all
            </button>
          ) : undefined
        }
      />
      {!isAccount ? (
        <Panel>
          <Row
            as="button"
            data-friends-open
            leading={<Icon name="addfriend" size={22} tone="text-2" />}
            title="Add friends"
            sub="Friends need an account"
            onClick={openAll}
          >
            <Icon name="chevron-right" size={20} className="ap-chevron" />
          </Row>
        </Panel>
      ) : overview && shown.length === 0 ? (
        <Panel>
          <Row as="button" data-profile-friends-add leading={<Icon name="addfriend" size={22} tone="text-2" />} title="Add a friend" sub="Find them or send your link" onClick={() => go({ add: "1" })}>
            <Icon name="chevron-right" size={20} className="ap-chevron" />
          </Row>
        </Panel>
      ) : shown.length ? (
        <ul className="pf-friends">
          {shown.map((f) => (
            <li key={f.id}>
              <button type="button" className="pf-friend press" data-profile-friend={f.id} onClick={() => go({ player: f.id })} aria-label={`${f.username}’s profile`}>
                <span className="pf-friend-card">
                  <FriendBadge card={f} size={56} />
                  {isOnline(f.status) ? <span className="pf-friend-dot" aria-hidden="true" /> : null}
                </span>
                <span className="pf-friend-name" data-ellipsis>
                  {f.username}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pf-friends-wait" aria-hidden="true" />
      )}
      {offer ? <SaveProgressOffer onClose={() => setOffer(false)} /> : null}
    </section>
  );
}
