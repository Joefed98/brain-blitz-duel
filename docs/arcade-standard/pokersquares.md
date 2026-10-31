# Full House (`pokersquares`) on the arcade scoring standard (pokerSquaresRev 2, 31 Oct 2026; rev 1 30 Oct 2026)

Shown as **Full House** since 31 Oct 2026 (was Poker Squares; the id stays `pokersquares`).

## pokerSquaresRev 2 (31 Oct 2026): the core full at the elite median

Joe: lower the scoring so top marks need elite placement. Same deals, same play; the core is full at
`PS_CORE_FULL_V2` = **73** hand points, the elite bots' median (rev 1: 68, the near-perfect median). Rev-1 runs score as
before (`pokerSquaresGameFor(1)`; cards-check replays 24 rev-1 runs recorded on main, `scripts/fixtures/cards-rev1-legacy.json`).
The target grid's acceptance is the revision's full figure; every grid measured reaches 99 or more (min over 300 seeds),
so rev 2 deals exactly rev 1's grids (cards-check compares 40 seeds) and every one reaches 200 (200 seeds proved).

The elite bot now plans ahead (31 Oct 2026, `scripts/arcade-skill-bands/bots/pokersquares.ts`): each empty square is
valued by ten rollouts of the unseen cards placed by the sight rule. Before that, elite and near-perfect used the same
sight rule and tied within noise (65), which would have *raised* scores. Other levels are unchanged.

Re-measured on rev 2 (`bun scripts/cards-bands.ts pokersquares --seeds=100`, room seeds 0–99):

| Level | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| score, median (p10–p90) | 80 (43–117) | 148 (106–184) | 161 (123–196) | 171 (139–196) | 178 (141–200) | 193 (161–200) | 200 |
| hand points, median | 26 | 52 | 57 | 63 | 65 | **73** | 154 |
| all 25 placed | 0/100 | 76/100 | 100/100 | 100/100 | 100/100 | 100/100 | 100/100 |
| rev 1 score, median | 84 | 157 | 170 | 181 | 188 | 196 | 200 |

No speed part, so no full-by time. The HUD reads FULL AT 73 on rev 2 (68 on a rev-1 replay).

# Rev 1 (30 Oct 2026)

A new Arcade game in the Cards & Board group, born on the standard: `pokersquares`, 60 s run (63 s round clock).

## The stamp and the deal

`pokerSquaresRev 1` (`PS_REV`, spec `PS_STD_SPEC`, parts `pokerSquaresStdParts`, `src/lib/arcade/cards/pokerSquares.ts`).
Rooms deal any seed (`generatePokerSquares`). The sim builds the deal from it: 25 cards from a seeded deck, improved by a
seeded hill climb (20,000 steps: swap two squares, or a square with an unused card, kept when the lines it touches are
no worse; a line with no hand costs 24) until every row and column holds a pair or better and the total reaches the
core's full figure, 68 (`psTargetGrid`; a fresh attempt from the seed if not). The grid's total (median 154 over 200
seeds) is kept in the state as the proof; its 25 cards are then shuffled into the dealing order. Placing every card on
its target square fills the core and makes ten hands: 200 on every seed, by construction (cards-check proves it on 200
seeds). Integer maths and the engine's PRNG only; the deal is
cached per seed (eight kept), since the phone's stage builds its first state on every render.

## Rules

25 cards come one at a time; a tap on an empty square places the next card (dragging the next card onto a square does
too). A placed card stays. Each row and column scores as a poker hand: pair 3, two pair 6, three of a kind 8, straight
10 (Ace low or high), flush 11, full house 13, four of a kind 15, straight flush 16. A line with empty squares scores
what it holds (a pair, two pair, trips or four of a kind; never a straight or flush). Badges at the end of each row and
under each column light gold with the hand and its points.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Hand points (core) | 160 | `stdLine(160, total, 68)`: a straight line, full at 68 hand points |
| Made hands | 40 | 4 for each row or column with a pair or better |

There is no speed part, so no "full by" time.

The core's full figure (30 Oct 2026 review): the target grid is built knowing all 25 cards, but a player sees one card
at a time, so with the core on total ÷ target near-perfect play scored about 110 and only the oracle reached 200. The
core is now full at the near-perfect bots' median hand points (the arcade standard's rule for an open-ended core): **68**
on room seeds 0–59 (64 on fresh seeds 10000–10059). The HUD shows it as FULL AT 68.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–59, median (p10–p90) | 81 (44–120) | 156 (107–192) | 170 (135–197) | 186 (148–200) | 192 (159–200) | 186 (149–200) | 200 |
| hand points, median | 26 | 51 | 57 | 63 | 68 | 65 | 154 |
| all 25 placed | 0/60 | 43/60 | 60/60 | 60/60 | 60/60 | 60/60 | 60/60 |
| 10000–10059, median | 85 | 149 | 169 | 184 | 188 | 192 | 200 |

The bots place by sight (each empty square valued by the hands it makes now and what it keeps open: a suit gathering
for a flush, repeated ranks, a run staying close), about 2.1 s a card at the average level; flawless places by the
target grid.

## Assumptions

- Near-perfect and elite tie within noise: the skill is reading which lines to build, and the bots' judgement only
  goes so far. The ceiling (flawless) knows the target grid, which no player can see.
- Totals past 68 hold the core at 160; a strong player often gets there.
