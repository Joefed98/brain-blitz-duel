# Research: reverting five puzzle looks, the outlines, and "puzzles are dark"

Read-only research on `/home/user/brain-blitz-duel` (HEAD = main, 18 Nov 2026) against the pre-overhaul worktree
`/home/user/old` (82f2f648, 16 Nov 2026). Nothing was modified or run.

## Which PR changed what

| Game | id | Overhaul PR (merged into the puzzle train #449) | Look commits |
|---|---|---|---|
| Lamplighter | `lightup` | **#435 Logic 2** (merge `e7369b60` / `275bc82a`) | `91497299` (stage 1 Blender look), `7e9e5722` (look redone, concept A), `e563ce14` (the one-glow light), `df593206` (effects), `5c98ebb5`→`60967b06` (reveals), `92aba156` (demos) |
| Topsy-Turvy | `gravity` | **#433 Pattern** (`d7b5789c` / `e85233da`) | `b5e66f3b` (scaffolding, sprite pipeline), `2f39da7f` (gravityRev 8 + look A), `8354680b`, `908e98bb` (reveal), `ca6b371c` (stage 2 effects, 3-layer tray), `7ae8d785` (levels) |
| Chroma Lines | `flow` | **#433 Pattern** | `6fa389a9` (beads + flowRev 3), `998fbb1d` (darker cells), `932e0414` (reveal), `08a5b8ef` (richness pass), `c3b04822` (no glow, kit effects), `95d09b54` (levels) |
| Pipeline | `pipes` | **#433 Pattern** | `5e938335` (Blender pipes + pipesRev 5), `65af426b` (no glow), `ff4c7190` (reveal), `fa6d054c` (continuous tubes), `ad5181c3` (stage 2, darker tiles), `e9c09b4a` (levels) |
| Ballpark | `numline` | **#431 Number** (`3f4f523b` / `8060f99a` / `898c3c44`) | `b2367043` (material pass), `2651f7a8`/`28bfdc26` (layout), `2d5cdf2f` (effects), `b636b6b5`→`e81b777f` (levels, demos, edge bump), `2b715616` |
| Checkout | `checkout` | **#431 Number** | `bdf36557`, `f2b48ce1` (reveals), `2d5cdf2f`/`895ac80f` (effects), `b636b6b5` |

Note the Number PR landed as "snapshot" commits: look, reveal, effects and level work are interleaved in the same
commits and the same files. Reverting by commit is not practical for Number; file-level restore + re-apply is.

Shared facts for every game below:

- `src/polish-layout/game-frame.css`, `src/polish-layout/puzzle-shared.css` and `src/design/tokens.css` are unchanged
  in effect (tokens only add `--jz-navy` / `--jz-navy-edge`). The darkening is all per-game CSS plus one Number rule.
- Every bundled / fixture intro demo is a **coordinate** demo (normalised taps on the play area): e.g.
  `src/lib/duel/bundledDemos/gravity.json` `{"action":"tap","args":{"at":{"x":0.382,"y":0.873}}}`. A look-only
  revert that keeps the grid/pad geometry keeps them landing; re-check with `bun scripts/shots/demo-taps.ts` after.
- Tiles for all five games were re-exported in the overhaul (`public/tiles/{lightup,gravity,flow,pipes,numline,checkout}.webp`
  and `src/components/app/gameIcons/tileScenes.data.ts`). After any look revert: `bun scripts/shots/tile-scenes.ts
  lightup gravity flow pipes numline` then `bun scripts/reveal-palette.ts` (tile-scenes-check, reveal-palette-check,
  celebrations-off.json may need re-recording as the tile hashes change).

---

## 1. Lamplighter (`lightup`) — #435 Logic 2

### Files that define the look

| HEAD | 82f2f648 |
|---|---|
| `src/puzzles/lightUp.tsx` (Board markup: `logic2-*` classes, `<img src=lightup-lamp>`, the `logic2-glow` layer) | `src/puzzles/lightUp.tsx` (Board markup: `logic-wall lightup-wall`, `logic-lamp-cell lightup-cell-lit`, `span.logic-lamp.bg-primary`) |
| `src/polish-logic/logic-2.css` lines 160–210, 416–447, 448–456, 687–750, 785–803 (new) | — |
| `src/puzzles/logicArt.ts`, `src/puzzles/logicArt.data.ts` (new), `public/logic-art/logic-cell.webp`, `lightup-cell-lit.webp`, `lightup-wall.webp`, `lightup-lamp.webp` (new, Blender) | — |
| `scripts/logic-art/render2.py` (`@sprite("lightup-cell-lit")` at line 577 etc.), `scripts/logic-art.ts` (new) | — |
| Old rules still on disk, now dormant (markup no longer carries their classes): `src/polish-logic/logic.css` 1074–1140, `src/polish-layout/polish-nov3-logic.css` 82–115, `src/polish-batch-p/batch-p.css` 452–466 and 906–930, `src/polish-b/d.css` 36–51 | same lines, live |

`git diff --stat 82f2f648 HEAD -- src/puzzles/lightUp.tsx src/polish-logic/logic-2.css src/puzzles/logicArt.ts src/puzzles/logicArt.data.ts`:
`lightUp.tsx 187 ++--`, `logic-2.css 863 +`, `logicArt.ts 27 +`, `logicArt.data.ts 40 +`. The four old CSS files are
byte-identical for Lamplighter (`logic.css`, `polish-nov3-logic.css`, `d.css` unchanged; `batch-p.css` lost only
Pattern rules).

### What changed in the look (old → new)

- Lit squares: old `radial-gradient(rgba(255,214,120,.4)…)` + `inset 0 0 12px rgba(255,190,80,.5)` warm pool per
  square (polish-nov3 then tinted them `#29261f`); new: the square is `background: transparent` over one blurred
  `<i class="logic2-glow">` layer (`filter: blur(6px)`, pools `rgba(255,196,110,.95)→rgba(200,104,24,.6)`, opacity by
  `lightFalloff()`), beams `display: none !important`.
- Lamps: old `span.logic-lamp.bg-primary` with `radial-gradient(#FFFBEA,#FFE08A,#F5B82E,#C68412)` and
  `box-shadow 0 0 12px 3px rgba(255,200,90,.9), 0 0 26px rgba(255,180,60,.55)`; new `<img src=lightup-lamp.webp>`
  at 88 % of the cell, `box-shadow: none !important`, clash = 2 px red ring.
- Walls: old near-black blocks with a 1.5 px white inner edge; new `lightup-wall.webp` (black lacquer tile).
- Frame: old `.logic-lamp-frame` `linear-gradient(#1E1A14,#110F0B)` (warm brown) with category tint; new (logic-2.css 416)
  `linear-gradient(180deg, #0d1210, #080b0a)` — colder and darker.
- Dark squares: old `#0f1012` recessed; new `logic-cell.webp` at 0.9 opacity (black lacquer).

### Built on top (what a look-only revert touches)

| Dependency | Safe to keep? | Adjust |
|---|---|---|
| Effects (`lightUp.tsx` Stage `useEffect` on `[data-wall][data-met]`, `[data-bulb][data-clash]`, `gameFx("wrong"/"tap")`, cues `lightup.clash/wallMet/dark`) | yes | keep `data-wall`, `data-met`, `data-bulb`, `data-clash` attributes on the restored markup |
| Reveal `LogicReveal` (`src/puzzles/logic2Reveal.tsx`) with `missed` ghost bulbs, `tallySets`, facts | yes | keep the `missed` prop; the ghost bulb can be the old span at 0.35 opacity |
| "N squares dark" hint (`logic2-hint`, `LIGHTUP_DARK_HINT`) | yes | untouched (outside the Board) |
| Levels (`src/lib/duel/logicOverhaul2Levels.ts` `lightup:` 86/113, `logicLevelDeal.server.ts`) | yes | no look dependency |
| Intro demos: `scripts/fixtures/logic2-demos.json` (`lightup` entry), stop rule `LOGIC2_PRESENTATION = "nov15-logic-overhaul-2"` in `src/components/puzzles/wordInput.ts` (`LOGIC2_DEMOS` includes lightup) | coordinate demo on the same grid | geometry unchanged → should still land; verify with demo-taps |
| `scripts/logic-overhaul-2-check.ts` lines 198, 201–207, 341–342: asserts `data-lit`, `lightup-lamp` in the board HTML, one `logic2-glow` pool per lit square, `data-bulb`/`data-wall` | **no** | rewrite 198 and 204–207 for the restored look (Joe's decision: the one-glow layer was his 15 Nov request; a revert removes it) |
| `scripts/logic-art-check.ts` / `logic-art.ts --check` | yes | keep the four WebPs and `logicArt.data.ts` entries even if unused (deleting them means re-running `bun scripts/logic-art.ts`) |
| Tile `scripts/shots/tile-scenes/logic.tsx:178` (`lightup: domScene` renders `Board`) | yes | re-export the tile |
| `logic2Reveal.tsx` CSS `logic2-reveal-lamps` | yes | — |

### Revert recipe (look only)

1. `git show 82f2f648:src/puzzles/lightUp.tsx > /tmp/old-lightUp.tsx`; in HEAD's `src/puzzles/lightUp.tsx` replace the
   body of `Board()` (HEAD lines 115–250) with the old `Board()` (old lines 78–170) **but**:
   - keep HEAD's props `missed`, the `data-bulb={cell}` / `data-clash` on the lamp span, `data-wall={cell}` / `data-met` /
     `data-over` on walls (the effects query them), and the `logic2-num`/`logic2-tick` spans may stay (they only style text);
   - drop the `<i className="logic2-glow">` layer, `lightAt`/`lightFalloff` usage, `LIGHTUP_ART` style, `logicArt` imports
     and `data-logic2="lightup"`; keep the old classes `logic-wall lightup-wall …`, `logic-lamp-cell lightup-cell-lit`,
     `logic-lamp … bg-primary` with the old inline `boxShadow`.
   - render `missed` as the old span with `opacity-35` (or keep an `<img>`; either is fine).
2. Delete from `src/polish-logic/logic-2.css` the Lamplighter blocks: 160–210 (`.logic2-lamps …`, keep `.logic2-hint`
   at 207+), the `.logic-lamp-frame` line in 414–419 (so the old warm frame from logic.css/batch-p returns), 428–447,
   the `.logic2-lamps` lines in 448–456, 687–750 (the glow), 785–803 (the solve animation; the old `logic-lamp-swell`
   in logic.css takes over). `lightFalloff()` can stay exported (unused) or go.
3. Fix `scripts/logic-overhaul-2-check.ts` 198 and 204–207 (see table); run `bun scripts/logic-overhaul-2-check.ts`,
   `bun scripts/logic2-demos-check.ts`, `bun scripts/logic-levels-check.ts --part=k/4`, `bun scripts/reduced-motion-end-check.ts`.
4. Re-export the tile; re-run reveal-palette.

No stamp or grading file is touched: Lamplighter's game change in #435 is none (its stamp did not move; levels are
deal-side).

---

## 2. Topsy-Turvy (`gravity`) — #433 Pattern

### Files that define the look

| HEAD | 82f2f648 |
|---|---|
| `src/components/puzzles/pattern/topsyBoard.tsx` (`TopsyBoardView` lines 206–300: the 3-layer tray `topsy-measure` / `topsy-flip` / `topsy-tilt`, `<TopsyCup>`, `<TopsyMarble>` imgs; `leanTopsyTray`, `flipTopsyTrayAway/In`, `dropTopsyBallHome`) | `topsyBoard.tsx` (`TopsyBoardView` lines 96–175: one `grav-tray` with `data-lean`, CSS-gradient balls and holes) |
| `src/components/puzzles/pattern/topsyArt.tsx` (new: sprite URLs, `TOPSY_SPRITES`, `TOPSY_ART_COLOURS`) | — |
| `src/polish-pattern/topsy.css` lines 95–247 (look A block), 249–340 (reveal) | `topsy.css` 91 lines |
| `public/pattern-art/gravity/*.webp` (19: 8 marbles, 8 cups, block, floor, frame), source `docs/design/game-art/pattern/source/gravity.py` | — |
| `src/polish-pattern/gravity.css` (unchanged; its tray/floor/block/ball gradients are now overridden by topsy.css's `.grav-tray.topsy-tray[data-topsy-board]` rules) | same, live |
| `src/puzzles/gravityMaze.tsx` (10-line diff: `ArrowPad modeSwitch={false}`, the 90 s catalogue clock; no look) | |

`git diff --stat`: `topsyBoard.tsx 601 +++--`, `topsyArt.tsx 41 +`, `topsy.css 255 ++`, `gravity.css 0`.

### What changed (old → new) — the colours Joe misses

- Balls: old `.grav-ball` `radial-gradient(circle at 34% 28%, #fff 0 7%, mix(var(--ball) 55%, #fff) 16%, var(--ball) 46%, mix(var(--ball) 55%, #000))`
  with `is-locked` white ring + coloured glow; new `<img class="topsy-marble" src="marble-<colour>.webp">` at 122.8 % of the
  ball box, `.topsy-ball { background: none; box-shadow: none }`, `filter: drop-shadow(0 2px 2px …)` only. The rendered
  marbles are desaturated/streaky (marble-yellow is a pale tan) — that is the "old colours were better" complaint; the
  `TOPSY_COLOURS` hexes themselves are unchanged for the first six (`#F5C542 #2FD4C4 #A97BFF #FF5FA2 #4F8BFF #FF8A3D`), two
  added for Expert (`#8BE04A`, `#E8ECF2`).
- Holes: old `.grav-socket` dark cup with a 2 px ring in `var(--ball)`; new `hole-<colour>.webp` image + hidden socket.
- Floor: old `radial-gradient(#232a3c, #181d2a)` (blue-grey); new `floor.webp` (slate `#12151e` in gravity.py).
- Blocks: old `linear-gradient(170deg,#9aa3b5,#6e778b,#4d5568)` (steel blue); new `block.webp` (grey stone).
- Tray: old `.grav-tray` gradient `#3a4052→#20242f→#161922` with the CSS `data-lean` tilt; new `frame.webp` gunmetal rim on `#0b0e16`,
  tilt through `leanTopsyTray()` (Web Animations on `.topsy-tilt`).
- Undo / Reset dyed navy + champagne (topsy.css 239–247).

### Built on top

| Dependency | Safe? | Adjust |
|---|---|---|
| gravityRev 8 rules, levels (`src/lib/levels/pattern/gravity.levels.ts`, `src/lib/duel/topsyLevelsBank.server.ts`, `topsy.ts`) | yes | none — the board draws `state.balls.length` balls; the old look handles 8 balls if `TOPSY_COLOURS` keeps 8 entries and the old CSS gradients use `--ball` (they do) |
| Effects (`leanTopsyTray`, `flipTopsyTrayAway/In`, `dropTopsyBallHome`, `topsyTiltSounds`, `OutOfTiltsBanner`) target `[data-topsy-tilt]`, `[data-topsy-flip]`, `[data-topsy-hole] [data-topsy-sunk]`, `[data-topsy-ring]` | yes if the 3-layer structure stays | keep `topsy-measure/flip/tilt` wrappers; only swap the piece art. If you also restore the old single-layer tray with CSS `data-lean`, drop `leanTopsyTray` calls (the old `lean` state) — more work, not needed for the colours |
| Reveal (`TopsyReveal`, `topsyRevealBoards`, tabs, route chips, `is-missed` rings: topsy.css 249–340) | yes | keep; `.is-missed::after` rings work on the old spans |
| Demo: `src/lib/duel/bundledDemos/gravity.json` (coordinate taps on the ArrowPad), stop rule `introDemo.functions.ts:216` (`gravityRev < 8` → null) | yes | pad geometry unchanged |
| `scripts/pattern-overhaul-gravity-check.ts` §9 (sounds, GOAL text, demo rule) — no sprite assertions in code; `pattern-overhaul-gravity-levels-check.ts` 246–252: `TOPSY_SPRITES.length === 19` and each marble/cup WebP exists with alpha; 318–323 counts `data-topsy-ring` | yes if `topsyArt.tsx` and the WebPs stay on disk | nothing, or delete those assertions if you remove the art |
| `scripts/reduced-motion-end-check.ts` lists `grav-lock-ring`, `topsy-star-pop` | yes | — |
| Tile `scripts/shots/tile-scenes/pattern.tsx:149` (`TopsyBoardView`) | yes | re-export |
| `src/polish-pattern/index.css`, `src/polish-b/b.css`, `batch-p.css` `.grav-well` (464) — old rules, still live | yes | — |

### Revert recipe (look only, keeps the 3-layer tray and all effects)

1. In `src/components/puzzles/pattern/topsyBoard.tsx` `TopsyBoardView` (206–300): remove `<TopsyCup index={hole} />`,
   the `<span className="topsy-sunk-wrap">…<TopsyMarble …/>` block, and `<TopsyMarble index={index} />` in the ball span;
   remove the `topsyArt` import. Keep every `data-topsy-*` attribute, `is-missed`, `live`, the wrappers.
   `dropTopsyBallHome` queries `[data-topsy-sunk]` — with no sunk marble it simply finds nothing (guarded `if (!wrap) return`),
   or re-add an empty `<span data-topsy-sunk>` so the kit's drop still plays on the hole.
2. In `src/polish-pattern/topsy.css` delete lines 95–235 (the whole "look A" block through `.topsy-ring.is-home`) and,
   for the old green-on-black buttons, 239–247. Keep 236–238's comment, and 249–340 (reveal). The old
   `.grav-tray`, `.grav-well`, `.grav-floor`, `.grav-block`, `.grav-socket`, `.grav-ball` rules in `gravity.css` and
   `batch-p.css` 464 then draw again. One new rule is needed because the layers moved: `.topsy-flip, .topsy-tilt
   { position: absolute; inset: 0; border-radius: 14px; }` and give `.topsy-tilt` the old `.grav-tray` background
   (copy gravity.css lines 4–16's `background`/`box-shadow` onto `.grav-tray.topsy-tray[data-topsy-board] .topsy-tilt`
   and set the outer `[data-topsy-board]` to `background:none; box-shadow:none; padding:0`), plus keep
   `.topsy-measure { position:absolute; inset:1.6%; visibility:hidden; pointer-events:none }` and the `.grav-well
   { position:absolute; inset:1.6% }` rule (HEAD 128–135) so the measured grid still matches the drawn one.
3. Optional: delete `public/pattern-art/gravity/*` and `topsyArt.tsx` — then also delete
   `pattern-overhaul-gravity-levels-check.ts` 246–252 and the `TOPSY_SPRITES` import at 67.
4. Run `bun scripts/pattern-overhaul-gravity-check.ts`, `pattern-overhaul-gravity-levels-check.ts`,
   `pattern-overhaul-demos-check.ts`, `reduced-motion-end-check.ts`, `phone-gap-check`; re-export the tile.

Mixed file: `topsyBoard.tsx` holds look (art imports), effects, sounds, Stage and Reveal; `topsy.css` holds look
(95–247) and reveal (249–340) in one file — the line ranges above are the split.

---

## 3. Chroma Lines (`flow`) — #433 Pattern

### Files

| HEAD | 82f2f648 |
|---|---|
| `src/components/puzzles/pattern/flowArt.tsx` (417 +): `FlowBead` (`<img bead-*.webp>` + `FlowSymbol` svg), `FLOW_CELL_URL`, `FLOW_WALL_URL`, `tubeBody()`/`tubeLayers()` (6-layer matte tube, no blur), `useFlowTubeFx` (kit effects) | `flowArt.tsx`: `FlowTubes` drew a blurred neon halo (`feGaussianBlur` filter `flow-neon-*`), body, highlight, loose-end cap, `flow-pulse` dash on join/solve |
| `src/puzzles/flow.tsx` (297 +): `FlowBoard` cells `style={{backgroundImage:url(cell.webp)}}`, walls `wall.webp`, dots `<FlowBead>` at 72 %; plus flowRev 3 gameplay, levels (`data-flow-grid`), marks, Reveal | `flow.tsx`: cells `border border-border bg-card` tinted `${tint}22` by the line's colour, walls a CSS hatch, dots `backgroundColor: GLYPH_COLOURS[c]` at 64 % with `flow-dot-joined` glow |
| `src/polish-pattern/flow.css` (220 lines, rewritten) | `flow.css` (132 lines: marble-gradient dots, `flow-dot-joined` glow, `flow-pulse`, `flow-board-solved::after` glow) |
| `src/polish-batch-p/batch-p.css` (Chroma rules deleted in `6fa389a9`: `.flow-halo`, the lit-tray cell glow, `.flow-dot` glow) | present |
| `public/pattern-art/flow/{bead-*,cell,wall}.webp` (14 beads), source `docs/design/game-art/pattern/source/flow.py` | — |

### What changed (old → new)

- Lines: old neon (`flow-halo` blurred copy at 1.5× width, colour body `tube.colour`, light streak); new `tubeLayers()`
  darkens the body (`tubeBody` clamps lightness to 0.56 × 0.92, saturation × 0.8) with rim layers — the check even
  asserts "the tube is deeper than the old neon line" (`pattern-overhaul-flow-check.ts:352`).
- Dots: old flat coloured discs with a glossy marble gradient and a glow once joined; new rendered beads with white symbols.
- Cells: old `bg-card` (`oklch(0.205 0.012 285)`, ~#2b2b30) with the line's colour tinting the whole square (`${tint}22`
  background, `${tint}55` border) — that tint is a big part of the old "colourful" feel; new `cell.webp` (rim `#15161c`,
  black recess), no tint. Commit `998fbb1d` is literally "darker cells".
- Walls: old `#3d4252` cross-hatch; new `wall.webp` (steel `#2f333c` with `#7d8494` hatch).

### Built on top

| Dependency | Safe? | Adjust |
|---|---|---|
| flowRev 3 rules (`flowCutsLines`, `flowTapClears`, `src/lib/duel/flow.ts`), levels (`src/lib/levels/pattern/flow.levels.ts`, banks, `data-flow-grid` non-square boards) | yes | keep `data-flow-grid` / `aspectRatio` in `FlowBoard` |
| Effects `useFlowTubeFx` (head slide, retract ghost, join light, solve sheen) query `[data-flow-tube]`, `[data-flow-head]`, `[data-flow-ghosts]`, `[data-flow-fx]`; needs `tubeLayers()` for ghost copies | partly | if you restore the old `FlowTubes` (neon), either keep the new SVG structure and swap only the layer colours (recommended: change `tubeLayers()` to the old body/highlight colours and re-add the halo path), or drop `useFlowTubeFx` and the old `pulse`/`solved` props return |
| Reveal (`flow.tsx` `FlowMarks`, pair chips `flow-pair-*`, `data-flow-missed`, `data-flow-empty`; flow.css 100–220) | yes | pair chips use `<FlowBead>`; keep `FlowBead` or swap for a coloured disc |
| Demo `src/lib/duel/bundledDemos/flow.json` (drags normalised on the board), stop rule `introDemo.functions.ts:219` | yes | same grid |
| `scripts/pattern-overhaul-flow-check.ts` 206–224 (bead/wall/cell WebPs in the HTML, no `feGaussianBlur`/`flow-halo`), 318–324 (no `drop-shadow`/`filter`/`blur` in flow.css rules on lines/dots; no `@keyframes` in flow.css; no blur/dash in flowArt), 348–352 (layer widths, deeper tube), 400–480 (effects) | **no** | these are the "no glow" rules Joe asked for on 15 Nov; a revert to neon must delete 216–224, 318–324, 348–352 and keep 400–480 only if the effect hooks stay |
| `pattern-overhaul-flow-levels-check.ts` 226 (bead WebPs exist), 232–238 (108 squares, aspect) | yes if WebPs stay | — |
| `scripts/replay-flow-check.tsx`, `puzzle-surface-check.tsx` (`flow:` surface rules) | yes | — |
| Tile `scripts/shots/tile-scenes/pattern.tsx:80` | yes | re-export |
| Sound: one join cue (`6fa389a9`) in `useFlowJoins` | yes | — |

### Revert recipe (look only)

1. `git checkout 82f2f648 -- src/polish-pattern/flow.css` then re-append HEAD's lines 75–220 (the `data-flow-grid`
   arena rules at 75–85, the reveal at 86–220). Delete the old `.flow-pulse`, `.flow-board-solved::after` keyframes only
   if you keep the kit's solve sheen (otherwise they come back harmlessly; reduced-motion-end-check already lists them? —
   it did at 82f2f648, so they are fine).
