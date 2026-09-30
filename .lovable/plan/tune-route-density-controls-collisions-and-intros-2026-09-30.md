# Tune route density, controls, collisions, and intros

## Changes
- Make Hot Floor exhaustively count simple surviving routes within each hop budget, enforce the per-stage route limit, require a zero-slack pinch on every survivor, and require three equal-or-shorter number-failing routes before accepting a board.
- Replace Burst’s compact controls with three full-width, evenly gapped press-safe controls. Centralize non-selectable pointer/touch/context handling and apply it to shared arrow/joystick controls and arcade-specific directional controls.
- Keep missed Parry arrows active between the shield ring and a new central core, allowing late deflection until core contact; draw the core with a dark fill and red edge.
- Change only Bastion’s arrow-mode turn rate to 3° per tick; leave direct touch aiming and simulation follow unchanged.
- Let every round intro’s instructions/example area scroll while keeping READY and readiness status sticky and tappable at the bottom.

## Verification
- Extend Hot Floor checks to measure exhaustive survivor count, pinch coverage, three failed alternatives, average survivors, and rejected-attempt rate over 50 stages.
- Run 200 replay identity checks for Hot Floor, Parry, and Bastion plus focused collision/control/rate checks and TypeScript/build diagnostics.
- Statically verify the shared intro layout and Shikaku/Tents examples against 375×667 and 390×700 constraints. Do not run browser tests.
