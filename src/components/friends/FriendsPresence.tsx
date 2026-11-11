/**
 * The app's presence heartbeat for friends' statuses (wave 2 B1; docs/friends.md), mounted once by the root. Draws
 * nothing. Only a device whose account copy says it is signed in beats (a guest makes no call); see friendsApi.ts
 * `startPresence`.
 */
import { useEffect } from "react";

import { cachedAccount } from "@/lib/account/accountApi";
import { startPresence } from "@/lib/friends/friendsApi";

export function FriendsPresence() {
  useEffect(
    () =>
      startPresence(
        () => cachedAccount() !== null,
        () => (window.location.pathname.startsWith("/practice") ? "practice" : "app"),
      ),
    [],
  );
  return null;
}
