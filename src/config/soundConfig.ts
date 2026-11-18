/**
 * The new game sounds (the November game reviews, docs/sound-cues/review-nov-2026.md): one switch for every file
 * `scripts/sound-review-nov-2026/make.py` made or measured for a game moment that had no sound of its own (Box Six's
 * digit, Hanoi's ring, Polypotions' pour, Breaker's paddle, Tilt's roll…; the full list is `NEW_GAME_SOUND_FILES` in
 * src/lib/fx/newGameSounds.data.ts). Most of those files are now Joe's own recordings under the placeholder's name.
 *
 * true (on since 18 Nov 2026, Joe's sound wiring): those slots play their file (src/lib/fx/manifest.ts sets them at
 * load), each in place of the shared sound the moment played before (the arcade moments' library sound, a puzzle
 * move's `move` tick, the solve's generic `correct` / `lock`).
 * false: every such cue plays what it played before the new sounds; the files are never fetched.
 *
 * Every new sound can be heard on /dev-design (development only), "Sounds", whatever this says.
 */
export const NEW_GAME_SOUNDS = true;
