# Moon Climb and Blockzone sound slots (3 Nov 2026)

**Files set (3 Nov 2026):** Joe's recordings from the `sounds-nov-2026` branch are wired for every Moon Climb (`ricochet.*`), Iron Wall (`bastion.*`), Blockzone (`blockfall.*`) and Ringer (`alleyroll.*`) slot listed in `mapping-nov-2026.csv`, plus `music_ricochet`, `music_bastion`, `music_blockfall`, `music_alleyroll` and Gemstone's `music_matchup`; those slots no longer play a library stand-in. Re-cut from the originals and levelled to the library on 3 Nov 2026 (the first wiring had cut the attack off several effects and left them 10–35 dB under the library, and the beds 4–7 dB over the other beds): see [levels-nov-2026.md](levels-nov-2026.md) for every file's length, peak and loudness before and after. Slots not in the mapping (`bastion.dry`, `blockfall.speedUp`, `ricochet.heightStreak`, `ricochet.fullHeight`, the replay moments) keep their library sound.

Joe will generate the files for these slots. Until a slot's `url` is set in `src/lib/fx/manifest.ts`, the moment plays
the library sound named in `arcade.md` (the `sfx(slot, fallback)` rule in `gameSounds.ts`): with a file, the slot's own
recording plays instead and the fallback is muted. Set a file the usual way (`docs/sound-cues/README.md`). The
slots' own rows (timing, counts) are in `arcade.md`, `arcade-effects.md` and `music.md`; this page is the recording list.

## Loops

| Cue | Game | When | Plays today | Per run | Length |
| --- | --- | --- | --- | --- | --- |
| `ricochet.lanternRide` | Moon Climb | While the ninja rides a sky lantern (0.3, the slot at 0.6) | `curling_slide_loop.mp3` (Curl Champ's slide) until its file | loop | loop |

## Moon Climb (Ricochet's id, `ricochet`)

- `ricochet.leap`: A leap off a wall, a mid-ledge or a sky lantern. Plays today: `arc_gravity_flip` (0.5). To record: a quick cloth whoosh and a soft foot push.
- `ricochet.doubleJump`: The double jump in the air. Plays today: `arc_gravity_flip` (0.6, ×1.25). To record: a higher, airier whoosh with a spin.
- `ricochet.land`: Landing on stone (at most one per 80 ms). Plays today: `arc_retro_hit` (0.3). To record: a soft grip on stone.
- `ricochet.hit`: A katana or shuriken knocks the ninja down (with the `impact` haptic). Plays today: `arc_crash`. To record: a metal clang and a short grunt-free tumble.
- `ricochet.slip`: Landing on moss or ice. Plays today: `arc_retro_blip` (0.35, ×0.8). To record: a wet squeak (moss) / an icy scrape.
- `ricochet.scroll`: A scroll taken. Plays today: `correct` (0.9). To record: a paper flutter with a small bell.
- `ricochet.lanternGrab`: A sky lantern grabbed in a leap. Plays today: `arc_pickup` (0.8). To record: a paper rustle and a warm whoomph of the flame.
- `ricochet.lanternRide`: The ride up on a lantern (a loop, faded in and out). Plays today: `curling_slide_loop.mp3` (0.6 × the loop level). To record: a gentle rising wind with a crackling flame, seamless.
- `ricochet.ledge`: Landing on a mid-ledge. Plays today: `arc_retro_hit` (0.4). To record: a light wooden knock on a hanging stone.
- `ricochet.flow`: Each Flow step (every 7 clean leaps in a row). Plays today: `combo` (0.75). To record: a rising koto pluck, a little brighter each step.
- `music_ricochet`: The bed. Plays today: Grappler's `music_swing.mp3`. To record: a night-temple loop (shakuhachi, soft taiko), our own.

`ricochet.coin` and `ricochet.lantern` were removed with Moon Climb (no coins or gold lanterns on ricoRev 3). A stored
ricoRev 2 round that is replayed live (never dealt now) plays the library sounds they fell back to.

## Blockzone (Blockfall's id, `blockfall`)

- `blockfall.move`: The piece moves a column or more. Plays today: `arc_retro_blip` (0.3, ×0.8). To record: a tiny neon tick.
- `blockfall.turn`: The piece turns. Plays today: `arc_retro_blip` (0.45). To record: a short glassy click.
- `blockfall.lock`: A piece locks without clearing a row. Plays today: `arc_retro_hit` (0.45). To record: a soft glass tap.
- `blockfall.clear`: One or two rows clear. Plays today: `arc_retro_coin` (0.8). To record: a glassy neon chime.
- `blockfall.bigClear`: Three or four rows at once (with the `success` haptic). Plays today: `arc_retro_pickup` (0.9). To record: a rising four-note sweep.
- `blockfall.topOut`: The stack reaches the top. Plays today: `arc_retro_explode` (0.8). To record: a short descending neon buzz.
- `music_blockfall`: The bed. Plays today: Fission's Retro bed (`music_burst.mp3`). To record: a cool synth loop of our own (no borrowed melody).

`blockfall.hold` was removed with Blockzone (no hold); a blockfallRev 1 round replayed live plays its library note.
`blockfall.speedUp` (the speed rising every 15 s) keeps its library sound.

Haptics stay at the main moments only: a hit (`impact`) on Moon Climb; three or four rows at once (`success`) on
Blockzone; the arcade buzzer on both.
