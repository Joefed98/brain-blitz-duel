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
- **The pile's next tile lies face up** (in the Draw button, marked NEXT; the same tile for everyone in the room). With no
  legal play, **Draw** takes it and turns over the one after (Draw is refused while a tile fits).
- The round ends when the hand is empty, at the buzzer, or when the pile is empty and nothing can be played.
- **A draw is final** (the follow-up, closing the peek): it can't be undone, **Undo** (kind 3) takes back plays only
  back to the latest draw, and **Reset** (kind 4) goes back to the deal before any draw and only to just after the latest
  draw once one is made (itself undoable). So no one can draw, look and take it back: the pile stays hidden.
- **The player chooses the end.** Tap a tile, then tap either lit end (its badge or its end tile) or drag the tile there;
  every end it fits lights up gold with what laying it there would score ("LAY HERE · +10"), and a tap on a lit end
  lays it on that end. Play lays it on the higher-scoring end; either end is always one tap away. Input: kind 1 a play (`a` the tile id 0–27, `b` the end: 0 left, 1 right), kind 2 Draw.

## The deal and the proof of 200

`mgBuildDeal(seed)`: the 28 tiles are shuffled from the seed and kept only when a bounded search (plays tried
highest-scoring first, draws forced, knowing the pile) finds a witness that empties the hand with at least 55 points and
two big plays; otherwise the next shuffle on the same PRNG stream is tried. Cached per seed and built while RoundIntro
is up. cards-solitaire-check replays the witness through the server's replay to exactly 200 on 460 seeds.

## Scoring (200)

| Part | Max | How |
| --- | --- | --- |
| Muggins points | 150 | a straight line, full at 55 points |
| Hand cleared | 20 | every tile played before the buzzer |
| Speed | 20 | hand cleared only: full by 19 s (the near-perfect median clear), 0 at the buzzer |
| Big plays | 10 | 5 for a single play scoring 15 or 20, up to 2 |

The core target, re-measured with the next tile face up: the near-perfect median is 45 points. Full at 45 put average,
good, great, near-perfect and elite all at a median of 155, so the core stays full at 55 (65 in the first commit, set
when the bots could peek).

## Skill bands (`bun scripts/cards-bands.ts muggins --seeds=60 --from=10000`, fresh seeds)

| Level | First commit (peeking) | Pile hidden | Next tile face up (full at 55) | Full at 45 (not kept) |
| --- | --- | --- | --- | --- |
| Weak | 103 | 100 | 100 | 116 |
| Average | 128 | 132 | 132 | 155 |
| Good | 142 | 155 | 146 | 155 |
| Great | 148 | 155 | 141 | 155 |
| Near-perfect | 194 | 158 | 141 | 155 |
| Elite | 200 | 155 | 150 | 156 |
| Flawless | 200 | 200 | 200 | 200 |

**Good through elite still sit within about 10 points of each other (141–150)**, as Joe asked to be told: Muggins is
for the catalogue review rather than further tuning. With one tile known, the stronger bots (`scripts/arcade-skill-bands/
bots/muggins.ts`: their hand and the face-up tile, 1–4 plays ahead) clear more often and faster, but the points a hand
earns still depend mostly on the tiles the pile happens to give, and an emptied hand ends the round's scoring.
