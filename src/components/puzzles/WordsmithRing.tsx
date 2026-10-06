import { Button } from "@/components/ui/button";
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

/** One shared octagon geometry for live, fixed example and reveal. */
export function WordsmithRing({ letters, selected = [], disabled = true, onTap }: {
  letters: readonly string[];
  selected?: readonly number[];
  disabled?: boolean;
  onTap?: (index: number) => void;
}) {
  const outer = letters.map((_, index) => index).filter(index => index !== WORDSMITH_CENTRE_INDEX);
  return <div className="wordsmith-ring relative aspect-square w-full select-none" aria-label="Wordsmith letter ring">
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
        <span className="wordsmith-ring-letter" style={{ left: `${label.x}%`, top: `${label.y}%` }}>{letter}</span>
      </Button>;
    })}
    <svg className="wordsmith-ring-lines" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={points(vertices)} />
      <polygon points={points(inner)} />
      {vertices.map((point, i) => <line key={i} x1={point.x} y1={point.y} x2={inner[i]?.x} y2={inner[i]?.y} />)}
    </svg>
  </div>;
}