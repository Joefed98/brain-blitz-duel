/**
 * What the badge and title server functions answer (wave 2, train C, session C2). Shared by the phone and the server.
 */

export interface EarnedBadge {
  slug: string;
  /** ISO time. */
  earnedAt: string;
  /** The Founding Player's number, when the badge carries one. */
  number: number | null;
  /** Whether the badge-earned moment has been shown. */
  seen: boolean;
}

export type MyBadges =
  | {
      account: true;
      earned: EarnedBadge[];
      /** The card's badges, in order (up to 3). */
      card: string[];
      /** The equipped title's id (Rookie when none was chosen). */
      title: string;
      /** Earned badges whose moment hasn't been shown, oldest first. */
      unseen: string[];
      /** Progress on counted badges the server checks (slug → count so far; "4 of 7 days"). */
      progress: Record<string, number>;
      /** The Season pass titles unlocked (Neon Rider, Circuit Breaker; wave 2 D2), equippable. */
      passTitles?: string[];
      /** The season titles granted at a season's end ("S1 Storm"; wave 4 W4d), equippable. */
      seasonTitles?: string[];
    }
  | { account: false };

export type BadgeRefusal = "guest" | "too_many" | "duplicate" | "not_earned" | "unknown_title" | "busy" | "error";

export type BadgeChangeResult = { ok: true; badges: MyBadges } | { ok: false; reason: BadgeRefusal; message: string };

/** Another player's badges and title for their card. */
export interface CardBadges {
  playerId: string;
  badges: string[];
  /** The title's id (Rookie: "rookie"). */
  title: string;
  foundingNumber: number | null;
}

/** The Daily record on the account (or guest): the same on every device. */
export interface DailyAccountRecord {
  /** Today's UK day key. */
  today: string;
  /** UK days a Daily was started (latest year). */
  days: string[];
  /** Days a streak freeze covered. */
  frozenDays: string[];
  /** Best finished totals per kind. */
  best: Partial<Record<"puzzle" | "arcade", number>>;
  /** Finished totals by day and kind. */
  totals: Record<string, Partial<Record<"puzzle" | "arcade", number>>>;
  streak: number;
  playedToday: boolean;
  /** Freezes used by this call (they are recorded on the account). */
  freezesUsed: string[];
}
