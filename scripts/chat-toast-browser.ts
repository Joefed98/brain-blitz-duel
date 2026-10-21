/**
 * The browser half of chat-notice-check (22 Oct 2026): the room's chat toast on the real between-round
 * screens (scripts/safe-area-harness.tsx, network stubbed; a message from Sam arrives live through
 * H.chat) at 414x896 as an iPhone 11 home-screen app (48/34 px insets), 375x667 and desktop 1440x900.
 * Fails unless the toast slides up (chat-toast-up), sits in the lower half, ends at least 8 px above
 * the home bar, and overlaps no control that is visible and pinned to the screen (fixed or sticky:
 * the chat bar, Play again, Share, Leave, Continue, Start) or ends within the bottom 120 px (Ready);
 * other controls it covers (rows of a scrolling list) are printed as NOTE lines. Run by
 * chat-notice-check; `--shots=<dir>` saves each 414x896 draw.
 *
 *   bun scripts/chat-toast-browser.ts [--shots=<dir>]
 */
import { existsSync, mkdirSync } from "node:fs";

import { chromium } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, openThemeScreen, room, type ThemeScreen } from "./theme-screens";

const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));

const named = (name: string) => THEME_SCREENS.find((s) => s.name === name)!;
const SCREENS: ThemeScreen[] = [
  named("lobby, 10 players"),
  { name: "round intro (Ready)", mode: "room", room: room("in_progress", "intro", { players: 4, rounds: 2 }), plain: true },
  named("round leaderboard, 10 players"),
  named("standings, 10 players"),
  named("final results, 2 players"),
  named("podium, 10 players"),
];

const failures: string[] = [];
let passes = 0;
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-chat-toast", buildId: "chat-toast" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const viewport of VIEWPORTS)
    for (const screen of SCREENS) {
      const where = `${screen.name} (${viewport.name})`;
      const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
      try {
        await page.evaluate(() => {
          const h = (window as unknown as { __harness: { chat: (m: unknown) => void } }).__harness;
          h.chat({ id: "toast-1", duel_id: "duel-theme", sender_user_id: "u3", sender_name: "Sam", text: "nice one that was a really close finish there mate", created_at: new Date().toISOString() });
        });
        const toast = page.locator("[data-chat-toast]");
        await toast.waitFor({ timeout: 10_000 });
        await page.waitForTimeout(450);
        const m = await page.evaluate(() => {
          const el = document.querySelector("[data-chat-toast]") as HTMLElement;
          const t = el.getBoundingClientRect();
          const probe = document.createElement("div");
          probe.style.cssText = "position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);width:0;visibility:hidden";
          document.body.appendChild(probe);
          const inset = probe.getBoundingClientRect().height;
          probe.remove();
          const vh = window.innerHeight;
          const style = getComputedStyle(el);
          // Which controls are visible with the toast out of the way.
          el.style.visibility = "hidden";
          const pinned = (node: Element | null): boolean => {
            for (; node && node !== document.body; node = node.parentElement) {
              const p = getComputedStyle(node).position;
              if (p === "fixed" || p === "sticky") return true;
            }
            return false;
          };
          const hits: { label: string; pinned: boolean; zone: boolean }[] = [];
          for (const c of document.querySelectorAll('button, a[href], input, textarea, select, [role="button"]')) {
            if (el.contains(c)) continue;
            const r = c.getBoundingClientRect();
            if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= vh) continue;
            const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
            const y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
            const hit = document.elementFromPoint(x, y);
            if (!hit || !(hit === c || c.contains(hit) || hit.contains(c))) continue;
            const overlaps = r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top;
            if (!overlaps) continue;
            const label = (c.getAttribute("aria-label") || c.textContent || c.tagName).trim().slice(0, 40);
            hits.push({ label, pinned: pinned(c), zone: r.bottom >= vh - 120 });
          }
          el.style.visibility = "";
          return { top: t.top, bottom: t.bottom, vh, inset, animation: style.animationName, hits };
        });
        const problems: string[] = [];
        if (m.animation !== "chat-toast-up") problems.push(`animation ${m.animation}, not chat-toast-up`);
        if (m.bottom > m.vh - m.inset - 8 + 0.5) problems.push(`ends ${(m.vh - m.inset - m.bottom).toFixed(1)} px above the home bar (needs 8)`);
        if (m.top < m.vh / 2) problems.push(`top at ${m.top.toFixed(0)} px, above the screen's lower half`);
        for (const hit of m.hits.filter((h) => h.pinned || h.zone)) problems.push(`covers "${hit.label}"`);
        for (const hit of m.hits.filter((h) => !h.pinned && !h.zone)) console.log(`NOTE ${where}: passes over the scrolling "${hit.label}"`);
        if (SHOTS && viewport.app) await page.screenshot({ path: `${SHOTS}/chat-toast-${screen.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`, type: "jpeg", quality: 85 });
        if (problems.length) failures.push(`${where}: ${problems.join("; ")}`);
        else passes++;
        console.log(`${problems.length ? "FAIL" : "PASS"} ${where}: ${problems.length ? problems.join("; ") : `bottom ${(m.vh - m.bottom).toFixed(0)} px up (home bar ${m.inset} px), clear of every pinned control`}`);
      } catch (err) {
        failures.push(`${where}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
        console.log(`FAIL ${where}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
      } finally {
        await context.close();
      }
    }
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} toast draws`);
  process.exit(1);
}
console.log(`PASS: ${passes} toast draws at the bottom, above the home bar, clear of every pinned control`);
process.exit(0);
