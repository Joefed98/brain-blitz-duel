import type { CSSProperties, ReactNode } from "react";

/**
 * The space an arcade arena may grow into: from the arena's fixed top edge (just under
 * the play screen's compact header) down to the controls below it, or 16px above the
 * bottom of the visible screen. Its one child carrying `data-game-arena` is sized by
 * CSS (styles.css, "Arcade arena slot") to the game's world aspect ratio at the largest
 * uniform scale that fits, top-anchored and centred across, so every phone shows
 * exactly the same world, undistorted. The slot runs edge to edge; every gap around the
 * world (beside it, below it) is the screen edge's black (--screen-edge, 15 Oct 2026),
 * the same as the rest of the arcade play screen.
 *
 * Presentation only: games keep mapping pointers through the arena element's own
 * box, so world coordinates, input logs and replays are unchanged.
 */
export function ArcadeArenaSlot({ width, height, children }: {
  /** World (view) size the game draws, in world units. */
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <div data-arena-slot="" style={{ "--arena-w": width, "--arena-h": height } as CSSProperties}>
      {children}
    </div>
  );
}
