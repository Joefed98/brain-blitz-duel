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

No `shared.*` cues are added by this pass. Other changes in the pass (eased tile fills,
the accepted-word chip moving into Nucleus's HUD, floating found-word chips) reuse
existing moments and add no cue.

In dev builds the screenshot tool (`scripts/word-polish-shots.ts`) can replay any of these
on the board as it stands with `window.dispatchEvent(new CustomEvent("duelz-dev-word-finish"))`;
that dev trigger also dispatches the cue.
