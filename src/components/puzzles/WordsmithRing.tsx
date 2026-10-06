import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { WORDSMITH_CENTRE_INDEX } from "@/lib/duel/types";

type Point = { x: number; y: number };
const inset = (1 - Math.tan(Math.PI / 8)) * 50;
const vertices: Point[] = [
  { x: inset, y: 0 }, { x: 100 - inset, y: 0 },
  { x: 100, y: inset }, { x: 100, y: 100 - inset },
  { x: 100 - inset, y: 100 }, { x: inset, y: 100 },
  { x: 0, y: 100 - inset }, { x: 0, y: inset },
];
const inner = vertices.map(({ x, y }) => ({ x: 50 + (x - 50) * .34, y: 50 + (y - 50) * .34 }));
const points = (polygon: Point[]) => polygon.map(({ x, y }) => `${x},${y}`).join(" ");
const clip = (polygon: Point[]) => `polygon(${polygon.map(({ x, y }) => `${x}% ${y}%`).join(",")})`;
function centroid(polygon: Point[]): Point {
  let area = 0, x = 0, y = 0;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    if (!b) return;
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  });
  return { x: x / (3 * area), y: y / (3 * area) };
}
type GlyphBox = { x: number; y: number; width: number; height: number };
/** Maximum upright glyph scale inside every polygon edge, with a 1% board margin. */
export function wordsmithGlyphScale(polygon: Point[], label: Point, box: GlyphBox): number {
  let scale = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const distance = dx * (label.y - a.y) - dy * (label.x - a.x) - Math.hypot(dx, dy);
    const extent = Math.abs(dy) * box.width / 2 + Math.abs(dx) * box.height / 2;
    if (extent > 0) scale = Math.min(scale, Math.max(0, distance / extent));
  }
  return scale;
}

/** One shared octagon geometry for live, fixed example and reveal. */
export function WordsmithRing({ letters, selected = [], disabled = true, onTap }: {
  letters: readonly string[];
  selected?: readonly number[];
  disabled?: boolean;
  onTap?: (index: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const probes = useRef<(SVGTextElement | null)[]>([]);
  const [metrics, setMetrics] = useState<{ boxes: GlyphBox[]; size: number }>({ boxes: [], size: 25 });
  const outer = letters.map((_, index) => index).filter(index => index !== WORDSMITH_CENTRE_INDEX);
  const segments = letters.map((_, index) => {
    if (index === WORDSMITH_CENTRE_INDEX) return { polygon: inner, label: { x: 50, y: 50 } };
    const segment = outer.indexOf(index), next = (segment + 1) % vertices.length;
    const a = vertices[segment], b = vertices[next], c = inner[next], d = inner[segment];
    const polygon = a && b && c && d ? [a, b, c, d] : [];
    return { polygon, label: centroid(polygon) };
  });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const width = element.getBoundingClientRect().width;
      if (!width) return;
      const boxes = probes.current.map(probe => {
        const box = probe?.getBBox();
        return box && box.width > 0 ? { x: box.x, y: box.y, width: box.width, height: box.height } : { x: 0, y: -75, width: 75, height: 75 };
      });
      let scale = (element.closest('.wordsmith-ring-example') ? 192 : 312) / width;
      segments.forEach(({ polygon, label }, i) => {
        const box = boxes[i];
        if (box) scale = Math.min(scale, wordsmithGlyphScale(polygon, label, box));
      });
      setMetrics({ boxes, size: scale * 100 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void document.fonts.ready.then(measure);
    return () => { active = false; observer.disconnect(); };
  }, [letters.join("")]);
  return <div ref={host} className="wordsmith-ring relative aspect-square w-full select-none" aria-label="Wordsmith letter ring">
    {letters.map((letter, index) => {
      const centre = index === WORDSMITH_CENTRE_INDEX;
      const segment = outer.indexOf(index);
      const next = (segment + 1) % vertices.length;
      const a = vertices[segment], b = vertices[next], c = inner[next], d = inner[segment];
      const polygon = centre ? inner : a && b && c && d ? [a, b, c, d] : [];
      if (!polygon.length) return null;
      const label = centre ? { x: 50, y: 50 } : centroid(polygon);
      const used = selected.includes(index);
      return <Button key={index} type="button" variant="ghost" disabled={disabled}
        data-wordsmith-tile={index} aria-pressed={used}
        aria-label={centre ? `Centre letter ${letter}` : `Letter ${letter}, tile ${index + 1}`}
        onClick={() => onTap?.(index)}
        className={`wordsmith-ring-tile ${centre ? "wordsmith-ring-centre" : "wordsmith-ring-outer"} ${used ? "wordsmith-ring-used" : ""}`}
        style={{ clipPath: clip(polygon) }}>
      </Button>;
    })}
    <svg className="wordsmith-ring-labels" viewBox="0 0 100 100" aria-hidden="true">
      <g visibility="hidden">{letters.map((letter, index) => <text key={index} ref={node => { probes.current[index] = node; }} x="0" y="0" fontSize="100">{letter}</text>)}</g>
      {letters.map((letter, index) => {
        const segment = segments[index];
        if (!segment) return null;
        const box = metrics.boxes[index] ?? { x: 0, y: -75, width: 75, height: 75 };
        const scale = metrics.size / 100;
        const used = index !== WORDSMITH_CENTRE_INDEX && selected.includes(index);
        return <text key={index} className={`wordsmith-ring-label ${used ? "wordsmith-ring-label-used" : ""}`}
          fontSize={metrics.size} x={segment.label.x - (box.x + box.width / 2) * scale}
          y={segment.label.y - (box.y + box.height / 2) * scale}>{letter}</text>;
      })}
    </svg>
    <svg className="wordsmith-ring-lines" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={points(vertices)} />
      <polygon points={points(inner)} />
      {vertices.map((point, i) => <line key={i} x1={point.x} y1={point.y} x2={inner[i]?.x} y2={inner[i]?.y} />)}
    </svg>
  </div>;
}