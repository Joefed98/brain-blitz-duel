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

## To wire with the effects (stage 2, once the effects kit is on main)

- A card sliding along its short arc and snapping into place (the "soft card tap") (Free Cell, Summit, Five Hands, Thirteen; planned slot name: cards · slide). Prompt: "A playing card slid a short way across felt and set down with a soft snap, 0.18 seconds, dry, close-up"
- A card snapping onto its home pile, climbing a step per card so a full suit plays a scale (Free Cell; planned slot name: freecell · home1 to home13, one file pitched in code). Prompt: "A single bright glass chime note, short and clean, C5, 0.4 seconds, gentle attack, no reverb tail"
- A wrong move wobbling back to where it came from (Free Cell; planned slot name: freecell · wobble). Prompt: "A playing card wobbling and dropping back onto felt, quick soft flutter then tap, 0.3 seconds"
- Two or more cards home in a row ("×n") (Free Cell; planned slot name: freecell · combo). Prompt: "A quick rising two-note sparkle, light and bright, 0.35 seconds"
- The end: the short bouncing-cards cascade before "ALL HOME!" (Free Cell; planned slot name: freecell · bounce). Prompt: "Playing cards bouncing lightly and rhythmically across a table, playful soft taps getting faster, 0.9 seconds"
- A tile lifting off the stack when picked (Mahjong Solitaire; planned slot name: mahjong · lift). Prompt: "An ivory game tile lifted off a stack, tiny smooth click, 0.15 seconds, close-up"
- A matched pair sliding together, clicking and flying off (pitched up for quick pairs) (Mahjong Solitaire; planned slot name: mahjong · pairFly). Prompt: "Two ivory tiles knocked together with a clear click then a short airy whoosh, 0.4 seconds"
- A wrong pair: both tiles shake once (Mahjong Solitaire; planned slot name: mahjong · wrongPair). Prompt: "Two ivory tiles rattled briefly against each other, soft dull clack, 0.25 seconds"
- A blocked tile: the tiles blocking it flash (Mahjong Solitaire; planned slot name: mahjong · blockers). Prompt: "A muted low wooden tock, short, 0.15 seconds"
- Shuffle: the tiles spin in place and land again (Mahjong Solitaire; planned slot name: mahjong · spin). Prompt: "A dozen ivory tiles spun and set down on felt, light clattering swirl ending in soft clacks, 0.9 seconds"
- Six tiles left: the mat brightens (Mahjong Solitaire; planned slot name: mahjong · nearEnd). Prompt: "A soft warm swell like a light coming on, airy pad, 0.6 seconds"
- The end: a tile shower before "CLEARED!" (Mahjong Solitaire; planned slot name: mahjong · shower). Prompt: "Many small ivory tiles raining down onto felt, bright clattering cascade, 1.2 seconds"
- The run ladder crumbling when a stock turn breaks it (Summit; planned slot name: tripeaks · ladderBreak). Prompt: "A small stack of cards toppling over, quick soft flutter downwards, 0.4 seconds"
- A peak top flying up with a sparkle (Summit; planned slot name: tripeaks · peakFly). Prompt: "A card flicked up into the air with a bright twinkling sparkle, 0.6 seconds"
- A wrong card nudging towards the discard and springing back (Summit; planned slot name: tripeaks · nudge). Prompt: "A card nudged and springing back on felt, soft springy tap, 0.25 seconds"
- "No plays left": a held tone before the reveal (Summit; planned slot name: tripeaks · stuck). Prompt: "A soft low held synth tone fading out, calm not alarming, 1.2 seconds"
- The end: the cleared peaks lighting one after another (Summit; planned slot name: tripeaks · peaksLight). Prompt: "Three rising soft bell tones in sequence, warm, 1 second"
- The turned card flipping onto the discard row (Five Hands; planned slot name: fivehands · flip). Prompt: "One playing card flipped over on felt, crisp light flick, 0.2 seconds"
- A hand name stamped onto its badge (bigger stamp for bigger hands) (Five Hands; planned slot name: fivehands · stamp and fivehands · bigStamp). Prompt: "A rubber stamp pressed firmly onto paper, satisfying thump, 0.3 seconds" / "A heavy brass seal pressed down with a deep thump and a short shimmer, 0.6 seconds"
- The picked column's cards lifting one by one (Five Hands; planned slot name: fivehands · columnTick). Prompt: "A tiny dry wooden tick, 0.08 seconds"
- The column's points flying into the total and the "× 1.4" count-up (Five Hands; planned slot name: fivehands · countUp). Prompt: "Fast coin-like counting ticks rising in pitch, ending on a bright ding, 1 second"
- A selected card lifting with a shadow (Thirteen; planned slot name: pyramid · lift). Prompt: "A playing card lifted off felt, light paper whisper, 0.15 seconds"
- A pair sliding together and flying off with "13" (pitched up in a quick chain) (Thirteen; planned slot name: pyramid · pairFly). Prompt: "Two playing cards swept together and flicked away, quick papery whoosh, 0.4 seconds"
- A King spinning off alone (Thirteen; planned slot name: pyramid · kingFlourish). Prompt: "A short regal brass fanfare flourish, three bright notes, 0.7 seconds"
- A wrong pair: both cards shake, one sound (Thirteen; planned slot name: pyramid · wrongPair). Prompt: "Two cards rattled briefly against each other, soft dull flutter, 0.25 seconds"
- A card brightening as its last cover goes (Thirteen; planned slot name: pyramid · uncover). Prompt: "A soft airy shimmer, very short, 0.2 seconds"
- The end: the pyramid's outline lighting from the bottom up (Thirteen; planned slot name: pyramid · outline). Prompt: "A rising soft arpeggio of seven bell notes, warm, 1.2 seconds"

## To wire with the levels (stage 3)

- The hint button: one good move glows softly (all five; planned slot name: cards · hint). Prompt: "A gentle magical sparkle with a soft rising chime, 0.5 seconds, light and friendly"
- The free glow after 8 s idle (all five (Easy); planned slot name: cards · hintIdle). Prompt: "A very quiet soft glimmer, 0.3 seconds"
- "No moves: Undo or Reset" appears (Free Cell, Thirteen; planned slot name: cards · deadEnd). Prompt: "A soft low two-note descending tone, calm, 0.6 seconds"
