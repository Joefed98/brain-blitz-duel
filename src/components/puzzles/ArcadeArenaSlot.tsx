import type { CSSProperties, ReactNode } from "react";

/**
 * The space an arcade arena may grow into: from the arena's fixed top edge down to
 * the controls below it (or the bottom safe area). Its one child carrying
 * `data-game-arena` is sized by CSS (styles.css, "Arcade arena slot") to the game's
 * world aspect ratio at the largest uniform scale that fits, top-anchored and
 * centred across, so every phone shows exactly the same world, undistorted. Spare
 * height below the arena is painted the arena's own colour (the slot's ::after, as
 * wide as the arena), so it reads as part of the game; spare width stays page.
 *
 * Presentation only: games keep mapping pointers through the arena element's own
 * box, so world coordinates, input logs and replays are unchanged.
 */
export function ArcadeArenaSlot({ width, height, background, drop, children }: {
  /** World (view) size the game draws, in world units. */
  width: number;
  height: number;
  /** The arena's own colour, painted below it on tall screens. */
  background: string;
  /** Px the slot (and so the arena) starts below the fixed top edge; Tilt only (TILT_ARENA_DROP). */
  drop?: number | undefined;
  children: ReactNode;
}) {
  return (
    <div
      data-arena-slot=""
      style={{ "--arena-fill": background, "--arena-w": width, "--arena-h": height, ...(drop ? { marginTop: drop } : {}) } as CSSProperties}
    >
      {children}
    </div>
  );
}
