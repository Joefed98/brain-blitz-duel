import { demoHushed, playSound, startWarning10 } from "@/lib/sound";
import { DEFAULT_SOUNDS, type FxHook, type GameTheme, type Primitive } from "./theme";

export const FX_EVENT = "duelz-fx";
export interface FxEvent { hook: FxHook; primitive: Primitive; value?: number | string | undefined; }
const PRIMITIVES: Record<FxHook, Primitive> = {
  onRoundStart: "slideIn", onCountdown: "pop", onPlace: "pop", onMove: "trail",
  onCorrect: "burst", onWrong: "shake", onStageComplete: "glow", onComplete: "burst",
  onCombo: "scorePop", onTimerWarning10: "timerPulse", onTimerWarning5: "timerPulse",
  onTimeUp: "glow", onSubmit: "pop", onRevealScore: "scorePop", onPodium: "burst", onReaction: "pop",
};
let activeTheme: GameTheme | undefined;
const recent = new Map<FxHook, number>();
const recentAudio = new Map<FxHook, number>();
export function setFxTheme(theme?: GameTheme): () => void {
  const previous = activeTheme;
  activeTheme = theme;
  return () => { if (activeTheme === theme) activeTheme = previous; };
}
export function visualFx(hook: FxHook, value?: number | string, theme?: GameTheme): void {
  if (typeof window === "undefined" || demoHushed()) return;
  const now = Date.now();
  if (now - (recent.get(hook) ?? 0) < 60) return;
  recent.set(hook, now);
  window.dispatchEvent(new CustomEvent<FxEvent>(FX_EVENT, { detail: { hook, primitive: (theme ?? activeTheme)?.overrides[hook] ?? PRIMITIVES[hook], value } }));
}
export function triggerFx(hook: FxHook, value?: number | string, theme?: GameTheme): void {
  if (demoHushed()) return;
  const now = Date.now();
  if (now - (recentAudio.get(hook) ?? 0) < 60) return;
  recentAudio.set(hook, now);
  // The 5 s mark is visual-only; warning_5 stays in the manifest unused.
  if (hook === "onTimerWarning5") {
    visualFx(hook, value, theme);
    return;
  }
  // The 10 s mark starts the countdown cue; `value` is the offset in seconds
  // for players who joined inside the last 10 s.
  if (hook === "onTimerWarning10") {
    startWarning10(typeof value === "number" ? value : 0);
    visualFx(hook, value, theme);
    return;
  }
  const sound = (theme ?? activeTheme)?.sounds[hook] ?? DEFAULT_SOUNDS[hook];
  if (sound) playSound(sound);
  visualFx(hook, value, theme);
}
export const fx = Object.fromEntries(Object.keys(PRIMITIVES).map(hook => [hook,
  (value?: number | string, theme?: GameTheme) => triggerFx(hook as FxHook, value, theme),
])) as Record<FxHook, (value?: number | string, theme?: GameTheme) => void>;