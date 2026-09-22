# Fill Count Up, polish Bin Toss, and restore exact Bullseye wind

## Scope
Only Count Up, Bin Toss, Bullseye, their shared arcade proof, and the task roadmap will change. No browser tests will be run.

## Count Up
- Generate exactly 48 shapes for the 8×6 board so every cell is occupied.
- Preserve the existing target-count range and near-miss groups.
- Fill every remaining cell with a distractor that is not the exact target combination; retain the existing colour-clarity rule.
- Keep the compact keypad and current enlarged play area unchanged.

## Bin Toss
- Add a client-only scored-ball sequence lasting about 350 ms: the ball drops through the opening, rebounds once from an inside wall, then settles at the bottom.
- During that sequence, flash the bin gold and delay the displayed “in” counter increase until the ball settles. The authoritative basket result and score remain unchanged.
- Preserve the existing rim-hit wobble and miss tumble.
- Reserve the bottom 72 px as a faint “drag here to cancel” strip beneath the playable canvas.
- While aiming, entering the strip greys the predicted arc and brightens the strip. Releasing there clears the aim without queuing or recording an input; leaving it restores the normal path.
- Keep pointer capture and disable touch scrolling throughout the drag.

## Bullseye
- Generate ten deterministic wind values from −3 through +3, including zero, from the round seed and persist those values in the round data.
- Use the same stored/derived sequence in play and server replay so every player receives identical wind.
- Replace the old drift table with integer displacement equal to `wind × scaled outer radius ÷ 6` for that arrow. This makes each unit exactly one current ring width.
- Keep the live dotted aim line and ring at the no-wind landing.
- Show the current wind above the target as an arrow and magnitude, with a clear zero-wind state.
- Attach each arrow’s wind to its authoritative hit result and show wind plus landing position for every fired arrow in the reveal.
- Replace Bullseye help wording with: “The wind moves your arrow by that many rings. Wind 2 to the right? Aim two rings to the left.”

## Verification
- Extend the arcade proof to assert wind values stay within −3…+3, the stored values match deterministic generation, each displacement equals the scaled ring width rule, and replayed hits retain wind.
- Re-run the 200-run client/server identity proof with random Bullseye aim vectors.
- Run the focused static checks and inspect the preview build result, without browser/device testing.
