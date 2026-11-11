/**
 * Badges and titles (wave 2, train C, session C2; docs/badges/README.md). The one list, shared by the phone and the
 * server: the 54 permanent badges of docs/art/badges/badges.json (slug, name, group, rarity, coins, in that order)
 * and the titles. The database seeds the same rows (supabase/migrations/20261111220000_badges_titles.sql;
 * badges-check proves table and list match, and both match badges.json and docs/badges/catalogue.md).
 *
 * Earned, never bought; no hidden badges: every badge shows its rule (Joe's approved catalogue, 11 Nov 2026), and a
 * locked counted badge its progress ("4 of 7 days"). `status`:
 *   - earnable: the server checks its rule now (src/lib/badges/rules.server.ts), or another session awards it through
 *               badge_award (Friendly, B1);
 *   - waits:    it needs something not built yet (`waitsFor`): rated play (wave 3), all three stars or Hard and Expert
 *               challenges (wave 3.5), Daily leaderboards and tournaments (wave 4), or C1a's stars and C1b's challenges.
 * Only `earnable` badges can be awarded (the database refuses the rest).
 *
 * Presentation and account data only: nothing here is read by scoring, grading, replay, matchmaking or timing.
 */

import { ACTIVE_PUZZLE_TYPES } from "@/lib/duel/catalogue";

export const BADGE_GROUPS = ["competitive", "mastery", "daily-and-tournaments", "challenges", "fun", "social-and-special"] as const;
export type BadgeGroup = (typeof BADGE_GROUPS)[number];

export const BADGE_GROUP_LABEL: Record<BadgeGroup, string> = {
  competitive: "Competitive",
  mastery: "Mastery",
  "daily-and-tournaments": "Daily and tournaments",
  challenges: "Challenges",
  fun: "Fun",
  "social-and-special": "Social and special",
};

export const BADGE_RARITIES = ["common", "rare", "epic", "elite", "legendary"] as const;
export type BadgeRarity = (typeof BADGE_RARITIES)[number];

export const BADGE_RARITY_LABEL: Record<BadgeRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  elite: "Elite",
  legendary: "Legendary",
};

/** Coins a Legendary badge pays, once (ledger reason badge_reward). */
export const LEGENDARY_BADGE_COINS = 250;
/** The most badges a card shows. */
export const CARD_BADGE_SLOTS = 3;

export type BadgeStatus = "earnable" | "waits";
export type BadgeWait =
  | "rated-play"
  | "all-stars"
  | "hard-challenges"
  | "daily-boards"
  | "tournaments"
  | "mastery-stars"
  | "practice-challenges";

/** What a badge that can't be earned yet is waiting for (shown under its rule). */
export const BADGE_WAIT_LABEL: Record<BadgeWait, string> = {
  "rated-play": "Arrives with rated play",
  "all-stars": "Arrives with all three stars per game",
  "hard-challenges": "Arrives with Hard and Expert challenges",
  "daily-boards": "Arrives with Daily leaderboards",
  tournaments: "Arrives with tournaments",
  "mastery-stars": "Arrives with mastery stars",
  "practice-challenges": "Arrives with Practice challenges",
};

export interface BadgeDef {
  slug: string;
  name: string;
  group: BadgeGroup;
  rarity: BadgeRarity;
  /** 250 for a Legendary, else 0 (badges.json `coins`). */
  coins: number;
  status: BadgeStatus;
  waitsFor: BadgeWait | null;
  /** How it is earned, in plain words (docs/badges/catalogue.md, Joe's approved catalogue of 11 Nov 2026). */
  rule: string;
  /**
   * For a badge earned by a count: the count, and the unit progress is shown in ("4 of 7 days"). `live`: the count
   * follows the game list (All-Rounder: every active game), so the database row stores none.
   */
  target: { need: number; unit: string; live?: true } | null;
}

type Row = [slug: string, name: string, group: BadgeGroup, rarity: BadgeRarity, wait: BadgeWait | null, rule: string, target?: [number, string]];

