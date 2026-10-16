import { memo, useRef, type ComponentType } from "react";

import type { PuzzleStageProps } from "@/puzzles/types";

/**
 * Low-end performance (16 Oct 2026, presentation only): the practice and room screens tick at
 * 10 Hz (their clocks), and each tick used to re-render the whole live stage, so on an arcade play
 * screen React reconciled the canvas stage ten times a second for nothing (its canvas loop draws
 * every frame on its own). Arcade-screen stages never read `now` or `phaseStartedAt` (they run on
 * their own sim clock), so here they re-render only when the puzzle, its key or `locked` changes.
 * Callbacks are passed as stable wrappers that always call the latest prop, so a submit or draft
 * still reaches the screen's current handler. Other stages render exactly as before.
 */
type StageCallbacks = Pick<PuzzleStageProps, "onSubmit" | "onDraftAnswer" | "checkWord" | "checkMoves">;

interface FrozenProps {
  Stage: ComponentType<PuzzleStageProps>;
  props: PuzzleStageProps;
}

const Frozen = memo(
  function Frozen({ Stage, props }: FrozenProps) {
    return <Stage {...props} />;
  },
  (a, b) =>
    a.Stage === b.Stage &&
    a.props.puzzle === b.props.puzzle &&
    a.props.stateKey === b.props.stateKey &&
    a.props.locked === b.props.locked &&
    // A callback that comes or goes (not a new closure) is a real change.
    (["onDraftAnswer", "checkWord", "checkMoves"] as const).every((k) => (a.props[k] === undefined) === (b.props[k] === undefined)),
);

export function SteadyStage({ Stage, ...props }: PuzzleStageProps & { Stage: ComponentType<PuzzleStageProps> }) {
  const latest = useRef(props);
  latest.current = props;
  const stable = useRef<Required<StageCallbacks> | null>(null);
  if (!stable.current)
    stable.current = {
      onSubmit: (...a) => latest.current.onSubmit(...a),
      onDraftAnswer: (...a) => latest.current.onDraftAnswer?.(...a),
      checkWord: (...a) => latest.current.checkWord!(...a),
      checkMoves: (...a) => latest.current.checkMoves!(...a),
    };
  const s = stable.current;
  const steady: PuzzleStageProps = { ...props, onSubmit: s.onSubmit };
  if (props.onDraftAnswer) steady.onDraftAnswer = s.onDraftAnswer;
  if (props.checkWord) steady.checkWord = s.checkWord;
  if (props.checkMoves) steady.checkMoves = s.checkMoves;
  return <Frozen Stage={Stage} props={steady} />;
}

/** The live stage: steady for arcade play screens (`steady`), rendered plainly otherwise. */
export function SteadyOrPlain({ Stage, steady, ...props }: PuzzleStageProps & { Stage: ComponentType<PuzzleStageProps>; steady: boolean }) {
  return steady ? <SteadyStage Stage={Stage} {...props} /> : <Stage {...props} />;
}
