/**
 * Weekly challenges (wave 2, session D2; docs/economy/economy-design.md "Weekly challenges"; docs/economy/pass.md).
 * Three every Monday at midnight UK, the same for everyone: one Easy (500 Joules), one Medium (750), one Hard (1,250),
 * expiring the next Monday. The pool is the economy doc's 45, in its order; challenges needing rated play (R, wave 3)
 * or tournaments (Score Attack, Arena: wave 4) are left out of the draw until those exist. None need friends; any
 * difficulty level counts. Each week's three have three different categories (`tag`), so the set spreads.
 *
 * Progress is worked out on the server from stored results only (pass.server.ts reads them; `progressOf` here is pure).
 */
import { WEEKLY_JOULES } from "./joules";

export type WeeklyTier = "easy" | "medium" | "hard";
export const WEEKLY_TIERS: readonly WeeklyTier[] = ["easy", "medium", "hard"];

/** The eleven categories: the six puzzle categories and the five arcade groups. */
export type GameCategory =
  | "word"
  | "number"
  | "speed"
  | "attention"
  | "pattern"
  | "logic"
  | "retro"
  | "sports"
  | "cards"
  | "action"
  | "strategy";
export const GAME_CATEGORIES: readonly GameCategory[] = [
  "word",
  "number",
  "speed",
  "attention",
  "pattern",
  "logic",
  "retro",
  "sports",
  "cards",
  "action",
  "strategy",
];

/** One stored game played (a room round, a Daily or friend-challenge round, a Practice run). */
export interface PlayedGame {
  mode: "room" | "daily_puzzle" | "daily_arcade" | "challenge" | "practice";
  game: string;
  category: GameCategory | null;
  score: number;
  /** UK day (YYYY-MM-DD). */
  day: string;
}

/** What a week's progress is worked out from (all inside the week and the season). */
export interface WeekActivity {
  games: PlayedGame[];
  /** Games a star was earned in (C1a's stars), one entry per star. */
  stars: string[];
  /** Practice challenges completed (C1b), one entry each. */
  practiceChallenges: number;
  /** Games this player had played before the week (for "a game you've never played"). */
  playedBefore: ReadonlySet<string>;
}

export type WeeklyRule =
  | { k: "daily_days"; kind: "puzzle" | "arcade"; need: number }
  | { k: "both_dailies_days"; need: number }
  | { k: "plays"; need: number; category?: GameCategory; mode?: "practice"; min?: number; distinct?: boolean }
  | { k: "categories"; need: number }
  | { k: "new_game"; need: number }
  | { k: "stars"; need: number; distinct?: boolean }
  | { k: "daily_score"; kinds: ("puzzle" | "arcade")[]; min: number }
  | { k: "practice_challenges"; need: number }
  | { k: "rated" }
  | { k: "tournament" };

export interface WeeklyChallenge {
  id: string;
  tier: WeeklyTier;
  text: string;
  /** The category it nudges towards (a game category, or the Daily, Practice or any game). */
  tag: GameCategory | "daily" | "practice" | "any";
  rule: WeeklyRule;
}

const R = { k: "rated" } as const;
const T = { k: "tournament" } as const;

