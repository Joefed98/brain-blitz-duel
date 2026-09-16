# Fix Spot the Difference panel clipping

## What will change
- Give Spot the Difference a dedicated in-round vertical layout: round bar, compact timer, found counter, then two equal scene panels separated by the existing gold divider.
- Let each scene panel use the remaining height with `flex: 1`, `min-height: 0`, and the existing 8×5 view box so both panels shrink evenly without distortion.
- Keep rendered shapes at least 28px by reducing only this puzzle’s timer footprint on short screens before allowing the scenes to shrink.
- Preserve the bottom safe-area clearance and keep all puzzle behavior, generation, scoring, tapping, and reveal screens unchanged.

## Verification
- Open Spot the Difference in Practice at 390×700 and 375×667.
- Confirm both complete panel edges and the divider are visible, shapes remain at least 28px, the lower panel clears the safe area, and the page does not scroll.
- Confirm taps still register in both panels and check the preview build remains healthy.

## Technical details
- Changes will be limited to the Spot the Difference stage and narrowly scoped Spot-specific wrappers in the active-round routes; the shared timer itself and all other puzzle layouts remain unchanged.
