# Number games: sounds for ElevenLabs (15 Nov 2026)

The Number overhaul (docs/number-overhaul.md). Every action in the eight Number games was walked, with what it plays
today; each line below is a sound to generate. **Name the file exactly as the slot** (`balance.drop.mp3`) and put it
in `public/sounds/`; the slot already exists in `src/lib/fx/manifest.ts`, playing a library stand-in (or, for the
slots marked *switch*, a synthesised placeholder behind `NEW_GAME_SOUNDS` in `src/config/soundConfig.ts`) until then.
Lengths are targets; effects are trimmed and levelled to the library on the way in (docs/sound-cues/levels-nov-2026.md).

The sounds already good enough are kept and not listed: Counterweight's refused hang (`shared.reject`), Exact's
illegal combine (`wrong`), Checkout's dart thud (`checkout.thud`) and solve (`checkout.solve`), Kakuro's solve
(`kakuro.solve`), Operator's and Integer Pyramid's final solves (`equation.solve`, `numpyramid.solve`), Brimful's
final solve (`measure.solve`), Ballpark's payoff (`numline.solve`, `numline.sweepTick`), and the shared reject on a
repeated wrong Operator fill or a full wrong pyramid.

## The shared stage moments (all six stage games)

One family across the games, so a cleared stage always sounds the same kind of right, and skip and fail never sound
like a win.

| Slot | Line |
|---|---|
| `balance.stageClear` | The scale locks level: a rising two-note brass bell chime; bright, clean; 500 ms. |
| `equation.stageClear` | A rising two-note chime on soft brass bells; bright, satisfying; 400 ms. |
| `numpyramid.stageClear` | A rising two-note chime on soft brass bells, the same family as Operator's; 400 ms. |
| `measure.stageClear` | A rising two-note chime on a warm glass marimba; 350 ms. |
| `checkout.stageClear` | A rising two-note chime on a bright brass bell, a board checked out; 400 ms. |
| `numline.stageClear` | A rising two-note chime, light and metallic; 350 ms. |
| `equation.skip` | A flat paper-card swish sliding away; neutral, never celebratory; 300 ms. |
| `numpyramid.skip` | A flat swish of a stone tray sliding away; neutral; 300 ms. |
| `balance.fail` | Out of hangs: a dull wooden thunk as the scale settles grey; flat, not harsh; 300 ms. |
| `equation.fail` | Out of tries: a heavy wooden thunk as the line locks; dull, final, no ring; 300 ms. |
| `measure.fail` | A board out of moves: a dull wooden thunk, muted; 200 ms. |

The other games' `.skip` and `.fail` slots (Counterweight's skip, Brimful's skip, Checkout's and Ballpark's skip and
fail, Integer Pyramid's fail) exist for consistency and are not played: those games have no such moment.

## Counterweight

| Slot | Line |
|---|---|
| `balance.select` | A cast-iron kettlebell lifted off a wooden tray: a soft wood-iron scrape and a small lift; light; 150 ms. |
| `balance.pickup` | A kettlebell unhooked from a brass notch: a small brass clink, then a lift; crisp; 180 ms. |
| `balance.drop` *switch* | A kettlebell swung onto a brass hook: a metal clink with a wooden beam creak under it; satisfying; 300 ms. |
| `balance.lift` *switch* | A kettlebell set back down on a wooden tray: a soft iron-on-wood thunk; muted; 220 ms. |
| `balance.nudge` | "Pick a weight first": a quick, soft, low wooden double knock on the tray; a gentle "not yet"; 200 ms. |
| `balance.solve` | The last scale balances: a bright bell with the beam settling and a warm rising tail; rewarding; 1,000 ms. |

## Exact

| Slot | Line |
|---|---|
| `target.select` | A polished stone tile lifted: a soft glassy tick; light; 120 ms. |
| `target.operator` | A small key pressed (and pressed again to let go): a dry, short click; neutral; 100 ms. |
| `target.combine` | Two tiles slide together and merge: a smooth slide into a pop whose pitch rises with the result's size; 250 ms. |
| `target.undo` | The merge played backwards: a reverse pop and a short slide apart; 220 ms. |
| `target.reset` | Every tile slides home: a soft sweep of several tiles settling; 350 ms. |
| `target.lock` | A number locked in by hand: a firm metal stamp with a short ring; decisive; 400 ms. |
| `target.solve` | The result flies into the gold target: a rising whoosh into a bright metal ring as the plate flips gold; triumphant; 1,100 ms. |

## Operator

