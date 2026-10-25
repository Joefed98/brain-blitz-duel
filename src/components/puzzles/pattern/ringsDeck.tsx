/**
 * Turntable (`rings`) deck art — presentation only. Geometry (ring radii, the
 * spoke arcs and the pointer-to-ring mapping) is unchanged; this draws the
 * plinth, platter, vinyl grooves and sheen, flashes the rings a turn moved,
 * and spins the record up at the solve. It never writes puzzle state.
 */
import { useEffect, useId, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { alignedSpokes, ringColour } from "@/lib/duel/rings";
import {
  RINGS_COLOURS,
  RINGS_COUNT,
  RINGS_SEGMENTS,
  RINGS_TURN_MS,
  type StroopColour,
} from "@/lib/duel/types";
import { soundCue } from "@/lib/fx/patternFx";

const RING_PALETTE: StroopColour[] = ["RED", "BLUE", "GREEN", "ORANGE"];

function colourOf(index: number): string {
  return GLYPH_COLOURS[RING_PALETTE[((index % RINGS_COLOURS) + RINGS_COLOURS) % RINGS_COLOURS]!];
}

/** Radii, from the outer rim inwards, as a share of the record. */
const RADII = [0.98, 0.82, 0.66, 0.5, 0.34];
const INNER_HOLE = 0.16;
/** Groove positions across each band. */
const GROOVES = [0.2, 0.4, 0.6, 0.8];

function arc(cx: number, cy: number, outer: number, inner: number, from: number, to: number) {
  const point = (radius: number, angle: number) => [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle),
  ];
  const [x1, y1] = point(outer, from);
  const [x2, y2] = point(outer, to);
  const [x3, y3] = point(inner, to);
  const [x4, y4] = point(inner, from);
  return `M ${x1} ${y1} A ${outer} ${outer} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 0 0 ${x4} ${y4} Z`;
}

