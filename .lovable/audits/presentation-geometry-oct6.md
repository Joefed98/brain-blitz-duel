# Presentation geometry audit

No browser tests. PASS means source/SSR and analytic geometry, not measured device rendering or no-scroll certification.

| Presentation | Size | Result |
|---|---|---|
| ArcadeReveal | 390x700 | PASS source: crash marker absent; finish circles/fallback unchanged |
| Wordsmith | 390x700 | PASS shared markup + geometry: circular nucleus, faint 37%-radius orbit and round controls; all 7–10 outer layouts fit without overlap; 50.4px targets at conservative 280px board; fixed chip/action slots unchanged |
| Mini Sudoku | 390x700 | PASS live/intro/reveal: 36 equal-track cells; heavy strokes are borders of those exact cells, no overlay |
| Shikaku | 390x700 | PASS both individual grids and pair: clipped board/labels, equal tracks; 170px grid, 16.10px cells, 12.88px labels |
| ArcadeReveal | 375x667 | PASS source: crash marker absent; finish circles/fallback unchanged |
| Wordsmith | 375x667 | PASS shared markup + geometry: circular nucleus, faint 37%-radius orbit and round controls; all 7–10 outer layouts fit without overlap; 50.4px targets at conservative 280px board; fixed chip/action slots unchanged |
| Mini Sudoku | 375x667 | PASS live/intro/reveal: 36 equal-track cells; heavy strokes are borders of those exact cells, no overlay |
| Shikaku | 375x667 | PASS both individual grids and pair: clipped board/labels, equal tracks; 170px grid, 16.10px cells, 12.88px labels |
| Arcade hover | 390x844 | PASS arena 382x549 at 0.979x both ways, top 116px, fill 171px below, 0px across |
| Arcade breaker | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade rally | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade beat | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade snake | 390x844 | PASS arena 382x521 at 0.979x both ways, top 116px, fill 199px below, 0px across |
| Arcade burst | 390x844 | PASS arena 382x549 at 0.979x both ways, top 116px, fill 87px below, 0px across |
| Arcade wavefront | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade orbit | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 53px below, 0px across |
| Arcade skyline | 390x844 | PASS arena 382x549 at 0.979x both ways, top 116px, fill 171px below, 0px across |
| Arcade cross | 390x844 | PASS arena 382x568 at 0.979x both ways, top 116px, fill 152px below, 0px across |
| Arcade junction | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade inkbridge | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 53px below, 0px across |
| Arcade slice | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade bintoss | 390x844 | PASS arena 382x549 at 0.979x both ways, top 116px, fill 99px below, 0px across |
| Arcade bullseye | 390x844 | PASS arena 382x549 at 0.979x both ways, top 116px, fill 171px below, 0px across |
| Arcade bubble | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade flip | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade swing | 390x844 | PASS arena 382x607 at 0.979x both ways, top 116px, fill 113px below, 0px across |
| Arcade snip | 390x844 | PASS arena 382x594 at 1.061x both ways, top 156px, fill 86px below, 0px across |
| Arcade tilt | 390x844 | PASS arena 382x408 at 0.868x both ways, top 116px, fill 312px below, 0px across |
| Arcade balltrack | 390x844 | PASS arena 382x546 at 0.546x both ways, top 116px, fill 134px below, 0px across |
| Arcade matchup | 390x844 | PASS arena 382x549 at 0.979x both ways, top 116px, fill 171px below, 0px across |

The live Wordsmith board retains its height/width-fitting square and all existing fixed chip/action slots. Its reveal now adds a 160px shared board; existing long word lists can still require internal scrolling. Sudoku retains its previous board dimensions; Shikaku remains two 170px-max squares with a 12px gutter. No generators, grading or scoring changed. Actual fit and appearance remain for user device checks.
