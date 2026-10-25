import { useMemo } from "react";

/**
 * The arcade atmosphere layer (Polish 2 toolkit, 24 Oct 2026, display only; docs/design-system.md
 * "Game screens"): a still backdrop for an arcade world's screen fill, for the category batches to
 * apply game by game. Not used by any game yet. It draws, back to front: a vertical gradient, then a
 * starfield or a soft glow, then a vignette, then (for retro worlds) scanlines. Nothing moves, so it
 * is the same under reduced motion; pointer-events none, so a tap through it records nothing; the
 * stars come from a seeded PRNG (never Math.random), so every phone draws the same sky.
 */
export function ArcadeAtmosphere({
  top,
  bottom,
  mode = "glow",
  glow,
  seed = 1,
  stars = 70,
  scanlines = false,
}: {
  /** The gradient's colours, top and bottom. */
  top: string;
  bottom: string;
  /** "stars": a still starfield; "glow": a soft light from the top; "plain": the gradient alone. */
  mode?: "stars" | "glow" | "plain";
  /** The glow's colour (default: the top colour lightened). */
  glow?: string;
  seed?: number;
  stars?: number;
  /** Retro worlds: the CRT scanline overlay. */
  scanlines?: boolean;
}) {
  const sky = useMemo(() => (mode === "stars" ? starfield(seed, stars) : ""), [mode, seed, stars]);
  return (
    <div data-arcade-atmosphere aria-hidden="true" className="gf-atmosphere">
      <div style={{ background: `linear-gradient(180deg, ${top}, ${bottom})` }} />
      {mode === "stars" ? <div style={{ backgroundImage: sky }} /> : null}
      {mode === "glow" ? (
        <div
          style={{
            background: `radial-gradient(120% 55% at 50% 0%, ${glow ?? `color-mix(in srgb, ${top} 55%, white)`}, transparent 70%)`,
            opacity: 0.35,
          }}
        />
      ) : null}
      <div className="gf-atmosphere-vignette" />
      {scanlines ? <div className="gf-atmosphere-scanlines" /> : null}
    </div>
  );
}

/** Stars as radial-gradient dots at seeded places (percentages, so the sky scales with the box). */
function starfield(seed: number, count: number): string {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const dots: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rand() * 100).toFixed(2);
    const y = (rand() * 100).toFixed(2);
    const r = (0.6 + rand() * 0.9).toFixed(2);
    const a = (0.35 + rand() * 0.55).toFixed(2);
    dots.push(`radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,${a}) ${r}px, transparent ${(Number(r) + 0.6).toFixed(2)}px)`);
  }
  return dots.join(",");
}
