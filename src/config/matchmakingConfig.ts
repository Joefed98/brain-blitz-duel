/**
 * Rated matchmaking's format and choice switches (wave 3, W3b; docs/rated/matchmaking-interface.md "Switches"). Joe
 * flips these by editing this file and merging to main. The server reads them on every queue join, so a switched-off
 * option can't be queued for whatever an older phone sends (`ratedOptionRefusal`, src/lib/rated/matchmaking.ts).
 *
 * Who may play at all is the one shared switch RATED_PLAY_FOR_EVERYONE (src/config/ratedConfig.ts, W3a's file): testers
 * (shop.testers) only while it is false.
 *
 * Decided 11 Nov 2026: the launch set is 1v1 best of 3 with Mixed, All puzzles and All arcade only.
 */

/** Which match formats can be queued for. 4 and 8 players are W3d's; best of 5 and 7 wait for Joe. */
export const RATED_FORMATS_ON = {
  bo3: true,
  bo5: false,
  bo7: false,
  ffa4: false,
  ffa8: false,
} as const;

/** Which category choices can be queued for. Each single category (the room picks) has its own switch, off at launch. */
export const RATED_CHOICES_ON = {
  mixed: true,
  puzzles: true,
  arcade: true,
  word: false,
  number: false,
  speed: false,
  attention: false,
  pattern: false,
  logic: false,
  retro: false,
  sports: false,
  cards: false,
  action: false,
  strategy: false,
} as const;
