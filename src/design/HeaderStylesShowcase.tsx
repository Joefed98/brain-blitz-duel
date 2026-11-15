import { FrameMe } from "@/components/duel/ArenaGamePanel";
import { FrameScore } from "@/components/duel/GameFrame";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { TimerBar } from "@/components/duel/TimerBar";
import { DEFAULT_GAME_TIMER, GAME_TIMERS, GAME_TIMER_LABEL, type GameTimer } from "@/config/gameFrameConfig";
import { Button, Icon, SectionHeader } from "@/design/components";
import { TimerLookContext, setGameTimer, useGameTimer } from "@/lib/gameFrame/headerStyle";

/**
 * The game timer's three choices side by side in the style guide's header (/dev-design, development only): each drawn
 * with the real timer at 52 s of 90 (and, below, at 7 s, the bar's red last ten) and the real score block, a
 * one-on-one room's (an opponent) and practice's (the best). "Use in games" sets this device's choice, as Settings →
 * Appearance → Game timer does; the default for everyone is the one line in src/config/gameFrameConfig.ts.
 */
const NAMES: Record<GameTimer, string> = {
  bar: "Bar (default): a gold bar, seconds only at the end",
  ring: "Ring: a gold ring round the seconds",
  chip: "Chip: the seconds on a navy chip",
};

function Preview({ style, room, msLeft = 52_000 }: { style: GameTimer; room: boolean; msLeft?: number }) {
  const avatars = true;
  return (
    <div data-frame="puzzle" className="fx-header-preview" data-category="logic">
      <div data-header-style="mockup" data-game-timer={style} className="game-frame-header">
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
          <TimerLookContext.Provider value={{ kind: style, place: "header" }}>
            <TimerBar msRemaining={msLeft} totalMs={90_000} active={false} />
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
  const inGames = useGameTimer();
  return (
    <section data-header-styles className="flex flex-col gap-4">
      <h2 className="jz-title">Game timer</h2>
      <p className="jz-gallery-label">
        The default is {GAME_TIMER_LABEL[DEFAULT_GAME_TIMER]} (src/config/gameFrameConfig.ts, one line); players choose in Settings →
        Appearance → Game timer. “Use in games” sets this device’s choice.
      </p>
      <div className="fx-header-grid">
        {GAME_TIMERS.map((style) => (
          <div key={style} data-header-option={style} className="fx-header-option">
            <SectionHeader title={NAMES[style]} />
            <Preview style={style} room />
            <Preview style={style} room={false} />
            <Preview style={style} room={false} msLeft={7_000} />
            <Button variant={inGames === style ? "gold" : "secondary"} size={36} onClick={() => setGameTimer(style)}>
              {inGames === style ? "In games now" : "Use in games"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
