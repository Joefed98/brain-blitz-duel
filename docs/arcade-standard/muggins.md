# Muggins on the arcade scoring standard (mugginsRev 1, 1 Nov 2026)

A new Arcade game in the Cards & Board group, born on the standard: `muggins`, solo dominoes, a 90 s run (93 s round
clock). Sim `src/lib/arcade/cards/muggins.ts`, art `muggins.renderer.ts` (cream tiles with pips on green baize, its own
screen fill `mugginsFill.renderer.ts`), stage `src/puzzles/muggins.tsx`, replay `replayMugginsRun`.

## Rules

- A double-six set (28 tiles). A seeded starting tile is laid; the player holds seven and the other twenty form the draw
  pile, in a seeded order: the same start, hand and pile for everyone.
- Lay a tile on either open end of the line where one half matches (no spinner). Whenever the two open ends add to 5,
  10, 15 or 20, that total scores. A double at an end counts both halves (it stands crosswise). A lone starting tile
  counts its pips (display only: the start never scores).
- With no legal play, **Draw** takes one tile (Draw is refused while a tile fits).
- The round ends when the hand is empty, at the buzzer, or when the pile is empty and nothing can be played.
- **A draw is final** (the follow-up, closing the peek): it can't be undone, **Undo** (kind 3) takes back plays only
  back to the latest draw, and **Reset** (kind 4) goes back to the deal before any draw and only to just after the latest
  draw once one is made (itself undoable). So no one can draw, look and take it back: the pile stays hidden.
- **The player chooses the end.** Tap a tile, then tap (or drag it to) either end; every end it fits lights up gold with
  what laying it there would score ("LAY HERE · +10"). Play lays it on the higher-scoring end; the other end is always
  one tap away. Input: kind 1 a play (`a` the tile id 0–27, `b` the end: 0 left, 1 right), kind 2 Draw.

## The deal and the proof of 200

`mgBuildDeal(seed)`: the 28 tiles are shuffled from the seed and kept only when a bounded search (plays tried
highest-scoring first, draws forced, knowing the pile) finds a witness that empties the hand with at least 55 points and
two big plays; otherwise the next shuffle on the same PRNG stream is tried. Cached per seed and built while RoundIntro
is up. cards-solitaire-check replays the witness through the server's replay to exactly 200 on 460 seeds.

## Scoring (200)

| Part | Max | How |
| --- | --- | --- |
| Muggins points | 150 | a straight line, full at 55 points: just above the best levels' median (50) with the pile hidden (65 before the follow-up, set when the bots could peek) |
| Hand cleared | 20 | every tile played before the buzzer |
| Speed | 20 | hand cleared only: full by 19 s (the near-perfect median clear), 0 at the buzzer |
| Big plays | 10 | 5 for a single play scoring 15 or 20, up to 2 |

## Skill bands, before → after (`bun scripts/cards-bands.ts muggins --seeds=60 --from=10000`, fresh seeds)

| Level | Before (peeking) | After | Points after (median) | Cleared after |
| --- | --- | --- | --- | --- |
| Weak | 103 | 100 | 35 | 27/60 |
| Average | 128 | 132 | 40 | 42/60 |
| Good | 142 | 155 | 50 | 33/60 |
| Great | 148 | 155 | 50 | 38/60 |
| Near-perfect | 194 | 158 | 45 | 46/60 |
| Elite | 200 | 155 | 45 | 49/60 |
| Flawless | 200 | 200 | 65 | 60/60 |

Closing the peek removed what separated the top: no player can see the pile now, and the points a hand earns depend on
the tiles the pile happens to give. Better players clear more often and faster, but score no more points, because an
emptied hand ends the round and its scoring. So point medians run only from 35 to 50, the core can't spread the levels
to Joe's targets, and good to elite sit together at 155–158. The bots (`scripts/arcade-skill-bands/bots/muggins.ts`)
look 1 (weak, average) to 4 (near-perfect, elite) plays ahead through their own hand, valuing an emptied hand at what it
pays and a forced draw while time is left; deeper searches measured no better. Options for Joe (rule changes, not made
here) are in the PR.
