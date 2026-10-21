/**
 * The round games' icons as pictures for the results card (resultCard.ts), drawn from the same
 * art GameIcon shows: arcade games by their renderer's painter on a canvas; puzzle games by
 * mounting their GameIcon off screen and turning each of its <svg>s into a picture (styles that
 * come from CSS — colours, currentColor, hidden text — are written onto the copy, and the
 * gradients it points at are copied in), so the card matches the app. Presentation only. Any icon
 * that can't be drawn is left out (the card shows its category tile with the app's bolt).
 */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { GameIcon } from "@/components/app/GameIcon";
import { ARCADE_ICON_PAINTERS } from "@/components/app/gameIcons/arcadeIcons.renderer";
import { PUZZLE_ICON_ART } from "@/components/app/gameIcons/puzzleIcons";
import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";
import type { PuzzleType } from "@/lib/duel/types";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Computed SVG styles written onto the copy (an <img> of an SVG sees no page CSS). */
const SVG_PROPS = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "stop-color",
  "stop-opacity",
  "color",
  "display",
  "visibility",
  "mix-blend-mode",
  "paint-order",
  "vector-effect",
] as const;

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function arcadeIcon(type: string, px: number): HTMLCanvasElement | null {
  const painter = ARCADE_ICON_PAINTERS[type];
  if (!painter) return null;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const c = canvas.getContext("2d");
  if (!c) return null;
  const k = px / 64;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.imageSmoothingEnabled = true;
  try {
    painter(c, k);
  } catch {
    return null;
  }
  return canvas;
}

/** A self-contained copy of one <svg>: computed styles inlined, the defs it points at included. */
function standaloneSvg(
  svg: SVGSVGElement,
  defs: Map<string, Element>,
  w: number,
  h: number,
): string | null {
  if (svg.querySelector("foreignObject")) return null;
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const to = [copy, ...Array.from(copy.querySelectorAll("*"))];
  from.forEach((el, i) => {
    const target = to[i];
    if (!target) return;
    const style = getComputedStyle(el);
    const inline: string[] = [];
    for (const prop of SVG_PROPS) {
      if (el === svg && (prop === "display" || prop === "opacity")) continue;
      const value = style.getPropertyValue(prop);
      if (value) inline.push(`${prop}:${value}`);
    }
    const filter = style.getPropertyValue("filter");
    if (el !== svg && filter && filter !== "none") inline.push(`filter:${filter}`);
    target.removeAttribute("class");
    target.setAttribute("style", inline.join(";"));
  });
  copy.setAttribute("xmlns", SVG_NS);
  copy.setAttribute("width", String(w));
  copy.setAttribute("height", String(h));
  // The gradients, patterns and clip paths it uses may live in another <svg> of the icon (or the page).
  const own = new Set(Array.from(copy.querySelectorAll("[id]")).map((el) => el.id));
  const extra = copy.ownerDocument.createElementNS(SVG_NS, "defs");
  const wanted = (text: string) =>
    Array.from(
      text.matchAll(/url\(\s*["']?#([^"')\s]+)["']?\s*\)|href="#([^"]+)"/g),
      (m) => m[1] ?? m[2],
    );
  const queue = wanted(new XMLSerializer().serializeToString(copy));
  while (queue.length) {
    const id = queue.shift();
    if (!id || own.has(id)) continue;
    const source = defs.get(id) ?? document.getElementById(id);
    if (!source) continue;
    own.add(id);
    const clone = source.cloneNode(true) as Element;
    extra.appendChild(clone);
    queue.push(...wanted(new XMLSerializer().serializeToString(clone)));
  }
  if (extra.childNodes.length) copy.insertBefore(extra, copy.firstChild);
  return new XMLSerializer().serializeToString(copy);
}

/** The rotation (radians) an element's CSS transform applies, 0 for none. */
function rotationOf(el: Element): number {
  const t = getComputedStyle(el).transform;
  const m = /^matrix\(([^,]+),\s*([^,]+)/.exec(t);
  return m ? Math.atan2(Number(m[2]), Number(m[1])) : 0;
}

async function puzzleIcon(
  type: PuzzleType,
  px: number,
  host: HTMLElement,
): Promise<HTMLCanvasElement | null> {
  const mount = document.createElement("div");
  host.appendChild(mount);
  const root = createRoot(mount);
  try {
    flushSync(() => root.render(<GameIcon type={type} size={px} />));
    await frame();
    const tile = mount.querySelector<HTMLElement>(".game-icon");
    if (!tile) return null;
    const box = tile.getBoundingClientRect();
    const svgs = Array.from(tile.querySelectorAll("svg")).filter(
      (s) => !s.parentElement?.closest("svg"),
    ) as SVGSVGElement[];
    const defs = new Map<string, Element>();
    for (const s of svgs)
      for (const el of Array.from(s.querySelectorAll("[id]"))) defs.set(el.id, el);
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const c = canvas.getContext("2d");
    if (!c) return null;
    let drew = false;
    for (const svg of svgs) {
      const holder = (svg.closest(".game-icon-box") as HTMLElement | null) ?? null;
      const turn = holder ? rotationOf(holder) : 0;
      // A rotated box: draw at its unrotated size round its centre.
      const r = svg.getBoundingClientRect();
      const w = turn && holder ? holder.offsetWidth : r.width;
      const h = turn && holder ? holder.offsetHeight : r.height;
      if (w < 1 || h < 1) continue;
      const xml = standaloneSvg(svg, defs, w, h);
      if (!xml) continue;
      const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
      if (!img) continue;
      const filters = [];
      for (let el: Element | null = svg; el && el !== tile; el = el.parentElement) {
        const f = getComputedStyle(el).filter;
        if (f && f !== "none") filters.push(f);
      }
      c.save();
      if (filters.length && "filter" in c) c.filter = filters.join(" ");
      if (turn) {
        const cx = r.left - box.left + r.width / 2;
        const cy = r.top - box.top + r.height / 2;
        c.translate(cx, cy);
        c.rotate(turn);
        c.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        c.drawImage(img, r.left - box.left, r.top - box.top, w, h);
      }
      c.restore();
      drew = true;
    }
    return drew ? canvas : null;
  } catch {
    return null;
  } finally {
    root.unmount();
    mount.remove();
  }
}

/** Each game's icon as a canvas at `px` square (null where it can't be drawn). */
export async function gameIconImages(
  types: readonly string[],
  px = 232,
): Promise<Map<string, HTMLCanvasElement | null>> {
  const out = new Map<string, HTMLCanvasElement | null>();
  if (typeof document === "undefined") return out;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("data-share-icon-host", "");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(host);
  try {
    for (const type of new Set(types)) {
      if (type in ARCADE_ICON_PAINTERS) {
        await preloadGameArt(type).catch(() => undefined);
        out.set(type, arcadeIcon(type, px));
      } else if (type in PUZZLE_ICON_ART) {
        out.set(type, await puzzleIcon(type as PuzzleType, px, host));
      } else {
        out.set(type, null);
      }
    }
  } finally {
    host.remove();
  }
  return out;
}
