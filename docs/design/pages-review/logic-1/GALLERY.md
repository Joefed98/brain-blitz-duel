# Logic overhaul, session 1: gallery

Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour Flood and Minefield (phase 2 step 4). Frames are 390 × 844
practice rounds drawn by `bun scripts/shots/capture.ts`. Today: the game reviews' screenshots
(`docs/design/game-reviews/img/logic/`); concept: the render Joe picked (PR #429, `docs/design/game-concepts/logic/`).

## The look (second pass, 15 Nov 2026)

Every piece is rendered in Blender inside its concept's own scene: the same stage lights, materials and place on the
screen, with a camera framed on that one piece (`scripts/logic-art/render.py`, 47 WebP sprites in `public/logic-art/`).
Real materials with light on them: glass with a crisp highlight down its curve, glossy liquid, lacquer and enamel with
depth, oak with grain, stone with texture. No glare washes across a panel, tile or numeral (glass, liquid and drums take
one strip light along their curve instead of the studio's square windows), and every numeral is drawn sharp by the app.
Each game keeps its own background.

| Game | Today | Concept picked | New |
|---|---|---|---|
| Box Six (A, with B's light) | <img src="../../game-reviews/img/logic/sudoku-2-mid.webp" width="180"> | <img src="img/sudoku-concept-A.webp" width="180"> <img src="img/sudoku-concept-B.webp" width="180"> | <img src="img/sudoku-play-after.webp" width="180"> |
| Polypotions (A's glass, B's liquid, C's cork) | <img src="../../game-reviews/img/logic/tubes-2-mid.webp" width="180"> | <img src="img/tubes-concept-A.webp" width="180"> <img src="img/tubes-concept-B.webp" width="180"> | <img src="img/tubes-play-after.webp" width="180"> |
| Hanoi (A's oak, B's rings) | <img src="../../game-reviews/img/logic/tower-2-mid.webp" width="180"> | <img src="img/tower-concept-A.webp" width="180"> <img src="img/tower-concept-B.webp" width="180"> | <img src="img/tower-play-after.webp" width="180"> |
| Safe Cracker (A) | <img src="../../game-reviews/img/logic/safe-2-mid.webp" width="180"> | <img src="img/safe-concept-A.webp" width="180"> | <img src="img/safe-play-after.webp" width="180"> |
| Mosaic (A) | <img src="../../game-reviews/img/logic/nonogram-2-mid.webp" width="180"> | <img src="img/nonogram-concept-A.webp" width="180"> | <img src="img/nonogram-play-after.webp" width="180"> |
| Colour Flood (A) | <img src="../../game-reviews/img/logic/flood-2-mid.webp" width="180"> | <img src="img/flood-concept-A.webp" width="180"> | <img src="img/flood-play-after.webp" width="180"> |
| Minefield (A) | <img src="../../game-reviews/img/logic/minesweeper-2-mid.webp" width="180"> | <img src="img/minesweeper-concept-A.webp" width="180"> | <img src="img/minesweeper-play-after.webp" width="180"> |

The rendered pieces:

<img src="img/sprites.webp" width="700" alt="The 47 rendered sprites">

Image budget (the sprites each game loads): Box Six 2.9 KB, Polypotions 230.0 KB, Hanoi 68.6 KB, Safe Cracker 10.7 KB,
Mosaic 4.2 KB, Colour Flood 26.4 KB, Minefield 11.0 KB; 354 KB for all seven, each under the 400 KB a game.

**Look pass 2 (15 Nov 2026, with stage 2; the table above shows it):** Polypotions' tubes take concept A's proportions
(a 66 : 316 test tube, 82 % of its column, real space round each), smoked interiors and a faint lit glass wall, with no
box round the flask buttons; Box Six's tiles are concept A's lacquer seen through a close camera under B's light, so a
soft sheen falls across each dark tile and its bevel shows (no hard reflections); Hanoi's posts are thicker turned oak
(radius 8, rendered at twice the resolution) and its rings concept B's candy glass seen at B's camera lean, their glossy
top face over the rounded front.

## The answer reveals

One board at a time (Box Six and Mosaic through the shared Solution / Yours switch), what you missed or got wrong marked
on the board, the key numbers behind the score as big figures over short labels, and pictures instead of text lists: the
shortest route as move pictures (Polypotions, Hanoi), your moves against the par route (Colour Flood), each try as a row
of drums (Safe Cracker) and Minefield's board as your run left it. Before: main.

| Game | Before | After: solved | After: timed out |
|---|---|---|---|
| Box Six | <img src="img/sudoku-reveal-before.webp" width="180"> | <img src="img/sudoku-reveal-after.webp" width="180"> | <img src="img/sudoku-timeout-after.webp" width="180"> |
| Polypotions | <img src="img/tubes-reveal-before.webp" width="180"> | <img src="img/tubes-reveal-after.webp" width="180"> | <img src="img/tubes-timeout-after.webp" width="180"> |
| Hanoi | <img src="img/tower-reveal-before.webp" width="180"> | <img src="img/tower-reveal-after.webp" width="180"> | <img src="img/tower-timeout-after.webp" width="180"> |
| Safe Cracker | <img src="img/safe-reveal-before.webp" width="180"> | <img src="img/safe-reveal-after.webp" width="180"> | <img src="img/safe-timeout-after.webp" width="180"> |
| Mosaic | <img src="img/nonogram-reveal-before.webp" width="180"> | <img src="img/nonogram-reveal-after.webp" width="180"> | <img src="img/nonogram-timeout-after.webp" width="180"> |
| Colour Flood | <img src="img/flood-reveal-before.webp" width="180"> | <img src="img/flood-reveal-after.webp" width="180"> | <img src="img/flood-timeout-after.webp" width="180"> |
| Minefield | <img src="img/minesweeper-reveal-before.webp" width="180"> | <img src="img/minesweeper-reveal-after.webp" width="180"> | (a run has no timed-out phase) |

375 × 667: <img src="img/sudoku-reveal-after-375.webp" width="120"> <img src="img/tubes-reveal-after-375.webp" width="120">
<img src="img/tower-reveal-after-375.webp" width="120"> <img src="img/safe-reveal-after-375.webp" width="120">
<img src="img/nonogram-reveal-after-375.webp" width="120"> <img src="img/flood-reveal-after-375.webp" width="120">
<img src="img/minesweeper-reveal-after-375.webp" width="120">

Clips of the hero effects (Polypotions' pour above all) come with stage 2, when the effects kit (#422) is on main.
