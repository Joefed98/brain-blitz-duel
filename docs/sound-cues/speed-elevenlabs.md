# Speed overhaul: sounds for Joe to generate in ElevenLabs

Phase 2 step 4 (15 Nov 2026). Every action in the six Speed games that needs a new or better sound, one line each:
what it is, the material, the feel and the length. Generate each as an MP3 named exactly as the **File** column and drop
it into `public/sounds/`; the overhaul's effects stage (stage 2, with the effects kit) wires each to its moment under that
name, playing the existing sound named under **Today** until the file is there. Sounds that already work are listed
under **Keep** and need nothing.

House rules for every file: dry and close (no room reverb), no music bed, no voice, a clean attack at 0 ms (hit sounds
must start on the first sample: the game plays them within one frame of the tap), peaks no higher than -1 dBFS.

## Flash

Keep: the flashes and decoys stay silent (a sound would give the answer away); `reaction.goldPulse` at the end of a good run.

| Game | Action | File | What to generate | Length | Today |
|---|---|---|---|---|---|
| Flash | A hit on the gold | `reaction.hit.mp3` | A crisp, dry snap: a fingertip striking a polished wooden board, sharp attack, no tail | 90 ms | the generic `move` tick |
| Flash | Three fast hits in a row | `reaction.combo.mp3` | A bright glass-and-brass two-note chime rising a fifth, clean and short (the game raises it a step per extra hit) | 250 ms | none |
| Flash | A tap on a decoy or the dark screen | `reaction.wrong.mp3` | A short muted buzz on wood, low and dull, clearly "no" but not harsh | 140 ms | `shared.reject` |
| Flash | "Done" (the last flash settled) | `reaction.done.mp3` | A wooden clapper closing twice, then a warm low bell note settling | 600 ms | none |
| Flash | Each flash's bar dropping in at the end | `reaction.bar.mp3` | A soft wooden tick, like a counter dropped on felt (the game pitches it up bar by bar) | 70 ms | none |

## Ascend

Keep: `numhunt.discsPop` (the finish pops).

| Game | Action | File | What to generate | Length | Today |
|---|---|---|---|---|---|
| Ascend | A right tap | `numhunt.note-low.mp3` | One warm rosewood marimba note, C3, soft mallet, natural decay | 300 ms | quiet `tick` |
| Ascend | A right tap | `numhunt.note-mid.mp3` | The same marimba note at C4 | 300 ms | quiet `tick` |
| Ascend | A right tap | `numhunt.note-high.mp3` | The same marimba note at C5 (the three let the game climb two octaves over 24 taps without pitch-shifting far) | 300 ms | quiet `tick` |
| Ascend | Five fast right taps | `numhunt.combo.mp3` | A quick upward marimba run of four notes ending on a bright high note | 400 ms | none |
| Ascend | A wrong tap | `numhunt.wrong.mp3` | A dull knock on an onyx counter: a low, short stone-on-wood thud | 150 ms | `wrong` |
| Ascend | The shuffle's warning, one second before | `numhunt.warn.mp3` | A small brass desk bell, struck once, light and clear | 900 ms | none |
| Ascend | The shuffle (every disc gliding to its new place) | `numhunt.shuffle.mp3` | Many smooth counters sliding across polished wood at once: a soft rising-then-falling whoosh | 320 ms | none |

## Don't Break the Chain

Keep: `chain.linkTone` (the rising tones), `chain.breakTone`, `chain.faster`, `chain.reverse`, `chain.finishShine`.

| Game | Action | File | What to generate | Length | Today |
|---|---|---|---|---|---|
| Don't Break the Chain | The board reshuffling every 5 links | `chain.reshuffle.mp3` | Glass charms sliding and settling on a wooden board: a soft whoosh with tiny clinks at the end | 300 ms | none |
| Don't Break the Chain | Under the tones for the last 5 links | `chain.heartbeat.mp3` | One low, soft heartbeat (lub-dub), muffled and deep, no click (the game repeats it, quickening) | 500 ms | none |

## Bonk

