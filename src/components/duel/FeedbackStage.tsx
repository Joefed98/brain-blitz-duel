import { useCallback, useEffect, useRef, type ComponentType } from "react";
import type { PuzzleStageProps } from "@/puzzles/types";
import { fx } from "@/lib/fx";
import type { GameTheme } from "@/lib/fx/theme";

/** Submission is not correctness: only a stored/server verdict may claim a win. */
export function feedbackStage(Stage: ComponentType<PuzzleStageProps>, theme: GameTheme) {
  return function FeedbackStage(props: PuzzleStageProps) {
    const target = useRef<HTMLDivElement>(null);
    const latest = useRef(props);
    latest.current = props;
    useEffect(() => { fx.onRoundStart(undefined, theme); }, []);
    const submit = useCallback<PuzzleStageProps["onSubmit"]>((answer, meta) => {
      fx.onSubmit(undefined, theme);
      latest.current.onSubmit(answer, meta);
    }, []);
    return <div ref={target} className="relative flex min-h-0 flex-1 flex-col">
      <Stage {...props} onSubmit={submit} />
    </div>;
  };
}