# Sound cues: the Action polish (3 Nov 2026)

Grappler's jungle canopy (swingRev 17, display only) has its own cues in place of the cave's, each on a library recording
until Joe's own files arrive. The slots are in `src/lib/fx/manifest.ts`, their rows in [arcade.md](arcade.md) and
[arcade-effects.md](arcade-effects.md); this note only says which deserve a new ElevenLabs recording (all of them):

- **swing.vineCreak** (a grab; plays the library's `ricochet.lanternGrab.mp3` at 0.7): a short creak of a thick vine taking
  weight with a leafy rustle on the tail, 300–450 ms.
- **swing.splash** (a miss drops the hero into the river; the observer can't tell a squeeze's trunk or rock from the river,
  so those splash too; plays `minigolf_splash.mp3`): a body-sized splash into a jungle river, 600–800 ms.
- **swing.pterodactyl** (it swoops in over the last quarter; plays `clayshoot.birdStartle.mp3` at 0.8): a prehistoric
  screech with a wing whoosh, about 600 ms.
- **swing.pteroCatch** (it catches the hero; the same file at rate 0.85): a lower screech and a snap, about 600 ms.
- **swing.jungle** (the bed while the run is live; silent today): a seamless 6 s jungle loop (distant birds, insects, a
  river's murmur), quiet under the music.

The cave's cues (swing.grapple, swing.crash, swing.dragon, swing.lava) keep playing on every earlier revision.

**6 Nov 2026:** Joe's recordings are wired for all of these but `swing.pteroCatch` (no new file; it keeps the library's
screech), plus new jungle slots ([retheme-nov-2026.md](retheme-nov-2026.md)).