2. `src/puzzles/flow.tsx` `FlowBoard` (33–165): restore the old cell/wall/dot markup (old lines 31–150): the `filled`
   map and `tint` background, `flow-wall` hatch classes, `flow-dot` with `backgroundColor` and `flow-dot-joined`;
   keep HEAD's `data-flow-pair`, `data-flow-missed`, `data-flow-colour`, `data-flow-empty`, `data-flow-grid`,
   `marks`, and pass `live/solved/solveFx` to `FlowTubes` if you keep the new one.
3. `flowArt.tsx`: either (a) keep the new `FlowTubes` and set `tubeLayers()` to the old palette (body = `tube.colour`,
   rim `shadeHex(colour,-0.55)`, highlight `shadeHex(colour,0.6)` at 0.55) and re-add the `flow-halo` blurred path under
   the body — `useFlowTubeFx` keeps working; or (b) `git checkout 82f2f648 -- src/components/puzzles/pattern/flowArt.tsx`
   and restore `pulse`/`solved` props in `FlowBoard` (loses the kit effects; `c3b04822` reverted).
4. Restore the Chroma rules deleted from `src/polish-batch-p/batch-p.css` in `6fa389a9` (`git diff 82f2f648 HEAD -- src/polish-batch-p/batch-p.css`
   shows them: `.flow-halo`, the lit tray `.flow-board .flow-cell[data-puzzle-cell]:not(.flow-wall)`, `.flow-dot`).
