import { useLayoutEffect, useRef, useState } from "react";

import { CHART_BADGE, CHART_LANE, CHART_MARGIN, CHART_NAME_MAX, CHART_ROW_COUNT, CHART_TOP, CHART_TOP_SCORE, chartLabels, chartOnBend, chartShown, chartPoint, layoutMarkers, rowLanes } from "@/lib/duel/arcadeChart";
import { PLAYER_COLOURS, type PlayerLook } from "@/lib/duel/playerLook";
import { roundMaxFor } from "@/lib/duel/roundMax";
import type { PuzzleType } from "@/lib/duel/types";

import { PlayerBadge } from "./PlayerBadge";

export interface ChartPlayer {
  slot: number;
  name: string;
  isMe: boolean;
  /** The server's stored round score, used only to place the marker (never drawn); null until it lands. */
  score: number | null;
  look: PlayerLook | undefined;
}

/** The snake's bend radius, CSS px. */
const BEND = 12;
/** From a row's lowest marker lane to its line, and from a line to the next row's top, CSS px. */
const LINE_DROP = 9;
const ROW_GAP = 14;
const TOP = 6;
const BOTTOM = 14;
/** Spare height the chart may take on a tall screen, spread over its four rows, CSS px (the reveal's own screen, 3 Nov 2026). */
const MAX_EXTRA = 360;
/** The scale's labels are small and quiet (Joe, 3 Nov 2026): the chart's text colour, no backing, dimmed. */
const LABEL_OPACITY = 0.62;
/** The neutral track, every player's line and this player's (drawn on top), CSS px. */
const TRACK_W = 6;
const LINE_W = 6;
const MY_LINE_W = 8;
/** All chart text (23 Oct 2026): off-white on a subtle dark backing, so it reads over the lines. */
const TEXT = "#F3F1EC";
const BACKING = "rgba(7, 7, 10, 0.78)";
const TEXT_SHADOW = "0 0 2px rgba(0, 0, 0, 0.9)";

/** "You" stands out by a ring, its own label and bold text, never by a colour (a player's own may be yellow). */
const YOU_RING = "0 0 0 2px var(--background), 0 0 0 4px var(--foreground)";

/**
 * The arcade reveal's chart (arcadeChart.ts): each player's badge (their colour and icon) and name
 * placed by their stored score on one snaking line in four bands, 0–50, 51–100 (right to left), 101–150 and 151–200 (right to
 * left), each row a band and each bend a boundary: 0 and 200 at the snake's two left ends, 50 and 150 beside the right-hand
 * bends, 100 beside the left-hand one, and a score of exactly 50, 100 or 150 on its bend (3 Nov 2026), so
 * everyone sees roughly who is ahead. Each player's own line runs along the snake from 0 to their
 * place in their colour (round caps and joins), this player's drawn last and thicker. No points
 * figure is drawn or carried in the page for anyone: exact scores are for the results screen.
 * Markers that would touch stack into lanes above the line, each with a thin leader to its dot.
 * The chart takes the reveal's spare height (rows spread apart, up to MAX_EXTRA), so a room's markers sit well apart.
 * The axis is fixed at 0–200 (a game whose maximum is 150 never reaches the last band). Display only.
 */
