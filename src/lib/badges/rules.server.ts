/**
 * Each earnable badge's rule, checked by the server from what is stored (wave 2, train C, session C2; the rules are
 * Joe's approved catalogue, docs/badges/catalogue.md, 11 Nov 2026). One entry per badge whose status is "earnable" in
 * catalogue.ts, except the ones another session awards through badge_award (`AWARDED_ELSEWHERE`: Friendly, B1);
 * badges-check fails on an earnable badge with neither, and has an earn and a just-miss test for each rule.
 *
 * A rule reads only `BadgeFacts`, gathered by badges.server.ts from the database (public.badge_facts, the Daily record,
 * the profile). Practice counts only from C1a's fresh start (public.practice_progress_start, read by badge_facts);
 * rooms, the Daily and challenges count the history the server already stores.
 */
import type { TierId } from "@/lib/data/ratings";
import { ACTIVE_PUZZLE_TYPES } from "@/lib/duel/catalogue";
import { tierRank } from "@/lib/rated/tiers";

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
  /** Practice challenges completed (C1b's public.practice_challenge_progress, completed_at set). */
  challengesDone: number;
  /** Mastery stars (C1a's public.practice_progress, Easy / Classic / Hard). */
  stars: number;
  /** Active games with at least one star. */
  starredGames: number;
  /** Gem colours unlocked (C1a's public.gem_unlocks). */
  gems: number;
  /**
   * Rated play (wave 3 W3a, public.rated_badge_facts: the server's own record of every rated match, kept by
   * recordRatedMatch). Matches frozen by the 4th-match rule count for none of these.
   */
  rated: RatedFacts;
}

/** The competitive badges' counts (all 0, tier null, for a player who hasn't played rated). */
export interface RatedFacts {
  wins: number;
  /** The current run of rated wins (Hot Streak / Unstoppable progress). */
  winStreak: number;
  bestWinStreak: number;
  placementPlayed: number;
  comebacks: number;
  cleanSweeps: number;
  /** Top-3 finishes in 4- and 8-player matches. */
  podiums: number;
  giantSlayers: number;
  revenges: number;
  photoFinishes: number;
  /** The highest tier ever shown (null before placement). */
  peakTier: TierId | null;
  /** Ever shown as Top 500. */
  top500Ever: boolean;
}

export const NO_RATED_FACTS: RatedFacts = {
  wins: 0,
  winStreak: 0,
  bestWinStreak: 0,
  placementPlayed: 0,
  comebacks: 0,
  cleanSweeps: 0,
  podiums: 0,
  giantSlayers: 0,
  revenges: 0,
  photoFinishes: 0,
  peakTier: null,
  top500Ever: false,
};

export interface BadgeRule {
  /** Whether the facts earn it. */
  earned(facts: BadgeFacts): boolean;
  /** Progress towards a counted badge (shown as "4 of 7 days" while locked). */
  progress?(facts: BadgeFacts): number;
  /** What the stored badge carries (fixed words and numbers only). */
  detail?(facts: BadgeFacts): Record<string, number | string | boolean>;
}

/** Badges another session awards through public.badge_award (no rule here). */
export const AWARDED_ELSEWHERE: readonly string[] = [
  "friendly",
  // Tournaments (wave 4, W4b; src/lib/tournaments/tournaments.server.ts), earnable since 11 Nov 2026.
  "entrant",
  "trophy-hunter",
  "arena-ace",
  "champion",
  "arena-champion",
  "score-attack-champion",
  "serial-winner",
  // The Category Cup and the Joulz Championship (wave 4, W4c; src/lib/tournaments/eventsFlow.server.ts), earnable since
  // 11 Nov 2026 (Joe's approval in the W4c prompt).
  "swiss-champion",
  "knockout-champion",
];


const atLeast = (need: number, of: (f: BadgeFacts) => number): BadgeRule => ({
  earned: (f) => of(f) >= need,
  progress: of,
});

/** A rated count (missing facts, as for a player who hasn't played rated, count as 0). */
const rated = (need: number, of: (r: RatedFacts) => number): BadgeRule => atLeast(need, (f) => of(f.rated ?? NO_RATED_FACTS));
const reached = (tier: TierId): BadgeRule => ({
  earned: (f) => {
    const peak = (f.rated ?? NO_RATED_FACTS).peakTier;
    return peak !== null && tierRank(peak) >= tierRank(tier);
  },
});

export const BADGE_RULES: Readonly<Record<string, BadgeRule>> = {
  // Rated play (docs/badges/catalogue.md; earnable since wave 3 W3a, 11 Nov 2026).
  "first-win": rated(1, (r) => r.wins),
  placed: rated(5, (r) => r.placementPlayed),
  "hot-streak": { earned: (f) => (f.rated ?? NO_RATED_FACTS).bestWinStreak >= 5, progress: (f) => (f.rated ?? NO_RATED_FACTS).winStreak },
  "comeback-kid": rated(1, (r) => r.comebacks),
  "clean-sweep": rated(1, (r) => r.cleanSweeps),
  "podium-regular": rated(25, (r) => r.podiums),
  unstoppable: { earned: (f) => (f.rated ?? NO_RATED_FACTS).bestWinStreak >= 10, progress: (f) => (f.rated ?? NO_RATED_FACTS).winStreak },
  "giant-slayer": rated(1, (r) => r.giantSlayers),
  "storm-chaser": reached("storm"),
  "lightning-strikes": reached("lightning"),
  "top-500": { earned: (f) => (f.rated ?? NO_RATED_FACTS).top500Ever },
  revenge: rated(1, (r) => r.revenges),
  "photo-finish": rated(1, (r) => r.photoFinishes),
  flawless: atLeast(1, (f) => f.games200),
  perfectionist: atLeast(25, (f) => f.games200),
  "daily-habit": { earned: (f) => f.bestDailyStreak >= 7, progress: (f) => f.dailyStreak },
  dedicated: { earned: (f) => f.bestDailyStreak >= 30, progress: (f) => f.dailyStreak },
  century: { earned: (f) => f.bestDailyStreak >= 100, progress: (f) => f.dailyStreak },
  "buzzer-beater": atLeast(1, (f) => f.buzzerFinishes),
  "speed-demon": atLeast(10, (f) => f.fastFinishes),
  "party-host": atLeast(25, (f) => f.hostedRooms),
  "first-star": atLeast(1, (f) => f.stars),
  "all-rounder": atLeast(ACTIVE_PUZZLE_TYPES.length, (f) => f.starredGames),
  "gem-hunter": atLeast(1, (f) => f.gems),
  challenger: atLeast(10, (f) => f.challengesDone),
  "challenge-seeker": atLeast(50, (f) => f.challengesDone),
  "challenge-expert": atLeast(100, (f) => f.challengesDone),
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
