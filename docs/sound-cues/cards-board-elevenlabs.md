# Cards & Board overhaul: sounds for ElevenLabs (15 Nov 2026)

Every action in the five overhauled games (Free Cell, Mahjong Solitaire, Summit, Five Hands, Thirteen), what plays
today, and whether it needs a new or better recording. One line each for Joe to generate in ElevenLabs (sound effects,
"prompt influence" about 0.4, no music). Drop a file in `public/sounds/<slot>.mp3`, point the slot's `url` at it in
`src/lib/fx/manifest.ts` and it plays by name: a slot with no file keeps its fallback (or stays silent, as listed).

Recordings already good and kept (named by file): `cards_shuffle` (the deal), `cards_place` (a card set down), `cards_pick` (a card
lifted), `cards_deal` (a stock card turned), `cards_home` (a card home), `freecell_cascade`, `freecell_win`,
`tripeaks_run` (pitched up a semitone a card), `tripeaks_peak`, `tripeaks_clear`, `poker_hand`, `poker_big_hand`,
`poker_final`, `mahjong_select`, `mahjong_match`, `mahjong_shuffle`, `mahjong_clear`, `mahjong_invalid`.

## Wired now (stage 1): the slot exists and plays its file as soon as one is set

| Slot | Game | Moment | Today | Prompt for ElevenLabs |
| --- | --- | --- | --- | --- |
| `freecell.undo` | Free Cell | Undo: the card slides back | `cards_place` | "A single playing card sliding quickly back across green baize, soft paper swish ending in a gentle tap, 0.3 seconds, dry, close-up" |
| `freecell.reset` | Free Cell | Reset: every card gathered back to the deal | `cards_place` | "A whole deck of playing cards swept together across felt and squared into a pile, quick riffle-like whoosh then a soft thud, 0.6 seconds" |
| `mahjong.undo` | Mahjong Solitaire | Undo: a pair set back on the stack | `tick` | "Two smooth ivory game tiles set gently back down on a felt mat, soft double click, 0.3 seconds, dry" |
| `mahjong.reset` | Mahjong Solitaire | Reset: the stack rebuilt | `shared.celebrate.zap` | "A handful of ivory mahjong-style tiles shuffled and stacked back on felt, quick clattering whoosh settling to a soft clack, 0.6 seconds" |
| `pyramid.undo` | Thirteen | Undo: a pair back on the pyramid | `tick` | "Two playing cards laid back down on felt one after the other, light paper tap tap, 0.3 seconds" |
| `pyramid.reset` | Thirteen | Reset: the pyramid dealt again | `shared.celebrate.zap` | "A dealer quickly laying out a row of playing cards on felt, rapid soft flicks ending in a tap, 0.6 seconds" |
| `tripeaks.flip` | Summit | A peak card turned face up as the cards over it go | silent | "One playing card flipped over on felt, crisp light flick of card stock, 0.2 seconds, very dry, close-up" |
| `cards.confirm` | Free Cell, Mahjong, Thirteen | Reset's question opens ("Reset to the deal?") | silent | "A soft, low wooden table knock, single muted tap, 0.25 seconds, warm and quiet" |

## Wired in stage 2 (the effects): the slot exists and plays its file as soon as one is set

