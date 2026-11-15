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
<!-- pipeline:end -->

<!-- chroma:start -->
## Chroma Lines
<!-- chroma:end -->

<!-- skid:start -->
## Skid

A glossy steel-cored ball on a frosted ice sheet between dark granite blocks. Every sound is ice and stone: cold,
crisp and clean, never a cartoon whoosh or a game-show chime.

- `iceslide.slide` — a short slide (one to four squares): a smooth, glassy hiss of a hard ball gliding over frosted
  ice, starting at once and fading at the end; light and quick; 0.4 s. (Today silent; `iceslide.slide.mp3`, a 0.17 s
  swish, stands in only behind `NEW_GAME_SOUNDS`.)
- `iceslide.slideLong` — a long slide (five squares or more): the same glassy ice hiss held longer with a faint
  rising whistle of speed, fading at the end; 0.9 s. (Today the library's generic slide stands in.)
- `iceslide.stop` — the ball comes to rest against a granite block or the rink's edge: a short, solid, muffled
  thump of a heavy ball meeting stone, a tiny ice tick after it; firm, never booming; 0.15 s. (Today the library's
  fair thud stands in.)
- `iceslide.bump` — a slide straight into a wall (nothing moves, nothing counts): a tiny dull tap of the ball nudging
  stone, barely a knock, no ring; clearly "can't go that way"; 0.08 s. (Today the library's wood knock stands in.)
- `iceslide.nearExit` — the ball rests one slide from the gold exit with the finish still at par: a soft, airy
  shimmer of frost catching light, one rising sparkle, quiet and short; 0.3 s. (Today the library's gem glint stands
  in.)
- `iceslide.crack` — **keep** (thin ice cracking and giving way as the ball leaves it).
- `iceslide.portal` — **keep** (the ball flares through a portal).
- `iceslide.fall` — **keep** (the ball spins down into a hole).
- `iceslide.solve` — **keep** (the ice frosts over and shatters at the exit).
- Undo and Reset: no new sound; they play the shared `move` tick as today.
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
