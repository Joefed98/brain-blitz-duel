/**
 * Design audit: one labelled contact sheet per area (at most 12 screens a sheet; an area with more gets
 * numbered parts), phone shots only, plus a "desktop" set for the 1440×900 shots. Reads
 * docs/design-audit/screenshots/index.json; writes docs/design-audit/contact-sheets/<area>[-n].png.
 * Scrolled-to-end frames are left off the sheets (they are in the screenshot folders).
 *
 *   bun docs/design-audit/tools/contact-sheets.ts
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SHOTS = "docs/design-audit/screenshots";
const OUT = "docs/design-audit/contact-sheets";
mkdirSync(OUT, { recursive: true });
const index: { file: string; area: string; label: string; size: string }[] = JSON.parse(readFileSync(join(SHOTS, "index.json"), "utf8"));
const TITLES: Record<string, string> = {
  play: "Play tab",
  practice: "Practice",
  tournaments: "Tournaments",
  profile: "Profile and settings",
  room: "Room",
  daily: "Daily Puzzle and Daily Arcade",
  challenge: "Friend challenge",
  share: "Share",
  celebrations: "Celebrations and the Joulz Hero",
  states: "Empty, error, offline and update states",
  assets: "Assets: app icons, in-game logo, link preview",
  desktop: "Desktop 1440×900",
};
const groups = new Map<string, typeof index>();
for (const f of index) {
  if (f.file.includes("-scrolled")) continue;
  const key = f.size === "1440x900" ? "desktop" : f.area === "typography" ? null : f.area;
  if (!key) continue;
  groups.set(key, [...(groups.get(key) ?? []), f]);
}
const PER = 12;
for (const [area, all] of groups) {
  const parts = Math.ceil(all.length / PER);
  for (let p = 0; p < parts; p++) {
    const mine = all.slice(p * PER, p * PER + PER);
    const desktop = area === "desktop";
    const w = desktop ? 480 : 260;
    const h = desktop ? 300 : Math.round((260 * 844) / 390);
    const cols = desktop ? Math.min(3, mine.length) : Math.min(6, mine.length);
    const rows = Math.ceil(mine.length / cols);
    const pad = 20;
    const label = 44;
    const head = 64;
    const canvas = createCanvas(pad + cols * (w + pad), head + rows * (label + h + pad));
    const c = canvas.getContext("2d");
    c.fillStyle = "#1d1d22";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "#f4f4f6";
    c.font = "bold 26px sans-serif";
    c.fillText(`${TITLES[area] ?? area}${parts > 1 ? ` (${p + 1} of ${parts})` : ""}${desktop ? "" : " · 390×844"}`, pad, 40);
    for (const [i, f] of mine.entries()) {
      const x0 = pad + (i % cols) * (w + pad);
      const y0 = head + Math.floor(i / cols) * (label + h + pad);
      c.fillStyle = "#d8d8df";
      c.font = "bold 14px sans-serif";
      const words = f.label.split(" ");
      let line = "";
      let ly = y0 + 15;
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (c.measureText(next).width > w && line) {
          c.fillText(line, x0, ly);
          line = word;
          ly += 17;
        } else line = next;
      }
      c.fillText(line, x0, ly);
      const img = await loadImage(readFileSync(join(SHOTS, f.file)));
      // Keep the aspect (the share card is 1080×1350).
      const s = Math.min(w / img.width, h / img.height);
      c.drawImage(img, x0, y0 + label, img.width * s, img.height * s);
      c.strokeStyle = "#3a3a44";
      c.strokeRect(x0 - 0.5, y0 + label - 0.5, img.width * s + 1, img.height * s + 1);
    }
    const name = `${area}${parts > 1 ? `-${p + 1}` : ""}.png`;
    writeFileSync(join(OUT, name), await canvas.encode("png"));
    console.log(name, mine.length);
  }
}
