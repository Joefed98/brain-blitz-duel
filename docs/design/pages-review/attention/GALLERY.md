# Attention overhaul: gallery (stage 1, 15 Nov 2026)

Each game today (main, from the game reviews), the concept Joe chose (PR #427: A for five games, B for Matchmaker) and
the new frame from this branch, side by side, phone size 390 × 844, practice, mid-play. Then each game's answer reveal,
before and after.

Every piece is rendered in Blender from the app's own outlines (`scripts/attention-art/outlines.tsx` →
`docs/design/attention-overhaul/source/pieces.py`), so silhouettes, turns and facings are exactly as before. The
materials carry light, as the art direction asks: lacquered enamel with a clear coat over a softly domed body, polished
gold and pewter, lacquered oak, glossy rippled water, brushed gunmetal, glossy wire sleeves and domed caps. The light is a
product-shot studio: dark straight above, bright towards the horizon. A flat face reflects nothing and keeps its true
colour, with no glare across panels, tiles or numbers. Every curve and bevel catches a crisp highlight. Nothing glows.
Attention's pink stays in the background, and the actions are champagne gold and navy.

| Game | Today | Concept (chosen) | New |
|---|---|---|---|
| Eagle Eye | <img src="../../game-reviews/img/attention/symscan-2-mid.webp" width="200"> | <img src="img/concept-symscan.webp" width="200"> A | <img src="img/symscan-mid.webp" width="200"> |
| Double Take | <img src="../../game-reviews/img/attention/spotdiff-2-mid.webp" width="200"> | <img src="img/concept-spotdiff.webp" width="200"> A | <img src="img/spotdiff-mid.webp" width="200"> |
| Tally | <img src="../../game-reviews/img/attention/countup-2-mid.webp" width="200"> | <img src="img/concept-countup.webp" width="200"> A | <img src="img/countup-marks.webp" width="200"> |
| Labyrinth | <img src="../../game-reviews/img/attention/maze-2-mid.webp" width="200"> | <img src="img/concept-maze.webp" width="200"> A | <img src="img/maze-mid.webp" width="200"> |
| Bomb Defusal | <img src="../../game-reviews/img/attention/bomb-2-mid.webp" width="200"> | <img src="img/concept-bomb.webp" width="200"> A | <img src="img/bomb-mid.webp" width="200"> |
| Matchmaker | <img src="../../game-reviews/img/attention/pairmatch-2-mid.webp" width="200"> | <img src="img/concept-pairmatch.webp" width="200"> B | <img src="img/pairmatch-mid.webp" width="200"> |

- **Eagle Eye:** cast-pewter eagles with the bald eagle's white head and tail and a polished gold beak, turning gold once marked. Tiles are polished slate with a lit bevel and no pink glowing edge, which differs from concept A as agreed. The target chips are 56 px.
- **Double Take:** pillowed enamel pins with polished gold rims, on lacquered oak shelves and over glossy rippled water.
- **Tally:** flat-lit enamel tokens (Joe's choice over the concept's heap) on plum baize, spread with no overlaps. A tap leaves a champagne dot on the shape.
- **Labyrinth:** raised satin-metal walls on dark flagstone. The trail is a polished gold thread (dark gold edge, bright crown) rather than the concept's lit glow, as agreed. The arrows / joystick switch is in the game menu: <img src="img/maze-menu.webp" width="160">
- **Bomb Defusal:** brushed gunmetal casing with a panel seam, glossy braided wires on brass posts, and domed lacquer caps in steel bezels. Clues sit on numbered pips, with names as colour chips.
- **Matchmaker:** magenta lacquer backs with a raised gold foil cross-hatch and a medallion (concept B), navy lacquer faces with enamel symbols, and cards a third bigger.

Image sizes (compressed WebP, sized for the largest display): Eagle Eye 76 KB, Double Take 304 KB, Tally 97 KB,
Labyrinth 4 KB, Bomb Defusal 57 KB, Matchmaker 111 KB (649 KB in all).

## The answer reveals

Each game's own reveal, before (main) and after, from a part-played practice round that ran out of time (so right,
wrong and missed all show), 390 × 844, the whole reveal. Built inside today's AnswerReveal (the result card, then the
game's own Reveal), which is the order #422's shared reveal layout keeps, so it drops into that layout unchanged. Shared
parts: `src/components/puzzles/attention/RevealParts.tsx` (tabs for one board at a time, a key for the marks, big
number tiles).

| Game | Before | After | What changed |
|---|---|---|---|
| Eagle Eye | <img src="img/symscan-reveal-before.webp" width="220"> | <img src="img/symscan-reveal-after.webp" width="220"> | A tab per grid; the target shown big; found gold, wrong taps red, missed dashed, named in a key; Found / Wrong taps / Missed as tiles (no "✗" or "0 / 8 found" lines). |
| Double Take | <img src="img/spotdiff-reveal-before.webp" width="220"> | <img src="img/spotdiff-reveal-after.webp" width="220"> | Picture tabs, one panel at full width (Top / Bottom); each difference as a small before → after picture, found ringed gold, missed dashed; the hidden 7th starred; Found / Wrong taps / Hidden 7th as tiles. |
| Tally | <img src="img/countup-reveal-before.webp" width="220"> | <img src="img/countup-reveal-after.webp" width="220"> | A tab per tray; the tray large with every shape that counts ringed; Right count / You said / "Off by 5" or "So close: off by 1" as tiles; trays exact below. |
| Labyrinth | <img src="img/maze-reveal-before.webp" width="220"> | <img src="img/maze-reveal-after.webp" width="220"> | The maze large, your trail in gold over the dashed shortest route, a key; How far / Steps walked / Par as tiles. |
| Bomb Defusal | <img src="img/bomb-reveal-before.webp" width="220"> | <img src="img/bomb-reveal-after.webp" width="220"> | One step track: the right action beside yours on each row, each a picture of the wire (its colour, cut) or the button cap; the first wrong step ringed red, later ones dimmed; Steps right / Steps made as tiles. |
| Matchmaker | <img src="img/pairmatch-reveal-before.webp" width="220"> | <img src="img/pairmatch-reveal-after.webp" width="220"> | The whole board face up and large: pairs you matched bright with a gold edge, the rest dimmed; Pairs / Flips / Best streak / Gold as tiles. |

