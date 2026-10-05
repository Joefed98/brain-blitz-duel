import { demoHushed, playSound } from "@/lib/sound";
import { DEFAULT_SOUNDS, type FxHook, type GameTheme, type Primitive } from "./theme";

export const FX_EVENT = "duelz-fx";
export interface FxEvent { hook: FxHook; primitive: Primitive; value?: number | string | undefined; }
const PRIMITIVES: Record<FxHook, Primitive> = {
  onRoundStart: "slideIn", onCountdown: "pop", onPlace: "pop", onMove: "trail",
  onCorrect: "burst", onWrong: "shake", onStageComplete: "glow", onComplete: "burst",
  onCombo: "scorePop", onTimerWarning10: "timerPulse", onTimerWarning5: "timerPulse",
  onTimeUp: "glow", onSubmit: "pop", onRevealScore: "scorePop", onPodium: "burst", onReaction: "pop",
};
export function visualFx(hook: FxHook, value?: number | string, theme?: GameTheme): void {
  if (typeof window === "undefined" || demoHushed()) return;
  window.dispatchEvent(new CustomEvent<FxEvent>(FX_EVENT, { detail: { hook, primitive: theme?.overrides[hook] ?? PRIMITIVES[hook], value } }));
}
export function triggerFx(hook: FxHook, value?: number | string, theme?: GameTheme): void {
  if (demoHushed()) return;
  const sound = theme?.sounds[hook] ?? DEFAULT_SOUNDS[hook];
  playSound(sound);
  visualFx(hook, value, theme);
}
export const fx = Object.fromEntries(Object.keys(PRIMITIVES).map(hook => [hook,
  (value?: number | string, theme?: GameTheme) => triggerFx(hook as FxHook, value, theme),
])) as Record<FxHook, (value?: number | string, theme?: GameTheme) => void>;