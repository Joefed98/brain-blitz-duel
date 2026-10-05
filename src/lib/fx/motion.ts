import { prefersReducedMotion } from "@/lib/motion";
import type { Primitive } from "./theme";

const frames: Record<Primitive, Keyframe[]> = {
  pop: [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
  shake: [0, -4, 4, -4, 4, 0].map(x => ({ transform: `translateX(${x}px)` })),
  burst: [{ opacity: 1 }, { opacity: 0 }],
  trail: [{ opacity: 0.5 }, { opacity: 0 }],
  glow: [{ opacity: 0.4 }, { opacity: 1 }, { opacity: 0.4 }],
  scorePop: [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-20px)" }],
  timerPulse: [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }],
  slideIn: [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
  slideOut: [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-8px)" }],
};
export const MOTION_MS: Record<Primitive, number> = { pop: 180, shake: 250, burst: 400, trail: 200, glow: 400, scorePop: 400, timerPulse: 1000, slideIn: 200, slideOut: 200 };
export function animateFx(element: Element, primitive: Primitive): Animation | undefined {
  if (typeof element.animate !== "function") return;
  const reduced = prefersReducedMotion();
  return element.animate(reduced ? [{ opacity: 0.65 }, { opacity: 1 }] : frames[primitive],
    { duration: reduced ? 160 : MOTION_MS[primitive], easing: "ease-out" });
}