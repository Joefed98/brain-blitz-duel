/**
 * Iron Wall's look rules that both the art and the sound observer read (Action overhaul, 15 Nov 2026; display and sound
 * only, never imported by the sim or the server): the setting by wave, the panel's rows and the one-time reload tip.
 */
import { bastionTankRects, bastionWave, BT2_HORIZON_Y, BT2_WAVE_START, type BastionTankState, type Bt2Impact } from "./bastionTank";

/**
 * The setting (Action overhaul, 15 Nov 2026; display only, every tank revision, the same for every player): the battle
 * changes the land as the waves come. Waves 1–2 a clear evening (slate sky going pale at the horizon, crisp peaks),
 * waves 3–4 a dusty desert (an amber haze, rolling sand hills), wave 5 a battle-smoke storm (a red-orange sky, smoke
 * columns rising off the horizon). Only the backdrop changes: the road, its lanes, the tanks and the crosshair keep their
 * colours, and every haze stays behind the tanks, so nothing gets harder to read.
 */
export const BT_SETTINGS = ["clear", "dust", "storm"] as const;
export type BtSetting = 0 | 1 | 2;
/** The wave (0-based) each setting starts on. */
export const BT_SETTING_FROM_WAVE = [0, 2, 4] as const;
/** Ticks one setting takes to cross-fade into the next, from its wave's start. */
export const BT_SETTING_FADE = 90;
/**
 * The fade's steps: the world and the scene beyond it (painted once per step, never per frame) both draw the same
 * stepped opacity, so the world's edge never shows a seam while a setting fades in (10 steps of 9 ticks).
 */
export const BT_SETTING_STEPS = 10;

/** The setting a wave (0-based) is fought in. */
export function bastionSettingOf(wave: number): BtSetting {
  return wave >= BT_SETTING_FROM_WAVE[2] ? 2 : wave >= BT_SETTING_FROM_WAVE[1] ? 1 : 0;
}

/** The setting drawn at this point of the run: `from` under `to` at opacity `mix` (0…1; 1 once the fade is done). */
export function bastionSettingMix(state: Pick<BastionTankState, "tick">): { from: BtSetting; to: BtSetting; mix: number } {
  const wave = bastionWave(state as BastionTankState);
  const to = bastionSettingOf(wave);
  if (to === 0) return { from: 0, to: 0, mix: 1 };
  const start = BT2_WAVE_START[BT_SETTING_FROM_WAVE[to]]!;
  const raw = Math.max(0, Math.min(1, (state.tick - start) / BT_SETTING_FADE));
  const mix = Math.floor(raw * BT_SETTING_STEPS + 1e-9) / BT_SETTING_STEPS;
  return { from: (to - 1) as BtSetting, to, mix };
}

/** The setting being fought in now (its wave's; the sound observer's ambience). */
export function bastionSettingNow(state: Pick<BastionTankState, "tick">): BtSetting {
  return bastionSettingOf(bastionWave(state as BastionTankState));
}

/**
 * The scene's key (ArcadeCanvasStage's sceneKey): the setting and its fade step, so the scenery beyond the world is
 * repainted once per step of a fade (at most 2 × 10 times a run) and always matches the world's edge.
 */
export function bastionSceneKey(state: Pick<BastionTankState, "tick">): string {
  const m = bastionSettingMix(state);
  return m.mix >= 1 ? `${m.to}` : `${m.from}>${m.to}@${m.mix}`;
}

/** The panel's rows (world px): the shells, the reload bar, the hint and the one-time tip. */
export const BT_PANEL_SHELLS_Y = 648;
export const BT_PANEL_RELOAD_Y = 672;
export const BT_PANEL_HINT_Y = 694;
export const BT_PANEL_TIP_Y = 711;
/** The one-time tip shown the first time the magazine runs dry. */
export const BT_SWIPE_HINT = "Tip: swipe down to reload early";

/**
 * Whether the reload-swipe tip shows: only during the run's first reload, and only when that reload began with the
 * magazine empty (a player whose first reload was a swipe already knows it). So it shows at most once a run, never
 * again after that reload ends; worked out from the sim's own counters, so replays draw it the same.
 */
export function bastionSwipeHint(state: Pick<BastionTankState, "reloadAt" | "reloads" | "mag">): boolean {
  return state.reloadAt >= 0 && state.reloads === 1 && state.mag === 0;
}

/**
 * A near miss (display and sound only): a shell that landed on open ground (not in the sky) within one tank-length of
 * a tank's hull, at that tank's own size.
 */
