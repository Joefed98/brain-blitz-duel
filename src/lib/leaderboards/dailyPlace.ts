/**
 * Your place on today's Daily top 100 (Joe, 13 Nov 2026: /daily's own line shows an account's place on the one board,
 * the Daily top 100; a guest's line shows their score without a place). Read through the board's own call
 * (leaderboardsApi.daily, scope top100): the server decides the place, this only reads it. Guests ask nothing.
 */
import { useEffect, useState } from "react";

import { ordinal } from "@/lib/duel/ordinal";

import { dailyMeLine, type DailyBoardKind, type DailyMeReason } from "./boards";
import { leaderboardsApi } from "./leaderboardsApi";

export interface DailyTopPlace {
  /** Your place on today's top 100, or null (not on it yet, or not counted). */
  rank: number | null;
  /** Why there is no place, in plain words (null when there's nothing to say). */
  note: string | null;
}

/** "12th on the Daily top 100". */
export function dailyTopPlaceLine(rank: number): string {
  return `${ordinal(rank)} on the Daily top 100`;
}

/**
 * Today's place for an account (null for a guest, before the board answers, or when it can't be read). `refreshKey`
 * asks again (e.g. once the Daily is finished).
 */
export function useDailyTopPlace(kind: DailyBoardKind, isAccount: boolean, refreshKey: unknown): DailyTopPlace | null {
  const [place, setPlace] = useState<DailyTopPlace | null>(null);
  useEffect(() => {
    if (!isAccount) {
      setPlace(null);
      return;
    }
    let live = true;
    void leaderboardsApi.daily({ kind, scope: "top100" }).then((answer) => {
      if (!live) return;
      if (!answer.ok) return setPlace(null);
      const me = answer.page.me;
      const reason = (answer.page.meReason ?? null) as DailyMeReason | null;
      setPlace({ rank: me ? me.rank : null, note: me ? null : dailyMeLine(reason) });
    });
    return () => {
      live = false;
    };
  }, [kind, isAccount, refreshKey]);
  return place;
}
