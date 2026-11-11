/**
 * Each earnable badge's rule, checked by the server from what is stored (wave 2, train C, session C2). One entry per
 * badge whose status is "earnable" in catalogue.ts (badges-check fails on an earnable badge without one, or an entry
 * for a badge that isn't earnable). A rule reads only `BadgeFacts`, which badges.server.ts gathers from the database;
 * it never guesses: badges whose rule the approved files don't give are not here (docs/badges/README.md, "Rules").
 *
 * Practice-based rules (when they arrive) count only runs from C1a's fresh start; room, Daily and challenge rules count
 * the history the server already stores.
 */
import { BADGES } from "./catalogue";

export interface BadgeFacts {
  /** profiles.founding: the account was made before 26 Jan 2027 00:00 UK time (accounts.is_founding). */
  founding: boolean;
  /** The account's player number (the Founding Player badge carries it). */
  playerNumber: number;
}

export interface BadgeRule {
  /** Whether the facts earn it. */
  earned(facts: BadgeFacts): boolean;
  /** What the stored badge carries (fixed words and numbers only). */
  detail?(facts: BadgeFacts): Record<string, number | string | boolean>;
}

export const BADGE_RULES: Readonly<Record<string, BadgeRule>> = {
  "founding-player": {
    earned: (f) => f.founding,
    detail: (f) => ({ number: f.playerNumber }),
  },
};

/** The earnable badges, in catalogue order (each has a rule above). */
export const EARNABLE_BADGES: readonly string[] = BADGES.filter((b) => b.status === "earnable").map((b) => b.slug);

/** The badges these facts earn, in catalogue order, with what each carries. */
export function badgesEarnedBy(facts: BadgeFacts): { slug: string; detail: Record<string, number | string | boolean> }[] {
  return EARNABLE_BADGES.flatMap((slug) => {
    const rule = BADGE_RULES[slug];
    if (!rule || !rule.earned(facts)) return [];
    return [{ slug, detail: rule.detail?.(facts) ?? {} }];
  });
}
