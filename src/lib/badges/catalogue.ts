/**
 * Badges and titles (wave 2, train C, session C2; docs/badges/README.md). The one list, shared by the phone and the
 * server: the 54 permanent badges of docs/art/badges/badges.json (slug, name, group, rarity, coins, in that order)
 * and the titles. The database seeds the same rows (supabase/migrations/20261111120000_badges_titles.sql;
 * badges-check proves table and list match, and both match badges.json).
 *
 * Earned, never bought; no hidden badges: a locked badge shows how it is earned (`rule`). Where the approved files
 * give no rule, `rule` is null and the badge can't be earned until Joe supplies it (the screens say so, never a
 * guessed rule). `status`:
 *   - earnable:     its rule is checked by the server now (src/lib/badges/rules.server.ts);
 *   - waits:        it needs something not built yet (`waitsFor`): rated play (wave 3), tournaments (wave 4),
 *                   mastery stars (C1a) or practice challenges (C1b);
 *   - rule_pending: no rule in the approved files yet.
 * Only `earnable` badges can be awarded (the database refuses the rest).
 *
 * Presentation and account data only: nothing here is read by scoring, grading, replay, matchmaking or timing.
 */

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

export type BadgeStatus = "earnable" | "waits" | "rule_pending";
export type BadgeWait = "rated-play" | "tournaments" | "mastery-stars" | "practice-challenges";

export const BADGE_WAIT_LABEL: Record<BadgeWait, string> = {
  "rated-play": "Arrives with rated play",
  tournaments: "Arrives with tournaments",
  "mastery-stars": "Arrives with mastery stars",
  "practice-challenges": "Arrives with practice challenges",
};

/** What a locked badge without a rule says (never a guessed rule). */
export const RULE_PENDING_TEXT = "How to earn this is announced soon.";

export interface BadgeDef {
  slug: string;
  name: string;
  group: BadgeGroup;
  rarity: BadgeRarity;
  /** 250 for a Legendary, else 0 (badges.json `coins`). */
  coins: number;
  status: BadgeStatus;
  waitsFor: BadgeWait | null;
  /** How it is earned, in plain words; null while the approved files give none. */
  rule: string | null;
}

type Row = [slug: string, name: string, group: BadgeGroup, rarity: BadgeRarity, status: BadgeStatus, waitsFor: BadgeWait | null, rule: string | null];

const C = "competitive";
const M = "mastery";
const D = "daily-and-tournaments";
const H = "challenges";
const F = "fun";
const S = "social-and-special";
const P: BadgeStatus = "rule_pending";

