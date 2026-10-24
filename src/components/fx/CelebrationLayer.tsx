import { useEffect, useRef } from "react";

import {
  BANNER_HOLD_MS,
  BANNER_IN_MS,
  BANNER_OUT_MS,
  setCelebrationSink,
  type CelebrationRequest,
} from "@/lib/fx/celebrations";
import { CelebrationScene } from "@/lib/fx/celebrationCanvas";

/**
 * The celebrations' one shared full-screen layer (Prompt P, 23 Oct 2026; src/lib/fx/celebrations.ts),
 * mounted once by the root: one canvas for sparks, the hero and the GO strike, and one banner pill.
 * Fixed over the whole screen with pointer-events none, so every tap reaches the content under it,
 * and nothing in it takes layout space. The canvas is hidden and its frame loop stopped whenever
 * nothing is drawn.
 */
export function CelebrationLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bannerRef = useRef<HTMLSpanElement>(null);
  const insetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const banner = bannerRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !banner || !ctx) return;
    const scene = new CelebrationScene();
    // The podium hero's loop is pre-drawn once into a small canvas (then one drawImage a frame).
    scene.makeCanvas = (w, h) => {
      const sprite = document.createElement("canvas");
      sprite.width = w;
      sprite.height = h;
      return sprite;
    };
    let raf = 0;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let bottomInset = 0;
    let anchor: Element | null = null;
    let bannerScope = 0;
    let bannerAnimation: Animation | null = null;
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measureAnchor());

    // Only what was drawn last frame is cleared (the scene's dirty box), never the whole screen per frame.
    let clearL = 0;
    let clearT = 0;
    let clearR = Infinity;
    let clearB = Infinity;
    const size = () => {
      ratio = Math.min(2, window.devicePixelRatio || 1);
      scene.spriteRatio = ratio;
      width = window.innerWidth;
      height = window.innerHeight;
      const w = Math.round(width * ratio);
      const h = Math.round(height * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      clearL = 0;
      clearT = 0;
      clearR = Infinity;
      clearB = Infinity;
      bottomInset = insetRef.current?.getBoundingClientRect().height ?? 0;
    };
    const measureAnchor = () => {
      const podium = scene.podium;
      if (!podium || !anchor) return;
      const box = anchor.getBoundingClientRect();
      podium.box.left = box.left;
      podium.box.top = box.top;
      podium.box.width = box.width;
      podium.box.height = box.height;
      request();
    };
    const frame = (time: number) => {
      raf = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (clearR > clearL && clearB > clearT) {
        const l = Math.max(0, Math.floor(clearL * ratio) - 2);
        const t = Math.max(0, Math.floor(clearT * ratio) - 2);
        ctx.clearRect(l, t, Math.min(canvas.width, Math.ceil(clearR * ratio) + 2) - l, Math.min(canvas.height, Math.ceil(clearB * ratio) + 2) - t);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      scene.draw(ctx, width, height, bottomInset, time);
      clearL = scene.dirtyL;
      clearT = scene.dirtyT;
      clearR = scene.dirtyR;
      clearB = scene.dirtyB;
      if (scene.animating(time)) raf = requestAnimationFrame(frame);
      else if (!scene.podium) canvas.style.display = "none";
    };
    const request = () => {
      if (canvas.style.display === "none") {
        canvas.style.display = "";
        size();
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const hideBanner = () => {
      bannerAnimation?.cancel();
      bannerAnimation = null;
      banner.style.opacity = "0";
      bannerScope = 0;
    };
    const showBanner = (text: string, calm: boolean, scope: number) => {
      bannerAnimation?.cancel();
      bannerScope = scope;
      banner.textContent = text;
      banner.style.opacity = "0";
      if (typeof banner.animate !== "function") return;
      const total = BANNER_IN_MS + BANNER_HOLD_MS + BANNER_OUT_MS;
      const inAt = BANNER_IN_MS / total;
      const outAt = (BANNER_IN_MS + BANNER_HOLD_MS) / total;
      bannerAnimation = banner.animate(
        calm
          ? [
              { opacity: 0, offset: 0 },
              { opacity: 1, offset: inAt },
              { opacity: 1, offset: outAt },
              { opacity: 0, offset: 1 },
            ]
          : [
              { opacity: 0, transform: "translate(-50%, -18px) scale(0.92)", offset: 0 },
              { opacity: 1, transform: "translate(-50%, 2px) scale(1.02)", offset: inAt * 0.75 },
              { opacity: 1, transform: "translate(-50%, 0) scale(1)", offset: inAt },
              { opacity: 1, transform: "translate(-50%, 0) scale(1)", offset: outAt },
              { opacity: 0, transform: "translate(-50%, -6px) scale(1)", offset: 1 },
            ],
        { duration: total, easing: "ease-out" },
      );
      bannerAnimation.onfinish = () => {
        if (bannerScope === scope) hideBanner();
      };
    };

    const handle = (request_: CelebrationRequest) => {
      const now = performance.now();
      switch (request_.kind) {
        case "burst":
          scene.burst(request_.scope, request_.x, request_.y, request_.w, request_.count, now);
          request();
          return;
        case "banner":
          showBanner(request_.text, request_.calm, request_.scope);
          if (request_.burst) {
            // Sparks off the pill as it lands (it is measured once, not per frame).
            const box = banner.getBoundingClientRect();
            scene.burst(request_.scope, box.left + box.width / 2, box.top + box.height / 2, box.width * 0.9, 44, now + 120);
            request();
          }
          return;
        case "heroRun":
          scene.heroRun(request_.scope, now);
          request();
          return;
        case "podiumHero": {
          if (anchor) watch?.unobserve(anchor);
          anchor = request_.anchor;
          const box = anchor.getBoundingClientRect();
          scene.podiumHero(request_.scope, { left: box.left, top: box.top, width: box.width, height: box.height }, request_.calm, now);
          watch?.observe(anchor);
          request();
          return;
        }
        case "strike":
          if (canvas.style.display === "none") {
            canvas.style.display = "";
            size();
          }
          scene.strike(width, height, now);
          request();
          return;
        case "clear":
          if (scene.podium?.scope === request_.scope && anchor) {
            watch?.unobserve(anchor);
            anchor = null;
          }
          scene.clear(request_.scope);
          if (bannerScope === request_.scope) hideBanner();
          request();
          return;
      }
    };

    canvas.style.display = "none";
    const resize = () => {
      if (canvas.style.display === "none") return;
      size();
      measureAnchor();
      request();
    };
    window.addEventListener("resize", resize);
    // A scrolling page moves the podium step: the hero follows it (measured on scroll, never per frame).
    window.addEventListener("scroll", measureAnchor, { capture: true, passive: true });
    const unset = setCelebrationSink(handle);
    return () => {
      unset();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", measureAnchor, { capture: true });
      watch?.disconnect();
      cancelAnimationFrame(raf);
      bannerAnimation?.cancel();
      scene.clearAll();
    };
  }, []);

  return (
    <div data-celebration-layer="" aria-hidden="true" className="celebration-layer">
      <canvas ref={canvasRef} className="celebration-canvas" />
      <span ref={bannerRef} data-celebration-banner="" className="celebration-banner" />
      <span ref={insetRef} className="celebration-inset" />
    </div>
  );
}
