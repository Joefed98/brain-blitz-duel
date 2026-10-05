import { useEffect, useRef } from "react";
import { FX_EVENT, setFxTheme, visualFx, type FxEvent } from "@/lib/fx";
import { animateFx } from "@/lib/fx/motion";
import { prefersReducedMotion } from "@/lib/motion";
import type { FxHook, GameTheme } from "@/lib/fx/theme";

/** Bounded, layout-free effects; never transforms the puzzle or its hit regions. */
export function FxLayer({ theme }: { theme?: GameTheme | undefined }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => setFxTheme(theme), [theme]);
  useEffect(() => {
    const nodes = new Set<HTMLElement>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const add = (event: FxEvent) => {
      const host = layer.current;
      if (!host || nodes.size >= 32) return;
      const reduced = prefersReducedMotion();
      const count = Math.min(32 - nodes.size, event.primitive === "burst" && !reduced ? 12 : 1);
      for (let i = 0; i < count; i++) {
        const node = document.createElement("span");
        node.className = `fx-particle ${event.hook === "onWrong" || event.hook === "onTimerWarning5" ? "fx-danger" : ""}`;
        if (event.primitive === "glow" || event.primitive === "shake") node.classList.add("fx-outline");
        if (event.primitive === "scorePop") {
          node.className = "fx-score font-mono";
          node.textContent = event.hook === "onCombo" ? `×${event.value ?? 1}` : event.value === undefined ? "" : `+${event.value}`;
        }
        host.appendChild(node);
        nodes.add(node);
        if (count > 1) {
          const angle = i * Math.PI * 2 / count;
          node.animate([{ opacity: 0.8, transform: "translate(0,0)" }, { opacity: 0, transform: `translate(${Math.cos(angle) * 32}px,${Math.sin(angle) * 32}px)` }], { duration: 400, easing: "ease-out" });
        } else animateFx(node, event.primitive);
        const timer = setTimeout(() => { node.remove(); nodes.delete(node); timers.delete(timer); }, event.primitive === "timerPulse" ? 1000 : 400);
        timers.add(timer);
      }
    };
    const listen = (event: Event) => add((event as CustomEvent<FxEvent>).detail);
    // Existing puzzle sounds are compatibility adapters, not duplicate audio.
    const cue = (event: Event) => {
      const name = (event as CustomEvent<string>).detail;
      const hook: FxHook | undefined = name === "correct" ? "onCorrect" : name === "wrong" ? "onWrong" : name === "lock" ? "onSubmit" : undefined;
      if (hook) visualFx(hook);
    };
    window.addEventListener(FX_EVENT, listen);
    window.addEventListener("duelz-cue", cue);
    return () => {
      window.removeEventListener(FX_EVENT, listen);
      window.removeEventListener("duelz-cue", cue);
      timers.forEach(clearTimeout); nodes.forEach(node => node.remove());
    };
  }, []);
  return <div ref={layer} className="fx-layer" aria-hidden="true" />;
}