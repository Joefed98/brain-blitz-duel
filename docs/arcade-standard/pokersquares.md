# Poker Squares on the arcade scoring standard (pokerSquaresRev 1, 30 Oct 2026)

A new Arcade game in the Cards & Board group, born on the standard: `pokersquares`, 60 s run (63 s round clock).

## The stamp and the deal

`pokerSquaresRev 1` (`PS_REV`, spec `PS_STD_SPEC`, parts `pokerSquaresStdParts`, `src/lib/arcade/cards/pokerSquares.ts`).
Rooms deal any seed (`generatePokerSquares`). The sim builds the deal from it: 25 cards from a seeded deck, improved by a
seeded hill climb (20,000 steps: swap two squares, or a square with an unused card, kept when the lines it touches are
no worse; a line with no hand costs 24) until every row and column holds a pair or better (`psTargetGrid`; a fresh
attempt from the seed if not). Its total is the deal's target (median 154 over 200 seeds); its 25 cards are then
shuffled into the dealing order. Placing every card on its target square scores the target and ten made hands: 200 on
every seed, by construction (cards-check proves it on 200 seeds). Integer maths and the engine's PRNG only; the deal is
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
| Hand points (core) | 160 | `stdLine(160, total, target)`: total ÷ the deal's target × 160 (held at 160 past it) |
| Made hands | 40 | 4 for each row or column with a pair or better |

There is no speed part, so no "full by" time.

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0–59, median (p10–p90) | 53 (28–74) | 91 (67–110) | 100 (79–127) | 106 (91–122) | 110 (97–125) | 108 (90–141) | 200 |
| all 25 placed | 0/60 | 43/60 | 60/60 | 60/60 | 60/60 | 60/60 | 60/60 |

The bots place by sight (each empty square valued by the hands it makes now and what it keeps open: a suit gathering
for a flush, repeated ranks, a run staying close), about 2.1 s a card at the average level; flawless places by the
target grid.

## Assumptions

- The target is a strong grid, not the best possible one: a player can beat it (the core holds at 160).
- Near-perfect and elite tie within noise: the skill is reading which lines to build, and the bots' judgement only
  goes so far. The ceiling (flawless) knows the target grid, which no player can see.
