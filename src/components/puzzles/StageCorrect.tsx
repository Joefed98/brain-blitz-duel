import { useEffect, useRef } from "react";

import { useStageState } from "@/lib/duel/stageState";

export const STAGE_CORRECT_HOLD_MS = 1_000;

/** Presentation-only deadline; the round's clock and submitted answer are untouched. */
export function useStageCorrectHold({
  complete, finalStage, locked, stateKey, onAdvance,
}: {
  complete: boolean;
  finalStage: boolean;
  locked: boolean;
  stateKey: string;
  onAdvance: () => void;
}) {
  const [deadline, setDeadline] = useStageState<number | null>(stateKey, "correctHoldDeadline", () => null);
  const advance = useRef(onAdvance);
  advance.current = onAdvance;

  useEffect(() => {
    if (!complete || locked) return;
    if (finalStage) {
      advance.current();
      return;
    }
    if (deadline === null) {
      setDeadline(Date.now() + STAGE_CORRECT_HOLD_MS);
      return;
    }
    const timer = setTimeout(() => {
      setDeadline(null);
      advance.current();
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [complete, finalStage, locked, deadline, setDeadline]);

  return complete && !finalStage;
}

export function StageCorrect({ visible }: { visible: boolean }) {
  return (
    <div className="flex h-6 w-full shrink-0 items-center justify-center" role="status" aria-live="polite">
      <span className="font-mono text-sm font-bold text-primary">{visible ? "CORRECT" : ""}</span>
    </div>
  );
}