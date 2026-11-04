# Sound cues: the Action polish (3 Nov 2026)

Grappler's jungle canopy (swingRev 17, display only) has its own cues in place of the cave's, each on a library recording
until Joe's own files arrive (the slots are in `src/lib/fx/manifest.ts`, the rows in [arcade.md](arcade.md) and
[arcade-effects.md](arcade-effects.md)):

| Slot | When | Plays today | Deserves a new ElevenLabs sound |
| --- | --- | --- | --- |
| `swing.vineCreak` | The vine catches (a grab) | `ricochet.lanternGrab.mp3` (volume 0.7) | Yes: a short creak of a thick vine taking weight, a leafy rustle on the tail, 300–450 ms |
| `swing.splash` | A miss drops the hero into the river (a squeeze's trunk or rock too: the observer can't tell them apart) | `minigolf_splash.mp3` | Yes: a body-sized splash into a jungle river, 600–800 ms |
| `swing.pterodactyl` | The pterodactyl swoops in over the last quarter | `clayshoot.birdStartle.mp3` (volume 0.8) | Yes: a prehistoric screech with a wing whoosh, about 600 ms |
| `swing.pteroCatch` | The pterodactyl catches the hero | `clayshoot.birdStartle.mp3` (rate 0.85) | Yes: a lower screech and a snap, about 600 ms |
| `swing.jungle` | Loop while the run is live | none (silent) | Yes: a seamless 6 s jungle bed (distant birds, insects, a river's murmur), quiet under the music |

The cave's cues (`swing.grapple`, `swing.crash`, `swing.dragon`, `swing.lava`) keep playing on every earlier revision.
