# Logic overhaul 2: sounds to generate (ElevenLabs)

Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions and Island Link (15 Nov 2026). One line a sound: what
it is, its material, its feel and its length. Save each as `public/sounds/<slot>.mp3` under the slot name shown; the
slots are wired (stage 2, 15 Nov 2026): each new one plays a library recording as its placeholder until the file
arrives, then its url in `src/lib/fx/manifest.ts` becomes `/sounds/<slot>.mp3`. A solve sound goes into the game's
existing `<game>.solve` slot. `tents.pitch`, `tents.grass`, `shikaku.place`, `shikaku.remove`, `lightup.lamp`,
`lightup.dot` and `trail.step` are in the November placeholder set behind `NEW_GAME_SOUNDS` (src/config/soundConfig.ts);
their new files replace those placeholders. A tap on a wall (Lamplighter) and a bridge that would cross another keep the
shared reject sound.
Keep them short, dry and quiet: these play on every move.

## Kept (today's sounds that already fit)

| # | Slot | Today's file | Why it stays |
|---|---|---|---|
| 1 | `fences.draw` | `ui.tap.small.mp3` | A small dry tick: right for a pen line |
| 2 | `fillomino.place` | `block.place.mp3` | A block tap: right for painting a square |
| 3 | `lightup.clear`, `tents.clear` | `ui.clear.mp3` | A soft clear |
| 4 | `*.solve` | `done.glowSweep` / `done.pops` / `done.rising` | Today's round-end payoffs |

## New

| # | Slot | Prompt for ElevenLabs |
|---|---|---|
| 1 | `tents.pitch` | A small canvas tent popping up: a soft fabric flap and a light thump of a peg, dry, warm, 0.3 s |
| 2 | `tents.grass` | A quiet rustle of short grass brushed once by a hand, very soft, 0.2 s |
| 3 | `tents.touch` | A low wooden tick, two quick taps close together, a little dull, 0.2 s |
| 4 | `tents.signMet` | A small bright chime, one note on a little brass bell, clean, no reverb tail, 0.4 s |
| 5 | `tents.solve` | Several small oil lanterns lighting one after another: soft whooshes and a warm glow-like hum, 1.2 s |
| 6 | `tents.lonely` | A soft low wooden tock with a slight hollow edge, a gentle warning, 0.2 s |
| 7 | `shikaku.snap` | One tiny dry tick, like a fine ratchet clicking one step, very short, 0.05 s |
| 8 | `shikaku.place` | A pane of glass set down on felt: a soft, glassy thunk, no ring, 0.25 s |
| 9 | `shikaku.invalid` | A low muted wooden tick, short and flat, 0.15 s |
| 10 | `shikaku.remove` | A light reverse pop, like a suction cup lifting off glass, 0.2 s |
| 11 | `shikaku.solve` | Glass panes tapped in a quick run, soft and rising, like a glass xylophone, 1.0 s |
| 12 | `shikaku.dragStart` | A light fingertip press on a glass pane, very soft, 0.08 s |
| 13 | `lightup.lamp` | A warm vintage light switch click with a faint filament hum rising, 0.3 s |
| 14 | `lightup.clash` | A short electric buzz, two bulbs flickering, low and dull, 0.3 s |
| 15 | `lightup.wallMet` | A single soft tick on brass, bright but quiet, 0.15 s |
| 16 | `lightup.dot` | A pencil dot tapped on paper, tiny and dry, 0.1 s |
| 17 | `lightup.dark` | Two soft low tones falling, a quiet nudge (squares still dark near the end), 0.4 s |
| 18 | `lightup.solve` | Every lamp brightening together: a warm rising hum swelling into one soft chord, 1.0 s |
| 19 | `trail.step` | One soft marimba note, wooden and round, short decay; we pitch it up a scale as the count rises, 0.3 s |
| 20 | `trail.fixed` | A small stone chime, a clear bell tone over a stone tap, 0.5 s |
| 21 | `trail.refused` | A short low wooden knock with a slight shake, 0.15 s |
| 22 | `trail.undo` | A small wooden piece slid back one step, quiet, 0.15 s |
| 23 | `trail.reset` | A soft sweep of stones gathered back across wood, 0.4 s |
| 24 | `trail.solve` | A fast run of soft marimba notes rising, the whole path lighting 1 to 36, 1.1 s |
| 25 | `fences.cross` | A pencil making a small x on paper, two quick scratches, 0.15 s |
| 26 | `fences.clear` | A soft eraser rub on paper, one short stroke, 0.15 s |
| 27 | `fences.numberMet` | A tiny bright metal tick, like a thin gold wire plucked once, 0.2 s |
| 28 | `fences.over` | A low muted tick, flat and short, 0.15 s |
| 29 | `fences.solve` | A satisfying metal clasp clicking shut, then a faint sweep of wire, 0.6 s |
| 30 | `fences.loopWrong` | A soft single flicker of wire, a low muted buzz, not harsh (the loop closed but numbers fail), 0.4 s |
| 31 | `fences.undo` | A pencil lifted off paper with a tiny tick, 0.12 s |
| 32 | `fences.reset` | A sheet of paper wiped clean with a soft cloth, 0.4 s |
| 33 | `fillomino.stroke` | A soft ceramic tick, short; we raise it a step per square in a stroke, 0.08 s |
| 34 | `fillomino.region` | A soft chord on warm felt piano, three notes together; we pitch it by region size (1 high, 7 low), 0.6 s |
| 35 | `fillomino.over` | A short low enamel clink with a dull edge, 0.15 s |
| 36 | `fillomino.erase` | A soft cloth wipe across a tile, 0.15 s |
| 37 | `fillomino.undo` | A quiet reverse tick, like a small wooden piece slid back, 0.15 s |
| 38 | `fillomino.pick` | A soft press of a felt-topped key, tiny and round, 0.08 s |
| 39 | `fillomino.reset` | Tiles swept off a board onto felt, soft clatter, 0.4 s |
| 40 | `fillomino.solve` | Regions filling with colour in turn: soft rising ceramic chimes, smallest to largest, 1.2 s |
| 41 | `bridges.build` | Wooden planks laid in a quick row, ending in one solid wooden knock, 0.25 s |
| 42 | `bridges.double` | Two solid wooden knocks close together, 0.3 s |
| 43 | `bridges.remove` | Planks lifted away, a light wooden clatter, 0.25 s |
| 44 | `bridges.snapBack` | A small rubber band twanging back, soft and short, 0.2 s |
| 45 | `bridges.islandMet` | A small ring of a gold coin set on stone, 0.4 s |
| 46 | `bridges.solve` | A soft rising shimmer running along a rope bridge, airy, 1.0 s |
| 47 | `bridges.undo` | A single plank lifted and set aside, quiet, 0.15 s |
| 48 | `bridges.reset` | Several planks gathered up together, light wooden clatter, 0.4 s |

Every action on the seven boards has a sound above or in the kept list: placing, marking, clearing, refusing, each
number or line met, over, undo, reset, picking a tool, the near-end hint and each solve payoff.
