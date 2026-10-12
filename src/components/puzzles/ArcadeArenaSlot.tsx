import type { CSSProperties, ReactNode } from "react";

/**
 * The space an arcade arena may grow into: from the arena's fixed top edge down to
 * the controls below it (or the bottom safe area). Its one child carrying
 * `data-game-arena` is sized by CSS (styles.css, "Arcade arena slot") to the game's
 * world aspect ratio at the largest uniform scale that fits, top-anchored and
 * centred across, so every phone shows exactly the same world, undistorted. The
 * slot paints the arena's own background, so spare space reads as part of the game.
 *
 * Presentation only: games keep mapping pointers through the arena element's own
 * box, so world coordinates, input logs and replays are unchanged.
 */
export function ArcadeArenaSlot({ width, height, background, children }: {
  /** World (view) size the game draws, in world units. */
  width: number;
  height: number;
  /** The arena's own background colour. */
  background: string;
  children: ReactNode;
}) {
  return (
    <div
      data-arena-slot=""
      style={{ background, "--arena-w": width, "--arena-h": height } as CSSProperties}
    >
      {children}
    </div>
  );
}
