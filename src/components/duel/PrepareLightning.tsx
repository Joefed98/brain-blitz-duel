import { useEffect, useRef, useState } from "react";

import { serverNow } from "@/lib/duel/clock";
import { celebrationSound } from "@/lib/fx/celebrations";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import {
  LIGHTNING_BOLTS,
  LIGHTNING_GLOW_ALPHA,
  buildBolt,
  liveStrike,
  planStrikes,
  STRIKE_SOUND_LATE_MS,
  strikeSounds,
  strikeStrength,
  type BoltShape,
} from "@/lib/fx/prepareLightning";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** One bolt, drawn once into its own canvas: a soft gold glow under a white-gold core. */
function renderBolt(shape: BoltShape, w: number, h: number, ratio: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * ratio));
  c.height = Math.max(1, Math.round(h * ratio));
  const g = c.getContext("2d")!;
  g.scale(ratio, ratio);
  g.lineCap = "round";
  g.lineJoin = "round";
  const stroke = (colour: string, widthOf: (w: number) => number, blur = 0) => {
    g.strokeStyle = colour;
    g.shadowColor = blur ? colour : "transparent";
    g.shadowBlur = blur * ratio;
    for (const line of shape.lines) {
      g.lineWidth = widthOf(line.width);
      g.beginPath();
      line.points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
  };
  stroke("rgba(247, 191, 47, 0.55)", (lw) => lw * 4, 12);
  stroke("rgba(255, 224, 138, 0.9)", (lw) => lw * 1.8);
  stroke("#FFFFFF", (lw) => lw);
  return c;
}

/**
 * Prepare to Duel's lightning (src/lib/fx/prepareLightning.ts): a canvas behind the logo,
 * clear of the home-bar strip. The bolts and their glows are built once per size; a frame
 * with no live strike draws nothing (one clear after a strike fades). Nothing under
 * prefers-reduced-motion or reduced effects. Each strike sounds the thunder once as it lands
 * (celebrations only, quieter than GO's; skipped near the voice line, strikeSounds).
 */
export function PrepareLightning({ startedAt }: { startedAt: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [still, setStill] = useState(true);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION);
    const update = () => setStill(media.matches || arcadeReducedEffects());
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (still || !el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const plan = planStrikes(Math.random);
    const seeds = Array.from({ length: LIGHTNING_BOLTS }, () => Math.random() * 2 ** 31);
    let bolts: { image: HTMLCanvasElement; glow: CanvasGradient }[] = [];
    let w = 0;
    let h = 0;
    let ratio = 1;
    let drawn = false;
    let sounded: (typeof plan)[number] | null = null;

    const build = () => {
      const box = el.getBoundingClientRect();
      w = box.width;
      h = box.height;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(w * ratio));
      el.height = Math.max(1, Math.round(h * ratio));
      bolts = seeds.map((seed, i) => {
        // Each shape from its own small seeded stream: the same bolt again after a resize.
        let s = seed >>> 0;
        const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
        const shape = buildBolt(rand, w, h, i);
        const [gx, gy] = shape.glow;
        const glow = ctx.createRadialGradient(
          gx * ratio,
          gy * ratio,
          0,
          gx * ratio,
          gy * ratio,
          Math.max(w, h) * 0.6 * ratio,
        );
        glow.addColorStop(0, `rgba(255, 214, 120, ${LIGHTNING_GLOW_ALPHA})`);
        glow.addColorStop(0.5, `rgba(247, 191, 47, ${LIGHTNING_GLOW_ALPHA * 0.35})`);
        glow.addColorStop(1, "rgba(247, 191, 47, 0)");
        return { image: renderBolt(shape, w, h, ratio), glow };
      });
      drawn = true;
    };
    build();
    const observer = new ResizeObserver(build);
    observer.observe(el);

    let frame = 0;
    const paint = () => {
      const elapsed = serverNow() - startedAt;
      const strike = liveStrike(plan, elapsed);
      const strength = strike ? strikeStrength(elapsed - strike.atMs) : 0;
      if (strike && strike !== sounded) {
        sounded = strike;
        if (elapsed - strike.atMs < STRIKE_SOUND_LATE_MS && strikeSounds(strike.atMs)) celebrationSound("prepareThunder");
      }
      if (strength > 0 || drawn) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, el.width, el.height);
        drawn = false;
        if (strike && strength > 0) {
          const bolt = bolts[strike.bolt]!;
          ctx.globalAlpha = strength;
          ctx.fillStyle = bolt.glow;
          ctx.fillRect(0, 0, el.width, el.height);
          ctx.drawImage(bolt.image, 0, 0);
          ctx.globalAlpha = 1;
          drawn = true;
        }
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [still, startedAt]);

  if (still) return null;
  return (
    <canvas
      ref={canvas}
      className="prepare-lightning"
      aria-hidden="true"
      data-prepare-lightning=""
    />
  );
}
