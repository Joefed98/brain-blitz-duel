# Snip orchard / shared countryside — Oct 6

Presentation-only: countryside.renderer.ts now owns the exact original Ink Bridge sky, hill paths, cloud sprite and cloud placements/motion. Snip adapts that same reference backdrop to its unchanged viewport and uses optional camera parallax. Ink Bridge passes no camera offset.

## Cached art
- Shared DPR-2 background and cloud.
- Snip DPR-2 red apple (24×24), circular wicker basket (64×64), gold leaf (48×48), canopy (world width × 28), stone wall strip (3×560), fence rails keyed by existing template dimensions.
- Twine and recent swipes remain live paths, following the original nodes and input presentation coordinates; no simulation data is edited.
- Ink Bridge's coin, pot, rainbow meter and per-context bridge raster remain unchanged.

## Verification
- Nine byte-identical native PNG comparisons of old/new Ink Bridge, covering both phone arena sizes, level 1/10, reduced/full motion and the fixed intro, with a frozen presentation clock.
- Apple, basket and leaf alpha silhouettes remain within their circular collision radius, reaching the outer radius within 1px. Rails fully fill unchanged platform AABBs. Branch/canopy decoration lives behind gameplay, not as collisions.
- No warm-frame surface allocations across 360 frames per benchmark; native images inspected at both arena sizes and fixed intro.
- Level-10 native DPR-2 draw medians 0.061–0.068ms; p95 0.114–0.193ms across 382×454 and 367×421, motion/reduced motion. These are local raster timings, not phone FPS or full frame times.
- Snip now wires useArcadeFrameTiming around the existing loop/draw. Readout is FPS, frame, p95, Draw, work, gated by existing accepted developer key plus dev mode; no gameplay/layout space reserved.
- Sound mappings: cut arc_swoosh, basket arc_wood_knock, leaf arc_gem_chime, failed level arc_thud. Removed sea ambience/creak/cutlass/coin/chest/splash and duplicate playCorrect. Existing shared run-end complete retained.
- All 507 non-allowlisted src files match before/after hashes, including simulations, input/replay helpers, graders, scoring and route files. Native check script/results are under /tmp/snip-orchard; zero browsers or identity proofs. Preview build OK.

## Existing geometry discrepancy
SNIP_CONFIG.worldW = 1260, viewW = 360 (3.5 viewport widths), not 1.5. Preserved because changing that is a simulation/input change. Existing nonuniform snipView and following camera also preserved.

## Device-only verification
Actual phone frame-time values, audio and appearance await the user's device check; not claimed verified.