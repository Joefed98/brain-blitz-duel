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

Kept (good recordings, unchanged): `bastion.cannon`, `bastion.reload`, `bastion.fastReload`, `bastion.jam`,
`bastion.loaded`, `bastion.kill`, `bastion.weak`, `bastion.hit`, `bastion.miss`, `bastion.baseHit`, `bastion.wave`, the
drone loop `bastion.drone`, `bastion.droneDown` and the bed `music_bastion`. The cannon recording also covers the
barrel kick and muzzle flash (stage 2 adds only the picture).

| Slot (file `public/sounds/<slot>.mp3`) | What it is | Material | Feel | Length |
| --- | --- | --- | --- | --- |
| `bastion.dry` | Firing with no shell ready (reloading or cooling): a dry click of an empty breech | steel firing pin on an empty chamber | small, dull, disappointing; no boom at all | 0.12 s |
| `bastion.weakTing` | A shell hits an open weak spot: a high bright "ting" on top of the hit, with the gold flash | struck hardened steel, a small bell-like ring | crisp, rewarding, clearly higher than the hit | 0.25 s |
| `bastion.shellIn` | After a fast reload, each shell snapping into the magazine one by one (one click; played per shell in stage 2) | brass shell casing seating in a steel clip | tight, quick, satisfying mechanical snap | 0.09 s |
| `bastion.jamGrind` | The gun jams: a grinding clunk as the breech sticks (on top of `bastion.jam`, with the red shaking needle) | gears grinding, a heavy steel bolt catching | harsh, stuck, short and annoying | 0.7 s |
| `bastion.debris` | After a tank is destroyed: debris and track links clattering down on the road | scrap steel pieces and links falling on packed earth | a scattered patter that settles; tail of the explosion | 0.6 s |
| `bastion.nearMiss` | A shell landing just beside a tank: a dusty "close" whump | earth and grit thrown up, a muffled thump | soft, a near thing, clearly not a hit | 0.35 s |
| `bastion.panelCrack` | A base hit cracks the bottom panel: a sharp crack that stays (after the heavy rumble of `bastion.baseHit`) | thick armoured glass or concrete splitting | sharp, alarming, final | 0.5 s |
| `bastion.wallHeld` | The run ends with the wall standing: "WALL HELD" payoff sting | brass and low drums, a short heroic hit | proud, solid, triumphant but short | 1.8 s |
| `bastion.tally` | Each wave counting up on the end screen (stage 2; the slot is added with the tally) | a soft mechanical counter tick | light, quick, rising a step each wave | 0.15 s |
| `bastion.tip` | The one-time reload tip appears on the panel ("Tip: swipe down to reload early") | a soft downward swish | gentle, helpful, never alarming | 0.3 s |
| `bastion.dustWind` | Ambience bed for waves 3–4, the dusty desert: wind carrying sand across the plain (loops seamlessly) | wind, fine sand hissing | dry, wide, low under the music | 6 s loop |
| `bastion.stormFire` | Ambience bed for wave 5, the battle-smoke storm: distant fires crackling, far booms, wind (loops seamlessly) | burning wrecks, distant artillery, gusts | tense, heavy, distant; under the music | 6 s loop |


## High Rise (`skyline`)

<!-- highrise -->


## Orbit (`orbit`)

<!-- orbit -->

