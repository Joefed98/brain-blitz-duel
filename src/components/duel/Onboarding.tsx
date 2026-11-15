import { useEffect, useRef, useState, type ReactNode } from "react";

import { PhoneShell } from "./PhoneShell";
import { SETTINGS_ART, type SettingsArtName } from "@/components/settings/settingsArt.data";
import { topRoundMax } from "@/lib/duel/roundMax";
import { markOnboardingSeen } from "@/lib/onboarding";
import { playLock, unlockAudio } from "@/lib/sound";
import { Button } from "@/design/components";

/**
 * The first-time intro (16 Oct 2026, presentation only; src/lib/onboarding.ts): three
 * panels, swiped or stepped with Next, Skip on every one. Home shows it once per device
 * and from "How it works". The copy never spells the app's name. Art: the style guide's 3D art kit (scripts/settings-art.ts).
 */
interface Panel {
  title: string;
  body: string;
  art: ReactNode;
}

const PANELS: Panel[] = [
  {
    title: "Quick games. Real rivals.",
    body: "Brain teasers and arcade games, about two minutes each, played against your friends.",
    art: <KitArt name="games" />,
  },
  {
    title: "Same game, same time.",
    body: "Create a room and share the code, or join a friend’s. Everyone plays the same game at once.",
    art: <KitArt name="rooms" />,
  },
  {
    title: "Score big, win the room.",
    // The top is the games' own maximums (roundMax.ts): "Every game" while they all share it.
    body: `${topRoundMax().shared ? "Every game scores" : "Games score"} up to ${topRoundMax().top}. Faster and sharper scores higher. Most points across the rounds wins.`,
    art: <KitArt name="trophy" />,
  },
];

/** A horizontal drag this far (px) turns the panel. */
const SWIPE_PX = 40;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const last = index === PANELS.length - 1;

  // Shown once: the flag is set as soon as the intro is up, so leaving mid-way still counts.
  useEffect(() => markOnboardingSeen(), []);

  const go = (to: number) => setIndex(Math.max(0, Math.min(PANELS.length - 1, to)));
  const next = () => {
    unlockAudio();
    if (last) {
      onDone();
      return;
    }
    playLock();
    go(index + 1);
  };

  const endDrag = (x: number, y: number) => {
    const from = start.current;
    start.current = null;
    setDrag(0);
    if (!from) return;
    const dx = x - from.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(y - from.y)) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    // The style guide's look (the Settings session, 14 Nov 2026): plain page, art-kit art, Title and Label type, the
    // gold button only for "Let's play"; a centred panel on tablets and computers (polish-layout/settings.css).
    <PhoneShell bare skin="room">
      <div
        data-onboarding
        role="dialog"
        aria-modal="true"
        aria-labelledby={`onboarding-title-${index}`}
        className="ob-page animate-phase-in"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          else if (e.key === "ArrowLeft") go(index - 1);
          else if (e.key === "Escape") onDone();
        }}
      >
        <div className="ob-head">
          <Button
            variant="quiet"
            size={44}
            data-onboarding-skip
            onClick={() => {
              unlockAudio();
              onDone();
            }}
            className="ob-skip"
          >
            Skip
          </Button>
        </div>

        <div
          data-onboarding-track
          data-dragging={drag !== 0 ? "" : undefined}
          className="ob-track"
          style={{ touchAction: "pan-y" }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          }}
          onPointerMove={(e) => {
            const from = start.current;
            if (!from || from.id !== e.pointerId) return;
            const dx = e.clientX - from.x;
            // Resist past the first and last panel.
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
            className={`flex w-full ${drag === 0 ? "transition-transform duration-300 ease-out motion-reduce:transition-none" : ""}`}
            style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))` }}
          >
            {PANELS.map((panel, i) => (
              <section
                key={panel.title}
                data-onboarding-panel={i + 1}
                aria-hidden={i !== index}
                inert={i !== index}
                className="ob-panel"
              >
                <div className="ob-art" aria-hidden="true">
                  {panel.art}
                </div>
                <h2 id={`onboarding-title-${i}`} className="ob-title">
                  {panel.title}
                </h2>
                <p className="ob-body">{panel.body}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="ob-foot">
          <div className="ob-dots" aria-hidden="true">
            {PANELS.map((panel, i) => (
              <span key={panel.title} data-onboarding-dot={i === index ? "current" : ""} className="ob-dot" />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {`Step ${index + 1} of ${PANELS.length}`}
          </p>
          <Button variant={last ? "gold" : "secondary"} size={52} block data-onboarding-next onClick={next}>
            {last ? "Let’s play" : "Next"}
          </Button>
        </div>
      </div>
    </PhoneShell>
  );
}

/** One of the art kit's 3D renders (scripts/settings-art.ts: 128 px, and the 192 px source for sharper screens). */
function KitArt({ name }: { name: SettingsArtName }) {
  const [one, more] = SETTINGS_ART[name];
  return <img src={one} srcSet={`${one} 1x, ${more} 1.5x`} width={128} height={128} alt="" draggable={false} decoding="async" data-onboarding-art={name} />;
}

