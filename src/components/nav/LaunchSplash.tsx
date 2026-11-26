import { useEffect, useState } from "react";

import { AppWordmark } from "@/components/brand/AppWordmark";
import { LOGO_BOX, LOGO_PATHS } from "@/components/brand/logoGeometry";
import { logoChargeSound } from "@/lib/fx/celebrations";

/**
 * The launch screen (phase 2 step 1, 14 Nov 2026; P1, 21 Nov 2026: the earlier plan's row A1 with Joe's pick, U1a
 * without the speed lines or the caption). The Joulz bolt, the vector mark at 160 px on --jz-bg (the colour of the
 * iPhone launch images, APP_SPLASHES, so the app opens without a jump), fills from the bottom to the top over 0.6 s
 * while gold sparks leave its tip, the wordmark fading in under it. It is drawn with the server-rendered page and
 * stays at least SPLASH_MIN_MS from the page's start, then fades out over SPLASH_FADE_MS; it lets taps through from
 * the moment it starts fading. Under Reduce motion the bolt is drawn full with no sparks. The charge's sound
 * (`shared.celebrate.logoCharge`) plays only where sound is already unlocked (a re-open); a cold open is silent,
 * since phones block sound before the first tap.
 *
 * In a browser run by automation (the checks) it goes the moment the app has started, as before, unless the page
 * sets `window.__DUELZ_ALLOW_SPLASH__` (as practice packs and the first open do), so no check waits on it.
 */
export const SPLASH_MIN_MS = 900;
export const SPLASH_FADE_MS = 200;
/** The sparks: a fixed fan off the bolt's tip (degrees from straight up, distance in px), drawn by CSS. */
const SPARKS: readonly [number, number][] = Array.from({ length: 24 }, (_, i) => {
  const angle = -150 + (i * 300) / 23;
  return [Math.round(angle), 44 + ((i * 37) % 5) * 10];
});

/** A browser under automation, unless a check's page allows the splash (never readable in a production build). */
function automated(): boolean {
  try {
    if (typeof navigator === "undefined" || navigator.webdriver !== true) return false;
    if (import.meta.env.PROD) return true;
    return !(window as unknown as Record<string, unknown>)["__DUELZ_ALLOW_SPLASH__"];
  } catch {
    return false;
  }
}

export function LaunchSplash({ hold = false }: { hold?: boolean }) {
  const [phase, setPhase] = useState<"up" | "leaving" | "done">("up");
  // `hold`: the screen checks' review draw only (scripts/safe-area-harness.tsx).
  useEffect(() => {
    if (hold) return;
    if (automated()) {
      setPhase("done");
      return;
    }
    logoChargeSound();
    const since = typeof performance !== "undefined" ? performance.now() : SPLASH_MIN_MS;
    const wait = Math.max(0, SPLASH_MIN_MS - since);
    let timer = window.setTimeout(() => {
      setPhase("leaving");
      timer = window.setTimeout(() => setPhase("done"), SPLASH_FADE_MS);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [hold]);
  const done = phase === "done";
  return (
    <div
      className="jz-nav jz-launch"
      data-launch
      data-skin="play"
      data-leaving={phase === "leaving" ? "" : undefined}
      data-done={done ? "" : undefined}
      role="status"
      aria-label="Joulz is starting"
      aria-hidden={phase !== "up" ? true : undefined}
    >
      <span className="jz-launch-bolt" aria-hidden="true">
        <svg viewBox={`0 0 ${LOGO_BOX.w} ${LOGO_BOX.h}`} width={Math.round((160 * LOGO_BOX.w) / LOGO_BOX.h)} height={160} focusable="false" data-launch-bolt>
          <path d={LOGO_PATHS.bolt} className="jz-launch-bolt-dim" />
          <path d={LOGO_PATHS.bolt} className="jz-launch-bolt-fill" />
        </svg>
        <span className="jz-launch-sparks">
          {SPARKS.map(([angle, far], i) => (
            <span key={i} style={{ ["--a" as string]: `${angle}deg`, ["--d" as string]: `${far}px`, ["--i" as string]: String(i % 6) }} />
          ))}
        </span>
      </span>
      <span data-one-line className="jz-launch-name">
        <AppWordmark />
      </span>
    </div>
  );
}
