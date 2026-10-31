/**
 * In-page and CDP probes for battery-check (31 Oct 2026; a tool, not a check on its own):
 *
 *  - PROBE_INIT (a page init script) counts the frames in which any requestAnimationFrame callback
 *    ran (one per distinct frame timestamp), DOM mutation batches, and keeps the real
 *    requestAnimationFrame untouched otherwise;
 *  - measureIdle(page, ms) samples those counters, the running Web Animations / CSS animations and
 *    transitions, Chromium's own drawn frames (CDP tracing: the compositor's DrawFrame events for the
 *    page's renderer) and the main thread's task time (CDP Performance.getMetrics TaskDuration) over
 *    `ms`, and returns per-second figures.
 */
import type { CDPSession, Page } from "playwright";

export const PROBE_INIT = `(() => {
  const real = window.requestAnimationFrame.bind(window);
  const probe = (window.__battery = { rafFrames: 0, lastT: -1, mutations: 0 });
  window.requestAnimationFrame = (cb) =>
    real((t) => {
      if (t !== probe.lastT) {
        probe.lastT = t;
        probe.rafFrames++;
      }
      cb(t);
    });
  const watch = () => {
    new MutationObserver(() => {
      probe.mutations++;
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  if (document.documentElement) watch();
  else document.addEventListener("DOMContentLoaded", watch);
})();`;

export interface IdleFigures {
  /** Frames a second in which a requestAnimationFrame callback ran. */
  rafFps: number;
  /** Frames a second the compositor drew for the page (DrawFrame trace events). */
  drawnFps: number;
  /** DOM mutation batches a second. */
  mutationsPerS: number;
  /** Main-thread task time, ms a second. */
  taskMsPerS: number;
  /** Running animations at the end of the window (infinite or still going): what each one is. */
  running: string[];
}

async function taskMs(cdp: CDPSession): Promise<number> {
  const { metrics } = (await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
  return (metrics.find((m) => m.name === "TaskDuration")?.value ?? 0) * 1000;
}

/** Collects trace events between start and stop. */
async function traced<T>(cdp: CDPSession, run: () => Promise<T>): Promise<{ result: T; events: { name: string; pid: number; tid: number; args?: Record<string, unknown> }[] }> {
  const events: { name: string; pid: number; tid: number }[] = [];
  const onData = (e: { value: { name: string; pid: number; tid: number }[] }) => events.push(...e.value);
  cdp.on("Tracing.dataCollected", onData);
  await cdp.send("Tracing.start", {
    categories: "disabled-by-default-devtools.timeline.frame,devtools.timeline",
    transferMode: "ReportEvents",
  } as never);
  const result = await run();
  const done = new Promise<void>((resolve) => cdp.once("Tracing.tracingComplete", () => resolve()));
  await cdp.send("Tracing.end");
  await done;
  cdp.off("Tracing.dataCollected", onData);
  return { result, events };
}

/** Samples the page for `ms` (it must be loaded with PROBE_INIT). */
export async function measureIdle(page: Page, ms = 5000): Promise<IdleFigures> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const read = () =>
    page.evaluate(() => {
      const p = (window as unknown as { __battery: { rafFrames: number; mutations: number } }).__battery;
      return { raf: p.rafFrames, mut: p.mutations };
    });
  const { result, events } = await traced(cdp, async () => {
    const a = await read();
    const t0 = await taskMs(cdp);
    await page.waitForTimeout(ms);
    const b = await read();
    const t1 = await taskMs(cdp);
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((an) => an.playState === "running")
        .map((an) => {
          const target = (an.effect as KeyframeEffect | null)?.target as Element | null;
          const name = (an as CSSAnimation).animationName ?? (an as CSSTransition).transitionProperty ?? an.id ?? "animation";
          const where = target ? `${target.tagName.toLowerCase()}${target.className && typeof target.className === "string" ? "." + target.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}` : "?";
          return `${name} on ${where}`;
        }),
    );
    return { raf: b.raf - a.raf, mut: b.mut - a.mut, task: t1 - t0, running };
  });
  await cdp.detach();
  // The page's renderer: the process whose main thread ran the page's frames (most DrawFrame events
  // come from its compositor). Headless Chromium draws one DrawFrame per frame it produced.
  const draws = events.filter((e) => e.name === "DrawFrame");
  const byPid = new Map<number, number>();
  for (const e of draws) byPid.set(e.pid, (byPid.get(e.pid) ?? 0) + 1);
  const drawn = Math.max(0, ...byPid.values());
  const s = ms / 1000;
  return {
    rafFps: result.raf / s,
    drawnFps: drawn / s,
    mutationsPerS: result.mut / s,
    taskMsPerS: result.task / s,
    running: result.running,
  };
}
