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
| Don't Break the Chain | B: round charms in clear glass over a lit core; square and triangle charms in a lit glaze under a glassy coat (flat-topped glass read black); six colours, each in all three cuts, in polished champagne bezels, on darker lacquered walnut | `chain-board`, `chain-<shape>-<colour>` (18) |
| Bonk | B: gophers in gold and red hard hats and the hedgehog in dark burrows on a darker dusk lawn; nothing but the sixteen burrows looks like one | `bonk-lawn`, `bonk-burrow`, `bonk-gopher-gold`, `bonk-gopher-red`, `bonk-hedgehog` |
| Tenfall | B's darker oiled wood with A's satin enamel tiles (cream digits, gold operators, blue minus, a gilded gold digit); bold flat labels, operators bigger; tiles come out of a chute below the counters | `tenfall-board`, `tenfall-tile-<look>` (5) |
| Pull! | A, the sun toned right down (a deep late-afternoon sky with haze over the treeline, no glare); satin orange clays, brushed gold clays (shinier, with their glint); white gulls in three wing frames | `pull-sky`, `pull-clay-orange`, `pull-clay-gold`, `pull-bird-0/1/2` |

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
