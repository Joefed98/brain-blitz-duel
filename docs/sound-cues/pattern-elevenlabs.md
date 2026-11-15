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

Look A: glossy lacquered blocks on a dark slab with brass studs. Today `turn` and `flip` share the generic UI select,
`place` a generic block pop and `solve` the shared pops; the four new slots play library stand-ins.

- `blockparty.turn` — a tray piece spun a quarter turn: a quick, light lacquered-wood spin with a crisp click at the end; snappy, satisfying; 120–180 ms.
- `blockparty.flip` — a tray piece flipped over: a short flick and a light clack as the block lands on its other face; 150–200 ms.
- `blockparty.pickup` — a piece lifted off the tray or board: a soft upward lift, a faint lacquer-on-felt slide with a small airy rise; gentle; 120–180 ms.
- `blockparty.place` — a piece dropped where it fits: a firm, solid snap of a lacquered block seating into a recessed board, one dense click with a short low body; confident; 120–200 ms.
- `blockparty.illegal` — a piece let go where it doesn't fit and sliding back to the tray: a dull, muted wooden thud followed by a short soft slide; not harsh, clearly "no"; 250–350 ms.
- `blockparty.undo` — Undo, the last move given back: a quick reversed lift, a soft click as the piece returns; light; 120–180 ms.
- `blockparty.reset` — Reset, every piece back to the tray: a short soft sweep of several blocks sliding together, ending in a light settle; 300–450 ms.
- `blockparty.solve` — the last gap filled: a bright, clean shine, a glassy shimmer rising across the board with a soft brass chime at the top; rewarding, not loud; 900–1,100 ms.
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
- `flow.draw` — the line grows one square: a soft liquid slide, thick glossy paint gliding a short way along a glass tube (a smooth "shhlp" with a gentle upward glide, no bloop or click at the start); it plays on every square, rising smoothly in pitch as the line grows (up to half again, levelling off), so record it at a low-middle pitch and keep its tail short enough to chain; 120–150 ms.
- `flow.cut` — drawing over another colour cuts that line back (the cut part retracts into the cut): a quick soft snip of a rubber tube followed by a short wet suck-back, a little lower than the draw tone, never harsh; 180–240 ms.
- `flow.connect` — a pair joined (the one sound for it, under a light running along the tube to the far bead; today's file is a placeholder): a short liquid rush along the tube ending in a glass marble settling with a "plip" rising a fifth, satisfying and clean; 400–500 ms.
- `flow.nearMiss` — the board is one pair short (or every pair joined with squares empty): a gentle two-note hint, a soft glassy "almost", the second note left unresolved, quiet; 500–700 ms.
- `flow.solve` — every square filled: liquid colour rushing through every tube at once, then a bright glass-marble chime chord that blooms and fades; 1.0–1.2 s.
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

A brick warehouse with a stone floor, wooden crates and one gold crate; the worker in work boots. Every sound is
close, dry and indoors: never a factory alarm, a forklift or a cartoon "boing".

- `push.step` — the worker takes one step: a light, soft work-boot footstep on a dusty stone floor, a faint grit
  scuff, no echo; quick, it repeats often, so keep it quiet and neutral; 80–110 ms. (Today silent; the November
  placeholder `push.step.mp3` plays behind `NEW_GAME_SOUNDS`.)
- `push.push` — a step that shoves a crate one square: a heavy wooden crate dragged across stone, a short gritty
  scrape with weight behind it, a beat after the footstep, ending in a dull settle; satisfying, not loud; 150–220 ms.
  (Today silent; the November placeholder `push.push.mp3` plays behind `NEW_GAME_SOUNDS`.)
- `push.home` — **keep** (the crate thumps down on its mark with a puff of dust).
- `push.goldOff` — the gold crate pushed off its gold mark: a soft metallic "un-clink" falling a few notes, like a
  brass plate lifting off and losing its ring; a gentle "oh no", never a buzzer; 300–400 ms. (Today
  `retro.powerDown.mp3` stands in.)
- `push.stuck` — a crate pushed where it can never leave (a corner, or against a wall with no mark on it): a low
  warning creak of strained timber, slow and short, as if the crate groans in place; a hint, not an error; 350–500 ms.
  (Slot only for now: the deadlock hint comes with the levels; `swing.vineCreak.mp3` stands in.)
- `push.solve` — every crate home, the warehouse lights come on: three or four big industrial light switches clunking
  on one after another left to right, each with a short electric hum swelling under it, ending on a warm, settled hum
  that fades; 1.1–1.3 s. (Replaces today's `push.solve.mp3`, which has the crates' thumps but no lights.)
- The gold crate onto its gold mark: no new sound; it keeps the shared `correct`.
- Undo and Reset: no new sound (the worker steps back silently, as today).
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

Look A: glossy glass marbles rolling across a grey stone-and-slate tray, each dropping into a cup rimmed in its own
colour. Every sound is small glass marbles on a hard stone tray: never a pinball, a bowling alley or a casino.

- `gravity.tilt` — the balls rolling after a tilt: a low, even rumble of several glass marbles rolling across a smooth
  stone tray, no start or end accents (it is looped and faded for exactly as long as the balls move, 0.1–0.5 s), seamless
  loop; 1.5–3 s file. (Today the library's `arc_marble_roll.mp3`; the tray's lean itself needs no sound.)
- `gravity.stop` — one marble coming to rest against a stone block or another marble: a tiny, dry glass-on-stone click,
  bright but soft, no ring-out (several may sound a few ms apart, so it must stay light); 60–100 ms.
- `gravity.lock` — **keep** (`gravity.lock.mp3`, the bright pip as a ball drops home); replace only if the new one is a
  marble dropping into a small cup: a short hollow "plip" with a bright top, 150–220 ms.
- `gravity.combo` — two or more balls home in one tilt: a quick rising pair of glassy pips with a soft sparkle on top,
  playful, not a fanfare; 350–500 ms.
- `gravity.boardClear` — a board cleared, the next one coming: the tray settling, a light wooden-stone knock and a short
  rising three-note glass chime; satisfying, smaller than the solve; 400–600 ms.
- `gravity.outOfTilts` — the board's last tilt used without clearing it: a closing clunk, a heavy stone lid sliding shut
  with a dull low thud at the end; clearly "that's it", never a buzzer; 400–600 ms.
- `gravity.solve` — **keep** (`done.rising.mp3`, every ball lighting in its cup in turn).
- A tilt that moves nothing has no sound (a small lean only). Undo and Reset add no sound of their own.
<!-- topsy:end -->
