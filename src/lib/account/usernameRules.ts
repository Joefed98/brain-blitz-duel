/**
 * When a username may change (10 Nov 2026, accounts), shared by the phone (to say when) and the server (which
 * decides; public.rename_profile holds the race):
 *
 * - one free change within FREE_CHANGE_DAYS (7) of sign-up;
 * - otherwise one change every CHANGE_EVERY_DAYS (90), counted from the last change that counts (the free one
 *   included), or from sign-up when there has been none;
 * - a rename forced by moderation counts towards neither;
 * - a released name is held HOLD_DAYS (30) for its old owner before anyone else may take it.
 */

export const FREE_CHANGE_DAYS = 7;
export const CHANGE_EVERY_DAYS = 90;
export const HOLD_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RenameState {
  created_at: string;
  username_changed_at: string | null;
  free_change_used: boolean;
}

export type RenameAllowance = { kind: "free" | "limited" } | { kind: "wait"; nextAt: string };

export function renameAllowance(profile: RenameState, nowMs: number): RenameAllowance {
  const created = Date.parse(profile.created_at);
  if (!profile.free_change_used && nowMs < created + FREE_CHANGE_DAYS * DAY_MS) return { kind: "free" };
  const since = profile.username_changed_at ? Date.parse(profile.username_changed_at) : created;
  const next = since + CHANGE_EVERY_DAYS * DAY_MS;
  if (nowMs >= next) return { kind: "limited" };
  return { kind: "wait", nextAt: new Date(next).toISOString() };
}

/** The plain sentence for a change that must wait. */
export function renameWaitMessage(nextAt: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(
    new Date(nextAt),
  );
  return `You can change your username again on ${day}.`;
}
