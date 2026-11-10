/**
 * first-impressions-check (wave 1, first impressions, 10 Nov 2026; happy-dom, ~2 s): the onboarding's rules,
 * the error boundary and the art the empty and error screens draw.
 *
 *  1. Captain Joulz's pictures (public/art/) are the approved art (docs/art/svg/) byte for byte.
 *  2. The first-open onboarding is off by default (FIRST_OPEN_ONBOARDING false): a brand-new phone's first open
 *     shows nothing and nothing is written to the phone.
 *  3. Switched on (a check's own page, window.__DUELZ_FIRST_OPEN__): a brand-new phone's first open on a tab
 *     page shows it; a first open through a room, challenge or daily link, or a shared link, doesn't and never
 *     will; a phone that opened the app before (the first-time intro's flag) never sees it.
 *  4. The screens (src/components/app/FirstOpen.tsx): three, Skip on every one, Next and a swipe step through,
 *     the last has Play my first match and Play with friends instead; no field asks for anything; Skip on
 *     any screen, or finishing either way, remembers it, and it never shows again.
 *  5. The error boundary: a route that throws, under a root whose errorComponent draws RouteErrorScreen (as
 *     src/routes/__root.tsx's does), shows "That one’s on us" with Refresh and Back home, and records one
 *     error_shown with the short code page_error (chunk_load for a missing build file), never the error's text.
 *
 *   bun scripts/first-impressions-check.tsx
 */
import { readFileSync } from "node:fs";

const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

/* ------------------------------------------------------------------ 1. the art */
for (const pose of ["ready", "win"] as const) {
  const approved = readFileSync(`docs/art/svg/captain-joulz-${pose}.svg`);
  const served = readFileSync(`public/art/captain-joulz-${pose}.svg`);
  check(approved.equals(served), `public/art/captain-joulz-${pose}.svg is the approved art byte for byte`);
}
const { CAPTAIN_ART } = await import("../src/design/art/Captain");
check(
  Object.entries(CAPTAIN_ART).every(([pose, url]) => url === `/art/captain-joulz-${pose}.svg`),
  "Captain draws only the approved files",
);

