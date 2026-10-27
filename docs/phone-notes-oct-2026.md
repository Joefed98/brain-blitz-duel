# Joe's phone-test notes (27 Oct 2026)

Fourteen changes from Joe's iPhone 11 home-screen tests (414×896). Item 12 (Gridlock partial credit) moved to the puzzle
scoring session and is not here. Scoring formulas are unchanged: only the move, swap, pour and tilt limits move, and every
change to play or scoring is on a new stamp (one above the live one), so older rounds replay and score exactly as before.

New stamps are dealt through `dealtNotesRev` (`src/lib/duel/phoneNotes.ts`): a game deals its new stamp only while
nothing older is pinned, so a check that pins an earlier stamp (the top-up's, a depth session's, or
`pinPrePhoneNotes(true)`) keeps proving what it was written for.

| # | Game | Change | Stamp |
|---|------|--------|-------|
| 1 | Strikeout | The solved words sit above the tiles, not below. | none (layout) |
| 2 | Swapword | 4 more swaps: budget minimum + 12 (was + 8). | `swapwordRev 6` |
| 3 | Counterweight | 1.5× the hangs, rounded up: 9 / 12 / 15 / 18 (was 6 / 8 / 10 / 12). | `balanceRev 3` |
| 4 | Brimful | 1.5× the pours, rounded up (rev 2's limit, about 3× the fewest rounded to a 5, × 1.5). | `measureRev 3` |
| 5 | Trail | Category Number → Logic (its colour, the lists and chips, the room's category mix, its round music). Its scoring (`depthRev 1`, Number depth) is unchanged. | none |
| 6 | Flash | The orange trap screen is light orange (#FFAA70; was the dark amber that read as gold). | none (look) |
| 7 | Don't Break the Chain | The charms' glow is a little softer (5 px at 75 %, was 8 px at full strength). | none (look) |
| 8 | Bonk | The diamond stays up 450 ms (27 ticks; was 300 ms), its burrow kept free that long. | `whackRev 4` |
| 9 | Mixed Signals | A long colour word in a side lane shrinks to fit the world (15 px at the least; at that size its plate moves in just enough to stay whole). Never cut off. | none (look) |
| 10 | Labyrinth | The three stars can be anywhere the ball can reach (on the route too), still one in each third of the route. | `mazeRev 2` |
| 11 | Matchmaker | The gold pair pays its 20 any time in the round's first 30 s (was: full within 8 tries, falling to none at try 20). | `pairRev 2` |
| 13 | Topsy-Turvy | 2× the tilts; a ball home fills its hole and blocks like a ball (the boards are generated and solved under that rule). Balls roll at one constant speed with no overshoot, so none is ever drawn running into or through another. | `gravityRev 4` |
| 14 | Hanoi | Slimmer discs (0.6 of the room a ring has, at most 22 px; was 0.86 and 34 px). | none (look) |
| 15 | Jumbled → Gradient | Shown as "Gradient" everywhere (internal id `tiles` kept). Tiles lock once home; every round has its own colour scheme; swaps instead of slides (below). | `tilesRev 4` |

## Assumptions and decisions

- **Gradient swaps instead of slides.** With row and column slides a locked tile can never move, so once the last few
  tiles are locked round them the board is often stuck for good (two swapped tiles in different rows and columns can
  never be exchanged). In a simulation of 1,000 runs on dealt boards, 980 got stuck. tilesRev 4 therefore swaps two
  tiles (tap one, then another, or drag one onto another): any two unlocked tiles can always be swapped, so every board
  can be finished and locking never traps the player. 15 of the 21 movable tiles start out of place (none of them home);
  the other 6 and the 4 corner anchors start locked and dotted, giving the reference points. The fewest swaps is exact
  (tiles out of place less cycles); par is that + 3, as before. Scoring is tilesRev 3's `scoreJumbled` unchanged
  (120 + par points + speed + elite on a finish, 110 × the share of tiles placed unfinished). Undo and Reset are gone on
  tilesRev 4 (a wrong swap is undone by swapping back; Reset would only unlock tiles).
- **Gradient's colours.** `gradientPalette.ts` draws four corner colours in OKLCH (one corner dark, the opposite light,
  hues from yellow, orange, brown, red, pink, purple, blue, teal, green and lime), blends them in OKLab and turns or
  mirrors the board one of eight ways. A palette is kept only when every pair of neighbours is at least 6 ΔE2000 apart
  with normal vision and 3.5 with simulated protan, deutan and tritan vision, and any two tiles at least 3 apart. Drawn
  once on the server and stored on the puzzle (`palette`), so a room's players see the same board.
- **Matchmaker's 30 s.** The flip list carries no times, so a pairRev 2 answer adds the round-clock time of the gold
  match (`<flips>@<ms>`, from the phone's synced clock as Flash and Bang On's tap logs are); the server holds it to the
  answer's receipt time. Like Forage's misses, the time is the phone's word (`docs/security-audit-oct-2026.md`). A
  gold match after 30 s scores nothing (no taper), as the note reads. A small "gold 23s" countdown shows on the status
  line while the window is open.
- **Topsy-Turvy.** The sim already stopped a rolling ball against another rolling ball; what passed "through" was a ball
  rolling over a ball already home in its hole (drawn filling the hole) and the old overshooting ease letting a ball
  briefly overlap the one it stopped against. gravityRev 4 makes a ball home block, and the animation (all revisions,
  display only) rolls at 45 ms a square, linear.
- **Flash.** "The dark yellow false-start colour" is read as the near-gold amber trap (tapping it is a false start).
  Only its colour changes; the trap, its schedule and scoring are unchanged.
- **Bonk.** "A little longer": 300 → 450 ms.
- **Labyrinth.** Stars may now sit on the route, so a star can be taken without a detour; star points are unchanged.
- **Intro demos** stopped until re-recorded: Topsy-Turvy (gravityRev 4), Gradient (tilesRev 4), Bonk (whackRev 4).
  Matchmaker's pairRev 1 demo plays on (its play is the same; the gold pair just pays on the clock now). Swapword,
  Counterweight, Brimful and Labyrinth demos play their own stored puzzles, whose rules are unchanged.
