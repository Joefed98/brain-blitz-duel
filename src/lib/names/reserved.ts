/**
 * Reserved names (10 Nov 2026, accounts): the one list of names that stand for the app, its mascot or its staff. Used
 * by every name check (usernames, guest room names, the daily's and challenges' board names; src/lib/names/names.server.ts
 * and src/lib/duel/displayName.server.ts), on the name's letters after look-alikes are folded
 * (src/lib/names/lookalike.ts: 0→o, 1→i or l, 3→e, 4→a, 5→s, 7→t, @→a, $→s, repeated letters).
 *
 * Joe: add or remove words here; lower-case letters only.
 */

/** Refused anywhere in a name ("TheJoulzTeam", "Captain_Joulz", "duelz4ever"). */
export const RESERVED_ANYWHERE: readonly string[] = ["joulz", "duelz", "captainjoulz"];

/**
 * Refused as a whole name or as one word of it ("Admin", "admin_99", "Mod Squad"), never as part of a longer word
 * ("Badminton", "Modest", "Supportive" are fine).
 */
export const RESERVED_WORDS: readonly string[] = [
  "admin",
  "admins",
  "administrator",
  "sysadmin",
  "root",
  "staff",
  "support",
  "helpdesk",
  "moderator",
  "moderators",
  "moderation",
  "mod",
  "mods",
  "official",
  "system",
  "security",
  "noreply",
  "deletedplayer",
  "anonymous",
];
