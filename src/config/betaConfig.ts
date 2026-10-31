/**
 * Beta values Joe supplies later (22 Oct 2026). Each is an empty string until it's ready, and an
 * empty string switches its feature off cleanly: nothing shows, nothing loads, nothing errors. A
 * later follow-up only fills the string in here; no other file needs to change.
 *
 * beta-extras-check proves each feature is off while its value is empty and wired when it's set.
 */

/**
 * Crash reporting: the Sentry project's DSN ("Client Keys (DSN)" in the Sentry project's settings),
 * e.g. "https://abc123@o456.ingest.de.sentry.io/789".
 *
 * Empty: Sentry is never loaded or started (src/lib/crashReporting.ts). Set: errors and unhandled
 * promise rejections are reported with the device type, screen size, route, game id and round number
 * only (no names, chat or answers); performance sampling is 0; the release is the build's commit.
 */
export const SENTRY_DSN = "";

/**
 * Feedback form: the Tally form's share link, e.g. "https://tally.so/r/abcd12".
 *
 * Empty: every "Send feedback" link is hidden (Profile, under the podium, under the daily results).
 * Set: the links open it with the device's anonymous id and the app version added to the address as
 * hidden fields `device` and `version` (add hidden fields with those names to the Tally form to
 * see them).
 */
export const TALLY_URL = "";

/**
 * The beta's contact address, shown on the terms page (/terms) as a mailto link.
 *
 * Empty: the terms page leaves the contact line out.
 */
export const CONTACT_EMAIL = "support@joulz.uk";

/**
 * The beta's Discord invite link, e.g. "https://discord.gg/abcd1234" (tab pages refresh, 26 Oct 2026).
 *
 * Empty: the Tournaments tab's "Open the beta Discord" button (shown when no public game is scheduled)
 * is hidden. Set: it opens the link in a new tab.
 */
export const DISCORD_URL = "";

/**
 * Celebrations (Prompt P, 23 Oct 2026; display, sound and animation only): the podium hero, the
 * hero run, the new-best and streak banners, the results count-up, the logo charge-in, the lobby
 * charge meter, the GO lightning and the signature zap (src/lib/fx/celebrations.ts).
 *
 * false: every screen behaves and looks exactly as it did before them (celebrations-check proves it).
 */
export const FX_CELEBRATIONS = true;

/** A round score at least this high sends the Joulz hero running across the screen once. */
export const HERO_RUN_SCORE = 150;

/** 190–199: the hero comes on, dances about 1.5 s and steps off (instead of the run). */
export const HERO_DANCE_SCORE = 190;

/** 200: the hero runs round the screen with fireworks, about 3 s (instead of the run). */
export const HERO_GRAND_SCORE = 200;
