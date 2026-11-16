# The Speed overhaul's art (phase 2 step 4, 15 Nov 2026)

Every piece and surface the six Speed games draw is rendered in Blender (Cycles, path traced, OpenImageDenoise) from
[blender/speed_art.py](blender/speed_art.py), on the concepts Joe picked ([game-concepts/speed.md](../game-concepts/speed.md),
PR #427) and the art standard ([cosmetics-redraws/ART-DIRECTION.md](../cosmetics-redraws/ART-DIRECTION.md), PR #423).

- **The look**: Speed's warm wood and orange on darker backgrounds; real materials with light on them (Joe's
  clarification, 15 Nov 2026): glass charms with a crisp highlight on their curve and a lit core, glazed enamel and
  lacquer with depth, hand-rubbed walnut with its grain, polished brass and champagne gold that shine. **No glare across a
  panel, tile or number and no glowing edges**: the studio's surround is dark, so a flat face looking up at the camera
  reflects darkness, while a compact key low from the top left and a cool rim low from the right put one sharp highlight
  on every curve, bevel and rim. **Numbers are never rendered**: the games draw them in code, big and bold, on the faces
  the sprites leave clear.
- **What each game uses** (per the concepts, A or B):

| Game | Look | Sprites |
|---|---|---|
| Flash | A waiting (dark smoked glass with faint etched rings in a polished walnut frame), B for the flash (the glass flooding an even warm gold) | `flash-wait`, `flash-gold`, `flash-frame` (a CSS border image) |
| Ascend | B: darker lacquered walnut, domed glossy onyx counters with polished brass rims, glazed gold domes once reached; bold Archivo 900 numbers, white on onyx, navy on gold | `ascend-board`, `ascend-disc`, `ascend-disc-done` |
| Don't Break the Chain | B: cut gems (a faceted round brilliant, a cushion-cut square, a trillion-cut triangle) in a lit glaze under a glassy coat, each facet with its own crisp highlight; six colours, each in all three cuts, in polished champagne bezels, on darker lacquered walnut | `chain-board`, `chain-<shape>-<colour>` (18) |
| Bonk | B: gophers in gold and red hard hats and the hedgehog in dark burrows on a darker dusk lawn; nothing but the sixteen burrows looks like one | `bonk-lawn`, `bonk-burrow`, `bonk-gopher-gold`, `bonk-gopher-red`, `bonk-hedgehog` |
| Tenfall | B's darker oiled wood with A's satin enamel tiles (cream digits, gold operators, blue minus, a gilded gold digit); bold flat labels, operators bigger; tiles come out of a chute below the counters | `tenfall-board`, `tenfall-tile-<look>` (5) |
| Pull! | A, the sun toned right down: a layered late-afternoon sky (soft high cloud, a hazy horizon glow, blue far hills behind two treelines), no glare; glazed orange clays, polished gold clays (shinier, with their glint); white gulls in three wing frames | `pull-sky`, `pull-clay-orange`, `pull-clay-gold`, `pull-bird-0/1/2` |

## The bounds rule

Every sprite is drawn into exactly the box the game's own drawn art used, so what is drawn is still what the game
counts: Bonk's targets in the 0.3-cell circle (every visible pixel inside it, `reach` ≤ 1 in the data file,
speed-overhaul-check), the clays in their 2R × 1.1R footprint, the birds in their hit ellipse plus 2 px, Tenfall's tiles
in the sprite box with the 76 × 64 tile at (2, 2), Ascend's counters in their disc. The canvas games keep their drawn
art as the fallback until the images load (and in checks, which have no DOM image).

## Rebuilding

```bash
python3 -m venv /tmp/bvenv && /tmp/bvenv/bin/pip install bpy==5.3.0
/tmp/bvenv/bin/python docs/design/speed-art/blender/speed_art.py /tmp/speed-art-png --samples=96
python3 -I docs/design/speed-art/blender/export.py /tmp/speed-art-png
```

`export.py` writes `public/speed-art/<name>.webp` and `src/lib/fx/speedArt.data.ts` (each URL carries its content hash,
so a redraw reaches every phone, the offline worker included). Keep the Blender working copies outside the project.