5. Edit `scripts/pattern-overhaul-flow-check.ts` as in the table; run it, `pattern-overhaul-flow-levels-check.ts`,
   `pattern-overhaul-demos-check.ts`, `replay-flow-check.tsx`, `reduced-motion-end-check.ts`; re-export the tile.

Mixed file: `flow.tsx` has flowRev 3 gameplay (`flowCutsLines`, `flowTapClears` in the Stage), levels and the look in
one diff; only `FlowBoard`'s JSX is look.

---

## 4. Pipeline (`pipes`) — #433 Pattern

### Files

| HEAD | 82f2f648 |
|---|---|
| `src/components/puzzles/pattern/pipesArt.tsx` (259 lines rewritten): `pipeSprite()`, `pipeSpriteUrl()`, `pipeArtUrls()`, `PIPE_BLEED`, `PipeArt` = `<span class=pipe-turn>` + `<img class=pipe-sprite>` dry/wet, `pipe-wet` water-in box, spill img | `pipesArt.tsx`: `PipeDefs` (SVG gradients `-tube`, `-tube-wet`, `-flange`, `-hub`, `-pump`, `-water`), `PipeArt` SVG arms with rivets, channel, ripple |
| `src/components/puzzles/pattern/pipesFx.ts` (new: `pipeTurnFx`, `planWaterIn`, `planDrain`, `runWater`, `sourceBubbles`) | — |
| `src/puzzles/pipes.tsx` (520 +): `PipeTileView` with two-way gestures (long press / swipe / right-click), `networkLeakArms`, `showLeaks`, `pipesRevealView`, levels (`data-pipes-tall`) | `pipes.tsx`: tap-only `onTapCell`, `PipeDefs` per board, `leak` corner drip |
| `src/polish-pattern/pipes.css` (139 lines rewritten) | `pipes.css` (85: brushed-steel tiles `#2a3038→#1d2229`, board `#1a1f26→#0e1116`, lit-tile cyan rim, ripple, surge) |
| `src/polish-layout/polish-nov3-pattern.css` (64 lines deleted: the Pipeline network `drop-shadow` glow), `src/polish-batch-p/batch-p.css` (Pipeline tile/network glow rules deleted) | present |
| `public/pattern-art/pipes/*.webp` (33), source `docs/design/game-art/pattern/source/pipes.py` | — |

