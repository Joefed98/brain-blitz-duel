/**
 * The effects pass's gallery clips (15 Nov 2026, `docs/design/effects-pass/README.md`): each moment recorded as a short
 * MP4 (screenshots on the page's own clock, joined by ffmpeg) through the screens harness (fixed clock, stubbed server).
 * A design tool, not a check.
 *
 *   bun scripts/shots/effects-pass-shots.ts [--out=docs/design/pages-review/effects] [names…]
 *
 * Needs ffmpeg. Clips are 390 px wide at 15 fps (CRF 32), so the whole gallery stays well under 6 MB.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allThemeScreens } from "../area-screens";
import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, openThemeScreen, room, type ThemeScreen } from "../theme-screens";
import { INTRO_COUNTDOWN_MS, INTRO_MS } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/design/pages-review/effects";
const only = args.filter((a) => !a.startsWith("--"));

interface Clip {
  name: string;
  screen: ThemeScreen;
  ms: number;
  /** Extra wait after the harness's own (the moment starts when the screen is drawn unless set). */
  skipMs?: number;
}

/**
 * A room whose phase starts LEAD_MS after the screen is asked for (the page takes a few seconds to load; the harness's
 * own rooms start at once, so a short moment is over before the first frame). Optionally on an earlier round, and with
 * every player ready (the countdown).
 */
const LEAD_MS = 1_800;
let phaseAt = 0;
const live = (make: NonNullable<ThemeScreen["room"]>, opts: { round?: number; ready?: boolean; countdown?: boolean } = {}): NonNullable<ThemeScreen["room"]> => () => {
  const r = make();
  phaseAt = Date.now() + LEAD_MS;
  // The countdown: the intro's phase started so its 3-2-1 begins 1 s into the clip.
  const at = new Date(opts.countdown ? phaseAt - (INTRO_MS - INTRO_COUNTDOWN_MS) + 1_000 : phaseAt).toISOString();
  const round = opts.round ?? r.duel.current_round;
  return {
    ...r,
    duel: { ...r.duel, current_round: round, phase_started_at: at, round_started_at: at },
    // Everyone seen just now (a one-on-one room's lone rival otherwise reads as away and the room carries on without them).
    players: r.players.map((p) => ({ ...p, last_seen_at: new Date(phaseAt + 600_000).toISOString(), ...(opts.ready ? { intro_ready_round: round } : {}) })),
  };
};
const atRound = (make: NonNullable<ThemeScreen["room"]>, round: number) => live(make, { round });

const byName = async (name: string) => {
  const found = (await allThemeScreens()).find((s) => s.name === name);
  if (!found) throw new Error(`no screen "${name}"`);
  return found;
};

const CLIPS: Clip[] = [
  { name: "prepare-2", screen: { name: "prepare 2", mode: "room", room: live(room("in_progress", "starting", { players: 2 })) }, ms: 6_200 },
  { name: "prepare-6", screen: { name: "prepare 6", mode: "room", room: live(room("in_progress", "starting", { players: 6 })) }, ms: 6_200 },
  { name: "prepare-16", screen: { name: "prepare 16", mode: "room", room: live(room("in_progress", "starting", { players: 16 })) }, ms: 6_200 },
  // The harness's room is on its last round; a round title before it is the same room on an earlier round.
  ...[2, 3, 4, 5, 6].map((r) => ({
    name: `round-${r}`,
    screen: { name: `round ${r}`, mode: "room" as const, room: atRound(room("in_progress", "round_title", { players: 4, rounds: 7 }), r) },
    ms: 2_800,
  })),
  { name: "final-round", screen: { name: "final", mode: "room", room: live(room("in_progress", "round_title", { players: 4, rounds: 7 })) }, ms: 2_800 },
  { name: "countdown", screen: { name: "intro", mode: "room", room: live(room("in_progress", "intro", { players: 4, rounds: 2 }), { countdown: true }) }, ms: 6_000 },
  { name: "round-result", screen: { name: "result", mode: "room", room: live(room("in_progress", "result", { players: 6, rounds: 2 })) }, ms: 2_000 },
  { name: "standings", screen: { name: "standings", mode: "room", room: live(room("in_progress", "standings", { players: 10, rounds: 3 })) }, ms: 3_200 },
  { name: "podium", screen: { name: "podium", mode: "room", room: live(room("finished", "winner_reveal", { players: 10, rounds: 6 })) }, ms: 4_000 },
  { name: "answer-reveal", screen: { name: "reveal", mode: "room", room: live(room("in_progress", "reveal", { players: 4, rounds: 2 })) }, ms: 2_200 },
];
const NAMED: [string, string, number][] = [
  ["rated-result", "rated, result won", 3_000],
  ["score-attack-result", "tournaments pages: score attack, entered and finished", 2_600],
  ["daily-results", "daily results", 2_600],
];

