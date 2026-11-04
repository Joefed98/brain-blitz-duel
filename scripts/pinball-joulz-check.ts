/**
 * pinball-joulz-check (1 Nov 2026, Joe: completing J-O-U-L-Z is a big moment; display and sound only, no stamp):
 * on pinRev 4–6 the shared layer's "J-O-U-L-Z!" banner shows as before (same text, place and style) but in gold, and
 * the world's border flashes gold three times (0.15 s on, 0.15 s off); `pinball.joulz` plays a sting from the existing library in place of the bank sound.
 *
 * Drawn with the real renderer on @napi-rs/canvas on a hand-driven presentation clock:
 *  1. the border timing: on 0–150, off 150–300, on 300–450, off, on 600–750, then off for good;
 *  2. a frame after the lane set rises shows gold (#FFD84A) on the border and in the banner at its old place, the
 *     frame before it neither; 200 ms in the border is dark again; past the third flash it stays dark; no centred badge;
 *  3. the banner event keeps its text, place and kind, gold, with no neon border of its own;
 *  4. reduced motion: no flashing (one steady border) and the word still shows;
 *  5. a rewind (a new run) never fires it;
 *  6. sound: the manifest slot points at an existing recording, gameSounds plays it on pinRev 4+ in place of
 *     pinball.bankComplete, and the cue is documented in docs/sound-cues/arcade-effects.md;
 *  7. the sim is untouched (the renderer only reads laneSets).
 *
 * Evidence on failure (3 Nov 2026): the frame checks passed 40 of 40 times locally but failed now and then on CI
 * (#243, #252, #254). When any check fails, every frame judged in section 2 is saved as a PNG beside a JSON record
 * (the clock, what performance.now() returned, the sampled border pixels, the gold pixels' bounding box near the
 * banner's place, the pops on screen, and the fonts: whether the Retro face is registered, the families napi-rs
 * found and the measured width of the banner's text) in ci-results/pinball-joulz/, which CI uploads as an artifact.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clock = 10_000;
let reduced = false;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ get matches() { return reduced; }, addEventListener() {}, removeEventListener() {} }),
    devicePixelRatio: 1,
  },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
// The banner's face, the same on every machine (3 Nov 2026). The Retro stack is 'Press Start 2P', ui-monospace,
// monospace, and the app ships no Press Start 2P, so @napi-rs/canvas fell back to whatever monospace face the
// machine had: on some CI runners (9 font families) "J-O-U-L-Z!" measured 273.9 px at 22 px against 108.7 px here
// (27 families), and the banner left no gold at its place (evidence from #254's failing run). The app's own shipped
// JetBrains Mono stands in under the stack's first name, so the frames no longer depend on the runner's fonts.
const RETRO_STAND_IN = "public/fonts/jetbrains-mono-600-700-latin.woff2";
if (!GlobalFonts.registerFromPath(RETRO_STAND_IN, "Press Start 2P")) {
  console.log(`FAIL pinball-joulz-check: could not register ${RETRO_STAND_IN} as the Retro face`);
  process.exit(1);
}

const { pinball6Game, P4_WORLD_W, P4_WORLD_H } = await import("../src/lib/arcade/pinball4");
const art = await import("../src/lib/arcade/pinball4.renderer");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");

let failures = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) {
    failures++;
    console.log(`FAIL ${what}`);
  }
};

// 1. Timing.
const on = [0, 149, 300, 449, 600, 749].every((t) => art.pinJoulzBorderOn(t));
const off = [150, 299, 450, 599, 750, 900, 1400].every((t) => !art.pinJoulzBorderOn(t));
check(on && off && art.PIN_JOULZ_FLASH_MS === 150 && art.PIN_JOULZ_FLASHES === 3, "the border is on 0.15 s, off 0.15 s, three times");
check(art.PIN_JOULZ_GOLD === "#FFD84A", "the moment is gold");

// 2. Frames.
const W = P4_WORLD_W;
const H = P4_WORLD_H;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const isGold = (x: number, y: number, r = 3) => {
  const d = (canvas.getContext("2d") as unknown as CanvasRenderingContext2D).getImageData(x - r, y - r, r * 2 + 1, r * 2 + 1).data;
  for (let i = 0; i < d.length; i += 4) if (d[i]! > 200 && d[i + 1]! > 170 && d[i + 1]! < 235 && d[i + 2]! < 140) return true;
  return false;
};
// The banner's place (PINBALL4_FX: x 186, the lane sensor + 70) and the table's centre, where no badge may be.
const { P4_LANE_SENSOR_Y } = await import("../src/lib/arcade/pinball4");
const goldNear = (cx: number, cy: number) => {
  for (let x = cx - 90; x <= cx + 90; x += 4) for (let y = cy - 20; y <= cy + 20; y += 4) if (isGold(x, y, 2)) return true;
  return false;
};
const bannerGold = () => goldNear(186, P4_LANE_SENSOR_Y + 70);
const badgeGold = () => goldNear(W / 2, H / 2);
const borderGold = () => isGold(3, H / 4, 1) && isGold(W - 4, H / 3, 1);
// Evidence: each judged frame of section 2, kept in memory and written out only if a check fails.
const { arcadeFxPopTexts, ARCADE_WORLD_THEMES } = await import("../src/lib/arcade/arcadeFx.renderer");
interface Frame {
  label: string;
  clock: number;
  perfNow: number;
  tick: number;
  png: Buffer;
  border: { left: number[]; right: number[] };
  bannerGoldBox: { x0: number; y0: number; x1: number; y1: number; count: number } | null;
  pops: string[];
}
const frames: Frame[] = [];
const pixel = (x: number, y: number) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
const goldBox = (cx: number, cy: number) => {
  const x0 = Math.max(0, cx - 120);
  const y0 = Math.max(0, cy - 40);
  const w = Math.min(W - x0, 240);
  const h = Math.min(H - y0, 80);
  const d = ctx.getImageData(x0, y0, w, h).data;
  let box: Frame["bannerGoldBox"] = null;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i]! > 200 && d[i + 1]! > 170 && d[i + 1]! < 235 && d[i + 2]! < 140) {
        if (!box) box = { x0: x0 + x, y0: y0 + y, x1: x0 + x, y1: y0 + y, count: 0 };
        box.x0 = Math.min(box.x0, x0 + x);
        box.x1 = Math.max(box.x1, x0 + x);
        box.y0 = Math.min(box.y0, y0 + y);
        box.y1 = Math.max(box.y1, y0 + y);
        box.count++;
      }
    }
  return box;
};
const draw = (state: unknown, label?: string) => {
  ctx.clearRect(0, 0, W, H);
  art.pinball4ArtGame.draw(ctx, state as never, { width: W, height: H });
  if (label)
    frames.push({
      label,
      clock,
      perfNow: performance.now(),
      tick: (state as { tick: number }).tick,
      png: canvas.toBuffer("image/png"),
      border: { left: pixel(3, H / 4), right: pixel(W - 4, H / 3) },
      bannerGoldBox: goldBox(186, P4_LANE_SENSOR_Y + 70),
      pops: arcadeFxPopTexts(ctx, "pinball"),
    });
};
const base = pinball6Game.init(7);
const s0 = { ...base, tick: 600 };
const s1 = { ...base, tick: 601, laneSets: (base.laneSets ?? 0) + 1 };
clock = 10_000;
draw(s0, "before the lane set (tick 600)");
check(!bannerGold() && !borderGold(), "no gold banner or border before the lane set");
clock = 10_010;
draw(s1, "the lane set's first frame (tick 601)");
check(borderGold(), "the border lit gold on the moment's first frame");
clock = 10_100;
draw({ ...s1, tick: 606 }, "100 ms in (tick 606)");
check(bannerGold(), "the J-O-U-L-Z! banner in gold at its old place");
check(!badgeGold(), "no centred badge");
check(borderGold(), "the border still lit 100 ms in");
clock = 10_210;
draw({ ...s1, tick: 612 }, "200 ms in (tick 612)");
check(!borderGold(), "200 ms in: the border dark between flashes");
clock = 10_330;
draw({ ...s1, tick: 620 }, "the second flash (tick 620)");
check(borderGold(), "the second flash");
clock = 11_600;
draw({ ...s1, tick: 700 }, "after the third flash (tick 700)");
check(!borderGold() && !badgeGold(), "after the third flash the border stays dark");

// 3. The banner event: its old text, place and kind, now gold, with no neon border of its own.
const ev = art.PINBALL4_FX.events.find((e) => e.kind === "streak" && e.count({ ...base, laneSets: 3 } as never) === 3);
check(!!ev && ev.label?.({ ...s1, rev6: 1 } as never, 1, 1) === "J-O-U-L-Z!" && ev.label?.({ ...s1, rev6: undefined, mult: 3 } as never, 1, 1) === "J-O-U-L-Z! x3", "the banner keeps its text (J-O-U-L-Z!, with the multiplier before pinRev 6)");
check(!!ev && JSON.stringify(ev.at?.(base as never)) === JSON.stringify({ x: 186, y: P4_LANE_SENSOR_Y + 70 }) && ev.textOnly === true, "the banner keeps its place and style");
check(ev?.colour?.(base as never) === art.PIN_JOULZ_GOLD, "the banner is gold");
check(!ev?.neon, "no neon border of its own (the border flashes gold instead)");

// 4. Reduced motion.
reduced = true;
const fresh = createCanvas(W, H);
const rctx = fresh.getContext("2d") as unknown as CanvasRenderingContext2D;
clock = 20_000;
art.pinball4ArtGame.draw(rctx, { ...base, tick: 900 } as never, { width: W, height: H });
clock = 20_010;
art.pinball4ArtGame.draw(rctx, { ...base, tick: 901, laneSets: (base.laneSets ?? 0) + 1 } as never, { width: W, height: H });
const gold = (x: number, y: number) => { const d = rctx.getImageData(x, y, 1, 1).data; return d[0]! > 200 && d[1]! > 170 && d[1]! < 235 && d[2]! < 140; };
check(gold(3, H / 4), "reduced motion: the border lit");
clock = 20_210;
art.pinball4ArtGame.draw(rctx, { ...base, tick: 912, laneSets: (base.laneSets ?? 0) + 1 } as never, { width: W, height: H });
check(gold(3, H / 4), "reduced motion: one steady border, no blink at 200 ms");
clock = 20_500;
art.pinball4ArtGame.draw(rctx, { ...base, tick: 930, laneSets: (base.laneSets ?? 0) + 1 } as never, { width: W, height: H });
check(!gold(3, H / 4), "reduced motion: the border off after 450 ms");
reduced = false;

// 5. A rewind never fires it.
const rew = createCanvas(W, H);
const wctx = rew.getContext("2d") as unknown as CanvasRenderingContext2D;
clock = 30_000;
art.pinball4ArtGame.draw(wctx, { ...base, tick: 900, laneSets: 2 } as never, { width: W, height: H });
clock = 30_010;
art.pinball4ArtGame.draw(wctx, { ...base, tick: 0, laneSets: 0 } as never, { width: W, height: H });
const g2 = wctx.getImageData(3, H / 4, 1, 1).data;
check(!(g2[0]! > 200 && g2[1]! > 170 && g2[1]! < 235 && g2[2]! < 140), "a rewind does not fire the moment");

// 6. Sound.
const slot = SOUND_MANIFEST["pinball.joulz" as keyof typeof SOUND_MANIFEST] as { url: string | null } | undefined;
check(!!slot?.url && existsSync(`public${slot.url}`), `pinball.joulz plays an existing recording (${slot?.url})`);
const sounds = readFileSync("src/lib/fx/gameSounds.ts", "utf8");
check(/const joulz = !!p4\.rev4 && state\.laneSets > prev\.laneSets && cueHasFile\("pinball\.joulz"\);\s*if \(joulz\) effectCue\("pinball\.joulz"\);/.test(sounds), "gameSounds plays pinball.joulz on pinRev 4+");
check(/!joulz\)\) sfx\("pinball\.bankComplete"/.test(sounds), "in place of pinball.bankComplete on that frame");
check(/\| `pinball\.joulz` \|/.test(readFileSync("docs/sound-cues/arcade-effects.md", "utf8")), "documented in docs/sound-cues/arcade-effects.md");

// 7. The sim never reads the renderer.
check(!/renderer/.test(readFileSync("src/lib/arcade/pinball4.ts", "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "").split("\n").filter((l) => l.startsWith("import")).join("\n")), "the sim imports no renderer");

if (failures) {
  // Evidence for a failure seen only on CI: the frames, pixels and fonts (see the header).
  const dir = "ci-results/pinball-joulz";
  try {
    mkdirSync(dir, { recursive: true });
    const font = ARCADE_WORLD_THEMES.retro.font;
    const probe = createCanvas(10, 10).getContext("2d");
    probe.font = `700 22px ${font}`;
    const record = {
      bun: process.versions.bun,
      platform: `${process.platform} ${process.arch}`,
      performanceStubbed: performance.now() === clock,
      fonts: {
        retroFont: font,
        pressStart2PRegistered: GlobalFonts.has("Press Start 2P"),
        families: GlobalFonts.families.map((f) => f.family),
        bannerTextWidth22px: probe.measureText("J-O-U-L-Z!").width,
        resolvedFont: probe.font,
      },
      bannerPlace: { x: 186, y: P4_LANE_SENSOR_Y + 70 },
      frames: frames.map(({ png, ...f }, i) => {
        writeFileSync(`${dir}/frame-${i}.png`, png);
        return { file: `frame-${i}.png`, ...f };
      }),
    };
    writeFileSync(`${dir}/evidence.json`, JSON.stringify(record, null, 2));
    console.log(`evidence: ${dir}/evidence.json and ${frames.length} frames (fonts: Press Start 2P registered ${record.fonts.pressStart2PRegistered}, ${record.fonts.families.length} families; banner text ${record.fonts.bannerTextWidth22px.toFixed(1)} px at 22 px; performance stubbed ${record.performanceStubbed})`);
    for (const f of record.frames) console.log(`  ${f.label}: clock ${f.clock}, performance.now ${f.perfNow}, banner gold ${f.bannerGoldBox ? JSON.stringify(f.bannerGoldBox) : "none"}, pops ${JSON.stringify(f.pops)}`);
  } catch (e) {
    console.log(`evidence: could not be saved (${String(e)})`);
  }
  console.log(`FAIL pinball-joulz-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("PASS pinball-joulz-check: the J-O-U-L-Z! banner as before, in gold; the border flashes gold three times (0.15 s on/off); steady under reduced motion; never on a rewind; its sting from the library in place of the bank sound");