### What changed (old → new)

- Pipes: old SVG chrome (`#56606e→#adb8c5→#f6f9fc→#c8d1db`), wet tubes turning blue (`#0d4f86→#2f9be6→#d4f2ff`), rivets,
  flanges, red pump hub; new rendered chrome tube sprites (dry grey / wet blue glass) with bleed past the tile edge.
- Tiles: old brushed steel `linear-gradient(180deg,#2a3038,#1d2229)` with a 1 px `#303741` rim and a cyan rim when lit;
  new `tile.webp` on `#0c0b0f` (black). Board: old `#1a1f26→#0e1116`; new `#0d0b11→#060508` ("darker since stage 2").
- Glow: old lit tiles/network glowed (`polish-nov3-pattern.css` drop-shadow, batch-p's blue rim); new none (`65af426b`).

### Built on top

| Dependency | Safe? | Adjust |
|---|---|---|
| pipesRev 5 (two-way turns, `encodePipesTurnAnswer`, `decodePipesTurns`, `pipesAfterTurns`; `src/lib/duel/depth4/pipesTaps.ts`, `patternNov15.ts`), live leaks, levels (`src/lib/levels/pattern/pipes.levels.ts`, `pipes-expert-boards.ts`, `pipes-human.ts`) | yes | the `PipeTileView` gesture code and `turnDir` are input, keep; old `PipeArt` needs a `turnDir` to animate anticlockwise (old animated −90°→0 only) |
| Effects `pipesFx.ts` (`pipeTurnFx` on `.pipe-turn`, water-in via `.pipe-wet[data-wet]` box slides, bubbles, spill) | **tied to the sprite DOM** (`pipe-turn`, `pipe-frame`, `pipe-sprite`, `pipe-wet`, `pipe-wet-in`, `pipe-source`, `pipe-spill`) | restoring the old SVG `PipeArt` means dropping `planWaterIn/planDrain/runWater/sourceBubbles` calls in `pipes.tsx` (or re-targeting them: the old art had `waterRef` opacity fades) |
| Reveal (`pipesRevealView`, `data-wrong`, `data-untouched`, turns bar; pipes.css 83–135) | yes | keep |
| Demo `bundledDemos/pipes.json` (taps + a `hold` for the anticlockwise turn), stop rule `introDemo.functions.ts:222` | yes | same grid |
| `scripts/pattern-overhaul-pipes-check.ts` 155–173 (33 WebPs with alpha), 194–202 (board HTML contains `corner-1-dry.webp`/`-wet`, `valve.webp`; `pipes.css` contains `tile.webp`; no `drop-shadow` in polish-nov3-pattern's Pipeline section) | **no** | delete 194–202 (and 155–173 if the art goes) |
| `pattern-overhaul-pipes-levels-check.ts` 284, 294 (renders Stage / Reveal: markup-agnostic) | yes | — |
| `puzzle-surface-check.tsx` `pipes:` | yes | — |
| Tile `tile-scenes/pattern.tsx:57` | yes | re-export |

### Revert recipe (look only)

1. `git checkout 82f2f648 -- src/polish-pattern/pipes.css` and re-append HEAD's 83–139 (reveal, `data-pipes-tall`
   level sizing, `.pipe-tile[data-two-way] { touch-action:none }` at 24). Restore the Pipeline blocks deleted from
   `src/polish-layout/polish-nov3-pattern.css` and `src/polish-batch-p/batch-p.css` (from the diff).
2. `git show 82f2f648:src/components/puzzles/pattern/pipesArt.tsx` → replace HEAD's `PipeArt` (82+) with the old SVG
   `PipeArt` + `PipeDefs`, adding a `turnDir` prop (animate from `rotate(90deg)` when −1) and `leakArms` (draw the old
   red drip for any leaking arm); keep `pipeArtUrls` only if the WebPs stay.
3. In `src/puzzles/pipes.tsx`: `PipeTileView` renders `<PipeArt id={defsId} …>` again (re-add `useId` defs per board as
   old lines 40–60 did) and drop the `pipesFx` imports/calls (`planWaterIn`, `planDrain`, `runWater`, `sourceBubbles`),
   keeping gestures, `networkLeakArms`, `showLeaks`, the reveal. The old `.pipe-leak` span may return for `leakArms`.
4. Edit `scripts/pattern-overhaul-pipes-check.ts` 194–202; run it, `pattern-overhaul-pipes-levels-check.ts`,
   `pattern-overhaul-demos-check.ts`, `speed-pipes-nov7-check.ts`, `reduced-motion-end-check.ts`; re-export the tile.

Mixed files: `pipes.tsx` (gameplay + look + effects), `pipesArt.tsx` (look + `pipeTurnFx` wiring).

---

## 5. Ballpark (`numline`) — #431 Number

### Files

| HEAD | 82f2f648 |
|---|---|
| `src/puzzles/numline.tsx` (602 +): `Line` draws three `<image>` ruler slices (`numberArt("numline","ruler-l/m/r")`), `minor={live ? 10 : 0}` tenth tick lines (white, gold at ½, `data-numline-minor`), white notches `var(--jz-white)`, Archivo labels; `Pin` draws `<image pin.webp / pin-placed.webp>`; `numlineLiveSizes()` (thick 72–92 px tape, 24 px pins); `NumberStage` wrapper, edge bump, clearing; new Reveal (`RevealBoards`, rows) | `numline.tsx`: `Line` drew SVG rects with `${id}-steel` / `${id}-sheen` gradients, dark notches `#14151a` above the tape, JetBrains Mono labels; `Pin` a gradient circle; 24 px tape |
| `src/polish-layout/batch-w-numline.css` (48 lines rewritten: 56 px card as `border-image: url(/number/numline/card.webp)`, no glow, gold Place) | 59 lines: tall glowing number card (`clamp(104px,24cqh,190px)`, category radial glow, text-shadow), sunk line well, glowing pins/marker |
| `src/polish-layout/number-overhaul.css` (new; darker Number backdrop + stage slide + navy controls) | — |
| `src/components/puzzles/number/overhaul.tsx`, `number/RevealParts.tsx` (new) | — |
| `public/number/numline/{card,pin,pin-placed,ruler-l,ruler-m,ruler-r}.webp`, source `docs/design/number-overhaul/source/numline.py` | — |

### "Why are there lines on the marker?"

`pin.webp` is a plain glossy champagne sphere (viewed: no lines). The lines are the **new ruler ticks**: `Line` now
draws `minor = 10` white 3 px vertical lines (gold 4 px at the half) *down the ruler's face* (`y1 = y − t/2 + t·0.14` to
`t·0.4`/`0.6`) and the main notches also moved from above the tape (`y − t/2 − 3`, dark `#14151a`) to inside it, white.
The live marker's needle (`var(--jz-gold)`) runs through that lined face, and the drag lens magnifies the face at 4× — so
the marker sits on a ladder of lines. `number-overhaul-measure-numline-check.ts:270` asserts `minor={live ? 10 : 0}` and
262 asserts `t ≥ 72`. Old: no minor ticks, notches above the tape.

