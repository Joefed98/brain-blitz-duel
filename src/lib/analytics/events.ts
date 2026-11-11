/**
 * Our own analytics (9 Nov 2026; docs/analytics.md): the fixed list of events, shared by the phone and the server.
 * The table is `analytics.events` (supabase/migrations/20261109140000_analytics_events.sql), whose CHECK holds the
 * same list. The server records most events itself (src/lib/data/events.server.ts); the phone may send only the
 * five in CLIENT_EVENTS, through recordClientEventsFn (src/lib/analytics/analytics.functions.ts).
 */

export const ANALYTICS_EVENTS = [
  "app_opened",
  "game_started",
  "game_finished",
  "room_created",
  "room_joined",
  "room_started",
  "room_finished",
  "daily_started",
  "daily_finished",
  "challenge_created",
  "challenge_played",
  "share_tapped",
  "invite_opened",
  "error_shown",
  "offline_game_played",
  // Accounts (10 Nov 2026, docs/accounts/README.md): recorded by the server only (src/lib/account/). sign_up_completed
  // and sign_in carry props.method; under_thirteen_refused never carries a date of birth or an age.
  "sign_up_started",
  "sign_up_completed",
  "sign_in",
  "sign_out",
  "username_changed",
  "account_deletion_requested",
  "under_thirteen_refused",
  // Safety (10 Nov 2026, docs/moderation.md): report_sent carries props.reason only (never the message or who was
  // reported), chat_muted nothing more, moderation_action props.type only (written by the moderation functions).
  "report_sent",
  "chat_muted",
  "moderation_action",
  // Save your progress (10 Nov 2026, the sign-up screens): recorded by the server only, through recordSaveProgressFn
  // (src/lib/account/saveProgress.functions.ts), which accepts these three and nothing else.
  "save_progress_shown",
  "save_progress_tapped",
  "save_progress_dismissed",
  // Coins and items (10 Nov 2026, docs/economy/README.md): recorded by the server only (src/lib/economy/economy.server.ts
  // and the economy admin functions). coins_credited and coins_spent carry props.reason and props.amount,
  // item_granted props.kind, props.rarity and props.source, item_equipped props.kind.
  "coins_credited",
  "coins_spent",
  "item_granted",
  "item_equipped",
  // Identity screens (wave 2, session A2): recorded by the server only, through recordIdentityEventFn
  // (src/lib/identity/identityEvents.functions.ts), which accepts these three with fixed-word props and nothing else.
  // equip_refused carries props.slot and props.reason (A1's refusal type). A1 records item_equipped itself.
  "profile_viewed",
  "customise_opened",
  "equip_refused",
  // Badges and titles (wave 2, session C2; docs/badges/README.md): recorded by the server only (src/lib/badges/
  // badges.server.ts and the backfill). badge_earned carries props.badge and props.rarity, title_equipped props.title.
  "badge_earned",
  "title_equipped",
  // Practice progress (wave 2 C1a, docs/practice-progress.md): recorded by the server only, when a graded practice run
  // is counted (src/lib/practice/progress.server.ts). best_set and star_earned carry the game and props.level,
  // gem_unlocked props.gem.
  "star_earned",
  "best_set",
  "gem_unlocked",
  // Practice challenges (wave 2 C1b, docs/challenges/catalogue.md): recorded by the server only
  // (src/lib/challenges/challenges.server.ts) when a graded Practice run completes one. game is the game, props.challenge
  // the challenge id, props.level its level, props.coins the coins paid with it (0 for a guest, paid on becoming an account).
  "challenge_completed",
  // The shop (wave 2, session D1; docs/economy/shop.md): recorded by the server only (src/lib/shop/shop.server.ts).
  // shop_viewed props.section, item_bought props.coins, props.item and props.rarity, bundle_bought props.bundle,
  // props.coins and props.items, pack_bought props.pack, props.coins and props.test, wishlist_added props.item.
  "shop_viewed",
  "item_bought",
  "bundle_bought",
  "pack_bought",
  "wishlist_added",
  // Joulz Plus (wave 2, session E2; docs/economy/plus.md): recorded by the server only (src/lib/plus/plus.server.ts,
  // src/lib/plus/archive.server.ts; Joe's plus.start_test). plus_bought props.plan and props.test, plus_perk_granted
  // props.perk (coins | freezes) and props.month, daily_archive_played props.kind and props.day.
  "plus_bought",
  "plus_perk_granted",
  "daily_archive_played",
  // The Season pass (wave 2, session D2; docs/economy/pass.md): recorded by the server only (src/lib/pass/pass.server.ts).
  // pass_bought props.season and props.test, pass_level_reached props.season and props.level, reward_claimed
  // props.season, props.track, props.level and props.kind, weekly_challenge_completed props.tier and props.challenge.
  "pass_bought",
  "pass_level_reached",
  "reward_claimed",
  "weekly_challenge_completed",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** The moments only the phone sees. Everything else is recorded by the server and refused from the phone. */
export const CLIENT_EVENTS = [
  "app_opened",
  "share_tapped",
  "invite_opened",
  "error_shown",
  "offline_game_played",
] as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[number];

export const ANALYTICS_MODES = ["room", "daily", "challenge", "practice"] as const;
export type AnalyticsMode = (typeof ANALYTICS_MODES)[number];

/** The most events the phone sends in one call, and the most it keeps queued while offline. */
export const CLIENT_BATCH_MAX = 20;
export const CLIENT_QUEUE_MAX = 100;

/** An event queued on the phone may be at most this old when it arrives; older ones are dropped. */
export const CLIENT_EVENT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** What the phone sends for one event. Never a score, a result or a player id: the server records those. */
export interface ClientEventInput {
  event: ClientEventName;
  /** When it happened on the phone (ms since the epoch); the server's time when missing or out of range. */
  at?: number;
  /** A game id, for offline_game_played. */
  game?: string;
  /** Small extras: a short error code, a share source, a screen. Strings, numbers and booleans only. */
  props?: Record<string, string | number | boolean>;
}
