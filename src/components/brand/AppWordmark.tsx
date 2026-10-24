import { useEffect, useState } from "react";

import { APP_NAME } from "@/lib/brand";
import { LOGO_CHARGE_MS, logoChargeSound, logoChargeWanted, noteLogoCharged, onAppOpen } from "@/lib/fx/celebrations";

import { LogoMark } from "./LogoMark";

/**
 * The tab screens' wordmark (Prompt R, 23 Oct 2026): the name in Archivo 900, every letter white but
 * the last, which is shiny gold, then the gold logo mark (polish-layout/app-pages.css). The name is
 * APP_NAME (src/lib/brand.ts), uppercased. With celebrations on, the mark charges in once per app open
 * (LogoMark `charge`; celebrations.ts logoChargeWanted / onAppOpen), then is drawn without `charge`: the
 * mark exactly as it is without celebrations. The charge-in sounds sfx_logo_charge when sound is already
 * unlocked (logoChargeSound), else nothing.
 */

export function AppWordmark() {
  const name = APP_NAME.toUpperCase();
  const [charge, setCharge] = useState(logoChargeWanted);
  const [opening, setOpening] = useState(0);
  useEffect(() => noteLogoCharged(), []);
  useEffect(() => {
    if (!charge) return;
    logoChargeSound();
    const done = window.setTimeout(() => setCharge(false), LOGO_CHARGE_MS + 100);
    return () => window.clearTimeout(done);
  }, [charge, opening]);
  // Reopening the app: the mark on screen charges in again (a fresh element restarts its clock).
  useEffect(
    () =>
      onAppOpen(() => {
        setOpening((n) => n + 1);
        setCharge(true);
      }),
    [],
  );
  return (
    <span data-app-wordmark className="ap-wordmark" aria-label={name} role="img">
      <span aria-hidden="true" className="ap-wordmark-text">
        {name.slice(0, -1)}
        <span className="ap-wordmark-last">{name.slice(-1)}</span>
      </span>
      <LogoMark key={opening} width={17} height={22} className="ap-wordmark-mark" charge={charge} />
    </span>
  );
}
