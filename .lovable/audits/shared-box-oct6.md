# Shared red box and fitted Wordsmith letters

The shared FxLayer created floating outline spans for glow/shake events. The old CSS positioned the 44×24px outline at 10% screen height, centred horizontally, with a red border for wrong feedback. This was independent of game coordinates and of the recorder. The shared layer now drops these untargeted outline events everywhere; sound, other effects and gameplay remain unchanged.

Recorder audit: practice recording attaches only for example recording with an accepted key. Engine intro touch dots are already disabled. Touch-origin focus outlines are now suppressed at the shared game root while keyboard focus-visible styling remains.

Diagnostics audit found a separate issue: dev=1 alone enabled diagnostics. Display permission now requires the server-accepted key matching the current URL. Permission is cleared during checks, on failures and unmount; frame timing reacts to permission changes. This is presentation permission only, not server authorization.

Wordsmith letters target three times their previous size (312px live, 192px example/reveal), but are capped to fit. Hidden SVG text measures the actual loaded font glyph bounds. One shared font size is constrained by every glyph's upright bounds and every segment edge, preserving a 1% board-width margin and the same centre size. Resize and font readiness trigger remeasurement; live, intro and reveal share this drawing.

Non-browser checks passed: shared-box/dev gates, 14 source/SSR polygon checks including glyph corners inside all edges at both size labels, 60 input/phase checks, 336 shared-surface checks and shared FX. 306 protected files unchanged; diagnostics.ts changes only its display permission. No generators, simulations, grading or scoring changed. No browser tests or identity proofs ran. Actual device appearance and no-scroll at 390×700 and 375×667 remain user-tested.