export function ArcadeScoreChart({ players, type }: { players: ChartPlayer[]; type: PuzzleType }) {
  const max = roundMaxFor(type);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  const width = size.w;
  // Top 8 plus you (31 Oct 2026, rooms of 16); the rest are counted under the chart.
  const view = chartShown(players);
  const scored = view.shown as (ChartPlayer & { score: number })[];
  const pending = view.pending;
  const trackW = Math.max(1, width - 2 * CHART_MARGIN);
  const markers = layoutMarkers(
    scored.map((p) => ({ key: p.slot, score: p.score, name: p.isMe ? "You" : p.name })),
    trackW,
    max,
  );
  const lanes = rowLanes(markers);
  // The height the rows need; any spare height the reveal gives the chart spreads evenly over the rows.
  const needed = TOP + lanes.reduce((sum, n) => sum + n * CHART_LANE + LINE_DROP, 0) + (CHART_ROW_COUNT - 1) * ROW_GAP + BOTTOM;
  const extra = Math.max(0, Math.min(MAX_EXTRA, size.h - needed)) / CHART_ROW_COUNT;
  const lineY: number[] = [];
  let y = TOP;
  for (let row = 0; row < CHART_ROW_COUNT; row++) {
    const line = y + extra + lanes[row]! * CHART_LANE + LINE_DROP;
    lineY.push(line);
    y = line + ROW_GAP;
  }
  const height = lineY[CHART_ROW_COUNT - 1]! + BOTTOM;
  const L = CHART_MARGIN;
  const R = CHART_MARGIN + trackW;
  // The snake: the first row left to right, then a bend down at whichever end the row finished, and back.
  let path = `M ${L} ${lineY[0]} H ${R}`;
  for (let row = 1; row < CHART_ROW_COUNT; row++) {
    const right = row % 2 === 1;
    const v = lineY[row]! - BEND;
    path += right
      ? ` a ${BEND} ${BEND} 0 0 1 ${BEND} ${BEND} V ${v} a ${BEND} ${BEND} 0 0 1 ${-BEND} ${BEND} H ${L}`
      : ` a ${BEND} ${BEND} 0 0 0 ${-BEND} ${BEND} V ${v} a ${BEND} ${BEND} 0 0 0 ${BEND} ${BEND} H ${R}`;
  }
  // Length along the snake to a score's place: whole rows and bends before its row, then its share of the row.
  const bendLen = (row: number) => Math.PI * BEND + Math.max(0, lineY[row + 1]! - lineY[row]! - 2 * BEND);
  const lengthTo = (score: number) => {
    const p = chartPoint(score, max);
    let before = p.row * trackW;
    for (let r = 0; r < p.row; r++) before += bendLen(r);
    // Exactly 50, 100 or 150: the line runs on to the middle of the bend, where the dot sits.
    return before + p.along * trackW + (chartOnBend(score, max) ? bendLen(p.row) / 2 : 0);
  };
  const total = lengthTo(CHART_TOP_SCORE) + 1;
  // The labels' heights: the snake's ends on their rows' lines, 50 / 100 / 150 half-way down their bends.
  const edgeY = (edge: number) => (edge === 0 ? lineY[0]! : edge >= CHART_ROW_COUNT ? lineY[CHART_ROW_COUNT - 1]! : (lineY[edge - 1]! + lineY[edge]!) / 2);
  /** Where a score's dot sits: on its row's line, or for exactly 50, 100 or 150 the middle of that bend (just outside the line's ends). */
  const dotAt = (score: number, px: number, row: number) => {
    const bend = chartOnBend(score, max);
    if (!bend) return { x: L + px, y: lineY[row]! };
    return { x: bend % 2 === 1 ? R + BEND : L - BEND, y: edgeY(bend) };
  };
  const byKey = new Map(scored.map((p) => [p.slot, p]));
  const colourOf = (p: ChartPlayer) => PLAYER_COLOURS[p.look?.colour ?? 0]?.hex ?? PLAYER_COLOURS[0].hex;
  // Longest lines first, so a shorter line stays visible on top of a longer one; this player's always last.
  const lineOrder = [...scored].sort((a, b) => Number(a.isMe) - Number(b.isMe) || b.score - a.score || a.slot - b.slot);
  const textStyle = { color: TEXT, background: BACKING, textShadow: TEXT_SHADOW };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col" data-arcade-chart="snake">
      <p className="mb-0.5 shrink-0 font-mono text-[13px] font-semibold uppercase tracking-widest" style={{ color: TEXT }}>
        Who's ahead
      </p>
      <div ref={box} className="relative min-h-0 w-full flex-1" style={{ minHeight: needed }}>
        {width > 0 ? (
          <div className="absolute inset-x-0 top-0" style={{ height }} data-chart-body="">
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
              <path d={path} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.35} strokeWidth={TRACK_W} strokeLinecap="round" strokeLinejoin="round" />
              {lineOrder.map((p) => (
                <path
                  key={p.slot}
                  data-chart-line={p.slot}
                  d={path}
                  fill="none"
                  stroke={colourOf(p)}
                  strokeWidth={p.isMe ? MY_LINE_W : LINE_W}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={`${lengthTo(p.score)} ${total}`}
                />
              ))}
              {lineOrder.map((p) => {
                const m = markers.find((x) => x.key === p.slot)!;
                const x = L + m.px;
                const line = lineY[m.row]!;
                const badgeBottom = line - LINE_DROP - m.lane * CHART_LANE;
                const colour = colourOf(p);
                const dot = dotAt(p.score, m.px, m.row);
                return (
                  <g key={m.key}>
                    <line x1={x} x2={dot.x} y1={badgeBottom - CHART_BADGE / 2} y2={dot.y} stroke={colour} strokeWidth={p.isMe ? 2 : 1.5} strokeLinecap="round" />
                    <circle data-chart-dot={m.key} data-chart-bend={chartOnBend(p.score, max) ?? undefined} cx={dot.x} cy={dot.y} r={p.isMe ? 6.5 : 5} fill={colour} stroke={p.isMe ? "var(--foreground)" : "var(--background)"} strokeWidth={p.isMe ? 2 : 1.5} />
                  </g>
                );
              })}
            </svg>
            {chartLabels(max).map((label) => {
              // 0 and 200 just left of the snake's two ends; 50 / 100 / 150 beside the middle of their bends, outside them.
              const top = edgeY(label.edge);
              const bend = label.edge > 0 && label.edge < CHART_ROW_COUNT;
              const gap = bend ? BEND + 4 : 6;
              return (
                <span
                  key={label.text}
                  data-chart-label={label.text}
                  data-chart-label-side={label.side}
                  className="absolute -translate-y-1/2 font-mono text-[13px] font-semibold leading-none tabular-nums"
                  style={{ color: TEXT, opacity: LABEL_OPACITY, top, ...(label.side === "left" ? { right: width - L + gap } : { left: R + gap }) }}
                >
                  {label.text}
                </span>
              );
            })}
            {markers.map((m) => {
              const p = byKey.get(m.key)!;
              const top = lineY[m.row]! - LINE_DROP - m.lane * CHART_LANE - CHART_BADGE;
              const badge = (
                <span className="flex shrink-0 rounded-full" style={p.isMe ? { boxShadow: YOU_RING } : undefined}>
                  <PlayerBadge look={p.look ?? { colour: 0, icon: null }} name={p.name} size={CHART_BADGE} />
                </span>
              );
              const text = (
                // Each name on a pill in the player's own colour (Polish batch R), the text still #F3F1EC.
                <span
                  className={`min-w-0 truncate rounded-full px-1.5 py-0.5 text-[13px] leading-none ${p.isMe ? "font-bold" : "font-semibold"}`}
                  style={{ ...textStyle, background: `color-mix(in srgb, ${colourOf(p)} 32%, #17171B)`, boxShadow: `inset 0 0 0 1px ${colourOf(p)}`, maxWidth: CHART_NAME_MAX + 8 }}
                >
                  {p.isMe ? "You" : p.name}
                </span>
              );
              return (
                <div
                  key={m.key}
                  data-chart-marker={m.key}
                  data-chart-row={m.row}
                  data-chart-lane={m.lane}
                  data-chart-you={p.isMe ? "" : undefined}
                  className={`absolute flex items-center gap-1 animate-fade-in ${m.labelSide === "left" ? "flex-row-reverse" : ""}`}
                  style={{ left: L + m.left, top, width: m.width, height: CHART_BADGE, zIndex: p.isMe ? 2 : 1 }}
                >
                  {badge}
                  {text}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      {view.hidden > 0 ? (
        // In words, no digits: the chart never shows a number but its scale (room-extras-check).
        <p data-chart-hidden={view.hidden} className="mt-0.5 shrink-0 truncate text-center font-mono text-[13px] font-semibold" style={{ color: TEXT }}>
          The top eight{scored.length > CHART_TOP ? " and you" : ""} · everyone on the results
        </p>
      ) : null}
      {pending.length ? (
        <p data-chart-pending="" data-names className="mt-0.5 shrink-0 truncate text-center font-mono text-[13px] font-semibold" style={{ color: TEXT }}>
          Still scoring: {pending.length > 3 ? `${pending.slice(0, 2).map((p) => (p.isMe ? "You" : p.name)).join(", ")} and others` : pending.map((p) => (p.isMe ? "You" : p.name)).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
