/**
 * Seasons on the server (wave 4, session W4d; docs/seasons/README.md). A player's season standing and history for
 * Profile, the reward notice, the season titles, and the two calls the ratings engine (W3a) makes: note each rated
 * match in its season, and read how many placement matches a player has (3 after a season reset, else 5).
 *
 * Closing a season, granting its rewards and resetting the ratings are Joe's alone (pass.close_season /
 * pass.close_test_season in the database); nothing in the app can trigger them.
 */
import { TIERS, type TierId } from "@/lib/data/ratings";
import {
  markSeasonRewardSeen,
  noteSeasonRatedMatch,
  readSeasonPlacement,
  readSeasonTitles,
  readSeasonView,
  type NoteRatedMatchStatus,
} from "@/lib/data/seasons.server";
import type { Db } from "@/lib/data/db.server";
import { readProfile } from "@/lib/data/profiles.server";

import { FIRST_PLACEMENT_MATCHES, placementLabel, placementReveal } from "./rules";
import type { CurrentSeason, MySeasons, SeasonHistoryEntry } from "./types";

const isTier = (v: unknown): v is TierId => typeof v === "string" && (TIERS as readonly string[]).includes(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function record(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** The database's season_view shaped for the phone (anything malformed is left out, never guessed). */
export function shapeSeasonView(raw: unknown): { current: CurrentSeason | null; history: SeasonHistoryEntry[] } {
  const view = record(raw);
  const cur = record(view?.["current"]);
  const current: CurrentSeason | null =
    cur && str(cur["season"])
      ? {
          season: str(cur["season"])!,
          name: str(cur["name"]) ?? "",
          test: cur["test"] === true,
          mark: str(cur["mark"]) ?? "",
          ratedMatches: num(cur["rated_matches"]),
          placementDone: cur["placement_done"] === true,
          peak: isTier(cur["peak_tier"]) ? cur["peak_tier"] : null,
          peakLabel: isTier(cur["peak_tier"]) ? str(cur["peak_label"]) : null,
        }
      : null;
  const list = Array.isArray(view?.["history"]) ? (view!["history"] as unknown[]) : [];
  const history: SeasonHistoryEntry[] = [];
  for (const item of list) {
    const h = record(item);
    if (!h || !str(h["season"]) || !isTier(h["tier"])) continue;
    history.push({
      season: str(h["season"])!,
      name: str(h["name"]) ?? "",
      test: h["test"] === true,
      mark: str(h["mark"]) ?? "",
      tier: h["tier"],
      peakLabel: str(h["peak_label"]) ?? "",
      ratedMatches: num(h["rated_matches"]),
      frame: str(h["frame"]),
      title: str(h["title"]),
      grantedAt: str(h["granted_at"]) ?? "",
      seen: h["seen"] === true,
    });
  }
  return { current, history };
}

/** The account's seasons (a guest: account false). */
export async function mySeasons(client: Db, userId: string, nowMs: number = Date.now()): Promise<MySeasons> {
  const profile = await readProfile(client, userId);
  if (profile.error) throw new Error(`seasons: ${profile.error.message}`);
  if (!profile.data || profile.data.deletion_requested_at !== null) return { account: false };
  const view = await readSeasonView(client, userId, new Date(nowMs).toISOString());
  if (view.error) throw new Error(`seasons: ${view.error.message}`);
  return { account: true, ...shapeSeasonView(view.data) };
}

/** The reward notice shown: marks that season's reward seen. */
export async function seasonRewardSeen(client: Db, userId: string, seasonId: unknown): Promise<{ ok: boolean }> {
  if (typeof seasonId !== "string" || !/^[a-z0-9][a-z0-9-]{0,23}$/.test(seasonId)) return { ok: false };
  const out = await markSeasonRewardSeen(client, userId, seasonId);
  return { ok: !out.error && (out.data === "seen" || out.data === "already") };
}

/** The season titles this account holds (for Customise's title list). */
export async function seasonTitlesFor(client: Db, userId: string): Promise<string[]> {
  const out = await readSeasonTitles(client, userId);
  if (out.error) throw new Error(`seasons: ${out.error.message}`);
  return out.data;
}

/* ------------------------------------------------------------------ for the ratings engine (W3a) */

/**
 * W3a's recordRatedMatch calls this once per live player after a rated match is stored: the tier shown after the
 * match (TierView.tier, so a cap-held player's capped tier) or null while in placement. Recorded runs' owners are
 * not noted (their match isn't played live). Idempotent on the match id.
 */
export async function noteRatedMatchInSeason(
  client: Db,
  input: { userId: string; matchId: string; finishedAt: string; tier: TierId | null; tierLabel: string | null; placementDone: boolean },
): Promise<NoteRatedMatchStatus> {
  const out = await noteSeasonRatedMatch(client, {
    userId: input.userId,
    matchId: input.matchId,
    at: input.finishedAt,
    tier: input.placementDone ? input.tier : null,
    tierLabel: input.placementDone && input.tier ? input.tierLabel : null,
    placementDone: input.placementDone,
  });
  if (out.error || !out.data) throw new Error(`seasons: ${out.error?.message ?? "no answer"}`);
  return out.data;
}

export interface SeasonPlacement {
  /** Placement matches in this placement: 5 the first time, 3 after a season reset. */
  of: number;
  /** Matches count from here (the reset), or from the start (null). */
  since: string | null;
  /** The reveal at its end: the full one, or W3c's smaller one after a reset. */
  reveal: "full" | "small";
}

/** How many placement matches the player has now (W3a counts the rated matches since `since`). */
export async function placementFor(client: Db, userId: string): Promise<SeasonPlacement> {
  const out = await readSeasonPlacement(client, userId);
  if (out.error) throw new Error(`seasons: ${out.error.message}`);
  const raw = record(out.data);
  const of = typeof raw?.["of"] === "number" ? (raw["of"] as number) : FIRST_PLACEMENT_MATCHES;
  return { of, since: str(raw?.["since"]), reveal: placementReveal(of) };
}

/** "Placement 2 of 3" for a player who has played `played` matches of their placement. */
export function placementLabelFor(placement: SeasonPlacement, played: number): string | null {
  return placementLabel(played, placement.of);
}