const C = "competitive";
const M = "mastery";
const D = "daily-and-tournaments";
const H = "challenges";
const F = "fun";
const S = "social-and-special";
const R: BadgeWait = "rated-play";
const T: BadgeWait = "tournaments";
/** Every active game (All-Rounder's count; from the light catalogue, so a new game moves it). */
const ACTIVE_GAME_COUNT = ACTIVE_PUZZLE_TYPES.length;

/**
 * badges.json's order. Rules from docs/badges/catalogue.md (Joe, 11 Nov 2026). `wait` null: the server checks it now
 * (rules.server.ts), or, for Friendly, B1 awards it through badge_award. Waits on C1a / C1b (mastery stars, Practice
 * challenges) lift when those land and their rules are wired.
 */
const ROWS: readonly Row[] = [
  ["first-win", "First Win", C, "common", R, "Win your first rated match."],
  ["placed", "Placed", C, "common", R, "Finish your 5 placement matches.", [5, "matches"]],
  ["hot-streak", "Hot Streak", C, "rare", R, "Win 5 rated matches in a row.", [5, "wins"]],
  ["comeback-kid", "Comeback Kid", C, "rare", R, "Win a best of 3 or 5 after losing the first game."],
  ["clean-sweep", "Clean Sweep", C, "epic", R, "Win a best of 5 without dropping a game."],
  ["podium-regular", "Podium Regular", C, "epic", R, "Finish top 3 in 25 four- or eight-player matches.", [25, "matches"]],
  ["unstoppable", "Unstoppable", C, "elite", R, "Win 10 rated matches in a row.", [10, "wins"]],
  ["giant-slayer", "Giant Slayer", C, "elite", R, "Beat a player rated at least 300 above you."],
  ["storm-chaser", "Storm Chaser", C, "elite", R, "Reach Storm."],
  ["lightning-strikes", "Lightning Strikes", C, "legendary", R, "Reach Lightning."],
  ["top-500", "Top 500", C, "legendary", R, "Be ranked in the Top 500 at any point."],
  // From C1a's stored stars and gems (public.practice_progress, gem_unlocks), wired 11 Nov 2026.
  ["first-star", "First Star", M, "common", null, "Earn your first mastery star."],
  ["flawless", "Flawless", M, "rare", null, "Score 200 in any game."],
  ["all-rounder", "All-Rounder", M, "rare", null, "Earn at least one star in every game.", [ACTIVE_GAME_COUNT, "games"]],
  ["logic-master", "Logic Master", M, "epic", "all-stars", "Earn all three stars in every Logic game."],
  ["word-master", "Word Master", M, "epic", "all-stars", "Earn all three stars in every Word game."],
  ["number-master", "Number Master", M, "epic", "all-stars", "Earn all three stars in every Number game."],
  ["pattern-master", "Pattern Master", M, "epic", "all-stars", "Earn all three stars in every Pattern game."],
  ["speed-master", "Speed Master", M, "epic", "all-stars", "Earn all three stars in every Speed game."],
  ["attention-master", "Attention Master", M, "epic", "all-stars", "Earn all three stars in every Attention game."],
  ["action-master", "Action Master", M, "epic", "all-stars", "Earn all three stars in every Action game."],
  ["retro-master", "Retro Master", M, "epic", "all-stars", "Earn all three stars in every Retro game."],
  ["sports-master", "Sports Master", M, "epic", "all-stars", "Earn all three stars in every Sports game."],
  ["cards-master", "Cards Master", M, "epic", "all-stars", "Earn all three stars in every Cards & Board game."],
  ["strategy-master", "Strategy Master", M, "epic", "all-stars", "Earn all three stars in every Strategy game."],
  ["perfectionist", "Perfectionist", M, "elite", null, "Score 200 in 25 different games.", [25, "games"]],
  ["grand-master", "Grand Master", M, "legendary", "all-stars", "Earn all three stars in every game."],
  ["daily-habit", "Daily Habit", D, "common", null, "Play the Daily 7 days in a row.", [7, "days"]],
  ["dedicated", "Dedicated", D, "rare", null, "Play the Daily 30 days in a row.", [30, "days"]],
  ["daily-top-100", "Daily Top 100", D, "rare", "daily-boards", "Finish in the top 100 of a Daily board."],
  ["century", "Century", D, "elite", null, "Play the Daily 100 days in a row.", [100, "days"]],
  ["daily-champion", "Daily Champion", D, "legendary", "daily-boards", "Finish first on a Daily board."],
  ["entrant", "Entrant", D, "common", T, "Play your first tournament."],
  ["trophy-hunter", "Trophy Hunter", D, "rare", T, "Finish top 3 in any tournament."],
  ["arena-ace", "Arena Ace", D, "epic", T, "Win 8 games in a row in one Arena."],
  ["champion", "Champion", D, "epic", T, "Win your first tournament."],
  ["arena-champion", "Arena Champion", D, "elite", T, "Win an Arena."],
  ["score-attack-champion", "Score Attack Champion", D, "elite", T, "Win a Score Attack."],
  // Awarded by the Category Cup and the Joulz Championship when they finish (W4c; Joe's approval, 11 Nov 2026).
  ["swiss-champion", "Swiss Champion", D, "elite", null, "Win a Swiss tournament."],
  ["knockout-champion", "Knockout Champion", D, "legendary", null, "Win a Knockout final."],
  ["serial-winner", "Serial Winner", D, "legendary", T, "Win 10 tournaments.", [10, "tournaments"]],
  // From C1b's stored completions (public.practice_challenge_progress), wired 11 Nov 2026.
  ["challenger", "Challenger", H, "common", null, "Complete 10 Practice challenges.", [10, "challenges"]],
  ["challenge-seeker", "Challenge Seeker", H, "rare", null, "Complete 50 Practice challenges.", [50, "challenges"]],
  ["challenge-expert", "Challenge Expert", H, "epic", null, "Complete 100 Practice challenges.", [100, "challenges"]],
  ["category-clear", "Category Clear", H, "elite", "hard-challenges", "Complete every challenge in one category."],
  ["completionist", "Completionist", H, "legendary", "hard-challenges", "Complete every Practice challenge."],
  ["revenge", "Revenge", F, "common", R, "Win the rematch after losing to the same player."],
  ["photo-finish", "Photo Finish", F, "rare", R, "Win a rated match by 1 point or less."],
  ["buzzer-beater", "Buzzer Beater", F, "rare", null, "Finish a puzzle with under 1 second left."],
  ["speed-demon", "Speed Demon", F, "epic", null, "Finish a puzzle in under a third of its time, 10 times.", [10, "times"]],
  // Earnable now, but awarded by B1 (friends) through badge_award, not by a rule here (Joe, 11 Nov 2026).
  ["friendly", "Friendly", S, "common", null, "Add 5 friends.", [5, "friends"]],
  ["party-host", "Party Host", S, "rare", null, "Host 25 rooms with at least 3 players.", [25, "rooms"]],
  ["gem-hunter", "Gem Hunter", S, "rare", null, "Unlock your first gem colour."],
  ["founding-player", "Founding Player", S, "legendary", null, "Make an account before 26 January 2027."],
];