## Game changes in stage 1 (new stamps where play or scoring changes)

- **Tenfall `tenRev 6`**: resets cost on a finished run too (5 each after the first 4), never below 131.
- **Pull! `clayRev 10`**: the quick-hit window is full within 0.4 s of a clay's launch and gone at 0.6 s (was 0.25 s and
  0.37 s), every part's maximum unchanged; the HUD is two pills (clays, streak), gold, birds and doubles on the reveal.
- **Flash**: a clear "Done" moment at the end; the flash count stays hidden.
- **Don't Break the Chain**: "Chain broken" on the chain strip at the top, never over the board.
- **Ascend**: bigger discs where the board has room (44–60 px, never closer than 6 px).

Checks written for the stamps before pin them with `pinPreSpeedOverhaul(true)` (`src/lib/duel/speedOverhaul.ts`).

## Effects and sounds (stage 2, 15 Nov 2026)

On #422's kit (`src/lib/fx/kit.ts`): DOM pieces through `gameFx` (Flash's wrong shake and Done, Ascend's combo, wrong and
the shuffle's slide, the reveal's count-up), the canvas games through their renderers (Bonk's squash and flip rims) and
small CSS moments that end visible (`speed-overhaul.css`: Flash's time pop, Bonk's banner slam, Tenfall's "TEN!" burst).
Every hit sound plays on the tap (Flash, Ascend) or on the sim tick that applies it (Bonk, Tenfall, Pull!). The 28 new
sound slots and their placeholder files: docs/sound-cues/speed-overhaul.md; the recordings to make:
docs/sound-cues/speed-elevenlabs.md.

## Intro demos (15 Nov 2026)

Bonk, Tenfall and Pull! play a saved run on their intros. `scripts/fixtures/speed-demos.json` holds one elite-bot run each
on the stamps rooms deal (whackRev 4, tenRev 6, clayRev 10; `bun scripts/speed-demos-record.ts`), as the intro_demos
columns, each on the server's fixed intro example deal (the one deal the save can get sealed again), and
speed-demos-check proves each scores exactly what the server's replay says, unflagged. Nobody saves them to the database
by hand: the manual "Save intro demos" workflow runs `scripts/speed-demos-save.ts` against a dev server after the final
merge (`DEMOS_URL`, `INTRO_DEMO_KEY`, optional `DEMOS_GAMES=a,b`, `DEMOS_DRY=1` or `--dry`; flags win; OK or FAIL a game,
exit 0 / 1 / 2 for all saved / any failed / URL or key missing; it opens the dev server in headless Chromium and calls the
app's own practiceGenerateFn and saveIntroDemoFn from the page). The demo rules
(`introDemo.functions.ts`) now play only those stamps, so a demo recorded on clayRev 9 or tenRev 4–5 stops (the still
shows) until the saved run arrives. Flash, Ascend and Don't Break the Chain use touch demos on the fixed intro example, not
server-replayed runs, so they are not in the file. To get these runs the shared bot kit
(`scripts/puzzle-fairness/kits-engine.ts`) now plays Bonk's whackRev 4 and Tenfall's tenRev 6 on their own boards. Before,
it drove the older board and its runs desynced.

## Levels (stage 3, 15–16 Nov 2026)

Every Speed game offers Easy, Normal, Hard and Expert on the difficulty framework (#432). The settings are in one place,
`src/lib/levels/speedLevels.ts` (listed in `GAME_LEVELS`). Each deal stamps what its grader and stage need on the puzzle
(`flashMs`, `moveMs` / `timeLimitMs` / `descending`, `chainLevel`, `bonkLevel`, `tenLevel` with its stages,
`pullLevel`), so a later retune never changes a stored round, and a Normal deal is byte for byte today's.
`speedLevels.server.ts` deals them. Each level has one plain line on the round intro and the game page, the goal and
how-to lines follow the level, and the "?" help has a "Levels:" line.

| Game | Easy | Hard | Expert |
|---|---|---|---|
| Flash (60 s) | 5 flashes, 0–1 plain decoys each | 6–8 flashes, 2–3 decoys, ¾ gold-like | 8 flashes, **3–5 decoys, ¾ gold-like**, gold up 1 s |
| Ascend | 16 numbers 1–30, no moves, 60 s | 30 numbers, move every 10 s, **50 s, full speed by 25 s** | 30, highest first, move every 8 s, **45 s, full speed by 20 s** |
| Don't Break the Chain | 30 links, 3.5 / 3 / 2.5 s, no reverse, 45 s | 40 links, 2.5 / 2 / 1.6 s, reversed 21–25 and 31–35, 45 s | 50 links, 2 / 1.6 / **1.4** s, reversed 21–25 and 36–40, 6 charms, 60 s |
| Bonk (60 s) | up 1.1 → 0.8 s, 2 up, 2 flips, 5 % hedgehogs, pops 115 % apart | **0.72 → 0.5 s**, 3 up, 5–7 flips, 15 %, pops **50 %** apart | **0.67 → 0.45 s**, 4 up, 7–9 flips, 20 %, pops **50 %** apart |
| Tenfall (90 s) | 8 targets to 60, + and − only, 80 % speed | 10 to 200, ÷3 doubled, 115 % | **11 to 240**, every operator, **115 %** |
| Pull! (60 s) | 20 clays, 3 doubles, 6 birds, 80 % speed | 28 clays, 10 doubles, **24 birds** (some together), **145 %** | 30 clays, 12 groups with 3 triples, **32 birds**, **160 %** |

Bold values differ from the brief, tuned to Joe's rules (15 and 16 Nov 2026): a clear step up from level to level, Normal
comfortable for a strong player, Expert humanly possible to score well on. The comment beside each in `speedLevels.ts`
gives the brief's value and why.

**Tuning** (`bun scripts/speed-levels-tune.ts [game…] [--seeds=100]`): the deal and grade are the server's own (level-tune's).
"Human" is the elite player held to Joe's human limits: about 0.25 s to react and 0.15 s to move, slips at the arcade humans'
best rate (0.8 %), and on Flash lures tapped at a human rate (2 % on a plain decoy, 6–10 % on a gold-like one). "Elite" is
the 140 ms bot beside it. Ascend and Don't Break the Chain use level-aware players: search time grows with the discs left,
reshuffles and reversed runs cost a moment, and a link slower than its window breaks the chain. Averages on 100 deals:

| Game | Bot | Easy | Normal | Hard | Expert (best tenth) |
|---|---|---|---|---|---|
| Flash | human | 124 | 114 | 106 | 100 (123) |
| | elite | 188 | 186 | 187 | 183 |
| Ascend | human | 199 | 199 | 190 | 178 (181) |
| | elite | 200 | 199 | 199 | 193 |
| Don't Break the Chain | human | 174 | 160 | 141 | 119 (182) |
| | elite | 180 | 175 | 174 | 165 |
| Bonk | human | 148 | 146 | 140 | 129 (143) |
| | elite | 194 | 194 | 191 | 190 |
| Tenfall | human | 182 | 175 | 168 | 143 (163) |
| | elite | 183 | 181 | 181 | 166 |
| Pull! | human | 181 | 170 | 162 | 152 (175) |
| | elite | 199 | 199 | 198 | 196 |

The shared tool (`bun scripts/level-tune.ts <game> --level=all`, the puzzle kits; its best player for these games is
"near-perfect") on 40 deals, Easy / Normal / Hard / Expert: Flash 167 / 164 / 163 / 159; Ascend 199 / 197 / 196 / 193;
Chain 195 / 194 / 174 / 161; Bonk 169 / 166 / 162 / 161; Tenfall 183 / 178 / 180 / 161; Pull! 200 / 195 / 195 / 193.

Flash is reaction-bound: at a 250 ms reaction each flash scores about 115 on its curve, so its whole ladder sits lower.
speed-levels-check pins the ladder on 100 deals: each level at least 3 below the one before (Easy within 3 of Normal),
and Expert's best tenth at 140 or Normal's own average where that is lower.
