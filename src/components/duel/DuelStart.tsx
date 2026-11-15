import { useEffect, useRef } from "react";
import { puzzleDef } from "@/lib/duel/catalogue";
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
import { RoomMiniCard } from "./RoomPlayer";
import { useCelebrationsOn } from "@/components/fx/useCelebration";
import { useMomentElapsed } from "@/lib/fx/useRoomMoments";
import type { CSSProperties } from "react";
import type { PlayerLook } from "@/lib/duel/playerLook";

/** A player in the Prepare to Duel lineup: their seat, name and room look (their card when they have one). */
export interface LineupPlayer {
  slot: number;
  name: string;
  look: PlayerLook | undefined;
}

/** When the lineup's cards arrive (ms into Prepare to Duel), and the VS between two. */
export const LINEUP_IN_MS = 450;
export const LINEUP_STAGGER_MS = 90;
export const LINEUP_VS_MS = 1_350;

/** The mark's bolt (logoGeometry: x 7–21, y 0.5–33.5), with a little room each side. */
const DUEL_START_LOGO_VIEWBOX = "6 0.5 16 33";

/** No shell, controls or local animation clock: refresh resumes the shared frame. */
export function DuelStart({
  startedAt,
  type,
  players = [],
}: {
  startedAt: number;
  type: PuzzleType | undefined;
  /** The room's players (left ones out), whose cards arrive under the bolt (the effects pass, 15 Nov 2026). */
  players?: readonly LineupPlayer[];
}) {
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
      <DuelLineup players={players} startedAt={startedAt} />
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
/**
 * The players' cards arriving (15 Nov 2026, the effects pass; display only): two players face each other across a VS,
 * a bigger room's cards rise into rows, one after another, all inside Prepare to Duel's six seconds on the shared clock
 * (a late arrival sees the same frame). Entrance only: every card ends in place and visible, so reduced motion simply
 * shows them. Not drawn with the celebrations off (that screen exactly as before).
 */
function DuelLineup({ players, startedAt }: { players: readonly LineupPlayer[]; startedAt: number }) {
  const on = useCelebrationsOn();
  const elapsed = useMomentElapsed(startedAt);
  if (!on || players.length < 2) return null;
  const duel = players.length === 2;
  const size = duel ? 76 : players.length <= 4 ? 56 : players.length <= 8 ? 46 : 38;
  const named = players.length <= 4;
  const at = (ms: number) => ({ animationDelay: `${ms - elapsed}ms` }) as CSSProperties;
  return (
    <div className="duel-lineup" data-duel={duel ? "" : undefined} data-count={players.length} aria-label="Players">
      {players.map((p, i) => (
        <div
          key={p.slot}
          data-lineup-card=""
          data-side={duel ? (i === 0 ? "left" : "right") : undefined}
          className="duel-lineup-card"
          style={{ ...at(LINEUP_IN_MS + i * LINEUP_STAGGER_MS), "--i": i } as CSSProperties}
        >
          <RoomMiniCard slot={p.slot} name={p.name} look={p.look} size={size} />
          {named ? <span className="duel-lineup-name">{p.name}</span> : null}
        </div>
      ))}
      {duel ? (
        <span data-lineup-vs="" className="duel-lineup-vs" aria-hidden="true" style={at(LINEUP_VS_MS)}>
          VS
        </span>
      ) : null}
    </div>
  );
}
