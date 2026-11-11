/**
 * A display-only copy of the last practice progress the server sent (wave 2 C1a, Joe's decision of 11 Nov 2026), so
 * Practice still shows stars and bests when it opens offline after a restart. The server stays the only source:
 * this copy is written only from the server's own answers (getMyPracticeProgressFn and a graded run's `progress`),
 * shown until the server answers again, and never sent to the server, read by grading or trusted for anything
 * (progress-cache-check proves it). One copy per device, under its player's auth id: another player's copy is never
 * shown. A queued run waiting on the phone is never in it.
 */
import { PRACTICE_LEVELS, type PracticeLevel } from "./progressRules";
import type { GameLevelProgress, PracticeProgressView } from "./progress";

export const PROGRESS_CACHE_KEY = "duelz-practice-view:v1";

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The view held to its shape (anything else dropped); the refresh note is never shown from a copy. */
export function cleanView(raw: unknown): PracticeProgressView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const games: PracticeProgressView["games"] = {};
  if (r["games"] && typeof r["games"] === "object") {
    for (const [type, levels] of Object.entries(r["games"] as Record<string, unknown>)) {
      if (!/^[a-z0-9]{1,32}$/i.test(type) || !levels || typeof levels !== "object") continue;
      for (const level of PRACTICE_LEVELS) {
        const g = (levels as Record<string, unknown>)[level] as Record<string, unknown> | undefined;
        const best = num(g?.["best"]);
        if (!g || best === null || best < 0) continue;
        const entry: GameLevelProgress = { best, star: g["star"] === true, starScore: num(g["starScore"]) };
        (games[type] ??= {})[level as PracticeLevel] = entry;
      }
    }
  }
  const stars = num(r["stars"]);
  return {
    games,
    stars: stars !== null && stars >= 0 ? Math.floor(stars) : 0,
    gems: Array.isArray(r["gems"]) ? (r["gems"] as unknown[]).filter((g): g is string => typeof g === "string").slice(0, 10) : [],
    noteSeen: true,
    freshStartAt: typeof r["freshStartAt"] === "string" ? r["freshStartAt"] : null,
  };
}

/** Keeps the server's latest view for this player (display only). */
export function saveShownProgress(player: string, view: PracticeProgressView): void {
  const clean = cleanView(view);
  if (!player || !clean) return;
  try {
    store()?.setItem(PROGRESS_CACHE_KEY, JSON.stringify({ player, view: clean }));
  } catch {
    /* storage blocked: nothing kept */
  }
}

/** The kept view for this player, or null (none, another player's, or unreadable). */
export function readShownProgress(player: string | null): PracticeProgressView | null {
  if (!player) return null;
  try {
    const raw = store()?.getItem(PROGRESS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { player?: unknown; view?: unknown };
    return parsed.player === player ? cleanView(parsed.view) : null;
  } catch {
    return null;
  }
}
