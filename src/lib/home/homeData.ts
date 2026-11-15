/**
 * Home's reads (phase 2 step 3, 14 Nov 2026), each once per app open and shared by the sections that show it:
 * today's Daily play counts (dailyPlayedTodayFn) and an account's friends (B1's overview). Read only.
 */
import { useEffect, useState } from "react";

import type { Overview, OverviewFriend } from "@/lib/data/friends.server";
import { friendsApi } from "@/lib/friends/friendsApi";
import type { DailyPlayedToday } from "./dailyCounts.functions";

let counts: DailyPlayedToday | null = null;
let countsLoading: Promise<DailyPlayedToday | null> | null = null;

/** How many have played today's dailies (null each until known, and below the Daily's 20-player cold start). */
export function useDailyPlayedToday(): DailyPlayedToday | null {
  const [state, setState] = useState<DailyPlayedToday | null>(counts);
  useEffect(() => {
    let live = true;
    countsLoading ??= (async () => {
      try {
        const { dailyPlayedTodayFn } = await import("./dailyCounts.functions");
        const answer = (await dailyPlayedTodayFn({ data: {} })) as DailyPlayedToday | null;
        counts = answer && typeof answer === "object" ? answer : null;
      } catch {
        counts = null;
      }
      return counts;
    })();
    void countsLoading.then((c) => {
      if (live) setState(c);
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

let overview: { who: string; data: Overview | null } | null = null;

/** The account's friends overview (B1), or null (a guest, none yet, or not answered). */
export function useFriendsOverview(accountId: string | null): Overview | null {
  const [state, setState] = useState<Overview | null>(accountId && overview?.who === accountId ? overview.data : null);
  useEffect(() => {
    if (!accountId) return setState(null);
    if (overview?.who === accountId) return setState(overview.data);
    let live = true;
    void friendsApi.overview().then((answer) => {
      const data = answer.ok ? ((answer as { overview?: Overview }).overview ?? null) : null;
      overview = { who: accountId, data };
      if (live) setState(data);
    });
    return () => {
      live = false;
    };
  }, [accountId]);
  return state;
}

const STATUS_RANK: Record<string, number> = { playing: 0, room: 0, practice: 1, online: 1, offline: 2, hidden: 3 };

/**
 * Friends by how recently they were about: playing or in a room first, then online, then by last seen (newest
 * first), then by name. There is no stored "last played together" today, so this is the nearest real signal.
 */
export function friendsByRecent(friends: readonly OverviewFriend[]): OverviewFriend[] {
  const seen = (f: OverviewFriend) => (f.status.kind === "offline" && f.status.lastSeen ? Date.parse(f.status.lastSeen) || 0 : 0);
  return [...friends].sort(
    (a, b) =>
      (STATUS_RANK[a.status.kind] ?? 4) - (STATUS_RANK[b.status.kind] ?? 4) || seen(b) - seen(a) || a.username.localeCompare(b.username),
  );
}