/** The economy doc's pool of 45, in its order (ids e1–e15, m1–m15, h1–h15). */
export const WEEKLY_POOL: readonly WeeklyChallenge[] = [
  { id: "e1", tier: "easy", text: "Play the Daily Puzzle on 3 different days", tag: "daily", rule: { k: "daily_days", kind: "puzzle", need: 3 } },
  { id: "e2", tier: "easy", text: "Play the Daily Arcade on 3 different days", tag: "daily", rule: { k: "daily_days", kind: "arcade", need: 3 } },
  { id: "e3", tier: "easy", text: "Play 5 rated matches", tag: "any", rule: R },
  { id: "e4", tier: "easy", text: "Play 10 games in any mode", tag: "any", rule: { k: "plays", need: 10 } },
  { id: "e5", tier: "easy", text: "Play a game in 5 different categories", tag: "any", rule: { k: "categories", need: 5 } },
  { id: "e6", tier: "easy", text: "Play 3 games of a game you’ve never played", tag: "any", rule: { k: "new_game", need: 3 } },
  { id: "e7", tier: "easy", text: "Score 120+ in any 5 games", tag: "any", rule: { k: "plays", need: 5, min: 120 } },
  { id: "e8", tier: "easy", text: "Play 4 Word games", tag: "word", rule: { k: "plays", need: 4, category: "word" } },
  { id: "e9", tier: "easy", text: "Play 4 Sports games", tag: "sports", rule: { k: "plays", need: 4, category: "sports" } },
  { id: "e10", tier: "easy", text: "Play both Dailies on the same day, twice", tag: "daily", rule: { k: "both_dailies_days", need: 2 } },
  { id: "e11", tier: "easy", text: "Play 3 Strategy games", tag: "strategy", rule: { k: "plays", need: 3, category: "strategy" } },
  { id: "e12", tier: "easy", text: "Win 2 rated matches", tag: "any", rule: R },
  { id: "e13", tier: "easy", text: "Play 5 games in Practice", tag: "practice", rule: { k: "plays", need: 5, mode: "practice" } },
  { id: "e14", tier: "easy", text: "Play 3 Retro games", tag: "retro", rule: { k: "plays", need: 3, category: "retro" } },
  { id: "e15", tier: "easy", text: "Play 3 Attention games", tag: "attention", rule: { k: "plays", need: 3, category: "attention" } },

  { id: "m1", tier: "medium", text: "Win 3 Sports games in rated matches", tag: "sports", rule: R },
  { id: "m2", tier: "medium", text: "Earn a star in any game", tag: "practice", rule: { k: "stars", need: 1 } },
  { id: "m3", tier: "medium", text: "Score 150+ in 3 different Number games", tag: "number", rule: { k: "plays", need: 3, category: "number", min: 150, distinct: true } },
  { id: "m4", tier: "medium", text: "Win 4 rated matches", tag: "any", rule: R },
  { id: "m5", tier: "medium", text: "Score 150+ on the Daily Arcade", tag: "daily", rule: { k: "daily_score", kinds: ["arcade"], min: 150 } },
  { id: "m6", tier: "medium", text: "Score 150+ on the Daily Puzzle", tag: "daily", rule: { k: "daily_score", kinds: ["puzzle"], min: 150 } },
  { id: "m7", tier: "medium", text: "Complete 2 Practice challenges", tag: "practice", rule: { k: "practice_challenges", need: 2 } },
  { id: "m8", tier: "medium", text: "Score 140+ in 5 different games", tag: "any", rule: { k: "plays", need: 5, min: 140, distinct: true } },
  { id: "m9", tier: "medium", text: "Win 3 Logic games in rated matches", tag: "logic", rule: R },
  { id: "m10", tier: "medium", text: "Play a game in all 11 categories", tag: "any", rule: { k: "categories", need: 11 } },
  { id: "m11", tier: "medium", text: "Score 160+ in 2 Cards & Board games", tag: "cards", rule: { k: "plays", need: 2, category: "cards", min: 160 } },
  { id: "m12", tier: "medium", text: "Win a rated best of 3 by 2–0", tag: "any", rule: R },
  { id: "m13", tier: "medium", text: "Score 150+ in 3 Action games", tag: "action", rule: { k: "plays", need: 3, category: "action", min: 150 } },
  { id: "m14", tier: "medium", text: "Finish a Score Attack tournament", tag: "any", rule: T },
  { id: "m15", tier: "medium", text: "Score 150+ in 3 Pattern games", tag: "pattern", rule: { k: "plays", need: 3, category: "pattern", min: 150 } },

  { id: "h1", tier: "hard", text: "Score 180+ in 3 different Logic games", tag: "logic", rule: { k: "plays", need: 3, category: "logic", min: 180, distinct: true } },
  { id: "h2", tier: "hard", text: "Earn stars in 2 different games", tag: "practice", rule: { k: "stars", need: 2, distinct: true } },
  { id: "h3", tier: "hard", text: "Win 8 rated matches", tag: "any", rule: R },
  { id: "h4", tier: "hard", text: "Score 175+ on both the Daily Puzzle and the Daily Arcade", tag: "daily", rule: { k: "daily_score", kinds: ["puzzle", "arcade"], min: 175 } },
  { id: "h5", tier: "hard", text: "Win 3 rated matches in a row", tag: "any", rule: R },
  { id: "h6", tier: "hard", text: "Score 180+ in 3 Speed games", tag: "speed", rule: { k: "plays", need: 3, category: "speed", min: 180 } },
  { id: "h7", tier: "hard", text: "Complete 4 Practice challenges", tag: "practice", rule: { k: "practice_challenges", need: 4 } },
  { id: "h8", tier: "hard", text: "Score 170+ in 6 different games", tag: "any", rule: { k: "plays", need: 6, min: 170, distinct: true } },
  { id: "h9", tier: "hard", text: "Score 185+ in any Retro game", tag: "retro", rule: { k: "plays", need: 1, category: "retro", min: 185 } },
  { id: "h10", tier: "hard", text: "Win a rated match in each of 4 different categories", tag: "any", rule: R },
  { id: "h11", tier: "hard", text: "Score 180+ in 2 Strategy games", tag: "strategy", rule: { k: "plays", need: 2, category: "strategy", min: 180 } },
  { id: "h12", tier: "hard", text: "Finish in the top 25% of a Score Attack", tag: "any", rule: T },
  { id: "h13", tier: "hard", text: "Score 175+ in 3 Word games", tag: "word", rule: { k: "plays", need: 3, category: "word", min: 175 } },
  { id: "h14", tier: "hard", text: "Win 2 Arena duels in a row", tag: "any", rule: T },
  { id: "h15", tier: "hard", text: "Score 180+ in 3 Sports games", tag: "sports", rule: { k: "plays", need: 3, category: "sports", min: 180 } },
];

