import { useEffect, useState } from "react";

import { APP_NAME } from "@/lib/brand";
import { logoChargeWanted, noteLogoCharged } from "@/lib/fx/celebrations";

import { LogoMark } from "./LogoMark";

/**
 * The tab screens' wordmark (Prompt R, 23 Oct 2026): the name in Archivo 900, every letter white but
 * the last, which is shiny gold, then the gold logo mark (polish-layout/app-pages.css). The name is
 * APP_NAME (src/lib/brand.ts), uppercased. With celebrations on, the app's first wordmark charges
 * its mark in (LogoMark `charge`); every later one is drawn finished.
 */

export function AppWordmark() {
  const name = APP_NAME.toUpperCase();
  const [charge] = useState(logoChargeWanted);
  useEffect(() => noteLogoCharged(), []);
  return (
    <span data-app-wordmark className="ap-wordmark" aria-label={name} role="img">
      <span aria-hidden="true" className="ap-wordmark-text">
        {name.slice(0, -1)}
        <span className="ap-wordmark-last">{name.slice(-1)}</span>
      </span>
      <LogoMark width={17} height={22} className="ap-wordmark-mark" charge={charge} />
    </span>
  );
}
