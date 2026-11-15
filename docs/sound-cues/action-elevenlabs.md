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


## Moon Climb (`ricochet`)

<!-- moonclimb -->


## Iron Wall (`bastion`)

<!-- ironwall -->


## High Rise (`skyline`)

<!-- highrise -->

Kept as they are: `skyline.perfect` (the crane bell, `skyline.floors.mp3`), the wind (`skyline.gust`, `skyline.gustWarn`),
the floors whoosh (`skyline.floorsStreak`). The drop and the miss have never had recordings (`skyline.drop`,
`skyline.miss` play library clank and crash sounds).

| Slot (drop in as `public/sounds/<slot>.mp3`) | What it is | Material | Feel | Length |
| --- | --- | --- | --- | --- |
| `skyline.drop` | A floor dropping onto the tower: a short falling whistle into a solid landing thud, the tower settling | steel-framed glass floor landing on steel; low air whistle | weighty, satisfying, never harsh | 0.35 s |
| `skyline.miss` | The last life lost: the block misses the tower and plunges, a distant crash far below | steel and glass falling, a muffled street-level crash | a clear "run over" low thud, not scary | 0.6 s |
| `skyline.lifeLost` | A miss that costs a life (the run carries on): the block falls away past the tower | a whoosh of a falling steel beam, a soft far-off clank | a sharp "oops", lighter than the run-over miss | 0.6 s |
| `skyline.trim` | The overhang cut off a floor crumbling away, spinning as it falls | concrete and glass crumbling, small pieces rattling down | crisp crumble, light | 0.7 s |
| `skyline.sliver` | A floor landing on just a sliver of the tower: it wobbles and creaks | steel creaking under strain, a short wobble | tense, a held breath | 0.7 s |
| `skyline.perfect` (replacing today's bell, if Joe prefers) | A perfect drop: a clean "tock" that can be pitched up the streak | a wooden block on a steel beam, very clean | bright, precise, musical | 0.25 s |
| `skyline.wideBlock` | The wide-block rescue arriving after five trims in a row | a crane motor whirr and a soft metallic clunk | helpful, encouraging | 0.4 s |
| (effects stage) `skyline.goldChime` | A gold block landed perfectly (today the shared spark chime) | small bright bell over a coin ring | rich, rewarding | 0.6 s |
| (effects stage) `skyline.endCount` | The end: the camera pulls back over the whole tower while the floors count up | a soft rising tick sequence over a warm city-night pad | proud, calm | 2.5 s |

The two marked "effects stage" get their slots when stage 2 wires the end payoff and the gold moment (their callers
don't exist yet; an unused slot fails sound-manifest-check).


## Orbit (`orbit`)

<!-- orbit -->

