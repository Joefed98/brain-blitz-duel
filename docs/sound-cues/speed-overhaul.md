# Speed overhaul sounds (stage 2, 15 Nov 2026)

The new moments of the six Speed games' effects. Each slot plays `public/sounds/<slot>.mp3`, today a placeholder copy of a
library sound; Joe's ElevenLabs recordings ([speed-elevenlabs.md](speed-elevenlabs.md)) replace them by name. Four
existing slots got their own named file the same way (`whack.emptyTap`, `tendrop.apply`, `clayshoot.goldShatter`,
`clayshoot.escape`; their rows are in speed-attention.md and arcade.md). `tendrop.refused` stays without a file: a refused
tile already plays the quiet wrong of every wrong-move shake, so a rattle on top would be two sounds (a decision for Joe).

| Cue | Game | Trigger | Length |
|---|---|---|---|
| `reaction.hit` | Flash | A hit on the gold: a crisp snap | 90 ms |
| `reaction.combo` | Flash | Three fast hits in a row: a rising chime, a step higher each hit | 250 ms |
| `reaction.wrong` | Flash | A tap on a decoy or the dark screen: a short muted buzz | 140 ms |
| `reaction.done` | Flash | Done: every flash settled | 600 ms |
| `reaction.bar` | Flash | Reveal: each flash's bar dropping in, pitched up bar by bar | 70 ms |
| `numhunt.note-low` | Ascend | A right tap, taps 1–8: one marimba note, a step higher each tap | 300 ms |
| `numhunt.note-mid` | Ascend | A right tap, taps 9–16 | 300 ms |
| `numhunt.note-high` | Ascend | A right tap, taps 17–24 | 300 ms |
| `numhunt.combo` | Ascend | Five fast right taps in a row | 400 ms |
| `numhunt.wrong` | Ascend | A wrong tap: a dull knock on that disc | 150 ms |
| `numhunt.warn` | Ascend | One second before the discs move: a small brass bell | 900 ms |
| `numhunt.shuffle` | Ascend | The discs gliding to their new places: a whoosh | 320 ms |
| `chain.reshuffle` | Don't Break the Chain | The board reshuffling every 5 links: a soft whoosh | 300 ms |
| `chain.heartbeat` | Don't Break the Chain | Under the tones for the last 5 links: a low heartbeat | 500 ms |
| `whack.bonk` | Bonk | A right hit (gold or red hat): a cartoon bonk, pitched up for streaks | 180 ms |
| `whack.whistle` | Bonk | The rule flip: a short double whistle | 450 ms |
| `whack.slam` | Bonk | The rule flip: the banner slamming in | 260 ms |
| `whack.hedgehog` | Bonk | A hedgehog bonked: a heavy wrong | 320 ms |
| `whack.wrongHat` | Bonk | A wrong-colour hat: a dull clonk | 150 ms |
| `whack.diamond` | Bonk | A diamond: a crystalline sparkle | 420 ms |
| `tendrop.count` | Tenfall | The total counting to its new value: one soft tick a step | 30 ms |
| `tendrop.near` | Tenfall | The total within 5 of the target: a faint rising shimmer | 300 ms |
| `tendrop.tenBurst` | Tenfall | A target hit: tiles clacking and a bright burst | 500 ms |
| `tendrop.shatter` | Tenfall | An overshoot: the total shatters to 0 | 420 ms |
| `tendrop.tap` | Tenfall | A tap on empty board: a soft tap | 50 ms |
| `clayshoot.shot` | Pull! | An orange clay hit: shot and shatter in one | 450 ms |
| `clayshoot.goldChime` | Pull! | A gold clay hit: a bright chime with the shatter | 500 ms |
| `clayshoot.birdWrong` | Pull! | A bird hit: a short dull wrong, with the feathers | 250 ms |
