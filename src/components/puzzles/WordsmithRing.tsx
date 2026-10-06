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
/** Equal angular wedges clipped to the unchanged outer and centre octagons. */
export function wordsmithRingSegments(count: number) {
  const angleAt = (point: Point) => {
    const angle = Math.atan2(point.y - 50, point.x - 50) * 180 / Math.PI;
    return angle < -112.5 - 1e-8 ? angle + 360 : angle;
  };
  const boundary = (angle: number): Point => {
    const dx = Math.cos(angle * Math.PI / 180), dy = Math.sin(angle * Math.PI / 180);
    let radius = Infinity;
    vertices.forEach((a, i) => {
      const b = vertices[(i + 1) % vertices.length];
      if (!b) return;
      const ex = b.x - a.x, ey = b.y - a.y;
      const denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) < 1e-9) return;
      const t = ((a.x - 50) * ey - (a.y - 50) * ex) / denominator;
      const u = ((a.x - 50) * dy - (a.y - 50) * dx) / denominator;
      if (t >= 0 && u >= -1e-8 && u <= 1 + 1e-8) radius = Math.min(radius, t);
    });
    return { x: 50 + dx * radius, y: 50 + dy * radius };
  };
  return Array.from({ length: count }, (_, i) => {
    const start = -112.5 + i * 360 / count, end = start + 360 / count;
    const edge = [boundary(start), ...vertices.filter(point => angleAt(point) > start + 1e-8 && angleAt(point) < end - 1e-8), boundary(end)];
    const polygon = [...edge, ...edge.slice().reverse().map(({ x, y }) => ({ x: 50 + (x - 50) * .34, y: 50 + (y - 50) * .34 }))];
    return { polygon, label: centroid(polygon), boundary: edge[0] };
  });
}
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
export const WORDSMITH_GLYPH_REDUCTION = .7;
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
  const lightProbes = useRef<(SVGTextElement | null)[]>([]);
  const [metrics, setMetrics] = useState<{ boxes: GlyphBox[]; size: number }>({ boxes: [], size: 25 * WORDSMITH_GLYPH_REDUCTION });
  const outer = letters.map((_, index) => index).filter(index => index !== WORDSMITH_CENTRE_INDEX);
  const wedges = wordsmithRingSegments(outer.length);
  const segments = letters.map((_, index) => {
    if (index === WORDSMITH_CENTRE_INDEX) return { polygon: inner, label: { x: 50, y: 50 } };
    return wedges[outer.indexOf(index)] ?? { polygon: [], label: { x: 50, y: 50 } };
  });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const width = element.getBoundingClientRect().width;
      if (!width) return;
      const readBox = (probe: SVGTextElement | null) => {
        const box = probe?.getBBox();
        return box && box.width > 0 ? { x: box.x, y: box.y, width: box.width, height: box.height } : { x: 0, y: -75, width: 75, height: 75 };
      };
      const boxes = probes.current.map(readBox);
      let scale = (element.closest('.wordsmith-ring-example') ? 192 : 312) / width;
      segments.forEach(({ polygon, label }, i) => {
        const box = boxes[i];
        if (box) scale = Math.min(scale, wordsmithGlyphScale(polygon, label, box));
      });
      // Keep the previous bold fit as the reference, then shrink the lettering only.
      setMetrics({ boxes: lightProbes.current.map(readBox), size: scale * 100 * WORDSMITH_GLYPH_REDUCTION });
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
      const polygon = segments[index]?.polygon ?? [];
      if (!polygon.length) return null;
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
      <g visibility="hidden" className="wordsmith-ring-glyph-weight">{letters.map((letter, index) => <text key={index} ref={node => { lightProbes.current[index] = node; }} x="0" y="0" fontSize="100">{letter}</text>)}</g>
      {letters.map((letter, index) => {
        const segment = segments[index];
        if (!segment) return null;
        const box = metrics.boxes[index] ?? { x: 0, y: -75, width: 75, height: 75 };
        const scale = metrics.size / 100;
        const used = index !== WORDSMITH_CENTRE_INDEX && selected.includes(index);
        return <text key={index} className={`wordsmith-ring-label wordsmith-ring-glyph-weight ${used ? "wordsmith-ring-label-used" : ""}`}
          fontSize={metrics.size} x={segment.label.x - (box.x + box.width / 2) * scale}
          y={segment.label.y - (box.y + box.height / 2) * scale}>{letter}</text>;
      })}
    </svg>
    <svg className="wordsmith-ring-lines" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={points(vertices)} />
      <polygon points={points(inner)} />
      {wedges.map(({ boundary: point }, i) => point && <line key={i} x1={point.x} y1={point.y} x2={50 + (point.x - 50) * .34} y2={50 + (point.y - 50) * .34} />)}
    </svg>
  </div>;
}