# Word games: sounds to generate in ElevenLabs

The Word overhaul (15 Nov 2026, phase 2 step 4; `docs/design/game-reviews/word.md`). One line for every Word-game
action that needs a new or better sound, for Joe to generate in ElevenLabs's sound-effects tool. Each line gives the
slot, the file it drops in as, what it is, its material, its feel and its length.

**How a file drops in.** Save each recording as `public/sounds/<file>` exactly as named below. Each slot is named in
`src/lib/fx/manifest.ts` and played by its game (the keyboards' key press now; the rest as the overhaul's effects
land, stage 2); until Joe's file arrives a synthesised placeholder of the
same name (`scripts/sound-review-nov-2026/make.py`, listed in `src/lib/fx/newGameSounds.data.ts`) plays behind the
`NEW_GAME_SOUNDS` switch (`src/config/soundConfig.ts`, off by default, so the games sound as they do today). After
dropping files in, level them as the house does (`docs/sound-cues/levels-nov-2026.md`: mono, 44.1 kHz, peaks at
-1 dBFS or under, near the library median for their length) and re-measure with
`scripts/sound-audit-nov-2026/measure.py`; then switch `NEW_GAME_SOUNDS` on.

**Prompting.** Keep every prompt dry and close: "close-miked, dry, no reverb, no music". Short effects should start on
the attack (no lead-in silence). Generate three or four takes and keep the cleanest.

## Kept as they are

These already sound right and stay: every game's finish sting (`<game>.finish`, `docs/sound-cues/word.md`), the shared
`correct`, `wrong` (soft, on every shake), `place` and `move` ticks, Slider's padlock (`pz_padlock`), Nucleus's
pangram moment card (`shared.momentcard`), Strikeout's typewriter flip on a hit (`place`), Cryptogrid's diagonal flip
(`codeword.finish`, `done.tileFlip.mp3`).

## Shared by the keyboards

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `strikeout.key`, `codeword.key` (`word.key.mp3`) | Any key on Strikeout's or Cryptogrid's keyboard | A soft typewriter key: a light plastic-and-metal key bottoming out, dry and short, never a loud clack | 40–70 ms |

## Nucleus

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `wordsmith.letter` (`wordsmith.letter.mp3`) | A letter rises out of the ring | A soft key click: a small ceramic disc tapped by a fingertip, round and quiet | 40–60 ms |
| `wordsmith.shuffle` (`wordsmith.shuffle.mp3`) | Shuffle slides the letters round | Ceramic discs sliding over a lacquered tray: a short smooth whoosh with a few gentle clicks | 350–450 ms |
| `wordsmith.word4` … `wordsmith.word9` (`wordsmith.word4.mp3` … `wordsmith.word9.mp3`) | A valid word flies to the list; the note rises with its length (4 low, 9 high) | One bright mallet note on a warm glass bell, the same timbre on six rising steps of a major scale | 250–350 ms each |
| `wordsmith.combo` (`wordsmith.combo.mp3`) | Three words inside 10 s | A quick three-note rising arpeggio on the same glass bell | 400–500 ms |
| `wordsmith.pangram` (`wordsmith.pangram.mp3`) | The pangram: the ring spins once in gold | A rich gold flourish: the bell arpeggio over a low warm swell, a shimmer at the end, celebratory but soft | 1.2–1.6 s |
| `wordsmith.invalid` (`wordsmith.invalid.mp3`) | Not a word or too short: the letters shake back | A soft low buzz: a muted felt-damped thud with a small wobble, gentle, never harsh | 150–220 ms |