export const WEEKLY_BY_ID: ReadonlyMap<string, WeeklyChallenge> = new Map(WEEKLY_POOL.map((c) => [c.id, c]));

/** Whether a challenge can be drawn now: not rated play (wave 3) and not tournaments (wave 4). */
export function drawable(c: WeeklyChallenge): boolean {
  return c.rule.k !== "rated" && c.rule.k !== "tournament";
}

/** The first Monday the weekly draw counts from (week 0). */
export const WEEKLY_EPOCH = "2026-01-05";

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of a UK day's week. */
export function weekStartOf(day: string): string {
  const wd = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -wd);
}

export function nextWeek(weekStart: string): string {
  return addDays(weekStart, 7);
}

function weekIndex(weekStart: string): number {
  return Math.round((Date.parse(`${weekStart}T12:00:00Z`) - Date.parse(`${WEEKLY_EPOCH}T12:00:00Z`)) / (7 * 86_400_000));
}

function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A seeded shuffle (mulberry32 from the hash): the same order on every server. */
function shuffled<T>(list: readonly T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface WeeklySet {
  weekStart: string;
  easy: string;
  medium: string;
  hard: string;
}

/**
 * The week's three, from the week alone (the same on every server and for everyone): each tier walks a seeded order of
 * its drawable challenges, one cycle through before any repeats, and takes the first whose category the week doesn't
 * already have (Easy, then Medium, then Hard). The server records the picks (public.pass_weeks) the first time a week
 * is seen, so a later pool change never changes a week already shown.
 */
export function weeklySetFor(weekStart: string, pool: readonly WeeklyChallenge[] = WEEKLY_POOL): WeeklySet {
  const n = weekIndex(weekStart);
  const used = new Set<string>();
  const pick = (tier: WeeklyTier): string => {
    const list = pool.filter((c) => c.tier === tier && drawable(c));
    const size = list.length;
    const cycle = Math.floor(n / size);
    const order = shuffled(list, hash32(`weekly:${tier}:${cycle}`));
    const start = ((n % size) + size) % size;
    for (let i = 0; i < size; i++) {
      const c = order[(start + i) % size]!;
      if (!used.has(c.tag)) {
        used.add(c.tag);
        return c.id;
      }
    }
    return order[start]!.id;
  };
  return { weekStart, easy: pick("easy"), medium: pick("medium"), hard: pick("hard") };
}

export function weeklyJoules(tier: WeeklyTier): number {
  return WEEKLY_JOULES[tier];
}

/* ------------------------------------------------------------------ progress (pure) */

export interface WeeklyProgress {
  done: number;
  need: number;
}

/** A challenge's progress this week from the stored activity. */
export function progressOf(c: WeeklyChallenge, a: WeekActivity): WeeklyProgress {
  const r = c.rule;
  switch (r.k) {
    case "daily_days": {
      const mode = r.kind === "puzzle" ? "daily_puzzle" : "daily_arcade";
      return { done: Math.min(r.need, new Set(a.games.filter((g) => g.mode === mode).map((g) => g.day)).size), need: r.need };
    }
    case "both_dailies_days": {
      const puz = new Set(a.games.filter((g) => g.mode === "daily_puzzle").map((g) => g.day));
      const arc = new Set(a.games.filter((g) => g.mode === "daily_arcade").map((g) => g.day));
      return { done: Math.min(r.need, [...puz].filter((d) => arc.has(d)).length), need: r.need };
    }
    case "plays": {
      const list = a.games.filter(
        (g) => (!r.category || g.category === r.category) && (!r.mode || g.mode === r.mode) && (r.min === undefined || g.score >= r.min),
      );
      const n = r.distinct ? new Set(list.map((g) => g.game)).size : list.length;
      return { done: Math.min(r.need, n), need: r.need };
    }
    case "categories": {
      const cats = new Set(a.games.map((g) => g.category).filter((x): x is GameCategory => x !== null));
      return { done: Math.min(r.need, cats.size), need: r.need };
    }
    case "new_game": {
      const counts = new Map<string, number>();
      for (const g of a.games) if (!a.playedBefore.has(g.game)) counts.set(g.game, (counts.get(g.game) ?? 0) + 1);
      return { done: Math.min(r.need, Math.max(0, ...counts.values())), need: r.need };
    }
    case "stars": {
      const n = r.distinct ? new Set(a.stars).size : a.stars.length;
      return { done: Math.min(r.need, n), need: r.need };
    }
    case "daily_score": {
      const done = r.kinds.filter((k) => a.games.some((g) => g.mode === (k === "puzzle" ? "daily_puzzle" : "daily_arcade") && g.score >= r.min)).length;
      return { done, need: r.kinds.length };
    }
    case "practice_challenges":
      return { done: Math.min(r.need, a.practiceChallenges), need: r.need };
    case "rated":
    case "tournament":
      return { done: 0, need: 1 };
  }
}
