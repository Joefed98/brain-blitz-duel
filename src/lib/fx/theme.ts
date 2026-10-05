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
    sounds: { ...DEFAULT_SOUNDS, ...override?.sounds }, overrides: override?.overrides ?? {} };
}