import { useEffect, useRef, useState, type ReactNode } from "react";

import { AppWordmark } from "@/components/brand/AppWordmark";
import { Badge, Captain, Emblem, MedalArt, Trophy } from "@/design/art";
import { Button } from "@/design/components";
import { markFirstOpenSeen } from "@/lib/firstOpen";

/**
 * The first-open onboarding (wave 1, first impressions, 10 Nov 2026; docs/mockups/wave-1/O1-Hello, O2-How,
 * O3-First; rules in src/lib/firstOpen.ts, off until wave 3). Three screens over whatever page the phone
 * opened on, swiped or stepped with Next, Skip on every one (O3 included), and on the last a gold button to
 * start playing and a quiet "Play with friends instead". Never asks for an account or anything personal.
 *
 * Kept light so a new player is playing within seconds: loaded only when it shows (the root imports it
 * lazily), no images but the approved Captain Joulz SVG and the reward art already in the app, no entrance
 * animation (the 300 ms slide between screens only, none under reduced motion).
 */
const SWIPE_PX = 40;
const SCREENS = 3;

export function FirstOpen({ onPlay, onFriends, onDone }: { onPlay: () => void; onFriends: () => void; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const last = index === SCREENS - 1;

  // Keyboard and screen readers start inside the dialog.
  useEffect(() => root.current?.focus(), []);

  const finish = (then: () => void) => {
    markFirstOpenSeen();
    onDone();
    then();
  };
  const skip = () => finish(() => undefined);
  const go = (to: number) => setIndex(Math.max(0, Math.min(SCREENS - 1, to)));

  const endDrag = (x: number, y: number) => {
    const from = start.current;
    start.current = null;
    setDrag(0);
    if (!from) return;
    const dx = x - from.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(y - from.y)) go(index + (dx < 0 ? 1 : -1));
  };

  const screen = (i: number, label: string, body: ReactNode) => (
    <section
      key={i}
      data-first-open-screen={i + 1}
      aria-label={label}
      aria-hidden={i !== index}
      inert={i !== index}
      className="fo-screen"
    >
      {body}
    </section>
  );

  return (
    <div
      ref={root}
      tabIndex={-1}
      data-first-open
      data-skin="room"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
      className="fo-root"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        else if (e.key === "ArrowLeft") go(index - 1);
        else if (e.key === "Escape") skip();
      }}
    >
      <div className="fo-column pad-safe">
        <div className="fo-top">
          <button type="button" data-first-open-skip onClick={skip} className="fo-skip press tap-target">
            Skip
          </button>
        </div>

        <div
          data-first-open-track
          className="fo-track"
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          }}
          onPointerMove={(e) => {
            const from = start.current;
            if (!from || from.id !== e.pointerId) return;
            const dx = e.clientX - from.x;
            const edge = (index === 0 && dx > 0) || (last && dx < 0);
            setDrag(edge ? dx / 4 : dx);
          }}
          onPointerUp={(e) => endDrag(e.clientX, e.clientY)}
          onPointerCancel={() => {
            start.current = null;
            setDrag(0);
          }}
        >
          <div
            className="fo-strip"
            data-dragging={drag !== 0 || undefined}
            style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))` }}
          >
            {screen(
              0,
              "Hello",
              <div className="fo-hero">
                <span className="fo-art" aria-hidden="true">
                  <Captain pose="win" size={150} />
                </span>
                <AppWordmark />
                <h2 data-wrap-ok className="fo-title">Live puzzles and games against real people.</h2>
                <p data-wrap-ok className="fo-sub">Real time. Pure skill.</p>
              </div>,
            )}
            {screen(
              1,
              "How it works",
              <div className="fo-how">
                <h2 data-wrap-ok className="fo-how-title">How it works</h2>
                <div className="jz-panel fo-card">
                  <span className="fo-icons" aria-hidden="true">
                    <span className="fo-cat" data-cat="word" />
                    <span className="fo-cat" data-cat="number" />
                    <span className="fo-cat" data-cat="pattern" />
                  </span>
                  <h3 data-wrap-ok className="fo-card-title">Play a match</h3>
                  <p data-wrap-ok className="fo-card-body">Best of 3 against someone your level. Puzzles, arcade or both.</p>
                </div>
                <div className="jz-panel fo-card">
                  <span className="fo-icons" aria-hidden="true">
                    <Emblem tier="spark" size={34} marker={false} />
                    <Emblem tier="volt" size={34} marker={false} />
                    <Emblem tier="storm" size={40} marker={false} />
                    <Emblem tier="lightning" size={40} marker={false} />
                  </span>
                  <h3 data-wrap-ok className="fo-card-title">Climb the tiers</h3>
                  <p data-wrap-ok className="fo-card-body">Win to raise your Joulz Rating, from Spark all the way to the Top 500.</p>
                </div>
                <div className="jz-panel fo-card">
                  <span className="fo-icons" aria-hidden="true">
                    <MedalArt metal="gold" size={30} />
                    <Badge kind="club" size={46} label="" />
                    <Trophy kind="gold" size={40} label="" />
                  </span>
                  <h3 data-wrap-ok className="fo-card-title">Collect as you go</h3>
                  <p data-wrap-ok className="fo-card-body">Stars, badges, trophies and looks for your player card.</p>
                </div>
              </div>,
            )}
            {screen(
              2,
              "Your first match",
              <div className="fo-hero">
                <span className="fo-art" aria-hidden="true">
                  <Captain pose="ready" size={140} />
                </span>
                <h2 data-wrap-ok className="fo-title">Ready for your first match?</h2>
                <p data-wrap-ok className="fo-sub">Best of 3 against someone new, about 4 minutes. No sign-up needed.</p>
              </div>,
            )}
          </div>
        </div>

        <div className="fo-bottom">
          <div className="fo-dots" aria-hidden="true">
            {Array.from({ length: SCREENS }, (_, i) => (
              <span key={i} data-current={i === index || undefined} />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">{`Step ${index + 1} of ${SCREENS}`}</p>
          {last ? (
            <>
              <Button variant="gold" size={58} block data-first-open-play onClick={() => finish(onPlay)}>
                Play my first match
              </Button>
              <button type="button" data-first-open-friends onClick={() => finish(onFriends)} className="fo-quiet press tap-target">
                Play with friends instead
              </button>
            </>
          ) : (
            <Button variant="gold" size={58} block data-first-open-next onClick={() => go(index + 1)}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FirstOpen;
