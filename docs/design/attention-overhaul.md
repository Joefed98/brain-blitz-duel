# The Attention overhaul (phase 2 step 4, 15 Nov 2026)

Joe's agreed overhaul of the six Attention games (reviews: `docs/design/game-reviews/attention.md`; concepts: PR #427;
art standard: PR #423's ART-DIRECTION). Three stages: the look and the game changes (stage 1, this file), the effects
with the effects kit (stage 2, after #422), the levels with the difficulty framework (stage 3).

## The art pipeline

1. `bun scripts/attention-art/outlines.tsx` draws every piece with the app's own components (`scripts/attention-art/pieces.tsx`)
   in headless Chromium and samples each filled or stroked shape into polylines (transforms applied; translucent gloss
   and shade layers left to the light). It writes `$JZ_TMP/attention-outlines.json` with the palettes.
2. `python docs/design/attention-overhaul/source/pieces.py [groups]` (Blender `bpy` 5.3 from PyPI, Cycles, `jzlib.py` /
   `sprites.py` from the Number overhaul) builds each piece as real objects: each fill a thin extruded layer with a
   rounded edge in drawing order, each stroke a round tube, the palette's part in enamel; renders it on a transparent
   film through an orthographic camera in soft, even studio light, colour-true (a flat enamel face reads within about
   2 L* of its palette colour; `JZ_EXPOSURE` −3.35 on the Standard view). Output `public/attention/<game>/<name>.webp`
   (about 650 KB for all six games). Light: a product-shot studio world seen only in reflections (dark straight
   above so flat faces keep their colour and never glare, bright towards the horizon so every curve and bevel catches a
   crisp highlight), the lights never seen in a reflection; enamel under a glossy clear coat on a softly domed body (a
   blurred mask of the piece's own outline drives the bump), polished metals. Groups: `eagle tiles sweet reef shelves rockpool tally felt pair cards maze bomb`.
3. `src/components/puzzles/attention/attentionArt.ts` names every file; `src/polish-attention/attention-overhaul.css` the
   surfaces and the champagne / navy controls (`--jz-navy`, `--jz-navy-edge` in tokens.css).

## Legibility (every dealt pair)

`src/lib/duel/attentionPalette.data.ts`: colours chosen in CIE L*a*b*. A colour difference a player must see differs by
at least 12 L* (`MIN_LIGHTNESS_GAP`), so it reads without hue; turns are at least 30° (Eagle Eye's look-alikes exactly
45°); sizes at least 15 % apart; shapes differ by silhouette. Harder levels (stage 3) will use more differences, never
fainter ones. `attention-overhaul-check` proves it on every dealt pair.

## Stamps (attentionOverhaul.ts, the `attentionOverhaul` deal layer)

| Game | Stamp | What changes | Scoring |
|---|---|---|---|
| Double Take | spotRev 4 | The picture waits for Next / Done; colour changes legible | spotRev 3's |
| Tally | countRev 7 | Spread trays (no overlaps at any size), tap to mark, legible colours | countRev 6's |
| Matchmaker | pairRev 4 | Five legible colours, six shapes, a third card skips the flip-back | pairRev 3's |

Eagle Eye, Labyrinth and Bomb Defusal change look, help and input only in stage 1 (no stamp). Checks written for the
older stamps pin them with `pinPreAttentionOverhaul(true)`.

## Sounds

`docs/sound-cues/attention-elevenlabs.md`: every action, what is kept, and one ElevenLabs line for each sound wanted.

## Answer reveals

Each game's own Reveal (inside AnswerReveal, the order #422's shared reveal keeps): one board at a time with tabs, your
answer against the right one with found / wrong / missed marked and named in a key, the numbers that explain the score as
big tiles (`src/components/puzzles/attention/RevealParts.tsx`). Double Take's differences and Bomb Defusal's steps are
small pictures, not text lists. Bomb Defusal left the automatic Solution / Yours switch (its step track shows both).
Before and after shots: `docs/design/pages-review/attention/GALLERY.md`.

## Intros and help

The help lines (instructions.ts) and the intro stills describe the new behaviour: Double Take's Next and the hidden
7th, Tally's marks (the still shows a spread tray with one mark), Labyrinth's backtracking and controls, Bomb Defusal's
"nothing reacts until DEFUSE", Matchmaker's quick flip-back (the still uses the new cards). All six intro demos were
already stopped (REVISED_PUZZLE_DEMOS), so the stills are what players see until demos are re-recorded.

## Challenges and stars (re-checked against the new Normal)

No challenge or star threshold changed. Every Classic challenge of the three re-stamped games (Double Take, Tally,
Matchmaker: 8) is met by a perfect run on the new stamps on three seeds (attention-overhaul-check section 10); Eagle Eye,
Labyrinth and Bomb Defusal play exactly as before in stage 1. The Classic star stays at 175 (the scoring is unchanged).

## Image budget

Compressed WebP, sized for the largest display (3–5× the piece's box): Eagle Eye 76 KB, Double Take 304 KB, Tally
97 KB, Labyrinth 4 KB, Bomb Defusal 57 KB, Matchmaker 111 KB; 649 KB in all. attention-overhaul-check fails any game over
400 KB.

## Effects (stage 2, after #422)

Every moment goes through the shared effects kit (`gameFx`) on the tapped piece only, or the game's own small helper
(`src/components/puzzles/attention/attentionFx.ts`: each moment's own sound slot, with a library stand-in until Joe's
file lands). The board never shakes: Double Take's arena shake and Labyrinth's board shake are gone, so a miss or a wall
answers on that square or the trail's end alone. Moments that the kit already sounds (the rising combo tone, the
count-up ticks) use the kit's shared sound and have no slot of their own. Every frame step pip in the Attention games
fills in champagne gold. The reveals' numbers count up (`FxCountUp`), Eagle Eye's missed eagles pulse once, and Tally's
counted shapes light in turn with "So close: 11, you said 12" for one off. Clips: the gallery's "Stage 2" section.
attention-overhaul-check section 11 proves the slots, the moments and the removed shakes.

## Levels (stage 3, after #432)

Every Attention game offers Easy, Normal, Hard and Expert. Every lever lives in one data file,
`src/lib/levels/attentionLevels.data.ts`; the level registry (`src/lib/levels/gameLevels.ts`) takes its settings from it,
and the games read the same rows through `src/lib/duel/attentionLevels.ts`. A Normal deal is byte for byte today's;
rated play and the Daily stay Normal (the framework). A level's deal is made in `attentionLevels.server.ts`, after every
deal layer, only when the level isn't Normal; the puzzle carries `level` and its own `timeLimitMs`, and graders read
both from the stored puzzle. No clock passes 120 s.

| Game | Easy | Normal | Hard | Expert |
| --- | --- | --- | --- | --- |
| Eagle Eye | 4×4, 5×5, 6×6; 4–7 targets; 30 % look-alikes | 5×5, 6×6, 7×7; two facings on grid 3; 60 % | 6×6, 7×7, 8×8; two facings from grid 2; 75 % | three 7×7; two facings on every grid; 80 % |
| Double Take | 6×5, 5 a picture, colour and shape only, no hidden | 8×6, 6 + hidden | 8×6, 7 + hidden, subtler colours (still ≥ 12 L*) | 8×8, 8 + hidden, turns weighted up, 75 s |
| Tally | trays 25 / 40 / 55, 1 near-miss group | 50 / 80 / 110 / 50, 2 groups | 3 groups, a closer comparison | 60 / 90 / 110 / 60, two-colour questions, no marks, 75 s |
| Labyrinth | 13×15, route 40–70 | 19×23 (today) | 21×27, route 120–180, 75 s | 21×27, route 150–240, the exit hidden until 4 squares away, 90 s |
| Bomb Defusal | 5 wires, 4 steps, 4 clues | 7 wires, 6 steps (today) | 7 wires, 7 steps, 7–8 clues | 8 wires, 8 steps, 8–9 clues, a wrong step explodes at once, 120 s |
| Matchmaker | 8 pairs, 4 columns, 900 ms | 15 pairs (today) | 18 pairs, 6 columns, 500 ms, 4 shapes | 21 pairs, 6 × 7, 400 ms, 120 s |

Eagle Eye is the one Normal that changes: `scanRev 5` deals every level, Normal included, on a 60 s clock (Joe's
brief), its grids and every other rule scanRev 4's. Bomb Defusal's Expert carries `bombInstant: 1`: each step is checked
live on the server (`checkPuzzleMoves`, the word games' checker: only "still live" and the step count come back, never the
answer); the first wrong step ends the round, and there is no Reset. Matchmaker's Hard and Expert keep a finish's extras in
full only up to 6 misses, none from 14 (memory is the skill). On a level with no hidden seventh (Double Take's Easy), its
20 points join the clean bonus, so a flawless run is 200 at every level.

**One answer.** Labyrinth's mazes are perfect (one route between any two squares); Double Take's pictures are kept only
when their panels differ in exactly the dealt ways; Eagle Eye's and Tally's answers are counted from the dealt board;
Matchmaker's faces are each dealt twice; Bomb Defusal's level panels come from banks (`bombLevelsBank.server.ts`, 300 Easy,
200 Hard, 120 Expert; `bun scripts/bomb-levels-bank.ts`, byte for byte from their seeds, `--check`) whose every card is
proved by search over all orders (`bombLevels.server.ts`: one order, the stored one, every clue needed).
`attention-levels-check` proves all of it, the clocks, the legibility minimums at every level, 200 for a flawless run at
every level, Expert's live check, and that Expert is humanly possible.

**Measured** (`bun scripts/level-tune.ts <game> --level=all --seeds=40`, the shared tool; the kits' Near-perfect, the
elite bot): see the stage 3 report. The kits learned the levels' real costs (a bigger board takes longer to search and is
easier to slip on; more look-alikes or near-miss groups cause more slips; a hidden exit is followed into more dead ends;
a longer bomb takes much longer to reason out); every Normal keeps today's figures exactly.

**Humanly possible.** A person-like solver (scripts/attention-levels-lib.ts) works out every Expert bomb in the bank
within a few dozen orders tried in the head (median 19, at most 99), and reaches Expert's hidden exit, reading the walls
and checking the far edges nearest first at 0.2 s a square, in 36–71 s of the 90 on 30 seeds. The elite kit finishes most
Expert boards of every game.

**Intro demos.** Recorded on each game's intro example by `scripts/attention-demos-record.ts` (a flawless run played by
touch on a local dev server, the app's own save request caught and aborted: nothing is written), kept in
`scripts/fixtures/attention-demos.json`, proved by `attention-demos-check` (the example deal exactly, the server's grade
exactly, the demo rules), and saved after the final merge by the manual "Save intro demos" workflow through
`scripts/attention-demos-save.ts`. Older demos stop: the phone's presentation tag (`ATTENTION_OVERHAUL_DEMOS`) and the
server's stamp rule (`attentionDemoPlays`).