/* ------------------------------------------------------------------ the page */
const { Window } = await import("happy-dom");
const win = new Window({ url: "https://joulz.uk/" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "PointerEvent", "MouseEvent", "HTMLButtonElement", "HTMLAnchorElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history", "scrollTo"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !/^[A-Z]/.test(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
// Analytics never sends from an automated browser (lib/analytics/clientEvents.ts): the queue is what we read.
Object.defineProperty(win.navigator, "webdriver", { configurable: true, value: true });
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
(win as unknown as { ResizeObserver: unknown }).ResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const firstOpen = await import("../src/lib/firstOpen");
const { FIRST_OPEN_ONBOARDING } = await import("../src/config/betaConfig");
const { ONBOARDING_KEY } = await import("../src/lib/onboarding");

const fresh = () => {
  localStorage.clear();
  sessionStorage.clear();
};
const setOn = (on: boolean | undefined) => {
  (window as unknown as { __DUELZ_FIRST_OPEN__?: boolean }).__DUELZ_FIRST_OPEN__ = on;
};
const at = (path: string) => {
  const [pathname, search = ""] = path.split("?");
  return { pathname: pathname!, search: search ? `?${search}` : "" };
};

/* ------------------------------------------------------------------ 2. off by default */
check(FIRST_OPEN_ONBOARDING === false, "the onboarding's switch is off (FIRST_OPEN_ONBOARDING false until wave 3)");
fresh();
setOn(undefined);
check(firstOpen.firstOpenOn() === false, "off: firstOpenOn() is false without a check's override");
for (const path of ["/", "/practice", "/profile", "/duel/ABCD"]) {
  check(firstOpen.decideFirstOpen(at(path)) === false, `off: a brand-new phone's first open on ${path} shows nothing`);
}
check(localStorage.length === 0 && sessionStorage.length === 0, "off: nothing is written to the phone");
const rootSource = readFileSync("src/routes/__root.tsx", "utf8");
check(
  /lazy\(\(\) => import\("\.\.\/components\/app\/FirstOpen"\)\)/.test(rootSource) && !/^import .*components\/app\/FirstOpen/m.test(rootSource),
  "the screens are loaded only on the open that shows them (a lazy import in the root)",
);

/* ------------------------------------------------------------------ 3. the rules, switched on */
// The module keeps a memory copy once marked (storage-blocked phones), so each case runs in a fresh import.
let fresher = 0;
const decideFresh = async (path: string, before?: () => void) => {
  fresh();
  before?.();
  const mod = (await import(`../src/lib/firstOpen.ts?case=${++fresher}`)) as typeof firstOpen;
  return { shows: mod.decideFirstOpen(at(path)), mod };
};
setOn(true);
for (const path of ["/", "/practice", "/tournaments", "/profile"]) {
  const { shows } = await decideFresh(path);
  check(shows, `on: a brand-new phone's first open on ${path} shows it`);
}
for (const path of ["/duel/ABCD", "/challenge?code=K7QM2X", "/daily?kind=puzzle", "/?ref=share&room=ABCD", "/terms"]) {
  const { shows, mod } = await decideFresh(path);
  check(!shows, `on: a first open through ${path} doesn't show it`);
  check(mod.firstOpenSeen() && mod.decideFirstOpen(at("/")) === false, `on: after a first open through ${path}, Play never shows it`);
}
{
  const { shows, mod } = await decideFresh("/", () => localStorage.setItem(ONBOARDING_KEY, "1"));
  check(!shows && mod.decideFirstOpen(at("/")) === false, "on: a phone that opened the app before the switch never sees it");
}

/* ------------------------------------------------------------------ 4. the screens */
const { FirstOpen } = await import("../src/components/app/FirstOpen");
const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
const click = async (el: HTMLElement | null) => act(async () => void el?.click());
const current = () => Number($("[data-first-open-screen]:not([aria-hidden='true'])")?.getAttribute("data-first-open-screen") ?? 0);

async function mount(): Promise<{ calls: string[]; unmount: () => Promise<void> }> {
  const calls: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root.render(
      React.createElement(FirstOpen, {
        onDone: () => calls.push("done"),
        onPlay: () => calls.push("play"),
        onFriends: () => calls.push("friends"),
      }),
    );
  });
  return {
    calls,
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

// Stepping through: Skip on every screen, Next on the first two, the two ways to play on the last.
{
  const { mod } = await decideFresh("/");
  void mod;
  const m = await mount();
  check($$("[data-first-open-screen]").length === 3, "three screens");
  check($$("[data-first-open] input, [data-first-open] textarea, [data-first-open] select").length === 0, "no field asks for an account or anything personal");
  check(/Live puzzles and games against real people/.test($("[data-first-open-screen='1']")?.textContent ?? ""), "screen 1 is O1's hello");
  check(/How it works/.test($("[data-first-open-screen='2']")?.textContent ?? ""), "screen 2 is O2's how it works");
  check(/Ready for your first match\?/.test($("[data-first-open-screen='3']")?.textContent ?? ""), "screen 3 is O3's first match");
  for (let i = 1; i <= 3; i++) {
    check(current() === i, `screen ${i} is the one shown`);
    check(!!$("[data-first-open-skip]") && /Skip/.test($("[data-first-open-skip]")!.textContent ?? ""), `Skip on screen ${i}`);
    if (i < 3) {
      check(!!$("[data-first-open-next]") && !$("[data-first-open-play]"), `Next on screen ${i}`);
      await click($("[data-first-open-next]"));
    }
  }
  check(!!$("[data-first-open-play]") && /Play my first match/.test($("[data-first-open-play]")!.textContent ?? ""), "the last screen's gold button: Play my first match");
  check(/Play with friends instead/.test($("[data-first-open-friends]")?.textContent ?? ""), "the last screen's quiet way: Play with friends instead");
  check(localStorage.getItem(firstOpen.FIRST_OPEN_KEY) === null, "not remembered until Skip or finishing");
  await click($("[data-first-open-play]"));
  check(m.calls.join() === "done,play", "Play my first match closes it and starts playing");
  check(localStorage.getItem(firstOpen.FIRST_OPEN_KEY) === "1", "finishing is remembered on the phone");
  check(firstOpen.decideFirstOpen(at("/")) === false, "after finishing, it never shows again");
  await m.unmount();
}
// A swipe, either way.
{
  fresh();
  const m = await mount();
  const track = $("[data-first-open-track]")!;
  const swipe = async (from: number, to: number) =>
    act(async () => {
      track.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: from, clientY: 300, pointerId: 1, pointerType: "touch" }) as never);
      track.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: (from + to) / 2, clientY: 302, pointerId: 1, pointerType: "touch" }) as never);
      track.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: to, clientY: 304, pointerId: 1, pointerType: "touch" }) as never);
    });
  await swipe(300, 120);
  check(current() === 2, "a swipe left turns to the next screen");
  await swipe(300, 120);
  check(current() === 3, "a second swipe reaches the last screen");
  await swipe(120, 300);
  check(current() === 2, "a swipe right goes back");
  await click($("[data-first-open-friends]"));
  check(m.calls.length === 0, "the friends button isn't on screen 2");
  await m.unmount();
}
// Skip on each screen remembers it.
for (let skipOn = 1; skipOn <= 3; skipOn++) {
  fresh();
  const mod = (await import(`../src/lib/firstOpen.ts?skip=${skipOn}`)) as typeof firstOpen;
  check(mod.decideFirstOpen(at("/")) === true, `skip on ${skipOn}: a brand-new phone would see it`);
  const m = await mount();
  for (let i = 1; i < skipOn; i++) await click($("[data-first-open-next]"));
  check(current() === skipOn, `skip on ${skipOn}: on screen ${skipOn}`);
  await click($("[data-first-open-skip]"));
  check(m.calls.join() === "done", `Skip on screen ${skipOn} closes it`);
  check(localStorage.getItem(mod.FIRST_OPEN_KEY) === "1", `Skip on screen ${skipOn} is remembered on the phone`);
  const later = (await import(`../src/lib/firstOpen.ts?later=${skipOn}`)) as typeof firstOpen;
  check(later.decideFirstOpen(at("/")) === false, `after Skip on screen ${skipOn}, the next open doesn't show it`);
  await m.unmount();
}
setOn(undefined);

