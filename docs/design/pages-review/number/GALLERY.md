# Number overhaul: gallery

Phase 2, step 4 (15 Nov 2026; docs/number-overhaul.md). Before (the game reviews' mid-play frames) and after, each at
390 × 844 in practice, mid-play. The pieces and surfaces are rendered in Blender
(`docs/design/number-overhaul/source/`) and drawn by the app with bold Archivo numbers over them.

## Stage 1: the new look and the game changes

| Game | Before | After |
|---|---|---|
| Counterweight | <img src="../../game-reviews/img/number/balance-2-mid.webp" width="200" alt="Counterweight before"> | <img src="img/balance-after.webp" width="200" alt="Counterweight after"> |
| Exact | <img src="../../game-reviews/img/number/target-2-mid.webp" width="200" alt="Exact before"> | <img src="img/target-after.webp" width="200" alt="Exact after"> |
| Operator | <img src="../../game-reviews/img/number/equation-2-mid.webp" width="200" alt="Operator before"> | <img src="img/equation-after.webp" width="200" alt="Operator after"> |
| Integer Pyramid | <img src="../../game-reviews/img/number/numpyramid-2-mid.webp" width="200" alt="Integer Pyramid before"> | <img src="img/numpyramid-after.webp" width="200" alt="Integer Pyramid after"> |
| Brimful | <img src="../../game-reviews/img/number/measure-2-mid.webp" width="200" alt="Brimful before"> | <img src="img/measure-after.webp" width="200" alt="Brimful after"> |
| Checkout | <img src="../../game-reviews/img/number/checkout-2-mid.webp" width="200" alt="Checkout before"> | <img src="img/checkout-after.webp" width="200" alt="Checkout after"> |
| Ballpark | <img src="../../game-reviews/img/number/numline-2-mid.webp" width="200" alt="Ballpark before"> | <img src="img/numline-after.webp" width="200" alt="Ballpark after"> |
| Kakuro | <img src="../../game-reviews/img/number/kakuro-2-mid.webp" width="200" alt="Kakuro before"> | <img src="img/kakuro-after.webp" width="200" alt="Kakuro after"> |

More frames:

| Checkout's bust (checkoutRev 3) |
|---|
| <img src="img/checkout-bust-after.webp" width="200" alt="Checkout bust"> |

Clips (stage 1 plays the existing motion; the effects kit's pour and dart arc come in stage 2):

- [Brimful's pour](clips/measure-pour.mp4)
- [Checkout's dart](clips/checkout-dart.webp)

## The answer reveals

Each game's own reveal, redesigned (Joe, 15 Nov 2026): the solution drawn large, one board at a time with numbered
tabs (right, not right, not reached; it opens on the first not right), Yours against the Solution with what you missed
or got wrong highlighted, short plain labels, the numbers that explain the score as chips, and pictures in place of
text lists (Brimful's moves as jugs, Exact's route as tiles, Checkout's darts as chips, Ballpark's markers joined to
their true spots). Built on `src/components/puzzles/number/RevealParts.tsx`. Before: today's main (Ballpark's from the
game review's round-end frame); after: a part-played practice round at 390 × 844.

| Game | Before | After |
|---|---|---|
| Counterweight | <img src="img/balance-reveal-before.webp" width="200" alt="Counterweight reveal before"> | <img src="img/balance-reveal-after.webp" width="200" alt="Counterweight reveal after"> |
| Exact | <img src="img/target-reveal-before.webp" width="200" alt="Exact reveal before"> | <img src="img/target-reveal-after.webp" width="200" alt="Exact reveal after"> |
| Operator | <img src="img/equation-reveal-before.webp" width="200" alt="Operator reveal before"> | <img src="img/equation-reveal-after.webp" width="200" alt="Operator reveal after"> |
| Integer Pyramid | <img src="img/numpyramid-reveal-before.webp" width="200" alt="Integer Pyramid reveal before"> | <img src="img/numpyramid-reveal-after.webp" width="200" alt="Integer Pyramid reveal after"> |
| Brimful | <img src="img/measure-reveal-before.webp" width="200" alt="Brimful reveal before"> | <img src="img/measure-reveal-after.webp" width="200" alt="Brimful reveal after"> |
| Checkout | <img src="img/checkout-reveal-before.webp" width="200" alt="Checkout reveal before"> | <img src="img/checkout-reveal-after.webp" width="200" alt="Checkout reveal after"> |
| Ballpark | <img src="img/numline-reveal-before.webp" width="200" alt="Ballpark reveal before"> | <img src="img/numline-reveal-after.webp" width="200" alt="Ballpark reveal after"> |
| Kakuro | <img src="img/kakuro-reveal-before.webp" width="200" alt="Kakuro reveal before"> | <img src="img/kakuro-reveal-after.webp" width="200" alt="Kakuro reveal after"> |

## Stage 2: effects

To come once the effects kit is on main.

## Stage 3: levels

To come once the level registry is on main.