/** A pie wedge for the fixed light reflection across the vinyl. */
function wedge(cx: number, cy: number, r: number, from: number, to: number) {
  const x1 = cx + r * Math.cos(from);
  const y1 = cy + r * Math.sin(from);
  const x2 = cx + r * Math.cos(to);
  const y2 = cy + r * Math.sin(to);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

/** Shortest signed step (in segments) from one offset to another. */
function stepDelta(from: number, to: number): number {
  let delta = (((to - from) % RINGS_SEGMENTS) + RINGS_SEGMENTS) % RINGS_SEGMENTS;
  if (delta > RINGS_SEGMENTS / 2) delta -= RINGS_SEGMENTS;
  return delta;
}

export function RingsDeck({
  segments,
  offsets,
  size,
  selectedRing,
  onSelect,
  solved = false,
  celebrate = false,
}: {
  segments: number[][];
  offsets: number[];
  size: number;
  selectedRing?: number | undefined;
  onSelect?: ((ring: number) => void) | undefined;
  /** Static solved look (deck lights on). */
  solved?: boolean;
  /** True for the 1.2 s solve moment: the record spins up and the strobe flashes. */
  celebrate?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const centre = size / 2;
  const half = size / 2;
  // The record sits on a platter inside the deck, leaving the corners for the tonearm and lights.
  const record = half * 0.86;
  const aligned = new Set(alignedSpokes(segments, offsets));
  const step = (Math.PI * 2) / RINGS_SEGMENTS;
  // Ring 0 is the innermost ring, drawn with the smallest radius.
  const radiusOf = (ring: number) => record * RADII[RINGS_COUNT - 1 - ring]!;
  const innerOf = (ring: number) =>
    ring === 0 ? record * INNER_HOLE : record * RADII[RINGS_COUNT - ring]! + 1.5;

  // Presentation only: each turned ring eases in from its previous angle, and the rings that
  // moved together flash once so the link reads.
  const previous = useRef<number[] | null>(null);
  const turnCount = useRef<number[]>(Array.from({ length: RINGS_COUNT }, () => 0));
  const turnFrom = useRef<number[]>(Array.from({ length: RINGS_COUNT }, () => 0));
  const turnSeq = useRef(0);
  const lastTurned = useRef<number[]>([]);
  if (previous.current && previous.current.join() !== offsets.join()) {
    const moved: number[] = [];
    for (let ring = 0; ring < RINGS_COUNT; ring += 1) {
      const delta = stepDelta(previous.current[ring] ?? 0, offsets[ring] ?? 0);
      if (delta !== 0) {
        turnCount.current[ring] = (turnCount.current[ring] ?? 0) + 1;
        turnFrom.current[ring] = delta * (360 / RINGS_SEGMENTS);
        moved.push(ring);
      }
    }
    turnSeq.current += 1;
    lastTurned.current = moved;
  }
  previous.current = [...offsets];
  const seq = turnSeq.current;
  useEffect(() => {
    if (seq > 0) soundCue("rings.turn");
  }, [seq]);

  const strobe = half * 0.91;
  const origin = `${centre}px ${centre}px`;
  const id = (name: string) => `${name}-${uid}`;

  // Everything that never changes with play: plinth, platter, fixed sheen. Built once per size.
  const deckBase = useMemo(() => {
    const corner = size * 0.075;
    const screw = Math.max(1.2, size * 0.011);
    return (
      <>
        <rect
          x={0.5}
          y={0.5}
          width={size - 1}
          height={size - 1}
          rx={size * 0.06}
          fill={`url(#${id("plinth")})`}
          stroke="var(--plinth-edge)"
          strokeWidth={1}
        />
        <rect
          x={size * 0.018}
          y={size * 0.018}
          width={size * 0.964}
          height={size * 0.964}
          rx={size * 0.048}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
        {/* Corner screws (top-left, bottom-right); the other corners hold the lights and tonearm. */}
        {[
          [corner, corner],
          [size - corner, size - corner],
        ].map(([x, y]) => (
          <g key={`screw-${x}-${y}`}>
            <circle
              cx={x}
              cy={y}
              r={screw}
              fill={`url(#${id("metal")})`}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={0.5}
            />
            <line
              x1={x! - screw * 0.6}
              y1={y! - screw * 0.6}
              x2={x! + screw * 0.6}
              y2={y! + screw * 0.6}
              stroke="rgba(0,0,0,0.55)"
              strokeWidth={Math.max(0.4, screw * 0.3)}
            />
          </g>
        ))}
        {/* Brushed-metal platter with a glossy rim and a dark mat under the record. */}
        <circle cx={centre} cy={centre} r={half * 0.955} fill={`url(#${id("metal")})`} />
        {Array.from({ length: 6 }, (_v, g) => (
          <circle
            key={`brush-${g}`}
            cx={centre}
            cy={centre}
            r={half * (0.878 + g * 0.012)}
            fill="none"
            stroke="var(--tally-white)"
            strokeOpacity={0.07}
            strokeWidth={0.6}
          />
        ))}
        <circle
          cx={centre}
          cy={centre}
          r={half * 0.955}
          fill="none"
          stroke="var(--tally-white)"
          strokeOpacity={0.35}
          strokeWidth={1.2}
        />
        <circle
          cx={centre}
          cy={centre}
          r={half * 0.955 - 1.5}
          fill="none"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={1}
        />
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, uid]);

  const defs = useMemo(
    () => (
      <defs>
        <linearGradient id={id("plinth")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--plinth-edge)" />
          <stop offset="38%" stopColor="var(--plinth)" />
          <stop offset="100%" stopColor="var(--plinth)" />
        </linearGradient>
        <linearGradient id={id("metal")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--platter)" />
          <stop offset="48%" stopColor="var(--platter-dark)" />
          <stop offset="62%" stopColor="var(--platter)" />
          <stop offset="100%" stopColor="var(--platter-dark)" />
        </linearGradient>
        {/* Depth across the vinyl: a little darker towards the rim. */}
        <radialGradient id={id("depth")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="70%" stopColor="#000" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
        <radialGradient id={id("sheen")} cx="50%" cy="50%" r="50%">
          <stop offset="20%" stopColor="#fff" stopOpacity="0" />
          <stop offset="70%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.04" />
        </radialGradient>
        {/* Batch P (live round only, batch-p.css): light from above over the record, and a blur for the
            selected ring's glow. */}
        <linearGradient id={id("lit")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="40%" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="62%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <filter id={id("glow")} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={Math.max(2.5, size * 0.012)} />
        </filter>
        <radialGradient id={id("label")} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={GLYPH_COLOURS.GOLD} stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--vinyl-label)" />
        </radialGradient>
      </defs>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid],
  );

  // Fixed light reflection: two opposite wedges that stay put while the record turns under them.
  const sheen = useMemo(
    () => (
      <g pointerEvents="none">
        <path
          d={wedge(centre, centre, record, -Math.PI * 0.86, -Math.PI * 0.64)}
          fill={`url(#${id("sheen")})`}
        />
        <path
          d={wedge(centre, centre, record, Math.PI * 0.14, Math.PI * 0.36)}
          fill={`url(#${id("sheen")})`}
        />
      </g>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, uid],
  );

  const spin = celebrate ? "rings-record-spinup" : undefined;
  const led = Math.max(1.4, size * 0.014);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rings-deck shrink-0 touch-none"
      data-celebrate={celebrate ? "on" : undefined}
      aria-label={`${gameDisplayName("rings")} deck`}
      onPointerDown={(event) => {
        if (!onSelect) return;
        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) * size) / box.width - centre;
        const y = ((event.clientY - box.top) * size) / box.height - centre;
        const distance = Math.hypot(x, y);
        let ring: number | null = null;
        for (let candidate = 0; candidate < RINGS_COUNT; candidate += 1) {
          if (distance <= radiusOf(candidate) && distance >= innerOf(candidate)) ring = candidate;
        }
        if (ring === null) return;
        onSelect(ring);
      }}
    >
      {defs}
      {deckBase}
      {/* Deck lights, bottom-left: power, then "in line" (lit when solved). */}
      <g pointerEvents="none" className="rings-deck-lights">
        <circle
          cx={size * 0.06}
          cy={size * 0.94}
          r={led}
          fill={GLYPH_COLOURS.GREEN}
          className="rings-led rings-led-power"
        />
        <circle
          cx={size * 0.06 + led * 3.2}
          cy={size * 0.94}
          r={led}
          fill={solved ? GLYPH_COLOURS.GOLD : "var(--strobe-off)"}
          className={solved ? "rings-led rings-led-sync" : "rings-led"}
        />
      </g>
      {/* Strobe dots, one per spoke, lit when that spoke is solved. */}
      {Array.from({ length: RINGS_SEGMENTS }, (_v, spoke) => {
        const angle = (spoke + 0.5) * step - Math.PI / 2;
        const lit = aligned.has(spoke);
        return (
          <circle
            key={`strobe-${spoke}`}
            cx={centre + strobe * Math.cos(angle)}
            cy={centre + strobe * Math.sin(angle)}
            r={lit ? Math.max(4.2, size * 0.02) : Math.max(2.8, size * 0.013)}
            stroke={lit ? "var(--tally-white)" : "rgba(0,0,0,0.4)"}
            strokeWidth={1}
            fill={lit ? GLYPH_COLOURS.GOLD : "var(--strobe-off)"}
            className={lit ? "rings-strobe rings-strobe-lit" : "rings-strobe"}
            style={{ ["--spoke" as string]: spoke }}
          />
        );
      })}
      <g className={spin} style={{ transformOrigin: origin }}>
        <circle cx={centre} cy={centre} r={record * 0.995} fill="var(--vinyl)" />
        {Array.from({ length: RINGS_COUNT }, (_v, ring) => {
          const outer = radiusOf(ring);
          const inner = innerOf(ring);
          return (
            <g
              key={`ring-${ring}-${turnCount.current[ring]}`}
              className={turnCount.current[ring] ? "ring-turn" : undefined}
              style={{
                transformOrigin: origin,
                ["--turn-from" as string]: `${turnFrom.current[ring]}deg`,
                ["--turn-ms" as string]: `${RINGS_TURN_MS + 60}ms`,
              }}
            >
              {Array.from({ length: RINGS_SEGMENTS }, (_s, spoke) => (
                <path
                  key={`${ring}-${spoke}`}
                  d={arc(
                    centre,
                    centre,
                    outer - 0.75,
                    inner + 0.75,
                    spoke * step - Math.PI / 2 + 0.05,
                    (spoke + 1) * step - Math.PI / 2 - 0.05,
                  )}
                  fill={colourOf(ringColour(segments, offsets, ring, spoke))}
                />
              ))}
              {/* Vinyl grooves across the band, with a lit edge on the inner lip. */}
              {GROOVES.map((t) => (
                <circle
                  key={t}
                  cx={centre}
                  cy={centre}
                  r={inner + (outer - inner) * t}
                  fill="none"
                  stroke="var(--guest-ink)"
                  strokeOpacity={0.2}
                  strokeWidth={0.6}
                />
              ))}
              <circle
                cx={centre}
                cy={centre}
                r={outer - 1.4}
                fill="none"
                stroke="#fff"
                strokeOpacity={0.22}
                strokeWidth={0.8}
              />
              <circle
                cx={centre}
                cy={centre}
                r={inner + 1.2}
                fill="none"
                stroke="#000"
                strokeOpacity={0.3}
                strokeWidth={0.8}
              />
            </g>
          );
        })}
        <circle
          cx={centre}
          cy={centre}
          r={record}
          fill={`url(#${id("depth")})`}
          pointerEvents="none"
        />
        {/* Centre label with a printed ring and the spindle. */}
        <circle
          cx={centre}
          cy={centre}
          r={record * INNER_HOLE}
          fill={`url(#${id("label")})`}
          stroke={GLYPH_COLOURS.GOLD}
          strokeOpacity={0.7}
          strokeWidth={1}
        />
        <circle
          cx={centre}
          cy={centre}
          r={record * INNER_HOLE * 0.68}
          fill="none"
          stroke="var(--vinyl)"
          strokeOpacity={0.35}
          strokeWidth={0.7}
        />
        <rect
          x={centre - record * INNER_HOLE * 0.08}
          y={centre - record * INNER_HOLE * 0.86}
          width={record * INNER_HOLE * 0.16}
          height={record * INNER_HOLE * 0.3}
          rx={1}
          fill="var(--vinyl)"
          fillOpacity={0.45}
        />
        <circle
          cx={centre}
          cy={centre}
          r={Math.max(1.5, half * 0.02)}
          fill="var(--platter)"
          stroke="var(--vinyl)"
          strokeWidth={0.6}
        />
      </g>
      {sheen}
      <circle cx={centre} cy={centre} r={record} fill={`url(#${id("lit")})`} className="rings-lit" pointerEvents="none" />
      {/* The rings that just turned together flash once (inside their own bands). */}
      {seq > 0 && lastTurned.current.length > 0 ? (
        <g key={`flash-${seq}`} pointerEvents="none" className="rings-turn-flash">
          {lastTurned.current.map((ring) => {
            const outer = radiusOf(ring);
            const inner = innerOf(ring);
            const mid = (outer + inner) / 2;
            return (
              <circle
                key={ring}
                cx={centre}
                cy={centre}
                r={mid}
                fill="none"
                stroke="#fff"
                strokeOpacity={0.55}
                strokeWidth={Math.max(1, outer - inner - 2)}
              />
            );
          })}
        </g>
      ) : null}
      {/* Reduced motion: a still gold rim instead of the spin. */}
      {celebrate ? (
        <circle
          cx={centre}
          cy={centre}
          r={record - 1}
          fill="none"
          stroke={GLYPH_COLOURS.GOLD}
          strokeWidth={2.4}
          className="rings-solve-rim"
          pointerEvents="none"
        />
      ) : null}
      {selectedRing === undefined ? null : (
        <g pointerEvents="none" className="rings-selected">
          <g className="rings-selected-glow" filter={`url(#${id("glow")})`}>
            <circle cx={centre} cy={centre} r={radiusOf(selectedRing) - 0.6} fill="none" stroke="var(--category-accent, #b07cff)" strokeWidth={Math.max(3, size * 0.014)} />
            <circle cx={centre} cy={centre} r={innerOf(selectedRing) + 0.6} fill="none" stroke="var(--category-accent, #b07cff)" strokeWidth={Math.max(3, size * 0.014)} />
          </g>
          <circle
            cx={centre}
            cy={centre}
            r={radiusOf(selectedRing) - 1.2}
            fill="none"
            stroke={GLYPH_COLOURS.GOLD}
            strokeOpacity={0.35}
            strokeWidth={2.4}
          />
          <circle
            cx={centre}
            cy={centre}
            r={innerOf(selectedRing) + 1.2}
            fill="none"
            stroke={GLYPH_COLOURS.GOLD}
            strokeOpacity={0.35}
            strokeWidth={2.4}
          />
          <circle
            cx={centre}
            cy={centre}
            r={radiusOf(selectedRing) - 0.6}
            fill="none"
            stroke={GLYPH_COLOURS.GOLD}
            strokeWidth={1.4}
          />
          <circle
            cx={centre}
            cy={centre}
            r={innerOf(selectedRing) + 0.6}
            fill="none"
            stroke={GLYPH_COLOURS.GOLD}
            strokeWidth={1.4}
          />
        </g>
      )}
      {selectedRing === undefined
        ? null
        : (() => {
            // Tonearm base in the deck's top-right corner. The arm runs down the spoke gap on the
            // diagonal, so only the needle tip touches the selected ring's outer edge.
            const angle = -Math.PI / 4;
            const tip = radiusOf(selectedRing);
            const hx = centre + tip * Math.cos(angle);
            const hy = centre + tip * Math.sin(angle);
            const px = size * 0.93;
            const py = size * 0.07;
            const w = Math.max(1, size * 0.005);
            return (
              <g pointerEvents="none" className="ring-tonearm">
                <line
                  x1={px}
                  y1={py}
                  x2={hx}
                  y2={hy}
                  stroke="rgba(0,0,0,0.45)"
                  strokeWidth={w * 2.2}
                  strokeLinecap="round"
                />
                <line
                  x1={px}
                  y1={py}
                  x2={hx}
                  y2={hy}
                  stroke="var(--tonearm)"
                  strokeWidth={w}
                  strokeLinecap="round"
                />
                <circle
                  cx={px}
                  cy={py}
                  r={size * 0.04}
                  fill={`url(#${id("metal")})`}
                  stroke="var(--tonearm)"
                  strokeWidth={1}
                />
                <circle
                  cx={px}
                  cy={py}
                  r={size * 0.022}
                  fill="var(--platter-dark)"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={0.6}
                />
                <circle cx={px} cy={py} r={size * 0.01} fill="var(--tonearm)" />
                <circle
                  cx={hx}
                  cy={hy}
                  r={w * 1.8}
                  fill={GLYPH_COLOURS.GOLD}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={0.5}
                />
              </g>
            );
          })()}
    </svg>
  );
}
