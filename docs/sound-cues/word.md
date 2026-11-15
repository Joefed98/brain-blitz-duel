# Sound cues: Word games

Added by the Word puzzle polish (13 Oct 2026). No audio is attached yet: each moment only
dispatches a named cue for the sound pass to pick up, through `wordCue()` in
`src/components/puzzles/wordFinish.ts`, which hands it to the shared `soundCue()`
(`src/lib/fx/soundCues.ts`, the `duelz-sound` window event) and stays silent while an intro
demo is hushed (`demoHushed()`), as the other groups' helpers do.

Every cue fires once, on the phone that sees the moment, and it fires even with reduced
motion (the effect is then a short glow in place, 420 ms). Effects are presentation only:
they never change the answer, the recorded time, the submission or the reveal, and they
stay on the board, clear of the timer. The shared signature beat (gold flash and logo
burst, from Rotation and shared screens, about 1.0 s after every completion) is not
fired here.

| Cue | Game | Trigger | Length |
|---|---|---|---|
| `wordsmith.finish` | Nucleus | End of the run (the found words lock in, 0.6 s before the buzzer) when the phone's local round score (`scoreWordsmith` of its word points) is 120 or more. The atom spins up once: the outer tiles orbit the centre, letters stay upright, the nucleus glows. | 1.1 s |
| `wordhunt.finish` | Forage | End of the run (0.6 s before the buzzer) when the local round score (`scoreWordHunt`) is 120 or more. A gold ripple runs out across the letter grid from the centre. | 0.9 s |
| `tilegrid.finish` | Interlock | Done accepted a valid grid (the solve moment). The grid's words light up one after another, each word's tiles in reading order. | up to 1.2 s |
| `wordslide.finish` | Slider | All five rows read as words (the solve moment). The padlocks click shut down the rows in a cascade (drawn shut from then on), each row glowing as its lock closes. | 1.14 s |
| `wordsearch.finish` | Lookout | The sixth word is found (the solve moment). Every found word glows in the grid together, the found-word lines brighten. | 0.9 s |
| `letterwheel.finish` | Roundabout | The last crossword slot fills (the solve moment). The wheel spins once (letters stay upright), then the crossword lights corner to corner. | 1.1 s |
| `strikeout.finish` | Strikeout | The fifth word is revealed (the solve moment). The tiles flip gold row by row. | 1.16 s |
| `codeword.finish` | Cryptogrid | The server confirms the grid is cracked (the solve moment). The decoded letters flip across the grid in a diagonal wave. | 1.1 s |
| `swapword.finish` | Swapword | The server confirms the board is solved (the solve moment). A gold wave runs once round the figure-eight. | 1.16 s |
| `wordfall.finish` | Letterfall | The run ends (time or a full column) with a local score (`wordfallScore` of the sim's points) of 120 or more, on the live stage only (never the reveal's replay). The well's tiles shimmer from bottom to top, inside each tile's face. | 1.1 s |
| `strikeout.key` | Strikeout | Any key on the keyboard (the Word overhaul, 15 Nov 2026): a soft typewriter click; `word.key.mp3` behind NEW_GAME_SOUNDS until Joe's recording (`word-elevenlabs.md`). | 0.05 s |
| `codeword.key` | Cryptogrid | Any key on the keyboard, as Strikeout's. | 0.05 s |
| `wordsmith.letter` | Nucleus | A soft key click as a letter rises out of the ring (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.07 s |
| `wordsmith.shuffle` | Nucleus | The letters sliding round the ring (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.25 s |
| `wordsmith.word4` | Nucleus | A valid 4-letter word: a note rising with its length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.26 s |
| `wordsmith.word5` | Nucleus | A valid 5-letter word: a note rising with its length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.26 s |
| `wordsmith.word6` | Nucleus | A valid 6-letter word: a note rising with its length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.26 s |
| `wordsmith.word7` | Nucleus | A valid 7-letter word: a note rising with its length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.27 s |
| `wordsmith.word8` | Nucleus | A valid 8-letter word: a note rising with its length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.25 s |
| `wordsmith.word9` | Nucleus | A valid 9-letter word: a note rising with its length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.27 s |
| `wordsmith.combo` | Nucleus | Three words inside 10 s: a quick bright run (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.51 s |
| `wordsmith.pangram` | Nucleus | The pangram: the ring spins once in gold, a big rolled chord (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.62 s |
| `wordsmith.invalid` | Nucleus | Not a word: a soft buzz as the letters shake back (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.19 s |
| `tilegrid.pick` | Interlock | A tile lifted from the tray (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.07 s |
| `tilegrid.place` | Interlock | A wooden tile clacked onto its square (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.08 s |
| `tilegrid.back` | Interlock | A tile slid back to the tray (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.08 s |
| `tilegrid.word3` | Interlock | A 3-letter run becomes a word: a chord that grows with it (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.48 s |
| `tilegrid.word4` | Interlock | A 4-letter run becomes a word: a chord that grows with it (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.55 s |
| `tilegrid.word5` | Interlock | A 5-letter run becomes a word: a chord that grows with it (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.57 s |
| `tilegrid.word6` | Interlock | A 6-letter run becomes a word: a chord that grows with it (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.59 s |
| `tilegrid.word7` | Interlock | A 7-letter run becomes a word: a chord that grows with it (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.63 s |
| `tilegrid.combo` | Interlock | Two words form at once (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.48 s |
| `tilegrid.notword` | Interlock | A run that is no word turns faint red (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.19 s |
| `tilegrid.bonus` | Interlock | The big-word bonus counting up (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.51 s |
| `wordslide.slide` | Slider | A row or column slid: a short tile rattle (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.15 s |
| `wordslide.word` | Slider | A row becomes a word: a bright two-note (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.36 s |
| `wordslide.lock` | Slider | A padlock snapping shut (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.12 s |
| `wordslide.unlock` | Slider | A padlock opened again (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.12 s |
| `wordslide.swap` | Slider | Two tiles of the last row swap (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.08 s |
| `wordslide.nudge` | Slider | At par with three rows done: a small nudge (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.09 s |
| `wordslide.resetArm` | Slider | Reset armed: a soft cautious tick (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.28 s |
| `wordhunt.trace1` | Forage | Tracing, letter 1: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.16 s |
| `wordhunt.trace2` | Forage | Tracing, letter 2: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.16 s |
| `wordhunt.trace3` | Forage | Tracing, letter 3: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.14 s |
| `wordhunt.trace4` | Forage | Tracing, letter 4: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.15 s |
| `wordhunt.trace5` | Forage | Tracing, letter 5: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.15 s |
| `wordhunt.trace6` | Forage | Tracing, letter 6: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.15 s |
| `wordhunt.trace7` | Forage | Tracing, letter 7: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.15 s |
| `wordhunt.trace8` | Forage | Tracing, letter 8: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.15 s |
| `wordhunt.trace9` | Forage | Tracing, letter 9: a soft note rising up the scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.16 s |
| `wordhunt.golden` | Forage | The trace crosses the golden tile: a sparkle (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.33 s |
| `wordhunt.word` | Forage | A valid word: the path flashes and it flies to the list (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.52 s |
| `wordhunt.long` | Forage | A word of 7 or more letters: a bigger chord (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.58 s |
| `wordhunt.points` | Forage | The word's points pop beside it (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.08 s |
| `wordsearch.drag` | Lookout | A marker squeak as the loop grows a letter (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.08 s |
| `wordsearch.found4` | Lookout | A 4-letter word found: the loop inks in, a chime pitched by length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.34 s |
| `wordsearch.found5` | Lookout | A 5-letter word found: the loop inks in, a chime pitched by length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.35 s |
| `wordsearch.found6` | Lookout | A 6-letter word found: the loop inks in, a chime pitched by length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.36 s |
| `wordsearch.found7` | Lookout | A 7-letter word found: the loop inks in, a chime pitched by length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.35 s |
| `wordsearch.found8` | Lookout | A 8-letter word found: the loop inks in, a chime pitched by length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.35 s |
| `wordsearch.found9` | Lookout | A 9-letter word found: the loop inks in, a chime pitched by length (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.36 s |
| `wordsearch.bonus` | Lookout | The bonus word: a sparkle and a brighter chime (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.33 s |
| `wordsearch.already` | Lookout | Re-dragging a found word: a gentle bump (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.07 s |
| `wordsearch.redraw` | Lookout | The last word: every loop redrawn in order (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.70 s |
| `letterwheel.trace1` | Roundabout | Tracing, letter 1: a note rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.13 s |
| `letterwheel.trace2` | Roundabout | Tracing, letter 2: a note rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.14 s |
| `letterwheel.trace3` | Roundabout | Tracing, letter 3: a note rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.13 s |
| `letterwheel.trace4` | Roundabout | Tracing, letter 4: a note rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.14 s |
| `letterwheel.trace5` | Roundabout | Tracing, letter 5: a note rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.13 s |
| `letterwheel.trace6` | Roundabout | Tracing, letter 6: a note rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.14 s |
| `letterwheel.trace7` | Roundabout | Tracing, letter 7: a note rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.14 s |
| `letterwheel.trace8` | Roundabout | Tracing, letter 8: a note rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.13 s |
| `letterwheel.fly` | Roundabout | A slot word's letters fly into their squares one by one (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.51 s |
| `letterwheel.jar` | Roundabout | A bonus word drops into the jar: a coin plink on glass (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.29 s |
| `letterwheel.repeat` | Roundabout | A harmless repeat: a gentle bump (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.08 s |
| `letterwheel.miss` | Roundabout | A miss: not a word (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.19 s |
| `letterwheel.spin` | Roundabout | Grid done: the wheel spins and the grid lights (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.65 s |
| `strikeout.flip` | Strikeout | A hit: matching tiles flip with a clack, one after another (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.16 s |
| `strikeout.strike` | Strikeout | A strike slammed onto the strike row (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.17 s |
| `strikeout.combo` | Strikeout | An early solve with 3+ letters hidden: they all flip at once (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.45 s |
| `strikeout.lastStrike` | Strikeout | One strike left: the strike row pulses (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.27 s |
| `strikeout.solve` | Strikeout | A word solved (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.55 s |
| `codeword.ripple` | Cryptogrid | A letter ripples into every matching square, ticks rising (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.45 s |
| `codeword.word` | Cryptogrid | A word completed by the letter glints (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.36 s |
| `codeword.wrong` | Cryptogrid | Full and wrong: the letters that can't make words flash (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.19 s |
| `codeword.jump` | Cryptogrid | The selection jumps to the next unsolved number (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.09 s |
| `swapword.swap` | Swapword | Two tiles pass each other in a short arc: a wooden clack (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.09 s |
| `swapword.gold` | Swapword | A tile turns gold: a bright plink (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.27 s |
| `swapword.combo` | Swapword | Two tiles turn gold in one swap (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.43 s |
| `swapword.locked` | Swapword | A locked gold tile tapped: a small wiggle (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.07 s |
| `swapword.low` | Swapword | Three swaps left: the counter pulses (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.28 s |
| `swapword.out` | Swapword | Out of swaps: a closing clunk as the board greys (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.17 s |
| `swapword.scale` | Swapword | Solved: a wave round the figure-eight, a rising scale (stage 2 effects, 15 Nov 2026; the kit's shared sound until Joe's recording). | 0.72 s |

No `shared.*` cues are added by this pass. Other changes in the pass (eased tile fills,
the accepted-word chip moving into Nucleus's HUD, floating found-word chips) reuse
existing moments and add no cue.

In dev builds the screenshot tool (`scripts/shots/capture.ts`) can replay any of these
on the board as it stands with `window.dispatchEvent(new CustomEvent("duelz-dev-word-finish"))`;
that dev trigger also dispatches the cue.
