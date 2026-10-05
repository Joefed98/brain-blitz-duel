import { useEffect, useRef } from "react";
import { fx } from "@/lib/fx";
/** Three-segment bar: done stages filled, the current one tinted. */
export function StageProgress({ stage, total = 3 }: { stage: number; total?: number }) {
  const previous = useRef(stage);
  useEffect(() => { if (stage > previous.current) fx.onStageComplete(); previous.current = stage; }, [stage]);
  return (
    <div className="flex h-3 w-full shrink-0 gap-1.5" aria-label={`Stage ${Math.min(stage + 1, total)} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3 flex-1 rounded-full ${i < stage ? "bg-category-accent" : i === stage ? "bg-category-accent/35" : "bg-border"}`}
        />
      ))}
    </div>
  );
}