/* ------------------------------------------------------------------ 5. the error boundary */
const { errorCodeFor, RouteErrorScreen } = await import("../src/components/app/AppErrorScreen");
check(errorCodeFor(new Error("x is not a function")) === "page_error", "a page error's code is page_error");
check(errorCodeFor(new TypeError("Failed to fetch dynamically imported module: https://joulz.uk/assets/a.js")) === "chunk_load", "a missing build file's code is chunk_load");
check(errorCodeFor("a string") === "page_error", "anything else thrown is page_error");
check(
  /errorComponent: ErrorComponent/.test(rootSource) && /<RouteErrorScreen/.test(rootSource) && /notFoundComponent: NotFoundComponent/.test(rootSource) && /<NotFoundPage \/>/.test(rootSource),
  "the root route's error boundary and 404 draw these screens",
);
{
  fresh();
  // TanStack's CatchBoundary: the boundary the router wraps every route in with its errorComponent (Match.js),
  // here with the root's own screen.
  const { CatchBoundary } = await import("@tanstack/react-router");
  const SECRET = "boom secret-player-name stack-marker";
  const Thrower = (): never => {
    throw new Error(SECRET);
  };
  const quietError = console.error;
  const quietWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  let refreshed = 0;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  try {
    await act(async () => {
      root.render(
        React.createElement(
          CatchBoundary,
          {
            getResetKey: () => 0,
            errorComponent: ({ error }: { error: Error }) =>
              React.createElement(RouteErrorScreen, { error, onRefresh: () => void refreshed++ }),
          } as never,
          React.createElement(Thrower),
        ),
      );
    });
    // The analytics module is imported in an effect: give it a moment.
    for (let i = 0; i < 80 && !localStorage.getItem("duelz-analytics-queue:v1"); i++) await act(async () => new Promise((r) => setTimeout(r, 25)));
  } finally {
    console.error = quietError;
    console.warn = quietWarn;
  }
  const screen = $("[data-error-boundary]");
  check(!!screen, "the error boundary catches a thrown error and shows its screen");
  check(/That one’s on us/.test(screen?.textContent ?? ""), "its title: That one’s on us");
  check(/Something broke on our side\. Refresh, or head back home\./.test(screen?.textContent ?? ""), "its line: Something broke on our side. Refresh, or head back home.");
  check(!!$("[data-error-boundary] [data-error-refresh]"), "Refresh");
  check($("[data-error-boundary] [data-error-home]")?.getAttribute("href") === "/", "Back home leads to Play");
  check(!(screen?.textContent ?? "").includes("secret-player-name"), "the screen never shows the error's text");
  await click($("[data-error-refresh]"));
  check(refreshed === 1, "Refresh retries the route");
  const queue = JSON.parse(localStorage.getItem("duelz-analytics-queue:v1") ?? "[]") as { event: string; props?: Record<string, unknown> }[];
  const shown = queue.filter((e) => e.event === "error_shown");
  check(shown.length === 1, `one error_shown recorded (${shown.length})`);
  check(JSON.stringify(shown[0]?.props) === JSON.stringify({ code: "page_error" }), `error_shown carries the short code page_error only (${JSON.stringify(shown[0]?.props)})`);
  check(!JSON.stringify(queue).includes("secret") && !JSON.stringify(queue).includes("stack"), "no error text or stack is recorded");
  await act(async () => root.unmount());
  host.remove();
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${checks} first-impressions check(s)`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} checks: Captain Joulz's pictures are the approved art; the first-open onboarding is off by default and writes nothing; switched on it shows once on a brand-new phone's first open on a tab page (never through a link or on a phone that opened the app before), three screens with Skip on each, Next and swipes, Play my first match and Play with friends instead, no personal fields, remembered after Skip or finishing; the error boundary shows "That one’s on us" with Refresh and Back home and records error_shown with a short code, never the error's text`,
);
process.exit(0);
