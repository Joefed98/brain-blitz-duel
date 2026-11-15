/**
 * The new game sounds (the November game reviews, docs/sound-cues/review-nov-2026.md): one switch for every file
 * `scripts/sound-review-nov-2026/make.py` made for a game moment that had no sound of its own (Box Six's digit,
 * Hanoi's ring, Polypotions' pour, Hover's gate, Breaker's paddle, Tilt's roll…; the full list is
 * `NEW_GAME_SOUND_FILES` in src/lib/fx/newGameSounds.data.ts).
 *
 * false (the default): every cue plays exactly what it plays today; the files are never fetched.
 * true: those slots play their new file (src/lib/fx/manifest.ts sets them at load), each in place of the shared
 * sound the moment played before (the arcade moments' library sound, a puzzle move's `move` tick, the solve's
 * generic `correct` / `lock`).
 *
 * Every new sound can be heard on /dev-design (development only), "Sounds", whatever this says.
 */
export const NEW_GAME_SOUNDS = false;