| Slot | Line |
|---|---|
| `equation.drop` *switch* | A polished stone number tile clicking into a recessed slot; crisp, dense; 120 ms. |
| `equation.clearGap` | The same tile lifted out: a soft, light reverse click; 120 ms. |
| `equation.chooseGap` | A tiny brass tick, choosing a slot; quiet, precise; 100 ms. |
| `equation.tryCracked` | A full line that isn't true: a small ceramic pip cracking; dry, short, slightly sour; 150 ms. |
| `equation.goBack` | Back to a skipped equation: a soft wooden slide-back with a click; calm; 250 ms. |

## Integer Pyramid

| Slot | Line |
|---|---|
| `numpyramid.pick` | A small oak block lifted from felt: a light wooden lift; 120 ms. |
| `numpyramid.place` *switch* | A limestone block set onto stone: a short, dense thunk; 150 ms. |
| `numpyramid.swap` | Two stone blocks knocking past each other: a quick double knock; 150 ms. |
| `numpyramid.unplace` | A stone slid off back to the wooden tray: a soft scrape and tap; 150 ms. |
| `numpyramid.seam` | A right sum: a faint, warm metallic shimmer, a gold seam closing; gentle; 200 ms. |
| `numpyramid.crack` | A wrong sum: limestone cracking; short, brittle, low; 250 ms. |
| `numpyramid.row` | A full row right (wired with the effects kit): a soft rising combo tone on a stone chime; 300 ms. |

## Brimful

| Slot | Line |
|---|---|
| `measure.select` | Lifting a glass jug off a wooden shelf: a soft glass clink; 150 ms. |
| `measure.pour` *switch* | Water poured from one glass jug into another: a short glug rising in pitch as it fills; 350 ms. |
| `measure.fill` *switch* | Tap water running into a glass jug, the pitch rising (sized to the amount by the app); 400 ms. |
| `measure.empty` *switch* | A glass jug tipped out: a quick splash and a falling gurgle; 300 ms. |
| `measure.reject` | A refused move: a glass jug knocking the shelf, dull and short; 150 ms. |
| `measure.reset` *switch* | The jugs set back on the shelf: two soft glass taps and a light whoosh; 250 ms. |
| `measure.target` | The water meets the target line (wired with the effects kit): a single bright small glass plink; 200 ms. |
| `measure.near` | One move from the target (wired with the effects kit): a very soft glass shimmer, a hint; 250 ms. |

## Checkout

| Slot | Line |
|---|---|
| `checkout.aim` | Sighting a wedge: a soft felt-and-wood tick, dry and quiet; 120 ms. |
| `checkout.tick` | The remaining score counting down: a small chalkboard score tick, a soft clack; 100 ms. |
| `checkout.bust` | A dart rattling out of a bristle board and dropping onto wood, with a short low "nope" thud; 450 ms. |
| `checkout.undo` | A steel dart pulled from bristle: a light tug and a fibre rasp; 220 ms. |
| `checkout.nudge` | "Pick a wedge first": a soft, muted double tap on a felt button; gentle; 150 ms. |
| `checkout.switch` | Changing board: a light wooden tab click; 90 ms. |
| `checkout.wrong` | A Throw that doesn't check out: a dull wooden knock with a short descending buzz; 300 ms. |
| `checkout.bigFinish` | A big finish: a small crowd's appreciative "ohh!" swelling into a short cheer; 900 ms. |

## Ballpark

| Slot | Line |
|---|---|
| `numline.dragTick` | The marker crossing each tenth of the line (wired with the effects kit): a faint tiny metal tick on a steel ruler, very quiet; 30 ms. |
| `numline.edge` | A tap beyond an end: a soft, dampened knock against a metal end stop; 120 ms. |
| `numline.place` *switch* | A pin pressed into a steel rule: a clean small metallic "tok"; 120 ms. |
| `numline.bullseye` | A bullseye at the payoff (wired with the effects kit): a tiny bright sparkle chime; 250 ms. |

## Kakuro

| Slot | Line |
|---|---|
| `kakuro.select` | Choosing a square: a very soft glassy tap on a stone tile; 60 ms. |
| `kakuro.place` | A numeral set on a stone tile: a firm, soft tap; 110 ms. |
| `kakuro.pencil` | A pencil mark: a light graphite tick on paper; 70 ms. |
| `kakuro.clear` | A square cleared: a soft brush wiping a tile clean, falling; 200 ms. |
| `kakuro.broken` | A run broken: a low, muted wooden tick, once, slightly dissonant; 200 ms. |
| `kakuro.run` | A run complete and right: a two-note marimba rise (the app pitches it by the run's length); warm; 350 ms. |
| `kakuro.combo` | Two runs completed at once: two quick marimba rises overlapping into a bright chord; 600 ms. |
