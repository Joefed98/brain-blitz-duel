import { useEffect, useRef } from "react";
import { serverNow } from "@/lib/duel/clock";
import {
  WINNER_REVEAL_MS,
  WINNER_ROLL_END_MS,
  WINNER_ROLL_MS,
  WINNER_VOICE_MS,
  winnerRevealFrame,
} from "@/lib/duel/startPresentation";
import { WINNER_SPEC } from "@/lib/fx/roomMoments";
import { playSound, playVoice, stopMusic, stopSound } from "@/lib/sound";
import { RoomMomentFx } from "./RoomMomentFx";

/** Shared-clock cue: skipped entirely when the player arrives after its start time. */
function schedule(startedAt: number, atMs: number, run: () => void): (() => void) | undefined {
  if (serverNow() - startedAt >= atMs) return;
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    const remaining = startedAt + atMs - serverNow();
    if (remaining > 0) timer = setTimeout(tick, remaining);
    else if (serverNow() - startedAt < WINNER_REVEAL_MS) run();
  };
  timer = setTimeout(tick, Math.max(0, startedAt + atMs - serverNow()));
  return () => clearTimeout(timer);
}

/** No shell, controls or local clock: refresh resumes the shared frame. */
export function WinnerReveal({ startedAt }: { startedAt: number }) {
  const text = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    stopMusic(0);
    const cancels = [
      schedule(startedAt, WINNER_VOICE_MS, () => playVoice("winnerIs")),
      schedule(startedAt, WINNER_ROLL_MS, () => playSound("winner_drumroll")),
    ];
    // The roll never runs into the held silence before the cut.
    let cut: ReturnType<typeof setTimeout> | undefined;
    const untilEnd = startedAt + WINNER_ROLL_END_MS - serverNow();
    if (untilEnd > 0) cut = setTimeout(() => stopSound("winner_drumroll"), untilEnd);
    else stopSound("winner_drumroll");
    return () => {
      cancels.forEach((cancel) => cancel?.());
      if (cut) clearTimeout(cut);
      stopSound("winner_drumroll");
    };
  }, [startedAt]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("duel-start-lock");
    body.classList.add("duel-start-lock");
    window.scrollTo(0, 0);
    let frame = 0;
    const paint = () => {
      const state = winnerRevealFrame(serverNow() - startedAt);
      if (text.current) {
        text.current.style.opacity = String(state.opacity);
        text.current.style.transform = `scale(${state.scale})`;
        text.current.style.textShadow =
          state.glow > 0
            ? `0 0 ${Math.round(24 * state.glow)}px rgba(245, 184, 46, ${state.glow.toFixed(2)})`
            : "none";
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
    <div className="duel-start-screen" aria-label="Winner reveal">
      <RoomMomentFx spec={WINNER_SPEC} startedAt={startedAt} />
      <h1 ref={text} className="winner-reveal-text">
        AND THE WINNER IS…
      </h1>
    </div>
  );
}
