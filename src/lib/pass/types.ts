/**
 * What the pass server functions answer (wave 2, session D2; docs/economy/pass.md). Shared by the phone and the server.
 */
import type { PassTrack } from "./rewards";
import type { WeeklyTier } from "./weekly";

export type CellState = "claimed" | "claimable" | "locked";

export interface PassCell {
  track: PassTrack;
  level: number;
  /** coins | ticket | freeze | title | item */
  kind: string;
  title: string;
  detail: string;
  /** An item's rarity (lower case), or null. */
  rarity: string | null;
  itemId: string | null;
  /** The item's kind (card-art, frame, name-colour… : how its picture is drawn), or null. */
  itemKind: string | null;
  state: CellState;
  /** Premium cells for a player without the premium track. */
  needsPremium: boolean;
}

export interface PassWeekly {
  id: string;
  tier: WeeklyTier;
  text: string;
  joules: number;
  done: number;
  need: number;
  completed: boolean;
}

export interface PassView {
  open: true;
  season: { id: string; name: string; test: boolean; endsAt: string | null; daysLeft: number | null; ended: boolean };
  joules: number;
  level: number;
  /** Joules into the current level, and its size. */
  into: number;
  of: number;
  premium: { source: "test" | "purchase" | "plus" } | null;
  /** May use a test purchase (testers only). */
  tester: boolean;
  levels: { level: number; free: PassCell | null; premium: PassCell | null }[];
  claimable: number;
  weekly: { weekStart: string; challenges: PassWeekly[] } | null;
  /** A level reached that the in-app notice hasn't shown yet (null: none). */
  levelNotice: number | null;
}

export type PassClosedReason = "guest" | "not_tester" | "no_season" | "busy" | "error";
export interface PassClosed {
  open: false;
  reason: PassClosedReason;
}

export type PassRefusal = "not_open" | "not_reached" | "needs_premium" | "no_reward" | "not_tester" | "already" | "busy" | "error";
export type PassActionResult = { ok: true; view: PassView } | { ok: false; reason: PassRefusal; message: string };

export const PASS_MESSAGES: Record<PassRefusal, string> = {
  not_open: "The pass isn’t open right now.",
  not_reached: "Reach that level first.",
  needs_premium: "That reward is on the premium track.",
  no_reward: "There’s no reward there.",
  not_tester: "Test purchases are for testers only.",
  already: "You already have the premium track.",
  busy: "That’s a lot of taps. Give it a minute.",
  error: "Something went wrong. Try again.",
};