Keep: `whack.popUp`, `whack.sink`, `whack.finale`.

| Game | Action | File | What to generate | Length | Today |
|---|---|---|---|---|---|
| Bonk | A right hit (gold or red hat) | `whack.bonk.mp3` | A cartoon bonk: a rubber mallet on a hollow plastic hard hat, springy and round (the game pitches it up for streaks) | 180 ms | `correct` |
| Bonk | The rule flip (1/2) | `whack.whistle.mp3` | A short, sharp double whistle blast, bright and loud | 450 ms | `tick` |
| Bonk | The rule flip (2/2), the banner slamming in | `whack.slam.mp3` | A heavy wooden sign slammed down on a table: one deep thump with a short rattle | 260 ms | none |
| Bonk | A hedgehog bonked | `whack.hedgehog.mp3` | A heavy "wrong": a low prickly thud and a short grumpy squeak, dull and weighty | 320 ms | an explosion |
| Bonk | A wrong-colour hat | `whack.wrongHat.mp3` | A dull, hollow clonk on a hard hat, flat and short | 150 ms | `wrong` |
| Bonk | A diamond | `whack.diamond.mp3` | A crystalline sparkle: three tiny glassy pings rising quickly, airy | 420 ms | a pitched chime |
| Bonk | An empty burrow tapped | `whack.emptyTap.mp3` | A soft thud of a fingertip on turf, muffled | 80 ms | `ui.nope` |

## Tenfall

Keep: `tendrop.nextTarget`.

| Game | Action | File | What to generate | Length | Today |
|---|---|---|---|---|---|
| Tenfall | A tile applied | `tendrop.apply.mp3` | A crisp enamel tile clicking onto a wooden rail, light and clean | 70 ms | the generic `place` |
| Tenfall | The total counting to its new value | `tendrop.count.mp3` | A very short, soft wooden tick (played once per step of the count) | 30 ms | none |
| Tenfall | The total within 5 of the target | `tendrop.near.mp3` | A faint, warm rising shimmer of brass, gentle | 300 ms | none |
| Tenfall | A target hit (the total meets the target) | `tendrop.ten.mp3` | Two enamel tiles clacking together, then a bright brass "ting" burst | 500 ms | `correct` + `tendrop.clear` |
| Tenfall | An overshoot (the total shatters to 0) | `tendrop.shatter.mp3` | A small ceramic tile shattering on wood, crisp shards, no boom | 420 ms | `wrong` + `tendrop.reset` |
| Tenfall | A tap on empty board | `tendrop.tap.mp3` | A soft fingertip tap on oiled wood | 50 ms | silent |
| Tenfall | A ÷ refused (not exact) | `tendrop.refused.mp3` | A short tile rattle in its slot, dry wood, two quick knocks | 150 ms | `tick` |

## Pull!

Keep: `clayshoot.launch`, `clayshoot.birdStartle` (the feathers), `clayshoot.finalBurst`.

| Game | Action | File | What to generate | Length | Today |
|---|---|---|---|---|---|
| Pull! | An orange clay hit | `clayshoot.shot.mp3` | A shotgun report and a clay target shattering in the same instant, outdoor, crisp, short tail | 450 ms | `pz_clay_hit` |
| Pull! | A gold clay hit (1/2) | `clayshoot.goldShatter.mp3` | The same shot with a brighter, glassier shatter | 450 ms | the orange hit |
| Pull! | A gold clay hit (2/2) | `clayshoot.goldChime.mp3` | A bright single bell chime with a sparkle on top | 500 ms | none |
| Pull! | A clay escaping off screen | `clayshoot.escape.mp3` | A soft, falling whistle, airy, fading away | 400 ms | `move.softFall` |
| Pull! | A bird hit | `clayshoot.birdWrong.mp3` | A short dull "wrong": a low muted honk, played with the feathers | 250 ms | none (feathers only) |
| Pull! | A shot that hits nothing | `clayshoot.dryShot.mp3` | A distant shotgun report with no impact, thinner and quieter | 300 ms | `clay.missPuff` |

34 files in all.
