/**
 * Each earnable badge's rule, checked by the server from what is stored (wave 2, train C, session C2; the rules are
 * Joe's approved catalogue, docs/badges/catalogue.md, 11 Nov 2026). One entry per badge whose status is "earnable" in
 * catalogue.ts, except the ones another session awards through badge_award (`AWARDED_ELSEWHERE`: Friendly, B1);
 * badges-check fails on an earnable badge with neither, and has an earn and a just-miss test for each rule.
 *
 * A rule reads only `BadgeFacts`, gathered by badges.server.ts from the database (public.badge_facts, the Daily record,
 * the profile). Practice counts only from C1a's fresh start (`PRACTICE_SINCE`, null until C1a sets it); rooms, the
 * Daily and challenges count the history the server already stores.
 */
import { BADGES } from "./catalogue";

export interface BadgeFacts {
  /** profiles.founding: the account was made before 26 Jan 2027 00:00 UK time (accounts.is_founding). */
  founding: boolean;
  /** The account's player number (the Founding Player badge carries it). */
  playerNumber: number;
  /** Different games scored 200 in (any mode). */
  games200: number;
  /** Puzzles finished with under 1 second left. */
  buzzerFinishes: number;
  /** Puzzles finished in under a third of their time. */
  fastFinishes: number;
  /** The longest run of consecutive UK days with the Daily played (the server's streak rule). */
  bestDailyStreak: number;
  /** Today's Daily streak (for locked progress). */
  dailyStreak: number;
  /** Room games hosted with at least 3 players. */
  hostedRooms: number;
  /** Gem colours unlocked (C1a writes public.gem_unlocks). */
  gems: number;
}

export interface BadgeRule {
  /** Whether the facts earn it. */
  earned(facts: BadgeFacts): boolean;
  /** Progress towards a counted badge (shown as "4 of 7 days" while locked). */
  progress?(facts: BadgeFacts): number;
  /** What the stored badge carries (fixed words and numbers only). */
  detail?(facts: BadgeFacts): Record<string, number | string | boolean>;
}

/** Badges another session awards through public.badge_award (no rule here). */
export const AWARDED_ELSEWHERE: readonly string[] = ["friendly"];

/** Practice runs count from C1a's fresh start (an ISO time); null: Practice doesn't count yet. */
export const PRACTICE_SINCE: string | null = null;

const atLeast = (need: number, of: (f: BadgeFacts) => number): BadgeRule => ({
  earned: (f) => of(f) >= need,
  progress: of,
});

export const BADGE_RULES: Readonly<Record<string, BadgeRule>> = {
  flawless: atLeast(1, (f) => f.games200),
  perfectionist: atLeast(25, (f) => f.games200),
  "daily-habit": { earned: (f) => f.bestDailyStreak >= 7, progress: (f) => f.dailyStreak },
  dedicated: { earned: (f) => f.bestDailyStreak >= 30, progress: (f) => f.dailyStreak },
  century: { earned: (f) => f.bestDailyStreak >= 100, progress: (f) => f.dailyStreak },
  "buzzer-beater": atLeast(1, (f) => f.buzzerFinishes),
  "speed-demon": atLeast(10, (f) => f.fastFinishes),
  "party-host": atLeast(25, (f) => f.hostedRooms),
  "gem-hunter": atLeast(1, (f) => f.gems),
  "founding-player": {
    earned: (f) => f.founding,
    detail: (f) => ({ number: f.playerNumber }),
  },
};

/** The badges whose rule this server checks, in catalogue order. */
export const EARNABLE_BADGES: readonly string[] = BADGES.filter(
  (b) => b.status === "earnable" && !AWARDED_ELSEWHERE.includes(b.slug),
).map((b) => b.slug);

/** The badges these facts earn, in catalogue order, with what each carries. */
export function badgesEarnedBy(facts: BadgeFacts): { slug: string; detail: Record<string, number | string | boolean> }[] {
  return EARNABLE_BADGES.flatMap((slug) => {
    const rule = BADGE_RULES[slug];
    if (!rule || !rule.earned(facts)) return [];
    return [{ slug, detail: rule.detail?.(facts) ?? {} }];
  });
}

/** Progress on every counted rule (slug → count so far). */
export function badgeProgress(facts: BadgeFacts): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slug of EARNABLE_BADGES) {
    const p = BADGE_RULES[slug]?.progress;
    if (p) out[slug] = p(facts);
  }
  return out;
}
