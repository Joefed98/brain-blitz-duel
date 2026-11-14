import { useEffect, useState } from "react";

/**
 * Appearance (phase 2 step 2b, Joe 14 Nov 2026): Settings → Appearance with Dark (the default), Light and Match my
 * device, remembered on the device. The choice is applied to <html> as `data-theme="light"` (dark is the absence of
 * the attribute, so every screen without a choice draws exactly as before), before the first paint by APPEARANCE_BOOT
 * (an inline script in the root's <head>, allowed by its hash: src/lib/security/csp.ts) and live by applyAppearance.
 * The light tokens reach every page (src/design/tokens.css); game screens (boards and HUDs) stay dark in every theme
 * until step 4 restyles them. The phone's status bar colour (the theme-color meta) follows the page, and is held dark
 * while a game screen is up (holdDarkStatusBar).
 */
export type Appearance = "dark" | "light" | "system";
export type Theme = "dark" | "light";

export const APPEARANCE_KEY = "duelz-appearance:v1";
export const APPEARANCE_EVENT = "duelz-appearance-change";
const SYSTEM_LIGHT = "(prefers-color-scheme: light)";
/** The status bar's colour for each theme: --jz-bg in that theme (tokens.css). */
export const STATUS_BAR: Record<Theme, string> = {
  dark: "#06080F", // design-lint-ignore: mirrors --jz-bg (dark)
  light: "#F3F4F8", // design-lint-ignore: mirrors --jz-bg (light)
};

export const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Match my device" },
];

/** The stored choice; dark when none (or storage is unavailable). */
export function readAppearance(): Appearance {
  try {
    const v = window.localStorage.getItem(APPEARANCE_KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

/** The theme a choice draws now: "system" follows the device's light or dark setting. */
export function resolveTheme(choice: Appearance, systemLight = systemPrefersLight()): Theme {
  if (choice === "system") return systemLight ? "light" : "dark";
  return choice;
}

function systemPrefersLight(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(SYSTEM_LIGHT).matches;
}

let darkHolds = 0;

function setStatusBar(theme: Theme): void {
  const colour = STATUS_BAR[darkHolds > 0 ? "dark" : theme];
  for (const meta of Array.from(document.querySelectorAll('meta[name="theme-color"]'))) meta.setAttribute("content", colour);
}

/** Applies a choice to <html> and the status bar now. */
export function applyAppearance(choice: Appearance = readAppearance()): Theme {
  const theme = resolveTheme(choice);
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  root.setAttribute("data-appearance", choice);
  setStatusBar(theme);
  return theme;
}

/** Saves and applies a choice; every useAppearance hears it. */
export function setAppearance(choice: Appearance): void {
  try {
    window.localStorage.setItem(APPEARANCE_KEY, choice);
  } catch {
    /* this session only */
  }
  applyAppearance(choice);
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

/** While a game screen is up, the status bar stays dark over the dark game (returns the release). */
export function holdDarkStatusBar(): () => void {
  darkHolds++;
  setStatusBar(resolveTheme(readAppearance()));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    darkHolds = Math.max(0, darkHolds - 1);
    setStatusBar(resolveTheme(readAppearance()));
  };
}

let installed = false;
/** Once, from the root: follow the device while the choice is "system". */
export function installAppearance(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  applyAppearance();
  window.matchMedia?.(SYSTEM_LIGHT).addEventListener?.("change", () => {
    if (readAppearance() === "system") applyAppearance("system");
  });
}

/** The stored choice, kept current. */
export function useAppearance(): Appearance {
  const [choice, setChoice] = useState<Appearance>("dark");
  useEffect(() => {
    const read = () => setChoice(readAppearance());
    read();
    window.addEventListener(APPEARANCE_EVENT, read);
    return () => window.removeEventListener(APPEARANCE_EVENT, read);
  }, []);
  return choice;
}

/**
 * Before the first paint (the root's <head>): the stored choice on <html> and the status bar, so a light page never
 * flashes dark. Plain ES5, no imports; keep it in step with applyAppearance.
 */
export const APPEARANCE_BOOT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)});if(c!=="light"&&c!=="system")c="dark";var l=c==="light"||(c==="system"&&window.matchMedia&&matchMedia(${JSON.stringify(SYSTEM_LIGHT)}).matches);var r=document.documentElement;if(l)r.setAttribute("data-theme","light");r.setAttribute("data-appearance",c);var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",l?${JSON.stringify(STATUS_BAR.light)}:${JSON.stringify(STATUS_BAR.dark)});}catch(e){}})();`;
