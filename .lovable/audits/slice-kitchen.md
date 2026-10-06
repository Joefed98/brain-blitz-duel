# Slice kitchen retheme - Oct 6

## Mapping
The simulation has FOUR normal colour indices, not five. Index 0 barrel -> bagel; index 1 crate -> loaf; index 2 cannonball -> cucumber; index 3 rope -> tomato. Pickle and meatloaf omitted to preserve the four-type schedule. Frenzy -> ketchup; slow -> mustard; bomb -> lit red chilli. Special bottles share a rounded full-diameter silhouette to avoid disguising a 32px target as a small bottle. Chilli has a full 40px red body, not a small pepper inside an invisible danger circle.

## Cached artwork
Lazy pre-rendered: four intact foods, four exposed cut faces, ketchup, mustard, chilli, chilli red glow and complete chopping-board/counter/tile/utensil/knife-block/towel/daylight background. Sprite cache capped at 96 variants. Cut clips, pulse tint, fuse sparks and short 110ms silver knife streak draw live without shadowBlur. Juice/crumbs and fuse particles share a total 32-particle frame cap; reduced motion removes animated particles and freezes pulse.

## Sound
Slice observer: arc_swoosh cuts, arc_crash bombs, arc_pickup collected specials; shared arcadeFeedback retains combo cue. Sea wave loop, cannon launch, sea coin and cutlass calls removed from Slice. Duplicate correct/wrong sound calls removed from Slice stage, haptic bomb feedback preserved. Other games and uploaded sound manifest unchanged.

## Checks
Four native-canvas normal/reduced-motion drawing checks use 382x510 and 367x477 available arenas (390x700 and 375x667 phone widths minus existing safety/HUD budgets), DPR 2. Exact 40px normal/bomb stamps and 32px specials at sim positions; every cached circle silhouette reaches all extents within 2 raster pixels. Warm frames allocate no new surfaces. Drawing leaves state unchanged. Fixed example shares cached food art in unchanged 168x120 slot. Shared FX checks passed. No arena layout, controls or input handlers changed. No browsers or identity proofs ran; actual phone appearance/no-scroll/audio/performance remains for user device testing.

## Protected source
Only three existing source files changed: Slice renderer, Slice sound observer, Slice stage sound/fixed-example presentation. All simulation, spawn tables, specials, input encoding, checkpoints, graders, scoring and other existing source files are byte-identical to pre-change SHA-256 fingerprints. Existing route-specific metadata inspected and retained.