export const BADGES: readonly BadgeDef[] = ROWS.map(([slug, name, group, rarity, wait, rule, target]) => ({
  slug,
  name,
  group,
  rarity,
  coins: rarity === "legendary" ? LEGENDARY_BADGE_COINS : 0,
  status: wait ? "waits" : "earnable",
  waitsFor: wait,
  rule,
  target: target ? { need: target[0], unit: target[1], ...(slug === "all-rounder" ? { live: true as const } : {}) } : null,
}));

export const BADGE_BY_SLUG: ReadonlyMap<string, BadgeDef> = new Map(BADGES.map((b) => [b.slug, b]));

export function badgeDef(slug: string): BadgeDef | undefined {
  return BADGE_BY_SLUG.get(slug);
}

/** The line under a locked badge: its rule, and what it waits for when it can't be earned yet. */
export function badgeHowLine(badge: BadgeDef): string {
  return badge.status === "waits" && badge.waitsFor ? `${badge.rule} ${BADGE_WAIT_LABEL[badge.waitsFor]}.` : badge.rule;
}

/** "4 of 7 days" for a counted badge (have capped at need), or null. */
export function badgeProgressLine(badge: BadgeDef, have: number | undefined): string | null {
  if (!badge.target || have === undefined) return null;
  const n = Math.max(0, Math.min(badge.target.need, Math.floor(have)));
  return `${n} of ${badge.target.need} ${badge.target.unit}`;
}

