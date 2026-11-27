/**
 * Where a game's canvas HUD is drawn (the Cabinet, polish plan B1, 20 Nov 2026): inside the world (every phone and
 * tablet, and every computer until the arena's side panels draw the values) or in the arena's panel instead.
 *
 * Display only. The sims never read this; the stage sets it for the length of one draw call, and the HUD painters
 * (retroHud, drawActionHud, drawHudPillRow, drawHudTextPillRow, the cards' drawChip) return early when it is off.
 * Nothing imports React here, so renderers and the checks' Node renders can use it; the default is "in the world", so
 * every pixel digest recorded before the flag is unchanged.
 *
 * The value channel (P4's "The canvas HUD in the panel", docs/desktop-support.md): every painter above, and
 * drawHudPill, notes each item it shows (`noteHud`) before it returns early, so a draw made with the HUD off the world
 * still yields its values. The list is kept only inside a stage's draw (`withHudInWorld`, which clears it first) and read
 * after it with `takeHud()`; outside one (replays, reveals, intro stills, the checks' renders) nothing is kept. Recording
 * never touches the canvas, so what each painter draws is unchanged.
 */
let inWorld = true;

/** One HUD value as the arena's panel would list it: `main` is the run's big count. */
export interface HudItem {
  label: string;
  value: string;
  gold?: boolean | undefined;
  main?: boolean | undefined;
}

/** The current draw's items; null outside a stage's draw, so nothing is kept there. */
let items: HudItem[] | null = null;

/** Notes one HUD item for the panel. A no-op outside a stage's draw. */
export function noteHud(item: HudItem): void {
  if (!items) return;
  const out: HudItem = { label: item.label, value: item.value };
  if (item.gold) out.gold = true;
  if (item.main) out.main = true;
  items.push(out);
}

/** The items the last stage draw noted, in drawing order. */
let last: HudItem[] = [];
export function takeHud(): HudItem[] {
  return last.slice();
}

/** True while the canvas HUD belongs in the world (the default). */
export const hudInWorld = (): boolean => inWorld;

/** The stage's setting for one draw call; restore it after (`withHudInWorld`). */
export function setHudInWorld(value: boolean): void {
  inWorld = value;
}

/** Runs `draw` with the HUD placement set, restoring the previous value whatever happens. */
export function withHudInWorld<T>(value: boolean, draw: () => T): T {
  const before = inWorld;
  const outer = items;
  inWorld = value;
  items = [];
  try {
    return draw();
  } finally {
    last = items ?? [];
    items = outer;
    inWorld = before;
  }
}
