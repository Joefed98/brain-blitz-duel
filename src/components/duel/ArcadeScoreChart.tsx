import { useLayoutEffect, useRef, useState } from "react";

import { CHART_BADGE, CHART_LANE, CHART_MARGIN, chartLabels, layoutMarkers, rowLanes } from "@/lib/duel/arcadeChart";
import { PLAYER_COLOURS, type PlayerLook } from "@/lib/duel/playerLook";

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
const BEND = 10;
/** From a row's lowest marker lane to its line, and from a line to the next row's top, CSS px. */
const LINE_DROP = 8;
const ROW_GAP = 12;
const TOP = 6;
const BOTTOM = 10;

/** "You" stands out by a ring, its own label and bold text, never by a colour (a player's own may be yellow). */
const YOU_RING = "0 0 0 2px var(--background), 0 0 0 4px var(--foreground)";

/**
 * The arcade reveal's chart (arcadeChart.ts): each player's badge (their colour and icon) and name
 * placed by their stored score on one snaking line, 0–50, 51–100 (right to left) and 101–150, so
 * everyone sees roughly who is ahead. No points figure is drawn or carried in the page for anyone:
 * exact scores are for the results screen. Markers that would touch stack into lanes above the
 * line, each with a stem to its dot. Display only.
 */
export function ArcadeScoreChart({ players }: { players: ChartPlayer[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  const scored = players.filter((p): p is ChartPlayer & { score: number } => p.score !== null);
  const pending = players.filter((p) => p.score === null);
  const trackW = Math.max(1, width - 2 * CHART_MARGIN);
  const markers = layoutMarkers(
    scored.map((p) => ({ key: p.slot, score: p.score, name: p.isMe ? "You" : p.name })),
    trackW,
  );
  const lanes = rowLanes(markers);
  const lineY: number[] = [];
  let y = TOP;
  for (const row of [0, 1, 2]) {
    const line = y + lanes[row]! * CHART_LANE + LINE_DROP;
    lineY.push(line);
    y = line + ROW_GAP;
  }
  const height = lineY[2]! + BOTTOM;
  const L = CHART_MARGIN;
  const R = CHART_MARGIN + trackW;
  const path = `M ${L} ${lineY[0]} H ${R} a ${BEND} ${BEND} 0 0 1 ${BEND} ${BEND} V ${lineY[1]! - BEND} a ${BEND} ${BEND} 0 0 1 ${-BEND} ${BEND} H ${L} a ${BEND} ${BEND} 0 0 0 ${-BEND} ${BEND} V ${lineY[2]! - BEND} a ${BEND} ${BEND} 0 0 0 ${BEND} ${BEND} H ${R}`;
  const byKey = new Map(scored.map((p) => [p.slot, p]));

  return (
    <div className="w-full shrink-0" data-arcade-chart="snake">
      <p className="mb-0.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">Who's ahead</p>
      <div ref={box} className="relative w-full" style={{ height }}>
        {width > 0 ? (
          <>
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
              <path d={path} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {markers.map((m) => {
                const p = byKey.get(m.key)!;
                const x = L + m.px;
                const line = lineY[m.row]!;
                const badgeBottom = line - LINE_DROP - m.lane * CHART_LANE;
                const colour = PLAYER_COLOURS[p.look?.colour ?? 0]?.hex ?? PLAYER_COLOURS[0].hex;
                return (
                  <g key={m.key}>
                    <line x1={x} x2={x} y1={badgeBottom - CHART_BADGE / 2} y2={line} stroke={colour} strokeWidth={p.isMe ? 2 : 1.5} />
                    <circle cx={x} cy={line} r={p.isMe ? 5 : 4} fill={colour} stroke={p.isMe ? "var(--foreground)" : "var(--background)"} strokeWidth={p.isMe ? 2 : 1.5} />
                  </g>
                );
              })}
            </svg>
            {chartLabels().map((label) => {
              const top = label.bend ? (lineY[label.row]! + lineY[label.row + 1]!) / 2 : lineY[label.row]!;
              const edge = label.bend ? BEND + 4 : 6;
              return (
                <span
                  key={`${label.text}-${label.row}-${label.side}`}
                  data-chart-label={label.text}
                  className="absolute -translate-y-1/2 font-mono text-[11px] leading-none tabular-nums text-muted-foreground"
                  style={label.side === "left" ? { right: width - L + edge, top } : { left: R + edge, top }}
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
                <span className={`min-w-0 truncate text-[11px] leading-none ${p.isMe ? "font-bold text-foreground" : "text-foreground/85"}`} style={{ maxWidth: 56 }}>
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
          </>
        ) : null}
      </div>
      {pending.length ? (
        <p data-chart-pending="" data-names className="mt-0.5 truncate text-center font-mono text-[11px] text-muted-foreground">
          Still scoring: {pending.map((p) => (p.isMe ? "You" : p.name)).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
