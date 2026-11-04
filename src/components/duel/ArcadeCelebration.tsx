import { useEffect, useRef, useState } from "react";

import { ARCADE_WORLD_THEMES, type ArcadeWorld } from "@/lib/arcade/arcadeFx.renderer";
import { prefersReducedMotion } from "@/lib/motion";
import { canvasRatio } from "@/lib/battery";

export type CelebrationKind = "full" | "best" | "both";

const HEADLINES: Record<CelebrationKind, string> = {
  full: "Full clear!",
  best: "New personal best!",
  both: "Full clear · new best!",
};

/** Hard caps: one short burst, then the canvas stops drawing. */
const CONFETTI = 56;
const DURATION_MS = 2000;

/**
 * The one-shot confetti burst in an arcade world's colours, filling its
 * positioned parent. Presentation only; also used for the podium winner.
 */
export function ConfettiBurst({ world }: { world: ArcadeWorld | null }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const theme = ARCADE_WORLD_THEMES[world ?? "gem"];
  useEffect(() => {
    const node = canvas.current;
    if (!node || prefersReducedMotion()) return;
    const box = node.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const ratio = canvasRatio();
    node.width = Math.round(box.width * ratio);
    node.height = Math.round(box.height * ratio);
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const colours = [theme.primary, theme.secondary, theme.highlight];
    const w = box.width;
    const h = box.height;
    // Two cannons from the lower corners plus a shower from the top; positions
    // are closed-form in time, so there is no per-frame integration.
    const pieces = Array.from({ length: CONFETTI }, (_, i) => {
      const side = i % 3;
      const a = ((i * 137.5) % 360) * (Math.PI / 180);
      const speed = 220 + ((i * 53) % 160);
      return side === 2
        ? {
            x: ((i * 0.618) % 1) * w,
            y: -10,
            vx: Math.cos(a) * 30,
            vy: 60 + ((i * 29) % 80),
            delay: ((i * 37) % 400) / 1000,
            colour: colours[i % 3]!,
            size: 4 + (i % 3),
            spin: (i % 7) - 3,
          }
        : {
            x: side === 0 ? w * 0.08 : w * 0.92,
            y: h * 0.72,
            vx: (side === 0 ? 1 : -1) * (0.25 + 0.5 * Math.abs(Math.cos(a))) * speed,
            vy: -(0.6 + 0.4 * Math.abs(Math.sin(a))) * speed * 1.4,
            delay: ((i * 23) % 200) / 1000,
            colour: colours[i % 3]!,
            size: 4 + (i % 3),
            spin: (i % 9) - 4,
          };
    });
    const gravity = 420;
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of pieces) {
        const age = t - p.delay;
        if (age < 0) continue;
        const x = p.x + p.vx * age;
        const y = p.y + p.vy * age + 0.5 * gravity * age * age;
        if (y > h + 20) continue;
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1.4) / 0.6);
        ctx.fillStyle = p.colour;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.spin * age);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (now - start < DURATION_MS) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [theme]);

  return <canvas ref={canvas} data-confetti-burst className="absolute inset-0 h-full w-full" />;
}

/** How long the headline shows (its animation, styles.css .arcade-celebration-headline) before it is removed. */
export const CELEBRATION_HEADLINE_MS = 2600;

/**
 * The results screen's end-of-run moment for a full clear or a personal best: a one-shot confetti burst in the
 * world's colours, behind everything and gone after two seconds. Presentation only.
 */
export function ArcadeCelebration({ kind, world }: { kind: CelebrationKind; world: ArcadeWorld | null }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl" data-arcade-celebration={kind}>
      <ConfettiBurst world={world} />
    </div>
  );
}

/**
 * The moment's headline (4 Nov 2026, Joe's review: it was drawn over the breakdown rows and a faded copy stayed behind
 * them): a pill in the score's row, beside the score, removed from the page once its animation ends. It reads the stored
 * outcome and score and never shows a number of its own.
 */
export function CelebrationHeadline({ kind, world }: { kind: CelebrationKind; world: ArcadeWorld | null }) {
  const theme = ARCADE_WORLD_THEMES[world ?? "gem"];
  const [shown, setShown] = useState(true);
  useEffect(() => {
    setShown(true);
    const id = window.setTimeout(() => setShown(false), CELEBRATION_HEADLINE_MS + 50);
    return () => window.clearTimeout(id);
  }, [kind]);
  if (!shown) return null;
  return (
    <span
      role="status"
      data-celebration-headline={kind}
      onAnimationEnd={() => setShown(false)}
      className="arcade-celebration-headline max-w-full rounded-2xl px-2.5 py-1 text-center font-display text-[12px] font-bold uppercase leading-tight tracking-wide"
      style={{ color: theme.outline, background: theme.primary, boxShadow: `0 0 18px ${theme.primary}` }}
    >
      {HEADLINES[kind]}
    </span>
  );
}
