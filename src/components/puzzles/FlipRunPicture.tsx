/**
 * Roofbound's answer reveal (the Action overhaul stage 2, 15 Nov 2026): a picture of the run, not a list. The minute as
 * one strip of the cave, with the best flow streak lit gold along it, each perfect landing a gold diamond on its top
 * rail, each double flip a ring on its lower rail and each crash a red mark; then the four numbers the score is made of
 * in big type. Everything comes from the stored run replayed with the real sim (flipRunTimeline); no score is worked out
 * here (the stored score above it is the server's).
 */
import { useId } from "react";
import type { FlipTimeline } from "@/lib/duel/flipTimeline";

const W = 340;
const H = 96;
const X0 = 14;
const X1 = W - 14;
const TOP = 34;
const BAND = 22;
const LAVA = "#FF6A2A"; // design-lint-ignore: the cave's lava rail, the game's own art colour

const KEY_ITEM = { display: "inline-flex", alignItems: "center", gap: 6 } as const;
/** The cave strip's rock, the game's own basalt (art colours). */
const ROCK_LIT = "#34343E"; // design-lint-ignore: the game's basalt
const ROCK_DEEP = "#121216"; // design-lint-ignore: the game's bedrock

const at = (tick: number, total: number) => X0 + ((X1 - X0) * Math.max(0, Math.min(total, tick))) / total;

/** The four numbers that explain the score, in big type with short plain labels. */
function Stat({ value, label, testId }: { value: string; label: string; testId: string }) {
  return (
    <div data-flip-stat={testId} style={{ display: "flex", minWidth: 0, flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: "var(--jz-text)" }}>
        {value}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--jz-text-2)" }}>{label}</span>
    </div>
  );
}

function Diamond({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y - 7}L${x + 6} ${y}L${x} ${y + 7}L${x - 6} ${y}Z`} fill="var(--jz-gold)" stroke="var(--jz-bg)" strokeWidth={1.5} />;
}

export function FlipRunPicture({ timeline }: { timeline: FlipTimeline }) {
  const t = timeline;
  const id = useId().replace(/:/g, "");
  const total = t.runTicks;
  const bestW = t.best.count > 0 ? Math.max(6, at(t.best.to, total) - at(t.best.from, total)) : 0;
  const bestMid = Math.max(X0 + 44, Math.min(X1 - 44, at(t.best.from, total) + bestW / 2));
  const end = at(t.endTick, total);
  return (
    <div data-flip-run-picture="" style={{ display: "flex", width: "100%", maxWidth: 380, flexDirection: "column", alignItems: "center", gap: 12, fontFamily: "var(--jz-font)" }}>
      <svg
        data-flip-run-strip=""
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Your run: best flow ${t.best.count}, ${t.perfects.length} perfect landings, ${t.doubles.length} double flips, ${t.crashes.length} crashes`}
        style={{ display: "block", fontFamily: "var(--jz-font)" }}
      >
        <defs>
          <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={ROCK_LIT} />
            <stop offset="0.5" stopColor={ROCK_DEEP} />
            <stop offset="1" stopColor={ROCK_LIT} />
          </linearGradient>
          <linearGradient id={`${id}-flow`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--jz-gold)" stopOpacity="0.95" />
            <stop offset="1" stopColor="var(--jz-gold)" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {/* The cave: a strip of rock between two lava rails, the minute from left to right. */}
        <rect x={X0} y={TOP} width={X1 - X0} height={BAND} rx={5} fill={`url(#${id}-rock)`} />
        <line x1={X0 + 3} x2={X1 - 3} y1={TOP} y2={TOP} stroke={LAVA} strokeWidth={2} strokeLinecap="round" />
        <line x1={X0 + 3} x2={X1 - 3} y1={TOP + BAND} y2={TOP + BAND} stroke={LAVA} strokeWidth={2} strokeLinecap="round" />
        {/* A run that ended early (flipRev 11 and 12) leaves the rest of the minute dark. */}
        {end < X1 - 1 ? <rect data-flip-run-unplayed="" x={end} y={TOP - 2} width={X1 - end} height={BAND + 4} fill="var(--jz-bg)" opacity={0.75} /> : null}
        {/* The best flow streak, lit gold where it ran. */}
        {bestW > 0 ? (
          <g data-flip-run-best={t.best.count}>
            <rect x={at(t.best.from, total)} y={TOP + 4} width={bestW} height={BAND - 8} rx={4} fill={`url(#${id}-flow)`} />
            <text x={bestMid} y={TOP - 12} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--jz-gold)">
              Best flow {t.best.count}
            </text>
          </g>
        ) : null}
        {t.doubles.map((tick) => (
          <circle key={`d${tick}`} data-flip-run-double="" cx={at(tick, total)} cy={TOP + BAND} r={4.5} fill="var(--jz-bg)" stroke="var(--jz-white)" strokeWidth={2} />
        ))}
        {t.perfects.map((tick) => (
          <g key={`p${tick}`} data-flip-run-perfect="">
            <Diamond x={at(tick, total)} y={TOP} />
          </g>
        ))}
        {t.crashes.map((tick) => {
          const x = at(tick, total);
          const y = TOP + BAND / 2;
          return (
            <g key={`c${tick}`} data-flip-run-crash="">
              <circle cx={x} cy={y} r={7} fill="var(--jz-red)" stroke="var(--jz-bg)" strokeWidth={1.5} />
              <path d={`M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x + 3} ${y - 3}L${x - 3} ${y + 3}`} stroke="var(--jz-white)" strokeWidth={2} strokeLinecap="round" />
            </g>
          );
        })}
        {[0, 30, 60].map((s) => (
          <text key={s} x={at(s * 60, total)} y={H - 8} textAnchor={s === 0 ? "start" : s === 60 ? "end" : "middle"} fontSize={13} fontWeight={600} fill="var(--jz-text-2)">
            {s} s
          </text>
        ))}
      </svg>
      <div data-flip-run-key="" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 18, rowGap: 4, fontSize: 13, fontWeight: 600, color: "var(--jz-text-2)" }}>
        <span style={KEY_ITEM}>
          <svg width="12" height="14" viewBox="-6 -7 12 14" aria-hidden="true"><Diamond x={0} y={0} /></svg>
          Perfect landing
        </span>
        <span style={KEY_ITEM}>
          <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><circle r={4.5} fill="var(--jz-bg)" stroke="var(--jz-white)" strokeWidth={2} /></svg>
          Double flip
        </span>
        {t.crashes.length > 0 ? (
          <span style={KEY_ITEM}>
            <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle r={6} fill="var(--jz-red)" /></svg>
            Crash (−{t.crashCostSeconds} s)
          </span>
        ) : null}
      </div>
      <div data-flip-run-stats="" style={{ display: "grid", width: "100%", gridTemplateColumns: "1fr 1fr", columnGap: 12, rowGap: 14 }}>
        <Stat testId="clean" value={`${t.cleanSeconds} s`} label="Clean time" />
        <Stat testId="perfect" value={String(t.perfects.length)} label="Perfect landings" />
        <Stat testId="double" value={String(t.doubles.length)} label="Double flips" />
        <Stat testId="flow" value={String(t.best.count)} label="Best flow" />
      </div>
    </div>
  );
}
