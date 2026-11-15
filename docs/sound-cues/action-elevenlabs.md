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


## Moon Climb (`ricochet`)

<!-- moonclimb -->


## Iron Wall (`bastion`)

<!-- ironwall -->


## High Rise (`skyline`)

<!-- highrise -->


## Orbit (`orbit`)

<!-- orbit -->

