import type { PuzzleCategory, PuzzleType } from "@/lib/duel/types";
import type { SoundId } from "./manifest";

export const FX_HOOKS = ["onRoundStart", "onCountdown", "onPlace", "onMove", "onCorrect", "onWrong", "onStageComplete", "onComplete", "onCombo", "onTimerWarning10", "onTimerWarning5", "onTimeUp", "onSubmit", "onRevealScore", "onPodium", "onReaction"] as const;
export type FxHook = typeof FX_HOOKS[number];
export type Primitive = "pop" | "shake" | "burst" | "trail" | "glow" | "scorePop" | "timerPulse" | "slideIn" | "slideOut";
export interface GameTheme {
  accent: PuzzleCategory;
  particleShape: "disc" | "square" | "diamond";
  sounds: Partial<Record<FxHook, SoundId>>;
  overrides: Partial<Record<FxHook, Primitive>>;
  /** In-round music bed, or null for silence. */
  music: SoundId | null;
}
const CATEGORY_MUSIC: Partial<Record<PuzzleCategory, SoundId>> = {
  word: "music_word", number: "music_number", speed: "music_speed",
  attention: "music_attention", logic: "music_logic", pattern: "music_pattern",
};
/** Arcade round music follows each game's world. */
const WORLD_MUSIC: Partial<Record<PuzzleType, SoundId>> = {
  hover: "music_retro", snake: "music_retro", beat: "music_retro", breaker: "music_retro", rally: "music_retro", burst: "music_retro",
  orbit: "music_space", wavefront: "music_space",
  tilt: "music_toybox", balltrack: "music_toybox",
  bintoss: "music_fairground", bullseye: "music_fairground",
  inkbridge: "music_rainbow", snip: "music_orchard",
  flip: "music_lava", swing: "music_lava", slice: "music_kitchen",
  skyline: "music_city", junction: "music_city", cross: "music_city",
  bubble: "music_bubble", matchup: "music_matchup",
};
export function roundMusicFor(type: PuzzleType | undefined, category: PuzzleCategory): SoundId | null {
  return (category === "arcade" ? (type ? WORLD_MUSIC[type] : undefined) : CATEGORY_MUSIC[category]) ?? null;
}
export const DEFAULT_SOUNDS: Record<FxHook, SoundId> = {
  onRoundStart: "round_start", onCountdown: "tick", onPlace: "place", onMove: "move",
  onCorrect: "correct", onWrong: "wrong", onStageComplete: "stage_complete",
  onComplete: "complete", onCombo: "combo", onTimerWarning10: "warning_10",
  onTimerWarning5: "warning_5", onTimeUp: "time_up", onSubmit: "submit",
  onRevealScore: "reveal_score", onPodium: "podium_fanfare", onReaction: "reaction",
};
/** Presentation overrides only. Category is supplied by the authoritative registry. */
export const GAME_THEME_OVERRIDES: Partial<Record<PuzzleType, Partial<GameTheme>>> = {};
export function gameTheme(type: PuzzleType | undefined, category: PuzzleCategory = "arcade"): GameTheme {
  const override = type ? GAME_THEME_OVERRIDES[type] : undefined;
  return { accent: category, particleShape: "disc", ...override,
    sounds: { ...DEFAULT_SOUNDS, ...override?.sounds }, overrides: override?.overrides ?? {},
    music: override?.music !== undefined ? override.music : roundMusicFor(type, category) };
}