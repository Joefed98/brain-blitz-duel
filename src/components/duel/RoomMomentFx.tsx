import type { CSSProperties } from "react";
import type { MomentPart, MomentSpec } from "@/lib/fx/roomMoments";
import { useMomentElapsed, useRoomMomentCues } from "@/lib/fx/useRoomMoments";
import { useCelebrationsOn } from "@/components/fx/useCelebration";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";

function partElements(part: MomentPart, elapsed: number) {
  const count = part.count ?? 1;
  return Array.from({ length: count }, (_, i) => {
    const style = {
      animationDelay: `${part.delayMs + i * (part.staggerMs ?? 0) - elapsed}ms`,
      animationDuration: `${part.durationMs}ms`,
      // Reduced motion keeps the calm fade at this length (styles.css shortens every other animation).
      "--rfx-dur": `${part.durationMs}ms`,
      "--i": i,
      "--n": count,
    } as CSSProperties;
    return (
      <span
        key={`${part.part}-${i}`}
        data-part={part.part}
        data-motion={part.motionOnly ? "" : undefined}
        style={style}
      >
        {part.marks
          ? Array.from({ length: part.marks }, (_, j) => (
              <i key={j} style={{ "--i": j, "--n": part.marks } as CSSProperties} />
            ))
          : null}
      </span>
    );
  });
}

/**
 * Display only: the effect layers behind (and, for a flash, over) a room
 * moment's screen. Draws with CSS transform/opacity keyframes (styles.css,
 * `rfx-*`), never takes taps, never touches the room's timing or state.
 */
export function RoomMomentFx({ spec, startedAt }: { spec: MomentSpec; startedAt: number }) {
  const elapsed = useMomentElapsed(startedAt);
  useRoomMomentCues(spec, startedAt);
  // The effects pass's richer layer: only with the celebrations on and full effects (reduced effects and the battery
  // saver keep the moments as they were).
  const rich = useCelebrationsOn() && !arcadeReducedEffects();
  const layer = (over: boolean) => {
    const parts = spec.parts.filter((p) => Boolean(p.over) === over && (rich || !p.rich));
    if (parts.length === 0) return null;
    return (
      <div
        className="room-fx"
        data-over={over ? "" : undefined}
        data-moment={spec.moment}
        data-effect={spec.effect}
        aria-hidden="true"
      >
        {parts.flatMap((p) => partElements(p, elapsed))}
      </div>
    );
  };
  return (
    <>
      {layer(false)}
      {layer(true)}
    </>
  );
}
