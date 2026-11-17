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

Kept as they are (good already): `flip.crackStart` and `flip.collapse` (cracking and crumbling tiles), `flip.speedUp`
(the tunnel rush every 9 s), `flip.sweetLanding` (the spark chime under the gold PERFECT), `flip.surviveStreak` (every
10 s), `flip.survivedFinish` (the end banner) and the bed `music_flip`. The flip and crash have never had their own
recordings (library stand-ins); the rest below are new moments.

| What it is | Slot | Material and feel | Length |
| --- | --- | --- | --- |
| Gravity flips and the runner rises to the roof | `flip.flipUp` | a short airy whoosh whose pitch sweeps up, a faint electric shimmer at the end | 0.25–0.3 s |
| Gravity flips and the runner drops to the floor | `flip.flipDown` | the same whoosh sweeping down, slightly heavier | 0.25–0.3 s |
| The runner hits a spike, overhang or lava pool | `flip.crash` | a hard stony thud with a hiss of hot rock and a short metallic clang of the suit; harsh but brief | 0.2–0.3 s |
| After a crash the runner blinks back and runs on (flipRev 13's grace) | `flip.respawn` | a quick tape-rewind zip ending in a soft electric pop; reassuring, not punishing | 0.4–0.5 s |
| A landing on the stone lip (every flip) | `flip.land` | a small soft thud of boots on stone with a little grit; very short, quiet, must not tire on repeat | 0.1–0.18 s |
| Each clean landing adds 1 to the flow streak (pitched up by the game along the streak) | `flip.flowTick` | a clean bright synth pluck, glassy, one note | 0.12–0.16 s |
| Every 10th clean landing in a row | `flip.flowTen` | the same pluck with a sparkling second note on top, a brighter step | 0.25–0.3 s |
| A crash breaks a flow streak of 3 or more | `flip.flowBreak` | a dull falling two-note tone, a muffled crack under it | 0.3–0.35 s |
| A double flip (today a shared combo banner file; set this slot's `url` to the new file) | `flip.doubleFlip` | a two-note "flip-flip": two quick rising whooshes a sixteenth apart | 0.35–0.45 s |
| (stage 2) The runner passes a spike within a few pixels | `flip.nearMiss` | a short sharp "tsss" of steam off hot metal | 0.2–0.25 s |
| (stage 2) A sweet-spot landing: the gold dust puff (the chime stays `flip.sweetLanding`) | `flip.sweetGold` | a soft thud with a bright crystalline ring on top | 0.3–0.4 s |
| (stage 2) The end card's flow best counting up | `flip.flowCount` | a light ticking count with a small rising chime at the end | 0.6–0.9 s |

Wired now: `flip.flipUp` / `flip.flipDown` (flipRev 11–13; the library flip until set), `flip.crash` (now also on a
flipRev 13 respawn), `flip.respawn`, `flip.land`, `flip.flowTick`, `flip.flowTen`, `flip.flowBreak` (silent until their
files). `flip.nearMiss`, `flip.sweetGold` and `flip.flowCount` are wired with stage 2's effects (the moments they
sound don't exist yet).


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

The best-served game in the group: Joe's November recordings stay for the leap (`ricochet.leap`), double jump
(`.doubleJump`), stone landing (`.land`), moss/ice landing (`.slip`), mid-ledge (`.ledge`), hit clang (`.hit`), scroll
(`.scroll`), lantern grab (`.lanternGrab`), the lantern-ride loop (`.lanternRide`), each Flow step (`.flow`) and the
bed (`music_ricochet`). The leap's whoosh already carries the stage-2 wall dust, and the double jump's airy spin its
ring of air, so neither needs a new file. New or better sounds:

- `ricochet.fallWhistle` (new, wired, silent until set): the falling whistle as a hit tumbles the ninja 3 m down,
  played with the clang. A descending slide whistle, soft and cartoon-light, not comic; airy wood-flute tone; 0.8–0.9 s.
- `ricochet.flowBreak` (new, wired, silent until set): a Flow streak of 3+ broken by sliding too long. A dull muted
  koto string plucked and damped, a short downward bend, disappointed not harsh; 0.3 s.
- `ricochet.scuff` (new loop, wired, silent until set): sliding down moss or ice. Soft cloth-and-sandal scrape on wet
  stone with a faint gritty hiss, seamless loop, quiet; 2 s loop.
- `ricochet.scrollTally` (registered, fired by the stage-2 fly-in): the taken scroll landing on the SCROLLS count. A
  tiny temple bell "ting" with a paper tap, bright and short; 0.4 s.
- `ricochet.lanternSway` (registered, fired by the stage-2 lantern flare): the lantern brightening and swaying as the ninja grabs it. A soft paper creak with
  a warm flame flutter, gentle; 0.5 s.
- `ricochet.heightStreak` (better, replace the shared banner file): every 50 m climbed. A single deep temple bell,
  calm, with a long soft tail; 0.9 s.
- `ricochet.fullHeight` (better, replace the shared full-clear file): reaching the full 245 m. A rising shakuhachi
  phrase over a soft gong swell, triumphant but night-quiet; 1.5 s.


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

Kept: the catch (`orbit.planetCaught`, its own recording), the black hole, the shooting star, the ambience bed.

| What it is | Slot (file `public/sounds/<slot>.mp3`) | Material | Feel | Length |
|---|---|---|---|---|
| The rocket lets go of its orbit: a thruster puff | `orbit.launch` | Small rocket nozzle, compressed gas | A soft, clean whoosh-puff, no rumble | 0.15 s |
| The thruster's hiss while the rocket flies; the game lowers its pitch as the fuel drops | `orbit.thrust` (loop) | Steady gas jet, faint metal resonance | Quiet, even hiss, seamless loop | 1.5 s loop |
| A quarter of the tank left in flight: a warning beep | `orbit.lowFuel` | Cockpit panel beeper | Two short urgent beeps, clear but not shrill | 0.6 s |
| The tank runs dry: a sputter, a cough and a fizzle | `orbit.outOfFuel` | Small engine choking, sparks dying | Comic but disappointed, falling away | 0.9 s |
| The rocket hits a belt, a rock or a moon | `orbit.crash` | Thin metal hull, glassy debris | A short crunch and tinkle, not violent | 0.3 s |
| The respawn hold ends and the rocket can launch again | `orbit.respawnReady` | Synth blip | A bright rising "ready" ping | 0.25 s |
| SET CHECKPOINT held to the end: the checkpoint locks | `orbit.checkpoint` | Magnetic clamp, soft chime | Reassuring click-chime | 0.3 s |
| Every catch: a clunk-whirr lock onto the orbit | `orbit.planetCatch.mp3` (replaces the file behind `orbit.planetCaught`) | Docking clamp, small servo motor | A solid clunk then a short rising whirr | 0.5 s |
| A stardust mote taken (up to 30 a run) | `orbit.stardust` | Tiny glass bell, sparkle | A soft high tick, varied enough to repeat | 0.12 s |
| Reaching the sun: a bloom of light and "ALL 40 PLANETS!" | `orbit.sunBloom` | Warm choir pad, solar swell | A big, warm swelling chord that resolves | 2.5 s |

