# Number overhaul: gallery

Phase 2, step 4 (15 Nov 2026; docs/number-overhaul.md). Today (the game reviews' mid-play frames), the concept Joe chose (A) and the new frame, each at
390 × 844 in practice, mid-play. The pieces and surfaces are rendered in Blender
(`docs/design/number-overhaul/source/`) and drawn by the app with bold Archivo numbers over them.

## Stage 1: the new look and the game changes

| Game | Today | Chosen concept (A) | New |
|---|---|---|---|
| Counterweight | <img src="../../game-reviews/img/number/balance-2-mid.webp" width="180" alt="Counterweight today"> | <img src="img/balance-concept.webp" width="180" alt="Counterweight concept A"> | <img src="img/balance-after.webp" width="180" alt="Counterweight new"> |
| Exact | <img src="../../game-reviews/img/number/target-2-mid.webp" width="180" alt="Exact today"> | <img src="img/target-concept.webp" width="180" alt="Exact concept A"> | <img src="img/target-after.webp" width="180" alt="Exact new"> |
| Operator | <img src="../../game-reviews/img/number/equation-2-mid.webp" width="180" alt="Operator today"> | <img src="img/equation-concept.webp" width="180" alt="Operator concept A"> | <img src="img/equation-after.webp" width="180" alt="Operator new"> |
| Integer Pyramid | <img src="../../game-reviews/img/number/numpyramid-2-mid.webp" width="180" alt="Integer Pyramid today"> | <img src="img/numpyramid-concept.webp" width="180" alt="Integer Pyramid concept A"> | <img src="img/numpyramid-after.webp" width="180" alt="Integer Pyramid new"> |
| Brimful | <img src="../../game-reviews/img/number/measure-2-mid.webp" width="180" alt="Brimful today"> | <img src="img/measure-concept.webp" width="180" alt="Brimful concept A"> | <img src="img/measure-after.webp" width="180" alt="Brimful new"> |
| Checkout | <img src="../../game-reviews/img/number/checkout-2-mid.webp" width="180" alt="Checkout today"> | <img src="img/checkout-concept.webp" width="180" alt="Checkout concept A"> | <img src="img/checkout-after.webp" width="180" alt="Checkout new"> |
| Ballpark | <img src="../../game-reviews/img/number/numline-2-mid.webp" width="180" alt="Ballpark today"> | <img src="img/numline-concept.webp" width="180" alt="Ballpark concept A"> | <img src="img/numline-after.webp" width="180" alt="Ballpark new"> |
| Kakuro | <img src="../../game-reviews/img/number/kakuro-2-mid.webp" width="180" alt="Kakuro today"> | <img src="img/kakuro-concept.webp" width="180" alt="Kakuro concept A"> | <img src="img/kakuro-after.webp" width="180" alt="Kakuro new"> |

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

## Stage 2: effects and the layout pass

Built with the effects kit (#422; docs/design/game-fx/README.md). Clips (MP4 or animated WebP, 1.8 MB in all):

- [Counterweight: a kettlebell lifted, hung and the beam settling](clips/balance-hang.mp4)
- [Exact: two tiles sliding together into the result](clips/target-merge.mp4)
- [Integer Pyramid: the last stone and the gold sweep, a rising note a row](clips/numpyramid-complete.mp4)
- [Brimful: the pour, lifting, tipping and the water settling (hero effect)](clips/measure-pour.mp4)
- [Checkout: the dart's flight, thud and the score counting down (hero effect)](clips/checkout-dart.webp)
- [Ballpark: the payoff, each true spot flying in from your marker](clips/numline-payoff.mp4)
- [Kakuro: a run completing](clips/kakuro-run.webp)

The layout pass (Joe, 15 Nov 2026) is in the "New" column above: Counterweight's instrument fills its wall, Operator's
panel runs from the goal line to Next, Ballpark's ruler is the big element under a compact card, Integer Pyramid's
tray in balanced rows. Operator's and Integer Pyramid's live effects:

| Operator: the running total and the try pips | Integer Pyramid: seams and cracks |
|---|---|
| <img src="img/equation-fx-after.webp" width="200" alt="Operator effects"> | <img src="img/numpyramid-fx-after.webp" width="200" alt="Integer Pyramid effects"> |

## Stage 3: levels

Each game's live round at each level, practice at 390 × 844, a few seconds in. Today's game is Hard for Counterweight,
Brimful, Checkout and Kakuro (Normal is a new, gentler deal on a new stamp) and Normal for the other four.

| Game | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Counterweight | <img src="img/balance-easy.webp" width="120" alt="Counterweight easy"> | <img src="img/balance-normal.webp" width="120" alt="Counterweight normal"> | <img src="img/balance-hard.webp" width="120" alt="Counterweight hard"> | <img src="img/balance-expert.webp" width="120" alt="Counterweight expert"> |
| Exact | <img src="img/target-easy.webp" width="120" alt="Exact easy"> | <img src="img/target-normal.webp" width="120" alt="Exact normal"> | <img src="img/target-hard.webp" width="120" alt="Exact hard"> | <img src="img/target-expert.webp" width="120" alt="Exact expert"> |
| Operator | <img src="img/equation-easy.webp" width="120" alt="Operator easy"> | <img src="img/equation-normal.webp" width="120" alt="Operator normal"> | <img src="img/equation-hard.webp" width="120" alt="Operator hard"> | <img src="img/equation-expert.webp" width="120" alt="Operator expert"> |
| Integer Pyramid | <img src="img/numpyramid-easy.webp" width="120" alt="Integer Pyramid easy"> | <img src="img/numpyramid-normal.webp" width="120" alt="Integer Pyramid normal"> | <img src="img/numpyramid-hard.webp" width="120" alt="Integer Pyramid hard"> | <img src="img/numpyramid-expert.webp" width="120" alt="Integer Pyramid expert"> |
| Brimful | <img src="img/measure-easy.webp" width="120" alt="Brimful easy"> | <img src="img/measure-normal.webp" width="120" alt="Brimful normal"> | <img src="img/measure-hard.webp" width="120" alt="Brimful hard"> | <img src="img/measure-expert.webp" width="120" alt="Brimful expert"> |
| Checkout | <img src="img/checkout-easy.webp" width="120" alt="Checkout easy"> | <img src="img/checkout-normal.webp" width="120" alt="Checkout normal"> | <img src="img/checkout-hard.webp" width="120" alt="Checkout hard"> | <img src="img/checkout-expert.webp" width="120" alt="Checkout expert"> |
| Ballpark | <img src="img/numline-easy.webp" width="120" alt="Ballpark easy"> | <img src="img/numline-normal.webp" width="120" alt="Ballpark normal"> | <img src="img/numline-hard.webp" width="120" alt="Ballpark hard"> | <img src="img/numline-expert.webp" width="120" alt="Ballpark expert"> |
| Kakuro | <img src="img/kakuro-easy.webp" width="120" alt="Kakuro easy"> | <img src="img/kakuro-normal.webp" width="120" alt="Kakuro normal"> | <img src="img/kakuro-hard.webp" width="120" alt="Kakuro hard"> | <img src="img/kakuro-expert.webp" width="120" alt="Kakuro expert"> |