/** Each badge's art (docs/art/badges/svg, copied byte for byte to public/art/badges/). */
export function badgeArtUrl(slug: string): string {
  return `/art/badges/${slug}.svg`;
}

/* ------------------------------------------------------------------ titles */

export type TitleKind = "starter" | "badge" | "season" | "pass";

export interface TitleDef {
  id: string;
  name: string;
  kind: TitleKind;
  /** The badge that unlocks it (kind "badge"). */
  badge: string | null;
}

/** Everyone's starting title. */
export const STARTER_TITLE = "rookie";

/**
 * The title list (session brief, 10 Nov 2026): Rookie, then each badge title with the badge that unlocks it. Season
 * and pass titles ("S1 Storm", Neon Rider, Circuit Breaker) plug into the same list later (kind season / pass).
 */
const TITLE_ROWS: readonly [id: string, name: string, badge: string | null][] = [
  ["rookie", "Rookie", null],
  // Legendary
  ["grand-master", "Grand Master", "grand-master"],
  ["top-500", "Top 500", "top-500"],
  ["daily-champion", "Daily Champion", "daily-champion"],
  ["knockout-champion", "Knockout Champion", "knockout-champion"],
  ["serial-winner", "Serial Winner", "serial-winner"],
  ["completionist", "Completionist", "completionist"],
  ["lightning", "Lightning", "lightning-strikes"],
  ["founding-player", "Founding Player", "founding-player"],
  // Elite
  ["unstoppable", "Unstoppable", "unstoppable"],
  ["giant-slayer", "Giant Slayer", "giant-slayer"],
  ["perfectionist", "Perfectionist", "perfectionist"],
  ["century", "Century", "century"],
  ["storm-chaser", "Storm Chaser", "storm-chaser"],
  // Epic
  ["comeback-kid", "Comeback Kid", "comeback-kid"],
  ["clean-sweeper", "Clean Sweeper", "clean-sweep"],
  ["speed-demon", "Speed Demon", "speed-demon"],
  ["podium-regular", "Podium Regular", "podium-regular"],
  // The category masters
  ["logician", "Logician", "logic-master"],
  ["wordsmith", "Wordsmith", "word-master"],
  ["number-cruncher", "Number Cruncher", "number-master"],
  ["pattern-seeker", "Pattern Seeker", "pattern-master"],
  ["speedster", "Speedster", "speed-master"],
  ["sharp-eye", "Sharp Eye", "attention-master"],
  ["action-hero", "Action Hero", "action-master"],
  ["retro-legend", "Retro Legend", "retro-master"],
  ["sports-star", "Sports Star", "sports-master"],
  ["card-shark", "Card Shark", "cards-master"],
  ["strategist", "Strategist", "strategy-master"],
  // Fun
  ["photo-finisher", "Photo Finisher", "photo-finish"],
  ["buzzer-beater", "Buzzer Beater", "buzzer-beater"],
  ["avenger", "Avenger", "revenge"],
];

export const TITLES: readonly TitleDef[] = TITLE_ROWS.map(([id, name, badge]) => ({
  id,
  name,
  kind: badge ? "badge" : "starter",
  badge,
}));

export const TITLE_BY_ID: ReadonlyMap<string, TitleDef> = new Map(TITLES.map((t) => [t.id, t]));

/** The titles a set of earned badges unlocks (Rookie always first). */
export function titlesUnlocked(earned: ReadonlySet<string>): TitleDef[] {
  return TITLES.filter((t) => t.kind === "starter" || (t.badge !== null && earned.has(t.badge)));
}

/** A title's display name (an unknown id: Rookie). */
export function titleName(id: string | null | undefined): string {
  return TITLE_BY_ID.get(id ?? STARTER_TITLE)?.name ?? "Rookie";
}