const CHROMIUM = CHROMIUM_PATHS.find((p): p is string => Boolean(p && existsSync(p)))!;
mkdirSync(out, { recursive: true });
for (const [name, screen, ms] of NAMED) CLIPS.push({ name, screen: await byName(screen), ms });

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-effects-shots", buildId: "effects-shots" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
let total = 0;
try {
  // Warm the cold dev server once, unrecorded (the first load compiles the app and takes far longer than a moment).
  const warm = await openThemeScreen(browser, server.origin, { name: "warm", mode: "room", room: room("in_progress", "standings", { players: 2 }) }, { name: "phone", w: 390, h: 844, scale: 1 });
  await warm.context.close();
  for (const clip of CLIPS) {
    if (only.length && !only.includes(clip.name)) continue;
    const raw = join("/tmp", `effects-shots-${clip.name}`);
    rmSync(raw, { recursive: true, force: true });
    mkdirSync(raw, { recursive: true });
    phaseAt = 0;
    // Frames from the page's first paint (a CDP screencast started as the page opens), so a moment that begins while the
    // page is still loading is caught from its start; trimmed afterwards to the moment.
    const frames: { file: string; at: number }[] = [];
    const { context, page } = await openThemeScreen(
      browser,
      server.origin,
      { ...clip.screen, waitMs: 0 },
      { name: "phone", w: 390, h: 844, scale: 1 },
      async (ctx) => {
        ctx.on("page", (p) => {
          void (async () => {
            const cdp = await ctx.newCDPSession(p);
            cdp.on("Page.screencastFrame", (e: { data: string; sessionId: number }) => {
              const file = join(raw, `${String(frames.length).padStart(5, "0")}.jpg`);
              writeFileSync(file, Buffer.from(e.data, "base64"));
              frames.push({ file, at: Date.now() });
              void cdp.send("Page.screencastFrameAck", { sessionId: e.sessionId }).catch(() => {});
            });
            // The new page may not be attached for a moment: try again until it is.
            for (let tries = 0; tries < 50; tries++) {
              try {
                await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 });
                break;
              } catch {
                await new Promise((r) => setTimeout(r, 20));
              }
            }
          })();
        });
      },
    );
    // A room moment from just before its phase; any other screen from its first painted frame (its entrance).
    const from = phaseAt ? phaseAt - 150 : (frames[0]?.at ?? Date.now());
    if (clip.skipMs) await page.waitForTimeout(clip.skipMs);
    await page.waitForTimeout(Math.max(0, from + clip.ms - Date.now()));
    await context.close();
    // The frame on screen at the clip's start, then every frame in the clip (a screencast sends only changes).
    const firstIn = frames.findIndex((f) => f.at >= from);
    const kept = frames.slice(Math.max(0, (firstIn === -1 ? frames.length : firstIn) - 1)).filter((f) => f.at < from + clip.ms);
    const shown = kept.map((f, i) => ({ file: f.file, at: Math.max(0, f.at - from), next: i + 1 < kept.length ? kept[i + 1]!.at - from : clip.ms }));
    const list = shown.map((f) => `file '${f.file}'\nduration ${(Math.max(1, f.next - f.at) / 1000).toFixed(3)}`).join("\n");
    writeFileSync(join(raw, "list.txt"), `${list}\nfile '${shown.at(-1)!.file}'\n`);
    const mp4 = join(out, `${clip.name}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(raw, "list.txt"), "-vf", "fps=15,scale=390:-2,format=yuv420p", "-c:v", "libx264", "-crf", "32", "-preset", "slow", "-an", mp4]);
    const size = statSync(mp4).size;
    total += size;
    console.log(`${mp4} (${shown.length} frames, ${(size / 1024).toFixed(0)} KB)`);
    rmSync(raw, { recursive: true, force: true });
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
process.exit(0);
