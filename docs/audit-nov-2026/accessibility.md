# Code audit 8: accessibility and screen safety (Nov 2026)

7 Nov 2026, on main at `34272737`. Read-only: no code changed, no check run. It covers all 92 active games
(`ACTIVE_PUZZLE_TYPES`) and every non-game screen, in six areas:

1. Safe areas.
2. Tap targets.
3. Contrast.
4. Reduced motion.
5. Screen readers.
6. Colour alone.

**How it was done**
- I read the code with file and line references.
- I measured contrast with the WCAG 2.x luminance formula, with alpha flattened over the real background and
  oklch converted to sRGB first.
- I worked out on-screen sizes from each world's size and the arena's scale rule
  (`min(box W ÷ world W, box H ÷ world H)`). The box ends 16 px above the screen's bottom.
- Phones used: 390×844 (47 px notch, 34 px home bar), 414×896 as an iPhone 11 home-screen app (48 / 34 px), and
  375×667 (iPhone SE, no insets).
- Screenshots came from the screenshot tool only, never a browser check (see [Evidence](#evidence-screenshots)):

  ```
  bun scripts/shots/capture.ts <game> --sizes=390x844,375x667 --phases=intro,play,reveal
  ```

  It uses practice mode, the fixed intro example and seeded `Math.random`.

Device behaviour (VoiceOver, TalkBack, the iOS home-bar gesture) is inferred from code and platform rules. Joe
does the phone testing.

**Reach labels**
- **All:** every player who reaches the screen.
- **iPhone:** a notched iPhone in Safari with the toolbar collapsed, or as a home-screen app.
- **RM:** players with Reduce Motion on.
- **SR:** screen-reader users, about 1–2 % of phone users.
- **KB:** keyboard or switch users, mostly on a computer.
- **CVD:** colour-vision deficiency, about 8 % of men and 0.5 % of women, almost all red/green.

**Effort:** S is under an hour, M is a few hours to a day, L is several days. Effort is the code change. "+check"
means a check has to be updated in the same PR, because a check pins today's behaviour.

## The ranked list

Most players affected first. Within the same reach, the cheaper fix comes first.

| # | Area | Finding | Reach | Effort |
|---|---|---|---|---|
| 1 | Contrast | Grey and red text on every puzzle answer reveal: 2.4–4.1:1 | All, every puzzle round | S |
| 2 | Safe areas | Bottom control rows of arcade play screens reach into the 34 px home-bar zone | iPhone, every arcade round | M +checks |
| 3 | Contrast, colour, SR | Players who left are shown only at 40 % opacity (2.1–3.5:1), with no "Left" text | All, in any room someone leaves | S |
| 4 | Contrast | The 1v1 round result dims a card to 60 %: 3.2:1 | All 1v1 players, every round | S |
| 5 | Tap targets | Volume sliders: a 16 px thumb and no row height | All who change sound | S |
| 6 | Contrast | Red timer digits in the last 10 s on Number and Logic tints: 3.9–4.5:1 | All, Number and Logic rounds | S |
| 7 | SR | Round results say "✗" alone, the reveal verdict is silent, and the podium list drops the place | SR, every room | S |
| 8 | SR | The 1v1 final rounds read "12 – 8" with no names; standings arrows read "black up-pointing triangle" | SR, every room | S |
| 9 | SR | Live moments are not announced: finished pings, chat toast, celebration headline, rejected moves | SR, every room | S–M |
| 10 | SR, KB | No `<main>` landmark; no focus move or announcement on room phase changes; ConfirmDialog and help overlay don't trap focus | SR, KB, everywhere | M |
| 11 | Reduced motion | Intro demos loop until Ready, even with Reduce Motion on, and have no pause | RM every intro (WCAG 2.2.2: all) | S |
| 12 | Reduced motion | "And the winner is…" throbs at 4 Hz for 4 s | RM, every room's end | S |
| 13 | Colour alone | Matching by colour alone: Chroma Lines, Bomb Defusal, Colour Flood, Tally, Mixed Signals, Flash; Kakuro's green and red sums | CVD, 7 games | S–L |
| 14 | Colour alone | Wrong cells shown only in red: Nonogram, Box Six and Kakuro reveals, Regions, Lamplighter, Ascend, Interlock, Strikeout keys; the reject shake under RM | CVD, about 9 games | S each |
| 15 | SR | Arcade canvases: `aria-label` without `role="img"`, and the HUD and score never in the DOM | SR, 41 arcade and engine games | S, then L |
| 16 | SR | Grid cell labels hide their content: Box Six digits, Nonogram state, Kakuro clues, Bomb wire colours, Polypotions contents | SR, 5 games | S each |
| 17 | SR, KB | Fake buttons, pointer-only buttons, drag-only grids, NumberEntry with no name, chat Mute/Report on long-press only | KB, SR, about 30 games | S–L |
| 18 | Tap targets | Small game targets: Minefield cells, Summit cards, Free Cell Undo/Reset, Cryptogrid clue strip | All, 4 games, worst on the SE | S–L |
| 19 | Tap targets | Grid puzzles under 44 px at 375 px: Lookout, Shikaku, Lamplighter, Chroma Lines, Mosaic, Tents; intro back button 36 px | All, SE-size phones | S–M |
| 20 | Safe areas | In-canvas swipes and taps in the home-bar zone: Spacewalk, Top Bins' power band, Free Cell's lowest cards | iPhone, 3 games | S–M |
| 21 | Reduced motion | Not gated in the canvas: Top Bins' fans and camera flashes, Slice's full-screen bomb flash, Tenfall's jitter; the cause is `arcadeReducedEffects()` ignoring the OS setting | RM, 3 games | S each, M root |
| 22 | Contrast | Canvas HUD text at low alpha: Orbit "Checkpoint used", Five Hands "No hand", Grappler distance marks; Retro HUD down to 8 px | All, 4 games + Retro | S each |
| 23 | Contrast | Dimmed "done" clues: Mosaic 2.0:1, Tents 40 % | All, 2 games | S |
| 24 | Colour alone | UI states by colour: disabled buttons, empty practice stars, room-settings chips, toast tones, HUD "warn" pills | CVD, low vision | S each |
| 25 | Reduced motion | Minor: the arcade reveal's count-up, smooth scroll on re-tapping a tab | RM | S |
| 26 | Hardening | Sheet has no base bottom inset; `--jz-loss` fails as text (4.44:1); white on `--jz-win` is 2.3:1; theme-check misses skin-off, opacity, canvas and play screens | Future screens | S |

Already right (checked, no action):
- Icon buttons are labelled: sheet ✕, gear, ⋯ menu, chat, sound, help, back, Undo/Reset, arcade control buttons.
- Medals (`role="img"`, "1st" / "Joint 1st"), Emblem, Trophy and Badge are named.
- The wordmark is named.
- PlayerBadge and GameIcon are decorative, with the name beside them.
- Stars read "N of 3 stars". TimerBar is `role="timer"` with "N seconds remaining".
- Sheets are real dialogs (vaul / Radix).
- `<html lang="en">`, a title per route, no zoom lock.
- Reveal verdict glyphs differ in shape. "Round won" and "(you)" are written as text.
- Cue Ball spots and stripes differ by pattern. Polypotions has symbols in play. Pair Match, Chain Tap and Tally use
  shape as well as colour.
- The colour picker is radios with names and a tick.
- Tabs, chips and segments are not hue alone.
- Base tokens all pass: text-3 is at least 5.4:1 on every surface, gold 8.5:1, text-2 8.5:1.
- Placeholders 7.3:1, status chips at least 4.9:1, the reveal palette's `--reveal-text-2` at least 6.4:1, chart
  labels at least 5.0:1.
- Design Button, Chip, Segmented, sheet ✕, room footer, ⋮ menu and reveal switches all reach 44 px.
- The puzzle dock forces 52 px.
- Headers, the tab bar, sheets' tops, the chat toast, celebration banner and room footer respect the insets.
- The global reduced-motion CSS rule, celebrations, Prepare to Duel, standings, count-ups and the shared arcade
  effects all honour Reduce Motion.

---

## 1. Puzzle answer reveals: grey and red text at 2.4–4.1:1 (contrast)

**Screen**
- The answer reveal of every puzzle (the reveal screen's board card), in rooms, practice, the daily and challenges.

**Evidence**
- `AnswerReveal.tsx:865` wraps the reveal content in `data-skin-off`.
- `theme.css:115-119` then restores the legacy palette: `--muted-foreground` is oklch(0.68 0.015 285), about
  #9797A1, and `--destructive` is #FF4D4D.
- `reveal-screen.css:52-54` overrides muted only inside `[data-reveal-column]`, which is the arcade reveal.
- The board tray behind is translucent (`room-screens.css:741-748`), so the game's gradient shows through.

**Measured**

| Text | Top stop | Middle stop | Bottom stop |
|---|---|---|---|
| Muted | 2.76:1 (worst) | 4.13:1 | at least 6.2:1 |
| Red | 2.44:1 | 3.65:1 | — |

- Muted fails on the top and middle stops for all 104 palettes in `revealPalette.data.ts`.
- Legacy primary #F5B82E is 4.48:1 on 16 palettes.

**Affected text**
- The "Solution" / "Yours" labels: `tileGrid.tsx:364,369`, `fillomino.tsx:432,438`, `tents.tsx:281,295`,
  `unblock.tsx:126,134`, `bridges.tsx:351,357`, `numberHunt.tsx:443,449`.
- Lookout's missed words in red and missed bonus word in grey: `wordSearch.tsx:273,280`.
- Every other muted reveal line.

**Why no check caught it**
- theme-check skips `[data-skin-off]` (`theme-check.tsx:143,207`) and elements under any ancestor opacity below
  0.99.

**Fix**
- In `reveal-screen.css`:

  ```css
  [data-reveal-screen] [data-skin-off] {
    --muted-foreground: var(--reveal-text-2);
    --destructive: color-mix(in srgb, var(--jz-red) 45%, var(--jz-text));
  }
  ```

  Set `--warn` the same way. This is the red mix the breakdown already uses.
- Give the tray an opaque `--jz-bg` at 72 %, as `.reveal-breakdown` has.
- Add a theme-check case that measures the reveal with skin-off text included.

**Effort:** S + a theme-check case.

## 2. Arcade bottom controls in the home-bar zone (safe areas)

**Evidence**
- `src/polish-layout/bottom.css:106-111`: `[data-arcade-play] > [data-game-column] { padding-bottom: 16px }`.
  There is no `env(safe-area-inset-bottom)`, and the rule is unlayered, so it beats `pad-game-safe` (inset + 16,
  `styles.css:1267-1272`).
- This was a deliberate choice: the comment at `bottom.css:73-79` says "16px above it, whatever the home-bar inset".
- bottom-clearance-check reports a control inside the 34 px zone only as a NOTE.
- Result: every control row runs from 16 px above the bottom upward, so its bottom 18 px sits inside the 34 px
  home-bar zone. That is where iOS takes a swipe up as "go home" and a sideways swipe as "switch app".

**Rows that sit there today**

| Game | Control | Source |
|---|---|---|
| Fission | 76 px arrows (the known case) | `burst.tsx:143-146` |
| Mahjong Solitaire | Shuffle, Undo, Reset | `mahjong.tsx:136-170` |
| Minefield | Reveal / Flag switch | `minesweeper.tsx:157-164` |
| Cue Ball | 76 px power panel, a **sideways drag** along the home bar (worst case) | `pool.tsx:298-299` |
| Rainbow Bridge | UNDO / RESET / RELEASE | `inkBridge.tsx:196-204` |
| Mixed Signals | ArrowPad | `stroop.tsx:66`, `bottom.css:129-134` |
| Swish | 72 px cancel strip (a drag target, lower risk) | `binToss.tsx:463-471` |

- Only on older stamps: Orbit before orbitRev 12 and Curl Champ before curlRev 4.
- Already compensated by their own `env() - 4px` lifts: Home Run (`homerun.tsx:221-227`) and Curl Champ rev 4
  (`curling.tsx:319`).

**Fix**

```css
padding-bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px));
```

- Set Home Run's and Curl Champ's own lifts to 0, so the inset isn't counted twice.
- The worlds lose about 30 px of height on notched phones (scale about −4 %). No sim or tap mapping changes,
  because the scale rule is display only.
- This reverses an October decision, so Joe should approve it.

**Effort:** M. arcade-device-bottom-check, bottom-clearance-check and arcade-room-practice-check pin "exactly
16 px", and their assertions change with the rule. That is not a loosening: the target moves.

## 3. Players who left: 40 % opacity only (contrast, colour alone, SR)

**Evidence**
- `opacity-40` when `row.status === "inactive"` in:
  - `Standings.tsx:179`
  - `Podium.tsx:251`
  - `RoundResultsTable.tsx:119`
  - `DuelOverall.tsx:59`

**Measured**
- Name (text) 3.54:1, text-2 2.69:1, sub lines (text-3) 2.08:1.
- Nothing says "left", so a screen reader hears an ordinary row and sighted players get only dimming.

**Fix**
- Keep full opacity.
- Add a "Left" tag (Chip `status`) after the name, or show the name in text-3 (at least 6.6:1) with the tag.

**Effort:** S.

## 4. 1v1 round result: the other card at 60 % (contrast)

**Evidence**
- `RoundResult.tsx:115,139`: `opacity-60` on the losing card.
- Its muted lines (text-3 on room screens) and "(you)" measure 3.17–3.21:1. text-2 is 4.5:1, which is borderline.

**Fix**
- Dim by colour, not opacity. Or keep the opacity on the card's border and score only.

**Effort:** S.

## 5. Volume sliders: 16 px thumb (tap targets)

**Evidence**
- `src/components/ui/slider.tsx:15-18`: the Radix root has no height and the thumb is `h-4 w-4`.
- The Settings volume row (`SettingsSheet.tsx:81-93`) has a touch band about 16 px tall.
- MuteToggle's popover sliders are `h-9` (36 px) (`MuteToggle.tsx:155-160`).

**Fix**
- `h-11` on the root and a 24–28 px thumb.

**Effort:** S.

## 6. Red timer digits in the last 10 s (contrast)

**Evidence**
- `game-frame.css:146`: `.fx-timer-critical > .game-timer-seconds { color: var(--jz-red) }` at 15 px bold, which
  is below "large".

**Estimate**
- On the header's category tint: Number 3.9–4.5:1, Logic 3.9–4.5:1, the other categories 4.2–4.9:1.
- Odd detail: only Reduce Motion users get the brighter `brightness(1.35)` variant (`styles.css:1484`).

**Fix**
- `color-mix(in srgb, var(--jz-red) 70%, #fff)`, which is at least 5.5:1. Or put the digits on a dark disc.

**Effort:** S.

## 7. Room results a screen reader can't read (SR)

**Round verdict**
- `VERDICT_LABEL.zero` is the bare "✗" (`resultPresentation.ts:94`), shown at `RoundResultsTable.tsx:141` and
  `AsyncResults.tsx:186`. It reads as "multiplication x" or "ballot x", or is skipped.
- Fix: visible "✗ No score", or sr-only "No score".

**Answer reveal verdict**
- In `AnswerReveal.tsx:589-640` every SVG is `aria-hidden` and the wrapper has no name.
- Fix: `role="img"` with "Solved" / "Partly solved" / "Not solved".

**Podium list**
- `Podium.tsx:247`: the row's `aria-label="${name}: N points. Show round scores"` replaces the Medal and
  "(you)", so the place is never read.
- The plinths (`:220-224`) are in DOM order 2, 1, 3.
- Fix: label "1st, Ali (you): 540 points. Show round scores". Mark the plinths `aria-hidden`, since the list
  repeats them.

**Effort:** S.

## 8. Room standings and 1v1 rows (SR)

**1v1 final result**
- `FinalResult.tsx:170-174` reads "12 – 8" with no names, and its winner is shown only by brightness.
- Fix: sr-only "You 12, Jo 8, you won", plus a small ✓ beside the round's winner.

**Standings**
- `Standings.tsx:182-196`: "▲2" reads as "black up-pointing triangle 2". The +round and total figures have no
  headers, and the list is a `<ul>`.
- Fix: sr-only "up 2 places, +120 this round, 540 total", and `<ol>`.

**Arcade score chart**
- `ArcadeScoreChart.tsx:146`: the SVG is `aria-hidden` and the DOM has names but no scores or order. The room's
  "Who's ahead" has no text equivalent.
- Fix: an sr-only `<ol>` in the chart's order. It can list places without points, keeping the reveal's no-numbers
  rule.

**Count-ups**
- `AnimatedScore.tsx:59` re-renders inside rows (`RoundResultsTable.tsx:157`, `Standings.tsx:194`), so a reader
  can catch a number mid-count.
- Fix: the final value in sr-only text, and the animated digits `aria-hidden`.

**Effort:** S.

## 9. Live moments never announced (SR)

**Mounted with their content**
- These regions mount together with their content, which iOS VoiceOver usually doesn't announce:
  - FinishedPingStrip (`FinishedPings.tsx:51-58`, returns `null` when empty)
  - the celebration headline (`ArcadeCelebration.tsx:126-130`)
  - RoundChatDot (`RoomChat.tsx:47-56`)
- Fix: keep an empty live container mounted and change only its text.

**Chat**
- The toast (`Toast.tsx:20`, `RoomChat.tsx:439-446`) is a plain button, and the message list (`RoomChat.tsx:350`)
  isn't a log.
- Fix: `role="log" aria-live="polite"` on the list, and an sr-only echo of the toast.

**Rejected moves**
- `puzzleReject` / `usePuzzleRejections.ts` give a red outline, a shake, a sound and a haptic, but no text.
- Fix: one shared polite region saying "Not allowed" or "Wrong".

**Effort:** S each; M for the shared reject region.

## 10. Structure, focus and dialogs (SR, KB)

**Landmark**
- There is no `<main>` and no skip link. The only `<main>` is in the offline page in `sw.template.js`.

**Phase changes**
- The room's phases (intro, play, reveal, standings, podium) swap with no focus move or announcement.
- The document title stays `ROOM_TITLE` (`duel.$code.tsx:161`).
- Fix: focus the phase's `<h1>` (most have one), or use one announcer. Set `document.title` per phase.

**ConfirmDialog**
- `ConfirmDialog.tsx:18-22` (leave, disband, finish) is `role="alertdialog"` with no `aria-modal`, initial focus,
  focus trap or Escape.
- Fix: build it on the vaul / Radix Sheet.

**Help overlay and room menu**
- The help overlay (`PuzzleInstructions.tsx:123-135`) doesn't move, trap or restore focus.
- RoomMenu (`RoomFooter.tsx:77-82`) uses `role="menu"` with no arrow keys or focus move.
- Fix: plain buttons, or roving focus.

**Language**
- `lang="en"` would be better as `en-GB`. Cosmetic.

**Effort:** M overall; the dialog and menu are S each.

## 11. Intro demos loop with Reduce Motion on (reduced motion; WCAG 2.2.2)

**Evidence**
- `IntroDemo.tsx:110-126` replays the arcade recording on a canvas, looping `% DEMO_LENGTH_TICKS`.
- `PuzzleDemo.tsx:257-281` replays recorded touches with a moving finger trail, looping.
- Both are mounted by `RoundIntro.tsx:314-322` through `IntroStage`. Neither reads reduced motion.
- A practice intro waits for Ready, so the demo can loop indefinitely beside the instructions with no pause.

**Fix**
- Under `prefersReducedMotion()`, pass `demo={null}`. The still (`IntroExample`) is already the fallback, and
  layout doesn't shift (demo-intro-check proves the box is sized by the text).
- For everyone: play the demo twice, then hold the last frame.

**Effort:** S.

## 12. Winner reveal pulse (reduced motion)

**Evidence**
- `WinnerReveal.tsx:56-67` runs a requestAnimationFrame loop writing `scale()` and a gold text-shadow from
  `winnerRevealFrame` (`startPresentation.ts:35-43`).
- It is a 250 ms pulse, scale up to 1.05, from 1.8 s to 5.8 s, with no `reduced` input. Its siblings
  `duelStartFrame` and `roundTitleFrame` do take one.
- The loop also keeps running while the screen is up, so it isn't battery-friendly.
- The area is small, so it is probably under the WCAG 2.3.1 flash threshold, but 4 Hz is above three a second.

**Fix**
- Pass `reduced` (scale 1, static glow).
- Stop the loop after the roll ends.

**Effort:** S.

## 13. Matching by colour alone (colour alone)

| Game | Evidence | Fix | Effort |
|---|---|---|---|
| Chroma Lines | Endpoint pairs differ only by hue, including red, green, orange, brown, lime and pink (`flow.tsx:115-125`, `lib/duel/flow.ts:10-22`) | A number or letter in each dot | M |
| Bomb Defusal | Rules name wire and button colours, and wires show only colour; labels "Wire 2" leave the colour out (`bombDefusal.tsx:113-171`, `lib/duel/bomb.ts:15-19`) | A colour tag (R, G, B…) beside each wire's number and on each button, and in the label | S |
| Colour Flood | Swatches and cells are colour only; the names are in `aria-label` only (`colourFlood.tsx:220-229`) | A symbol a colour, like Polypotions | S–M |
| Tally | "How many red stars?" with red and green glyphs in one tray (`countUp.tsx:58-67,160-167`) | Avoid red and green in the same tray, or texture a colour | M (stamp if the deal changes) |
| Mixed Signals | Canvas ink matched to colour gates, eight hues including red, green, orange and brown (`lib/arcade/colourClash.ts:72-73`) | A display-only symbol a colour on gates and ink | M–L |
| Flash | The amber trap against the gold flash is the skill (`lib/duel/types.ts:636-637`) | Give the real flash a shape the trap lacks, or say in the intro that the game relies on colour | M |
| Kakuro | A finished sum is green (#8FE3A4) and a broken one red (`kakuro.css:47-48,64-65`) | A ✓ on done sums and a strike-through on broken ones | S |
| Polypotions | Symbols drawn only when not `compact`, so reveal boards are colour only (`sortTubes.tsx:123`) | Show the symbols on compact boards too | S |

Rules 1–2 (determinism, version stamps) apply only if a deal or rule changes, as in Tally's tray. Every other fix
here is display only.

## 14. Wrong shown only in red (colour alone)

| Where | Evidence | Fix |
|---|---|---|
| Mosaic (Nonogram) reveal | Wrong cells are a red tint, and the × is deliberately hidden on them (`nonogram.tsx:114-122`) | Hatch or ✗ |
| Box Six reveal | Wrong digits only `text-destructive` (`miniSudoku.tsx:88`) | Strike-through or a corner ✗ |
| Kakuro reveal | Wrong digits "in red" (`kakuro.tsx:319-325`) | The same |
| Regions | Over-size regions are a red tint near the "rose" done shade #c9708f (`fillomino.css:36-57`); givens against entries are white against gold only | A dashed border on bad regions, and replace the rose |
| Lamplighter | Clashing lamps and beams `bg-destructive` (`lightUp.tsx:137-151`) | ✗ on the lamp, dashed beams |
| Ascend | A wrong tap turns the disc red (`numberHunt.tsx:89-93`) | A brief ✗ overlay |
| Interlock | A wrong tile flashes `bg-warn` (`tileGrid.tsx:285-289`) | ✗ |
| Slider | A valid row is a cyan border, a locked row gold (`wordSlide.tsx:86-88`) | ✓ at the row end, a lock icon |
| Strikeout keys | Hit letters gold, misses red, both at 70 % (`strikeout.tsx:257-262`, `LetterKeypad.tsx:16-22`) | Strike-through on misses, and `aria-label="R, not in word"` |
| Shared reject | A red outline plus a shake (`lib/fx/puzzleReject.ts`); with Reduce Motion only the red is left | A ✗ badge |
| HUD warn pills | Slider's par turns red past par (`wordSlide.tsx:383`), Colour Flood's moves `text-warn` (`colourFlood.tsx:215`), `HudPills` `tone: "warn"` | "+2 over" or "!" text |

**Effort:** S each, display only.

## 15. Arcade canvases (SR)

**Games**
- 41 of the 92 active games (the 37 arcade games and the engine games Tenfall, Mixed Signals, Bonk and Pull!) draw play on a canvas.
  - Through `ArcadeCanvasStage`: Ringer, Iron Wall, Blockzone, Fission, Curl Champ, Five Hands, Roofbound, Free Cell,
    Top Bins, Home Run, Rainbow Bridge, Mahjong, Minefield, Crazy Golf, Orbit, Cue Ball, Thirteen, Apex, Moon Climb,
    Mixed Signals, Grappler, Tilt, Summit, Wavefront.
  - With their own canvas: Ball Tracker, Tempo, Swish, Breaker, Coral Pop, Flightpath, Pull!, Spacewalk, Hover,
    Gemstone, Pinball, Rally, High Rise, Slice, Meteor, Tenfall, Bonk.

**Evidence**
- `ArcadeCanvasStage.tsx:414-418` gives `<canvas>` an `aria-label` with no `role="img"`. A canvas has no implicit
  role, so readers often drop the name.
- The HUD canvas is `aria-hidden` (`:453`), so score, lives and cards are never in the DOM.
- The same applies to `ReplayCanvas.tsx:186,219` and `IntroDemo.tsx:140`.

**Fix, in order**
- `role="img"` on every labelled canvas (S).
- A throttled sr-only `aria-live="polite"` score line in ArcadeCanvasStage (S).
- A DOM mirror for the turn-based card and board games (Free Cell, Summit, Thirteen, Five Hands, Minefield,
  Mahjong; L each).
- A product decision: tag real-time arcade games "not screen-reader accessible" in Practice and the intro.

## 16. Cell labels that hide the content (SR)

| Game | Evidence | Fix |
|---|---|---|
| Box Six | `aria-label={\`Cell ${cell + 1}\`}` replaces the digit (`miniSudoku.tsx:90`) | "Row 2 column 3, 5, given" |
| Mosaic | "Row N column M" with no state (`nonogram.tsx:109`) | Add filled / crossed / empty, and `aria-pressed` |
| Kakuro | Clue cells `aria-hidden` (`kakuro.tsx:85`) and cells without run sums (`:112`) | "Row 2 column 3, across 16, down 7" |
| Bomb Defusal | "Wire 2", "Button A" with no colour; the switch is a span with a label and no role (`bombDefusal.tsx:100-162`) | "Wire 2, red" |
| Polypotions | "Flask N" with no contents; "Corked" on a role-less span (`sortTubes.tsx:88,98`) | "Flask 3: blue, blue, red on top, corked" |

**Effort:** S each.

## 17. Keyboard, fake and pointer-only controls (KB, SR)

**Fake buttons**
- `role="button"` with no `tabIndex` or key handler:
  - Checkout wedges (`checkout.tsx:424,434`)
  - Cryptogrid cells (`codeword.tsx:64`)
  - Double Take rectangles (`spotTheDifference.tsx:236`)
  - Strikeout rows (`strikeout.tsx:101`)
- Interlock cells and tray (`tileGrid.tsx:273-304`) are `<span onClick>` / `<div onClick>`.
- Fix: `<button>`. S each.

**Pointer-only buttons**
- 19 buttons use `onPointerDown` only, so Enter, Space and assistive-tech activation do nothing:
  - NumberEntry's whole keypad (`NumberEntry.tsx:82,97,116`)
  - `colourFlood.tsx:222`, `nonogram.tsx:106`, `pairMatch.tsx:86`, `chainTap.tsx:474`, `reaction.tsx:354`
  - `slidingTiles.tsx:188,195`, `wordSlide.tsx:388,400`, `curling.tsx:339,364`, `inkBridge.tsx:201`
  - `gradientBoard.tsx:526,533`, `tilesBoard.tsx:115`
- Fix: an `onClick` that acts only when `event.detail === 0`, so touch timing is unchanged. S–M.

**NumberEntry**
- The input has no name: the `<p>{label}</p>` above it (`NumberEntry.tsx:60`) isn't linked.
- "⌫" has no label.
- Fix: `aria-label`. S.

**Drag-only grids**
- No keyboard path and no grid semantics on `useGridPointer` boards: Chroma Lines, Regions, Shikaku, Lamplighter,
  Island Link, Loopline, Slider. Only Ball Tracker and Gemstone use `KeyCursor`.
- Fix: `role="grid"` and `gridcell`, a roving tabIndex, arrows through `useGridCursor`. L.

**Chat Mute and Report**
- Reachable only by long-press or the context menu (`RoomChat.tsx:112-125,371`). The overlay has no dialog role,
  Escape or focus move (`:391-435`).
- Fix: a visible ⋯ a message, and the Sheet. M.

**Hidden information**
- "Online only", "None saved" and "Best N" are hidden behind row `aria-label`s (`practice.tsx:670-694,868`,
  `index.tsx:520`).
- Fix: `aria-describedby`. S.

## 18. Small game targets (tap targets)

| Game | Size | Evidence | Fix | Effort |
|---|---|---|---|---|
| Minefield | 10 × 16 cells of 36 units: about 37 px at 390×844, 30 px on the SE | `lib/arcade/minesweeper.ts:27-56` | Long-press slop or magnifier, or fewer columns on a new `minesRev` | M–L |
| Summit | 39-unit cards with no hit slop: 36 × 65 px, 30 × 54 on the SE | `tripeaks.renderer.ts:20,56-63` | ±3 units of sideways slop on uncovered cards (display and input mapping; no rule change if the slop never reaches a covered card) | S |
| Free Cell Undo / Reset | Drawn 38 × 26 units; the hit box is about 47 × 40 px at 390×844 and 38 × 33 px on the SE | `freecell.renderer.ts:95-112` | A larger hit box, or a DOM row like Mahjong's | S–M |
| Cryptogrid clue strip | 14–18 keys in one row, `gap-px`: about 19–25 × 34 px at 375 px; exempt from the dock's 52 px | `codeword.tsx:101-121`, `game-frame.css:530-534` | Two rows of 7–9 | S–M |
| LetterKeypad (Strikeout, Cryptogrid) | About 33 px wide at 375 px | `LetterKeypad.tsx:67-82` | As the system keyboard does; low priority | L |

## 19. Grid puzzles and the intro back button (tap targets)

Cell sizes at 375 px wide (a column of about 351–367 px):

| Game | Grid | Cell size | Source |
|---|---|---|---|
| Lookout | 10 × 10 | about 33–35 px | `wordSearch.tsx:49-71`; a drag, so less critical |
| Shikaku | 10 columns | about 35 px | `shikaku.tsx:62` |
| Lamplighter | 9 × 9 | about 39 px | `lightUp.tsx:95` |
| Chroma Lines | 9 × 9 | about 40 px | |
| Mosaic (deeper revision) | 8 + clue column | about 40 px | |
| Tents and Trees | 8 + 22 px counts | about 41 px | |

- Fine: Kakuro, Box Six, Regions, Island Link, Pipeline and Loopline (edges snap across about 60 px).
- Fix: hit slop to the nearest cell centre, which is display and input only. A smaller grid needs a stamp.
  M per game.
- The intro back button is 36 × 44 (`room-screens.css:641-651`, `RoundIntro.tsx:265`). Fix: a 44 px `::before`.
  S.

## 20. In-canvas input in the home-bar zone (safe areas)

| Game | Problem | Evidence |
|---|---|---|
| Spacewalk (`cross`) | The 390 × 727 world fills to 16 px above the bottom, and a swipe can start anywhere, so an upward swipe from the lowest 18 px goes home on iPhone | `cross.tsx:228-266` |
| Top Bins | The power-press band (world y ≥ 626) reaches about 17 px above the bottom | `freekick.renderer.ts:919-920` |
| Free Cell | The longest columns reach world y 762, about 25 px above the bottom | `freecell.renderer.ts:33` |

Lower:
- Summit's stock ends about 33 px up.
- Iron Wall's hint text sits 31 px up (display only).
- Ringer is only at risk for swipes started below the ball.

**Fix:** #2's lift fixes all of these. Without it, ignore swipe starts inside the inset (S).

## 21. Canvas motion not gated (reduced motion)

| Game | Evidence | Fix |
|---|---|---|
| Top Bins | `freekick.renderer.ts` never reads reduced motion: jumping fans, waving flags and **camera flashes** (up to 9 a frame, re-randomised every 2 ticks, about 70 ticks, `:796-901`), and pulsing rings (`:1286-1384`) | Skip the flashes and waves when still; a constant pulse |
| Slice | A full-screen red flash up to 0.45 alpha over 14 ticks on a bomb (`slice.renderer.ts:345`; the combo flash below it is gated) | A static red edge |
| Tenfall | Refused-tile jitter of ±2 px at 15 Hz (`tenDrop.renderer.ts:409-410`) | Gate it |

- Junction (practice only) has an ungated tap ring and crash flash (`junction.renderer.ts:477-522`).
- **Root cause:** `arcadeReducedEffects()` (`lib/fx/lowEnd.ts:103-105`) is only the performance level or Battery
  saver. Renderers that gate on it alone ignore the OS setting.
- Fix: make it OR in `reducedMotion()`, or add a static check that every renderer with shake, flash or pulse
  imports `reducedMotion`. reduced-motion-end-check only reads CSS today.
- **Effort:** S each; M for the root fix and the check.

## 22. Low-alpha and tiny canvas text (contrast)

| Game | Text | Measured | Evidence |
|---|---|---|---|
| Orbit | "Checkpoint used", white at 0.4, 12 px | 3.73:1 | `orbit.ts:908`, `orbitRev3.ts:1043` |
| Five Hands | "No hand", rgba(233,220,190,0.34), 11 px | 2.56:1 | `cards/fiveHands.renderer.ts:116` |
| Grappler | "20 m" distance marks, white at 0.3 | about 2.7:1 | `swing.renderer.ts:424` |
| Grappler | The par clock past par, grey at 0.6 | about 4.6:1, depends on the sky | `swing.renderer.ts:1325,1435` |

- Fix: at least 0.6 alpha (white at 0.6 is 7.3:1). S each.
- The Retro HUD's side counts step down to 8 px Press Start 2P when space is tight (`retro.renderer.ts:351-399`).
  Fix: a 10 px floor, wrapping to the second row instead (M).
- Flightpath and Swish use 9 px labels, Home Run and Breaker 8 px.

## 23. Dimmed "done" clues (contrast)

- Mosaic's satisfied clues are `text-muted-foreground/40`: 2.0:1 (`nonogram.tsx:74`).
- Tents' counts are `opacity-40` (`tents.tsx:122,132`).
- Fix: text-3 plus a tick or strike-through.

**Effort:** S.

## 24. Interface states by colour (colour alone)

| State | Evidence | Fix |
|---|---|---|
| Disabled gold button | Only `saturate(0.6) brightness(0.82)` | A dashed edge or much lower contrast face |
| Disabled secondary and quiet buttons | Change text colour only (`components.css:128-150`) | The same |
| Empty practice stars | A `--jz-surface-2` fill on the same shape (`components.css:961-970`) | An outline |
| Room-settings chips | On shows the category colour, off is grey (`components.css:381-395`) | A tick when on |
| Toast tone | Only a 3 px edge colour (`Toast.tsx:4-8`; error has `role="alert"`) | An icon |
| Answer reveal | Unfinished players only dimmed (`AnswerReveal.tsx:558`) | A "not finished" mark |

**Effort:** S each.

## 25. Minor motion (reduced motion)

- ArcadeReveal's 1 s count-up (`ArcadeReveal.tsx:229-244`) isn't gated, unlike AnimatedScore.
- Re-tapping a tab scrolls with JS `behavior: "smooth"` (`AppTabBar.tsx:49`, `AppRail.tsx:46`), which CSS can't
  stop.
- The `logo-charge-calm` 300 ms fade (`celebrations.css:101`) is cut to 0.01 ms by the global rule, because it is
  not on its exclusion list. The comment says otherwise; there is no harm.

**Fix:** S each.

## 26. Hardening

**Sheet bottom inset**
- `.jz-sheet` has no bottom inset (`components.css:577-596`).
- The four sheets today each add their own (SettingsSheet, GameMenu, `.rss-footer`, `.chat-sheet-footer`), but a
  new one would not.

**Tokens to fix before they are used**
- `--jz-loss` #E5243F on `--jz-bg` is 4.44:1 and on surface-2 3.31:1.
- White on `--jz-win` is 2.34:1.
- Neither is used yet. DESIGN.md's "a tick on green, a cross on red" will need dark ink on green and a lighter red
  for text.

**theme-check gaps**
- It doesn't cover:
  - `--jz-red` or `--jz-loss` on any surface
  - `[data-skin-off]` text
  - text under ancestor opacity
  - placeholders
  - canvas text
  - the live play screen's header, goal line, HUD pills and timer
  - the help sheet
- These gaps are why #1, #3, #4, #6 and #23 are green today. Adding them is how the fixes stay fixed.

**Desktop layouts**
- The rail and room panel (`desktop-layout.css:31-46,410-425`) have no insets. An iPad with a trackpad has a 20 px
  bottom inset.

**Fix:** S.

---

## Evidence (screenshots)

[filled in from the capture run below]
