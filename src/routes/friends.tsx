import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AccountGate } from "@/components/account/AccountGate";
import { AddFriend, FriendProfileView, FriendsList, InviteLanding } from "@/components/friends/FriendsScreens";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { SkeletonPage } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { APP_NAME } from "@/lib/brand";
import { inviteTokenFrom, playerIdOk } from "@/lib/friends/friends";
import {
  clearPendingInvite,
  friendsApi,
  pendingInvite,
  rememberInvite,
  type FriendCard,
} from "@/lib/friends/friendsApi";

/**
 * /friends (wave 2 B1; docs/friends.md): the Friends list, `?add=1` Add a friend, `?player=<id>` a player's profile,
 * `?invite=<token>` an invite link. Accounts only: a guest opening a link sees who asked and is sent through sign-up
 * first (the token kept on the device, the request sent once the account exists); any other guest gets the "needs an
 * account" gate (Profile's Friends button offers them the save-your-progress sheet instead).
 */
type Search = { add?: "1"; player?: string; invite?: string };

export const Route = createFileRoute("/friends")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => {
    const invite = inviteTokenFrom(search["invite"]);
    return {
      ...(search["add"] === "1" || search["add"] === 1 ? { add: "1" as const } : {}),
      ...(playerIdOk(search["player"]) ? { player: search["player"] as string } : {}),
      ...(invite ? { invite } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: `${APP_NAME} friends` },
      { name: "description", content: `Your friends on ${APP_NAME}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  return (
    <OnlineOnly body="Friends need a connection. Practice games are saved on this phone, so they still work.">
      <FriendsScreen />
    </OnlineOnly>
  );
}

function FriendsScreen() {
  const router = useRouter();
  const search = Route.useSearch() as Search;
  const account = useAccount();
  const [arrival, setArrival] = useState<string | null>(null);
  const [owner, setOwner] = useState<FriendCard | null | undefined>(undefined);
  const sent = useRef(false);

  const go = (next: Search, replace = false) => void router.navigate({ to: "/friends", search: next as never, replace });
  const back = () => {
    if (window.history.length > 1) router.history.back();
    else void router.navigate({ to: "/profile", replace: true });
  };

  // A guest with a link: whose link it is, and the token kept for after sign-up.
  useEffect(() => {
    if (account.kind === "unknown" || account.kind === "account" || !search.invite) return;
    rememberInvite(search.invite);
    void friendsApi.linkOwner(search.invite).then((a) => setOwner(a.ok ? a.owner : null));
  }, [account.kind, search.invite]);

  // An account with a link (opened now, or kept from before sign-up): send the request once, then the list.
  useEffect(() => {
    if (account.kind !== "account" || sent.current) return;
    const token = search.invite ?? pendingInvite();
    if (!token) return;
    sent.current = true;
    clearPendingInvite();
    void friendsApi.requestByLink(token).then((a) => {
      if (a.ok)
        setArrival(
          a.outcome === "sent"
            ? `Request sent to ${a.owner.username}`
            : `You and ${a.owner.username} are friends`,
        );
      else if (a.reason !== "self") setArrival(a.reason === "not_found" ? "That invite link doesn’t work any more." : a.message);
      if (search.invite) go({}, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.kind, search.invite]);

  if (account.kind === "unknown")
    return (
      <PhoneShell skin="profile" bare>
        <SkeletonPage label="Loading your friends" rows={3} />
      </PhoneShell>
    );

  if (account.kind !== "account") {
    if (search.invite) {
      const toAccount = (start: "email" | "signin") =>
        void router.navigate({ to: "/account", search: { from: "/friends", start } as never });
      return (
        <PhoneShell skin="profile" bare>
          {owner === undefined ? (
            <SkeletonPage label="Loading the invite" rows={2} />
          ) : (
            <InviteLanding
              owner={owner}
              onSignUp={() => toAccount("email")}
              onSignIn={() => (owner ? toAccount("signin") : void router.navigate({ to: "/" }))}
            />
          )}
        </PhoneShell>
      );
    }
    return (
      <PhoneShell skin="profile" bare>
        <div className="fr-page" data-friends-screen="gate">
          <AccountGate what="add friends">{null}</AccountGate>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell skin="profile" bare>
      {search.player ? (
        <FriendProfileView key={search.player} playerId={search.player} onBack={back} />
      ) : search.add ? (
        <AddFriend onBack={back} onOpen={(id) => go({ player: id })} adult={!account.isUnder18} />
      ) : (
        <FriendsList
          key={arrival ?? "list"}
          arrival={arrival}
          onBack={back}
          onAdd={() => go({ add: "1" })}
          onOpen={(id) => go({ player: id })}
        />
      )}
    </PhoneShell>
  );
}
