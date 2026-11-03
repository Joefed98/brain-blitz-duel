/**
 * Review screenshots for Apex racingRev 3 (3 Nov 2026; screenshots/apex-cornering-nov-2026/): the approach to the
 * example circuit's first lap-2 hairpin with its speed sign, the car mid-turn (angled, symmetrical), the car on the
 * gravel and the joystick drawn below the car, at 414×896, 375×667 and 1440×900. A design tool, not a check: it starts
 * its own dev server (port 5191), opens Apex in practice on the intro example and, before Ready, swaps racingRev 3's
 * step in the page's own module for one that holds a chosen state (display only, nothing is graded), then touches the
 * stick through CDP touch events.
 *
 *   bun scripts/shots/apex-cornering-shots.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";
const OUT = new URL("../../screenshots/apex-cornering-nov-2026", import.meta.url).pathname;
const PORT = 5191;
const origin = `http://127.0.0.1:${PORT}`;
const proc = spawn(
  "npx",
  ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"],
  { cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore", detached: true },
);
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(`${origin}/practice`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
type Scene = "approach" | "turn" | "gravel" | "stick";
async function shot(
  scene: Scene,
  w: number,
  h: number,
  touch: { x: number; y: number; dx: number; dy: number } | null,
  name: string,
) {
  const mobile = w < 700;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    hasTouch: mobile,
    isMobile: mobile,
  });
  await ctx.addInitScript(
    `try{localStorage.setItem("duelz-terms:v1", JSON.stringify({agreed:true,at:"2026-11-01"}))}catch(e){}`,
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData() ?? "";
    if (
      /practiceGenerate|cHJhY3RpY2VHZW5lcmF0Z/.test(route.request().url()) ||
      body.includes('"example"')
    ) {
      return route.continue({
        postData: body.replace(
          /("k":\["type","example"\],"v":\[\{"t":1,"s":"\w+"\},)\{"t":2,"s":3\}/,
          '$1{"t":2,"s":2}',
        ),
      });
    }
    return route.continue();
  });
  await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
  const side = page.locator(`[data-practice-side='arcade']`);
  await side.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await side.click();
  const button = page.getByRole("button", { name: "Apex", exact: true }).first();
  await button.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await button.click();
  await page
    .getByRole("button", { name: /^Ready/ })
    .first()
    .waitFor({ timeout: 90_000 });
  await page.evaluate(async (scene) => {
    const R = (await import(/* @vite-ignore */ "/src/lib/arcade/racing.ts")) as any;
    let n = 0;
    let S: any = null;
    const step = R.racingGameV3.step;
    R.racingGameV3.step = (prev: any, input: any) => {
      if (!S) {
        const t = R.racingTrack(prev.seed);
        const advice = R.racingCornerAdvice(t);
        const c = advice.find((a: any) => a.corner.kind === R.RACING_SEC_HAIRPIN) ?? advice[0];
        const corner = c.corner;
        const kmh = (k: number) => Math.round((k * R.RACING_VMAX) / 300);
        const base = {
          ...prev,
          tick: R.RACING_V2_GO + 3200,
          acted: 1,
          sector: 5,
          clean: 4,
          cleanMask: 0b10111,
          rec: 0,
          offFrom: 0,
        };
        const lap = R.RACING_LAP;
        const at = (k: number) => lap + (corner.start + k) * R.RACING_SEG;
        if (scene === "approach")
          S = { ...base, s: at(-50), v: kmh(238), x: 0, pedal: -100, steer: 0, wheel: 0 };
        if (scene === "turn")
          S = {
            ...base,
            s: at(10),
            v: kmh(c.kmh),
            x: corner.dir * 9000,
            pedal: 0,
            steer: 100 * corner.dir,
            wheel: 100 * corner.dir,
          };
        if (scene === "gravel")
          S = {
            ...base,
            s: at(corner.len - 6),
            v: kmh(150),
            x: -corner.dir * (R.RACING_CLEAN_X + 14000),
            off: 1,
            offFrom: kmh(230),
            dirty: 1,
            pedal: 100,
            steer: 30 * corner.dir,
            wheel: 30 * corner.dir,
          };
        if (scene === "stick")
          S = {
            ...base,
            s: lap + 40 * R.RACING_SEG,
            v: kmh(262),
            x: 0,
            pedal: 100,
            steer: 40,
            wheel: 40,
          };
      }
      n++;
      void step;
      return { ...S, tick: S.tick + n };
    };
  }, scene);
  await page
    .getByRole("button", { name: /^Ready/ })
    .first()
    .click();
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(4500);
  if (touch) {
    const box = await page.evaluate(() => {
      const cs = [...document.querySelectorAll("[data-game-stage] canvas")] as HTMLCanvasElement[];
      const c = cs
        .map((x) => ({ x, r: x.getBoundingClientRect() }))
        .filter((o) => Math.abs(o.r.width / o.r.height - 390 / 727) < 0.03)
        .sort((a, b) => b.r.width - a.r.width)[0];
      return c ? { x: c.r.x, y: c.r.y, w: c.r.width } : null;
    });
    if (box) {
      const k = box.w / 390;
      const cdp = await ctx.newCDPSession(page);
      const p0 = { x: box.x + touch.x * k, y: box.y + touch.y * k };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p0] });
      for (let i = 1; i <= 6; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: p0.x + (touch.dx * k * i) / 6, y: p0.y + (touch.dy * k * i) / 6 }],
        });
        await page.waitForTimeout(30);
      }
      await page.waitForTimeout(400);
    } else console.log("no canvas");
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("wrote", name);
  await ctx.close();
}
try {
  await shot("approach", 414, 896, null, "apex-414x896-approach-sign");
  await shot("turn", 414, 896, { x: 220, y: 660, dx: -64, dy: 0 }, "apex-414x896-mid-turn");
  await shot("gravel", 414, 896, null, "apex-414x896-gravel");
  await shot("stick", 414, 896, { x: 230, y: 540, dx: 25, dy: -40 }, "apex-414x896-joystick");
  await shot("approach", 375, 667, null, "apex-375x667-approach-sign");
  await shot("turn", 375, 667, { x: 220, y: 660, dx: -64, dy: 0 }, "apex-375x667-mid-turn");
  await shot("approach", 1440, 900, null, "apex-1440x900-approach-sign");
  await shot("turn", 1440, 900, null, "apex-1440x900-mid-turn");
} finally {
  await browser.close();
  try {
    process.kill(-proc.pid!);
  } catch {}
}
