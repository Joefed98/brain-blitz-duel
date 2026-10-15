import { useEffect, useRef } from "react";
import { puzzleDef } from "@/lib/duel/registry";
import { serverNow } from "@/lib/duel/clock";
import { DUEL_START_MS, DUEL_START_VOICE_MS, duelStartFrame } from "@/lib/duel/startPresentation";
import type { PuzzleType } from "@/lib/duel/types";
import { roundMusicFor } from "@/lib/fx/theme";
import { playVoice, prepareRoundMusic, stopMusicExcept } from "@/lib/sound";
import { PREPARE_SPEC } from "@/lib/fx/roomMoments";
import { RoomMomentFx } from "./RoomMomentFx";
import { BoltGlyph } from "./Wordmark";

/** No shell, controls or local animation clock: refresh resumes the shared frame. */
export function DuelStart({ startedAt, type }: { startedAt: number; type: PuzzleType | undefined }) {
  const bolt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stopMusicExcept("music_prepare", 0);
    if (type) prepareRoundMusic(roundMusicFor(type, puzzleDef(type).category));
  }, [type]);

  useEffect(() => {
    const elapsed = serverNow() - startedAt;
    // Arrival after the cue point must never replay the announcement.
    if (elapsed >= DUEL_START_VOICE_MS) return;
    let timer: ReturnType<typeof setTimeout>;
    const cue = () => {
      const remaining = startedAt + DUEL_START_VOICE_MS - serverNow();
      if (remaining > 0) timer = setTimeout(cue, remaining);
      else if (serverNow() - startedAt < DUEL_START_MS) playVoice("prepareToDuel");
    };
    timer = setTimeout(cue, Math.max(0, DUEL_START_VOICE_MS - elapsed));
    return () => clearTimeout(timer);
  }, [startedAt]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("duel-start-lock");
    body.classList.add("duel-start-lock");
    window.scrollTo(0, 0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const paint = () => {
      const state = duelStartFrame(serverNow() - startedAt, reduced.matches);
      if (bolt.current) {
        bolt.current.style.transform = `scale(${state.scale})`;
        bolt.current.style.opacity = String(state.opacity);
      }
      frame = requestAnimationFrame(paint);
    };
    paint();
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("duel-start-lock");
      body.classList.remove("duel-start-lock");
    };
  }, [startedAt]);

  return (
    <div className="duel-start-screen" aria-label="Duel starting">
      <RoomMomentFx spec={PREPARE_SPEC} startedAt={startedAt} />
      <div ref={bolt} className="duel-start-bolt" aria-hidden="true">
        <BoltGlyph className="h-full w-full" viewBox="5 2 14 20" />
      </div>
    </div>
  );
}