import { useEffect, type ComponentType } from "react";
import type { PuzzleStageProps } from "@/puzzles/types";
import { fx } from "@/lib/fx";
import type { GameTheme } from "@/lib/fx/theme";

/** Submission is not correctness: only a stored/server verdict may claim a win. */
export function feedbackStage(Stage: ComponentType<PuzzleStageProps>, theme: GameTheme) {
  return function FeedbackStage(props: PuzzleStageProps) {
    useEffect(() => { fx.onRoundStart(undefined, theme); }, []);
    // No wrapper element: ancestor-dependent board sizing stays identical.
    return <Stage {...props} />;
  };
}