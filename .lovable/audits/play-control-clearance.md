# Play captions and control clearance — 6 October 2026

## Removed captions (room and practice share the same Stage)
- Maze Dash: “Tap or hold an arrow · or draw with your finger · go back to undo”.
- Tower: “Tap a peg to lift its top disc, then tap where it goes”.
- Sort the Tubes: “Tap a tube to lift its top balls, then tap where to pour”.
- Colour Connect: “Drag dot to dot · drag from a loose end to carry on · tap a dot to clear it”.
- Nonogram: “Tap to fill, again to mark empty, again to clear.”
- Bomb Defusal: “Read every rule, act in order, then tap DEFUSE”.
- Practice-only retired games: Go / No-Go “Tap gold circles only”; One Stroke “Lift your finger to start again.”

Intro and question-mark instructions are unchanged. Live placement, move, tilt, selected-ring, pass, link, accepted-word/error and combo feedback remains. Dynamic phase prompts and actual puzzle clues remain. No bottom instruction caption exists in Colour Clash, Tilt, Lights Out, Rotating Rings, Sliding Tiles, Word Slide, Trail or Ten Drop.

## Shared controls
The old compact ArrowPad absolutely positioned arrows and the mode switch in the same row without reserving switch width. Non-engine surface text enlargement also made its tiny text switch larger. The switch now has a separate 44px grid track and an accessible joystick icon. Both modes reserve exactly the same height; normal 60px blocks retain their existing height and expanded blocks reduce from 104 to 84px. Targets are 44px high (68px expanded), with 12px gaps, 12px top clearance and 8px additional side inset. Existing mode preference and every event handler are unchanged. Normal joystick target is 44px, expanded 68px; this is visual target sizing only, not a threshold/direction/input change.

Colour Clash's three arrow targets calculate to 95.33px / 90.33px wide at 390 / 375px respectively. Four-arrow blocks calculate to 68.5px / 64.75px. All have the separately reserved 44px mode switch. Tap lanes remain the existing canvas interaction; they are not new DOM buttons. Their width is at least 84px for four lanes at these widths, with existing contiguous lane geometry retained rather than adding dead zones or changing input.

Action rows in Gravity Maze, Tower, Tubes, Sliding Tiles, Word Slide, Trail and Rotating Rings have 12px gaps and extra side inset; Gravity Undo/Reset increase from 40 to 44px high. Additional ArrowPad consumers Push and Ice Slide get matching action-row gaps. Tower pegs and live tube rows also get 12px gaps without changing their height; tube caption removal more than pays for the extra row gap. Lights Out already has 44px secondary controls and 12px gaps. Tilt has no separate button block. Ten Drop uses existing 76×64 world-unit moving tiles in a four-column canvas, not a footer control row.

## Limits not silently changed
- Word Slide row locks are still 36px wide with 4px vertical gaps. Its five 56px rows plus board borders/padding and the lock rail already occupy 364px. A 44px lock rail with 12px horizontal/vertical clearance would require wider/reworked geometry at 375px (about 380px across), or smaller letter cells. Existing arena and input geometry were retained; footer Undo/Reset meet 44px/12px.
- Gravity Maze: source arithmetic at 375×667 with a 34px bottom safe area leaves approximately 364px for the square, versus its previous width-limited 367px. The enlarged Undo/Reset row and 12px row gap could cost approximately 3px of board size in that inset case. At the default 8px inset it remains width-limited at 367px. Actual device rounding is unmeasured. This is reported rather than claimed as unchanged arena size.
- A 12px gap is not inserted between every contiguous board cell or canvas lane: those are arenas, not separate footer controls; doing so would change presentation/input mapping and, e.g., distort Gravity's nine-by-nine board. Ten Drop's recorded hit regions include existing 8px slack, so a universal 12px separation of interactive moving hit regions cannot be promised without an input change.
- Sliding Tiles and Word Slide retain existing fixed-sized arenas/centred distribution; Trail retains its measured width/height sizing. No board was enlarged or reduced to force compliance. Flexible canvases/arenas naturally receive freed caption height.

## Verification
- Browser-free checks: all 68 active games, 272 room/multi/practice Stage-and-ancestor DOM comparisons at 390×700 and 375×667, 1,220 controls.
- Dedicated caption/control check covers eight captions, normal/expanded control arithmetic and action-row gaps.
- Existing room viewport check passes: shared constrained shell, no chat reservation, one bottom safe-area owner, no fixed-height exception detected.
- All simulation, input/replay helper, grader, scoring and generator modules remain byte-identical to the pre-change baseline; edits are JSX classes, removed captions and the shared control's markup only. No identity proofs or browser tests.
- These checks do not measure actual pixels, font rendering or final no-scroll visibility. Device confirmation remains with the user.