## Interlock

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `tilegrid.pick` (`tilegrid.pick.mp3`) | A tile is picked up (lifts with a shadow) | A wooden tile lifted off a board: a light dry tick | 40–70 ms |
| `tilegrid.place` (`tilegrid.place.mp3`) | A tile is placed | A wooden tile set down on a wooden board: a crisp clack with a soft body | 80–120 ms |
| `tilegrid.back` (`tilegrid.back.mp3`) | A tile goes back to the tray (drag or double-tap) | The same tile slid back onto felt: a soft short slide | 120–180 ms |
| `tilegrid.word3` … `tilegrid.word7` (`tilegrid.word3.mp3` … `tilegrid.word7.mp3`) | A run of letters becomes a word; the chord grows with the word | A warm marimba chord, three notes for three letters up to a fuller five-note chord for seven | 300–500 ms each |
| `tilegrid.combo` (`tilegrid.combo.mp3`) | Two words form at once | Two marimba chords in a quick upward pair | 450–600 ms |
| `tilegrid.notword` (`tilegrid.notword.mp3`) | A run that isn't a word turns faint red | A low muted wooden knock, quiet and short | 100–150 ms |
| `tilegrid.bonus` (`tilegrid.bonus.mp3`) | Done: the big-word bonus counts up | A light ticking count of small wooden beads, rising slightly in pitch, ending on a soft chime | 700–900 ms |

## Slider

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `wordslide.slide` (`wordslide.slide.mp3`) | A swipe slides a row or column (letters wrap round) | Glazed tiles rattling along a tray in one smooth push | 150–220 ms |
| `wordslide.word` (`wordslide.word.mp3`) | A row becomes a word | A bright two-note chime, rising a fourth, glass and wood | 300–400 ms |
| `wordslide.lock` (`wordslide.lock.mp3`) | A padlock snaps shut | A small brass padlock clicking shut: a crisp metal snap | 90–140 ms |
| `wordslide.unlock` (`wordslide.unlock.mp3`) | A padlock is opened again | The same padlock springing open: a lighter metal click | 80–120 ms |
| `wordslide.swap` (`wordslide.swap.mp3`) | Two tiles of the last row swap | Two wooden tiles passing each other: a quick double clack | 120–180 ms |
| `wordslide.nudge` (`wordslide.nudge.mp3`) | At par with three rows done (the moves counter nudges) | A gentle low "tock" on a wooden block, a quiet warning | 120–160 ms |
| `wordslide.resetArm` (`wordslide.resetArm.mp3`) | Reset is armed ("Reset?") | A soft two-tone question blip, muted | 150–200 ms |

## Forage

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `wordhunt.trace1` … `wordhunt.trace9` (`wordhunt.trace1.mp3` … `wordhunt.trace9.mp3`) | Tracing: one soft note per letter, rising up the scale | A soft glass "tink", one note per step of a major scale (nine steps), quiet enough to run quickly | 120–180 ms each |
| `wordhunt.golden` (`wordhunt.golden.mp3`) | The trace crosses the golden tile | A light sparkle: tiny high bells, airy | 250–350 ms |
| `wordhunt.word` (`wordhunt.word.mp3`) | A valid word: the path flashes, the word flies to the list | A clean bright chime with a short whoosh of the word flying off | 300–400 ms |
| `wordhunt.long` (`wordhunt.long.mp3`) | A word of 7+ letters | A bigger chord on the same chime, fuller and warmer | 500–700 ms |
| `wordhunt.points` (`wordhunt.points.mp3`) | The points pop beside the word | A small soft pop, round, like a cork | 60–100 ms |

## Lookout

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `wordsearch.drag` (`wordsearch.drag.mp3`, loop) | Dragging: a marker squeak as the loop grows | A felt-tip marker drawn on glossy card: a soft continuous squeak, seamless loop | 0.8–1.2 s loop |
| `wordsearch.found4` … `wordsearch.found9` (`wordsearch.found4.mp3` … `wordsearch.found9.mp3`) | A word found: the loop inks in, the chip ticks with a pen stroke; the chime pitched by length | A pen tick on paper followed by a warm chime, six rising pitches | 350–450 ms each |
| `wordsearch.bonus` (`wordsearch.bonus.mp3`) | The bonus word | A brighter chime with a light sparkle on top | 600–800 ms |
| `wordsearch.already` (`wordsearch.already.mp3`) | Re-dragging a found word | A gentle "already found" bump: a soft muted double tap, friendly | 120–180 ms |
| `wordsearch.redraw` (`wordsearch.redraw.mp3`) | The last word: every loop redraws in order | A quick run of marker strokes rising to a chime | 900–1200 ms |

