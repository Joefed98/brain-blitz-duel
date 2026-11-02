# Pyramid on the arcade scoring standard (pyramidRev 1, 1 Nov 2026)

A new Arcade game in the Cards & Board group (`src/lib/duel/arcadeGroups.ts`), born on the standard: `pyramid`, a 90 s
run (93 s round clock). Sim `src/lib/arcade/cards/pyramid.ts`, art `pyramid.renderer.ts` (Free Cell's deck and blue
felt), stage `src/puzzles/pyramid.tsx`, replay `replayPyramidRun` (`src/lib/duel/cards.ts`). The follow-up below (made
before the stamp shipped, so in place) made it harder: one pass and deals that need a plan.

## Rules

- A 28-card pyramid (seven rows, the bottom row of seven uncovered; every card face up), a 24-card stock and a waste
  pile. A card is free once both cards covering it are gone.
- Tap two free cards that add to 13 (Q+A, J+2, 10+3, 9+4, 8+5, 7+6) to remove them; a King goes alone with one tap. The
  waste's top card pairs too (pyramid + waste, or a King on the waste).
- Tap the stock to turn a card onto the waste. **One pass**: the stock is never turned back over, and a waste card is
  buried by the next draw.
- A refused pair (not 13) moves the selection to the new card and pulses red; a covered card is refused.
- **Undo** (input kind 3: the position before the last removal or draw, unlimited) and **Reset** (kind 4: the deal,
  itself undoable); both restore the score parts with the cards; the clock runs on.
- The round ends when the pyramid is clear, at the buzzer, or with no pair, no King and no stock left.

## The deal: a plan needed, and the proof of 200

`pyBuildDeal(seed)` builds each deal from the seed together with its witness line: two to four Kings in the pyramid and
every other pyramid card in pyramid pairs (one left for a stock partner when the count is odd), placed by removing free
positions in a random legal order and drawing ranks and suits to fit. The pyramid is therefore a puzzle in full view,
and the face-down stock is a bonus, never the lottery that decides a clear. A deal is kept only when:

- its witness, played through the sim, clears the pyramid with at least ten pyramid pairs; and
- **none of three quick players with no plan clears it** (`pyGreedyClears`): the one taking the first pair it sees, the
  one taking the pair that uncovers most, and the one taking the best two-removal line in view. So the pairs only all
  come out when cards are removed in the right order.

Otherwise the next attempt on the same PRNG stream is tried (about 5 ms a deal; cached per seed and built while
RoundIntro is up). The solver (`scripts/cards/pyramidSolver.ts`) independently re-proves sampled deals.
cards-solitaire-check replays the witness through the server's replay to exactly 200 on 460 seeds and checks that no
quick player clears 60 of them.

## Scoring (200)

| Part | Max | How |
| --- | --- | --- |
| Pyramid cards | 140 | a straight line over the 28 pyramid cards removed |
| Cleared | 20 | all 28 removed |
| Speed | 20 | cleared only: full by 20 s (the flawless pace), 0 at the buzzer |
| Pyramid pairs | 20 | 2 for each pair of two pyramid cards, up to 10 |

Any played run scores at least 1; no input 0.

## Skill bands, before → after (`bun scripts/cards-bands.ts pyramid --seeds=60 --from=10000`, fresh seeds)

| Level | Before | After | Cleared after | Clear time after |
| --- | --- | --- | --- | --- |
| Weak | 109 | 104 | 0/60 | — |
| Average | 134 | 131 | 14/60 | 73.4 s |
| Good | 178 | 135 | 23/60 | 51.3 s |
| Great | 190 | 190 | 30/60 | 37.1 s |
| Near-perfect | 197 | 197 | 37/60 | 25.7 s |
| Elite | 198 | 199 | 40/60 | 20.8 s |
| Flawless | 200 | 200 | 60/60 | 20.0 s |

The bots (`scripts/arcade-skill-bands/bots/pyramid.ts`) cannot see the stock; they pick among the removals open now by a
look-ahead over the cards in view (0 for weak, the pair spotted first, up to 5 removals for elite), blurred by judgement.
The clear rate now rises with skill as it should (0 → 14 → 23 → 30 → 37 → 40 of 60). What the score can't do with these
parts is spread the top: any clear earns 140 + 20 + 20 for pairs, so a level that clears more than half its deals has a
median at or near 200, and a level that doesn't sits at its partial score (about 104–135). Joe's targets (great ~160,
near-perfect ~175, elite 185–195) need either cleared runs that score less than 180 or a lower clear rate for great;
options for Joe are in the PR (e.g. a smaller clear part and a larger speed part).
