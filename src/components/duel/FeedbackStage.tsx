import { useCallback, useEffect, useRef, type ComponentType } from "react";
import type { CheckWord, PuzzleStageProps } from "@/puzzles/types";
import { fx } from "@/lib/fx";
import type { GameTheme } from "@/lib/fx/theme";
import { setSignatureGame } from "@/lib/fx/signature";
import type { PuzzleType } from "@/lib/duel/types";

/** What the shared signature beat needs to know about the game on screen. */
export interface SignatureGameInfo {
  type: PuzzleType;
  /** Arcade-category games (their beat comes from the run's own finish). */
  arcade: boolean;
  /** The arcade run length; null for every other game. */
  runMs: number | null;
}

/** Submission is not correctness: only a stored/server verdict may claim a win. */
export function feedbackStage(Stage: ComponentType<PuzzleStageProps>, theme: GameTheme, arcade = false, signature?: SignatureGameInfo) {
  const silent = Boolean((Stage as { silentWordChecks?: boolean }).silentWordChecks);
  return function FeedbackStage(props: PuzzleStageProps) {
    const latest = useRef(props);
    latest.current = props;
    const lastDraft = useRef("");
    useEffect(() => { fx.onRoundStart(undefined, theme); }, []);
    // The signature beat's common finish point (arcadeFeedback) reads the game on screen.
    useEffect(() => (signature ? setSignatureGame(signature) : undefined), []);
    const draft = useCallback((answer: string) => {
      if (!arcade && answer !== lastDraft.current && !latest.current.locked) {
        lastDraft.current = answer;
        fx.onMove(undefined, theme);
      }
      latest.current.onDraftAnswer?.(answer);
    }, []);
    const word = useCallback<CheckWord>(async (...args) => {
      const check = latest.current.checkWord;
      if (!check) return { valid: false, points: 0, word: args[0] };
      const result = await check(...args);
      // One verdict per player-triggered check; background validation stays silent.
      if (!latest.current.locked && !silent) {
        if (result.valid) fx.onCorrect(undefined, theme);
        else fx.onWrong(undefined, theme);
      }
      return result;
    }, []);
    // No wrapper element: ancestor-dependent board sizing stays identical.
    return <Stage {...props} {...(props.onDraftAnswer ? { onDraftAnswer: draft } : {})} {...(props.checkWord ? { checkWord: word } : {})} />;
  };
}