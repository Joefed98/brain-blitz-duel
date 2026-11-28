# Proposal: the cut HUD band in three existing checks (P4 desktop size PR 1)

Not to be merged. Three patches for Joe to approve line by line before any is applied to `polish/p4-size-1` (PR 1).

On the arena, a game with a HUD band (src/lib/gameFrame/hudBands.ts) draws its world box taller than the space and
higher, so the band sits above (or below) the visible area by design. Three existing checks measure the world's whole
box and so report the cut part as off screen. Each patch lets them judge the box without the declared band;
hud-bands-check (PR 1) proves nothing the game draws ever reaches into it.

- `p4-arena-crop-arena-world-check.patch`: the box's on-screen test and every clipping ancestor's test skip the
  declared band; a turned game may not declare one ("a turned game may not declare a cut band").
- `p4-arena-crop-desktop-geometry-check.patch`: the largest-fit test measures the box without the band, and the board's
  foot test skips a foot band.
- `p4-arena-crop-desktop-layout-check.patch`: the world's on-screen test skips the band.

Every changed or added line carries "Changed with Joe's approval, 28 Nov 2026". Apply with `git apply <patch>`.
