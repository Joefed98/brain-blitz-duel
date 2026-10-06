# Presentation geometry audit

No browser tests. PASS means source/SSR and analytic geometry, not measured device rendering or no-scroll certification.

| Presentation | Size | Result |
|---|---|---|
| ArcadeReveal | 390x700 | PASS source: crash marker absent; finish circles/fallback unchanged |
| Wordsmith | 390x700 | PASS shared markup + geometry: regular octagons, equal wedges, nine controls; glyph size is 70% of the previous bold fitted 312px/192px targets, weight 700 to 500 (~71%), equal centre size; outline, tap targets and fills unchanged |
| Mini Sudoku | 390x700 | PASS live/intro/reveal: 36 equal-track cells; heavy strokes are borders of those exact cells, no overlay |
| Shikaku | 390x700 | PASS both individual grids and pair: clipped board/labels, equal tracks; 170px grid, 16.10px cells, 12.88px labels |
| ArcadeReveal | 375x667 | PASS source: crash marker absent; finish circles/fallback unchanged |
| Wordsmith | 375x667 | PASS shared markup + geometry: regular octagons, equal wedges, nine controls; glyph size is 70% of the previous bold fitted 312px/192px targets, weight 700 to 500 (~71%), equal centre size; outline, tap targets and fills unchanged |
| Mini Sudoku | 375x667 | PASS live/intro/reveal: 36 equal-track cells; heavy strokes are borders of those exact cells, no overlay |
| Shikaku | 375x667 | PASS both individual grids and pair: clipped board/labels, equal tracks; 170px grid, 16.10px cells, 12.88px labels |

The live Wordsmith board retains its height/width-fitting square and all existing fixed chip/action slots. Its reveal now adds a 160px shared board; existing long word lists can still require internal scrolling. Sudoku retains its previous board dimensions; Shikaku remains two 170px-max squares with a 12px gutter. No generators, grading or scoring changed. Actual fit and appearance remain for user device checks.
