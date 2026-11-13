/**
 * iPhone Safari (outside a home-screen app), for the Add to Home Screen hint (playCards.ts, which re-exports these) and
 * the push ask's how-to (src/lib/push/pushClient.ts). Its own module, importing nothing, so code that needs the test
 * reaches no game code (economy-neutral-check walks the imports).
 */

/**
 * iPhone Safari itself: an iPhone, Safari's "Version/…" token, and none of the other browsers or in-app
 * views that also say Safari (Chrome, Firefox, Edge, Opera, Google, DuckDuckGo, Facebook, Instagram…),
 * which can't add to the home screen the same way. The boot script spells the same two patterns.
 */
export const IPHONE_UA = /iPhone|iPod/;
export const NOT_SAFARI_UA = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|FBAN|FBAV|Instagram|Line\/|Snapchat|YaBrowser|Mercury/;

/** What the boot script reads of the browser for the home-screen hint (window.navigator, matchMedia). */
export interface BootDevice {
  ua: string;
  /** Already a home-screen app (navigator.standalone, or display-mode: standalone). */
  standalone: boolean;
}

/** True on iPhone Safari outside a home-screen app: where the Add to Home Screen hint may show. */
export function iphoneSafari(device: BootDevice | null): boolean {
  return !!device && !device.standalone && IPHONE_UA.test(device.ua) && /Safari\//.test(device.ua) && /Version\//.test(device.ua) && !NOT_SAFARI_UA.test(device.ua);
}
