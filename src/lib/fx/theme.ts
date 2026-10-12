import type { PuzzleCategory, PuzzleType } from "@/lib/duel/types";
import type { SoundId } from "./manifest";

export const FX_HOOKS = [
  "onRoundStart",
  "onCountdown",
  "onPlace",
  "onMove",
  "onCorrect",
  "onWrong",
  "onStageComplete",
  "onComplete",
  "onCombo",
  "onTimerWarning10",
  "onTimerWarning5",
  "onTimeUp",
  "onSubmit",
  "onRevealScore",
  "onPodium",
  "onReaction",
] as const;
export type FxHook = (typeof FX_HOOKS)[number];
export type Primitive =
  "pop" | "shake" | "burst" | "trail" | "glow" | "scorePop" | "timerPulse" | "slideIn" | "slideOut";
export interface GameTheme {
  accent: PuzzleCategory;
  particleShape: "disc" | "square" | "diamond";
  sounds: Partial<Record<FxHook, SoundId>>;
  overrides: Partial<Record<FxHook, Primitive>>;
  /** In-round music bed, or null for silence. */
  music: SoundId | null;
}
/** Fallback for puzzle games without a per-game mapping. */
const CATEGORY_MUSIC: Partial<Record<PuzzleCategory, SoundId>> = {
  word: "music_word_1",
  number: "music_number_1",
  speed: "music_speed_1",
  attention: "music_attention_1",
  logic: "music_logic_1",
  pattern: "music_pattern_1",
};
/** Per-game puzzle round music (includes arcade-engine puzzle games such as Ten Drop). */
const PUZZLE_MUSIC: Partial<Record<PuzzleType, SoundId>> = {
  wordsmith: "music_word_1",
  letterwheel: "music_word_1",
  strikeout: "music_word_1",
  codeword: "music_word_2",
  swapword: "music_word_3",
  wordhunt: "music_word_2",
  wordsearch: "music_word_2",
  tilegrid: "music_word_3",
  wordslide: "music_word_3",
  wordfall: "music_word_2",
  target: "music_number_1",
  equation: "music_number_1",
  balance: "music_number_2",
  numpyramid: "music_number_2",
  trail: "music_number_3",
  measure: "music_number_1",
  checkout: "music_number_2",
  numline: "music_number_3",
  tendrop: "music_number_3",
  reaction: "music_speed_1",
  stopwatch: "music_speed_1",
  numhunt: "music_speed_2",
  chain: "music_speed_2",
  whack: "music_speed_3",
  clayshoot: "music_speed_3",
  spotdiff: "music_attention_1",
  intruder: "music_attention_1",
  countup: "music_attention_1",
  symscan: "music_attention_2",
  pairmatch: "music_attention_2",
  stroop: "music_attention_3",
  maze: "music_attention_3",
  tiles: "music_pattern_1",
  rings: "music_pattern_1",
  blockparty: "music_pattern_1",
  unblock: "music_pattern_2",
  iceslide: "music_pattern_2",
  gravity: "music_pattern_3",
  laser: "music_pattern_3",
  sudoku: "music_logic_1",
  nonogram: "music_logic_1",
  shikaku: "music_logic_1",
  lightup: "music_logic_1",
  tents: "music_logic_1",
  pipes: "music_logic_2",
  lightsout: "music_logic_2",
  flow: "music_logic_2",
  flood: "music_logic_2",
  safe: "music_logic_2",
  push: "music_logic_3",
  tower: "music_logic_3",
  tubes: "music_logic_3",
  bomb: "music_logic_3",
};
/** Arcade round music is per game; Beat has none (its chart is the music). */
const WORLD_MUSIC: Partial<Record<PuzzleType, SoundId>> = {
  hover: "music_hover",
  snake: "music_eatgrow",
  breaker: "music_breaker",
  rally: "music_rally",
  burst: "music_burst",
  orbit: "music_orbit",
  wavefront: "music_wavefront",
  tilt: "music_tilt",
  balltrack: "music_balltrack",
  bintoss: "music_bintoss",
  bullseye: "music_bullseye",
  inkbridge: "music_inkbridge",
  snip: "music_snip",
  flip: "music_flip",
  swing: "music_swing",
  slice: "music_slice",
  skyline: "music_skyline",
  junction: "music_junction",
  cross: "music_cross",
  bubble: "music_bubble",
  matchup: "music_matchup",
};
function puzzleMusic(type: PuzzleType | undefined, category: PuzzleCategory): SoundId | null {
  return (type ? PUZZLE_MUSIC[type] : undefined) ?? CATEGORY_MUSIC[category] ?? null;
}
export function roundMusicFor(
  type: PuzzleType | undefined,
  category: PuzzleCategory,
): SoundId | null {
  return category === "arcade"
    ? type
      ? (WORLD_MUSIC[type] ?? null)
      : null
    : puzzleMusic(type, category);
}
/** onSubmit is visual-only (lock pop); it has no sound. */
export const DEFAULT_SOUNDS: Partial<Record<FxHook, SoundId>> = {
  onRoundStart: "round_start",
  onCountdown: "countdown_step",
  onPlace: "place",
  onMove: "move",
  onCorrect: "correct",
  onWrong: "wrong",
  onStageComplete: "stage_complete",
  onComplete: "complete",
  onCombo: "combo",
  onTimerWarning10: "warning_10",
  onTimerWarning5: "warning_5",
  onTimeUp: "time_up",
  onRevealScore: "reveal_score",
  onPodium: "podium_fanfare",
  onReaction: "reaction",
};
/** Presentation overrides only. Category is supplied by the authoritative registry. */
export const GAME_THEME_OVERRIDES: Partial<Record<PuzzleType, Partial<GameTheme>>> = {};
export function gameTheme(
  type: PuzzleType | undefined,
  category: PuzzleCategory = "arcade",
): GameTheme {
  const override = type ? GAME_THEME_OVERRIDES[type] : undefined;
  return {
    accent: category,
    particleShape: "disc",
    ...override,
    sounds: { ...DEFAULT_SOUNDS, ...override?.sounds },
    overrides: override?.overrides ?? {},
    music: override?.music !== undefined ? override.music : roundMusicFor(type, category),
  };
}