export function bastionNearMiss(state: Pick<BastionTankState, "tanks">, m: Pick<Bt2Impact, "x" | "y" | "r">): boolean {
  if (m.r !== 0 || m.y < BT2_HORIZON_Y) return false;
  for (const t of state.tanks) {
    const [x0, y0, x1, y1] = bastionTankRects(t.kind, t.lane, t.z).hull;
    const len = x1 - x0;
    const dx = Math.max(x0 - m.x, 0, m.x - x1);
    const dy = Math.max(y0 - m.y, 0, m.y - y1);
    if (Math.hypot(dx, dy) <= len) return true;
  }
  return false;
}

/* ------------------------------------------------------------------------------------------------------------------
 * Stage 2: effects and the answer reveal (Action overhaul, 15 Nov 2026; display and sound only, every tank revision).
 * Every effect below is worked out from the sim's own state (its counters, cooldown, reload fields and impacts), so a
 * replay draws and sounds it the same; nothing here writes to a state.
 * ---------------------------------------------------------------------------------------------------------------- */

/** The barrel's kick when it fires: this many px back along the barrel (the barrel only, never the world). */
export const BT_KICK_PX = 3;
/** …for this many ticks (80 ms), easing back. */
export const BT_KICK_TICKS = 5;
/** The muzzle flash: this many ticks (50 ms) from the shot. */
export const BT_FLASH_TICKS = 3;
/** The fire cooldown the sim sets on a shot (bastionTank.ts BT2_FIRE_COOL): ticks since the shot = this − cool. */
const FIRE_COOL = 15;

/** Ticks since the last shot (null when none in the cooldown). */
export function bastionSinceShot(state: Pick<BastionTankState, "cool" | "shots">): number | null {
  if (state.shots === 0 || state.cool <= 0) return null;
  return FIRE_COOL - state.cool;
}

/** The barrel's kick now (px back along the barrel): full for the first tick, easing to 0 by BT_KICK_TICKS. */
export function bastionKick(state: Pick<BastionTankState, "cool" | "shots">): number {
  const since = bastionSinceShot(state);
  if (since === null || since >= BT_KICK_TICKS) return 0;
  return since <= 1 ? BT_KICK_PX : (BT_KICK_PX * (BT_KICK_TICKS - since)) / (BT_KICK_TICKS - 1);
}

/** The muzzle flash's age in ticks (0 = the shot's tick), or null when it is over. */
export function bastionFlashAge(state: Pick<BastionTankState, "cool" | "shots">): number | null {
  const since = bastionSinceShot(state);
  return since !== null && since < BT_FLASH_TICKS ? since : null;
}

/**
 * A fast reload's shells snapping in one by one as it ends: shell n lights BT_SNAP_STEP × n ticks after the reload's
 * end (each with a click, `bastion.shellIn`). The sim has already filled the magazine (the next shot is taken at once);
 * only the slots light in turn.
 */
export const BT_SNAP_STEP = 4;
/** How many slots are lit during a fast reload's snap (null outside it). */
export function bastionSnapLit(state: Pick<BastionTankState, "tick" | "reloadAt" | "reloadTap" | "reloadEnd">, mag = 5): number | null {
  if (state.reloadAt >= 0 || state.reloadTap !== 1) return null;
  const since = state.tick - state.reloadEnd;
  if (since < 0 || since >= BT_SNAP_STEP * mag) return null;
  return Math.min(mag, Math.floor(since / BT_SNAP_STEP) + 1);
}

/** A jam's shake: the needle shakes this long (ticks) from the jam, in red. */
export const BT_JAM_SHAKE_TICKS = 18;

/**
 * The points a destroyed tank's armour is worth on a revision (the "+n" rising off it): its hit points on the Armour line.
 * `full`: bastionRev 5's Armour line (the level's hit points that fill it); older revisions keep the 63-point line.
 */
export function bastionKillPoints(kind: number, rev: number, full?: number): number {
  const hp = [1, 2, 4][kind] ?? 1;
  if (full !== undefined && full > 0) return Math.max(1, Math.round((110 * hp) / full));
  return Math.max(1, Math.round(((rev >= 3 ? 110 : 140) * hp) / 63));
}

/**
 * The end card (display and sound only): once the run is over the field dims, the five waves tally one by one (each
 * with `bastion.tally`, a step higher), then WALL HELD (`bastion.wallHeld`) or BASE DOWN. The stage holds its submit
 * BT_END_HOLD_MS so it plays before the reveal (the finished run is the draft meanwhile); reduced motion shows it whole.
 */
