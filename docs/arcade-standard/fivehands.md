# Five Hands on the arcade scoring standard (fiveHandsRev 2, 1 Nov 2026; rev 1 31 Oct 2026)

## fiveHandsRev 2 (1 Nov 2026, Joe's tuning: what rooms deal)

**Today's values and medians (rev 1, before):** pair 3, two pair 6, three of a kind 8, straight 10, flush 11, full house
13, four of a kind 15, straight flush 16; hand points 160 (full at 23, the elite median) + made hands 40 (8 a row).
Medians weak → flawless (100 room seeds): **86, 136, 150, 157, 178, 192, 200**.

- **New hand values** (`FH_HANDS_V2`, `fhRowHand(row, 2)`): high card 0, pair 5, two pair 10, three of a kind 20,
  straight 25, flush 35, full house 50, four of a kind 60, straight flush 75.
- **One part:** the score is the five rows' hand points alone, on a straight line to 200 (`stdLine(200, total,
  FH_CORE_FULL_V2)`), full at **49** rev-2 hand points, capped at 200; anyone who plays scores at least 1. No made-hands part, no speed part, no row-order rule.
- **The same per-seed approach as rev 1:** the deck is rev 1's seeded shuffle and its witness (an arrangement of your 20
  cards, the only freedom being the order within each round of five) is climbed on the rev-2 table; a deck whose witness
  does not reach the full figure is reshuffled (the next attempt's seed), so every dealt deck lets perfect play reach
  exactly 200. Rev 1 also needed all five hands made; rev 2 needs only the full figure. 293 of seeds 0–299 deal
  rev 1's very deck (cards-check). Witness totals over seeds 0–299 before the reshuffle: min 30, p10 55, median 100,
  p90 135, max 185.
- **The full figure, 49** (Joe's decision, 2 Nov 2026): set from the skill bands so the near-perfect median lands at
  160–165 (163). The near-perfect bots' median is 40 hand points, the elite 45. History: the first push used 46
  (near-perfect 173); a follow-up scored each deck against its own exact best, which was dropped because placement is
  blind and the steep table makes points depend on card order, not deck richness (players' points correlated 0.1–0.35
  with the deck's best; every level fell under 80).
- Same play, deck order and 60 s run. Rev 1 runs replay unchanged: 25 rev-1 runs recorded on main
  (`scripts/fixtures/tuning-nov1-legacy.json`) replay to the same score and final state (cards-check).

Measured (`bun scripts/cards-bands.ts fivehands --seeds=200`, room seeds 0–199; the bots weigh the steep table's draws:
flush × 3.2, straight × 2.5, ranks × 2):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rev 1 median (100 seeds) | 86 | 136 | 150 | 157 | 178 | 192 | 200 |
| rev 1 p10–p90 | 57–171 | 78–200 | 86–200 | 99–193 | 107–200 | 136–200 | 200 |
| fixed 46 median | 65 | 130 | 152 | 152 | 173 | 195 | 200 |
| fixed 46 p10–p90 | 21–173 | 43–200 | 65–200 | 65–200 | 65–200 | 86–200 | 200 |
| **fixed 49 median (dealt)** | **61** | **122** | **142** | **142** | **163** | **183** | **200** |
| fixed 49 p10–p90 | 20–163 | 40–200 | 61–200 | 61–200 | 61–200 | 81–200 | 200 |
| fixed 49 mean | 74.7 | 119.2 | 137.5 | 140.7 | 146.1 | 162.7 | 200 |
| hand points, median | 15 | 30 | 35 | 35 | 40 | 45 | 95 |

Fresh seeds (10000–10199) on 49 give the same medians (61, 122, 142, 142, 163, 183, 200); near-perfect p10–p90 81–200,
elite 102–200.

**The deal matters a lot at the top (reported as asked).** With the steep table a run's score is decided mostly by
whether the deck brings the cards for a straight, a flush or a full house: the near-perfect level's p10–p90 is 61–200
and the elite's 81–200, so on a thin deck even very good placement scores 60–80, and on a rich one an average player can
reach 200. Better play still scores clearly higher on average (means rise 75 → 119 → 138 → 141 → 146 → 163 → 200).
Good and great share a median (35 hand points, the 5-point steps); their means differ. In a room everyone has the same
deck, so the ranking between players is still fair; only scores between different rounds swing with the deal.


A new Arcade game in the Cards & Board group (`src/lib/duel/arcadeGroups.ts`), born on the standard: `fivehands`,
60 s run (63 s round clock). Sim `src/lib/arcade/cards/fiveHands.ts`, art `fiveHands.renderer.ts` (the shared card
renderer and felt), stage `src/puzzles/fiveHands.tsx`, replay `replayFiveHandsRun` (`src/lib/duel/cards.ts`).

## Rules

- A seeded 52-card deck, the same for everyone in a room. Five cards are dealt, one into the leftmost slot of each of
  the five rows.
- Then 20 turns. Each turn turns up two cards: **yours** (shown large in the middle; tap a row, or drag the card onto
  it, to place it in that row's next slot; once placed it can't move) and a **discard**, "taken by an opponent", which
  goes face up onto the discard row along the bottom: two rows of ten, overlapping side by side, oldest top left, each
  showing the shared renderer's large index (rank and suit across the top strip).
- **Even filling:** a row takes its next card only once every row holds as many. After turn 5 every row has 2 cards,
  after turn 10 three, and so on. Rows already filled for the round are greyed out; a tap on one is refused (the
  shared miss pulse) and changes nothing.
- 45 of the 52 cards are seen by the end (5 dealt, 20 placed, 20 discarded).
- Only the five rows score, as poker hands (`psHand`, shared with Full House): pair 3, two pair 6, three of a kind 8,
  straight 10, flush 11, full house 13, four of a kind 15, straight flush 16. A badge at the end of each row lights gold
  with the hand and its points. At the buzzer every row scores as it stands (a short row can hold a pair, two pair,
  trips or four of a kind, never a straight or flush).
- No instruction text on the play screen: HUD chips (POINTS, TURN n/20, HANDS n/5), the rows, your card with the
  deck count and the discards.

The discard of a turn turns up with your card (so you can count it before placing); assumption noted in the PR.

## The deal and the proof of 200

`fhBuildDeal(seed)`: the deck is shuffled from the seed (`shuffledDeck`, the engine's PRNG), then its **witness** is
searched: an arrangement of your 20 cards into the rows. The rules leave only one freedom, the order within each round
of five turns (each row takes exactly one of them), so the witness is four permutations of five. A seeded hill climb
(4,000 steps: swap two rows' cards within one round, kept when the two rows are no worse; a row with no hand costs 24)
looks for one that makes a pair or better in all five rows and reaches the core's full figure. A deck without one is
reshuffled (the next attempt's seed). So every dealt deck lets perfect play reach exactly 200: the witness fills the
core (≥ 23 hand points) and makes five hands. Witness totals over seeds 0–299: min 23, median 43, max 55 (the climb
only needs to reach 23). About 20 ms a deal here; the deal is cached per seed (eight kept).

cards-check replays the witness through the server's replay to exactly 200 on every tuning seed (0–59), every fresh
seed (10000–10199) and 200 room-style seeds; arcade-standard-check replays six more.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Hand points (core) | 160 | `stdLine(160, total, 23)`: a straight line, full at 23 hand points |
| Made hands | 40 | 8 for each row with a pair or better |

No speed part, so no "full by" time. Any played run scores at least 1; no input 0.

## Measured (`bun scripts/cards-bands.ts fivehands --seeds=100`, room seeds 0–99)

The core is full at the **elite** bots' median hand points (Joe: top marks need elite placement): **23**.

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| score, median (p10–p90) | 86 (57–171) | 136 (78–200) | 150 (86–200) | 157 (99–193) | 178 (107–200) | 192 (136–200) | 200 |
| hand points, median | 9 | 15 | 17 | 18 | 20 | **23** | 36 |
| all 20 placed | 6/100 | 96/100 | 100/100 | 100/100 | 100/100 | 100/100 | 100/100 |
| finish, median | 58.2 s | 50.6 s | 37.3 s | 27.5 s | 19.9 s | 15.8 s | 9.9 s |

Bots (`scripts/arcade-skill-bands/bots/fivehands.ts`): every level below elite places by sight (each open row valued by
the hand it makes now and what it keeps open, with the outs already seen counted off), about 2.3 s a card at the
average level, blurred by the level's judgement, with the odd tap on a greyed row. Elite plans ahead: each open row is
valued by 16 rollouts of the unseen cards (the remaining turns' cards and discards, placed by the sight rule under the
even-filling rule). Flawless taps the witness.

## Assumptions

- The weak level (3.1 s a card) runs out of time on most seeds; its rows score as they stand.
- The made-hands part pays 8 a row (40 for five), so a run that makes five pairs and little else still scores well
  (about 120); the spread is in the core.