### Built on top

| Dependency | Safe? | Adjust |
|---|---|---|
| Levels (`src/lib/levels/gameLevels.ts:362 numline`, `numlineHiddenEnd` hidden end label "?") | yes | keep `hidden` in `tickLabels` |
| Effects: `gameFx("drop")` on `[data-numline-placed]`, `numline.dragTick`, edge bump (`numline-edge`, `numlineEdgeOf`), `NumberStage` clear slide, `FxCountUp`, `numlinePayoffPlan` in the reveal | yes | keep `data-numline-placed`, the edge span, `NumberStage` |
| Reveal (`numlineRevealLines`, `RevealBoards`, `nl-reveal-*`) | yes | its small `Line` (`REVEAL_T 14`) draws the ruler images too; fine either way |
| Demos: `scripts/fixtures/number-demos.json` (numline has no `NUMBER_DEMO_MIN_STAMPS` entry; presentation `oct14-number-tuning`), check 1748c2c8/e81b777f "Ballpark maps a scaled touch" (`localX` scaling) | yes | keep `localX`/`shareAt` |
| `scripts/number-overhaul-measure-numline-check.ts` 132 (ruler slices + pins are `numberArt`), 135 (no `drop-shadow`/`text-shadow 0 0 1`/`0 0 14px` in the CSS), 163–169 (WebPs exist, `card.webp` in the CSS), 262–271 (`numlineLiveSizes` thickness, 56 px card, `minor={live ? 10 : 0}`) | **no** | these pin the overhaul look; delete/rewrite |
| `number-levels-measure-numline-check.ts`, `number-batch-check`, `standard-number-check` | yes (grading) | — |
| Tile `tile-scenes/number.tsx:67` (`TapeLine`, `Pin`) | yes | re-export |