export const BT_TALLY_FIRST_MS = 120;
export const BT_TALLY_STEP_MS = 150;
export const BT_HELD_AT_MS = BT_TALLY_FIRST_MS + 5 * BT_TALLY_STEP_MS + 120;
export const BT_END_HOLD_MS = 1800;
/** The stage's submit hold for an ended tank run (every tank revision). */
export function bastionEndHoldMs(state: Pick<BastionTankState, "ended">): number {
  return state.ended !== 0 ? BT_END_HOLD_MS : 0;
}
/** How many wave rows of the end card show `ms` after the end (0–5). */
export function bastionTallyRows(ms: number, waves = 5): number {
  if (ms < BT_TALLY_FIRST_MS) return 0;
  return Math.min(waves, Math.floor((ms - BT_TALLY_FIRST_MS) / BT_TALLY_STEP_MS) + 1);
}

/* ----------------------------------------------------------------------------------------------------- the ledger */

/** What became of each tank: 0 never destroyed (still rolling, or not yet on), 1 destroyed, 2 reached the wall. */
export type BtFate = 0 | 1 | 2;
export interface BtLedger {
  seed: number;
  /** The last state folded in. */
  tick: number;
  /** Per plan tank (spawn order): its fate, its weak-spot hits, and the tick it was destroyed or reached the wall. */
  fate: BtFate[];
  weakOn: number[];
  at: number[];
  /** Plan indices in the order they reached the wall (the base hits). */
  breaches: number[];
  /** The tick each drone was downed (null: never). */
  drones: (number | null)[];
  /** Weak-spot hits the ledger could not put on a tank (0 on a tick-by-tick replay). */
  weakLoose: number;
}

export function bastionLedgerStart(seed: number, tanks: number, drones = 3): BtLedger {
  return {
    seed,
    tick: 0,
    fate: Array.from({ length: tanks }, () => 0 as BtFate),
    weakOn: Array.from({ length: tanks }, () => 0),
    at: Array.from({ length: tanks }, () => -1),
    breaches: [],
    drones: Array.from({ length: drones }, () => null),
    weakLoose: 0,
  };
}

const rectDist = (r: readonly [number, number, number, number], x: number, y: number) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - y, 0, y - r[3]));

/**
 * Folds the step from `prev` to `next` into the ledger (any number of ticks apart; exact tick by tick). Tanks gone
 * since `prev` were destroyed or reached the wall: the sim's counters say how many of each, and those that reached the
 * wall are the ones that were nearest it. A weak-spot landing goes on the tank under it.
 */
export function bastionLedgerStep(l: BtLedger, prev: BastionTankState, next: BastionTankState): void {
  if (next.tick <= l.tick) return;
  const nowIds = new Set(next.tanks.map((t) => t.i));
  const gone = prev.tanks.filter((t) => !nowIds.has(t.i)).sort((a, b) => a.z - b.z || a.i - b.i);
  const dB = Math.max(0, next.breached - prev.breached);
  gone.forEach((t, n) => {
    const fate: BtFate = n < dB ? 2 : 1;
    l.fate[t.i] = fate;
    l.at[t.i] = next.tick;
    if (fate === 2) l.breaches.push(t.i);
  });
  for (const m of next.impacts) {
    if (m.t <= prev.tick || (m.r !== 2 && m.r !== 4)) continue;
    const pool = m.r === 4 ? gone.filter((t) => l.fate[t.i] === 1) : next.tanks;
    let best = -1;
    let bestD = Infinity;
    for (const t of pool) {
      const d = rectDist(bastionTankRects(t.kind, t.lane, t.z).hull, m.x, m.y);
      if (d < bestD) (bestD = d), (best = t.i);
    }
    if (best >= 0) l.weakOn[best] = (l.weakOn[best] ?? 0) + 1;
    else l.weakLoose += 1;
  }
  for (let n = 0; n < l.drones.length; n++) if (next.droneMask & (1 << n) && !(prev.droneMask & (1 << n)) && l.drones[n] === null) l.drones[n] = next.tick;
  l.tick = next.tick;
}

/** One wave's tally from a ledger: its tanks' fates (spawn order) and weak-spot hits, and its kills. */
export interface BtWaveTally {
  wave: number;
  tanks: { i: number; kind: number; fate: BtFate; weak: number }[];
  kills: number;
  through: number;
  weak: number;
}
export function bastionWaveTallies(l: BtLedger, plan: readonly { wave: number; kind: number }[], waves = 5): BtWaveTally[] {
  const out: BtWaveTally[] = Array.from({ length: waves }, (_, wave) => ({ wave, tanks: [], kills: 0, through: 0, weak: 0 }));
  plan.forEach((p, i) => {
    const w = out[p.wave];
    if (!w) return;
    const fate = l.fate[i] ?? 0;
    const weak = l.weakOn[i] ?? 0;
    w.tanks.push({ i, kind: p.kind, fate, weak });
    if (fate === 1) w.kills += 1;
    if (fate === 2) w.through += 1;
    w.weak += weak;
  });
  return out;
}
