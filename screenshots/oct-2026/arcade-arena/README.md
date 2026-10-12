# Arcade arenas at 390 × 844: before and after

Each image is one game in practice at 390 × 844 (headless Chromium, about 1 s into
the run): left is `main` before this change, right is after. The world is the game's
fixed view size in world units. "Stretched" is the old vertical/horizontal scale
ratio: those games were drawn non-uniformly, so their shape changed with the phone.
After, every arena is the world at one uniform scale (width-limited at this size),
its top edge unchanged (116 px; Scrumper 156 px under its HUD row). The coloured
fill is the arena's own bottom-edge colour, painted under it at its width; the play
column then ends 8 px above the screen bottom.

Fission's area drops 4.2 % because it was previously stretched 4.5 % taller than its
world; at 390 px wide its true-aspect arena cannot be taller without distorting it.

| Game | World | Before: drawn arena (y/x scale ratio) | After: arena (uniform scale) | Area change | Coloured fill below | Empty below column |
|---|---|---|---|---|---|---|
| Hover | 390x560 | 382x549 | 382x549 (0.980x) | +0.0% | 171 px | 8 px |
| Breaker | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Rally | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Tempo | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Meteor | 390x532 | 382x521 | 382x521 (0.979x) | +0.0% | 199 px | 8 px |
| Fission | 390x560 | 382x573 (stretched 1.045) | 382x549 (0.980x) | -4.2% | 87 px | 8 px |
| Wavefront | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Orbit | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 53 px | 8 px |
| High Rise | 390x560 | 382x549 | 382x549 (0.980x) | +0.0% | 171 px | 8 px |
| Jaywalk | 390x580 | 382x568 | 382x568 (0.979x) | +0.0% | 152 px | 8 px |
| Junction | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Rainbow Bridge | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 53 px | 8 px |
| Slice | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Swish | 390x560 | 349x501 | 382x549 (0.980x) | +19.9% | 99 px | 8 px |
| Flightpath | 390x560 | 382x549 | 382x549 (0.980x) | +0.0% | 171 px | 8 px |
| Coral Pop | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Roofbound | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Grappler | 390x620 | 382x573 (stretched 0.944) | 382x607 (0.980x) | +5.9% | 113 px | 8 px |
| Scrumper | 360x560 | 382x573 (stretched 0.964) | 382x594 (1.061x) | +3.7% | 86 px | 8 px |
| Tilt | 440x470 | 382x408 | 382x408 (0.868x) | +0.0% | 312 px | 8 px |
| Ball Tracker | 700x1000 | 382x546 | 382x546 (0.546x) | +0.0% | 134 px | 8 px |
| Gemstone | 390x560 | 382x549 | 382x549 (0.980x) | +0.0% | 171 px | 8 px |