/** badges.json's order. Rules: only those the approved files state (see docs/badges/README.md "Rules"). */
const ROWS: readonly Row[] = [
  ["first-win", "First Win", C, "common", P, null, null],
  ["placed", "Placed", C, "common", P, null, null],
  ["hot-streak", "Hot Streak", C, "rare", P, null, null],
  ["comeback-kid", "Comeback Kid", C, "rare", P, null, null],
  ["clean-sweep", "Clean Sweep", C, "epic", P, null, null],
  ["podium-regular", "Podium Regular", C, "epic", P, null, null],
  ["unstoppable", "Unstoppable", C, "elite", P, null, null],
  ["giant-slayer", "Giant Slayer", C, "elite", P, null, null],
  ["storm-chaser", "Storm Chaser", C, "elite", "waits", "rated-play", null],
  ["lightning-strikes", "Lightning Strikes", C, "legendary", "waits", "rated-play", null],
  ["top-500", "Top 500", C, "legendary", "waits", "rated-play", null],
  ["first-star", "First Star", M, "common", "waits", "mastery-stars", null],
  ["flawless", "Flawless", M, "rare", P, null, null],
  ["all-rounder", "All-Rounder", M, "rare", "waits", "mastery-stars", null],
  ["logic-master", "Logic Master", M, "epic", "waits", "mastery-stars", null],
  ["word-master", "Word Master", M, "epic", "waits", "mastery-stars", null],
  ["number-master", "Number Master", M, "epic", "waits", "mastery-stars", null],
  ["pattern-master", "Pattern Master", M, "epic", "waits", "mastery-stars", null],
  ["speed-master", "Speed Master", M, "epic", "waits", "mastery-stars", null],
  ["attention-master", "Attention Master", M, "epic", "waits", "mastery-stars", null],
  ["action-master", "Action Master", M, "epic", "waits", "mastery-stars", null],
  ["retro-master", "Retro Master", M, "epic", "waits", "mastery-stars", null],
  ["sports-master", "Sports Master", M, "epic", "waits", "mastery-stars", null],
  ["cards-master", "Cards Master", M, "epic", "waits", "mastery-stars", null],
  ["strategy-master", "Strategy Master", M, "epic", "waits", "mastery-stars", null],
  ["perfectionist", "Perfectionist", M, "elite", P, null, null],
  ["grand-master", "Grand Master", M, "legendary", "waits", "mastery-stars", null],
  ["daily-habit", "Daily Habit", D, "common", P, null, null],
  ["dedicated", "Dedicated", D, "rare", P, null, null],
  ["daily-top-100", "Daily Top 100", D, "rare", P, null, null],
  ["century", "Century", D, "elite", P, null, null],
  ["daily-champion", "Daily Champion", D, "legendary", P, null, null],
  ["entrant", "Entrant", D, "common", "waits", "tournaments", null],
  ["trophy-hunter", "Trophy Hunter", D, "rare", "waits", "tournaments", null],
  ["arena-ace", "Arena Ace", D, "epic", "waits", "tournaments", null],
  ["champion", "Champion", D, "epic", "waits", "tournaments", null],
  ["arena-champion", "Arena Champion", D, "elite", "waits", "tournaments", null],
  ["score-attack-champion", "Score Attack Champion", D, "elite", "waits", "tournaments", null],
  ["swiss-champion", "Swiss Champion", D, "elite", "waits", "tournaments", null],
  ["knockout-champion", "Knockout Champion", D, "legendary", "waits", "tournaments", null],
  ["serial-winner", "Serial Winner", D, "legendary", "waits", "tournaments", null],
  ["challenger", "Challenger", H, "common", "waits", "practice-challenges", null],
  ["challenge-seeker", "Challenge Seeker", H, "rare", "waits", "practice-challenges", null],
  ["challenge-expert", "Challenge Expert", H, "epic", "waits", "practice-challenges", null],
  ["category-clear", "Category Clear", H, "elite", "waits", "practice-challenges", null],
  ["completionist", "Completionist", H, "legendary", "waits", "practice-challenges", null],
  ["revenge", "Revenge", F, "common", P, null, null],
  ["photo-finish", "Photo Finish", F, "rare", P, null, null],
  ["buzzer-beater", "Buzzer Beater", F, "rare", P, null, null],
  ["speed-demon", "Speed Demon", F, "epic", P, null, null],
  ["friendly", "Friendly", S, "common", P, null, null],
  ["party-host", "Party Host", S, "rare", P, null, null],
  ["gem-hunter", "Gem Hunter", S, "rare", P, null, null],
  ["founding-player", "Founding Player", S, "legendary", "earnable", null, "Make an account before 26 January 2027."],
];

export const BADGES: readonly BadgeDef[] = ROWS.map(([slug, name, group, rarity, status, waitsFor, rule]) => ({
  slug,
  name,
  group,
  rarity,
  coins: rarity === "legendary" ? LEGENDARY_BADGE_COINS : 0,
  status,
  waitsFor,
  rule,
}));

export const BADGE_BY_SLUG: ReadonlyMap<string, BadgeDef> = new Map(BADGES.map((b) => [b.slug, b]));

export function badgeDef(slug: string): BadgeDef | undefined {
  return BADGE_BY_SLUG.get(slug);
}

/** The line under a locked badge: its rule, what it waits for, or that its rule is coming. */
export function badgeHowLine(badge: BadgeDef): string {
  if (badge.rule) return badge.status === "waits" && badge.waitsFor ? `${badge.rule} ${BADGE_WAIT_LABEL[badge.waitsFor]}.` : badge.rule;
  if (badge.status === "waits" && badge.waitsFor) return `${BADGE_WAIT_LABEL[badge.waitsFor]}.`;
  return RULE_PENDING_TEXT;
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
