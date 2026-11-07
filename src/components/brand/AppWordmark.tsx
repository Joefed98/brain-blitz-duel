import { useEffect, useState } from "react";

import { LOGO_CHARGE_MS, logoChargeSound, logoChargeWanted, noteLogoCharged, onAppOpen } from "@/lib/fx/celebrations";

import { LogoMark } from "./LogoMark";
import { APP_NAME } from "@/lib/brand";

/**
 * The one wordmark (Prompt R, 23 Oct 2026; one look since design foundation F4, 6 Nov 2026,
 * wordmark.ts): the name in Archivo 900 at 118 % width, every letter white, then the gold logo mark in
 * --jz-gold (polish-layout/app-pages.css). The name is APP_NAME (src/lib/brand.ts), set in capitals by
 * CSS (DESIGN.md hard rule 6), so a screen reader reads the word. With celebrations on, the mark charges in once per app open
 * (LogoMark `charge`; celebrations.ts logoChargeWanted / onAppOpen), then is drawn without `charge`: the
 * mark exactly as it is without celebrations. The charge-in sounds sfx_logo_charge when sound is already
 * unlocked (logoChargeSound), else nothing. `still` (the update overlay) never charges in.
 */

export function AppWordmark({ still = false }: { still?: boolean } = {}) {
  const name = APP_NAME;
  const [charge, setCharge] = useState(() => !still && logoChargeWanted());
  const [opening, setOpening] = useState(0);
  useEffect(() => {
    if (!still) noteLogoCharged();
  }, [still]);
  useEffect(() => {
    if (!charge) return;
    logoChargeSound();
    const done = window.setTimeout(() => setCharge(false), LOGO_CHARGE_MS + 100);
    return () => window.clearTimeout(done);
  }, [charge, opening]);
  // Reopening the app: the mark on screen charges in again (a fresh element restarts its clock).
  useEffect(() => {
    if (still) return;
    return onAppOpen(() => {
      setOpening((n) => n + 1);
      setCharge(true);
    });
  }, [still]);
  return (
    <span data-app-wordmark className="ap-wordmark" aria-label={name} role="img">
      <span aria-hidden="true" className="ap-wordmark-text">
        {name}
      </span>
      <LogoMark key={opening} width={17} height={22} className="ap-wordmark-mark" charge={charge} />
    </span>
  );
}
