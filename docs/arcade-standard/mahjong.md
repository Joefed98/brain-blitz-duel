# Mahjong Solitaire on the arcade scoring standard (mahjongRev 1, 30 Oct 2026)

Arcade, **Cards & Board** group (`src/lib/duel/arcadeGroups.ts`; its tiles take the group's
`--group-cards` border). Dealt in rooms from the start. A 120 s run on a 123 s clock.

## The game

- 72 tiles in a four-layer stack (`MAHJONG_SLOTS`): 6 × 7, 4 × 5, 2 × 4 (offset half a tile) and 1 × 2 on top, laid
  out for a portrait phone. A tile is **free** when nothing lies on it and its left or right side is open; about 30 are
  free at the start.
- Faces (`src/lib/arcade/mahjong.renderer.ts` draws them in code, no font): dots, bamboo and characters 1–9, the four
  winds and the three dragons (34 faces). Each deal uses 30 of them: 6 dealt four times and 24 twice (seeded). A face
  matches only itself.
- **Built backwards** (`mahjongBuild`): from the full layout, two places free at that moment get the next pair's face
  and are taken away, until none are left. Played forwards that order clears the board, so every deal is fully
  clearable. Everyone in a room gets the identical stack; nothing random happens after the deal but a Shuffle.
- Input: kind 1 tap (`a` the tile; the phone picks the topmost tile under the finger as drawn), kind 10 Shuffle. Tap
  two free tiles with the same face to take them away; a tap on a blocked tile is refused (a red edge); a non-matching
  second tile takes the selection; tapping the selected tile again deselects it. The selected tile glows gold.
- **Shuffle** (bottom right corner, −5, loses No shuffles): the faces left are re-dealt onto the places left by the same
  backwards build, with the state's own PRNG (advanced only by a Shuffle), so the board is clearable again and the
  result is the same for the same seed and log. If the places left can't be cleared in any order (a lone stack), the
  tiles are first packed onto the lowest places of the layout, where they can (cards-board-check met 7 such dead ends
  in 39). The MOVES chip shows the free pairs on the board; at 0 it turns gold.

## Parts (200 in all)

| Part | Max | How it pays |
| --- | ---: | --- |
| Pairs (core) | 150 | `stdLine(150, pairs, 36)`: a straight line, full at all 36 |
| No shuffles | 20 | the same share of 20, only while no Shuffle has been used |
| Speed | 30 | cleared only: `stdSpeed(30, clear tick, 65 s, 120 s)`, full by 65 s, 0 at the buzzer |

A Shuffle costs 5 (`MAHJONG_SHUFFLE_COST`). Score = `stdFinal(core + clean + speed − 5 × shuffles, acted)`. The help
lists every part and ends "Together 200 points.".

### Assumptions (decisions for Joe)

- **No shuffles pays on the core's line** (20 × pairs ÷ 36), not a flat 20, so one tap can't take it.
- **About 72 tiles in four layers** is exactly 72; the layout is narrower than the classic turtle so it fits a portrait
  phone (tiles 56 × 74 world px).
- **Full by 65 s**, not "about 70 s": the near-perfect median clear time on the tuning seeds is 65.0 s (fresh 62.8 s).
- **Faces drawn in code**: the characters (一…九, 萬, 東 南 西 北, 中, 發) are stroke glyphs, so no font file or licence.

## Proof that every dealt seed reaches 200

The build order is the proof (`mahjongOracle`: two taps a pair). `generateMahjong` checks it through the sim before it
deals a seed (`mahjongBuildClears`). cards-board-check replays it through the server (`replayMahjongRun`) to exactly
200 on the 60 tuning and 200 fresh seeds and checks the build on 1,500 more; it also proves 439 Shuffles (39 from dead
ends, 7 of them packed) keep the faces left and leave a board their own build order clears.

## Skill bands (`bun scripts/cards-board-bands.ts`, the bots in `scripts/arcade-skill-bands/bots/mahjong.ts`)

The bots scan the free tiles: finding a pair takes less time the more pairs are on view; better players weigh what a
pair frees; a slip taps a wrong tile first; with no pair on view they Shuffle. Every run goes through the server's
replay.

Tuning seeds 0–59:

| Level | Score | Cleared | Clear time | Core / clean / speed / cost |
| --- | --- | ---: | --- | --- |
| Weak | 103 (94–113) | 0/60 | — | 91 / 12 / 0 / 0 |
| Average | 136 (117–146) | 0/60 | — | 120 / 16 / 0 / 0 |
| Good | 174 (140–179) | 43/60 | 110.0 s | 150 / 20 / 4 / 0 |
| Great | 189.5 (161–193) | 60/60 | 83.5 s | 150 / 20 / 19.5 / 0 |
| Near-perfect | 199 (173–200) | 60/60 | **65.0 s** | 150 / 20 / 29.5 / 0 |
| Elite | 200 (175–200) | 60/60 | 53.5 s | 150 / 20 / 30 / 0 |
| Flawless | 200 (200–200) | 60/60 | 29.2 s | 150 / 20 / 30 / 0 |

Fresh seeds 10000–10099: weak 103, average 136, good 172, great 190, near-perfect 200 (clear 62.8 s), elite 200,
flawless 200. The p10s of 173–175 at the top are runs that took a quad's wrong pair, met a dead end and shuffled.

## Look

Thick ivory tiles with ivory-on-jade layers along their bottom and right edges, slightly engraved glossy faces, each
layer lifted up and left and casting a shadow on the one below, on a jade-green mat with gold stitching over a dark
wooden table (the wood continues to the screen's edges, `mahjongFill`). Blocked tiles are slightly shaded; the
selected tile glows gold; a pair taken lifts and fades in gold; a Shuffle washes the mat gold. HUD chips across the top
(PAIRS n/36, MOVES, SHUF). The board is painted into a device layer keyed on the faces. Tile icon:
`public/tiles/mahjong.webp`.

## Checks

cards-board-check, arcade-standard-check (entry `scripts/arcade-standard/mahjong.ts`), arcade-room-identity-check
(`scripts/room-identity/mahjong.ts`), arcade-self-replay-check (entry `mahjong`), replay-check, arcade-fx-check,
tile-scenes-check, round-max-check, category-pool-check. The intro shows a still (no demo recorded).
