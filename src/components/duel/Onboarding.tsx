import { useEffect, useRef, useState, type ReactNode } from "react";

import { PhoneShell } from "./PhoneShell";
import { AppWordmark } from "@/components/brand/AppWordmark";
import { LogoMark } from "@/components/brand/LogoMark";
import { topRoundMax } from "@/lib/duel/roundMax";
import { markOnboardingSeen } from "@/lib/onboarding";
import { playLock, unlockAudio } from "@/lib/sound";
import { Button } from "@/design/components";

/**
 * The first-time intro (16 Oct 2026, presentation only; src/lib/onboarding.ts): three
 * panels, swiped or stepped with Next, Skip on every one. Home shows it once per device
 * and from "How it works". The name comes only from the wordmark (AppWordmark, APP_NAME), never the copy.
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
    art: <RivalsArt />,
  },
  {
    title: "Same game, same time.",
    body: "Create a room and share the code, or join a friend's. Everyone plays the same game at once.",
    art: <RoomCodeArt />,
  },
  {
    title: "Score big, win the room.",
    // The top is the games' own maximums (roundMax.ts): "Every game" while they all share it.
    body: `${topRoundMax().shared ? "Every game scores" : "Games score"} up to ${topRoundMax().top}. Faster and sharper scores higher. Most points across the rounds wins.`,
    art: <ScoreArt />,
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
    // The room screens' look (Polish batch R): Archivo, sentence case, gold only for "Let's play".
    <PhoneShell bare skin="room">
      <div
        data-onboarding
        role="dialog"
        aria-modal="true"
        aria-labelledby={`onboarding-title-${index}`}
        className="flex min-h-0 flex-1 flex-col animate-phase-in"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          else if (e.key === "ArrowLeft") go(index - 1);
          else if (e.key === "Escape") onDone();
        }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2">
          <AppWordmark />
          <button
            type="button"
            data-onboarding-skip
            onClick={() => {
              unlockAudio();
              onDone();
            }}
            className="press tap-target -mr-3 px-3 text-[15px] font-semibold text-[var(--ap-link)]"
          >
            Skip
          </button>
        </div>

        <div
          data-onboarding-track
          className="flex min-h-0 flex-1 select-none flex-col justify-center overflow-hidden"
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
                className="flex w-full shrink-0 flex-col items-center px-1 text-center"
              >
                <div className="flex h-28 items-center justify-center" aria-hidden="true">
                  {panel.art}
                </div>
                <h2
                  id={`onboarding-title-${i}`}
                  className="mt-6 text-[1.75rem] font-extrabold leading-tight text-foreground"
                >
                  {panel.title}
                </h2>
                <p className="mt-3 max-w-[20rem] text-base leading-relaxed text-muted-foreground">
                  {panel.body}
                </p>
              </section>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-5 pb-4 pt-4">
          <div className="flex items-center gap-2" aria-hidden="true">
            {PANELS.map((panel, i) => (
              <span
                key={panel.title}
                data-onboarding-dot={i === index ? "current" : ""}
                className={`h-2 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                  i === index ? "w-6 bg-[var(--ap-text)]" : "w-2 bg-[var(--ap-line)]"
                }`}
              />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {`Step ${index + 1} of ${PANELS.length}`}
          </p>
          <Button variant={last ? "gold" : "secondary"} size={52} block data-onboarding-next onClick={next}>
            {last ? "Let's play" : "Next"}
          </Button>
        </div>
      </div>
    </PhoneShell>
  );
}

/** Two players, one bolt between them. */
function RivalsArt() {
  const avatar = (letter: string, tone: string) => (
    <span
      className={`flex h-16 w-16 items-center justify-center rounded-full border-2 font-display text-2xl font-bold ${tone}`}
    >
      {letter}
    </span>
  );
  return (
    <div className="flex items-center gap-4">
      {avatar("A", "border-primary/70 bg-primary/10 text-primary")}
      <LogoMark width={26} height={34} />
      {avatar("B", "border-border bg-card text-foreground")}
    </div>
  );
}

/** The four code boxes, as on the join screen. */
function RoomCodeArt() {
  return (
    <div className="flex gap-2">
      {["P", "L", "A", "Y"].map((letter, i) => (
        <span
          key={i}
          className={`flex h-16 w-14 items-center justify-center rounded-xl border bg-card font-mono text-3xl font-bold ${
            i === 0 ? "border-primary text-primary" : "border-border text-foreground"
          }`}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}

/** The top score. */
function ScoreArt() {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="font-mono text-6xl font-bold text-primary">{topRoundMax().top}</span>
      <span className="mt-2 text-[13px] font-semibold text-muted-foreground">
        top score
      </span>
    </div>
  );
}
