/**
 * appearance-check (phase 2 step 2b, 14 Nov 2026; Joe: Settings → Appearance with Dark, Light and Match my device):
 *
 *  1. The setting (happy-dom): dark by default (no choice stored, or storage unavailable: no data-theme on <html>);
 *     Light sets data-theme="light"; Match my device follows the device's prefers-color-scheme, live; the choice is
 *     kept on the device; the boot script (APPEARANCE_BOOT, run before the first paint) draws the same as
 *     applyAppearance for every choice and device; the status bar (the theme-color meta) follows the theme and is held
 *     dark while a game screen is up; the boot script is one of the root's hashed inline scripts; Settings draws the
 *     three choices.
 *  2. In Chromium on the screen harness: a page drawn dark by default takes the dark tokens; the same page in light
 *     the light tokens; a game screen (the answer reveal, puzzle and arcade) stays dark in light (its tokens, aliases
 *     and the page edge); the boot script under an emulated light device with "Match my device" draws light, and
 *     under a dark device dark.
 *
 *   bun scripts/appearance-check.tsx
 */
import { existsSync, readFileSync } from "node:fs";
import { Window } from "happy-dom";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

/* ------------------------------------------------------------ 1. the setting, in happy-dom */
let systemLight = false;
const listeners: (() => void)[] = [];
const win = new Window({ url: "https://joulz.uk/" });
const mq = (q: string) =>
  ({
    media: q,
    get matches() {
      return /prefers-color-scheme:\s*light/.test(q) ? systemLight : false;
    },
    addEventListener: (_: string, f: () => void) => listeners.push(f),
    removeEventListener: () => undefined,
  }) as unknown as MediaQueryList;
