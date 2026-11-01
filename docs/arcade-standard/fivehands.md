# Five Hands on the arcade scoring standard (fiveHandsRev 2, 1 Nov 2026; rev 1 31 Oct 2026)

## fiveHandsRev 2 (1 Nov 2026, Joe's tuning: what rooms deal)

**Today's values and medians (rev 1, before):** pair 3, two pair 6, three of a kind 8, straight 10, flush 11, full house
13, four of a kind 15, straight flush 16; hand points 160 (full at 23, the elite median) + made hands 40 (8 a row).
Medians weak → flawless (100 room seeds): **86, 136, 150, 157, 178, 192, 200**.

- **New hand values** (`FH_HANDS_V2`, `fhRowHand(row, 2)`): high card 0, pair 5, two pair 10, three of a kind 20,
  straight 25, flush 35, full house 50, four of a kind 60, straight flush 75.
- **One part, against the deck's own best** (1 Nov 2026 follow-up, Joe; replaces the fixed full figure of 46 tried
  first): score = 200 × your hand points ÷ that deck's best total, capped at 200, on a straight line; anyone who plays
  scores at least 1. No made-hands part, no speed part, no row-order rule.
- **The deck's best** is exact (`fhDeckBest`): each row holds its dealt card and one card from each round of five, so a
  row is one of 625 choices and its hand is read from a 5 × 625 table built once; a depth-first search over the four
  rounds' orders (120 each) prunes any branch whose rows' best completions can't beat the best found. About 17 ms a deck
  on average, 64 ms at worst over 100 decks; the first maximum in a fixed order is kept, so the arrangement (the
  flawless line) is the same everywhere. Because it is the true maximum, no run can beat it; the cap stays as a safety.
- **Stored with the deal:** rooms store it on the puzzle (`fiveHandsBest`, from `generateFiveHands`); the server's
  replay, the reveal, the time-lapse and the phone's stage read it from there (`fiveHandsGameFor(rev, best)`,
  `replayFiveHandsRun(seed, raw, rev, best)`). A puzzle without it (tools, checks) works the same figure out from the
  seed. The grader stores it as `extra.best`; the reveal shows "N of this deck's best M hand points".
- **The deck** is rev 1's first shuffle (the next shuffle only for a deck whose best is under a pair, never seen).
- Rev 1 runs replay unchanged: 25 rev-1 runs recorded on main (`scripts/fixtures/tuning-nov1-legacy.json`) replay to the
  same score and final state (cards-check).

Measured (`bun scripts/cards-bands.ts fivehands --seeds=200`, room seeds 0–199; fresh seeds 10000–10199 in brackets):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rev 1 median (100 seeds) | 86 | 136 | 150 | 157 | 178 | 192 | 200 |
| fixed 46 (first try) median | 65 | 130 | 152 | 152 | 173 | 195 | 200 |
| **per-deck best, median** | **23** (22) | **45** (46) | **56** (58) | **58** (58) | **59** (66) | **73** (73) | **200** |
| per-deck best, p10–p90 | 7–72 | 18–94 | 21–109 | 24–116 | 26–120 | 36–129 | 200 |
| per-deck best, mean | 30.6 | 50.2 | 60.3 | 62.6 | 67.3 | 79.3 | 200 |

The deck's best: median 125 hand points (p10 85, p90 160). The best was beaten in **0** bot runs (it is the exact
maximum; cards-check also plays 120 bot runs and 1,280 hill-climb restarts against it).

**Why the aims are not met.** A player's hand points barely follow the deck's best: the correlation over 200 decks is
0.20 (weak), 0.31 (average), 0.24 (good), 0.12 (great), 0.23 (near-perfect), 0.35 (elite). The best is reached only by
knowing the whole deck in advance; a real player places each card before seeing the rest, and what the steep table
pays for (straights, flushes, full houses) depends on which cards turn up when, not on how rich the deck is overall.
Near-perfect players reach about 31 % of their deck's best (p10 13 %, p90 62 %). So dividing by the best keeps the
spread (near-perfect p10–p90 26–120) and drops every level to under 80. Dividing by a realistic player's own result on
the same deck (a no-error sight player, or the rollout planner) was tried as well: the correlations stay at 0.2–0.5 and
the spread is no smaller. The deal-dependence Joe saw comes from the steep table and in-run luck, not from deck richness.


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
