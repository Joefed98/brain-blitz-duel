import { useState } from "react";

import { FrameMe } from "@/components/duel/ArenaGamePanel";
import { FrameScore } from "@/components/duel/GameFrame";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { TimerBar } from "@/components/duel/TimerBar";
import { GAME_HEADER_STYLE, HEADER_STYLES, type HeaderStyle } from "@/config/gameFrameConfig";
import { Button, Icon, SectionHeader } from "@/design/components";
import { DEV_HEADER_STYLE_KEY, TIMER_LOOK, TimerLookContext, headerStyleNow } from "@/lib/gameFrame/headerStyle";

/**
 * The header styles side by side (/dev-design, development only): each style's header drawn with the real timer at
 * 52 s of 90 and the real score block, a one-on-one room's (an opponent) and practice's (the best). "Use in games"
 * stores the style for this browser's games (development builds only); the default for everyone is the one line in
 * src/config/gameFrameConfig.ts.
 */
const NAMES: Record<HeaderStyle, string> = {
  mockup: "Mockup: avatars, score, time bar",
  ring: "Ring: the name, a gold ring timer",
  digital: "Digital: avatars, a 0:52 countdown",
  chip: "Chip: a shrinking time chip",
};

function Preview({ style, room }: { style: HeaderStyle; room: boolean }) {
  const avatars = style === "mockup" || style === "digital";
  return (
    <div data-frame="puzzle" className="fx-header-preview" data-category="logic">
      <div data-header-style={style} data-game-frame-header className="game-frame-header">
        <div className="game-frame-left">
          {avatars ? (
            <span data-frame-me className="game-frame-avatar">
              <FrameMe size={36} />
            </span>
          ) : null}
          <span className="game-frame-titles">
            <span className="game-frame-name">Polypotions</span>
            <span className="game-frame-context">
              <span aria-hidden="true" className="game-frame-dot" />
              <span className="game-frame-context-text">{room ? "Round 1 of 3" : "Logic, Practice"}</span>
            </span>
          </span>
        </div>
        <div className="game-frame-timer">
          <TimerLookContext.Provider value={TIMER_LOOK[style]}>
            <TimerBar msRemaining={52_000} totalMs={90_000} active={false} />
          </TimerLookContext.Provider>
        </div>
        <div className="game-frame-right">
          {room ? <FrameScore value={142} note="Sam_Volt 128" /> : <FrameScore label="Best" value={182} />}
          {avatars && room ? (
            <span data-frame-opponent className="game-frame-avatar game-frame-slot">
              <PlayerBadge look={{ colour: 6, icon: null }} name="Sam_Volt" size={36} />
            </span>
          ) : (
            <span className="game-frame-slot" />
          )}
          <span className="game-frame-icon-button">
            <Icon name="menu" size={20} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function HeaderStylesShowcase() {
  const [inGames, setInGames] = useState<HeaderStyle>(headerStyleNow);
  const use = (style: HeaderStyle) => {
    try {
      window.localStorage.setItem(DEV_HEADER_STYLE_KEY, style);
    } catch {
      /* this visit only */
    }
    setInGames(style);
  };
  return (
    <section data-header-styles className="flex flex-col gap-4">
      <h2 className="jz-title">Header styles</h2>
      <p className="jz-gallery-label">
        The default is {GAME_HEADER_STYLE} (src/config/gameFrameConfig.ts, one line). “Use in games” plays this browser’s games
        in a style (development only).
      </p>
      <div className="fx-header-grid">
        {HEADER_STYLES.map((style) => (
          <div key={style} data-header-option={style} className="fx-header-option">
            <SectionHeader title={NAMES[style]} />
            <Preview style={style} room />
            <Preview style={style} room={false} />
            <Button variant={inGames === style ? "gold" : "secondary"} size={36} onClick={() => use(style)}>
              {inGames === style ? "In games now" : "Use in games"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
