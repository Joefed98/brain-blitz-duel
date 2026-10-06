# Fix room screen clipping and Word Search reveal paths

## What will change
- Keep room chat and reactions from reserving height during puzzle play and answer reveal, while retaining the fixed no-scroll phone shell for those two phases.
- Restore the round intro to the naturally scrolling shell so only puzzle and reveal screens remain viewport-locked.
- Draw unfound Word Search placements as warning-red cell outlines across their complete paths; found cells keep their gold highlight, and unfound list entries use the same warning red.
- Preserve drag-board touch blocking and apply the phone safe-area padding only through the shared game shell.

## Verification
- Run source/render geometry checks for every active puzzle and arcade in room mode at 390×700 and 375×667, including fixed bottom controls and one bottom safe-area allowance.
- Report any game that still exceeds its available room viewport instead of shrinking.
- Confirm gameplay, input, grading, scoring, and simulations remain unchanged and the preview build is healthy.

## Technical details
- The root cause is the room-only `RoomChat` flow element: its 56px fixed bar plus 8px top margin is mounted inside the constrained 100dvh shell during play/reveal. Practice has no equivalent child.
- Room reactions may remain as a fixed overlay where appropriate; they must not consume layout height.
