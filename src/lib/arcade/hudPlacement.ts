/**
 * Where a game's canvas HUD is drawn (the Cabinet, polish plan B1, 20 Nov 2026): inside the world (every phone and
 * tablet, and every computer until the arena's side panels draw the values) or in the arena's panel instead.
 *
 * Display only. The sims never read this; the stage sets it for the length of one draw call, and the HUD painters
 * (retroHud, drawActionHud, drawHudPillRow, drawHudTextPillRow, the cards' drawChip) return early when it is off.
 * Nothing imports React here, so renderers and the checks' Node renders can use it; the default is "in the world", so
 * every pixel digest recorded before the flag is unchanged.
 */
let inWorld = true;

/** True while the canvas HUD belongs in the world (the default). */
export const hudInWorld = (): boolean => inWorld;

/** The stage's setting for one draw call; restore it after (`withHudInWorld`). */
export function setHudInWorld(value: boolean): void {
  inWorld = value;
}

/** Runs `draw` with the HUD placement set, restoring the previous value whatever happens. */
export function withHudInWorld<T>(value: boolean, draw: () => T): T {
  const before = inWorld;
  inWorld = value;
  try {
    return draw();
  } finally {
    inWorld = before;
  }
}
