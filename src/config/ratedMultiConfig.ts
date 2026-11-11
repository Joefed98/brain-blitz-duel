/**
 * Rated 4- and 8-player matches (wave 3, session W3d; docs/rated/multiplayer.md). Built now, kept off at launch
 * (decided 11 Nov 2026: a small beta isn't split across many queues). One switch for each size.
 *
 * Off: the picker shows neither size (it shows only what is switched on), and the server refuses a queue request
 * for that size (`joinMultiQueue` in src/lib/rated/multi/multi.server.ts, RatedMultiOffError). Nothing else reads
 * these. To switch a size on, Joe sets its line to true and merges; there is no browser or console override.
 */
export const RATED_FOUR_PLAYERS_ENABLED = false;
export const RATED_EIGHT_PLAYERS_ENABLED = false;

export interface RatedMultiSwitches {
  four: boolean;
  eight: boolean;
}

export const RATED_MULTI_SWITCHES: RatedMultiSwitches = {
  four: RATED_FOUR_PLAYERS_ENABLED,
  eight: RATED_EIGHT_PLAYERS_ENABLED,
};