### Revert recipe (look only)

1. In `src/puzzles/numline.tsx` `Line` (278–380): replace the `<g data-numline-ruler>` image block with the old tape rects
   (old 225–275: shadow rect, `url(#${id}-steel)`, `url(#${id}-sheen)`, top/bottom edge lines — the `<defs>` at HEAD 195–202
   still exist), delete the `minor` block (or keep the prop and pass `minor={0}` at 702), move the notch back above the
   tape (`y1 = y − t/2 − 3`, stroke `#14151a`) and restore `MONO`/700 labels if wanted. `Pin` (384–424): replace the
   `<image>` with the old `<circle … fill={fill} stroke="#1a1b21">`. Keep `numlineLiveSizes` if the thick tape is wanted,
   or set `t` back to 24 / `label` 18 / `pinR` 14 / `pinRise` 40 at the call site (702, 742–748).
2. `git checkout 82f2f648 -- src/polish-layout/batch-w-numline.css` (then re-add HEAD's last 4 lines, the gold Place
   button, if that is still wanted).
3. Rewrite `scripts/number-overhaul-measure-numline-check.ts` 132, 135, 169, 262–271 (and 163 if the WebPs go).
4. Run `bun scripts/number-overhaul-measure-numline-check.ts`, `number-levels-measure-numline-check.ts`,
   `number-demos-check.ts numline`, `phone-gap-check.ts`; re-export the tile.

