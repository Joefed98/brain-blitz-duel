# Logic overhaul 2: sounds to generate (ElevenLabs)

Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions and Island Link (15 Nov 2026). One line a sound: what
it is, its material, its feel and its length. Save each as `public/sounds/<slot>.mp3` under the slot name shown; the
new slots are wired with the effects (stage 2 of the overhaul, on the effects kit) with a library placeholder until the
file arrives (`src/lib/fx/manifest.ts`), so a file drops in by name.
Keep them short, dry and quiet: these play on every move.

## Kept (today's sounds that already fit)

| Slot | Today's file | Why it stays |
|---|---|---|
| `fences.draw` | `ui.tap.small.mp3` | A small dry tick: right for a pen line |
| `fillomino.place` | `block.place.mp3` | A block tap: right for painting a square |
| `lightup.clear`, `tents.clear` | `ui.clear.mp3` | A soft clear |
| `*.solve` | `done.glowSweep` / `done.pops` / `done.rising` | Today's round-end payoffs |

## New

| Slot | Prompt for ElevenLabs |
|---|---|
| `tents.pitch` | A small canvas tent popping up: a soft fabric flap and a light thump of a peg, dry, warm, 0.3 s |
| `tents.grass` | A quiet rustle of short grass brushed once by a hand, very soft, 0.2 s |
| `tents.touch` | A low wooden tick, two quick taps close together, a little dull, 0.2 s |
| `tents.signMet` | A small bright chime, one note on a little brass bell, clean, no reverb tail, 0.4 s |
| `tents.lanterns` | Several small oil lanterns lighting one after another: soft whooshes and a warm glow-like hum, 1.2 s |
| `tents.lonely` | A soft low wooden tock with a slight hollow edge, a gentle warning, 0.2 s |
| `shikaku.snap` | One tiny dry tick, like a fine ratchet clicking one step, very short, 0.05 s |
| `shikaku.place` | A pane of glass set down on felt: a soft, glassy thunk, no ring, 0.25 s |
| `shikaku.invalid` | A low muted wooden tick, short and flat, 0.15 s |
| `shikaku.remove` | A light reverse pop, like a suction cup lifting off glass, 0.2 s |
| `shikaku.ripple` | Glass panes tapped in a quick run, soft and rising, like a glass xylophone, 1.0 s |
| `shikaku.dragStart` | A light fingertip press on a glass pane, very soft, 0.08 s |
| `lightup.lamp` | A warm vintage light switch click with a faint filament hum rising, 0.3 s |
| `lightup.clash` | A short electric buzz, two bulbs flickering, low and dull, 0.3 s |
| `lightup.wallMet` | A single soft tick on brass, bright but quiet, 0.15 s |
| `lightup.dot` | A pencil dot tapped on paper, tiny and dry, 0.1 s |
| `lightup.wall` | A muted knock on a solid black block, dull and short (a tap on a wall), 0.12 s |
| `lightup.dark` | Two soft low tones falling, a quiet nudge (squares still dark near the end), 0.4 s |
| `lightup.allLit` | Every lamp brightening together: a warm rising hum swelling into one soft chord, 1.0 s |
| `trail.step` | One soft marimba note, wooden and round, short decay; we pitch it up a scale as the count rises, 0.3 s |
| `trail.fixed` | A small stone chime, a clear bell tone over a stone tap, 0.5 s |
| `trail.refused` | A short low wooden knock with a slight shake, 0.15 s |
| `trail.undo` | A small wooden piece slid back one step, quiet, 0.15 s |
| `trail.reset` | A soft sweep of stones gathered back across wood, 0.4 s |
| `trail.runLight` | A fast run of soft marimba notes rising, the whole path lighting 1 to 36, 1.1 s |
| `fences.cross` | A pencil making a small x on paper, two quick scratches, 0.15 s |
| `fences.erase` | A soft eraser rub on paper, one short stroke, 0.15 s |
| `fences.numberMet` | A tiny bright metal tick, like a thin gold wire plucked once, 0.2 s |
| `fences.over` | A low muted tick, flat and short, 0.15 s |
| `fences.loopClose` | A satisfying metal clasp clicking shut, then a faint sweep of wire, 0.6 s |
| `fences.loopWrong` | A soft single flicker of wire, a low muted buzz, not harsh (the loop closed but numbers fail), 0.4 s |
| `fences.undo` | A pencil lifted off paper with a tiny tick, 0.12 s |
| `fences.reset` | A sheet of paper wiped clean with a soft cloth, 0.4 s |
| `fillomino.stroke` | A soft ceramic tick, short; we raise it a step per square in a stroke, 0.08 s |
| `fillomino.region` | A soft chord on warm felt piano, three notes together; we pitch it by region size (1 high, 7 low), 0.6 s |
| `fillomino.over` | A short low enamel clink with a dull edge, 0.15 s |
| `fillomino.erase` | A soft cloth wipe across a tile, 0.15 s |
| `fillomino.undo` | A quiet reverse tick, like a small wooden piece slid back, 0.15 s |
| `fillomino.pick` | A soft press of a felt-topped key, tiny and round, 0.08 s |
| `fillomino.reset` | Tiles swept off a board onto felt, soft clatter, 0.4 s |
| `fillomino.solveFill` | Regions filling with colour in turn: soft rising ceramic chimes, smallest to largest, 1.2 s |
| `bridges.build` | Wooden planks laid in a quick row, ending in one solid wooden knock, 0.25 s |
| `bridges.double` | Two solid wooden knocks close together, 0.3 s |
| `bridges.remove` | Planks lifted away, a light wooden clatter, 0.25 s |
| `bridges.snapBack` | A small rubber band twanging back, soft and short, 0.2 s |
| `bridges.islandMet` | A small ring of a gold coin set on stone, 0.4 s |
| `bridges.lightRun` | A soft rising shimmer running along a rope bridge, airy, 1.0 s |
| `bridges.blocked` | A short dull wooden thud, a plank that won't fit (a bridge that would cross), 0.15 s |
| `bridges.undo` | A single plank lifted and set aside, quiet, 0.15 s |
| `bridges.reset` | Several planks gathered up together, light wooden clatter, 0.4 s |

Every action on the seven boards has a sound above or in the kept list: placing, marking, clearing, refusing, each
number or line met, over, undo, reset, picking a tool, the near-end hint and each solve payoff.
