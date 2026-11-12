/**
 * The Season 1 "Neon Circuit" pass, level by level (wave 2, train D, session D2; docs/economy/economy-design.md
 * "Season 1 pass: free track" and "premium track"; docs/economy/pass.md). Shared by the phone and the server; the
 * server decides what is claimable and pays it. Items are the catalogue's ids (docs/art/wave-2/catalogue.json, its
 * pass levels); pass-check proves both tracks against the economy doc's tables and the catalogue, level by level.
 */

/** Joules a level takes (every level the same). */
export const JOULES_PER_LEVEL = 1000;
/** Levels in a season. */
export const PASS_LEVELS = 60;

export type PassTrack = "free" | "premium";
export type TicketKind = "ticket_score_attack" | "ticket_category_cup";

export type PassReward =
  | { kind: "item"; item: string }
  | { kind: "coins"; coins: number }
  | { kind: "ticket"; ticket: TicketKind }
  | { kind: "freeze" }
  | { kind: "title"; title: PassTitleId };

export interface PassLevelReward {
  level: number;
  track: PassTrack;
  reward: PassReward;
}

/** The two pass titles (C2's title list holds badge titles; these are unlocked by the pass, docs/economy/pass.md). */
export type PassTitleId = "neon-rider" | "circuit-breaker";
export const PASS_TITLES: Record<PassTitleId, string> = { "neon-rider": "Neon Rider", "circuit-breaker": "Circuit Breaker" };

const C: PassReward = { kind: "coins", coins: 100 };
const SA: PassReward = { kind: "ticket", ticket: "ticket_score_attack" };
const CC: PassReward = { kind: "ticket", ticket: "ticket_category_cup" };
const FZ: PassReward = { kind: "freeze" };
const it = (item: string): PassReward => ({ kind: "item", item });

/** Free track: a reward every second level, 30 in all. */
const FREE: Record<number, PassReward> = {
  2: C,
  4: SA,
  6: it("frame.bronze"),
  8: C,
  10: it("name-colour.neon-pink"),
  12: C,
  14: it("game-skin.crazy-golf.neon-glow"),
  16: it("tile-style.circuit-trace"),
  18: C,
  20: SA,
  22: it("reaction.spark"),
  24: C,
  26: it("frame.silver"),
  28: CC,
  30: C,
  32: it("card-art.neon-wave"),
  34: FZ,
  36: it("game-skin.cue-ball.neon-8-ball"),
  38: C,
  40: { kind: "title", title: "neon-rider" },
  42: SA,
  44: C,
  46: FZ,
  48: C,
  50: it("world-theme.crazy-golf.neon-course"),
  52: SA,
  54: FZ,
  56: C,
  58: CC,
  60: it("card-art.neon-skyline"),
};

/** Premium track: a reward at every level, 60 in all. Level 1 (the Neon Captain Joulz helmet) arrives on purchase. */
const PREMIUM: Record<number, PassReward> = {
  1: it("avatar-special-edition.neon-captain-joulz"),
  2: C,
  3: it("name-colour.neon-cyan"),
  4: it("card-back.neon"),
  5: SA,
  6: C,
  7: it("tile-style.neon-grid"),
  8: it("reaction.zap"),
  9: FZ,
  10: it("card-art.neon-pulse"),
  11: C,
  12: it("game-skin.full-house.neon-felt"),
  13: CC,
  14: it("card-art.static"),
  15: C,
  16: it("game-skin.top-bins.neon-football"),
  17: FZ,
  18: it("name-colour.neon-red"),
  19: C,
  20: it("name-colour.neon-flux"),
  21: SA,
  22: it("reaction.neon-signs"),
  23: C,
  24: it("world-theme.curl-champ.neon-rink"),
  25: it("game-skin.curl-champ.neon-stones"),
  26: C,
  27: FZ,
  28: it("reaction.clutch"),
  29: C,
  30: it("celebration.power-surge"),
  31: SA,
  32: it("game-skin.crazy-golf.plasma"),
  33: C,
  34: it("frame.neon-circuit"),
  35: it("name-colour.electric-orange"),
  36: C,
  37: CC,
  38: it("tile-style.neon-dots"),
  39: FZ,
  40: it("avatar-finish.neon-glow"),
  41: C,
  42: it("game-skin.cue-ball.neon-ball-set"),
  43: SA,
  44: it("card-art.grid-runner"),
  45: it("world-theme.apex.neon-night"),
  46: C,
  47: it("game-skin.apex.neon-paint"),
  48: FZ,
  49: it("reaction.live-wire"),
  50: C,
  51: SA,
  52: it("avatar-accessory.neon-bolt"),
  53: C,
  54: it("world-theme.cue-ball.neon-table"),
  55: { kind: "title", title: "circuit-breaker" },
  56: FZ,
  57: C,
  58: it("celebration.circuit-overload"),
  59: CC,
  60: it("card-art.neon-circuit"),
};

/** The premium level whose reward arrives on purchase. */
export const PREMIUM_ON_PURCHASE_LEVEL = 1;

export const PASS_REWARDS: readonly PassLevelReward[] = [
  ...Object.entries(FREE).map(([l, reward]) => ({ level: Number(l), track: "free" as const, reward })),
  ...Object.entries(PREMIUM).map(([l, reward]) => ({ level: Number(l), track: "premium" as const, reward })),
].sort((a, b) => a.level - b.level || (a.track === "free" ? -1 : 1));

export function rewardAt(track: PassTrack, level: number): PassReward | null {
  return (track === "free" ? FREE : PREMIUM)[level] ?? null;
}

/** The level a Joules total reaches (0 to PASS_LEVELS). */
export function levelFor(joules: number): number {
  return Math.max(0, Math.min(PASS_LEVELS, Math.floor(Math.max(0, joules) / JOULES_PER_LEVEL)));
}

/** Joules into the current level (the bar), and the level's size; full at the last level. */
export function levelProgress(joules: number): { level: number; into: number; of: number } {
  const level = levelFor(joules);
  if (level >= PASS_LEVELS) return { level, into: JOULES_PER_LEVEL, of: JOULES_PER_LEVEL };
  return { level, into: Math.max(0, joules) - level * JOULES_PER_LEVEL, of: JOULES_PER_LEVEL };
}

/** Whether a reward is reachable: its level reached (premium level 1 also on purchase). */
export function reached(track: PassTrack, level: number, playerLevel: number, premium: boolean): boolean {
  if (track === "premium" && !premium) return false;
  if (track === "premium" && level === PREMIUM_ON_PURCHASE_LEVEL) return true;
  return level <= playerLevel;
}

const TICKET_NAMES: Record<TicketKind, string> = {
  ticket_score_attack: "Score Attack",
  ticket_category_cup: "Category Cup",
};

/** A reward's words for the pass screen (item names come from the catalogue on the server). */
export function rewardLabel(reward: PassReward, itemName?: string): { title: string; detail: string } {
  switch (reward.kind) {
    case "coins":
      return { title: `${reward.coins} coins`, detail: "Coins" };
    case "ticket":
      return { title: "Ticket", detail: `${TICKET_NAMES[reward.ticket]} · for tournaments, coming soon` };
    case "freeze":
      return { title: "Streak freeze", detail: "Keeps your Daily streak" };
    case "title":
      return { title: `Title: ${PASS_TITLES[reward.title]}`, detail: "Title" };
    case "item":
      return { title: itemName ?? reward.item, detail: "Item" };
  }
}
