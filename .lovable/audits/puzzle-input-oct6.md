# Puzzle input tuning audit

No browser tests. PASS below means source, explicit geometry and SSR structure, not measured device fit or native hold appearance.

## Shared checks

- 500 inner-60% Word Hunt hit tests, plus gap, adjacency, diagonal, reuse and backtrack regressions.
- Wordsmith tile toggles remove only the re-tapped tile; no input box, typing, shuffle or drag handlers.
- Game roots, all canvases/buttons and Beat hold canvas explicitly suppress native tap highlights/selection/callouts.
- Old coordinate-based demos for changed controls fall back to fixed examples until re-recorded.

## Both-size per-game audit

| Game | 390×700 | 375×667 | Source geometry and remaining device checks |
|---|---|---|---|
| Wordsmith | PASS source/SSR | PASS source/SSR | Square height/width-fitted segmented regular octagon; eight wedges plus category-accent centre. 52px live/32px static letters, shared intro/reveal geometry. 44px word/action rows and fixed gold-chip slot unchanged. Dropdown unchanged; long reveal lists retain internal scrolling. |
| Word Hunt | PASS source/SSR | PASS source/SSR | Existing 5×5 height/width-fitted square retained. Inner-60% boxes create 40%-cell plus gap dead zones. Previous-cell removes last; nonadjacent/reused hits ignored; second pointer ignored. Drag retained; real finger reliability awaits devices. |
| Target Number | PASS source/SSR | PASS source/SSR | Undo/Reset each 44×44 with centred 20px SVG; gap 8px. Actions need 88+8+12px plus Lock width: usable widths 382/367px leave 274/259px for Lock. Existing step history is bounded/internal scrolling. |
| Maze Dash | PASS source/SSR | PASS source/SSR | Reset removed. Shared preference retained. 343px control width: four 76.75×68px arrows, 12px gaps; switch on separate 28px row. 104px total replaces old 60+4+44=108px stack; maze loses no height. |
| Rotating Rings | PASS source/SSR | PASS source/SSR | Undo/Reset removed, two rotation buttons now (usable-width−8)/2 = 187/179.5px wide, 52px tall. Move replay unchanged. Existing unsolved two-board reveal can internally scroll: not certified no-scroll on short phones. |
| Lights Out | PASS source/SSR | PASS source/SSR | Two 44×44 secondary SVG controls, 12px gap. Board shrinks through existing size container, so larger controls cannot force the board out of its region. |
| Mini Sudoku | PASS source/SSR | PASS source/SSR | Heavy 3px box borders belong to actual cell edges: perimeter plus column 3, rows 2/4. No separate overlay. Equal minmax tracks; fixed 190px reveal and 150px example retained. Device fit remains unverified. |
| Colour Flood | PASS source/SSR | PASS source/SSR | Undo removed, count remains. 52px colour choices + four 8px gaps = 292px, within 358/343px inset widths. Width-led board maximum 358/343px plus controls/count fits estimated 552/519px game space. |
| Shikaku | PASS source/SSR | PASS source/SSR | Explicit size/rows aspect and equal minmax tracks. Reveal max width 170px each, 12px gutter: total 352px fits 382/367px. For every rectangle, all corners and number rows share same tracks; 170px square unaffected by text overlays. |
| Beat | PASS source/SSR | PASS source/SSR | Full flexible canvas within overflow-hidden wrapper, unchanged lane input and replay. Native suppression added inline to canvas and inherited from screen CSS, including long holds; intentional blue lane art remains. |

## Limits

The document root remains viewport-locked and touched controls introduce no page scrolling. Actual content fit, long text wrapping, native hold highlights, physical drag accuracy and audio require the user's device checks. Existing internal-scroll reveals/dropdowns are explicitly not certified scroll-free.
