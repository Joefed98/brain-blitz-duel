import { useEffect, useRef } from "react";
import { serverNow } from "@/lib/duel/clock";
import { puzzleDef } from "@/lib/duel/registry";
import {
  ROUND_TITLE_MS,
  ROUND_TITLE_VOICE_MS,
  ROUND_TITLE_VOICE_CUTOFF_MS,
  roundTitleFrame,
} from "@/lib/duel/startPresentation";
import type { PuzzleType } from "@/lib/duel/types";
import { roundMusicFor } from "@/lib/fx/theme";
import { playVoice, prepareRoundMusic, stopMusic, type VoiceId } from "@/lib/sound";

/** Room-only, shell-free title; presentation and cues use the shared clock. */
export function RoundTitle({
  startedAt,
  round,
  totalRounds,
  type,
}: {
  startedAt: number;
  round: number;
  totalRounds: number;
  type: PuzzleType;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const categoryLine = useRef<HTMLParagraphElement>(null);
  // Registry category is the draw category, independent of engine implementation.
  const category = puzzleDef(type).category;
  const final = round >= totalRounds;

  useEffect(() => {
    stopMusic(0);
    prepareRoundMusic(roundMusicFor(type, category));
  }, [type, category]);

  useEffect(() => {
    const elapsed = serverNow() - startedAt;
    if (elapsed > ROUND_TITLE_VOICE_CUTOFF_MS) return;
    const voice: VoiceId | null = final
      ? "finalRound"
      : round >= 1 && round <= 6
        ? (`round${round}` as VoiceId)
        : null;
    if (!voice) return;
    let timer: ReturnType<typeof setTimeout>;
    const cue = () => {
      const remaining = startedAt + ROUND_TITLE_VOICE_MS - serverNow();
      if (remaining > 0) timer = setTimeout(cue, remaining);
      else if (serverNow() - startedAt <= ROUND_TITLE_VOICE_CUTOFF_MS) playVoice(voice);
    };
    timer = setTimeout(cue, Math.max(0, ROUND_TITLE_VOICE_MS - elapsed));
    return () => clearTimeout(timer);
  }, [startedAt, round, final]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("duel-start-lock");
    body.classList.add("duel-start-lock");
    window.scrollTo(0, 0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const paint = () => {
      const state = roundTitleFrame(serverNow() - startedAt, reduced.matches);
      if (heading.current) {
        heading.current.style.opacity = String(state.titleOpacity);
        heading.current.style.transform = `scale(${state.scale})`;
      }
      if (categoryLine.current) categoryLine.current.style.opacity = String(state.categoryOpacity);
      if (serverNow() - startedAt < ROUND_TITLE_MS) frame = requestAnimationFrame(paint);
    };
    paint();
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("duel-start-lock");
      body.classList.remove("duel-start-lock");
    };
  }, [startedAt]);

  return (
    <div className="duel-start-screen" data-category={category} aria-label="Round title">
      <div className="round-title-lines">
        <h1 ref={heading} className="round-title-heading">
          {final ? "FINAL ROUND" : `ROUND ${round}`}
        </h1>
        <p ref={categoryLine} className="round-title-category">
          {category.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
