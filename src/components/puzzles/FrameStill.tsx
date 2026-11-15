import { STRATEGY_STILLS } from "./strategyStills.data";

/**
 * A Strategy game's intro still (the Strategy overhaul, 15 Nov 2026): a real frame of today's game, drawn by the game's
 * own renderer a few seconds into a strong round of the intro example's deal (scripts/shots/strategy-stills.ts), shown
 * 210 px wide at its own aspect so nothing moves when it loads, with a one-line caption under it.
 */
export function FrameStill({ type, ratio, caption, shownW = 210 }: { type: keyof typeof STRATEGY_STILLS; ratio: number; caption: string; shownW?: number }) {
  const shownH = Math.round(shownW * ratio);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <img
        src={`/intro/${type}.webp?v=${STRATEGY_STILLS[type]}`}
        width={shownW}
        height={shownH}
        alt=""
        aria-hidden="true"
        decoding="async"
        data-frame-still={type}
        style={{ width: shownW, height: shownH, borderRadius: 10, display: "block" }}
      />
      <p className="text-center text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
