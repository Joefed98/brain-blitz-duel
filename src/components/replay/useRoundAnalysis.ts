import { useEffect, useState } from "react";

import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";
import { preloadGameData } from "@/lib/duel/gamePreload";
import type { PuzzleData } from "@/lib/duel/types";
import { analyseRound, scanInSlices } from "@/lib/replay/analyse";
import type { Moment } from "@/lib/replay/moments";
import { makePlaybackDrawer, type PlaybackDrawer } from "@/lib/replay/playback.renderer";
import type { ReplayTimeline } from "@/lib/replay/timeline";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** A first pass slower than this (ms, wall time) marks the device as too slow to play back: show a still. */
export const SLOW_SCAN_MS = 2500;

export type RoundAnalysisState =
  | { status: "loading" }
  | { status: "none" }
  | {
      status: "ready";
      timeline: ReplayTimeline<any>;
      drawer: PlaybackDrawer;
      moments: Moment[];
      slow: boolean;
    };

/**
 * Re-simulates one stored round in slices after the game's art (and, for
 * Letterfall, its word list) has loaded, collecting its moments. Display only.
 */
export function useRoundAnalysis(
  puzzle: PuzzleData | null,
  answer: string | null,
): RoundAnalysisState {
  const [state, setState] = useState<RoundAnalysisState>({ status: "loading" });
  useEffect(() => {
    if (!puzzle || !answer) {
      setState({ status: "none" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      try {
        await Promise.all([
          preloadGameArt(puzzle.type).catch(() => undefined),
          preloadGameData(puzzle.type).catch(() => undefined),
        ]);
        if (cancelled) return;
        const analysis = analyseRound(puzzle, answer);
        const drawer = makePlaybackDrawer(puzzle);
        if (!analysis || !drawer) {
          setState({ status: "none" });
          return;
        }
        const result = await scanInSlices(analysis, { isCancelled: () => cancelled });
        if (!result || cancelled) return;
        setState({
          status: "ready",
          timeline: analysis.timeline,
          drawer,
          moments: result.moments,
          slow: result.ms > SLOW_SCAN_MS,
        });
      } catch (error) {
        console.error("[replay] analysis failed", error);
        if (!cancelled) setState({ status: "none" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [puzzle, answer]);
  return state;
}