Mixed file: `numline.tsx` holds the look (Line/Pin/sizes), effects, levels (hidden end), reveal in one 600-line diff.

---

## 6. Checkout (`checkout`): the vertical lines at the sides

Three overlapping sources draw vertical edges beside Checkout's content at HEAD:

1. **The shared accent ring on `[data-play-area]`** — `src/styles.css:1628`:
   `.game-screen :is([data-play-area], .puzzle-square-board, .pipes-play-board, .logic-nonogram-board) { box-shadow: 0 0 0 1px color-mix(in srgb, var(--category-accent) 24%, transparent), 0 0 8px … }`.
   Checkout's root (`src/puzzles/checkout.tsx:753–756`, `<div data-play-area data-stage-column="1" … data-checkout-root>`)
   carries `data-play-area`, so a green 1 px line + glow is drawn round the **whole column** (tabs, arena, score row,
   ring buttons, Undo/Throw). Where the column is as wide as the stage, these show as two vertical lines at the screen
   sides, and anything that leaves the column (the dart flight, the `nov-stage` slide-in from +28 % / slide-out to −60 %,
   the thrown-dart tug ghost) crosses them. This rule existed at 82f2f648 too (old styles.css:1623) but the old fairground
   arena background hid it; the new flat arena shows it.
2. **`.co-arena`'s own inset ring** — HEAD inline CSS `checkout.tsx:396–398` keeps `inset 0 0 0 1px rgba(255,255,255,0.06)`
   and `src/polish-layout/batch-w-checkout.css:15–17` sets in play `box-shadow: inset 0 0 0 1px var(--jz-surface-2)`
   (`#1E2640`, a solid navy line; old was `rgba(255,255,255,0.08)` plus the stall's bulbs/sky). The arena is
   `w-full flex-1` with no `overflow: hidden`, and `NumberStage`'s `.nov-stage[data-stage-enter]` / `[data-stage-exit]`
   animations (`number-overhaul.css` 26–52) translate the dartboard across those edges.
3. **The game tray** — `useBoardTray` in `src/components/duel/GameFrame.tsx:175` is enabled for every framed non-arcade
   game (`PhoneShell.tsx:172`: `Boolean(frame && !arcade && type)`); `.game-tray` (`game-frame.css` 426–445) is
   `border: 1px solid color-mix(var(--category-accent) 18%, transparent)`, radius 26 px, hugging `boardBox(arena)`
   (`src/lib/boardBox.ts`) +10 px. For Checkout the arena is `.co-arena`, so the tray's sides sit 10 px outside the
   arena's own ring: two concentric vertical lines.

Fix: remove `data-play-area` from Checkout's root (or drop `[data-play-area]` from the styles.css:1628 selector
everywhere, which also removes the ring on Ballpark, Brimful, Integer Pyramid, Trail, Lookout, Roundabout, Chain,
Tenfall, Pull!, Ball Tracker, Scrumper, Dig — see the list below), set `.co-arena` `box-shadow: none`, and either
`overflow: hidden` on `.co-arena` or exclude Checkout from the tray.

### Every board/stage with a frame-like border at HEAD

