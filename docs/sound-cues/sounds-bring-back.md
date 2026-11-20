# Sound bring-back (19 Nov 2026)

Joe listened to every sound #453 changed (merge 774e5ddb1) and chose these to play what they played on main just before
that merge (774e5ddb1^1) again. Listening page (Before = main after #453, After = this branch):
https://claude.ai/artifact/K2fPrNTwo2yrA3rGcYH33e

Every recording of Joe's stays in `public/sounds/`, so any of them can be switched back later. Brought-back slots are listed
in `BROUGHT_BACK` (scripts/sound-wiring-nov18/wire.ts), which leaves them as the manifest has them.

- **A (41 slots): their old file**, with the old entry's `ms`, `volume`, `gapMs` and `voices`. Where Joe's recording had
  taken the old file's name, the old bytes are restored as `<slot>.prev.mp3` (`numhunt.shuffle`, `bomb.defuse`,
  `whack.bonk`, `chain.reshuffle`, `reaction.bar`, `swing.streak`, `pipes.flow`, `clayshoot.goldShatter`); files #453
  deleted are restored under their old names (`racing_kerb_loop.mp3`, `ui.select.mp3`, `minigolf_putt.mp3`,
  `move.slide.mp3`, `mines_clear.mp3`, `pz_safe_open.mp3`).
- **B (33 arcade slots): their library sound.** Each slot has no file again, so its moment plays the library stand-in its
  code names, at the same volume and rate as before; the ones the NEW_GAME_SOUNDS switch served are out of their make.py
  recipes (the recipe and its file are kept).
- **C (12 moments, 14 shared sounds):** the shared sound plays with the moment's own sound again (each entry in
  `NEW_GAME_SOUND_REPLACES` / `WIRED_SOUND_REPLACES` keeps its key, its list now empty).
- **D:** Breaker's relaunch is unchanged (the blip, which `breaker.paddle` shares again).
- **E:** Pinball's multiball plays the zap (`shared.celebrate.zap`, `sfx_joulz_zap.mp3`) once for each extra ball, 120 ms
  apart, as before #453 but per ball.
- **F, G:** Spacewalk plays no jet puff on a hop and no traffic loop (Iron Wall's drone is untouched).
- **H:** Curl Champ's collision always plays `curling.hit`.

Not in Joe's list, so unchanged: Gemstone's treasure home has no file and plays `shared.celebrate.countDing` (as before
#453); Coral Pop's boosted shot plays `bubble.fastShot` and Rainbow Bridge's failed drop on a bird plays
`inkbridge.birdScatter` (moments #453 added).

## Slots kept with no file

| Cue | Trigger | Length |
|---|---|---|
| `pinball.multiballStart` | No longer played: multiball plays the zap once a ball (Joe's file kept) | 1.2 s |
| `cross.jetPuff` | No longer played: a hop plays no jet puff (Joe's file kept) | 80 ms |
| `cross.traffic` | No longer played: Spacewalk plays no traffic loop | loop |
