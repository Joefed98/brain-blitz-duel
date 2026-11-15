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
   (~0.9 MB for all six games). Groups: `eagle tiles sweet reef shelves rockpool tally felt pair cards maze bomb`.
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
