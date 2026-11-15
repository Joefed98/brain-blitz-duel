# Pattern overhaul: sounds for Joe to generate (ElevenLabs)

Phase 2 step 4 (15 Nov 2026). One line per sound: the slot it fills, what it is, the material, the feel and the
length. Generate each, name the file `<slot>.mp3` and drop it in `public/sounds/`; the slot already plays a
placeholder (the November set behind `NEW_GAME_SOUNDS` in `src/config/soundConfig.ts`, or the library sound named),
so a file with the slot's name replaces it with no code change. Sounds the games already have and that work are
listed as **keep** and need nothing.

The house levels (docs/sound-cues/levels-nov-2026.md) are applied when a file is wired: generate at any level, short
effects with no lead-in silence.

<!-- Each game's section is between its own markers; per-game work edits only its own section. -->

<!-- gridlock:start -->
## Gridlock
<!-- gridlock:end -->

<!-- tessellate:start -->
## Tessellate
<!-- tessellate:end -->

<!-- pipeline:start -->
## Pipeline
- `pipes.rotate` — a pipe tile turned a quarter, either way: a metallic ratchet, two quick pawl clicks on a hollow steel
  joint, dry and tight, no ring-out; 110–150 ms. (Today the November placeholder `pipes.rotate.mp3`, behind
  `NEW_GAME_SOUNDS`; silent with the switch off.)
- `pipes.flow` — water reaching newly joined pipes: a short gurgle through a metal pipe, a few bubbles running away
  from the listener, wet and clean; 200–300 ms for one to five pipes. (Today's file works; replace only if the new one
  matches the ratchet's material.)
- `pipes.combo` — six or more pipes joined by one turn: a longer, fuller gush through the pipework that rises a little
  in pitch as it runs, satisfying, still water in metal (no chime); 450–600 ms. (Placeholder: the library's `combo.mp3`.)
- `pipes.drain` — a turn that cuts pipes off the water: a falling drain note, water glugging away down a pipe, a soft
  downward gurgle ending in a hollow drip; 350–500 ms. (Placeholder: the library's `combo.lost.mp3`.)
- `pipes.solve` — keep: the water rush through the whole network (1,200 ms).
- `pipes.bubble` — the source valve bubbling as the solved network fills: three or four round bubbles welling up in a
  metal tank, gentle and cheerful, closing on a small pop; 400–550 ms. (Placeholder: the library's `arc_sea_bubble.mp3`.)
<!-- pipeline:end -->

<!-- chroma:start -->
## Chroma Lines
<!-- chroma:end -->

<!-- skid:start -->
## Skid
<!-- skid:end -->

<!-- heave:start -->
## Heave
<!-- heave:end -->

<!-- lightbender:start -->
## Lightbender
<!-- lightbender:end -->

<!-- topsy:start -->
## Topsy-Turvy
<!-- topsy:end -->
