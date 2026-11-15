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
- `ricochet.scrollTally` (stage 2, the slot added with the fly-in): the taken scroll landing on the SCROLLS count. A
  tiny temple bell "ting" with a paper tap, bright and short; 0.4 s.
- `ricochet.lanternSway` (stage 2): the lantern brightening and swaying as the ninja grabs it. A soft paper creak with
  a warm flame flutter, gentle; 0.5 s.
- `ricochet.heightStreak` (better, replace the shared banner file): every 50 m climbed. A single deep temple bell,
  calm, with a long soft tail; 0.9 s.
- `ricochet.fullHeight` (better, replace the shared full-clear file): reaching the full 245 m. A rising shakuhachi
  phrase over a soft gong swell, triumphant but night-quiet; 1.5 s.


## Iron Wall (`bastion`)

<!-- ironwall -->


## High Rise (`skyline`)

<!-- highrise -->


## Orbit (`orbit`)

<!-- orbit -->

