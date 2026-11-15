// Quick low-resolution contact sheet of jobs (tuning aid): bun preview.ts <name,...> → scratch dir
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { JOBS } from "./scenes";
const only = (process.argv[2] ?? "").split(",").filter(Boolean);
const out = process.argv[3] ?? "/tmp";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("pageerror", e.message));
p.on("console", (m) => console.log(m.text()));
await p.goto("file://" + import.meta.dir + "/render.html");
await p.waitForFunction(() => (window as any).ready, null, { timeout: 60000 });
for (const [name, j] of Object.entries(JOBS)) {
  if (only.length && !only.includes(name)) continue;
  const sc = Number(process.env.SCALE ?? 0.5);
  const cols = [...Array(8)].map((_, i) => j.cols[i] || "#808080");
  const url: string = await p.evaluate((o) => (window as any).renderArt(o), { ...j, cols, style: 1, w: Math.round(j.w * sc), h: Math.round(j.h * sc) });
  writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(",")[1]!, "base64"));
  console.log(name);
}
await b.close();