## Roundabout

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `letterwheel.trace1` … `letterwheel.trace8` (`letterwheel.trace1.mp3` … `letterwheel.trace8.mp3`) | Tracing: a note per letter | A soft ceramic "tok", one per step of a pentatonic scale | 100–160 ms each |
| `letterwheel.fly` (`letterwheel.fly.mp3`) | A slot word: its letters fly from the wheel into their squares one by one | Little ceramic tiles landing in sequence: four to seven light clicks, rising | 400–700 ms |
| `letterwheel.jar` (`letterwheel.jar.mp3`) | A bonus word drops into the jar | A coin dropping into a glass jar: a bright plink with a small rattle | 300–450 ms |
| `letterwheel.repeat` (`letterwheel.repeat.mp3`) | A harmless repeat | A gentle bump: a soft low wooden knock, friendly | 100–150 ms |
| `letterwheel.miss` (`letterwheel.miss.mp3`) | A miss (not a word) | One soft "wrong": a dull low ceramic thunk | 150–200 ms |
| `letterwheel.spin` (`letterwheel.spin.mp3`) | Grid done: the wheel spins and the grid lights corner to corner | A turned tray spinning on a bearing, a rising sweep ending on a bell | 1.0–1.3 s |

## Strikeout

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `strikeout.flip` (`strikeout.flip.mp3`) | A hit: each matching tile flips, one after another | A tile flipping over on a wooden board: a short clack | 70–110 ms |
| `strikeout.strike` (`strikeout.strike.mp3`) | A strike slams onto the strike row | A red enamel stud pressed hard into wood: a dull, heavy thud | 150–250 ms |
| `strikeout.combo` (`strikeout.combo.mp3`) | An early solve with 3+ letters hidden: they flip all at once | A burst of tile flips at once, ending on a bright chime | 500–700 ms |
| `strikeout.lastStrike` (`strikeout.lastStrike.mp3`) | Last strike left: the strike row pulses | A low soft heartbeat pulse, two beats | 500–700 ms |
| `strikeout.solve` (`strikeout.solve.mp3`) | A word solved | A clean bright chime, two notes rising | 300–400 ms |

## Cryptogrid

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `codeword.ripple` (`codeword.ripple.mp3`) | A letter ripples into every matching square, ticks rising | A quick run of small dry ticks rising in pitch (glazed tiles) | 300–500 ms |
| `codeword.word` (`codeword.word.mp3`) | A word completed by the letter glints | A small glass glint: a single bright ping | 200–300 ms |
| `codeword.wrong` (`codeword.wrong.mp3`) | Full and wrong: the letters that can't make real words flash | A muted double thud, low and soft | 250–350 ms |
| `codeword.jump` (`codeword.jump.mp3`) | The selection jumps to the next unsolved number | A tiny soft tick, almost subliminal | 30–50 ms |

## Swapword

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `swapword.swap` (`swapword.swap.mp3`) | A swap: two tiles pass each other in a short arc | Two wooden tiles crossing: a quick airy whoosh and a single wooden clack as they land | 180–260 ms |
| `swapword.gold` (`swapword.gold.mp3`) | A tile turns gold | A bright plink on a small brass bell | 150–250 ms |
| `swapword.combo` (`swapword.combo.mp3`) | Two tiles turn gold in one swap | Two quick bell plinks a third apart | 300–400 ms |
| `swapword.locked` (`swapword.locked.mp3`) | Tapping a locked gold tile (a small wiggle) | A tiny muffled wooden rattle | 80–120 ms |
| `swapword.low` (`swapword.low.mp3`) | Three swaps left: the counter pulses | A soft low warning tick, twice | 250–350 ms |
| `swapword.out` (`swapword.out.mp3`) | Out of swaps: the board greys | A closing clunk: a wooden lid shutting, final but not harsh | 300–450 ms |
| `swapword.scale` (`swapword.scale.mp3`) | Solved: the wave runs round the figure-eight | A rising scale of bell plinks, eight notes | 1.0–1.3 s |

## Round end (every Word game)

| Slot (file) | Action | What it is · material · feel | Length |
|---|---|---|---|
| `shared.wordDrop` (`shared.wordDrop.mp3`) | Each found word drops into the round-end list | A soft tick, a small paper card landing | 40–70 ms |
| `shared.wordLongest` (`shared.wordLongest.mp3`) | The longest word gets its gold chip | A warm short gold chime | 250–350 ms |

The score's count-up keeps the shared count tick (`sfx_count_tick.mp3`).
