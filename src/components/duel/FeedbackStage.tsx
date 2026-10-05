import { useCallback, useEffect, useRef, type ComponentType } from "react";
import type { PuzzleStageProps } from "@/puzzles/types";
import { fx } from "@/lib/fx";
import type { GameTheme } from "@/lib/fx/theme";

/** Submission is not correctness: only a stored/server verdict may claim a win. */
export function feedbackStage(Stage: ComponentType<PuzzleStageProps>, theme: GameTheme) {
  return function FeedbackStage(props: PuzzleStageProps) {
    const latest = useRef(props);
    latest.current = props;
    const lastDraft = useRef("");
    useEffect(() => { fx.onRoundStart(undefined, theme); }, []);
    const draft = useCallback((answer: string) => {
      if (answer !== lastDraft.current && !latest.current.locked) {
        lastDraft.current = answer;
        fx.onMove(undefined, theme);
      }
      latest.current.onDraftAnswer?.(answer);
    }, []);
    // No wrapper element: ancestor-dependent board sizing stays identical.
    return <Stage {...props} onDraftAnswer={props.onDraftAnswer ? draft : undefined} />;
  };
}