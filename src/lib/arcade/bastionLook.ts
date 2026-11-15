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
