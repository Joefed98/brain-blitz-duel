# Moon Climb and Blockzone sound slots (3 Nov 2026)

**Files set (3 Nov 2026):** Joe's recordings from the `sounds-nov-2026` branch are wired for every Moon Climb (`ricochet.*`), Iron Wall (`bastion.*`), Blockzone (`blockfall.*`) and Ringer (`alleyroll.*`) slot listed in `mapping-nov-2026.csv`, plus `music_ricochet`, `music_bastion`, `music_blockfall`, `music_alleyroll` and Gemstone's `music_matchup`; those slots no longer play a library stand-in. Re-cut from the originals and levelled to the library on 3 Nov 2026 (the first wiring had cut the attack off several effects and left them 10–35 dB under the library, and the beds 4–7 dB over the other beds): see [levels-nov-2026.md](levels-nov-2026.md) for every file's length, peak and loudness before and after. Slots not in the mapping (`bastion.dry`, `blockfall.speedUp`, `ricochet.heightStreak`, `ricochet.fullHeight`, the replay moments) keep their library sound.

Every slot below with a file plays its own recording (15 Nov 2026: this list used to name the library stand-ins as
what plays today). The `sfx(slot, fallback)` rule in `gameSounds.ts` plays the library sound named in `arcade.md` only
for a slot whose `url` is not set in `src/lib/fx/manifest.ts`. Set a file the usual way (`docs/sound-cues/README.md`). The
slots' own rows (timing, counts) are in `arcade.md`, `arcade-effects.md` and `music.md`; this page is the recording list.

## Loops

| Cue | Game | When | Plays today | Per run | Length |
| --- | --- | --- | --- | --- | --- |
| `ricochet.lanternRide` | Moon Climb | While the ninja rides a sky lantern (0.3, the slot at 0.6) | `ricochet.lanternRide.mp3` (Joe's recording) | loop | loop |

## Moon Climb (Ricochet's id, `ricochet`)

- `ricochet.leap`: A leap off a wall, a mid-ledge or a sky lantern. File: `ricochet.leap.mp3` (Joe's recording; the library fallback was `arc_gravity_flip` (0.5)). Brief: a quick cloth whoosh and a soft foot push.
- `ricochet.doubleJump`: The double jump in the air. File: `ricochet.doubleJump.mp3` (Joe's recording; the library fallback was `arc_gravity_flip` (0.6, ×1.25)). Brief: a higher, airier whoosh with a spin.
- `ricochet.land`: Landing on stone (at most one per 80 ms). File: `ricochet.land.mp3` (Joe's recording; the library fallback was `arc_retro_hit` (0.3)). Brief: a soft grip on stone.
- `ricochet.hit`: A katana or shuriken knocks the ninja down (with the `impact` haptic). File: `ricochet.hit.mp3` (Joe's recording; the library fallback was `arc_crash`). Brief: a metal clang and a short grunt-free tumble.
- `ricochet.slip`: Landing on moss or ice. File: `ricochet.slip.mp3` (Joe's recording; the library fallback was `arc_retro_blip` (0.35, ×0.8)). Brief: a wet squeak (moss) / an icy scrape.
- `ricochet.scroll`: A scroll taken. File: `ricochet.scroll.mp3` (Joe's recording; the library fallback was `correct` (0.9)). Brief: a paper flutter with a small bell.
- `ricochet.lanternGrab`: A sky lantern grabbed in a leap. File: `ricochet.lanternGrab.mp3` (Joe's recording; the library fallback was `arc_pickup` (0.8)). Brief: a paper rustle and a warm whoomph of the flame.
- `ricochet.lanternRide`: The ride up on a lantern (a loop, faded in and out). File: `ricochet.lanternRide.mp3` (Joe's recording; the library fallback was `curling_slide_loop.mp3` (0.6 × the loop level)). Brief: a gentle rising wind with a crackling flame, seamless.
- `ricochet.ledge`: Landing on a mid-ledge. File: `ricochet.ledge.mp3` (Joe's recording; the library fallback was `arc_retro_hit` (0.4)). Brief: a light wooden knock on a hanging stone.
- `ricochet.flow`: Each Flow step (every 7 clean leaps in a row). File: `ricochet.flow.mp3` (Joe's recording; the library fallback was `combo` (0.75)). Brief: a rising koto pluck, a little brighter each step.
- `music_ricochet`: The bed. File: `music_ricochet.mp3` (Joe's recording; the library fallback was Grappler's `music_swing.mp3`). Brief: a night-temple loop (shakuhachi, soft taiko), our own.

`ricochet.coin` and `ricochet.lantern` were removed with Moon Climb (no coins or gold lanterns on ricoRev 3). A stored
ricoRev 2 round that is replayed live (never dealt now) plays the library sounds they fell back to.

## Blockzone (Blockfall's id, `blockfall`)

- `blockfall.move`: The piece moves a column or more. File: `blockfall.move.mp3` (Joe's recording; the library fallback was `arc_retro_blip` (0.3, ×0.8)). Brief: a tiny neon tick.
- `blockfall.turn`: The piece turns. File: `blockfall.turn.mp3` (Joe's recording; the library fallback was `arc_retro_blip` (0.45)). Brief: a short glassy click.
- `blockfall.lock`: A piece locks without clearing a row. File: `blockfall.lock.mp3` (Joe's recording; the library fallback was `arc_retro_hit` (0.45)). Brief: a soft glass tap.
- `blockfall.clear`: One or two rows clear. File: `blockfall.clear.mp3` (Joe's recording; the library fallback was `arc_retro_coin` (0.8)). Brief: a glassy neon chime.
- `blockfall.bigClear`: Three or four rows at once (with the `success` haptic). File: `blockfall.bigClear.mp3` (Joe's recording; the library fallback was `arc_retro_pickup` (0.9)). Brief: a rising four-note sweep.
- `blockfall.topOut`: The stack reaches the top. File: `blockfall.topOut.mp3` (Joe's recording; the library fallback was `arc_retro_explode` (0.8)). Brief: a short descending neon buzz.
- `music_blockfall`: The bed. File: `music_blockfall.mp3` (Joe's recording; the library fallback was Fission's Retro bed (`music_burst.mp3`)). Brief: a cool synth loop of our own (no borrowed melody).

`blockfall.hold` was removed with Blockzone (no hold); a blockfallRev 1 round replayed live plays its library note.
`blockfall.speedUp` (the speed rising every 15 s) keeps its library sound.

`blockfall.start` (15 Nov 2026): the run starting, the library coin (`arc_retro_coin`) as every Retro game's start.

Haptics stay at the main moments only: a hit (`impact`) on Moon Climb; three or four rows at once (`success`) and a
top-out (`impact`, 15 Nov 2026, as every Retro game's run-ending crash) on Blockzone; the arcade buzzer on both.
