# Attention overhaul: sounds to generate in ElevenLabs (15 Nov 2026)

Every action in the six Attention games, what plays today, and one line for each sound that needs a new or better
recording. Restraint rule: small, quiet sounds that confirm a tap without pulling the eye off the board; one proper
moment at the end. Save each file as `public/sounds/<slot>.mp3` (mono, 44.1 kHz, trimmed to the attack); the slot is
already named in `src/lib/fx/manifest.ts` (or listed here as "new slot" for the effects stage) and plays silently, or
on its placeholder behind `NEW_GAME_SOUNDS`, until the url is set.

**Kept as they are** (good already): `symscan.takeoff` and `symscan.eagle` (the final take-off and cry), `bomb.cut`
(the snip), `bomb.solve` (the reveal's defuse), `countup.trayIn`, `countup.countersTick` / `countersLock` (the reveal's
counters), `pz_bomb_explode` (the reveal's explosion).

## Eagle Eye

| Action | Slot | Prompt for ElevenLabs |
|---|---|---|
| Mark an eagle | `symscan.mark` | A soft feather tick: one light, dry flick of a quill on paper, very short, quiet. 0.1 s |
| Unmark | `symscan.unmark` | The same feather tick, lighter and a touch lower, as if brushed back. 0.08 s |
| Submit a grid: the right eagles fly off | `symscan.gridClear` (new slot) | A short soft whoosh of a few wings lifting at once, airy, no cry. 0.6 s |
| A grid with no wrong marks | `symscan.cleanGrid` (new slot) | A quiet sparkle: two tiny high glass chimes, gentle, falling away. 0.4 s |
| The reveal pulses the missed eagles ("2 missed") | `symscan.missed` (new slot) | One soft low wooden knock, muted, informative not negative. 0.2 s |

## Double Take

| Action | Slot | Prompt for ElevenLabs |
|---|---|---|
| A difference found (a pen circle on both pictures) | `spotdiff.found` | A light, clear two-note chime on a small metal bell, bright but quiet, up a fifth. 0.35 s |
| Two finds within 2 s | `spotdiff.combo` (new slot) | The same bell one step higher, a little brighter (played pitched for each further step). 0.3 s |
| A wrong square | `spotdiff.miss` | A short muted "nope": a dull felt-covered wood tap, low, very quiet. 0.15 s |
| The hidden seventh found | `spotdiff.hidden` (new slot) | A distinct sparkle: a soft shimmer of three tiny high chimes rising, magical but small. 0.6 s |
| A picture done slides out | `spotdiff.pictureOut` (new slot) | A soft paper-on-wood slide, smooth, short. 0.35 s |

## Tally

| Action | Slot | Prompt for ElevenLabs |
|---|---|---|
| A keypad press | `countup.key` (new slot) | A crisp small plastic key click, like a good calculator key, dry, quiet. 0.06 s |
| Tap a shape to mark it counted | `countup.mark` | A tiny ceramic tick: a fingernail tap on an enamel token, short and soft. 0.08 s |
| Take a mark off | `countup.unmark` | The same tick, lighter and a touch lower. 0.06 s |
| Enter: the tray slides away | `countup.trayOut` (new slot) | A felt tray sliding off a wooden table, soft, short. 0.4 s |
| The reveal lights each matching shape in turn | `countup.revealTick` (new slot) | One small soft wooden tick, very short (it repeats quickly, pitched slightly up each time). 0.04 s |
| Off by one ("So close: 11, you said 12") | `countup.soClose` (new slot) | A gentle two-note "almost": a soft marimba note and the note just below, warm. 0.4 s |

## Labyrinth

| Action | Slot | Prompt for ElevenLabs |
|---|---|---|
| Each step of the trail | `maze.step` (new slot) | A soft tick of a small brass ball rolling one square on stone, very short and quiet (pitched up slightly at each junction passed). 0.05 s |
| Into a wall | `maze.bump` (new slot) | A dull bump of a small metal ball against stone, low, muted, no ring. 0.12 s |
| Backtracking (the trail retracts) | `maze.back` (new slot) | A lighter, softer tick than the step, like a thread pulled back. 0.04 s |
| The tip of a dead end | `maze.deadEnd` (new slot) | A short falling two-note glide on a soft mallet, a cue to turn back. 0.3 s |
| The exit: the route traces in light | `maze.trace` | A warm rising shimmer on soft chimes that settles, the round's one proper moment. 1.0 s |

## Bomb Defusal

| Action | Slot | Prompt for ElevenLabs |
|---|---|---|
| Press A or B | `bomb.press` | A heavy, firm click of a domed metal button bottoming out in a steel panel, no beep. 0.12 s |
| Each step fills a pip in the step counter | `bomb.step` (new slot) | A tiny relay click inside a metal box, short and dry. 0.05 s |
| DEFUSE right: the timer stops | `bomb.defuse` | A long relieved tone: a low electronic hum winding down to silence with a soft final click, calm. 1.2 s |
| Expert: one wrong step explodes the bomb at once | `bomb.instant` (new slot) | A short sharp detonation with a quick metal rattle and debris, punchy, not long. 0.8 s |

## Matchmaker

| Action | Slot | Prompt for ElevenLabs |
|---|---|---|
| Turn a card | `pairmatch.flip` (new slot) | A single playing card flicked over on felt, crisp, quiet. 0.1 s |
| A match: both cards lift and lock face up | `pairmatch.match` (new slot) | A bright small chime with a soft card tap under it, pleasant, short. 0.35 s |
| Each match in a streak | `pairmatch.streak` (new slot) | One clean bell note (played pitched up a step for each match in the run). 0.3 s |
| A miss: the cards flip back | `pairmatch.miss` (new slot) | One soft low "wrong": a muted felt thud, very quiet. 0.15 s |
| The gold pair matched | `pairmatch.gold` (new slot) | Its own shimmer: a soft rising glissando of tiny metallic chimes, warm gold, small. 0.7 s |
| Finish: the card wave | `pairmatch.finish` (new slot) | A ripple of many cards flipping in a quick wave on felt, ending on a soft chord. 1.0 s |
| The streak and gold bonuses count up | `pairmatch.bonusCount` (new slot) | A tiny soft coin tick, very short (repeats while counting, pitched slightly up). 0.04 s |

Slots marked "new slot" are added to the manifest with the effects stage (they fire from the effects kit's moments).
