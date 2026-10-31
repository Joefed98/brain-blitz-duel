/**
 * Whether the phone has a connection (offline practice, 31 Oct 2026), as the browser reports it, plus the
 * boot script that marks <html> before the first paint so the offline banner and the Practice tab's
 * install card never pop in or push the page down:
 *
 *  - `data-offline`: the browser says there is no connection (kept up to date by installOnlineMarker);
 *  - `data-offline-install`: iPhone Safari outside a home-screen app, card not dismissed. iOS can clear a
 *    website's stored data after a few weeks unused, but not a home-screen app's, so offline practice
 *    should live on the home screen.
 */
import { useSyncExternalStore } from "react";

import { IPHONE_UA, NOT_SAFARI_UA } from "@/lib/playCards";

/** The install card's dismissal (device storage). */
export const OFFLINE_INSTALL_KEY = "duelz-offline-install:v1";

export const OFFLINE_BOOT = `(function(){try{var d=document.documentElement;if(navigator.onLine===false)d.setAttribute("data-offline","");var u=navigator.userAgent||"";var s=navigator.standalone===true||(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches);var k=null;try{k=window.localStorage.getItem(${JSON.stringify(OFFLINE_INSTALL_KEY)})}catch(e){}if(!s&&!k&&/${IPHONE_UA.source}/.test(u)&&/Safari\\//.test(u)&&/Version\\//.test(u)&&!/${NOT_SAFARI_UA.source}/.test(u))d.setAttribute("data-offline-install","")}catch(e){}})();`;

export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** True while the browser reports a connection (the server render and the first client render say online). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}

/** Keeps <html data-offline> in step with the connection (the banner's CSS reads it). */
export function installOnlineMarker(): () => void {
  const mark = () => {
    if (isOnline()) document.documentElement.removeAttribute("data-offline");
    else document.documentElement.setAttribute("data-offline", "");
  };
  mark();
  return subscribe(mark);
}

export function dismissOfflineInstall(): void {
  document.documentElement.removeAttribute("data-offline-install");
  try {
    window.localStorage.setItem(OFFLINE_INSTALL_KEY, JSON.stringify({ dismissedAt: new Date().toISOString() }));
  } catch {
    /* storage blocked: it shows again next visit */
  }
}
