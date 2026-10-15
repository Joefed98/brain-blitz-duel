/**
 * Cold-start helpers for the browser checks that load a page from a dev server first
 * (arcade-play, bottom-clearance, replay-play, beat-hold-browser; safe-area-screens-check
 * has its own copy, where #64 introduced them).
 *
 * A cold `vite dev` compiles the app's module graph on the first browser request: about
 * 30 s on a 2-core GitHub runner, Playwright's default goto timeout. So:
 *  - warmUp loads one page, unmeasured, before anything is judged, waiting up to 3 min
 *    for it to render. Nothing is checked during it; a failure here is only logged, and
 *    the first real load then fails (or passes) on its own terms.
 *  - gotoRetried retries a goto once if the load itself timed out. Any other error, and a
 *    second timeout, stand. Every wait after the load keeps its own timeout.
 * Neither changes what a check measures or how it judges it.
 */
import type { Browser, Page } from "playwright";

const TIMED_OUT = /Timeout \d+ms exceeded/;

export async function warmUp(
  browser: Browser,
  url: string,
  rendered: (page: Page) => Promise<unknown>,
  opts: { init?: () => void; verbose?: boolean } = {},
): Promise<void> {
  const started = Date.now();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    if (opts.init) await page.addInitScript(opts.init);
    await page.goto(url, { timeout: 180_000 });
    await rendered(page);
    if (opts.verbose) console.log(`  warm-up: ${url} rendered in ${Date.now() - started} ms`);
  } catch (error) {
    console.log(`  warm-up: ${url} did not render (${String((error as Error).message).split("\n")[0]}); carrying on`);
  } finally {
    await context.close();
  }
}

/** page.goto, retried once if the load itself times out (a slow first compile); any other error stands. */
export async function gotoRetried(
  page: Page,
  url: string,
  where: string,
  options: { waitUntil?: "load" | "domcontentloaded" } = {},
): Promise<void> {
  try {
    await page.goto(url, options);
  } catch (error) {
    if (!TIMED_OUT.test(String((error as Error).message))) throw error;
    console.log(`  ${where}: first load timed out; retrying once`);
    await page.goto(url, { ...options, timeout: 90_000 });
  }
}