(win as unknown as { matchMedia: typeof mq }).matchMedia = mq;
for (const key of ["window", "document", "localStorage", "Event", "matchMedia"] as const) {
  const value = key === "matchMedia" ? mq : (win as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const doc = win.document as unknown as Document;
const meta = doc.createElement("meta");
meta.setAttribute("name", "theme-color");
meta.setAttribute("content", "#06080F");
doc.head.appendChild(meta);
const A = await import("../src/lib/appearance");
const html = doc.documentElement;
const theme = () => html.getAttribute("data-theme");
const bar = () => meta.getAttribute("content");

localStorage.clear();
check(A.readAppearance() === "dark", "no choice stored: dark");
A.applyAppearance();
check(theme() === null && bar() === A.STATUS_BAR.dark, `dark by default: no data-theme, a dark status bar (${theme()}, ${bar()})`);
A.setAppearance("light");
check(localStorage.getItem(A.APPEARANCE_KEY) === "light", "Light is kept on the device");
check(theme() === "light" && bar() === A.STATUS_BAR.light, `Light applied (${theme()}, ${bar()})`);
const release = A.holdDarkStatusBar();
check(bar() === A.STATUS_BAR.dark, "a game screen holds the status bar dark in light");
release();
check(bar() === A.STATUS_BAR.light, "the hold released: the light status bar again");
A.setAppearance("dark");
check(theme() === null && bar() === A.STATUS_BAR.dark, "back to Dark: no data-theme");
systemLight = true;
A.setAppearance("system");
check(theme() === "light", "Match my device on a light device: light");
A.installAppearance();
systemLight = false;
for (const f of listeners) f();
check(theme() === null, "Match my device follows the device turning dark, live");
systemLight = true;
for (const f of listeners) f();
check(theme() === "light", "and back to light");

// The boot script draws what applyAppearance draws, for every choice and device.
for (const stored of [null, "dark", "light", "system", "nonsense"] as const) {
  for (const light of [false, true]) {
    systemLight = light;
    if (stored === null) localStorage.removeItem(A.APPEARANCE_KEY);
    else localStorage.setItem(A.APPEARANCE_KEY, stored);
    html.removeAttribute("data-theme");
    new Function("localStorage", "document", "window", "matchMedia", A.APPEARANCE_BOOT)(localStorage, doc, globalThis, mq);
    const booted = [theme(), bar()].join();
    html.removeAttribute("data-theme");
    A.applyAppearance();
    check([theme(), bar()].join() === booted, `boot = apply for ${stored ?? "nothing stored"} on a ${light ? "light" : "dark"} device (${booted})`);
  }
}
const csp = readFileSync("src/lib/security/csp.ts", "utf8");
check(/INLINE_BOOT_SCRIPTS[^=]*=\s*\[[^\]]*APPEARANCE_BOOT/.test(csp), "the boot script is hashed in the content security policy");
check(/<script dangerouslySetInnerHTML=\{APPEARANCE_BOOT_HTML\} \/>/.test(readFileSync("src/routes/__root.tsx", "utf8")), "the root writes the boot script in <head>");
const sheet = readFileSync("src/components/app/SettingsSheet.tsx", "utf8");
check(/ap-group-title">Appearance</.test(sheet) && /APPEARANCE_OPTIONS/.test(sheet), "Settings draws Appearance");
check(A.APPEARANCE_OPTIONS.map((o) => o.label).join() === "Dark,Light,Match my device", "its three choices, Dark first");

/* ------------------------------------------------------------ 2. in Chromium */
const { CHROMIUM_PATHS, THEME_SCREENS, openThemeScreen } = await import("./theme-screens");
const { startSafeAreaServer } = await import("./safe-area-server");
const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium");
  process.exit(1);
}
const { chromium } = await import("playwright");
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-appearance-check", buildId: "appearance-check" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
const viewport = { name: "390x844", w: 390, h: 844 };
const named = (name: string) => THEME_SCREENS.find((s) => s.name === name)!;
const probe = (selector: string) => (sel: string) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    bg: cs.getPropertyValue("--jz-bg").trim().toUpperCase(),
    text: cs.getPropertyValue("--jz-text").trim().toUpperCase(),
    apText: (() => {
      const s = document.createElement("span");
      s.style.color = "var(--ap-text)";
      el.appendChild(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return c;
    })(),
    edge: getComputedStyle(document.documentElement).getPropertyValue("--screen-edge").trim().toUpperCase(),
    theme: document.documentElement.getAttribute("data-theme"),
  };
};
try {
  for (const [label, globals, want] of [
    ["profile, no choice", {}, { bg: "#06080F", text: "#EEF2FF", theme: null }],
    ["profile, light", { __harnessTheme: "light" }, { bg: "#F3F4F8", text: "#0B1020", theme: "light" }],
  ] as const) {
    const { context, page } = await openThemeScreen(browser, server.origin, { ...named("profile"), globals }, viewport);
    const got = await page.evaluate(probe("[data-skin]"), "[data-skin]");
    check(got?.bg === want.bg && got?.text === want.text && got?.theme === want.theme, `${label}: the page's tokens ${JSON.stringify(got)}`);
    // Match my device: the boot script under an emulated device.
    if (label === "profile, no choice")
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        const t = await page.evaluate(
          ([key, boot]) => {
            localStorage.setItem(key, "system");
            document.documentElement.removeAttribute("data-theme");
            new Function(boot)();
            return document.documentElement.getAttribute("data-theme");
          },
          [A.APPEARANCE_KEY, A.APPEARANCE_BOOT] as const,
        );
        check(t === (scheme === "light" ? "light" : null), `Match my device on a ${scheme} device draws ${scheme} (${t})`);
      }
    await context.close();
  }
  for (const name of ["answer reveal (puzzle)", "answer reveal (arcade)"]) {
    const { context, page } = await openThemeScreen(browser, server.origin, { ...named(name), globals: { __harnessTheme: "light" } }, viewport);
    const got = await page.evaluate(probe(".game-screen"), ".game-screen");
    check(
      got?.theme === "light" && got.bg === "#06080F" && got.text === "#EEF2FF" && got.apText === "rgb(238, 242, 255)" && got.edge === "#070709",
      `${name} in light: the game screen stays dark (${JSON.stringify(got)})`,
    );
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} appearance checks failed`);
  process.exit(1);
}
console.log(`PASS: appearance-check, ${passes} checks (dark by default; Light and Match my device applied before the first paint and live; the status bar follows; game screens dark in every theme)`);
