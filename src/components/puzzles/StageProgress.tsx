import { useEffect, useRef } from "react";
import { fx } from "@/lib/fx";
import { useGoalProgress } from "@/components/duel/GameFrame";
/**
 * Three-segment bar: done stages filled, the current one tinted. On a live round (Polish 2) the
 * frame's goal line draws it with "Stage n of N" instead (useGoalProgress), so the stage draws
 * nothing here; intros, demos and reveals keep this bar.
 */
/**
 * `quiet` (game review fix, 15 Nov 2026): true on the render where the stage moved on without being
 * completed (a Skip, an equation out of tries), so a skip never plays the stage-complete sound and haptic.
 */
export function StageProgress({ stage, total = 3, quiet = false }: { stage: number; total?: number; quiet?: boolean }) {
  const previous = useRef(stage);
  useEffect(() => { if (stage > previous.current && !quiet) fx.onStageComplete(); previous.current = stage; }, [stage]);
  const label = `Stage ${Math.min(stage + 1, total)} of ${total}`;
  const framed = useGoalProgress({ done: stage, total, text: label });
  if (framed) return null;
  return (
    <div className="flex h-3 w-full shrink-0 gap-1.5" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3 flex-1 rounded-full ${i < stage ? "bg-category-accent" : i === stage ? "bg-category-accent/35" : "bg-border"}`}
        />
      ))}
    </div>
  );
}
