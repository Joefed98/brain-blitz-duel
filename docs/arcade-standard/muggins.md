# Muggins on the arcade scoring standard (mugginsRev 1, 1 Nov 2026)

A new Arcade game in the Cards & Board group, born on the standard: `muggins`, solo dominoes, a 90 s run (93 s round
clock). Sim `src/lib/arcade/cards/muggins.ts`, art `muggins.renderer.ts` (cream tiles with pips on green baize, its own
screen fill `mugginsFill.renderer.ts`), stage `src/puzzles/muggins.tsx`, replay `replayMugginsRun`.

## Rules

- A double-six set (28 tiles). A seeded starting tile is laid; the player holds seven and the other twenty form the
  draw pile, in a seeded order: the same start, hand and pile for everyone.
- Lay a tile on either open end of the line where one half matches (no spinner). Whenever the two open ends add to 5,
  10, 15 or 20, that total scores. A double at an end counts both halves (it stands crosswise). A lone starting tile
  counts its pips (display only: the start never scores).
- With no legal play, **Draw** takes one tile (Draw is refused while a tile fits).
- The round ends when the hand is empty, at the buzzer, or when the pile is empty and nothing can be played.
- **Undo** (kind 3: the position before the last play or draw, points included) and **Reset** (kind 4) as Pyramid's.
- Input: kind 1 a play (`a` the tile id 0–27, `b` the end: 0 left, 1 right), kind 2 Draw. The phone: tap a tile to
  choose it (again to let go), then an end (its badge or its end tile) to lay it there, or Play to lay it on the end that
  scores more; a chosen tile can also be dragged onto an end. Keyboard: D draws.

## The look

As the mockup: cream tiles with pips on green baize with gold stitching, the line across the middle (left to right,
snaking back into the next row when a row of six is full), under it the two end values (LEFT / RIGHT badges, a double
shown as 5+5) and the running sum between them (a Cards & Board pink ring when it scores), the hand along the bottom
(tiles that can be laid glow softly, the others dim; the chosen one lifts and glows gold), then Undo / Reset and the big
Draw and Play buttons in thumb reach. HUD chips: POINTS, PILE, BIG n/2.

## The deal and the proof of 200

`mgBuildDeal(seed)`: the 28 tiles are shuffled from the seed and kept only when a bounded search (1,500 positions,
plays tried highest-scoring first, draws forced) finds a witness that empties the hand with at least 65 points and two
big plays; otherwise the next shuffle on the same PRNG stream is tried. So every dealt seed lets perfect play reach
exactly 200. Witness points over seeds 0–299: min 65, median 70, max 110. A build averages ~16 ms here (worst ~150 ms),
so it is cached per seed and RoundIntro builds it while the intro is up. cards-solitaire-check replays the witness
through the server's replay to exactly 200 on 460 seeds; arcade-standard-check replays six more.

## Scoring (200)

| Part | Max | How |
| --- | --- | --- |
| Muggins points | 150 | a straight line, full at 65 points (the near-perfect skill-band median) |
| Hand cleared | 20 | every tile played before the buzzer |
| Speed | 20 | hand cleared only: full by 32 s (the near-perfect median clear, 31.6 s), 0 at the buzzer |
| Big plays | 10 | 5 for a single play scoring 15 or 20, up to 2 |

## Skill bands (`bun scripts/cards-bands.ts muggins --seeds=100`)

| Level | Median | p10–p90 | Points (median) | Cleared | Clear time (median) |
| --- | --- | --- | --- | --- | --- |
| Weak | 87 | 51–140 | 35 | 38/100 | 53.1 s |
| Average | 120 | 63–172 | 40 | 73/100 | 47.4 s |
| Good | 125 | 74–187 | 40 | 78/100 | 39.8 s |
| Great | 125 | 74–193 | 45 | 81/100 | 26.2 s |
| Near-perfect | 199 | 143–200 | 65 | 93/100 | 31.6 s |
| Elite | 200 | 183–200 | 70 | 98/100 | 25.4 s |
| Flawless | 200 | 200–200 | 70 | 100/100 | 15.3 s |

The core target: the near-perfect median is 65 points, so the core is full at 65. Near-perfect and elite players are
modelled as using Undo to look ahead (draw, look, take it back), so they know the pile and search whole lines (1,000 and
10,000 positions), paying for it in thinking time; great and below see only their hand (2–3 plays ahead). That
modelling is why the step from great to near-perfect is large and the top three sit close together: with the pile known,
a good line usually fills the core. Undo is unlimited and free, as in Free Cell and Mahjong; a later revision could
count undos if peeking should cost something (a decision for Joe).
