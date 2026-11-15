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

