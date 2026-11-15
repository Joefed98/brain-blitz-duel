# Action games: sounds for ElevenLabs (phase 2 step 4)

The Action overhaul (Roofbound, Grappler, Moon Climb, Iron Wall, High Rise, Orbit). Each game's existing sounds were
checked first; the ones that are good stay. Every action that needs a new or better sound has one line here: what it is,
the material, the feel and the length.

**How a file drops in.** Each line names a manifest slot (`src/lib/fx/manifest.ts`). The slot is wired already with
`url: null` and a library fallback, so the game plays today's stand-in. Generate the sound, save it as
`public/sounds/<slot>.mp3`, and set the slot's `url` to `/sounds/<slot>.mp3` (one line); run
`scripts/sound-audit-nov-2026/measure.py` and the levelling pass as for the November files.

## Roofbound (`flip`)

<!-- roofbound -->


## Grappler (`swing`)

<!-- grappler -->
Kept (Joe's 6 Nov 2026 recordings, good as they are): `swing.vineCreak` (grab), `swing.release`, `swing.land`,
`swing.gate`, `swing.splash` (a miss into the river), `swing.pterodactyl` (its screech as it swoops in),
`swing.pteroCatch`, the `swing.wings` and `swing.slideVine` loops, the `swing.jungle` ambience and `music_swing`.
`swing.streak` stays as the streak block's sound until the arpeggio below replaces it.

| Slot (`public/sounds/<slot>.mp3`) | When | What to generate | Length |
|---|---|---|---|
| `swing.ropeSnap` | Every grab, on top of the vine creak (wired) | A thick jungle vine snapping taut: a short fibrous rope crack with a woody thump, dry, close | 0.2 s |
| `swing.speedWhoosh` | A release fast enough to light a speed gate (wired) | A fast air whoosh passing close, rising then cut off, bright and clean, no wind roar | 0.45 s |
| `swing.courseCleared` | The whole course cleared, "COURSE CLEARED!" (wired) | A triumphant jungle sting: wooden marimba run up into a bright brass-and-drum hit, jungle-adventure feel | 1.6 s |
| `swing.streak` (replace the file) | Every 8 clean grabs, the streak meter bursting | A rising four-note arpeggio on a bright wooden marimba with a soft shimmer on the last note, quick and happy | 0.6 s |
| `swing.streakMeter` | Each clean grab filling the streak meter (stage 2) | One soft wooden marimba tick, pitched up a step per grab, very short and quiet | 0.12 s |
| `swing.outOfReach` | A press with the nearest vine just out of reach (stage 2) | A dull, soft wooden "thock" with a short falling pitch: a miss without drama | 0.3 s |
| `swing.pteroShadow` | The pterodactyl's shadow sweeping across before it appears (stage 2) | A low leathery wing gust sweeping left to right overhead, distant, ominous, no screech | 1.2 s |
| `swing.stretchTally` | The end screen counting the stretches up (stage 2) | A tiny bright wooden click, like a bead on an abacus, dry | 0.09 s |


## Moon Climb (`ricochet`)

<!-- moonclimb -->


## Iron Wall (`bastion`)

<!-- ironwall -->


## High Rise (`skyline`)

<!-- highrise -->


## Orbit (`orbit`)

<!-- orbit -->

