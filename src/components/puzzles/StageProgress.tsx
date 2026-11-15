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
/**
 * `done` (the Number overhaul, Joe's approval of 15 Nov 2026): how many stages the bar fills, where that isn't the
 * stage reached (Operator, whose equations can be skipped and gone back to: the bar counts equations solved). Absent:
 * the stages before the current one, as before.
 */
export function StageProgress({ stage, total = 3, quiet = false, done }: { stage: number; total?: number; quiet?: boolean; done?: number | undefined }) {
  const previous = useRef(stage);
  useEffect(() => { if (stage > previous.current && !quiet) fx.onStageComplete(); previous.current = stage; }, [stage]);
  const label = `Stage ${Math.min(stage + 1, total)} of ${total}`;
  const filled = done ?? stage;
  const framed = useGoalProgress({ done: filled, total, text: label });
  if (framed) return null;
  return (
    <div className="flex h-3 w-full shrink-0 gap-1.5" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3 flex-1 rounded-full ${i < filled ? "bg-category-accent" : i === stage ? "bg-category-accent/35" : "bg-border"}`}
        />
      ))}
    </div>
  );
}
