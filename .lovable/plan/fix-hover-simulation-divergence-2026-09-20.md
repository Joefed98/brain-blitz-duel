# Fix Hover simulation divergence

## Scope
- Keep the arcade engine unchanged and modify only Hover’s shared game module, submission/replay plumbing, reveal, grading details, proof script, and task list.
- Preserve gameplay, layout, timing, and scoring except where integer constant normalization removes the divergence.

## Implementation
1. Define every Hover physics/course constant once as an integer fixed-point value, including speed start/step/cap, gravity, impulse, terminal velocity, pillar dimensions/spacing, and gap dimensions.
2. Add a shared Hover state snapshot and 32-bit checksum function covering tick, disc position/velocity, current scroll speed, gates, and next pillar geometry.
3. Record client checksums every 300 simulated ticks and include them with the tap log and actual ending tick.
4. During server replay, compute the same checkpoints, store the first mismatch tick, and log both snapshots at that point.
5. Surface `desync at tick N` on Hover’s reveal and persist the mismatch detail with the graded result.
6. Extend the Hover proof to 200 generated tap logs, independently run the client stepping path and server replay path, and assert identical final state and checkpoints.

## Validation
- Run the Hover proof and report the first failing tick if one exists.
- Run focused type/lint checks and confirm the preview build signal is clean.
- Do not run browser tests.
