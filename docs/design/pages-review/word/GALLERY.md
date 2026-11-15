# Word overhaul: gallery

Phase 2, step 4 (`docs/design/game-reviews/word.md`). Before (main) beside after (this branch) for every Word game,
taken with `scripts/shots/capture.ts` at 390 × 844 on each game's fixed intro example (shown at half size): mid-play,
the round end, and the intro where it changed. Stage 1 is the new look and the game changes; the effects (stage 2)
and the levels (stage 3) come next, with clips of the hero effects then.

## Stage 1: the look and the game changes

Every tile, disc, well, key, pip, the bonus jar and the padlocks are rendered in Blender
(`scripts/word-art/word_art.py`; the pieces in `public/word-art/`): glazed black tiles, enamel champagne gold, teal and
grey clue glazes, sapphire for a picked piece, recessed wells for empty squares, under clean even studio light with no
glare or glow. The letters stay live text, big and bold. Controls are champagne gold (the action that plays) and navy.

### Nucleus
Pearl-black discs round a sapphire centre, picked letters in gold; Enter gold, Shuffle and Clear navy. The counter now
counts the board's everyday words; an obscure word still scores, as a bonus word (`wordsmithRev 5`).

<img src="img/wordsmith-play.webp" width="400"> <img src="img/wordsmith-reveal.webp" width="400">

### Interlock
Concept B's tray of recessed wells with concept A's tiles; tiles in a real word turn gold, a run that isn't a word stays
faint red while it stands; tiles drag back to the tray; the board no longer clips on short screens; the status is pills.

<img src="img/tilegrid-play.webp" width="400"> <img src="img/tilegrid-reveal.webp" width="400">

### Slider
Glazed tiles in a lacquer tray, rows reading as words in teal, locked rows in gold, rendered padlocks; fits a 375 px
phone; Reset asks first; par is the proven fewest slides (`wordSlideRev 6`).

<img src="img/wordslide-play.webp" width="400"> <img src="img/wordslide-reveal.webp" width="400">

### Forage
Polished tiles, the trace in sapphire, the golden tile in gold; Submit gold; the miss allowance on screen
("Misses 3 / 14 free").

<img src="img/wordhunt-play.webp" width="400"> <img src="img/wordhunt-reveal.webp" width="400">

### Lookout
Small glazed tiles, found words gold within a capsule loop, whole-word chips; on `wordSearchRev 6` the round goes on
after the sixth word for the bonus, with a Done button.

<img src="img/wordsearch-play.webp" width="400"> <img src="img/wordsearch-reveal.webp" width="400">

### Roundabout
Pearl-black wheel letters on a plain navy wheel (no glow ring), the crossword as wells and tiles with more of the
height, the rendered glass jar filling with coins; a miss and a repeat look different; new boards without odd or many
three-letter words (`wheelRev 5`).

<img src="img/letterwheel-play.webp" width="400"> <img src="img/letterwheel-reveal.webp" width="400">

### Strikeout
The keyboard at the bottom with 52 px keys and a letter preview, the tiles grown into the space, gold strike pips that
turn to red studs, the gold Solve key; the delete key keeps one label.

<img src="img/strikeout-play.webp" width="400"> <img src="img/strikeout-reveal.webp" width="400">

### Cryptogrid
Wells and dark tiles with gold given letters and much bigger clue numbers, the keyboard at the bottom; after a letter
the next unsolved number is picked; only letters shown wrong cost the clean crack (`codewordRev 6`).

<img src="img/codeword-play.webp" width="400"> <img src="img/codeword-reveal.webp" width="400">

### Swapword
Gold, teal and grey glazes (the game's clues), bigger tiles; the intro shows one swap turning two tiles gold.

<img src="img/swapword-play.webp" width="400"> <img src="img/swapword-intro.webp" width="400">