## Stage 2: the effects

Short clips (390 × 844 practice, MP4) of each game's key moments, played through the shared effects kit
(`src/lib/fx/kit.ts`) on the piece that was tapped. The moments are confirmed with small, quiet sounds, and there's one
proper moment at the end. Nothing shakes the board.

| Game | Clip | What happens |
|---|---|---|
| Eagle Eye | [symscan.mp4](clips/symscan.mp4) | Each marked eagle gets a soft press and its feather tick (`symscan.mark`); unmarking plays a lighter one. Submitting a grid flies its matching eagles off with a whoosh (`symscan.gridClear`). A grid with no wrong marks gets a quiet sparkle on the target (`symscan.cleanGrid`). The reveal pulses the missed eagles once (`symscan.missed`). |
| Double Take | [spotdiff.mp4](clips/spotdiff.mp4) | A find draws a pen circle on both pictures with its own chime (`spotdiff.found`). Two finds within 2 s step the tone up (the kit's combo). A miss is a short wrong on that square only (`spotdiff.miss`). The hidden 7th sparkles (`spotdiff.hidden`). Next slides the new picture in (`spotdiff.pictureOut`). |
| Tally | [countup.mp4](clips/countup.mp4) | Each key gives a click and a press (`countup.key`). A mark gets a tick and a dot (`countup.mark`). ENTER slides the next tray in (`countup.trayOut`). In the reveal, the counted shapes light one by one while the right count ticks up (`countup.revealTick`). One off reads "So close: 11, you said 12" and pulses softly (`countup.soClose`). |
| Labyrinth | [maze.mp4](clips/maze.mp4) | Each step makes a soft tick, a little higher past each junction (`maze.step`). Stepping back makes a lighter tick as the trail retracts (`maze.back`). A wall gives a dull bump and the trail's end flashes, with no board shake (`maze.bump`). A dead end's tip plays a falling note (`maze.deadEnd`). The exit traces the route (`maze.trace`). |
| Bomb Defusal | [bomb.mp4](clips/bomb.mp4) | A cut snips with sparks (`bomb.cut`). A press is a heavy click on the cap (`bomb.press`). Each step fills the next pip of the step bar in champagne with a relay tick (`bomb.step`). DEFUSE stops the timer with its tone (`bomb.defuse`). In the reveal, the right order explodes or defuses. |
| Matchmaker | [pairmatch.mp4](clips/pairmatch.mp4) | Each turn gives a card flick (`pairmatch.flip`). A match lifts both cards with a chime (`pairmatch.match`), and from the second match in a row the kit's combo tone climbs. A miss is one soft wrong with a red outline on that card (`pairmatch.miss`). The gold pair has its own shimmer (`pairmatch.gold`). The finish is the card wave. In the reveal, Pairs and Best streak count up. |

The sounds without Joe's files yet play a library stand-in (`ATTENTION_SOUND_FALLBACKS` in
`src/components/puzzles/attention/attentionFx.ts`). A recording dropped in under its slot name replaces it.

## Stage 3: the levels

Each game's live stage at Easy, Hard and Expert (390 × 844 practice). Normal is the stage shown above. A bigger level
grows the board downwards; the goal line says the level's own counts.

| Game | Easy | Hard | Expert |
|---|---|---|---|
| Eagle Eye | <img src="img/levels/symscan-easy.webp" width="180"> | <img src="img/levels/symscan-hard.webp" width="180"> | <img src="img/levels/symscan-expert.webp" width="180"> |
| Double Take | <img src="img/levels/spotdiff-easy.webp" width="180"> | <img src="img/levels/spotdiff-hard.webp" width="180"> | <img src="img/levels/spotdiff-expert.webp" width="180"> |
| Tally | <img src="img/levels/countup-easy.webp" width="180"> | <img src="img/levels/countup-hard.webp" width="180"> | <img src="img/levels/countup-expert.webp" width="180"> |
| Labyrinth | <img src="img/levels/maze-easy.webp" width="180"> | <img src="img/levels/maze-hard.webp" width="180"> | <img src="img/levels/maze-expert.webp" width="180"> |
| Bomb Defusal | <img src="img/levels/bomb-easy.webp" width="180"> | <img src="img/levels/bomb-hard.webp" width="180"> | <img src="img/levels/bomb-expert.webp" width="180"> |
| Matchmaker | <img src="img/levels/pairmatch-easy.webp" width="180"> | <img src="img/levels/pairmatch-hard.webp" width="180"> | <img src="img/levels/pairmatch-expert.webp" width="180"> |

Labyrinth's Expert hides the exit until the trail is within four squares of it. Bomb Defusal's Expert has no Reset: the
first wrong step sets it off. Tally's Expert has no marks. Frames from `bun scripts/attention-art/level-shots.ts`.
