/**
 * iPhone geometry for the browser checks (15 Oct 2026, display only).
 *
 * An iOS home-screen app with viewport-fit=cover and a black-translucent status bar is laid
 * out in a viewport short by the top inset (WebKit bug 254868) while the window is the whole
 * screen: on an iPhone 11 (414 × 896, 48 px notch, 34 px home bar) 100dvh is 848 px. The app
 * keys on navigator.standalone (PhoneShell's useStandaloneShortfall: the screen's height less
 * 100dvh, at most the top inset, into --standalone-short) and never on the display-mode media
 * feature. Headless Chromium reproduces the geometry: the page is laid out in the short
 * viewport, the screen reports its full size, the insets are emulated (CDP
 * Emulation.setSafeAreaInsetsOverride) and navigator.standalone is true. The physical bottom is
 * then below the layout viewport, where layout boxes are still measured. display-mode:
 * standalone is sent as well (Emulation.setEmulatedMedia, which Chromium ignores for that
 * feature) and window.matchMedia answers it in-page, so code keyed on it would see it too.
 *
 * DEVICE_INIT also defines window.__clipBottom(el): the lowest point an element can be drawn
 * to, from every ancestor that clips (overflow other than visible, html and body included:
 * html's overflow propagates to the viewport, but its box is where the page's size shows),
 * and which ancestor sets it. A control or world whose bottom lies under it is cut off.
 */
import type { Page } from "playwright";

export interface DeviceConfig {
  key: string;
  label: string;
  /** The layout viewport (what the page is laid out in). */
  w: number;
  h: number;
  /** The physical screen: its bottom is where the 16 px is measured from. */
  screenH: number;
  top: number;
  bottom: number;
  standalone: boolean;
}

/** An iPhone 11 home-screen app: 414 × 896 with 48 / 34 px insets, laid out 414 × 848. */
export const IPHONE11_APP: DeviceConfig = {
  key: "iphone11-app",
  label: "iPhone 11 home-screen app (414x896, 48/34 px insets, laid out 414x848)",
  w: 414,
  h: 848,
  screenH: 896,
  top: 48,
  bottom: 34,
  standalone: true,
};

/** The plain browser: no insets, the screen the viewport, navigator.standalone unset. */
export const BROWSER: DeviceConfig = { key: "browser", label: "browser", w: 0, h: 0, screenH: 0, top: 0, bottom: 0, standalone: false };

/**
 * Page init script: iOS's navigator.standalone, the screen size and display-mode, switchable
 * per page through window.__device (off until emulateDevice sets it), plus __clipBottom.
 */
export const DEVICE_INIT = `(() => {
  // Geometry and pixel proofs run at full effects: the low-end governor (src/lib/fx/lowEnd.ts) must not
  // resize a canvas mid-proof on a slow runner. arcade-lowend-check leaves it free to adapt.
  window.__duelzEffects = "full";
  window.__device = { standalone: false, w: 0, h: 0 };
  Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => window.__device.standalone });
  Object.defineProperty(Screen.prototype, "width", { configurable: true, get: () => window.__device.w || window.innerWidth });
  Object.defineProperty(Screen.prototype, "height", { configurable: true, get: () => window.__device.h || window.innerHeight });
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) => {
    const mode = /\\(\\s*display-mode\\s*:\\s*(\\w+)\\s*\\)/.exec(query);
    if (!mode) return matchMedia(query);
    const matches = mode[1] === (window.__device.standalone ? "standalone" : "browser");
    return { media: query, matches, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false };
  };
  window.__clipBottom = (el) => {
    let bottom = Infinity, by = "";
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowY === "visible") continue;
      const b = n.getBoundingClientRect().bottom - (parseFloat(cs.borderBottomWidth) || 0);
      if (b >= bottom) continue;
      bottom = b;
      by = n === document.documentElement ? "html" : n === document.body ? "body"
        : n.tagName.toLowerCase() + [...n.attributes].filter((a) => a.name.startsWith("data-") && a.name !== "data-tsd-source").map((a) => "[" + a.name + (a.value && a.value.length < 24 ? "=" + a.value : "") + "]").join("");
    }
    return { bottom, by };
  };
})();`;

/** What __clipBottom returns. */
export interface Clip { bottom: number; by: string }

/**
 * Put the page in a device's geometry: insets, screen size, navigator.standalone and
 * display-mode, then the layout viewport (BROWSER restores the plain browser and leaves the
 * viewport alone). The app reads the device on resize, so one is dispatched either way.
 */
export async function emulateDevice(page: Page, config: DeviceConfig): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: config.top, bottom: config.bottom, left: 0, right: 0 } } as never);
    await cdp.send("Emulation.setEmulatedMedia" as never, { features: [{ name: "display-mode", value: config.standalone ? "standalone" : "" }] } as never).catch(() => {});
  } finally {
    await cdp.detach().catch(() => {});
  }
  await page.evaluate(({ standalone, w, h }) => {
    (window as unknown as { __device: { standalone: boolean; w: number; h: number } }).__device = { standalone, w, h };
  }, { standalone: config.standalone, w: config.w, h: config.screenH });
  if (config.w && config.h) await page.setViewportSize({ width: config.w, height: config.h });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(400);
}
