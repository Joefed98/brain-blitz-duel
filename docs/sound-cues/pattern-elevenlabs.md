# Pattern overhaul: sounds for Joe to generate (ElevenLabs)

Phase 2 step 4 (15 Nov 2026). One line per sound: the slot it fills, what it is, the material, the feel and the
length. Generate each, name the file `<slot>.mp3` and drop it in `public/sounds/`; the slot already plays a
placeholder (the November set behind `NEW_GAME_SOUNDS` in `src/config/soundConfig.ts`, or the library sound named),
so a file with the slot's name replaces it with no code change. Sounds the games already have and that work are
listed as **keep** and need nothing.

The house levels (docs/sound-cues/levels-nov-2026.md) are applied when a file is wired: generate at any level, short
effects with no lead-in silence. Slots that borrow a library file until then (Gridlock's knock and glint, Chroma
Lines' draw, cut and near-miss) are repointed at the new file when it lands (one manifest line each).

<!-- Each game's section is between its own markers; per-game work edits only its own section. -->

<!-- gridlock:start -->
## Gridlock

Glossy painted toy cars on a dark lot. Every car sound is the same small, heavy die-cast toy on a smooth painted
floor: never a real engine, horn or tyre squeal.

- `unblock.slide` — a toy car pushed one or two bays: a short, smooth rubber-and-metal scrape across a painted lot
  floor, ending in a soft, dull bump as it stops; light, tidy, satisfying; 0.17 s. (Replaces `move.slide.mp3`, a
  generic 0.53 s slide that runs past the car's glide.)
- `unblock.slideLong` — the same toy car pushed three or more bays: the same scrape held a little longer with a
  slight rise in speed, the same soft bump on the stop; 0.25 s.
- `unblock.blocked` — a drag into the car (or kerb) in the way: a dull, muffled knock of a die-cast toy car against
  another, a tiny rattle, no ring; clearly "can't go", never harsh or buzzer-like; 0.12 s. (Today the library's
  wood knock stands in.)
- `unblock.laneClear` — the gold car's lane to the exit is open: a quick, bright metallic glint, one small sparkle
  running left to right like light along polished gold paint; airy, short, not a chime melody; 0.35 s.
- `unblock.solve` — **keep** (`pz_car_escape.mp3`, the gold car revving back and driving out).
- Undo and Reset: no new sound; they play `unblock.slide` (the car sliding back).
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
- `flow.draw` — the line grows one square: a single soft liquid "bloop", like a drop of thick paint pushed through a glass tube; round, warm, no click at the start; the game plays it a little higher with every square, so record it at a low-middle pitch; 120–150 ms.
- `flow.cut` — drawing over another colour cuts that line back: a quick soft snip of a rubber tube, wet and short, a little lower than the draw tone, never harsh; 150–200 ms.
- `flow.connect` — a pair joined (the one sound for it; today's file is a placeholder): a glass marble settling into a cup with a short liquid "plip" rising a fifth, satisfying and clean; 400–500 ms.
- `flow.nearMiss` — the board is one pair short (or every pair joined with squares empty): a gentle two-note hint, a soft glassy "almost", the second note left unresolved, quiet; 500–700 ms.
- `flow.solve` — every square filled: liquid colour rushing through every tube at once, then a bright glass-marble chime chord that blooms and fades; 1.0–1.2 s.
<!-- chroma:end -->

<!-- skid:start -->
## Skid
<!-- skid:end -->

<!-- heave:start -->
## Heave
<!-- heave:end -->

<!-- lightbender:start -->
## Lightbender

Silvered glass mirrors, a violet glass prism, cut crystal gems, terracotta brick walls and a gunmetal emitter firing a
golden beam. Glass and crystal, clean and precise; never a sci-fi blaster or a cartoon zap.

- `laser.place` — a mirror (or the splitter) set down on a square: a small, bright glass click, a thick pane touching
  down on stone, a hint of ring cut short; tidy and light; 80–120 ms. (Today the November placeholder `laser.place.mp3`,
  behind `NEW_GAME_SOUNDS`; also plays when a piece is moved, or put back by Undo.)
- `laser.turn` — a placed mirror turned to its other diagonal: a crisp, dry ratchet, two quick clicks of a small
  geared mount, glass faintly chiming on the second; 90–130 ms. (Placeholder `laser.turn.mp3`; Undo of a turn plays it.)
- `laser.fire` — the beam leaves the emitter and draws across the board: a clean rising "vwmm" that settles into a soft,
  steady electric hum, warm and golden, no pew; fades out by itself; 1.2–2.0 s (the beam takes about that long).
  (Placeholder `laser.fire.mp3`, 0.4 s.)
- `laser.gem` / `pz_laser_gem` — **keep** (each gem the beam lights rings a rising note; the game raises the pitch gem
  by gem: today's best moment).
- `pz_laser_split` — **keep** if wanted, else replace: the splitter forks the beam: a soft glassy chord, two notes a
  fifth apart opening outwards, bright and airy; 400–600 ms.
- `laser.bomb` — the beam hits a bomb: a loud but very short blast, a dry crack with a quick low thump and a brief
  crackle tail, no long rumble or debris; 300–400 ms. (Today's file is 0.49 s and a little soft; replace.)
- `laser.nearMiss` — a shot lights every gem but one ("1 gem dark"): a gentle, slightly hopeful two-note glass hint, the
  second note left hanging, quiet, clearly "so close", never a buzzer; 500–700 ms. (Placeholder: the library's
  `arc_retro_blip.mp3`.)
- `laser.outOfShots` — the third shot fades without a solve and the board locks: the emitter powering down, a soft
  falling electric whine ending in a small mechanical clunk of a shutter closing; calm, final, not harsh; 500–700 ms.
  (Placeholder: the library's `retro.powerDown.mp3`.)
- `laser.solve` — **keep** for now (`laser.solve.mp3`); if replaced: every gem lit, the beam flares: a bright crystal
  shimmer rising into a warm golden chord that blooms and fades, like light pouring through cut glass; 1.0–1.2 s.
- Undo and Reset: no new sound; Undo plays the sound of the change it takes back (`laser.place` or `laser.turn`).
<!-- lightbender:end -->

<!-- topsy:start -->
## Topsy-Turvy
<!-- topsy:end -->
