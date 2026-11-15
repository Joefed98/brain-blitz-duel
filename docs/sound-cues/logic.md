# Sound cues: Logic games (13 Oct 2026)

Logic polish adds no audio. Every new effect, animation or feature moment dispatches a named cue so sound can
be attached later without touching the games:

```ts
window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "<gameId>.<event>" } }));
```

The helper is `soundCue()` in `src/puzzles/logicFx.ts`. Game ids are the stored `PuzzleType` ids. Cues are fired
on the phone only, never by the server, and never change input, timing or grading. Existing sounds
(`playCorrect`, `playLock`, `playWrong`) are unchanged and still play where they did; Safe Cracker's opening recording
(`pz_safe_open.mp3`) plays through the `safe.solve` slot since 15 Nov 2026 (one sound on opening).

Each `<game>.solve` cue fires once, at the solve moment (the same render that submits), from `useSolveFx`. The
completion effect it marks runs for at most 1.2 s and never delays submission, the reveal or the clock.
No `shared.*` cue is added here: the shared signature beat about 1.0 s after a solve belongs to Rotation and
shared screens.

| Cue | Trigger | Visual length |
|---|---|---|
| `lightsout.toggle` | A light is pressed | 180 ms filament flicker; 160–240 ms glow fade |
| `lightsout.solve` | Every light is off | 1.0 s flash on and fade (plus up to 150 ms centre-out stagger) |
| `sudoku.place` | A digit is entered in a cell (not pencil marks, not clearing) | 170 ms digit pop |
| `sudoku.solve` | The grid is complete and valid | 1.2 s: rows light up (0–575 ms), then boxes (600–1,175 ms) |
| `tower.lift` | A ring is lifted off a post | Gentle hover bob while held |
| `tower.drop` | A ring lands on a post (legal move) | 220 ms drop and settle |
| `tower.solve` | Every ring is on the gold post | ~1.17 s: rings light bottom to top (0–940 ms), sparkle rises (520–1,180 ms) |
| `tubes.lift` | A flask's top layer is lifted | Existing 150 ms lift |
| `tubes.pour` | A pour lands | 240 ms fill-up per arriving layer (60 ms apart) |
| `tubes.cork` | A pour fills a flask with one colour (it gets a cork) | Existing 380 ms cork pop |
| `tubes.solve` | Every flask is sorted | ~1.14 s: corks pop in turn (80 ms apart), liquid shimmer follows |
| `safe.click` | A dial turns one step (each repeat while held fires again) | 130 ms drum roll |
| `safe.solve` | A try satisfies every clue (the same test that submits) | `pz_safe_open.mp3` (2.2 s); placeholder `safe.solve.mp3` with NEW_GAME_SOUNDS on |
| `bomb.cut` | A wire is cut | 220 ms recoil, 300 ms sparks |
| `bomb.press` | Button A or B is pressed | 200 ms press |
| `bomb.defuse` | DEFUSE is tapped (the submission; not a verdict) | LED timer freezes and blinks (640 ms), fuse spark dies (360 ms) |
| `bomb.solve` | The reveal shows a verified defuse | 700 ms status lamp turns red to green |
| `nonogram.fill` | A cell is filled | 170 ms tile pop |
| `nonogram.mark` | A cell is marked empty (×) | 140 ms fade-in |
| `nonogram.clear` | A cell is cleared | — |
| `nonogram.solve` | Every line matches its clues | ~1.16 s: colour sweep (diagonal, 820 ms each), bounce at 520–880 ms |
| `flood.spread` | A colour is tapped and the paint spreads | Existing 220 ms ripple |
| `flood.solve` | The board is one colour | ~1.15 s: brightness wave from the top-left corner, gloss sweep |
| `tents.pitch` | A tent is placed | 240 ms pop-up |
| `tents.grass` | A cell is marked as grass | — |
| `tents.clear` | A cell is cleared | — |
| `tents.solve` | The layout is valid | ~1.15 s: tents bounce in turn (55 ms apart), lanterns glow and fade |
| `shikaku.place` | A rectangle is accepted | 180 ms pane set |
| `shikaku.remove` | A rectangle is tapped away | — |
| `shikaku.solve` | Every square is covered by a valid rectangle | ≤1.2 s: panes flash stained-glass colours (28 ms apart, 700 ms each) |
| `lightup.lamp` | A lamp is placed | Light spreads along its beams, 40 ms per square, 320 ms each |
| `lightup.dot` | A square is marked with a dot | — |
| `lightup.clear` | A square is cleared | — |
| `lightup.solve` | Every square is lit with no clash and every number met | ~1.17 s: warm wave from the top-left, lamps swell |

## Logic overhaul, session 1 (15 Nov 2026)

Placeholder slots (no file yet: silent until Joe's ElevenLabs recordings, `logic-elevenlabs.md`, drop in by name).

| Cue | Trigger | Visual length |
|---|---|---|
| `sudoku.clash` | A digit makes a row, column or box repeat (the clashing digits turn red) | 360 ms red pulse |
| `sudoku.pencil` | A pencil mark is added or removed | — |
| `tubes.undo` | Undo is tapped (tubesRev 3 gives the pour back) | — |
| `tubes.outOfPours` | The last allowed pour leaves the board unsorted | 1.1 s "Out of pours" banner |
| `safe.wrongTry` | A try that breaks a clue (the broken clues flash red) | 520 ms clue flash |
| `nonogram.paint` | A drag paints one more square (fill) | 90 ms press-in |
| `sudoku.line` | A digit completes a row, column or box (pitched up when it completes several) | 420 ms glow along the line |
| `nonogram.line` | A line now matches its numbers (pitched up for several at once) | 420 ms glow on its clue |
| `minesweeper.cascadeTick` | Minefield: a cascade opens; up to 8 ticks, 45 ms apart, rising in pitch | — |
| `minesweeper.defuse` | Minefield: each mine still hidden at the clear, one by one | a gold ring fading on the mine |
| `minesweeper.tapNumber` | Minefield: a number tapped before its flags add up | 18-tick shake of the number |

With `prefers-reduced-motion: reduce`, move animations snap and each completion effect is replaced by one still,
soft glow over the play area (opacity only, 1.0 s). The cues fire either way.
