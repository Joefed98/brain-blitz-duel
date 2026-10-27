import { useEffect, useRef } from "react";
import { puzzleDef } from "@/lib/duel/registry";
import { serverNow } from "@/lib/duel/clock";
import { DUEL_START_MS, DUEL_START_VOICE_MS, duelStartFrame } from "@/lib/duel/startPresentation";
import type { PuzzleType } from "@/lib/duel/types";
import { roundMusicFor } from "@/lib/fx/theme";
import { playVoice, prepareBeatTrack, prepareRoundMusic, stopMusicExcept } from "@/lib/sound";
import { PREPARE_SPEC } from "@/lib/fx/roomMoments";
import { RoomMomentFx } from "./RoomMomentFx";
import { LogoMark } from "@/components/brand/LogoMark";
import { LOGO_HAIRLINE_PX } from "@/components/brand/logoGeometry";
import { PrepareLightning } from "./PrepareLightning";

/** The mark's bolt (logoGeometry: x 7–21, y 0.5–33.5), with a little room each side. */
const DUEL_START_LOGO_VIEWBOX = "6 0.5 16 33";

/** No shell, controls or local animation clock: refresh resumes the shared frame. */
export function DuelStart({ startedAt, type }: { startedAt: number; type: PuzzleType | undefined }) {
  const bolt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stopMusicExcept("music_prepare", 0);
    if (type) prepareRoundMusic(roundMusicFor(type, puzzleDef(type).category));
    if (type === "beat") prepareBeatTrack();
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
      <PrepareLightning startedAt={startedAt} />
      <div ref={bolt} className="duel-start-bolt" aria-hidden="true">
        {/* The Joulz mark, its bolt filling the old bolt's box (the speed lines run past it). */}
        <LogoMark
          className="duel-start-logo h-full w-full"
          viewBox={DUEL_START_LOGO_VIEWBOX}
          lineWidth={LOGO_HAIRLINE_PX}
        />
      </div>
    </div>
  );
}