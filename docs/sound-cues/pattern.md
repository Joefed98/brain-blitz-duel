# Sound cues: Pattern games (13 Oct 2026)

Added by the Pattern polish. Every new effect, animation or feature moment
dispatches a named cue; **no audio is attached yet**. Existing sounds
(`playCorrect`, `playLock`, `playWrong` and so on) are unchanged and still play
as before.

```ts
window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "<gameId>.<event>" } }));
```

The helper is `soundCue()` in `src/lib/fx/patternFx.ts`. Each `<game>.solve`
cue fires through `useSolveMoment()` at the solve moment, the same render
that submits. Completion effects never delay the submission. They all finish
within 1.2 s and leave room for the shared signature beat at about 1.0 s.
Cues fire only on the live board, never on intro examples or reveal boards.

"Length" is how long the matching animation runs, so audio can be cut to fit.

## Gridlock (`unblock`)

| Cue | Trigger | Length |
|---|---|---|
| `unblock.slide` | A car settles into a new bay one or two bays away (each kept move, each undo, a reset with moves to undo) | 170 ms (undo / reset 210 ms) |
| `unblock.slideLong` | A car slides three or more bays (since 15 Nov 2026; `move.slide.mp3` until its own file) | 170 ms |
| `unblock.blocked` | A drag pushed into the car or wall in the way: the car shakes and stays (a plain tap keeps the shake's quiet `wrong`; since 15 Nov 2026, `arc_wood_knock.mp3` until its own file) | 320 ms shake |
| `unblock.laneClear` | A move leaves nothing between the gold car and the exit, short of the solve (since 15 Nov 2026, `gem.glint.mp3` until its own file) | — |
| `unblock.solve` | The solving drop: the gold car revs back and drives out through the exit with speed streaks | `pz_car_escape.mp3` (2.47 s, since 15 Nov 2026); placeholder `unblock.solve.mp3` with NEW_GAME_SOUNDS on |

## Tessellate (`blockparty`)

| Cue | Trigger | Length |
|---|---|---|
| `blockparty.place` | A piece dropped legally on the board pops into place | 260 ms (outline 320 ms) |
| `blockparty.turn` | A single tap rotates a tray piece (shown once the double-tap window has passed, 260 ms; Pattern overhaul) | 180 ms |
| `blockparty.flip` | A double tap flips a tray piece (it no longer turns first) | 180 ms |
| `blockparty.pickup` | A piece lifted: the first drag movement of a tray or board piece, or a tap that takes a placed piece back | lift |
| `blockparty.illegal` | A piece let go over the board where it doesn't fit: it slides back (blockRev 4 counts it) | ~300 ms |
| `blockparty.undo` | Undo (blockRev 4): the last move given back | short |
| `blockparty.reset` | Reset (blockRev 4): every piece back to the tray | short |
| `blockparty.solve` | All squares covered: rings leave the pegs, then a shine sweeps outwards | ~1,100 ms |

## Skid (`iceslide`)

| Cue | Trigger | Length |
|---|---|---|
| `iceslide.slide` | A slide of up to four squares starts (the ball and its frost trail move) | ~100 ms per cell crossed |
| `iceslide.slideLong` | A slide of five squares or more starts (since 15 Nov 2026, `move.slide.mp3` until its own file) | ~100 ms per cell crossed |
| `iceslide.stop` | The ball comes to rest against what stopped it (not a fall or the exit; since 15 Nov 2026, `arc_fair_thud.mp3` until its own file) | 160 ms |
| `iceslide.bump` | A slide straight into a wall or the edge: nothing moves and nothing counts (since 15 Nov 2026, `arc_wood_knock.mp3` until its own file) | 90 ms |
| `iceslide.nearExit` | The ball rests one slide from the exit with the finish still at par: the exit glows softly (since 15 Nov 2026, `gem.glint.mp3` until its own file) | 300 ms |
| `iceslide.portal` | The ball comes out of a portal; both cells of the pair flare | 450 ms |
| `iceslide.crack` | Thin ice breaks as the ball leaves it (shards fly) | 520 ms |
| `iceslide.fall` | The ball reaches a hole and spins down | 400 ms |
| `iceslide.solve` | The ball arrives at the exit: gold burst, the ice frosts over and shatters into glints, the portals flare | 1,200 ms |

## Topsy-Turvy (`gravity`)

| Cue | Trigger | Length |
|---|---|---|
| `gravity.tilt` | An arrow press tilts the tray and the balls roll | 200 ms tilt + 260 ms roll |
| `gravity.lock` | A ball locks onto its target (not on the solving tilt) | 460 ms ring after a 200 ms delay |
| `gravity.solve` | The solving tilt: the four balls light up on their targets one after another | ~1,150 ms |

## Gradient (`tiles`)

| Cue | Trigger | Length |
|---|---|---|
| `tiles.slide` | A tile changes cell (a slide or an undo) | 160 ms |
| `tiles.solve` | The colour ramp flows across the tiles from 1 to 8, then the gap glows | ~980 ms |

## Turntable (`rings`)

| Cue | Trigger | Length |
|---|---|---|
| `rings.turn` | A turn: the ring rotates and every linked ring that moved flashes | 210 ms turn + 380 ms flash |
| `rings.solve` | The record spins up through two turns with the spokes strobing | 1,100 ms |

## Lightbender (`laser`)

| Cue | Trigger | Length |
|---|---|---|
| `laser.place` | A mirror or splitter is placed or moved | 180 ms |
| `laser.turn` | A placed mirror is flipped | 180 ms |
| `laser.fire` | The beam starts | As long as the shot travels (about 2 s on the intro example) |
| `laser.gem` | One or more gems light during a shot | 260 ms |
| `laser.bomb` | The beam hits a bomb | 420 ms |
| `laser.solve` | The beam flares to full and the gems burst with light in beam order | 1,150 ms |

## Chroma Lines (`flow`)

| Cue | Trigger | Length |
|---|---|---|
| `flow.draw` | The line grows by a square (a soft liquid tone, played a little higher as the line grows; the `move` tick until it has a file) | 140 ms |
| `flow.cut` | flowRev 3: drawing over another colour cuts that line back | 180 ms |
| `flow.connect` | A pair is joined and a pulse runs along it (not on the solving join; the only sound for a join since the Pattern overhaul) | 460 ms |
| `flow.nearMiss` | The board first reaches one pair short, or every pair joined with squares still empty (a soft hint) | 600 ms |
| `flow.solve` | Each path pulses end to end in its colour, then the board glows | 1,150 ms |

## Pipeline (`pipes`)

| Cue | Trigger | Length |
|---|---|---|
| `pipes.rotate` | Each tile turn, either way (a quarter turn) | 170 ms |
| `pipes.flow` | Water reaches more pipes after a turn (not on the solve) | 220 ms |
| `pipes.combo` | Water reaches 6 or more pipes in one turn, in place of `pipes.flow` (pipesRev 5) | 486 ms |
| `pipes.drain` | A turn cuts pipes off the water (pipesRev 5) | 486 ms |
| `pipes.solve` | Water rushes from the source through every pipe | 1,200 ms |
| `pipes.bubble` | The source bubbles as the solve fills the network (pipesRev 5) | 486 ms |

## Heave (`push`)

| Cue | Trigger | Length |
|---|---|---|
| `push.step` | A walking step | 120 ms |
| `push.push` | A step that pushes a crate | 120 ms |
| `push.home` | A crate lands on a marking: it thumps and kicks up dust (not on the solving push) | 300 ms thump, 520 ms dust |
| `push.solve` | The crates thump in turn and the warehouse lights switch on in a row | 1,200 ms |
| `push.goldOff` | The gold crate pushed off its gold mark (since 15 Nov 2026, `retro.powerDown.mp3` until its own file) | — |
| `push.stuck` | A crate pushed where it can never leave: a warning creak (slot only: fired by the deadlock hint, which comes with the levels; `swing.vineCreak.mp3` until its own file) | — |