| Slot | Game | Moment | Today (until a file is set) | Prompt for ElevenLabs |
| --- | --- | --- | --- | --- |
| `freecell.wobble` | Free Cell | A wrong move wobbling back to where it came from | `freecell.invalid` | "A playing card wobbling and dropping back onto felt, quick soft flutter then tap, 0.3 seconds" |
| `freecell.combo` | Free Cell | Two or more cards home in a row ("×n") | `freecell.cascade` | "A quick rising two-note sparkle, light and bright, 0.35 seconds" |
| `freecell.bounce` | Free Cell | The end: the short bouncing-cards cascade before "ALL HOME!" | `freecell.win` | "Playing cards bouncing lightly and rhythmically across a table, playful soft taps getting faster, 0.9 seconds" |
| `mahjong.pairFly` | Mahjong Solitaire | A matched pair sliding together, clicking and flying off (pitched up for quick pairs) | `mahjong.match`, pitched up in a quick chain | "Two ivory tiles knocked together with a clear click then a short airy whoosh, 0.4 seconds" |
| `mahjong.wrongPair` | Mahjong Solitaire | A wrong pair: both tiles shake once | `mahjong.invalid` | "Two ivory tiles rattled briefly against each other, soft dull clack, 0.25 seconds" |
| `mahjong.blockers` | Mahjong Solitaire | A blocked tile: the tiles blocking it flash | `mahjong.blocked` | "A muted low wooden tock, short, 0.15 seconds" |
| `mahjong.spin` | Mahjong Solitaire | Shuffle: the tiles spin in place and land again | `mahjong.shuffle` | "A dozen ivory tiles spun and set down on felt, light clattering swirl ending in soft clacks, 0.9 seconds" |
| `mahjong.nearEnd` | Mahjong Solitaire | Six tiles left: the mat brightens | silent | "A soft warm swell like a light coming on, airy pad, 0.6 seconds" |
| `mahjong.shower` | Mahjong Solitaire | The end: a tile shower before "CLEARED!" | `mahjong.clear` | "Many small ivory tiles raining down onto felt, bright clattering cascade, 1.2 seconds" |
| `tripeaks.ladderBreak` | Summit | The run ladder crumbling when a stock turn breaks it | silent | "A small stack of cards toppling over, quick soft flutter downwards, 0.4 seconds" |
| `tripeaks.peakFly` | Summit | A peak top flying up with a sparkle | `tripeaks.peak` | "A card flicked up into the air with a bright twinkling sparkle, 0.6 seconds" |
| `tripeaks.nudge` | Summit | A wrong card nudging towards the discard and springing back | `tripeaks.invalid` | "A card nudged and springing back on felt, soft springy tap, 0.25 seconds" |
| `tripeaks.stuck` | Summit | "No plays left": a held tone before the reveal | `wrong`, quiet | "A soft low held synth tone fading out, calm not alarming, 1.2 seconds" |
| `tripeaks.peaksLight` | Summit | The end: the cleared peaks lighting one after another | `tripeaks.clear` | "Three rising soft bell tones in sequence, warm, 1 second" |
| `fivehands.flip` | Five Hands | The turned card flipping onto the discard row | silent | "One playing card flipped over on felt, crisp light flick, 0.2 seconds" |
| `fivehands.stamp` | Five Hands | A hand name stamped onto its badge (bigger stamp for bigger hands) | `fivehands.hand` | "A rubber stamp pressed firmly onto paper, satisfying thump, 0.3 seconds" |
| `fivehands.bigStamp` | Five Hands | A hand name stamped onto its badge (bigger stamp for bigger hands) | `fivehands.bigHand` | "A heavy brass seal pressed down with a deep thump and a short shimmer, 0.6 seconds" |
| `fivehands.columnTick` | Five Hands | The picked column's cards lifting one by one | `tick` | "A tiny dry wooden tick, 0.08 seconds" |
| `fivehands.countUp` | Five Hands | The column's points flying into the total and the "× 1.4" count-up | silent | "Fast coin-like counting ticks rising in pitch, ending on a bright ding, 1 second" |
| `pyramid.pairFly` | Thirteen | A pair sliding together and flying off with "13" (pitched up in a quick chain) | `pyramid.pair`, pitched up in a quick chain | "Two playing cards swept together and flicked away, quick papery whoosh, 0.4 seconds" |
| `pyramid.kingFlourish` | Thirteen | A King spinning off alone | `pyramid.king` | "A short regal brass fanfare flourish, three bright notes, 0.7 seconds" |
| `pyramid.wrongPair` | Thirteen | A wrong pair: both cards shake, one sound | `pyramid.invalid` | "Two cards rattled briefly against each other, soft dull flutter, 0.25 seconds" |
| `pyramid.uncover` | Thirteen | A card brightening as its last cover goes | silent | "A soft airy shimmer, very short, 0.2 seconds" |
| `pyramid.outline` | Thirteen | The end: the pyramid's outline lighting from the bottom up | `pyramid.clear` | "A rising soft arpeggio of seven bell notes, warm, 1.2 seconds" |

Free Cell's home chime is `freecell.home` (already recorded), now pitched a step of the major scale per rank, so a whole
suit going home plays a scale.

## Not given a slot of their own

These moments play an existing sound that already fits; a file of their own is optional.

- A card sliding along its short arc and snapping into place (the "soft card tap") (Free Cell, Summit, Five Hands, Thirteen; planned slot name: cards · slide). Prompt: "A playing card slid a short way across felt and set down with a soft snap, 0.18 seconds, dry, close-up"
- A card snapping onto its home pile, climbing a step per card so a full suit plays a scale (Free Cell; planned slot name: freecell · home1 to home13, one file pitched in code). Prompt: "A single bright glass chime note, short and clean, C5, 0.4 seconds, gentle attack, no reverb tail"
- A tile lifting off the stack when picked (Mahjong Solitaire; planned slot name: mahjong · lift). Prompt: "An ivory game tile lifted off a stack, tiny smooth click, 0.15 seconds, close-up"
- A selected card lifting with a shadow (Thirteen; planned slot name: pyramid · lift). Prompt: "A playing card lifted off felt, light paper whisper, 0.15 seconds"

## To wire with the levels (stage 3)

- The hint button: one good move glows softly (all five; planned slot name: cards · hint). Prompt: "A gentle magical sparkle with a soft rising chime, 0.5 seconds, light and friendly"
- The free glow after 8 s idle (all five (Easy); planned slot name: cards · hintIdle). Prompt: "A very quiet soft glimmer, 0.3 seconds"
- "No moves: Undo or Reset" appears (Free Cell, Thirteen; planned slot name: cards · deadEnd). Prompt: "A soft low two-note descending tone, calm, 0.6 seconds"
