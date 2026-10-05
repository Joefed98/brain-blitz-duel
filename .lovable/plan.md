# Burst drawing performance

- Replace live object blur and pixel-by-pixel drawing with cached enemy, ship, icon and beam artwork, including pre-rendered glow.
- Cache the scanline overlay as one reusable layer, preserving its reduced-motion behavior.
- Keep Burst particles within the shared 32-particle limit; suppress new bursts above 24 enemies or 8 shots.
- Add a `?dev=1` frame-time readout to all arcade drawing paths: frame interval/FPS, draw time, work time and rolling p95.
- Verify with non-browser drawing benchmarks, cache/particle checks and protected-file fingerprints. Phone 60 fps remains for device confirmation.

## Profile result
In a non-browser raster benchmark at DPR 2 with 40 enemies, 12 burst shots and a shield, live blur produced a 225 ms p95 versus 3.1 ms with blur disabled. The existing frame also issued about 1,653 filled rectangles and 114 blur-setting changes. These are desktop diagnostic results, not phone frame-rate claims.

## Technical details
Use bounded renderer-only offscreen caches with a plain-drawing fallback. Keep simulations, recorded inputs, graders and scores unchanged; no identity proofs or browser tests.