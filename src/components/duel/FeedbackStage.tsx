import { useCallback, useEffect, useRef, type ComponentType } from "react";
import type { CheckWord, PuzzleStageProps } from "@/puzzles/types";
import { fx } from "@/lib/fx";
import type { GameTheme } from "@/lib/fx/theme";
import { setSignatureGame } from "@/lib/fx/signature";
import type { PuzzleType } from "@/lib/duel/types";
import { standardTimesParts } from "@/lib/duel/standard/stamps";
import { TimelineRecorder } from "@/lib/duel/standard/timeline";

/**
 * The scoring standard's draft timelines (standard/timeline.ts), one per round (stateKey), kept outside the
 * component tree so a remount mid-round keeps the record, and on the device so a reload mid-round carries on from it
 * (only the latest round's is kept there). Only the latest few rounds are kept in memory.
 */
const timelines = new Map<string, TimelineRecorder>();
const TIMELINE_STORE_PREFIX = "duelz.timeline.v1:";

function timelineFor(key: string): TimelineRecorder {
  let rec = timelines.get(key);
  if (!rec) {
    let kept: string | null = null;
    try {
      kept = typeof localStorage === "undefined" ? null : localStorage.getItem(TIMELINE_STORE_PREFIX + key);
    } catch {
      kept = null;
    }
    rec = TimelineRecorder.resume(kept);
    timelines.set(key, rec);
    while (timelines.size > 6) timelines.delete(timelines.keys().next().value!);
  }
  return rec;
}

function keepTimeline(key: string, rec: TimelineRecorder): void {
  try {
    if (typeof localStorage === "undefined") return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(TIMELINE_STORE_PREFIX) && k !== TIMELINE_STORE_PREFIX + key) localStorage.removeItem(k);
    }
    localStorage.setItem(TIMELINE_STORE_PREFIX + key, rec.encoded());
  } catch {
    // Storage full or blocked: the record still stands in memory.
  }
}

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
    // The scoring standard's timeline: each draft with its round-clock time, appended to what is handed on.
    const timed = !arcade && standardTimesParts(props.puzzle);
    const timeline = useCallback(
      (answer: string): string => {
        if (!timed) return answer;
        const p = latest.current;
        const key = p.stateKey ?? `${p.puzzle.type}-${p.phaseStartedAt}`;
        const rec = timelineFor(key);
        // Round-clock time on the host's own clock (no standard game has preparation time).
        if (rec.note(answer, p.now - p.phaseStartedAt)) keepTimeline(key, rec);
        return rec.attach(answer);
      },
      [timed],
    );
    useEffect(() => { fx.onRoundStart(undefined, theme); }, []);
    // The signature beat's common finish point (arcadeFeedback) reads the game on screen.
    useEffect(() => (signature ? setSignatureGame(signature) : undefined), []);
    const draft = useCallback((answer: string) => {
      if (!arcade && answer !== lastDraft.current && !latest.current.locked) {
        lastDraft.current = answer;
        fx.onMove(undefined, theme);
      }
      latest.current.onDraftAnswer?.(timeline(answer));
    }, [timeline]);
    const submit = useCallback<PuzzleStageProps["onSubmit"]>((answer, meta) => latest.current.onSubmit(timeline(answer), meta), [timeline]);
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
    return <Stage {...props} onSubmit={submit} {...(props.onDraftAnswer ? { onDraftAnswer: draft } : {})} {...(props.checkWord ? { checkWord: word } : {})} />;
  };
}