- Global, all puzzles: `.game-tray` (1 px category border + gradient plate) — `game-frame.css:426`.
- Global accent ring (`styles.css:1628`) on `data-play-area`: `checkout`, `numline`, `measure`, `numberPyramid`,
  `trail`, `wordSearch`, `letterWheel`, `chainTap`, `tenDrop`, `clayShoot`, `ballTrack`, `snip`, `dig`; and by class:
  `nonogram` (`.logic-nonogram-board`), `pipes` (`.pipes-play-board`), `rotatingRings` (`.puzzle-square-board`).
- Per-game frames: Lamplighter `.logic-lamp-frame` (`logic-2.css:416`, inset 1 px white 5 % + `#0d1210→#080b0a`);
  Tents `.logic-camp-frame`, Shikaku `.logic-glass-frame` (same rule); Box Six `.logic-sudoku-frame` (`batch-p.css:208/548`);
  Mosaic `.logic-nono-frame` (301/645); Colour Flood `.logic-flood-frame` (329/654); Lights Out `.logic-bulb-panel`
  (182/519); Loopline `.fences-frame` (`fences.css:55`); Island Link `.bridges-frame` (`bridges.css:53`); Topsy
  `.topsy-tilt` frame.webp + `.grav-well` inset (`topsy.css:124–135`); Chroma `.flow-board` `0 0 0 1px rgba(255,255,255,.05)`
  (`flow.css:7`); Pipeline `.pipes-board` (`pipes.css:10`) + the accent ring; Gradient `.tiles-frame` (`batch-p.css:121`);
  Gridlock `.unblock-lot` (55); Heave `.push-board` (98); Tessellate `.bp-board` (68); Polypotions `.tubes-play-board`
  (594); Lightbender `.laser-board` (`laser.css:10`); Checkout `.co-arena` + `.co-score` `border: 1px solid var(--jz-surface-2)`
  (`checkout.tsx:419–421`); Ballpark `.numline-line-in` well `box-shadow: inset 0 0 0 1px var(--jz-line)`
  (`batch-w-numline.css`); Trail `[data-game-arena] > .relative` (`batch-w-trail.css:6`); Operator `.op-board`
  (`batch-w-equation.css:6`).

---

## 7. "Puzzles are dark": what got darker, old → new

The shared puzzle backdrop (`game-frame.css` 364–374: `--frame-deep = mix(accent 10%, --jz-bg)`, top radial accent 20 %,
bottom 14 %) is **unchanged**. The darkening is:

| Where | 82f2f648 | HEAD |
|---|---|---|
| Number backdrop, all 8 games | the shared rule above | `src/polish-layout/number-overhaul.css:7–12`: accent radials **20 % → 10 %** and **14 % → 7 %** ("a darker Number background… about half the strength") |
| Lamplighter frame | `#1E1A14→#110F0B` warm + category tint (`batch-p.css:924`) | `#0d1210→#080b0a` (`logic-2.css:417`) |
| Lamplighter dark squares / walls | `#0f1012` recess / near-black with white 1.5 px edge | `logic-cell.webp`, `lightup-wall.webp` (black lacquer) |
| Tents / Shikaku frames | batch-p warm frames | `#0c130e→#070b08` (`logic-2.css:59`), `#0d1210→#080b0a` |
| Trail ground, Regions cells | — | `#0b0d0f` (`logic-2.css:260`), `#0a1224` (354) |
| Box Six cells | — | `#08090c` + `box-tile.webp` (`logic-overhaul-1.css:27`) |
| Chroma Lines cells | `bg-card` ≈ `oklch(0.205 0.012 285)` tinted by the line's colour (`${tint}22` / border `${tint}55`) | `cell.webp` (rim `#15161c`, black), no tint; tubes darkened by `tubeBody()` (lightness ≤ 0.56×0.92, saturation ×0.8) |
| Pipeline board / tiles | `#1a1f26→#0e1116` / `#2a3038→#1d2229` brushed steel, cyan lit rims | `#0d0b11→#060508` / `#0c0b0f` + `tile.webp` (`pipes.css:12,18`) |
| Topsy floor / blocks / tray | `#232a3c→#181d2a` / `#9aa3b5→#4d5568` / `#3a4052→#161922` | slate `#12151e` floor.webp, grey stone block.webp, gunmetal `#4a5266` frame on `#0b0e16` |
| Lightbender board | — | `#15131b→#0b0a0f` (`laser.css:10`) |
| Speed: Flash wait, Chain board | — | `#0d0b0a`, `rgba(8,4,2,.62)` over art + `#120903` (`speed-overhaul.css:9,56`) |
| Ballpark card | lit card with category glow (`radial-gradient(accent 20 %)`, text-shadow accent 55 %) | matte navy `card.webp`, `text-shadow: none` |
| Checkout arena | fairground sky gradient + bulbs + wood (`FAIR_*`) | flat `FAIR_SKY` gradient, navy rings, no bulbs |
| Controls (Number, Topsy) | category-coloured (`[data-puzzle-action]` in the category accent) | navy `--jz-surface-2` + champagne (`number-overhaul.css:68–90`, `topsy.css:239–247`) |

Also deleted glows (batch-p.css / polish-nov3-pattern.css): Chroma's `.flow-halo` neon and lit tray, Pipeline's network
drop-shadow and blue rims, Gridlock's gold-car glow, Heave's crate-home glow, Lightbender's neon beam and gem glow,
Skid's ice glints — all removed in #433 as "no glow" (`65af426b`, `c3b04822`, `4543d1a8`, `ec68862d`, `fc151eb8`, `fab65344`).

Restoring colour category-wide = (a) delete `number-overhaul.css:7–12`, (b) restore the deleted batch-p / polish-nov3
Pattern blocks from `git diff 82f2f648 HEAD -- src/polish-batch-p/batch-p.css src/polish-layout/polish-nov3-pattern.css`,
(c) per-game frame colours above. Checks that would then fail: `pattern-overhaul-{flow,pipes,unblock,push,laser,iceslide}-check`
(each asserts "no glow" on its CSS), `number-overhaul-measure-numline-check:135`, `logic-overhaul-2-check` (glow pools).
